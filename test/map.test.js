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
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

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
    const el = (tag) => ({
        tag, className: '', title: '', style: {}, children: [], html: '',
        _text: '',
        get innerText() { return this._text; },
        set innerText(v) { this._text = String(v); },
        set innerHTML(v) { this.html = v; this.children.length = 0; },
        get innerHTML() { return this.html; },
        appendChild(ch) { this.children.push(ch); return ch; }
    });
    return {
        doc: { getElementById: (id) => byId[id] || null, createElement: el },
        add: (id) => (byId[id] = el('div')),
        el
    };
}

function loadMap() {
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Date,
        t: (x) => x, tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        topicLabelWithLevel: (key) => key
    };
    const src = [
        line('const OP_ORDER = '),
        line('const TIER_ICONS = '),
        line('const COUNT_TIERS = '),
        line('const MAP_PCT_MIN = '),
        slice('function ladderTierEarned(unlocks, topicKey, ladderId)',
              '// Даты ступеней, разложенные по темам', 'ladderTierEarned'),
        slice('const MAP_MARK_LADDERS = ', '\n\n', 'значки лесенок'),
        slice('const MAP_SECTIONS = [', '// ---- Разбор по типам примеров ----', 'карта'),
        ';globalThis.R = { mapCellView, renderMasteryMap, topicLadderMarks,'
            + ' MAP_PCT_MIN, MAP_HI, MAP_MID, COUNT_TIERS, TIER_ICONS };'
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

test('порядок значков: точность, скорость, количество', () => {
    const marks = R.topicLadderMarks(un({
        [`${KEY}:a3`]: '2026-01-01',
        [`${KEY}:s1`]: '2026-01-01',
        [`${KEY}:c5`]: '2026-01-01'
    }), KEY);
    eq(marks[0], R.TIER_ICONS[3], 'первая метка — точность');
    eq(marks[1], R.TIER_ICONS[1], 'вторая метка — скорость');
    eq(marks[2], R.TIER_ICONS[5], 'третья метка — количество');
});

test('невзятая лесенка показана точкой, а не пропущена', () => {
    // Иначе три метки съезжают и «серебро по скорости» читается как «по точности».
    const marks = R.topicLadderMarks(un({ [`${KEY}:s2`]: '2026-01-01' }), KEY);
    eq(marks.length, 3, 'меток всегда три');
    eq(marks[0], '·', 'точность не взята');
    eq(marks[1], R.TIER_ICONS[2], 'скорость — серебро');
    eq(marks[2], '·', 'количество не взято');
});

test('одна отстающая лесенка больше не гасит две взятые', () => {
    // Прежний сводный значок был минимумом из трёх и здесь показывал пустоту.
    const marks = R.topicLadderMarks(un({
        [`${KEY}:a5`]: '2026-01-01',
        [`${KEY}:c4`]: '2026-01-01'
    }), KEY);
    assert(marks && marks[0] === R.TIER_ICONS[5] && marks[2] === R.TIER_ICONS[4],
        'взятые ступени должны быть видны при нулевой скорости');
});

// ===================== Разметка клетки =====================
group('Что попадает в клетку');

function render(byTopic, unlocks, opts) {
    const dom = makeDoc();
    box.document = dom.doc;
    const wrap = dom.add('mapBox');
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
    eq(marksOf(c)[0], R.TIER_ICONS[3], 'золото по точности должно быть видно');
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

// ===================== Подписи =====================
group('Подписи, в которых записаны те же числа');

test('подпись под картой собирается из констант, а не переписана руками', () => {
    // Иначе сдвиг порога молча оставит под картой прежние числа.
    const call = SCRIPT.slice(SCRIPT.indexOf("getElementById('statsMapHint')"));
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
