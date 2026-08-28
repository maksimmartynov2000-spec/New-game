// Тесты лесенок достижений: какая ступень заслужена при каких показателях.
//
// Зачем отдельным файлом: этот кусок кода лежит за границей, по которой режет
// generator.test.js, и до него не дотягивается ни один существующий загрузчик.
// А цена ошибки тут заметная — именно здесь однажды выдалось десять достижений
// за один пример, потому что порог выборки был один на все пять ступеней.
//
// Как запускать:  node test/ladders.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// Блок лесенок самодостаточен: снаружи он зовёт только встроенные функции.
// Режем от таблицы значков до конца ladderTierByMetrics.
function loadLadders() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

    const START = "const TIER_ICONS = ";
    const END = "// Уже полученная ступень";
    const from = script.indexOf(START);
    const to = script.indexOf(END);
    if (from < 0 || to < 0) throw new Error('не найдены границы блока лесенок');

    // Подписи проходят через t(); в этом срезе перевода нет, поэтому заглушка.
    const sandbox = { console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN,
                      t: (x) => x, tf: (x) => x };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    // Объявления через const не становятся свойствами глобального объекта.
    vm.runInContext(script.slice(from, to)
        + '\n;globalThis.ladderTierByMetrics = ladderTierByMetrics;'
        + '\n;globalThis.topicMetrics = topicMetrics;'
        + '\n;globalThis.speedTiersFor = speedTiersFor;'
        + '\n;globalThis.COUNT_TIERS = COUNT_TIERS;'
        + '\n;globalThis.ACCURACY_TIERS = ACCURACY_TIERS;'
        + '\n;globalThis.LADDER_MIN_SAMPLE = LADDER_MIN_SAMPLE;',
        sandbox, { filename: 'index.html<ladders>' });
    return sandbox;
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(got, want, what) {
    if (got !== want) throw new Error(`${what}: ожидали ${want}, получили ${got}`);
}
function group(name) { console.log(`\n${name}`); }

const L = loadLadders();

// Показатели темы в том виде, в каком их считает topicMetrics.
const metrics = (o) => Object.assign({
    count: 0, attempts: 0, accuracy: null, speedSec: null
}, o);

group('Порог выборки растёт вместе со ступенью');

test('порог выборки совпадает с порогами количества', () => {
    // Одно правило на все три лесенки: «бронза за двадцать пять» значит одно и то же
    // везде. Раньше здесь стояло 30, не совпадавшее ни с чем.
    eq(L.LADDER_MIN_SAMPLE[0], L.COUNT_TIERS[0], 'бронза');
    eq(L.LADDER_MIN_SAMPLE[1], L.COUNT_TIERS[1], 'серебро');
    eq(L.LADDER_MIN_SAMPLE[2], L.COUNT_TIERS[2], 'золото');
    // Выше золота порог перестаёт расти: точность и скорость меряются по последней
    // сотне ответов, и требовать больше верных незачем — надёжнее замер не станет.
    eq(L.LADDER_MIN_SAMPLE[3], 100, 'алмаз — там же, где золото');
    eq(L.LADDER_MIN_SAMPLE[4], 100, 'легенда — там же, где золото');
});

test('идеальная точность на двадцати шести верных даёт бронзу, а не легенду', () => {
    eq(L.ladderTierByMetrics('a', metrics({ count: 24, accuracy: 100 }), 1, 'integer'), 0, 'на 24 верных ничего');
    eq(L.ladderTierByMetrics('a', metrics({ count: 26, accuracy: 90 }), 1, 'integer'), 1, 'на 26 верных при 90% — бронза');
    eq(L.ladderTierByMetrics('a', metrics({ count: 26, accuracy: 100 }), 1, 'integer'), 1, 'даже при 100% — только бронза');
});

test('серебро требует шестидесяти верных, золото — сотни', () => {
    eq(L.ladderTierByMetrics('a', metrics({ count: 59, accuracy: 100 }), 1, 'integer'), 1, 'на 59 верных');
    eq(L.ladderTierByMetrics('a', metrics({ count: 60, accuracy: 100 }), 1, 'integer'), 2, 'на 60 верных');
    eq(L.ladderTierByMetrics('a', metrics({ count: 99, accuracy: 100 }), 1, 'integer'), 2, 'на 99 верных ещё серебро');
    eq(L.ladderTierByMetrics('a', metrics({ count: 100, accuracy: 100 }), 1, 'integer'), 5, 'на сотне сразу легенда, если точность идеальна');
});

test('слабая точность не поднимается выше своей ступени даже на полной выборке', () => {
    eq(L.ladderTierByMetrics('a', metrics({ count: 200, accuracy: 86 }), 1, 'integer'), 2, '86% — серебро');
    eq(L.ladderTierByMetrics('a', metrics({ count: 200, accuracy: 79 }), 1, 'integer'), 0, '79% — ниже бронзы');
});

test('у скорости тот же порог выборки', () => {
    const fast = { speedSec: 1.0 };
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ count: 24 }, fast)), 1, 'integer'), 0, 'на 24 верных ничего');
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ count: 25 }, fast)), 1, 'integer'), 1, 'на 25 верных бронза');
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ count: 60 }, fast)), 1, 'integer'), 2, 'на 60 верных серебро');
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ count: 100 }, fast)), 1, 'integer'), 5, 'на сотне легенда');
});

// Ровно случай со скриншота: 57 верных и 3 ошибки. Раньше точность видела выборку 60
// (верные плюс ошибки) и выдавала серебро, пока количество и скорость честно ждали
// шестидесятого верного. Теперь все три считают одно и то же.
test('ошибки больше не приближают ступень точности', () => {
    const m = metrics({ count: 57, attempts: 60, accuracy: 95, speedSec: 2.5 });
    eq(L.ladderTierByMetrics('a', m, 1, 'integer'), 1, 'точность — бронза, как количество и скорость');
    eq(L.ladderTierByMetrics('c', m, 1, 'integer'), 1, 'количество — бронза');
    eq(L.ladderTierByMetrics('s', m, 1, 'integer'), 1, 'скорость — бронза');

    // А на шестидесятом верном все три поднимаются вместе.
    const m60 = metrics({ count: 60, attempts: 63, accuracy: 95, speedSec: 2.5 });
    eq(L.ladderTierByMetrics('a', m60, 1, 'integer'), 2, 'точность — серебро');
    eq(L.ladderTierByMetrics('c', m60, 1, 'integer'), 2, 'количество — серебро');
    eq(L.ladderTierByMetrics('s', m60, 1, 'integer'), 2, 'скорость — серебро');
});

// Выборка не может браться из окна: окно кончается на сотом ОТВЕТЕ, поэтому верных
// в нём всегда меньше сотни, и золото с алмазом и легендой стали бы недостижимы для
// всех, кто хоть раз ошибся.
test('золото по точности достижимо с ошибками', () => {
    // 100 верных, 10 ошибок: точность ровно 91%, порог золота — 90%.
    eq(L.ladderTierByMetrics('a', metrics({ count: 100, attempts: 110, accuracy: 91 }), 1, 'integer'), 3, 'золото');
    eq(L.ladderTierByMetrics('s', metrics({ count: 100, speedSec: 1.0 }), 1, 'integer'), 5, 'скорость тоже не заперта');
});

test('количество порогом выборки не ограничено — оно само и есть выборка', () => {
    eq(L.ladderTierByMetrics('c', metrics({ count: 24 }), 1, 'integer'), 0, '24 верных');
    eq(L.ladderTierByMetrics('c', metrics({ count: 25 }), 1, 'integer'), 1, '25 верных — бронза');
    eq(L.ladderTierByMetrics('c', metrics({ count: 100 }), 1, 'integer'), 3, '100 верных — золото');
    eq(L.ladderTierByMetrics('c', metrics({ count: 250 }), 1, 'integer'), 5, '250 верных — легенда');
});

group('Пороги скорости');

test('у целых чисел шкала плоская, у дробей растёт со звездой', () => {
    eq(L.speedTiersFor(1, 'integer').join(','), '11,9,7,5,3', 'целые, 1★');
    eq(L.speedTiersFor(5, 'integer').join(','), '11,9,7,5,3', 'целые, 5★ — та же шкала');
    eq(L.speedTiersFor(1, 'fraction').join(','), '13,11,9,7,5', 'дроби, 1★');
    eq(L.speedTiersFor(3, 'fraction').join(','), '17,15,13,11,9', 'дроби, 3★ — плюс две секунды за звезду');
});

test('ворота стоят на золоте, а золото — это третья ступень', () => {
    // Числа ворот берутся из тех же таблиц, что показывает экран достижений.
    eq(L.ACCURACY_TIERS[2], 90, 'золото по точности');
    eq(L.COUNT_TIERS[2], 100, 'золото по количеству');
    eq(L.LADDER_MIN_SAMPLE[2], 100, 'выборка для золота');
});

console.log('\n' + '─'.repeat(50));
if (failed) {
    console.log(`Провалено: ${failed}, пройдено: ${passed}`);
    failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`));
    process.exit(1);
}
console.log(`Все проверки пройдены: ${passed}`);
