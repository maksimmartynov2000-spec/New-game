// Тесты экрана таблицы умножения.
//
// Зачем отдельным файлом: экран не считает и ничего не записывает, но делает
// утверждение о предмете — «разных примеров 55, наизусть учить шесть» — и красит
// сто клеток по группам, которые придумал не он. И то, и другое держится на
// mulClassOf из js/topics.js. Тронут классификатор (разделят «ядро», введут новую
// группу, подвинут границу двузначных) — и экран молча разойдётся с собой: часть
// клеток останется без цвета, а подпись под таблицей будет называть числа, которых
// уже нет. Ни браузер, ни остальные тесты этого не увидят: страница отрисуется.
//
// Как запускать:  node test/times.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = require('./app-source').appScript(HTML);
const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

// Классификатор и список групп экрана — из живого кода, а не переписанные сюда.
function load() {
    const box = {};
    vm.createContext(box);
    vm.runInContext(
        slice('function mulClassOf', '// Класс примера на деление', 'mulClassOf')
        + slice('const TIMES_GROUPS', 'function timesAccuracy', 'TIMES_GROUPS')
        + ';globalThis.R = { mulClassOf, TIMES_GROUPS };', box);
    return box.R;
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }

// Все группы, которые реально встречаются внутри 10 × 10.
function groupsInTable(mulClassOf) {
    const seen = new Set();
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) seen.add(mulClassOf(a, b));
    return seen;
}

console.log('\nТаблица умножения');

// Экран перечисляет группы руками, в TIMES_GROUPS: по ним строится легенда.
// Разойдись этот список с классификатором — и клетка новой группы получит класс
// .times-g-<нечто>, которого нет в CSS: она отрисуется бесцветной, без ошибки.
test('список групп экрана совпадает с тем, что даёт классификатор', () => {
    const R = load();
    const real = [...groupsInTable(R.mulClassOf)].sort();
    eq(R.TIMES_GROUPS.slice().sort().join(','), real.join(','),
        'TIMES_GROUPS разошёлся с mulClassOf');
});

test('у каждой группы есть заливка в CSS', () => {
    const R = load();
    const lost = R.TIMES_GROUPS.filter(g => STYLE.indexOf(`.times-g-${g}`) < 0);
    eq(lost.join(', '), '', `группы без цвета: ${lost.join(', ')}`);
});

// Легенда подписывает группы не своими словами, а теми же, что стоят в разборе
// статистики. Своя копия подписей разъехалась бы с ней на первой же правке.
test('у каждой группы есть подпись в CLASS_TITLES.mul', () => {
    const R = load();
    const titles = slice('    mul: {', '};', 'CLASS_TITLES.mul');
    const lost = R.TIMES_GROUPS.filter(g => !new RegExp(`\\b${g}:`).test(titles));
    eq(lost.join(', '), '', `группы без подписи: ${lost.join(', ')}`);
});

// Подпись под таблицей — утверждение о предмете, а не украшение. Пересчитываем
// её числа из классификатора: если он изменится, заметка станет враньём молча.
test('числа в заметке — 55 примеров и шесть на зубрёжку — сходятся с кодом', () => {
    const R = load();
    const facts = new Set(), core = new Set();
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
        const key = Math.min(a, b) + 'x' + Math.max(a, b);
        facts.add(key);
        if (R.mulClassOf(a, b) === 'core') core.add(key);
    }
    eq(facts.size, 55, 'разных примеров в таблице');
    eq(core.size, 6, 'примеров в ядре');

    const note = slice('Клеток сто, но разных', '.');
    const says = (n) => new RegExp('(^|\\D)' + n + '(\\D|$)').test(note);
    assert(says(facts.size), `в заметке нет числа разных примеров ${facts.size}: ${note}`);
    // Сами шесть примеров тоже перечислены поимённо — проверяем каждый.
    const full = slice('Клеток сто, но разных', 'Остальное берётся');
    [...core].forEach(k => {
        const [a, b] = k.split('x');
        assert(full.indexOf(`${a}×${b}`) >= 0, `в заметке нет примера ${a}×${b}: ${full}`);
    });
});

// Серое значит «не мерили», а не «плохо». Порог живёт в коде одним числом, и
// заметка под таблицей называет его же — чтобы ученик знал, почему клетка серая.
test('порог выборки назван в заметке тем же числом, что в коде', () => {
    const code = slice('const TIMES_MIN_SAMPLE', 'function timesAccuracyClass', 'порог');
    const n = Number((code.match(/TIMES_MIN_SAMPLE\s*=\s*(\d+)/) || [])[1]);
    assert(n > 0, 'порог выборки не найден');
    const note = slice('Цвет — про приём целиком', 'Пока приём решён меньше %1');
    assert(note.length > 0, 'заметка про приём не найдена');
    assert(SCRIPT.indexOf('TIMES_MIN_SAMPLE)') > 0,
        'порог подставляется в заметку не из TIMES_MIN_SAMPLE — числа разойдутся');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
