// Тесты сворачиваемых разделов статистики и профиля.
//
// Зачем: до этого в приложении жили ТРИ разные механики сворачивания — аккордеон
// достижений, «▼ показать» у двух разделов статистики и ничего у остальных восьми.
// Восемь блоков вываливались разом, и до нужного надо было пролистать остальные.
// Механика теперь одна, и у неё есть два места, где легко соврать молча:
//
//   1) «открыт первый раздел» — если считать первым первый по РАЗМЕТКЕ, ученик
//      получит экран, свёрнутый целиком: половина разделов статистики показывается
//      только репетитору, и у ученика они стоят с display:none;
//   2) сохранённый выбор должен побеждать умолчание, иначе каждый заход на экран
//      будет разворачивать раздел заново поверх того, что человек закрыл.
//
// Как запускать:  node test/folds.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

// --- Подставной DOM: ровно те селекторы, которыми пользуется setupFolds ---
function el(tag, className, attrs) {
    const node = {
        tag, className: className || '', attrs: attrs || {}, children: [], handlers: {},
        style: {}, _text: '',
        get innerText() { return this._text; },
        set innerText(v) { this._text = String(v); },
        getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
        appendChild(ch) { this.children.push(ch); return ch; },
        insertBefore(ch) { this.children.unshift(ch); return ch; },
        addEventListener(name, fn) { this.handlers[name] = fn; },
        classList: {
            add(c) { if (!node.className.split(' ').includes(c)) node.className = (node.className + ' ' + c).trim(); },
            remove(c) { node.className = node.className.split(' ').filter(x => x && x !== c).join(' '); },
            contains(c) { return node.className.split(' ').includes(c); },
            toggle(c, force) {
                const want = force === undefined ? !this.contains(c) : !!force;
                if (want) this.add(c); else this.remove(c);
                return want;
            }
        },
        matches(sel) {
            if (sel === '.config-section[data-fold]') {
                return this.className.split(' ').includes('config-section') && this.attrs['data-fold'] != null;
            }
            return this.className.split(' ').includes(sel.replace('.', ''));
        },
        querySelectorAll(sel) {
            const out = [];
            (function walk(n) { n.children.forEach(ch => { if (ch.matches(sel)) out.push(ch); walk(ch); }); })(this);
            return out;
        },
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    };
    return node;
}

function makeStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null),
             setItem: (k, v) => m.set(k, String(v)),
             removeItem: (k) => m.delete(k), _map: m };
}

// specs: [{ key, hidden }] — раздел с заголовком, как в разметке экрана
function build(specs, store) {
    const root = el('div', 'screen');
    specs.forEach(spec => {
        const sec = el('div', 'config-section', { 'data-fold': spec.key });
        if (spec.hidden) sec.style.display = 'none';
        sec.appendChild(el('div', 'config-section-title'));
        sec.appendChild(el('div', 'body'));
        root.appendChild(sec);
    });
    const box = {
        console, Object, Array, String, JSON, Set, Map,
        localStorage: store || makeStore(),
        document: {
            getElementById: (id) => (id === 'screen' ? root : null),
            createElement: (tag) => el(tag, '')
        }
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(
        slice('const FOLD_KEY =', '// ===================== ', 'сворачивание')
        + '\n;globalThis.F = { setupFolds, setFoldSum, FOLD_KEY };',
        box, { filename: 'index.html<сворачивание>' });
    return { root, box, sec: (key) => root.querySelectorAll('.config-section[data-fold]')
                                         .filter(s => s.getAttribute('data-fold') === key)[0] };
}

const folded = (sec) => sec.classList.contains('folded');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }

group('Что открыто по умолчанию');

test('открыт первый раздел, остальные свёрнуты', () => {
    const w = build([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
    w.box.F.setupFolds('screen');
    assert(!folded(w.sec('a')), 'первый раздел должен быть открыт');
    assert(folded(w.sec('b')) && folded(w.sec('c')), 'остальные должны быть свёрнуты');
});

test('спрятанный раздел первым не считается', () => {
    // У ученика первые разделы статистики стоят с display:none — они для репетитора.
    // Считать первым первый по разметке значило бы отдать ученику экран,
    // свёрнутый целиком.
    const w = build([{ key: 'a', hidden: true }, { key: 'b', hidden: true }, { key: 'c' }]);
    w.box.F.setupFolds('screen');
    assert(!folded(w.sec('c')), 'открыть надо первый ВИДИМЫЙ раздел');
    assert(folded(w.sec('a')), 'спрятанный раздел открывать незачем');
});

test('все разделы спрятаны — ничего не падает', () => {
    const w = build([{ key: 'a', hidden: true }]);
    w.box.F.setupFolds('screen');
    assert(folded(w.sec('a')), 'открывать нечего');
});

group('Выбор человека');

test('нажатие сворачивает и разворачивает', () => {
    const w = build([{ key: 'a' }, { key: 'b' }]);
    w.box.F.setupFolds('screen');
    const title = w.sec('b').querySelector('.config-section-title');
    title.handlers.click();
    assert(!folded(w.sec('b')), 'после нажатия раздел должен раскрыться');
    title.handlers.click();
    assert(folded(w.sec('b')), 'повторное нажатие должно свернуть');
});

test('выбор переживает уход с экрана', () => {
    const store = makeStore();
    const first = build([{ key: 'a' }, { key: 'b' }], store);
    first.box.F.setupFolds('screen');
    first.sec('a').querySelector('.config-section-title').handlers.click();  // закрыли первый
    first.sec('b').querySelector('.config-section-title').handlers.click();  // открыли второй

    const again = build([{ key: 'a' }, { key: 'b' }], store);
    again.box.F.setupFolds('screen');
    assert(folded(again.sec('a')), 'закрытый раздел снова раскрылся — умолчание победило выбор');
    assert(!folded(again.sec('b')), 'открытый раздел снова свернулся');
});

test('битое хранилище не роняет экран', () => {
    const store = makeStore();
    store.setItem('mathCitadelFolds_v1', '{это не json');
    const w = build([{ key: 'a' }, { key: 'b' }], store);
    w.box.F.setupFolds('screen');
    assert(!folded(w.sec('a')) && folded(w.sec('b')), 'при битом хранилище работает умолчание');
});

test('повторный заход не вешает второй обработчик', () => {
    const w = build([{ key: 'a' }]);
    w.box.F.setupFolds('screen');
    w.box.F.setupFolds('screen');
    const title = w.sec('a').querySelector('.config-section-title');
    eq(title.querySelectorAll('.fold-chevron').length, 1, 'галочек в заголовке');
});

group('Сводка в свёрнутом заголовке');

test('сводка садится в заголовок и переписывается, а не множится', () => {
    const w = build([{ key: 'a' }]);
    w.box.F.setupFolds('screen');
    // setFoldSum ищет раздел по id — подставляем его в getElementById
    const sec = w.sec('a');
    w.box.document.getElementById = (id) => (id === 'sec' ? sec : null);
    w.box.F.setFoldSum('sec', '3 ученика');
    w.box.F.setFoldSum('sec', '4 ученика');
    const sums = sec.querySelector('.config-section-title').querySelectorAll('.fold-sum');
    eq(sums.length, 1, 'сводок в заголовке');
    eq(sums[0].innerText, '4 ученика', 'текст сводки');
});

group('Разметка и стили');

test('у каждого складного раздела есть заголовок — иначе дверь без ручки', () => {
    const lines = HTML.split('\n');
    const marked = [];
    lines.forEach((line, i) => {
        const m = /data-fold="([^"]+)"/.exec(line);
        if (!m || line.indexOf('config-section') < 0) return;
        marked.push({ key: m[1], hasTitle: (lines[i + 1] || '').indexOf('config-section-title') >= 0 });
    });
    assert(marked.length >= 12, `складных разделов всего ${marked.length} — разметка изменилась`);
    const bad = marked.filter(x => !x.hasTitle).map(x => x.key);
    eq(bad.join(','), '', `у этих разделов сразу за data-fold нет заголовка: ${bad}`);
});

test('свёрнутый раздел прячет всё, что идёт после заголовка', () => {
    // Раздел не знает, из чего состоит: у одного внутри список, у другого кнопки
    // и подсказка. Прятать надо по признаку «после заголовка», а не по классам.
    assert(/\.config-section\.folded > \.config-section-title ~ \*/.test(STYLE),
        'нет правила, прячущего содержимое свёрнутого раздела');
});

test('старая механика «▼ показать» убрана целиком', () => {
    eq((HTML.match(/fold-arrow|fold-head|toggleEpochs|toggleClassBreakdown/g) || []).length, 0,
        'остались следы прежней, второй механики сворачивания');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
