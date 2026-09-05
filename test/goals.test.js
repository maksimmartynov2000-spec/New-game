// Тесты «ближайшей цели» в раскрытой карточке итогов.
//
// Зачем: три числа наверху статистики считаются ЗА ПЕРИОД («за 30 дней — 92%»),
// а лесенки — иначе: точность и скорость по последним ста примерам, количество за
// всё время, и обе живут по клеткам, а не по приложению целиком. Из-за этого «92%»
// читалось как «до золота осталось два процента», хотя золото выдаётся не за это.
//
// Раскрытая карточка называет цель поимённо, и здесь ровно два места, где легко
// соврать красиво:
//   1) выборка. Пока в клетке мало ответов, ступень не дадут НИ ПРИ КАКОМ проценте —
//      и звать «два процента до золота» целью нельзя;
//   2) скорость. У неё меньше — лучше, и недобор считается в обратную сторону.
//      Перепутать знак — значит вести ученика от цели.
//
// Как запускать:  node test/goals.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// index.html разрезан на файлы: метки срезов ищем по всему коду приложения,
// а не только во встроенном скрипте (см. test/app-source.js).
const SCRIPT = require('./app-source').appScript(HTML);

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

// topics: { ключ: { count, accuracy, speedSec, earned: {c,a,s} } }
function load(topics) {
    const byTopic = {};
    Object.keys(topics).forEach(k => (byTopic[k] = { correct: topics[k].count || 0, wrong: 0 }));
    const box = {
        console, Math, Number, Object, Array, String, JSON,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        COUNT_TIERS: [25, 60, 100, 150, 250],
        ACCURACY_TIERS: [80, 85, 90, 95, 99],
        LADDER_MIN_SAMPLE: [25, 60, 100, 100, 100],
        TIER_NAMES: ['', 'Бронза', 'Серебро', 'Золото', 'Алмаз', 'Легенда'],
        DAILY_GOAL: 20,
        speedTiersFor: () => [11, 9, 7, 5, 3],
        topicLabelWithLevel: (k) => k,
        topicMetrics: (st, key) => {
            const x = topics[key];
            return { count: x.count || 0, attempts: x.count || 0,
                     accuracy: x.accuracy === undefined ? null : x.accuracy,
                     speedSec: x.speedSec === undefined ? null : x.speedSec };
        },
        ladderTierEarned: (unlocks, key, id) => ((topics[key].earned || {})[id] || 0),
        nearestGoalTextStub: null
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(
        slice('function parseTopicKey(key) {', '// Ключ для ОТОБРАЖЕНИЯ', 'разбор ключа')
        + slice('// ===================== БЛИЖАЙШАЯ ЦЕЛЬ', '        // ===================== СВОРАЧИВАЕМЫЕ', 'ближайшая цель')
        + '\n;globalThis.G = { nearestLadderGoal, nearestGoalText, heroDetailLines };',
        box, { filename: 'index.html<ближайшая цель>' });
    return { G: box.G, st: { byTopic } };
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }

group('Какую клетку называем целью');

test('берём ту, до которой ближе всего', () => {
    const w = load({
        'integer+:add:1': { count: 20 },                       // до бронзы 5
        'integer+:sub:1': { count: 10 },                       // до бронзы 15
        'integer+:mul:1': { count: 24 }                        // до бронзы 1
    });
    const g = w.G.nearestLadderGoal(w.st, {}, 'c');
    eq(g.key, 'integer+:mul:1', 'ближайшая клетка');
    eq(g.tier, 1, 'ступень');
    eq(g.gap, 1, 'недобор');
});

test('следующая ступень считается от уже взятой, а не от первой', () => {
    const w = load({ 'integer+:add:1': { count: 70, earned: { c: 2 } } });
    const g = w.G.nearestLadderGoal(w.st, {}, 'c');
    eq(g.tier, 3, 'после серебра идёт золото');
    eq(g.needText, '100', 'порог золота по количеству');
});

test('корону не переступаем — выше ступеней нет', () => {
    const w = load({ 'integer+:add:1': { count: 400, earned: { c: 5 } } });
    eq(w.G.nearestLadderGoal(w.st, {}, 'c'), null, 'у взявшего всё цели нет');
});

test('уже дотянутую ступень целью не зовём', () => {
    // Ступень выдастся сама на следующем ответе — это не цель, а задержка записи.
    const w = load({ 'integer+:add:1': { count: 30 } });
    eq(w.G.nearestLadderGoal(w.st, {}, 'c'), null, 'недобора нет');
});

test('ключ старого формата, без звезды, в расчёт не идёт', () => {
    const w = load({ 'integer+:add': { count: 10 } });
    eq(w.G.nearestLadderGoal(w.st, {}, 'c'), null, 'у ключа без звезды лесенок нет');
});

test('пустой прогресс не роняет расчёт', () => {
    const w = load({});
    eq(w.G.nearestLadderGoal(w.st, {}, 'c'), null);
    eq(w.G.nearestLadderGoal({}, {}, 'a'), null);
    eq(w.G.nearestLadderGoal(null, null, 's'), null);
});

group('Выборка: не обещаем того, чего не дадут');

test('клетку с малой выборкой в цель не берём', () => {
    // 79% при десяти ответах — до бронзы «один процент», но бронзу не дадут:
    // для неё нужно 25 ответов. Назвать это целью значило бы соврать красиво.
    const w = load({ 'integer+:add:1': { count: 10, accuracy: 79 } });
    eq(w.G.nearestLadderGoal(w.st, {}, 'a'), null, 'выборки не хватает — цели нет');
});

test('когда выборки хватает, цель появляется', () => {
    const w = load({ 'integer+:add:1': { count: 30, accuracy: 79 } });
    const g = w.G.nearestLadderGoal(w.st, {}, 'a');
    assert(g, 'при достаточной выборке цель должна быть');
    eq(g.needText, '80%', 'порог бронзы по точности');
    eq(g.nowText, '79%', 'текущее значение');
});

test('малая выборка не перебивает честную цель в другой клетке', () => {
    const w = load({
        'integer+:add:1': { count: 10, accuracy: 79 },   // недобор 1, но выборки нет
        'integer+:sub:1': { count: 30, accuracy: 75 }    // недобор 5, зато честный
    });
    eq(w.G.nearestLadderGoal(w.st, {}, 'a').key, 'integer+:sub:1', 'выбрана честная клетка');
});

group('Скорость: меньше — лучше');

test('недобор скорости считается в обратную сторону', () => {
    const w = load({ 'integer+:add:1': { count: 30, speedSec: 12.5 } });
    const g = w.G.nearestLadderGoal(w.st, {}, 's');
    assert(g, 'цель по скорости должна быть');
    eq(g.gap, 1.5, 'до бронзы (11 с) от 12.5 с');
});

test('кто уже быстрее порога — не цель', () => {
    const w = load({ 'integer+:add:1': { count: 30, speedSec: 8 } });
    eq(w.G.nearestLadderGoal(w.st, {}, 's'), null, 'быстрее бронзы — ступень выдастся сама');
});

test('ближе тот, кому меньше ускоряться', () => {
    const w = load({
        'integer+:add:1': { count: 30, speedSec: 15 },
        'integer+:sub:1': { count: 30, speedSec: 11.4 }
    });
    eq(w.G.nearestLadderGoal(w.st, {}, 's').key, 'integer+:sub:1');
});

group('Строка для карточки');

test('строка называет ступень, клетку, порог и текущее', () => {
    const w = load({ 'integer+:add:1': { count: 20 } });
    eq(w.G.nearestGoalText(w.st, {}, 'c'),
       'Ближайшая цель — Бронза integer+:add:1: 25, сейчас 20');
});

test('цели нет — строки нет, а не «цель: —»', () => {
    const w = load({});
    eq(w.G.nearestGoalText(w.st, {}, 'c'), null);
});

group('Что показывает раскрытая карточка');

const ctx = (over) => Object.assign({
    forTutor: true, solved: 120, wrong: 12, accuracy: 90, avgSec: 6,
    days: 10, lifetime: 900, doneToday: 8, dailyGoal: 20
}, over || {});

test('первая карточка договаривает про период, всё время и среднее', () => {
    const w = load({});
    const lines = w.G.heroDetailLines(0, ctx({ st: w.st, unlocks: {} }));
    assert(lines.some(x => /За выбранный период: 120/.test(x)), 'нет периода');
    assert(lines.some(x => /За всё время: 900/.test(x)), 'нет итога за всё время');
    assert(lines.some(x => /В среднем за день занятий: 12/.test(x)), 'нет среднего за день');
});

test('без дней занятий среднее не выдумывается', () => {
    const w = load({});
    const lines = w.G.heroDetailLines(0, ctx({ st: w.st, unlocks: {}, days: 0 }));
    assert(!lines.some(x => /В среднем/.test(x)), 'деление на ноль дней');
});

test('у ученика вторая карточка про дневную цель, а не про точность', () => {
    const w = load({});
    const lines = w.G.heroDetailLines(1, ctx({ st: w.st, unlocks: {}, forTutor: false }));
    assert(lines.some(x => /Сегодня: 8 из 20/.test(x)), `не про цель дня: ${lines.join(' | ')}`);
});

test('у репетитора вторая карточка про точность', () => {
    const w = load({});
    const lines = w.G.heroDetailLines(1, ctx({ st: w.st, unlocks: {} }));
    assert(lines.some(x => /Верно 108 из 120/.test(x)), `не про точность: ${lines.join(' | ')}`);
});

test('скорость договаривает, сколько это в минуту', () => {
    const w = load({});
    const lines = w.G.heroDetailLines(2, ctx({ st: w.st, unlocks: {} }));
    assert(lines.some(x => /примерно 10 в минуту/.test(x)), `нет пересчёта: ${lines.join(' | ')}`);
});

test('скорости нет — про неё молчим, а не делим на ноль', () => {
    const w = load({});
    const lines = w.G.heroDetailLines(2, ctx({ st: w.st, unlocks: {}, avgSec: null }));
    assert(!lines.some(x => /в минуту/.test(x)), `выдумали скорость: ${lines.join(' | ')}`);
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
