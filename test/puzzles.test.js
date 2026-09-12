// Тесты пазлов: чьи картинки, за что собираются и почему их больше не надо хранить.
//
// Зачем: коллекция — единственное, что ученик копит месяцами. Здесь уже стирали её
// в ноль при полном сборе, здесь же отнимали кусочки за ошибку, и здесь счётчик
// кусочков разошёлся с ответами на сотню с лишним штук. Каждая из этих бед жила
// в отдельном хранимом числе.
//
// Теперь хранимого числа нет: картинка закреплена за клеткой и собирается за сто
// верных ответов В ЭТОЙ КЛЕТКЕ, то есть вместе с золотом по количеству. Кусочки —
// это остаток от деления, число сборов — частное. Расходиться нечему.
//
// Как запускать:  node test/puzzles.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = require('./app-source').appScript(HTML);

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

// byTopic — то, из чего теперь выводится всё про пазл. collection — старые отметки.
function load(byTopic, collection) {
    const state = { collection: (collection || new Array(20).fill(false)).slice(), saves: 0 };
    const box = {
        console, Math, Number, Object, Array, String,
        PUZZLE_TOTAL: 100,
        PUZZLE_IMAGE_SRCS: new Array(20).fill('x.jpg'),
        Progress: { get: () => ({ byTopic: byTopic || {} }) },
        loadCollectionArray: () => state.collection.slice(),
        saveCollectionArray: (arr) => { state.saves++; state.collection = arr.slice(); },
        buildTopicKey: (m) => `${m.category}${m.isNegative ? '-' : '+'}:${m.opKey}:${m.level || 1}`
    };
    const src = [
        slice('function parseTopicKey(key)', '// Ключ для ОТОБРАЖЕНИЯ', 'parseTopicKey'),
        slice('function topicCorrect(topicKey)', 'function updateCollectionBadge', 'выводимые величины'),
        slice('const PUZZLE_CELL_OPS', 'function setupPuzzleForCell', 'клетки и картинки'),
        ';globalThis.R = { puzzleIndexForTopic, puzzleTopicForIndex, currentMissionTopicKey,'
            + ' topicCorrect, puzzleFilledFor, puzzleTimesFor, collectionTimes,'
            + ' collectionCollectedCount, PUZZLE_CELL_OPS };'
    ].join('\n');
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<пазлы>' });
    box.state = state;
    return box;
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

const NONE = new Array(20).fill(false);

group('Кусочки считаются, а не хранятся');

test('кусочков ровно столько, сколько верных ответов в клетке', () => {
    const box = load({ 'integer+:add:3': { correct: 37, wrong: 9 } });
    eq(box.R.puzzleFilledFor('integer+:add:3'), 37);
});

test('сотый ответ обнуляет картинку и начинает следующую', () => {
    // Ровно сотня — это собранная картинка и пустая следующая, а не 100 из 100.
    eq(load({ 'integer+:add:3': { correct: 100 } }).R.puzzleFilledFor('integer+:add:3'), 0);
    eq(load({ 'integer+:add:3': { correct: 179 } }).R.puzzleFilledFor('integer+:add:3'), 79);
    eq(load({ 'integer+:add:3': { correct: 200 } }).R.puzzleFilledFor('integer+:add:3'), 0);
});

test('картинка собрана столько раз, сколько в клетке сотен', () => {
    const times = (n) => load({ 'integer+:mul:1': { correct: n } }).R.puzzleTimesFor('integer+:mul:1');
    eq(times(0), 0, 'ноль');
    eq(times(99), 0, 'девяносто девять');
    eq(times(100), 1, 'сотня');
    eq(times(250), 2, 'двести пятьдесят');
});

test('в клетке без ответов кусочков нет', () => {
    const box = load({});
    eq(box.R.puzzleFilledFor('integer+:div:5'), 0);
    eq(box.R.puzzleTimesFor('integer+:div:5'), 0);
});

test('ответы соседней клетки в эту не капают', () => {
    // Главное свойство правки: сто примеров «2 + 7» больше не собирают картинку
    // деления на пятой звезде.
    const box = load({ 'integer+:add:1': { correct: 99 } });
    eq(box.R.puzzleFilledFor('integer+:div:5'), 0, 'деление 5★');
    eq(box.R.puzzleFilledFor('integer+:add:1'), 99, 'сложение 1★');
});

test('ответы вне положительных чисел не собирают ничего', () => {
    const box = load({ 'integer-:mul:3': { correct: 500 }, 'fraction+:add:2': { correct: 300 } });
    eq(box.R.puzzleIndexForTopic('integer-:mul:3'), null, 'отрицательные');
    eq(box.R.puzzleIndexForTopic('fraction+:add:2'), null, 'дроби');
});

test('число кусочков нигде не сохраняется', () => {
    // Пока оно хранилось отдельно, оно умело разойтись с ответами — и разошлось
    // у всех до одного. Проверяем правило, а не удалённую строку: писать прогресс
    // пазла в хранилище больше нельзя никаким способом.
    assert(!/setPuzzle\s*\(/.test(SCRIPT), 'прогресс пазла снова пишут в хранилище');
    assert(!/savePuzzleProgress|loadPuzzleProgress/.test(SCRIPT),
        'вернулось сохранение прогресса пазла');
});

group('Коллекция');

test('уже собранную картинку не отнимают', () => {
    // До этой правки картинки давались за ответы откуда угодно. Отметки старые,
    // ответов в клетке может не быть вовсе — картинка всё равно остаётся.
    const col = NONE.slice(); col[7] = true;
    const box = load({}, col);
    eq(box.R.collectionTimes()[7], 1, 'старая отметка');
    eq(box.R.collectionCollectedCount(box.R.collectionTimes()), 1, 'всего собрано');
});

test('сотня ответов открывает картинку сразу, без отметки', () => {
    const key = load({}, NONE).R.puzzleTopicForIndex(3);
    const box = load({ [key]: { correct: 140 } }, NONE);
    eq(box.R.collectionTimes()[3], 1);
});

test('повторные сборы видны числом', () => {
    const key = load({}, NONE).R.puzzleTopicForIndex(12);
    const box = load({ [key]: { correct: 320 } }, NONE);
    eq(box.R.collectionTimes()[12], 3);
});

test('отметка и ответы не складываются, берётся большее', () => {
    const col = NONE.slice(); col[5] = true;
    const key = load({}, NONE).R.puzzleTopicForIndex(5);
    eq(load({ [key]: { correct: 250 } }, col).R.collectionTimes()[5], 2, 'ответов больше');
    eq(load({ [key]: { correct: 10 } }, col).R.collectionTimes()[5], 1, 'отметка больше');
});

group('Соответствие клеток и картинок');

test('двадцать клеток положительных чисел ложатся на двадцать картинок', () => {
    const box = load({});
    const seen = {};
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) {
            const idx = box.R.puzzleIndexForTopic(`integer+:${op}:${lvl}`);
            assert(Number.isInteger(idx), `нет картинки для ${op} ${lvl}★`);
            assert(!(idx in seen), `картинка ${idx} занята дважды: ${seen[idx]} и ${op} ${lvl}★`);
            seen[idx] = `${op} ${lvl}★`;
        }
    });
    eq(Object.keys(seen).length, 20, 'должны быть заняты все двадцать');
});

test('обратное соответствие сходится', () => {
    const box = load({});
    for (let i = 0; i < 20; i++) {
        eq(box.R.puzzleIndexForTopic(box.R.puzzleTopicForIndex(i)), i, `картинка ${i}`);
    }
});

test('у чужих разделов картинки не закреплены', () => {
    const box = load({});
    eq(box.R.puzzleIndexForTopic('integer-:add:1'), null, 'отрицательные');
    eq(box.R.puzzleIndexForTopic('decimal+:mul:2'), null, 'десятичные');
    eq(box.R.puzzleIndexForTopic('fraction+:simplify:1'), null, 'дроби');
    eq(box.R.puzzleIndexForTopic(null), null, 'пусто');
});

group('Клетка текущей миссии');

test('берётся из выбора на экране миссии, пока примера ещё нет', () => {
    const box = load({});
    box.exampleConfig = { category: 'integer', numberType: 'positive', operations: { sub: 4 } };
    eq(box.R.currentMissionTopicKey(), 'integer+:sub:4');
});

test('отрицательный режим не путается с положительным', () => {
    const box = load({});
    box.exampleConfig = { category: 'integer', numberType: 'negative', operations: { sub: 4 } };
    eq(box.R.currentMissionTopicKey(), 'integer-:sub:4');
});

test('при нескольких действиях клетки нет', () => {
    const box = load({});
    box.exampleConfig = { category: 'integer', numberType: 'positive', operations: { add: 1, sub: 2 } };
    eq(box.R.currentMissionTopicKey(), null);
});

test('без картинки мини-пазл прячется', () => {
    // В отрицательных, дробях и смешанной миссии показывать нечего. Показать чужую
    // картинку значило бы вернуть ровно то расхождение, от которого уходим.
    const from = SCRIPT.indexOf('function setupPuzzleForCell');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('\n        }', from));
    assert(/mini\.style\.display = \(idx === null\) \? 'none' : ''/.test(body),
        'мини-пазл больше не прячется при отсутствии картинки');
});

group('Коллекция как карта');

const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
function rule(selector) {
    const at = STYLE.indexOf(selector + ' {');
    if (at < 0) throw new Error('не найдено правило ' + selector);
    return STYLE.slice(at, STYLE.indexOf('}', at));
}

test('в ряду ровно пять картинок — по числу звёзд', () => {
    assert(/repeat\(5,\s*1fr\)/.test(rule('.collection-grid')),
        'сетка коллекции должна быть на пять колонок');
});

test('картинки разложены по действиям', () => {
    const from = SCRIPT.indexOf('function renderCollectionGrid');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('function buildCollectionItem', from));
    assert(/PUZZLE_CELL_OPS\.forEach/.test(body), 'группы должны строиться по действиям');
    assert(/OP_LABELS\[group\.op\]/.test(body), 'у группы должен быть заголовок с названием действия');
});

test('звезда подписана и у закрытых картинок', () => {
    const from = SCRIPT.indexOf('function buildCollectionItem');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('\n        }', from));
    const badgeAt = body.indexOf("badge.className = 'collection-cell'");
    const unlockedAt = body.indexOf('if (unlocked) {');
    assert(badgeAt > 0 && unlockedAt > 0 && badgeAt < unlockedAt,
        'метка звезды должна ставиться до проверки «собрана ли»');
});

test('число сборов показывается со второго раза', () => {
    // «×1» на каждой плитке было бы шумом: собрана — и так видно по рамке.
    const from = SCRIPT.indexOf('function buildCollectionItem');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('\n        }', from));
    assert(/if \(times > 1\)/.test(body), 'значок должен появляться только при повторе');
    assert(/collection-times/.test(STYLE), 'у значка нет оформления');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
