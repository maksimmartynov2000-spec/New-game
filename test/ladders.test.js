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

    const sandbox = { console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN };
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
    count: 0, attempts: 0, accuracy: null, speedSec: null, speedSamples: 0
}, o);

group('Порог выборки растёт вместе со ступенью');

test('идеальная точность на тридцати ответах даёт серебро, а не легенду', () => {
    // Тридцать из тридцати — не доказательство 99%: доверительный интервал тянется
    // примерно от 88% до 100%. Именно здесь раньше выдавалось пять ступеней разом.
    const t = L.ladderTierByMetrics('a', metrics({ attempts: 30, accuracy: 100 }), 1, 'integer');
    eq(t, 2, 'ступень точности при 100% на 30 ответах');
});

test('золото по точности требует пятидесяти ответов', () => {
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 49, accuracy: 100 }), 1, 'integer'), 2, 'на 49 ответах');
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 50, accuracy: 100 }), 1, 'integer'), 3, 'на 50 ответах');
});

test('легенда по точности требует полного окна', () => {
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 75, accuracy: 100 }), 1, 'integer'), 4, 'на 75 ответах — алмаз');
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 99, accuracy: 100 }), 1, 'integer'), 4, 'на 99 ответах ещё алмаз');
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 100, accuracy: 100 }), 1, 'integer'), 5, 'на 100 ответах легенда');
});

test('слабая точность не поднимается выше своей ступени даже на полном окне', () => {
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 200, accuracy: 86 }), 1, 'integer'), 2, '86% — серебро');
    eq(L.ladderTierByMetrics('a', metrics({ attempts: 200, accuracy: 79 }), 1, 'integer'), 0, '79% — ниже бронзы');
});

test('у скорости тот же порог выборки', () => {
    const fast = { speedSec: 1.0 };
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ speedSamples: 30 }, fast)), 1, 'integer'), 2, 'на 30 верных');
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ speedSamples: 50 }, fast)), 1, 'integer'), 3, 'на 50 верных');
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ speedSamples: 100 }, fast)), 1, 'integer'), 5, 'на 100 верных');
    eq(L.ladderTierByMetrics('s', metrics(Object.assign({ speedSamples: 29 }, fast)), 1, 'integer'), 0, 'на 29 верных ничего');
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
    eq(L.LADDER_MIN_SAMPLE[2], 50, 'выборка для золота');
});

console.log('\n' + '─'.repeat(50));
if (failed) {
    console.log(`Провалено: ${failed}, пройдено: ${passed}`);
    failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`));
    process.exit(1);
}
console.log(`Все проверки пройдены: ${passed}`);
