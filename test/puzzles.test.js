// Тесты привязки пазлов к клеткам.
//
// Зачем: коллекция — единственное, что ученик копит месяцами, и до этой правки она
// СТИРАЛАСЬ В НОЛЬ, как только он собирал все двадцать картинок. Двадцать открытых
// карточек парадоксов исчезали разом, а на экране снова горело 0/20. Первая половина
// проверок сторожит именно это.
//
// Вторая половина — про смысл: картинка закреплена за клеткой, поэтому коллекция
// читается как карта пройденного. Но счёт кусочков остаётся общим, иначе слабый
// ученик, сидящий на первой звезде, перестал бы получать картинки вовсе.
//
// Как запускать:  node test/puzzles.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}
function line(mark) {
    const from = SCRIPT.indexOf(mark);
    if (from < 0) throw new Error('не найдена строка: ' + mark);
    return SCRIPT.slice(from, SCRIPT.indexOf('\n', from));
}

function load(collection) {
    const state = { collection: collection.slice(), saves: 0 };
    const box = {
        console, Math, Number, Object, Array, String,
        randInt: (a, b) => a,                      // без случайности: проверяем правило
        loadCollectionArray: () => state.collection.slice(),
        saveCollectionArray: (arr) => { state.saves++; state.collection = arr.slice(); },
        updateCollectionBadge: () => {},
        buildTopicKey: (m) => `${m.category}${m.isNegative ? '-' : '+'}:${m.opKey}:${m.level || 1}`,
        PUZZLE_IMAGE_SRCS: new Array(20).fill('x.jpg')
    };
    const src = [
        slice('function parseTopicKey(key)', '// Ключ для ОТОБРАЖЕНИЯ', 'parseTopicKey'),
        slice('const PUZZLE_CELL_OPS', 'function startNewPuzzle', 'выбор картинки'),
        ';globalThis.R = { puzzleIndexForTopic, puzzleTopicForIndex, pickPuzzleImageIndex,'
            + ' currentMissionTopicKey, PUZZLE_CELL_OPS };'
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
const ALL = new Array(20).fill(true);

group('Соответствие клеток и картинок');

test('двадцать клеток положительных чисел ложатся на двадцать картинок', () => {
    const box = load(NONE);
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
    const box = load(NONE);
    for (let i = 0; i < 20; i++) {
        eq(box.R.puzzleIndexForTopic(box.R.puzzleTopicForIndex(i)), i, `картинка ${i}`);
    }
});

test('у чужих разделов картинки не закреплены', () => {
    const box = load(NONE);
    eq(box.R.puzzleIndexForTopic('integer-:add:1'), null, 'отрицательные');
    eq(box.R.puzzleIndexForTopic('decimal+:mul:2'), null, 'десятичные');
    eq(box.R.puzzleIndexForTopic('fraction+:simplify:1'), null, 'дроби');
    eq(box.R.puzzleIndexForTopic(null), null, 'пусто');
});

group('Какую картинку собираем');

test('своя клетка — своя картинка', () => {
    const box = load(NONE);
    const want = box.R.puzzleIndexForTopic('integer+:mul:3');
    eq(box.R.pickPuzzleImageIndex('integer+:mul:3', -1), want);
});

test('своя собрана — берём соседнюю звезду того же действия', () => {
    // Ученик застрял на своей звезде: картинки продолжают идти, и все «про умножение».
    const col = NONE.slice();
    const own = load(NONE).R.puzzleIndexForTopic('integer+:mul:3');
    col[own] = true;
    const box = load(col);
    const got = box.R.pickPuzzleImageIndex('integer+:mul:3', -1);
    const p = box.R.puzzleTopicForIndex(got).split(':');
    eq(p[1], 'mul', 'действие должно остаться тем же');
    assert(Math.abs(got - own) === 1, `ждали соседнюю звезду, получили ${got} при своей ${own}`);
});

test('соседняя ищется только внутри своего действия', () => {
    // У умножения свободна лишь дальняя звезда, а рядом по номеру лежит чужое
    // действие. Уходить туда нельзя: картинка должна быть «про умножение».
    const box0 = load(NONE);
    const own = box0.R.puzzleIndexForTopic('integer+:mul:1');
    const col = NONE.slice();
    for (let i = own; i < own + 4; i++) col[i] = true;      // 1★–4★ умножения собраны
    const box = load(col);
    const got = box.R.pickPuzzleImageIndex('integer+:mul:1', -1);
    eq(box.R.puzzleTopicForIndex(got).split(':')[1], 'mul',
        `ушли из своего действия: картинка ${got}`);
    eq(got, own + 4, 'должна быть последняя свободная звезда умножения');
});

test('всё действие собрано — берём любую несобранную', () => {
    const col = NONE.slice();
    for (let i = 10; i < 15; i++) col[i] = true;      // всё умножение
    const box = load(col);
    const got = box.R.pickPuzzleImageIndex('integer+:mul:3', -1);
    assert(got < 10 || got >= 15, `должны были уйти из умножения, получили ${got}`);
    eq(col[got], false, 'картинка должна быть несобранной');
});

test('у чужого раздела выбор из несобранных, как раньше', () => {
    const col = NONE.slice();
    for (let i = 0; i < 19; i++) col[i] = true;
    const box = load(col);
    eq(box.R.pickPuzzleImageIndex('decimal+:mul:2', -1), 19);
});

group('Когда собрано всё');

test('коллекция НЕ обнуляется', () => {
    // Раньше здесь стирались все двадцать отметок разом, и ученик терял всё разом.
    const box = load(ALL);
    box.R.pickPuzzleImageIndex('integer+:add:2', 3);
    eq(box.state.saves, 0, 'коллекцию трогать нельзя');
    eq(box.state.collection.filter(Boolean).length, 20, 'должна остаться полной');
});

test('пазл собирается заново — картинкой своей клетки', () => {
    const box = load(ALL);
    const own = box.R.puzzleIndexForTopic('integer+:add:2');
    eq(box.R.pickPuzzleImageIndex('integer+:add:2', 7), own);
});

test('без своей клетки берём любую, кроме только что законченной', () => {
    const box = load(ALL);
    const got = box.R.pickPuzzleImageIndex('decimal+:mul:2', 0);
    assert(got !== 0, 'ту же самую картинку подряд не начинаем');
});

group('Клетка текущей миссии');

test('берётся из выбора на экране миссии, пока примера ещё нет', () => {
    const box = load(NONE);
    box.exampleConfig = { category: 'integer', numberType: 'positive', operations: { sub: 4 } };
    eq(box.R.currentMissionTopicKey(), 'integer+:sub:4');
});

test('отрицательный режим не путается с положительным', () => {
    const box = load(NONE);
    box.exampleConfig = { category: 'integer', numberType: 'negative', operations: { sub: 4 } };
    eq(box.R.currentMissionTopicKey(), 'integer-:sub:4');
});

test('при нескольких действиях клетки нет', () => {
    const box = load(NONE);
    box.exampleConfig = { category: 'integer', numberType: 'positive', operations: { add: 1, sub: 2 } };
    eq(box.R.currentMissionTopicKey(), null);
});

group('Коллекция как карта');

const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
function rule(selector) {
    const at = STYLE.indexOf(selector + ' {');
    if (at < 0) throw new Error('не найдено правило ' + selector);
    return STYLE.slice(at, STYLE.indexOf('}', at));
}

test('в ряду ровно пять картинок — по числу звёзд', () => {
    // Ряд это действие, столбец это звезда. Другое число колонок ломает чтение.
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
    // Иначе непонятно, за что клетка, пока она не собрана.
    const from = SCRIPT.indexOf('function buildCollectionItem');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('\n        }', from));
    const badgeAt = body.indexOf("badge.className = 'collection-cell'");
    const unlockedAt = body.indexOf('if (unlocked) {');
    assert(badgeAt > 0 && unlockedAt > 0 && badgeAt < unlockedAt,
        'метка звезды должна ставиться до проверки «собрана ли»');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
