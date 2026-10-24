// Тесты карты разделов: что показывает клетка и каким цветом.
//
// Зачем отдельным файлом: карта — единственное место, где ученик видит свою точность
// по каждой теме, и она молча врала. Процент считался при ЛЮБОМ числе попыток, поэтому
// клетка, в которой ученик ответил дважды и один раз ошибся, показывала красное «50%»
// — приговор по двум ответам. Порог выборки, число решённых и значки лесенок теперь
// разложены по отдельным функциям именно затем, чтобы правило можно было проверить,
// а не разглядывать на экране.
//
// Разметку клетки проверяем на подставном DOM: прошлые осечки были не в расчёте, а в
// проводке — считалось верно, а на экран уходило не то.
//
// Как запускать:  node test/map.test.js

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

function line(mark) {
    const from = SCRIPT.indexOf(mark);
    if (from < 0) throw new Error(`не найдена строка: ${mark}`);
    return SCRIPT.slice(from, SCRIPT.indexOf('\n', from));
}

// --- Подставной DOM: ровно те операции, которыми пользуется карта ---
function makeDoc() {
    const byId = {};
    const el = (tag) => {
        const node = {
            tag, className: '', title: '', style: {}, children: [], html: '', handlers: {},
            _text: '',
            get innerText() { return this._text; },
            set innerText(v) { this._text = String(v); },
            set innerHTML(v) { this.html = v; this.children.length = 0; },
            get innerHTML() { return this.html; },
            get firstChild() { return this.children[0] || null; },
            appendChild(ch) { this.children.push(ch); return ch; },
            // Как в браузере: без опорного узла — в конец.
            insertBefore(ch, ref) {
                const i = ref ? this.children.indexOf(ref) : -1;
                if (i < 0) this.children.push(ch); else this.children.splice(i, 0, ch);
                return ch;
            },
            addEventListener(name, fn) { this.handlers[name] = fn; },
            click() { if (this.handlers.click) this.handlers.click(); },
            // Сворачивание раздела карты ставит классы через classList.
            classList: {
                has: (c) => node.className.split(' ').includes(c),
                contains(c) { return this.has(c); },
                add(c) { if (!this.has(c)) node.className = (node.className + ' ' + c).trim(); },
                remove(c) { node.className = node.className.split(' ').filter(x => x && x !== c).join(' '); },
                toggle(c, force) {
                    const want = force === undefined ? !this.has(c) : !!force;
                    if (want) this.add(c); else this.remove(c);
                    return want;
                }
            }
        };
        return node;
    };
    return {
        doc: { getElementById: (id) => byId[id] || null, createElement: el },
        add: (id) => (byId[id] = el('div')),
        el
    };
}

// Хранилище сворачивания — настоящее, из index.html, поверх подставного localStorage:
// проверяем, что карта пишет и читает тот же ключ, что разделы экрана.
function makeStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null),
             setItem: (k, v) => m.set(k, String(v)),
             removeItem: (k) => m.delete(k), _map: m };
}

function loadMap() {
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Date,
        LANG: 'ru', localStorage: makeStore(),
        t: (x) => x, tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        topicLabelWithLevel: (key) => key
    };
    const src = [
        slice('function plural(n, one, few, many) {', '\n}\n', 'plural') + '\n}',
        slice("const FOLD_KEY = 'mathCitadelFolds_v1';", 'function foldVisible(sec)', 'хранилище сворачивания'),
        line('const OP_ORDER = '),
        slice('const LADDERS = [', '];', 'лесенки') + '];',
        line('const TIER_ICONS = '),
        line('const COUNT_TIERS = '),
        line('const MAP_PCT_MIN = '),
        line('const LADDER_WINDOW = '),
        slice('function ladderTierEarned(unlocks, topicKey, ladderId)',
              '// Даты ступеней, разложенные по темам', 'ladderTierEarned'),
        slice('const MAP_MARK_LADDERS = ', '\n\n', 'значки лесенок'),
        slice('const MAP_SECTIONS = [', '// ---- Разбор по типам примеров ----', 'карта'),
        ';globalThis.R = { mapCellView, renderMasteryMap, topicLadderMarks, renderMapLegend,'
            + ' MAP_PCT_MIN, MAP_HI, MAP_MID, COUNT_TIERS, TIER_ICONS,'
            + ' MAP_MARK_LADDERS, MAP_LEGEND_TIERS, LADDERS };'
    ].join('\n');
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'index.html<карта>' });
    return sandbox;
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

const box = loadMap();
const R = box.R;

// ===================== Порог выборки =====================
group('Порог выборки в клетке');

test('порог — это бронза по количеству, а не отдельное число', () => {
    eq(R.MAP_PCT_MIN, R.COUNT_TIERS[0], 'порог разошёлся с бронзой');
});

test('клетка без попыток — пустая, процента нет', () => {
    const v = R.mapCellView(0, 0, R.MAP_PCT_MIN);
    eq(v.tone, 'empty', 'тон');
    eq(v.pct, null, 'процент');
});

test('две попытки с одной ошибкой не дают ни процента, ни красного', () => {
    // Ровно тот случай, из-за которого правка и делалась.
    const v = R.mapCellView(2, 1, R.MAP_PCT_MIN);
    eq(v.pct, null, 'процент по двум ответам показывать нельзя');
    eq(v.tone, 'dim', 'и красить клетку нечем');
});

test('на попытке ниже порога процента ещё нет', () => {
    eq(R.mapCellView(R.MAP_PCT_MIN - 1, 0, R.MAP_PCT_MIN).pct, null, 'порог протёк');
});

test('ровно на пороге процент появляется', () => {
    const v = R.mapCellView(R.MAP_PCT_MIN, R.MAP_PCT_MIN, R.MAP_PCT_MIN);
    eq(v.pct, 100, 'процент');
    eq(v.tone, 'hi', 'тон');
});

// ===================== Цвет =====================
group('Цвет клетки');

test('цвет идёт по точности: зелёный, жёлтый, красный', () => {
    eq(R.mapCellView(100, 85, 25).tone, 'hi', 'на границе зелёного');
    eq(R.mapCellView(100, 84, 25).tone, 'mid', 'сразу под зелёным');
    eq(R.mapCellView(100, 65, 25).tone, 'mid', 'на границе жёлтого');
    eq(R.mapCellView(100, 64, 25).tone, 'lo', 'сразу под жёлтым');
});

test('пороги цвета — те же числа, что в подписи под картой', () => {
    eq(R.MAP_HI, 85, 'зелёный');
    eq(R.MAP_MID, 65, 'жёлтый');
});

test('процент округляется, а не обрезается', () => {
    eq(R.mapCellView(30, 26, 25).pct, 87, '26 из 30 — это 87%');
});

// ===================== Значки лесенок =====================
group('Значки лесенок в клетке');

const KEY = 'integer+:add:1';
const un = (obj) => obj;

test('где ничего не взято — строки значков нет', () => {
    eq(R.topicLadderMarks({}, KEY), null, 'пустая строка значков не нужна');
});

test('порядок значков взят у экрана достижений, а не переписан', () => {
    // Два разных порядка означали бы, что ученику надо помнить оба.
    eq(R.MAP_MARK_LADDERS.join(','), R.LADDERS.map(l => l.id).join(','), 'порядок разошёлся с LADDERS');
});

test('каждая метка стоит на месте своей лесенки', () => {
    const tiers = { s: 1, a: 3, c: 5 };
    const unlocks = {};
    Object.keys(tiers).forEach(id => { unlocks[`${KEY}:${id}${tiers[id]}`] = '2026-01-01'; });
    const marks = R.topicLadderMarks(unlocks, KEY);
    R.MAP_MARK_LADDERS.forEach((id, i) => {
        eq(marks[i], R.TIER_ICONS[tiers[id]], `метка №${i + 1} — лесенка ${id}`);
    });
});

test('невзятая лесенка показана точкой, а не пропущена', () => {
    // Иначе три метки съезжают и «серебро по скорости» читается как «по точности».
    const marks = R.topicLadderMarks(un({ [`${KEY}:s2`]: '2026-01-01' }), KEY);
    const at = R.MAP_MARK_LADDERS.indexOf('s');
    eq(marks.length, 3, 'меток всегда три');
    eq(marks[at], R.TIER_ICONS[2], 'скорость — серебро');
    marks.forEach((m, i) => { if (i !== at) eq(m, '·', `лесенка ${R.MAP_MARK_LADDERS[i]} не взята`); });
});

test('одна отстающая лесенка больше не гасит две взятые', () => {
    // Прежний сводный значок был минимумом из трёх и здесь показывал пустоту.
    const marks = R.topicLadderMarks(un({
        [`${KEY}:a5`]: '2026-01-01',
        [`${KEY}:c4`]: '2026-01-01'
    }), KEY);
    assert(marks, 'строка значков не должна пропадать из-за одной пустой лесенки');
    eq(marks[R.MAP_MARK_LADDERS.indexOf('a')], R.TIER_ICONS[5], 'точность');
    eq(marks[R.MAP_MARK_LADDERS.indexOf('c')], R.TIER_ICONS[4], 'количество');
});

// ===================== Разметка клетки =====================
group('Что попадает в клетку');

let lastWrap = null;
function render(byTopic, unlocks, opts) {
    const dom = makeDoc();
    box.document = dom.doc;
    const wrap = dom.add('mapBox');
    lastWrap = wrap;
    R.renderMasteryMap(byTopic, unlocks || {}, 'mapBox', opts);
    const cells = [];
    (function walk(node) {
        node.children.forEach(ch => {
            if (String(ch.className).indexOf('map-cell') === 0) cells.push(ch);
            walk(ch);
        });
    })(wrap);
    return cells;
}
// Сравнение точное: с проверкой «начинается с» переименование класса проходило мимо
// теста — 'map-n-x' тоже начинается с 'map-n'.
function textOf(cell, cls) {
    const hit = cell.children.filter(ch => ch.className === cls);
    return hit.length ? hit[0].innerText : null;
}
function marksOf(cell) {
    const row = cell.children.filter(ch => ch.className === 'map-marks');
    return row.length ? row[0].children.map(ch => ch.innerText) : null;
}

const FULL = { 'integer+:add:1': { correct: 27, wrong: 3 } };   // 30 попыток, 90%
const THIN = { 'integer+:add:1': { correct: 4, wrong: 1 } };    // 5 попыток

test('в набранной клетке стоят и процент, и число решённых', () => {
    const c = render(FULL, {})[0];
    eq(textOf(c, 'map-pct'), '90%', 'процент');
    eq(textOf(c, 'map-n'), '30', 'число попыток');
});

test('в клетке ниже порога стоит число, и оно не выдаётся за процент', () => {
    const c = render(THIN, {})[0];
    eq(textOf(c, 'map-pct'), '5', 'вместо процента — число решённых');
    eq(textOf(c, 'map-n'), null, 'дублировать то же число вторым рядом незачем');
    assert(c.className.indexOf('dim') >= 0, `клетка ниже порога должна быть без цвета: ${c.className}`);
});

test('значки лесенок доходят до клетки', () => {
    const c = render(FULL, { 'integer+:add:1:a3': '2026-01-01' })[0];
    eq(marksOf(c)[R.MAP_MARK_LADDERS.indexOf('a')], R.TIER_ICONS[3], 'золото по точности должно быть видно');
});

test('значки видны и в клетке, где примеров ещё мало', () => {
    // Заработанное не отбирается — незачем прятать его до набора выборки.
    const c = render(THIN, { 'integer+:add:1:c1': '2026-01-01' })[0];
    assert(marksOf(c), 'в неполной клетке значки тоже нужны');
});

test('вид у ребёнка и у репетитора один и тот же', () => {
    // Раньше детский вызов гасил процент флагом, и экран противоречил сам себе:
    // сверху карточка «Точность 90%», ниже карта, где о точности ни слова.
    const child = render(FULL, {});
    const tutor = render(FULL, {});
    eq(textOf(child[0], 'map-pct'), textOf(tutor[0], 'map-pct'), 'процент');
    assert(!/noPct/.test(SCRIPT), 'флаг детского вида не должен вернуться в код');
});

test('в отчёте на листе клетка остаётся односложной', () => {
    const c = render(FULL, { 'integer+:add:1:a3': '2026-01-01' }, { compact: true })[0];
    eq(textOf(c, 'map-pct'), '90%', 'процент нужен и в отчёте');
    eq(textOf(c, 'map-n'), null, 'вторая строка в компактной клетке лишняя');
    eq(marksOf(c), null, 'значки в компактной клетке лишние');
});

test('сетка отчёта помечена как компактная — иначе квадрат из стилей не применится', () => {
    render(FULL, {}, { compact: true });
    const grids = [];
    (function walk(node) { node.children.forEach(ch => { if (/map-grid/.test(ch.className)) grids.push(ch); walk(ch); }); })(lastWrap);
    assert(grids.length > 0, 'сетка не найдена');
    assert(/\bcompact\b/.test(grids[0].className), `сетка отчёта без метки: ${grids[0].className}`);
});

test('подсказка нерешённой клетки не обещает точности', () => {
    const cells = render({ 'integer+:add:1': { correct: 27, wrong: 3 } }, {});
    const empty = cells.filter(c => c.innerText === '·' || textOf(c, 'map-pct') === '·');
    assert(empty.length > 0, 'в разделе должны остаться и нерешённые клетки');
    assert(/ещё не решал/.test(empty[0].title), `подсказка: ${empty[0].title}`);
});

test('подсказка неполной клетки называет порог', () => {
    const c = render(THIN, {})[0];
    assert(c.title.indexOf(String(R.MAP_PCT_MIN)) >= 0, `в подсказке нет порога: ${c.title}`);
});

// ===================== Сворачивание на экране статистики =====================
group('Разделы карты сворачиваются по одному');

// Разделы карты — блоки верхнего уровня; у каждого заголовок, а в заголовке на
// экране статистики стрелка и сводка.
function renderBlocks(byTopic, opts) {
    render(byTopic, {}, opts);
    return lastWrap.children;
}
const titleOf = (block) => block.children.filter(ch => ch.className === 'map-title')[0];
const sumOf = (block) => {
    const hit = titleOf(block).children.filter(ch => ch.className === 'map-fold-sum')[0];
    return hit ? hit.innerText : null;
};
const has = (node, cls) => node.className.split(' ').includes(cls);
const FOLD_KEY = 'mathCitadelFolds_v1';
const savedFolds = () => JSON.parse(box.localStorage.getItem(FOLD_KEY) || '{}');
function resetFolds() { box.localStorage._map.clear(); }

const NEG_FULL = { 'integer-:sub:2': { correct: 18, wrong: 12 } };   // 30 попыток, 60%

test('раздел с ответами по умолчанию открыт, в заголовке — процент и число ответов', () => {
    resetFolds();
    const [b] = renderBlocks(FULL, { foldable: true });
    assert(has(b, 'map-fold'), `раздел не помечен сворачиваемым: ${b.className}`);
    assert(!has(b, 'folded'), 'раздел с ответами свёрнут без спроса');
    eq(sumOf(b), '90% · 30 ответов', 'сводка');
});

test('пока ответов меньше порога, в сводке только их число — как в клетке', () => {
    // «80%» по пяти ответам — тот самый приговор, от которого карту уже лечили.
    resetFolds();
    const [b] = renderBlocks(THIN, { foldable: true });
    eq(sumOf(b), '5 ответов', 'сводка ниже порога');
});

test('сводка ровно на пороге уже с процентом', () => {
    resetFolds();
    const [b] = renderBlocks({ 'integer+:mul:3': { correct: R.MAP_PCT_MIN, wrong: 0 } }, { foldable: true });
    eq(sumOf(b), `100% · ${R.MAP_PCT_MIN} ответов`, 'сводка на пороге');
});

test('процент сводки — по всему разделу, а не по одной клетке', () => {
    resetFolds();
    const [b] = renderBlocks({ 'integer+:add:1': { correct: 27, wrong: 3 },
                               'integer+:div:5': { correct: 3, wrong: 7 } }, { foldable: true });
    eq(sumOf(b), '75% · 40 ответов', 'сводка двух клеток');
});

test('процент сводки округляется, а не обрезается', () => {
    resetFolds();
    const [b] = renderBlocks({ 'integer+:add:2': { correct: 20, wrong: 10 } }, { foldable: true });
    eq(sumOf(b), '67% · 30 ответов', 'две трети — это 67%, а не 66%');
});

test('нажатие сворачивает раздел и запоминает это', () => {
    resetFolds();
    const [b] = renderBlocks(FULL, { foldable: true });
    titleOf(b).click();
    assert(has(b, 'folded'), 'по нажатию раздел не свернулся');
    eq(savedFolds()['stats:map:integer+'], false, 'выбор не сохранён');
    titleOf(b).click();
    assert(!has(b, 'folded'), 'по второму нажатию раздел не открылся');
    eq(savedFolds()['stats:map:integer+'], true, 'второй выбор не сохранён');
});

test('сохранённый выбор побеждает умолчание при следующей отрисовке', () => {
    resetFolds();
    titleOf(renderBlocks(FULL, { foldable: true })[0]).click();
    const [again] = renderBlocks(FULL, { foldable: true });
    assert(has(again, 'folded'), 'закрытый учеником раздел снова открылся сам');
});

test('разделы сворачиваются независимо друг от друга', () => {
    resetFolds();
    const both = Object.assign({}, FULL, NEG_FULL);
    const [pos, neg] = renderBlocks(both, { foldable: true });
    titleOf(neg).click();
    const [pos2, neg2] = renderBlocks(both, { foldable: true });
    assert(has(neg2, 'folded'), 'отрицательные не остались свёрнутыми');
    assert(!has(pos2, 'folded'), 'вместе с отрицательными свернулись и положительные');
    eq(sumOf(neg2), '60% · 30 ответов', 'сводка отрицательных');
    assert(pos && neg, 'должно быть два раздела');
});

test('пустой раздел из списка показан свёрнутым и не открывается', () => {
    resetFolds();
    const blocks = renderBlocks(FULL, { foldable: true, showSections: ['integer+', 'integer-'] });
    eq(blocks.length, 2, 'пустой раздел из списка должен быть нарисован');
    const empty = blocks[1];
    assert(has(empty, 'folded') && has(empty, 'empty'), `пустой раздел: ${empty.className}`);
    eq(sumOf(empty), 'нет ответов за период', 'сводка пустого');
    titleOf(empty).click();
    assert(has(empty, 'folded'), 'пустой раздел открылся — внутри только прочерки');
    eq(JSON.stringify(savedFolds()), '{}', 'нажатие на пустой раздел ничего не должно записывать');
});

test('пустой раздел свёрнут, даже если раньше его открывали', () => {
    // На прошлой неделе раздел был с ответами и открыт, на этой — пуст.
    resetFolds();
    box.localStorage.setItem(FOLD_KEY, JSON.stringify({ 'stats:map:integer-': true }));
    const [, neg] = renderBlocks(FULL, { foldable: true, showSections: ['integer-'] });
    assert(has(neg, 'folded'), 'пустой раздел развернулся по старому выбору');
});

test('пустой раздел не из списка не рисуется', () => {
    resetFolds();
    const blocks = renderBlocks(FULL, { foldable: true, showSections: [] });
    eq(blocks.length, 1, 'нарисован раздел, где ответов нет и который не просили');
});

test('отчёт на листе не сворачивается: без стрелки, без сводки, ничего не спрятано', () => {
    // Отчёт уходит родителям скриншотом — свёрнутое там просто пропало бы.
    resetFolds();
    box.localStorage.setItem(FOLD_KEY, JSON.stringify({ 'stats:map:integer+': false }));
    const [b] = renderBlocks(FULL, { compact: true });
    assert(!has(b, 'map-fold') && !has(b, 'folded'), `раздел отчёта: ${b.className}`);
    eq(titleOf(b).children.length, 0, 'в заголовке отчёта лишнее');
});

test('экран статистики просит сворачивание и даёт ученику все его разделы', () => {
    const at = SCRIPT.indexOf("renderMasteryMap(topicSource, st.unlocks || {}, 'statsMap'");
    assert(at >= 0, 'вызов карты на экране статистики не найден');
    const call = SCRIPT.slice(at, SCRIPT.indexOf(';', at));
    assert(/foldable:\s*true/.test(call), `карта статистики без сворачивания: ${call}`);
    assert(/showSections:\s*ownSections/.test(call), `карта статистики без списка разделов: ${call}`);
    const from = SCRIPT.indexOf('const ownSections = ');
    const own = SCRIPT.slice(from, SCRIPT.indexOf(';', from));
    // Репетитору доступ ученика не под рукой: пустые разделы ему не показываем.
    assert(/foreignState \? \[\]/.test(own), `репетитору пустые разделы не нужны: ${own}`);
    assert(/isSectionOpen/.test(own), `ученику — только открытые ему разделы: ${own}`);
});

// ===================== Образец =====================
group('Образец под картой');

function legend() {
    const dom = makeDoc();
    box.document = dom.doc;
    const wrap = dom.add('legendBox');
    R.renderMapLegend('legendBox');
    // Ищем вглубь: образец лежит строкой (клетка + подписи) плюс примечание под ней.
    const all = [];
    (function walk(node) { node.children.forEach(ch => { all.push(ch); walk(ch); }); })(wrap);
    const byClass = (cls) => all.filter(ch => ch.className === cls)[0];
    return {
        wrap, all,
        cell: all.filter(ch => String(ch.className).indexOf('map-cell') === 0)[0],
        items: byClass('map-legend-items'),
        note: byClass('map-legend-note')
    };
}

test('в образце есть клетка-пример и три подписи', () => {
    const L = legend();
    assert(L.cell, 'клетка-пример не нарисована');
    assert(L.items, 'подписей нет');
    eq(L.items.children.length, R.MAP_MARK_LADDERS.length, 'подписей должно быть по числу лесенок');
});

test('клетка-пример собрана из тех же кирпичей, что настоящая', () => {
    // Иначе образец объясняет не то, что ученик видит на карте.
    const L = legend();
    assert(textOf(L.cell, 'map-pct'), 'в примере нет процента');
    assert(textOf(L.cell, 'map-n'), 'в примере нет числа решённых');
    eq(marksOf(L.cell).length, 3, 'в примере должно быть три значка');
});

test('ступени в примере разные — иначе позиции не различить', () => {
    const L = legend();
    const marks = marksOf(L.cell);
    eq(new Set(marks).size, 3, `значки в примере повторяются: ${marks.join(' ')}`);
});

test('подписи идут в том же порядке, что значки в клетке', () => {
    const L = legend();
    const names = L.items.children.map(ch =>
        ch.children.filter(x => x.className !== 'map-legend-mark')[0].innerText);
    R.MAP_MARK_LADDERS.forEach((id, i) => {
        const l = R.LADDERS.filter(x => x.id === id)[0];
        assert(names[i].indexOf(l.name) >= 0,
            `подпись №${i + 1} должна быть про «${l.name}», а там «${names[i]}»`);
    });
});

test('у каждой подписи стоит ровно тот значок, что в примере на её месте', () => {
    // Это и есть весь смысл образца: глазами связать позицию и лесенку.
    const L = legend();
    const marks = marksOf(L.cell);
    L.items.children.forEach((row, i) => {
        const mark = row.children.filter(x => x.className === 'map-legend-mark')[0];
        eq(mark.innerText, marks[i], `значок подписи №${i + 1} разошёлся с примером`);
    });
});

test('образец говорит, по какому окну считается каждая лесенка', () => {
    // Окна разные: значки — по последней сотне и за всё время, а процент в клетке —
    // за выбранный период. Без этой строки «100%» в клетке читается как «сто из ста».
    const L = legend();
    assert(L.note && L.note.innerText.length > 0, 'примечания под образцом нет');
    assert(/100/.test(L.note.innerText), `в примечании нет размера окна: ${L.note.innerText}`);
    assert(/всё время/.test(L.note.innerText), `в примечании нет «за всё время»: ${L.note.innerText}`);
});

// ===================== Кому что видно =====================
group('Кому что видно');

test('образец рисуется обоим, без разбора на ребёнка и репетитора', () => {
    const from = SCRIPT.indexOf("renderMapLegend('statsMapLegend')");
    assert(from > 0, 'образец не вызывается со экрана статистики');
    const line = SCRIPT.slice(SCRIPT.lastIndexOf('\n', from), SCRIPT.indexOf(';', from));
    assert(!/forTutor/.test(line), `образец не должен зависеть от роли: ${line.trim()}`);
});

test('разбор порогов виден только репетитору', () => {
    const from = SCRIPT.indexOf('hintEl.style.display');
    assert(from > 0, 'подпись под картой больше не прячется');
    const line = SCRIPT.slice(from, SCRIPT.indexOf(';', from));
    assert(/forTutor/.test(line), `подпись должна прятаться у ребёнка: ${line}`);
});

// ===================== Место в клетке =====================
group('Место в клетке');

const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
function rule(selector) {
    const at = STYLE.indexOf(selector + ' {');
    if (at < 0) throw new Error('не найдено правило ' + selector);
    return STYLE.slice(at, STYLE.indexOf('}', at));
}

test('клетка не заперта в квадрат: высоту задаёт содержимое', () => {
    // С жёстким aspect-ratio три строки на узком экране влезали впритык, и медали
    // на айфоне налезали на число: шрифт эмодзи выходит за границы своей строки.
    assert(!/aspect-ratio/.test(rule('.map-cell')), 'квадрат клетке снова навязан');
    assert(/min-height/.test(rule('.map-cell')), 'без min-height пустые клетки схлопнутся');
});

test('в отчёте на листе клетка остаётся квадратной', () => {
    assert(/aspect-ratio/.test(rule('.map-grid.compact .map-cell')), 'в отчёте квадрат нужен');
});

test('значки не шире клетки: нижняя граница размера не растёт', () => {
    // Здесь только проверка стилей: измерить ширину без браузера нельзя. Порог взят
    // из замера — при 0.62rem три медали переставали влезать в колонку на экране
    // шириной 320 px, и сетка начинала ехать вбок.
    const fs = /font-size:\s*clamp\(([^,]+),/.exec(rule('.map-marks'));
    assert(fs, 'размер значков должен расти с экраном, а не быть постоянным');
    const min = parseFloat(fs[1]);
    assert(/rem/.test(fs[1]) && min <= 0.56, `нижняя граница ${fs[1]} — на узком экране сетка поедет вбок`);
});

test('у строки значков есть запас по высоте', () => {
    const lh = /line-height:\s*([\d.]+)/.exec(rule('.map-marks'));
    assert(lh, 'у строки значков не задана высота строки');
    assert(parseFloat(lh[1]) >= 1.2, `высота строки ${lh[1]} — эмодзи снова налезут на число`);
});

// ===================== Подписи =====================
group('Подписи, в которых записаны те же числа');

test('подпись под картой собирается из констант, а не переписана руками', () => {
    // Иначе сдвиг порога молча оставит под картой прежние числа.
    const call = SCRIPT.slice(SCRIPT.indexOf('hintEl.innerText = tf('));
    const arg = call.slice(0, call.indexOf(';'));
    assert(/MAP_HI/.test(arg) && /MAP_MID/.test(arg) && /MAP_PCT_MIN/.test(arg),
        `подпись под картой не берёт числа из констант: ${arg.slice(0, 120)}`);
});

test('заметка в отчёте родителям называет те же числа', () => {
    // Этот текст статический и уходит наружу; расхождение с кодом заметит только родитель.
    const from = HTML.indexOf('<div id="repMap"></div>');
    const note = HTML.slice(from, HTML.indexOf('</div>', HTML.indexOf('report-note', from)));
    // Число ищем целиком: с поиском подстроки «25» проходило бы и за «5».
    const says = (n) => new RegExp('(^|\\D)' + n + '(\\D|$)').test(note);
    assert(says(R.MAP_HI), `в заметке нет порога зелёного ${R.MAP_HI}: ${note}`);
    assert(says(R.MAP_PCT_MIN), `в заметке нет порога выборки ${R.MAP_PCT_MIN}`);
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
