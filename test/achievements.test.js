// Тесты экрана достижений: сворачивание разделов и сводка в заголовке.
//
// Зачем отдельным файлом: полный список — это двадцать строк и сто чипов, на узком
// телефоне четыре экрана прокрутки. Разделы теперь сворачиваются, и у этого есть
// ровно одна опасная сторона: итоги в подзаголовке раньше накапливались ПО ХОДУ
// отрисовки строк. Свернул раздел — строки не нарисовались — «звёзд взято» молча
// уменьшилось. Число прыгало бы от каждого нажатия на заголовок, и никто бы не понял
// почему. Ниже это проверяется прямо.
//
// Вторая опасность — свёрнутый заголовок без сводки: экран стал бы короче, но по нему
// нечего было бы понять. Сводка считается той же функцией, что рисует чипы, иначе она
// разъедется с содержимым.
//
// Как запускать:  node test/achievements.test.js

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

// --- Подставной DOM ---
function makeDoc() {
    const byId = {};
    const el = (tag) => ({
        tag, className: '', title: '', style: {}, children: [], handlers: {},
        _text: '',
        get innerText() { return this._text; },
        set innerText(v) { this._text = String(v); },
        set innerHTML(v) { this.children.length = 0; },
        appendChild(ch) { this.children.push(ch); return ch; },
        addEventListener(name, fn) { this.handlers[name] = fn; }
    });
    return { doc: { getElementById: (id) => byId[id] || null, createElement: el }, add: (id) => (byId[id] = el('div')) };
}

function makeStore() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
        _map: m
    };
}

// Ступени тем задаём прямо, лесенки не пересчитываем: здесь проверяется экран,
// а не правила выдачи наград — у них свои тесты.
function loadScreen(opts) {
    const o = opts || {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        TIER_ICONS: ['', '🥉', '🥈', '🥇', '💎', '👑'],
        MASTERY_MIN_TIER: 4,
        LEVEL_GATE_TIER: 3,
        OP_LABELS: {},
        localStorage: o.store || makeStore(),
        topicLabelWithLevel: (k) => k,
        buildLadderCard: () => ({ className: 'ladder-card', children: [] }),
        // тема → { mastery, gate, open }
        topicMasteryTier: (unlocks, key) => (unlocks[key] || {}).mastery || 0,
        levelGatePassed: (unlocks, key) => !!(unlocks[key] || {}).gate,
        isLevelOpen: (secKey, op, lvl) => {
            const u = sandboxRef.unlocks || {};
            const cfg = u[`${secKey}:${op}:${lvl}`];
            return cfg ? cfg.open !== false : (o.openByDefault !== false);
        },
        renderAchievementsScreen: () => sandboxRef.rerender()
    };
    const sandboxRef = sandbox;
    const src = [
        SCRIPT.slice(SCRIPT.indexOf('const OP_ORDER = '), SCRIPT.indexOf('\n', SCRIPT.indexOf('const OP_ORDER = '))),
        // MAP_SECTIONS уехала в js/charts.js, где отступа в восемь пробелов уже нет —
        // поэтому метка конца без него.
        slice('const MAP_SECTIONS = [', '\nconst OP_SHORT', 'разделы'),
        slice('let openLadderKey = null;', 'function ladderGoalText(', 'экран достижений'),
        ';globalThis.R = { renderTopicLadders, sectionSummary, sectionSummaryText,'
            + ' activeSectionKey, toggleAchSection, MAP_SECTIONS,'
            + ' get openAchSections() { return openAchSections; },'
            + ' set openAchSections(v) { openAchSections = v; } };'
    ].join('\n');
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'index.html<достижения>' });
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

// --- Отрисовка целиком, с подставным DOM ---
function screen(opts) {
    const box = loadScreen(opts);
    const o = opts || {};
    box.unlocks = o.unlocks || {};
    let dom, list, subtitle;
    box.rerender = () => {
        dom = makeDoc();
        box.document = dom.doc;
        list = dom.add('ladderList');
        subtitle = dom.add('achievementsSubtitle');
        box.R.renderTopicLadders({ daily: o.daily || {}, byTopic: o.byTopic || {} }, box.unlocks);
    };
    box.rerender();
    const api = {
        box,
        get subtitle() { return subtitle.innerText; },
        sections() { return list.children.filter(ch => /ach-section/.test(ch.className)); },
        head(sec) { return sec.children.filter(ch => ch.className === 'ach-section-head')[0]; },
        sumText(sec) {
            const h = api.head(sec);
            return h.children.filter(ch => ch.className === 'ach-section-sum')[0].innerText;
        },
        nameText(sec) {
            const h = api.head(sec);
            return h.children.filter(ch => ch.className === 'ach-section-name')[0].innerText;
        },
        rows(sec) { return sec.children.filter(ch => ch.className === 'ach-op-row'); },
        chips(sec) {
            const out = [];
            api.rows(sec).forEach(r => r.children.forEach(c => {
                if (c.className === 'ach-stars') c.children.forEach(ch => out.push(ch));
            }));
            return out;
        },
        click(sec) { api.head(sec).handlers.click(); }
    };
    return api;
}

const SEC0 = 'integer+';

group('Что открыто при входе');

test('открыт раздел, в котором ученик занимался последним', () => {
    const s = screen({ daily: {
        '2026-09-01': { t: { 'integer+:add:1': [10, 0, 0, 0, 0] } },
        '2026-09-02': { t: { 'decimal+:mul:2': [12, 1, 0, 0, 0] } }
    } });
    const open = s.sections().filter(sec => !/closed/.test(sec.className));
    eq(open.length, 1, 'открытых разделов должно быть ровно один');
    assert(/Десятичные/.test(s.nameText(open[0])), `открылся не тот раздел: ${s.nameText(open[0])}`);
});

test('внутри дня берётся тема с наибольшим числом попыток', () => {
    const box = loadScreen({});
    eq(box.R.activeSectionKey({ '2026-09-02': { t: {
        'integer+:add:1': [3, 0, 0, 0, 0],
        'fraction+:mul:2': [40, 5, 0, 0, 0]
    } } }), 'fraction+', 'раздел последней активности');
});

test('без единого дня открывается первый доступный раздел', () => {
    const s = screen({ daily: {} });
    const open = s.sections().filter(sec => !/closed/.test(sec.className));
    eq(open.length, 1, 'должен открыться ровно один раздел');
    assert(/Положительные/.test(s.nameText(open[0])), `открылся ${s.nameText(open[0])}`);
});

group('Свёрнутый раздел');

test('у свёрнутого раздела нет ни одной строки действий', () => {
    const s = screen({ daily: {} });
    const closed = s.sections().filter(sec => /closed/.test(sec.className));
    assert(closed.length >= 1, 'должен быть хотя бы один свёрнутый раздел');
    closed.forEach(sec => eq(s.rows(sec).length, 0, `свёрнутый раздел ${s.nameText(sec)} рисует строки`));
});

test('у свёрнутого раздела остаётся сводка — это не пустая дверь', () => {
    const s = screen({ daily: {} });
    s.sections().forEach(sec => {
        assert(s.sumText(sec).length > 0, `у раздела ${s.nameText(sec)} пустая сводка`);
    });
});

test('нажатие на заголовок разворачивает и сворачивает раздел', () => {
    const s = screen({ daily: {} });
    const target = s.sections().filter(sec => /closed/.test(sec.className))[0];
    const name = s.nameText(target);
    s.click(target);
    const after = s.sections().filter(sec => s.nameText(sec) === name)[0];
    assert(!/closed/.test(after.className), 'раздел не развернулся');
    assert(s.rows(after).length > 0, 'строки не появились');
    s.click(after);
    const back = s.sections().filter(sec => s.nameText(sec) === name)[0];
    assert(/closed/.test(back.className), 'раздел не свернулся обратно');
});

test('выбор переживает перерисовку и лежит в хранилище', () => {
    const store = makeStore();
    const s = screen({ daily: {}, store });
    const target = s.sections().filter(sec => /closed/.test(sec.className))[0];
    const name = s.nameText(target);
    s.click(target);
    assert(store.getItem('mathCitadelAchOpen_v1'), 'выбор не сохранён');

    // Новый заход на экран: состояние в памяти пустое, читаем сохранённое.
    const s2 = screen({ daily: {}, store });
    const same = s2.sections().filter(sec => s2.nameText(sec) === name)[0];
    assert(!/closed/.test(same.className), 'после возврата раздел снова свёрнут');
});

group('Сводка в заголовке');

const UNLOCKS = {
    'integer+:add:1': { gate: true },
    'integer+:add:2': { mastery: 4, gate: true },
    'integer+:sub:1': { gate: true }
};

test('сводка называет взятые звёзды и общее число', () => {
    const s = screen({ daily: {}, unlocks: UNLOCKS });
    const sec = s.sections()[0];
    assert(s.sumText(sec).indexOf('звёзд 3 из 20') === 0, `сводка первого раздела: ${s.sumText(sec)}`);
});

test('мастерство попадает в сводку отдельным значком', () => {
    const s = screen({ daily: {}, unlocks: UNLOCKS });
    assert(s.sumText(s.sections()[0]).indexOf('💎 1') > 0, `в сводке нет мастерства: ${s.sumText(s.sections()[0])}`);
});

test('сводка сходится с тем, что раздел реально рисует', () => {
    // Считаем чипы в развёрнутом разделе и сверяем с числом в его заголовке.
    const s = screen({ daily: {}, unlocks: UNLOCKS });
    const sec = s.sections()[0];
    assert(!/closed/.test(sec.className), 'первый раздел должен быть открыт');
    const strong = s.chips(sec).filter(c => /gold|mastery/.test(c.className)).length;
    assert(s.sumText(sec).indexOf(`звёзд ${strong} из 20`) === 0,
        `заголовок разошёлся с чипами: в заголовке «${s.sumText(sec)}», сильных чипов ${strong}`);
});

test('полностью закрытый раздел помечен и не считает звёзды', () => {
    const unlocks = {};
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) unlocks[`decimal+:${op}:${lvl}`] = { open: false };
    });
    const s = screen({ daily: {}, unlocks });
    const sec = s.sections().filter(x => /Десятичные/.test(s.nameText(x)))[0];
    eq(s.sumText(sec), 'раздел закрыт', 'сводка закрытого раздела');
    assert(/locked/.test(sec.className), 'закрытый раздел не помечен');
    assert(s.nameText(sec).indexOf('🔒') > 0, 'на закрытом разделе нет замка');
});

test('закрытый раздел не открывается по умолчанию', () => {
    const unlocks = {};
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) unlocks[`decimal+:${op}:${lvl}`] = { open: false };
    });
    // Последняя активность именно там — и всё равно открыться должен другой раздел.
    const s = screen({ daily: { '2026-09-02': { t: { 'decimal+:mul:2': [12, 1, 0, 0, 0] } } }, unlocks });
    const open = s.sections().filter(sec => !/closed/.test(sec.className));
    eq(open.length, 1, 'открытых разделов должно быть один');
    assert(!/Десятичные/.test(s.nameText(open[0])), 'открылся раздел со сплошными замками');
});

group('Значки действий');

// Значки берём из живого объекта: список короткий, а перепутать в нём легко —
// ➗ уже стоял и у деления, и у сокращения, 🎯 — и у дроби от числа, и у лесенки
// точности. На экране это выглядит как «две разные вещи названы одинаково».
function opIcons() {
    const box = {};
    vm.createContext(box);
    const from = SCRIPT.indexOf('const OP_LABELS = {');
    const to = SCRIPT.indexOf('};', from) + 2;
    vm.runInContext('const t = (x) => x;\n' + SCRIPT.slice(from, to) + ';globalThis.L = OP_LABELS;', box);
    const out = {};
    Object.keys(box.L).forEach(op => { out[op] = box.L[op].split(' ')[0]; });
    return out;
}

test('у каждого действия свой значок, ни один не повторяется', () => {
    const icons = opIcons();
    const seen = {};
    Object.keys(icons).forEach(op => {
        const i = icons[op];
        assert(!seen[i], `значок ${i} стоит и у «${seen[i]}», и у «${op}»`);
        seen[i] = op;
    });
});

test('значки действий не пересекаются со значками лесенок', () => {
    // ⚡ 🎯 🔢 заняты скоростью, точностью и количеством — в карточке достижений
    // действие и лесенка стоят в двух строках друг от друга.
    const from = SCRIPT.indexOf('const LADDERS = [');
    const box = {};
    vm.createContext(box);
    vm.runInContext('const t = (x) => x;\n' + SCRIPT.slice(from, SCRIPT.indexOf('];', from) + 2)
        + ';globalThis.L = LADDERS;', box);
    const ladder = box.L.map(l => l.icon);
    const icons = opIcons();
    Object.keys(icons).forEach(op => {
        assert(ladder.indexOf(icons[op]) < 0,
            `значок ${icons[op]} у «${op}» занят лесенкой`);
    });
});

group('Галочка сворачивания');

const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
function rule(selector) {
    const at = STYLE.indexOf(selector + ' {');
    if (at < 0) throw new Error('не найдено правило ' + selector);
    return STYLE.slice(at, STYLE.indexOf('}', at));
}

test('галочку видно: она не мельче остальной строки', () => {
    // Было 0.62rem и цвет тусклее самого заголовка — управляющий элемент оказался
    // самым незаметным на строке. Видимая ширина составляла 5 пикселей.
    const fs = /font-size:\s*([\d.]+)rem/.exec(rule('.ach-section-chevron'));
    assert(fs, 'у галочки не задан размер');
    assert(parseFloat(fs[1]) >= 0.78, `галочка ${fs[1]}rem — снова слишком мелкая`);
});

test('под галочку отведено постоянное место, и её видно пальцем', () => {
    // Место фиксировано, иначе заголовки дёргаются при каждом сворачивании.
    // Ширина не меньше 16px — прежние 14px были слишком мелкими, чтобы читаться
    // как «сюда можно нажать»; на это пожаловались с устройства, а не в тесте.
    const w = /width:\s*(\d+)px/.exec(rule('.ach-section-chevron'));
    assert(w, 'ширина галочки не зафиксирована');
    assert(Number(w[1]) >= 16, `галочка шириной ${w[1]}px — мелковата`);
});

test('заголовок достаточно высокий, чтобы попасть пальцем', () => {
    const mh = /min-height:\s*(\d+)px/.exec(rule('.ach-section-head'));
    assert(mh && Number(mh[1]) >= 36, `высота заголовка ${mh ? mh[1] : '—'} px — мало для пальца`);
});

test('свёрнутое состояние показано поворотом, а не подменой символа', () => {
    assert(/rotate/.test(rule('.ach-section.closed .ach-section-chevron')),
        'у свёрнутого раздела галочка не поворачивается');
    const marks = SCRIPT.slice(SCRIPT.indexOf("chevron.innerText"), SCRIPT.indexOf('\n', SCRIPT.indexOf('chevron.innerText')));
    assert(!/\?/.test(marks), `символ галочки подменяется: ${marks.trim()}`);
});

group('Итоги в подзаголовке');

test('итоги не зависят от того, что свёрнуто', () => {
    // Главная опасность сворачивания: раньше «звёзд взято» копилось по ходу отрисовки
    // строк, и свёрнутый раздел молча вычитался бы из итога.
    const s = screen({ daily: {}, unlocks: UNLOCKS });
    const before = s.subtitle;
    const closed = s.sections().filter(sec => /closed/.test(sec.className))[0];
    s.click(closed);                      // развернули ещё один раздел
    eq(s.subtitle, before, 'итог изменился от одного лишь разворачивания');
    const open = s.sections().filter(sec => !/closed/.test(sec.className))[0];
    s.click(open);                        // свернули
    eq(s.subtitle, before, 'итог изменился от сворачивания');
});

test('итог считает все сто звёзд, а не только нарисованные', () => {
    const s = screen({ daily: {}, unlocks: UNLOCKS });
    assert(/из 100/.test(s.subtitle), `в итоге не все звёзды: ${s.subtitle}`);
    assert(/Звёзд взято: 3/.test(s.subtitle), `неверное число взятых: ${s.subtitle}`);
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
