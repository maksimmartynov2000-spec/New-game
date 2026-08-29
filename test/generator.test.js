// Тесты инвариантов генератора примеров.
//
// Зачем: генератор — самая содержательная часть приложения, и его дефекты не видны
// глазом. «Дроби · Умножение · 2★» несколько недель выдавали ровно 12 разных примеров
// с повтором на третьем, и заметить это можно было только счётом. Эти тесты фиксируют
// свойства, которые обязаны выполняться всегда, чтобы следующая правка не сломала их молча.
//
// Как запускать:  node test/generator.test.js
// Браузер не нужен: сборка вытаскивает <script> из index.html и исполняет в jsdom-подобной
// заглушке. Ничего не устанавливается — только то, что уже есть в Node.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---------- запуск кода приложения без браузера ----------
// index.html — один файл, где скрипт намертво завязан на DOM. Полностью его исполнять
// не нужно и незачем: генераторы примеров — чистые функции. Поэтому вырезаем только
// объявления функций и констант и выполняем их в песочнице с минимальными заглушками.
function loadGenerators() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

    // Обрываем там, где начинается работа с DOM и canvas: всё нужное объявлено выше.
    const MARKER = '// ===================== ПАЗЛ: ГЕНЕРАЦИЯ КУСОЧКОВ (jigsaw)';
    const cut = script.indexOf(MARKER);
    if (cut < 0) throw new Error('не найдена метка конца генераторов: ' + MARKER);
    const head = script.slice(0, cut);

    // Заглушка элемента: код верхнего уровня навешивает обработчики и трогает стили.
    // К генераторам это отношения не имеет, но без заглушек выполнение упадёт.
    const stubEl = () => ({
        style: {}, dataset: {}, innerHTML: '', innerText: '', value: '',
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {}, removeChild() {}, remove() {},
        addEventListener() {}, setAttribute() {}, getAttribute: () => null,
        querySelector: () => stubEl(), querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
    });

    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN, parseInt, parseFloat,
        document: {
            getElementById: () => stubEl(),
            querySelectorAll: () => [],
            querySelector: () => stubEl(),
            addEventListener: () => {},
            createElement: () => stubEl(),
            body: stubEl()
        },
        window: { addEventListener: () => {}, innerWidth: 400, innerHeight: 800 },
        navigator: {},
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        setInterval: () => 0,
        setTimeout: () => 0,
        clearInterval: () => {},
        requestAnimationFrame: () => 0
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    // Объявления через const не становятся свойствами глобального объекта, а таблицы
    // подписей проверять надо — поднимаем их наружу явно.
    vm.runInContext(head + '\n;globalThis.MISTAKE_LABELS = MISTAKE_LABELS;'
                         + '\n;globalThis.MISTAKE_SHORT = MISTAKE_SHORT;'
                         + '\n;globalThis.MUL_GROUPS = MUL_GROUPS;'
                         + '\n;globalThis.MUL_SHARES = MUL_SHARES;'
                         + '\n;globalThis.MUL_TWO_ROUND = MUL_TWO_ROUND;'
                         + '\n;globalThis.MUL_TWO_BAND_WEIGHTS = MUL_TWO_BAND_WEIGHTS;'
                         + '\n;globalThis.DIV_GROUPS = DIV_GROUPS;'
                         + '\n;globalThis.DIV_SHARES = DIV_SHARES;'
                         + '\n;globalThis.DIV_TWO_ROUND = DIV_TWO_ROUND;'
                         + '\n;globalThis.DIV_ZERO_SHARES = DIV_ZERO_SHARES;'
                         + '\n;globalThis.NEG_MUL_SHARES = NEG_MUL_SHARES;'
                         + '\n;globalThis.NEG_DIV_SHARES = NEG_DIV_SHARES;'
                         + '\n;globalThis.NEG_ADD_CLASS_SHARES = NEG_ADD_CLASS_SHARES;'
                         + '\n;globalThis.NEG_PAREN_SHARE = NEG_PAREN_SHARE;'
                         + '\n;globalThis.NEG_ADD_RANGE = NEG_ADD_RANGE;'
                         + '\n;globalThis.NEG_ADD_MIN = NEG_ADD_MIN;'
                         + '\n;globalThis.ADD_SUB_RANGE = ADD_SUB_RANGE;',
                    sandbox, { filename: 'index.html<script>' });

    // Разбор примера на классы объявлен НИЖЕ метки обрыва — он нужен экранам, а не
    // генератору. Проверкам он всё равно нужен: инвариант «двузначного на однозначное
    // в отрицательных нет» удобнее всего формулировать через тот же классификатор,
    // которым пользуется разбор. Поэтому достаём его отдельно, по телу функции.
    const fnStart = script.indexOf('function mulClassOf(');
    if (fnStart < 0) throw new Error('не найдена функция mulClassOf');
    let depth = 0, fnEnd = script.indexOf('{', fnStart);
    for (let i = fnEnd; i < script.length; i++) {
        if (script[i] === '{') depth++;
        else if (script[i] === '}' && --depth === 0) { fnEnd = i + 1; break; }
    }
    vm.runInContext(script.slice(fnStart, fnEnd) + '\n;globalThis.mulClassOf = mulClassOf;',
                    sandbox, { filename: 'index.html<mulClassOf>' });
    return sandbox;
}

// ---------- крошечный тест-раннер ----------
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, message: e.message });
        console.log(`  ✗ ${name}\n      ${e.message}`);
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}
function group(name) { console.log(`\n${name}`); }

// ---------- сами тесты ----------
const G = loadGenerators();

const CATEGORIES = [
    { cat: 'integer', sign: 'positive', ops: ['add', 'sub', 'mul', 'div'] },
    { cat: 'integer', sign: 'negative', ops: ['add', 'sub', 'mul', 'div'] },
    { cat: 'decimal', sign: 'positive', ops: ['add', 'sub', 'mul', 'div'] },
    { cat: 'fraction', sign: 'positive',
      ops: ['add', 'sub', 'mul', 'div', 'simplify', 'toMixed', 'toImproper', 'fracOfNumber'] }
];

function generateOne(cat, op, level, isNegative) {
    if (cat === 'fraction') {
        if (op === 'simplify') return G.generateSimplifyProblem(level);
        if (op === 'toMixed') return G.generateToMixedProblem(level);
        if (op === 'toImproper') return G.generateToImproperProblem(level);
        if (op === 'fracOfNumber') return G.generateFracOfNumberProblem(level);
        return G.generateFractionProblem(op, level, isNegative);
    }
    if (cat === 'decimal') return G.generateDecimalProblem(op, level, isNegative);
    return G.generateProblem(op, level, isNegative);
}

function forEachCombo(fn) {
    CATEGORIES.forEach(({ cat, sign, ops }) => {
        ops.forEach(op => {
            for (let level = 1; level <= 5; level++) {
                fn({ cat, sign, op, level, isNegative: sign === 'negative',
                     label: `${cat}${sign === 'negative' ? '−' : '+'} · ${op} · ${level}★` });
            }
        });
    });
}

group('Ни одна комбинация не падает и не тормозит');
test('все 100 комбинаций генерируются без исключений', () => {
    const broken = [];
    forEachCombo(c => {
        try {
            for (let i = 0; i < 200; i++) generateOne(c.cat, c.op, c.level, c.isNegative);
        } catch (e) {
            broken.push(`${c.label}: ${e.message}`);
        }
    });
    assert(broken.length === 0, `упало: ${broken.join('; ')}`);
});

test('генерация 200 примеров укладывается в 300 мс на комбинацию', () => {
    const slow = [];
    forEachCombo(c => {
        const t0 = Date.now();
        for (let i = 0; i < 200; i++) generateOne(c.cat, c.op, c.level, c.isNegative);
        const ms = Date.now() - t0;
        if (ms > 300) slow.push(`${c.label}: ${ms} мс`);
    });
    assert(slow.length === 0, `медленно: ${slow.join('; ')}`);
});

group('Разнообразие примеров');
// Порог намеренно невысокий: он ловит вырождение вроде «12 примеров на всю тему»,
// а не требует бесконечного разнообразия там, где задача проста по сути.
const MIN_DISTINCT = 25;
const VARIETY_EXEMPT = new Set([
    // Перевод дроби в смешанное число и обратно на 1★ — по построению 18 вариантов:
    // две целых части × несократимые числители при знаменателях 2..5. Задача чисто
    // на форму записи, расширять пул здесь означало бы поменять уровень сложности.
    'fraction+ · toMixed · 1★',
    'fraction+ · toImproper · 1★'
]);

test(`каждая комбинация даёт минимум ${MIN_DISTINCT} различных примеров из 400`, () => {
    const poor = [];
    forEachCombo(c => {
        if (VARIETY_EXEMPT.has(c.label)) return;
        const seen = new Set();
        for (let i = 0; i < 400; i++) {
            const p = generateOne(c.cat, c.op, c.level, c.isNegative);
            seen.add(JSON.stringify(p).replace(/"level":\d+/, ''));
        }
        if (seen.size < MIN_DISTINCT) poor.push(`${c.label}: ${seen.size}`);
    });
    assert(poor.length === 0, `мало разнообразия: ${poor.join('; ')}`);
});

test('ни у одной темы нет «залипшего» числа во всех примерах', () => {
    // Ловит ровно тот дефект, что был у умножения дробей: второй числитель всегда 2.
    const stuck = [];
    CATEGORIES.filter(c => c.cat === 'fraction').forEach(({ ops }) => {
        ops.filter(op => ['mul', 'div', 'add', 'sub'].includes(op)).forEach(op => {
            for (let level = 1; level <= 5; level++) {
                const n1s = new Set(), n2s = new Set();
                for (let i = 0; i < 400; i++) {
                    const p = G.generateFractionProblem(op, level, false);
                    n1s.add(Math.abs(p.f1.num)); n2s.add(Math.abs(p.f2.num));
                }
                const label = `fraction · ${op} · ${level}★`;
                // Уровень 4 умножения/деления — это «дробь × целое», там один операнд
                // целый по замыслу, поэтому единственное значение числителя допустимо.
                if (level === 4 && (op === 'mul' || op === 'div')) return;
                if (n1s.size < 2) stuck.push(`${label}: первый числитель всегда ${[...n1s][0]}`);
                if (n2s.size < 2) stuck.push(`${label}: второй числитель всегда ${[...n2s][0]}`);
            }
        });
    });
    assert(stuck.length === 0, stuck.join('; '));
});

group('Смысловые проверки: содержание не выродилось');
// Проверки выше смотрят на ФОРМУ примеров: сколько их разных, нет ли залипшего числа.
// Этого мало. Уровень «дроби 2★» полгода выдавал 88% примеров вида «5/6 − 5/6 = 0»
// и проходил все проверки формы: примеры действительно были разные, числители не
// залипали, ответ формально «сокращался» (0/6 → 0/1). Не сходился только смысл.
//
// Здесь — проверки смысла. Пороги взяты не с потолка, а из замеров по всем 100 темам:
// у каждой указано, сколько намерено сегодня и сколько было у известного дефекта.

// Ключ примера и ключ ответа — по ним считаем, не сгрудилась ли выдача в одну точку.
function problemKey(p) {
    if (p.f1) return `${p.f1.num}/${p.f1.den}|${p.f2.num}/${p.f2.den}`;
    if (p.given) return `${p.given.num}/${p.given.den}|${p.whole}|${p.properNum}`;
    if (p.d1) return `${p.d1.intVal}e${p.d1.dp}|${p.d2.intVal}e${p.d2.dp}`;
    if (p.fracNum !== undefined) return `${p.fracNum}/${p.fracDen}|${p.N}`;
    return `${p.a}|${p.b}`;
}
function answerKeyOf(p) {
    const a = p.answer;
    if (a === null || a === undefined) return 'нет решения'; // деление на ноль — это ответ
    if (typeof a === 'object') return a.den !== undefined ? `${a.num}/${a.den}` : `${a.intVal}e${a.dp}`;
    if (p.direction === 'toMixed') return `${p.whole} ${p.properNum}/${p.den}`;
    if (p.direction === 'toImproper') return `${p.given.num}/${p.given.den}`;
    return String(a);
}

function shareOfMostCommon(c, keyFn, runs) {
    const counts = new Map();
    for (let i = 0; i < runs; i++) {
        const k = keyFn(generateOne(c.cat, c.op, c.level, c.isNegative));
        counts.set(k, (counts.get(k) || 0) + 1);
    }
    let top = null, best = 0;
    counts.forEach((n, k) => { if (n > best) { best = n; top = k; } });
    return { key: top, share: best / runs };
}

// Замерено сегодня: максимум по всем темам — 28% (дроби 2★ на вычитание: ответы
// после сокращения неизбежно сходятся к простым дробям вроде 1/3).
// У дефекта, который это должно было поймать, было 88%.
const MAX_ANSWER_SHARE = 0.40;
test(`ни один ответ не занимает больше ${Math.round(MAX_ANSWER_SHARE * 100)}% выдачи темы`, () => {
    const bad = [];
    forEachCombo(c => {
        const { key, share } = shareOfMostCommon(c, answerKeyOf, 3000);
        if (share > MAX_ANSWER_SHARE) bad.push(`${c.label}: ответ «${key}» в ${(share * 100).toFixed(0)}%`);
    });
    assert(bad.length === 0, bad.join('; '));
});

// Замерено сегодня: максимум 14% (перевод дробей 1★, где вариантов всего 18).
const MAX_PROBLEM_SHARE = 0.25;
test(`ни один пример не занимает больше ${Math.round(MAX_PROBLEM_SHARE * 100)}% выдачи темы`, () => {
    const bad = [];
    forEachCombo(c => {
        const { key, share } = shareOfMostCommon(c, problemKey, 3000);
        if (share > MAX_PROBLEM_SHARE) bad.push(`${c.label}: пример «${key}» в ${(share * 100).toFixed(0)}%`);
    });
    assert(bad.length === 0, bad.join('; '));
});

test('в дробной арифметике ответ 0 или 1 — редкость, а не правило', () => {
    // Именно этим уровень 2★ и болел: считать было нечего, и ребёнок это замечал.
    const bad = [];
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let level = 1; level <= 5; level++) {
            let degenerate = 0;
            const runs = 3000;
            for (let i = 0; i < runs; i++) {
                const a = G.generateFractionProblem(op, level, false).answer;
                if (a.num === 0 || Math.abs(a.num) === Math.abs(a.den)) degenerate++;
            }
            const share = degenerate / runs;
            // Деление даёт ответ 1 законно (a/b ÷ a/b), поэтому ему порог мягче.
            const limit = op === 'div' ? 0.25 : 0.10;
            if (share > limit) bad.push(`дроби ${op} ${level}★: ${(share * 100).toFixed(0)}% ответов 0 или 1`);
        }
    });
    assert(bad.length === 0, bad.join('; '));
});

test('у каждой темы не меньше 5 разных ответов', () => {
    const bad = [];
    forEachCombo(c => {
        const seen = new Set();
        for (let i = 0; i < 1000; i++) seen.add(answerKeyOf(generateOne(c.cat, c.op, c.level, c.isNegative)));
        if (seen.size < 5) bad.push(`${c.label}: ${seen.size}`);
    });
    assert(bad.length === 0, bad.join('; '));
});

// Сколько разных примеров ученик увидит за короткий заход. Считает не теоретический
// размер темы, а то, что реально выпадает: тема из 30 примеров, где 90% выдачи — три
// из них, здесь провалится, хотя проверку «минимум 25 различных» пройдёт.
// Замерено сегодня: минимум 14,7 (не считая освобождённых). У дефекта 2★ было бы ~8.
const MIN_IN_A_ROW = 13;
test(`среди 20 примеров подряд в среднем не меньше ${MIN_IN_A_ROW} разных`, () => {
    const poor = [];
    forEachCombo(c => {
        if (VARIETY_EXEMPT.has(c.label)) return;
        let sum = 0;
        const runs = 120;
        for (let r = 0; r < runs; r++) {
            const seen = new Set();
            for (let i = 0; i < 20; i++) seen.add(problemKey(generateOne(c.cat, c.op, c.level, c.isNegative)));
            sum += seen.size;
        }
        const avg = sum / runs;
        if (avg < MIN_IN_A_ROW) poor.push(`${c.label}: ${avg.toFixed(1)}`);
    });
    assert(poor.length === 0, `однообразно за короткий заход: ${poor.join('; ')}`);
});

group('Сложение положительных: полосы, переход, размер слагаемых');

const ADD_BANDS_EXPECTED = [[2, 10], [11, 20], [21, 50], [51, 100], [101, 200]];
const ADD_WEIGHTS_EXPECTED = {
    1: [1],
    2: [0.30, 0.70],
    3: [0.10, 0.20, 0.70],
    4: [0.05, 0.10, 0.15, 0.70],
    5: [0.01, 0.04, 0.125, 0.225, 0.60]
};
const ADD_FLOOR_EXPECTED = [1, 5, 8, 14, 24];
// 0 — без перехода, 1 — дополнение до круглого (сумма единиц ровно 10), 2 — полный переход
const unitsClassOf = (a, b) => { const s = a % 10 + b % 10; return s < 10 ? 0 : (s === 10 ? 1 : 2); };
const crossesTen = (a, b) => unitsClassOf(a, b) === 2;

// Допуск на измеренную долю. Фиксированный процент здесь не годится: у редких полос
// выборка на порядок меньше, и один и тот же допуск оказывается то запасом в двадцать
// сигм, то в две с половиной — а значит тест иногда падает на верном коде, что хуже,
// чем не проверять вовсе. Четыре сигмы биномиального разброса плюс полтора процента
// на систематику: ложное падение на клетку реже одного раза на десять тысяч прогонов.
function shareTolerance(want, n) {
    if (!n) return 1;
    return 0.015 + 4 * Math.sqrt(Math.max(want * (1 - want), 0.0001) / n);
}
const ADD_CLASS_EXPECTED = [0.20, 0.10, 0.70];
const ADD_CLASS_EXPECTED_SMALL = [0.70, 0.30, 0];

function sampleAdd(level, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(G.genAddPositive(level));
    return out;
}
function bandOf(sum) {
    for (let i = 0; i < ADD_BANDS_EXPECTED.length; i++) {
        if (sum >= ADD_BANDS_EXPECTED[i][0] && sum <= ADD_BANDS_EXPECTED[i][1]) return i;
    }
    return -1;
}

test('сумма всегда внутри своего потолка и равна слагаемым', () => {
    const ceil = { 1: 10, 2: 20, 3: 50, 4: 100, 5: 200 };
    for (let level = 1; level <= 5; level++) {
        for (const p of sampleAdd(level, 5000)) {
            assert(p.a >= 1 && p.b >= 1, `${level}★: слагаемое меньше единицы в «${p.text}»`);
            assert(p.a + p.b === p.answer, `${level}★: ответ не равен сумме в «${p.text}»`);
            assert(p.answer >= 2 && p.answer <= ceil[level],
                `${level}★: сумма ${p.answer} вне потолка ${ceil[level]}`);
        }
    }
});

test('частоты полос сумм соответствуют заданным', () => {
    // Ради этого всё и делалось: раньше сумма бралась равномерно в потолке, и малые
    // суммы получали вес не по числу своих примеров — на пятой звезде каждый десятый
    // пример был примером с первой.
    const N = 40000;
    for (let level = 1; level <= 5; level++) {
        const counts = [0, 0, 0, 0, 0];
        for (const p of sampleAdd(level, N)) {
            const bi = bandOf(p.answer);
            assert(bi >= 0, `${level}★: сумма ${p.answer} не попала ни в одну полосу`);
            counts[bi]++;
        }
        const expected = ADD_WEIGHTS_EXPECTED[level];
        for (let i = 0; i < counts.length; i++) {
            const want = expected[i] || 0;
            const got = counts[i] / N;
            const tol = 0.01 + 0.02 * want;
            assert(Math.abs(got - want) <= tol,
                `${level}★ полоса ${ADD_BANDS_EXPECTED[i].join('-')}: ожидали ${(want * 100).toFixed(1)}%, вышло ${(got * 100).toFixed(1)}%`);
        }
    }
});

test('три класса разложены по долям внутри каждой полосы', () => {
    // Без перехода / дополнение до круглого / полный переход — 20/10/70.
    // В полосе 2–10 полного перехода не бывает вовсе: сумма единиц равна самой сумме,
    // а она не больше десяти. Там 70/30, и средний класс — девять пар состава десятка.
    const N = 40000;
    for (let level = 1; level <= 5; level++) {
        const total = [0, 0, 0, 0, 0];
        const byClass = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (const p of sampleAdd(level, N)) {
            const bi = bandOf(p.answer);
            total[bi]++;
            byClass[bi][unitsClassOf(p.a, p.b)]++;
        }
        for (let i = 0; i < total.length; i++) {
            if (total[i] < 1000) continue;   // слишком мало данных для доли
            const want = i === 0 ? ADD_CLASS_EXPECTED_SMALL : ADD_CLASS_EXPECTED;
            for (let c = 0; c < 3; c++) {
                const got = byClass[i][c] / total[i];
                assert(Math.abs(got - want[c]) <= shareTolerance(want[c], total[i]),
                    `${level}★ полоса ${ADD_BANDS_EXPECTED[i].join('-')}, класс ${c}: `
                    + `${(got * 100).toFixed(1)}% вместо ${(want[c] * 100).toFixed(0)}%`);
            }
        }
    }
});

test('дополнение до круглого — это 36 + 4, а не 30 + 20', () => {
    // Класс задуман ради приёма «дополнить до круглого». Сложение десятков в него
    // попасть не должно: сумма единиц там ноль, а не десять, — и придержать такие
    // примеры обязан порог, из-под которого класс дополнения выведен.
    const missed = [];
    let smallAndRound = 0;
    for (let level = 3; level <= 5; level++) {
        for (const p of sampleAdd(level, 20000)) {
            const bi = bandOf(p.answer);
            const min = Math.min(p.a, p.b);
            if (p.a % 10 === 0 && p.b % 10 === 0 && min < ADD_FLOOR_EXPECTED[bi]) {
                missed.push(`${level}★ «${p.text}»`);
            }
            if (unitsClassOf(p.a, p.b) === 1 && min < ADD_FLOOR_EXPECTED[bi]) smallAndRound++;
        }
    }
    assert(missed.length === 0,
        `сложение десятков прошло мимо порога: ${missed.slice(0, 3).join(', ')}`);
    // И обратное: 36 + 4 и 88 + 12 обязаны остаться — к этому классу порог не применяется.
    // Если однажды его туда распространят, приём «дополнить до круглого» исчезнет.
    assert(smallAndRound > 0,
        'не нашлось ни одного дополнения до круглого с маленьким слагаемым (36 + 4)');
});

test('порог на меньшее слагаемое действует только на класс без перехода', () => {
    // Без перехода маленькое слагаемое обесценивает пример (156 + 3 считать не надо),
    // с переходом — нет (156 + 9 надо), при дополнении до круглого — тоже нет (36 + 4).
    // Порог стоит там, где он что-то значит.
    const N = 30000;
    const withCarryAndSmall = [0, 0, 0, 0, 0];
    for (let level = 2; level <= 5; level++) {
        for (const p of sampleAdd(level, N)) {
            const bi = bandOf(p.answer);
            const min = Math.min(p.a, p.b);
            if (unitsClassOf(p.a, p.b) === 0) {
                assert(min >= ADD_FLOOR_EXPECTED[bi],
                    `${level}★: «${p.text}» без перехода, а меньшее слагаемое ${min} ниже порога ${ADD_FLOOR_EXPECTED[bi]}`);
            } else if (min < ADD_FLOOR_EXPECTED[bi]) {
                withCarryAndSmall[bi]++;
            }
        }
    }
    // И обратное: примеры «большое плюс маленькое с переходом» обязаны остаться.
    // Если порог поедет на весь пул, эта проверка упадёт.
    assert(withCarryAndSmall[4] > 0,
        'в полосе 101-200 не осталось примеров с переходом и слагаемым меньше 24');
    assert(withCarryAndSmall[3] > 0,
        'в полосе 51-100 не осталось примеров с переходом и слагаемым меньше 14');
});

test('в полосе 2-10 маленькие слагаемые встречаются реже больших', () => {
    // Равномерный выбор среди пар сам по себе перекошен: единица влезает в любую сумму,
    // а пятёрка только в десятку. Из 45 пар полосы в 17 есть единица, и первая звезда
    // на 38% состояла из «прибавить один». Вес это выравнивает.
    const N = 60000;
    const byMin = [0, 0, 0, 0, 0, 0];
    for (const p of sampleAdd(1, N)) byMin[Math.min(p.a, p.b)]++;
    const share = (m) => byMin[m] / N;
    // Сравнивать доли групп между собой можно только с единицей: пар с меньшим
    // слагаемым 2 просто больше, чем с 3 (одиннадцать против семи), и вес выравнивает
    // перекос, но не переворачивает его.
    assert(share(1) < share(2),
        `1★: примеров с единицей ${(share(1) * 100).toFixed(1)}%, с двойкой ${(share(2) * 100).toFixed(1)}% — вес не работает`);
    assert(share(1) < 0.27,
        `1★: примеров с единицей ${(share(1) * 100).toFixed(1)}% — слишком много даже с весом`);
    // Среднее меньшее слагаемое: при равномерном выборе выходит 2,1, с весом заметно выше.
    let sumMin = 0, total = 0;
    for (const p of sampleAdd(1, N)) { sumMin += Math.min(p.a, p.b); total++; }
    const avg = sumMin / total;
    assert(avg > 2.4, `1★: среднее меньшее слагаемое ${avg.toFixed(2)} — вес почти не действует`);
    // Потолок веса: без него вся группа «меньшее = 5» — это одна пара 5 + 5, и она
    // забирает больше пяти процентов звезды. Ни один пример не должен так вылезать.
    const counts = new Map();
    for (const p of sampleAdd(1, N)) counts.set(p.text, (counts.get(p.text) || 0) + 1);
    const top = Math.max(...counts.values()) / N;
    assert(top < 0.045, `1★: самый частый пример занимает ${(top * 100).toFixed(1)}% звезды`);
});

test('вес не применяется к составу десятка — девять фактов идут поровну', () => {
    // Иначе самым частым станет 10 = 5 + 5, а это самый лёгкий из девяти.
    const N = 60000;
    const counts = new Map();
    let toTen = 0;
    for (const p of sampleAdd(1, N)) {
        if (p.answer !== 10) continue;
        toTen++;
        counts.set(p.text, (counts.get(p.text) || 0) + 1);
    }
    assert(counts.size === 9, `пар с суммой 10 нашлось ${counts.size} вместо девяти`);
    for (const [text, n] of counts) {
        const inside = n / toTen;
        assert(Math.abs(inside - 1 / 9) <= 0.025,
            `«${text}» занимает ${(inside * 100).toFixed(1)}% состава десятка вместо 11,1%`);
    }
});

test('первая звезда: только суммы до десяти, без полного перехода', () => {
    let toTen = 0, total = 0;
    for (const p of sampleAdd(1, 40000)) {
        total++;
        assert(p.answer >= 2 && p.answer <= 10, `1★: сумма ${p.answer} вне 2..10`);
        assert(!crossesTen(p.a, p.b), `1★: «${p.text}» с полным переходом через десяток`);
        if (p.answer === 10) toTen++;
    }
    // Состав числа 10 — главный сюжет первой звезды, ему отдано 30%.
    const share = toTen / total;
    assert(Math.abs(share - 0.30) <= 0.02,
        `1★: пар с суммой ровно 10 вышло ${(share * 100).toFixed(1)}% вместо 30%`);
});

group('Вычитание положительных: то же устройство, что у сложения');

function sampleSub(level, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(G.genSubPositive(level));
    return out;
}

test('уменьшаемое в потолке, ответ сходится, нулей нет', () => {
    // «7 − 0» и «7 − 7» раньше выпадали с одинаковой вероятностью 1/(a+1) и вместе
    // занимали треть первой звезды. Ни то, ни другое ничему не учит.
    const ceil = { 1: 10, 2: 20, 3: 50, 4: 100, 5: 200 };
    for (let level = 1; level <= 5; level++) {
        for (const p of sampleSub(level, 5000)) {
            assert(p.a - p.b === p.answer, `${level}★: ответ не сходится в «${p.text}»`);
            assert(p.b >= 1, `${level}★: «${p.text}» — вычитаемое ноль`);
            assert(p.answer >= 1, `${level}★: «${p.text}» — ответ ноль`);
            assert(p.a >= 2 && p.a <= ceil[level],
                `${level}★: уменьшаемое ${p.a} вне потолка ${ceil[level]}`);
        }
    }
});

test('частоты полос по уменьшаемому те же, что у сложения', () => {
    const N = 40000;
    for (let level = 1; level <= 5; level++) {
        const counts = [0, 0, 0, 0, 0];
        for (const p of sampleSub(level, N)) {
            const bi = bandOf(p.a);
            assert(bi >= 0, `${level}★: уменьшаемое ${p.a} не попало ни в одну полосу`);
            counts[bi]++;
        }
        const expected = ADD_WEIGHTS_EXPECTED[level];
        for (let i = 0; i < counts.length; i++) {
            const want = expected[i] || 0;
            const got = counts[i] / N;
            const tol = 0.01 + 0.02 * want;
            assert(Math.abs(got - want) <= tol,
                `${level}★ полоса ${ADD_BANDS_EXPECTED[i].join('-')}: ожидали ${(want * 100).toFixed(1)}%, вышло ${(got * 100).toFixed(1)}%`);
        }
    }
});

test('три класса заёма разложены по тем же долям', () => {
    // Класс считается по вычитаемому и ответу — это два слагаемых зеркала b + c = a.
    const N = 40000;
    for (let level = 1; level <= 5; level++) {
        const total = [0, 0, 0, 0, 0];
        const byClass = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (const p of sampleSub(level, N)) {
            const bi = bandOf(p.a);
            total[bi]++;
            byClass[bi][unitsClassOf(p.b, p.answer)]++;
        }
        for (let i = 0; i < total.length; i++) {
            if (total[i] < 1000) continue;
            const want = i === 0 ? ADD_CLASS_EXPECTED_SMALL : ADD_CLASS_EXPECTED;
            for (let c = 0; c < 3; c++) {
                const got = byClass[i][c] / total[i];
                assert(Math.abs(got - want[c]) <= shareTolerance(want[c], total[i]),
                    `${level}★ полоса ${ADD_BANDS_EXPECTED[i].join('-')}, класс ${c}: `
                    + `${(got * 100).toFixed(1)}% вместо ${(want[c] * 100).toFixed(0)}%`);
            }
        }
    }
});

test('заём в вычитании и перенос в сложении — одно событие', () => {
    // b%10 + c%10 = a%10 + 10·k, поэтому полный заём (последняя цифра уменьшаемого меньше
    // последней цифры вычитаемого и сама не ноль) обязан совпадать с третьим классом.
    for (let level = 2; level <= 5; level++) {
        for (const p of sampleSub(level, 20000)) {
            const borrow = (p.a % 10) < (p.b % 10) && (p.a % 10) !== 0;
            const cls = unitsClassOf(p.b, p.answer);
            assert(borrow === (cls === 2),
                `${level}★: «${p.text}» — заём ${borrow}, а класс ${cls}`);
        }
    }
});

test('порог действует только на класс без заёма, 156 − 9 остаётся', () => {
    const N = 30000;
    let smallWithBorrow = 0;
    for (let level = 2; level <= 5; level++) {
        for (const p of sampleSub(level, N)) {
            const bi = bandOf(p.a);
            const min = Math.min(p.b, p.answer);
            if (unitsClassOf(p.b, p.answer) === 0) {
                assert(min >= ADD_FLOOR_EXPECTED[bi],
                    `${level}★: «${p.text}» без заёма, а меньшее из пары ${min} ниже порога ${ADD_FLOOR_EXPECTED[bi]}`);
            } else if (min < ADD_FLOOR_EXPECTED[bi]) {
                smallWithBorrow++;
            }
        }
    }
    assert(smallWithBorrow > 0,
        'не осталось примеров вида «трёхзначное минус однозначное с заёмом» (156 − 9)');
});

test('вычитание десятков не считается вычитанием из круглого', () => {
    // 50 − 20 даёт сумму единиц ноль, а не десять: это вычитание десятков, и придержать
    // такие примеры обязан порог, из-под которого средний класс выведен.
    const missed = [];
    for (let level = 3; level <= 5; level++) {
        for (const p of sampleSub(level, 20000)) {
            const bi = bandOf(p.a);
            if (p.b % 10 === 0 && p.answer % 10 === 0
                && Math.min(p.b, p.answer) < ADD_FLOOR_EXPECTED[bi]) {
                missed.push(`${level}★ «${p.text}»`);
            }
        }
    }
    assert(missed.length === 0,
        `вычитание десятков прошло мимо порога: ${missed.slice(0, 3).join(', ')}`);
});

test('первая звезда вычитания: 30% на вычитание из десяти, полного заёма нет', () => {
    const N = 40000;
    let fromTen = 0;
    const counts = new Map();
    for (const p of sampleSub(1, N)) {
        assert(p.a >= 2 && p.a <= 10, `1★: уменьшаемое ${p.a} вне 2..10`);
        assert(unitsClassOf(p.b, p.answer) !== 2, `1★: «${p.text}» с полным заёмом`);
        if (p.a === 10) { fromTen++; counts.set(p.text, (counts.get(p.text) || 0) + 1); }
    }
    const share = fromTen / N;
    assert(Math.abs(share - 0.30) <= 0.02,
        `1★: вычитания из десяти вышло ${(share * 100).toFixed(1)}% вместо 30%`);
    // Девять фактов идут поровну: вес к среднему классу не применяется.
    assert(counts.size === 9, `фактов вида 10 − x нашлось ${counts.size} вместо девяти`);
    for (const [text, n] of counts) {
        const inside = n / fromTen;
        assert(Math.abs(inside - 1 / 9) <= 0.025,
            `«${text}» занимает ${(inside * 100).toFixed(1)}% вместо 11,1%`);
    }
});

test('вес малых чисел действует и в вычитании', () => {
    const N = 60000;
    const byMin = [0, 0, 0, 0, 0, 0];
    let inBand = 0;
    for (const p of sampleSub(1, N)) {
        const m = Math.min(p.b, p.answer);
        byMin[m]++; inBand++;
    }
    const share = (m) => byMin[m] / inBand;
    assert(share(1) < share(2),
        `1★: с единицей ${(share(1) * 100).toFixed(1)}%, с двойкой ${(share(2) * 100).toFixed(1)}% — вес не работает`);
    assert(share(1) < 0.27,
        `1★: примеров, где вычитаемое или ответ равны единице, ${(share(1) * 100).toFixed(1)}%`);
});

group('Дроби: обещания уровней сложности');
test('1★ сложение/вычитание — ответ никогда не требует сокращения', () => {
    const bad = [];
    ['add', 'sub'].forEach(op => {
        for (let i = 0; i < 4000; i++) {
            const m = G.pickAddSubMagnitudes(1, op);
            const f1 = { num: m.n1, den: m.d1 }, f2 = { num: m.n2, den: m.d1 };
            const ans = op === 'add' ? G.fracAdd(f1, f2) : G.fracSub(f1, f2);
            if (ans.den !== m.d1) bad.push(`${m.n1}/${m.d1} ${op} ${m.n2}/${m.d1} → ${ans.num}/${ans.den}`);
            if (ans.num === 0) bad.push(`нулевой ответ: ${m.n1}/${m.d1} ${op} ${m.n2}/${m.d1}`);
        }
    });
    assert(bad.length === 0, `сократимых ответов: ${bad.length}, например ${bad[0]}`);
});

test('1★ сложение/вычитание — одинаковые знаменатели из пула 3..11', () => {
    const dens = new Set();
    ['add', 'sub'].forEach(op => {
        for (let i = 0; i < 4000; i++) {
            const m = G.pickAddSubMagnitudes(1, op);
            assert(m.d1 === m.d2, `знаменатели разошлись: ${m.d1} и ${m.d2}`);
            assert(m.n1 >= 1 && m.n1 < m.d1 && m.n2 >= 1 && m.n2 < m.d1,
                `числитель вне диапазона: ${m.n1}, ${m.n2} при знаменателе ${m.d1}`);
            dens.add(m.d1);
        }
    });
    const sorted = [...dens].sort((a, b) => a - b);
    assert(sorted[0] >= 3 && sorted[sorted.length - 1] <= 11,
        `знаменатели вне 3..11: ${sorted.join(',')}`);
    assert(sorted.length >= 8, `мало разных знаменателей: ${sorted.join(',')}`);
});

test('2★ сложение/вычитание — ответ сокращается и при этом не 0 и не 1', () => {
    // Проверка «сокращается» сама по себе слабая: 0/6 и 6/6 ей удовлетворяют,
    // и уровень с 88% таких ответов её проходил. Поэтому здесь три условия сразу.
    const bad = [];
    ['add', 'sub'].forEach(op => {
        for (let i = 0; i < 3000; i++) {
            const m = G.pickAddSubMagnitudes(2, op);
            const f1 = { num: m.n1, den: m.d1 }, f2 = { num: m.n2, den: m.d2 };
            const ans = op === 'add' ? G.fracAdd(f1, f2) : G.fracSub(f1, f2);
            const shown = `${m.n1}/${m.d1} ${op} ${m.n2}/${m.d2}`;
            if (m.d1 !== m.d2) bad.push(`разные знаменатели: ${shown}`);
            if (ans.den === m.d1) bad.push(`не сокращается: ${shown}`);
            if (ans.num === 0) bad.push(`ответ 0: ${shown}`);
            if (ans.num === ans.den) bad.push(`ответ 1: ${shown}`);
        }
    });
    assert(bad.length === 0, `${bad.length} нарушений, например: ${bad[0]}`);
});

test('2★ сложение/вычитание — знаменатели только составные', () => {
    // При простом знаменателе d из дробей k/d сокращаются только k = 0 и k = d,
    // то есть ответ 0 или 1. Простое число в пуле 2★ — это гарантированное вырождение.
    const dens = new Set();
    ['add', 'sub'].forEach(op => {
        for (let i = 0; i < 3000; i++) dens.add(G.pickAddSubMagnitudes(2, op).d1);
    });
    const isPrime = (n) => {
        if (n < 2) return false;
        for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
        return true;
    };
    const primes = [...dens].filter(isPrime);
    assert(primes.length === 0, `простые знаменатели на 2★: ${primes.join(',')}`);
    assert(dens.size >= 4, `мало разных знаменателей: ${[...dens].sort((a, b) => a - b).join(',')}`);
});

test('2★ умножение/деление — сокращение всегда возможно, операнды несократимы', () => {
    const problems = [];
    ['mul', 'div'].forEach(op => {
        for (let i = 0; i < 4000; i++) {
            const m = G.pickMulDivMagnitudes(2, op);
            const canCancel = op === 'mul'
                ? (G.gcd(m.n2, m.d1) > 1 || G.gcd(m.n1, m.d2) > 1)
                : (G.gcd(m.n1, m.n2) > 1 || G.gcd(m.d1, m.d2) > 1);
            if (!canCancel) problems.push(`${op}: ${m.n1}/${m.d1} и ${m.n2}/${m.d2} не сокращаются`);
            if (G.gcd(m.n1, m.d1) !== 1 || G.gcd(m.n2, m.d2) !== 1) {
                problems.push(`${op}: операнд сократим — ${m.n1}/${m.d1}, ${m.n2}/${m.d2}`);
            }
        }
    });
    assert(problems.length === 0, `${problems.length} нарушений, например: ${problems[0]}`);
});

test('3★ и 5★ умножение/деление — сокращение примерно в половине случаев', () => {
    [3, 5].forEach(level => {
        ['mul', 'div'].forEach(op => {
            let can = 0;
            const N = 4000;
            for (let i = 0; i < N; i++) {
                const m = G.pickMulDivMagnitudes(level, op);
                const c = op === 'mul'
                    ? (G.gcd(m.n2, m.d1) > 1 || G.gcd(m.n1, m.d2) > 1)
                    : (G.gcd(m.n1, m.n2) > 1 || G.gcd(m.d1, m.d2) > 1);
                if (c) can++;
            }
            const pct = can / N * 100;
            assert(pct > 30 && pct < 70,
                `${op} ${level}★: сокращается ${pct.toFixed(0)}% — ожидалось около половины`);
        });
    });
});

test('4★ умножение/деление — один из операндов целое число', () => {
    ['mul', 'div'].forEach(op => {
        for (let i = 0; i < 2000; i++) {
            const m = G.pickMulDivMagnitudes(4, op);
            assert(m.d1 === 1 || m.d2 === 1,
                `${op} 4★: ни один операнд не целый — ${m.n1}/${m.d1}, ${m.n2}/${m.d2}`);
        }
    });
});

group('Дроби: специальные режимы');
test('сокращение — условие действительно сократимо, ответ несократим', () => {
    for (let level = 1; level <= 5; level++) {
        for (let i = 0; i < 2000; i++) {
            const p = G.generateSimplifyProblem(level);
            assert(G.gcd(p.given.num, p.given.den) > 1,
                `${level}★: условие ${p.given.num}/${p.given.den} уже несократимо`);
            assert(G.gcd(p.answer.num, p.answer.den) === 1,
                `${level}★: ответ ${p.answer.num}/${p.answer.den} сократим`);
            const g = G.gcd(p.given.num, p.given.den);
            assert(p.given.num / g === p.answer.num && p.given.den / g === p.answer.den,
                `${level}★: ответ не соответствует условию`);
        }
    }
});

test('перевод в смешанное/неправильную — величина не меняется', () => {
    for (let level = 1; level <= 5; level++) {
        for (let i = 0; i < 1000; i++) {
            [G.generateToMixedProblem(level), G.generateToImproperProblem(level)].forEach(p => {
                assert(p.whole * p.den + p.properNum === p.answer.num,
                    `${level}★: ${p.whole} и ${p.properNum}/${p.den} ≠ ${p.answer.num}/${p.answer.den}`);
                assert(p.properNum > 0 && p.properNum < p.den,
                    `${level}★: остаток ${p.properNum} не правильная дробь при знаменателе ${p.den}`);
            });
        }
    }
});

test('дробь от числа — ответ всегда целый', () => {
    for (let level = 1; level <= 5; level++) {
        for (let i = 0; i < 2000; i++) {
            const p = G.generateFracOfNumberProblem(level);
            assert(p.N % p.fracDen === 0,
                `${level}★: ${p.N} не делится на ${p.fracDen} нацело`);
            assert(Number.isInteger(p.answer) && p.answer > 0,
                `${level}★: ответ ${p.answer} не целое положительное`);
            assert(p.answer === p.N / p.fracDen * p.fracNum,
                `${level}★: ответ не равен ${p.fracNum}/${p.fracDen} от ${p.N}`);
        }
    }
});

group('Варианты ответа');
test('вариант ответа не может быть невозможным при ответе от 11', () => {
    // Сумма всегда больше каждого слагаемого, разность всегда меньше уменьшаемого.
    // Вариант, нарушающий это, отбрасывается одним взглядом — слот пропадает зря.
    // На самых маленьких примерах (2 − 1) правдоподобных чисел физически меньше трёх,
    // и фильтр там снимается осознанно, поэтому проверяем от одиннадцати.
    const bad = [];
    ['add', 'sub'].forEach(op => {
        for (let level = 1; level <= 5; level++) {
            for (let i = 0; i < 4000; i++) {
                const p = G.generateProblem(op, level, false);
                if (p.noSolution || p.answer < 11) continue;
                const opts = G.buildDistractors(op, p.a, p.b, p.answer, false, 3)
                              .filter(v => typeof v === 'number');
                opts.forEach(v => {
                    if (op === 'add' && v <= Math.max(p.a, p.b)) bad.push(`${p.text}: ${v}`);
                    if (op === 'sub' && (v >= p.a || v === p.b)) bad.push(`${p.text}: ${v}`);
                });
            }
        }
    });
    assert(bad.length === 0, `невозможные варианты: ${bad.slice(0, 5).join(', ')}`);
});

test('последняя цифра не выдаёт ответ: рядом всегда есть ловушка на десяток', () => {
    // Пока среди вариантов нет второго числа с той же последней цифрой, пример решается
    // счётом одного разряда из двух. Полностью исключить нельзя: изредка обе стороны
    // (ответ ± 10) оказываются невозможными, поэтому порог, а не ноль.
    ['add', 'sub'].forEach(op => {
        for (let level = 1; level <= 5; level++) {
            let uniq = 0, total = 0;
            for (let i = 0; i < 4000; i++) {
                const p = G.generateProblem(op, level, false);
                if (p.noSolution || p.answer < 11) continue;
                total++;
                const opts = G.buildDistractors(op, p.a, p.b, p.answer, false, 3)
                              .filter(v => typeof v === 'number');
                if (!opts.some(v => v % 10 === p.answer % 10)) uniq++;
            }
            if (!total) continue;
            const share = uniq / total;
            assert(share < 0.15,
                `${op} ${level}★: ответ виден по последней цифре в ${(share * 100).toFixed(1)}% примеров`);
        }
    });
});

test('верный ответ не выделяется числом общих цифр с другими вариантами', () => {
    // Ловушка на десяток делит с ответом единицы, ловушка на единицы — десятки.
    // Если поставить только их, ответ оказывается единственным числом, связанным
    // сразу с двумя другими, и его видно, не считая. Квадрат 2×2 это выравнивает.
    const tens = (x) => Math.floor(x / 10), units = (x) => x % 10;
    ['add', 'sub'].forEach(op => {
        for (let level = 2; level <= 5; level++) {
            let leak = 0, total = 0;
            for (let i = 0; i < 4000; i++) {
                const p = G.generateProblem(op, level, false);
                if (p.noSolution || p.answer < 11) continue;
                total++;
                const all = [p.answer].concat(
                    G.buildDistractors(op, p.a, p.b, p.answer, false, 3).filter(v => typeof v === 'number'));
                const score = all.map(v => all.filter(o => o !== v
                    && (tens(o) === tens(v) || units(o) === units(v))).length);
                const max = Math.max(...score);
                if (score[0] === max && score.filter(x => x === max).length === 1) leak++;
            }
            if (!total) continue;
            const share = leak / total;
            assert(share < 0.10,
                `${op} ${level}★: ответ — самый связанный вариант в ${(share * 100).toFixed(1)}% примеров`);
        }
    });
});

test('ловушка на десяток отличается от ответа ровно на десять', () => {
    // Модель «единицы верные, десятки нет». Если сдвиг окажется другим, разбор ошибок
    // назовёт причину неверно: он опознаёт её именно по разнице в десять.
    ['add', 'sub'].forEach(op => {
        for (let level = 1; level <= 5; level++) {
            for (let i = 0; i < 1500; i++) {
                const p = G.generateProblem(op, level, false);
                if (p.noSolution || p.answer < 11) continue;
                const opts = G.buildDistractors(op, p.a, p.b, p.answer, false, 3)
                              .filter(v => typeof v === 'number');
                const same = opts.filter(v => v % 10 === p.answer % 10);
                same.forEach(v => assert(Math.abs(v - p.answer) % 10 === 0,
                    `${p.text}: вариант ${v} делит последнюю цифру, но не кратен десяти`));
            }
        }
    });
});

test('среди вариантов нет равного правильному по значению', () => {
    // Иначе ученик выбирает верный по сути ответ и получает «ошибку» или «почти».
    const bad = [];
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let level = 1; level <= 5; level++) {
            for (let i = 0; i < 500; i++) {
                const p = G.generateFractionProblem(op, level, false);
                const d = G.buildFractionDistractors(op, p.f1, p.f2, p.answer, false, 3, level);
                assert(d.length === 3, `${op} ${level}★: вариантов ${d.length}, а не 3`);
                d.forEach(x => {
                    const sameValue = x.num * p.answer.den === p.answer.num * x.den;
                    const sameForm = x.num === p.answer.num && x.den === p.answer.den;
                    // Несокращённая форма верного ответа — законный вариант («почти»),
                    // но только там, где сокращать вообще требуется, то есть не на 1★.
                    if (sameValue && !sameForm && level === 1 && (op === 'add' || op === 'sub')) {
                        bad.push(`${op} 1★: вариант ${x.num}/${x.den} равен ответу ${p.answer.num}/${p.answer.den}`);
                    }
                });
            }
        }
    });
    assert(bad.length === 0, `${bad.length} случаев, например: ${bad[0]}`);
});

test('варианты не повторяются между собой', () => {
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let level = 1; level <= 5; level++) {
            for (let i = 0; i < 300; i++) {
                const p = G.generateFractionProblem(op, level, false);
                const d = G.buildFractionDistractors(op, p.f1, p.f2, p.answer, false, 3, level);
                const keys = d.map(x => `${x.num}/${x.den}`);
                assert(new Set(keys).size === keys.length,
                    `${op} ${level}★: повтор среди вариантов ${keys.join(', ')}`);
            }
        }
    });
});

group('Разбор ошибок: что именно сделано не так');
// Варианты ответа с самого начала строятся как модели конкретных ошибок. Разбор
// восстанавливает модель обратно по выбранному числу — значит, на настоящих вариантах
// он и должен срабатывать. Здесь проверяется именно это: не «функция не падает»,
// а «по живым дистракторам она узнаёт причину чаще, чем разводит руками».

function wrongOptionsFor(c) {
    // Пары (верный ответ, неверный вариант) ровно в том виде, в каком их увидит checkAnswer.
    const p = generateOne(c.cat, c.op, c.level, c.isNegative);
    let correct = p.answer, options = [];
    if (c.cat === 'fraction' && ['add', 'sub', 'mul', 'div'].includes(c.op)) {
        options = G.buildFractionDistractors(c.op, p.f1, p.f2, correct, c.isNegative, 3, c.level);
    } else if (c.cat === 'fraction' && c.op === 'simplify') {
        options = G.buildSimplifyDistractors(p, 3);
    } else if (c.cat === 'fraction' && (c.op === 'toMixed' || c.op === 'toImproper')) {
        options = G.buildMixedConvertDistractors(p, 3);
    } else if (c.cat === 'fraction' && c.op === 'fracOfNumber') {
        options = G.buildFracOfNumberDistractors(p, 3);
    } else if (c.cat === 'decimal') {
        options = G.buildDecimalDistractors(c.op, p.d1, p.d2, correct, c.isNegative, 3);
    } else {
        options = G.buildDistractors(c.op, p.a, p.b, correct, c.isNegative, 3);
    }
    const meta = { isNegative: c.isNegative, opKey: c.op, level: c.level, category: c.cat };
    return { p, meta, correct, options: options || [] };
}

test('разбор не падает ни на одной теме и ни на одном варианте', () => {
    const broken = [];
    forEachCombo(c => {
        try {
            for (let i = 0; i < 40; i++) {
                const { p, meta, correct, options } = wrongOptionsFor(c);
                options.forEach(o => {
                    const kind = G.classifyMistake(meta, p, correct, o);
                    if (typeof kind !== 'string' || !kind) throw new Error(`вернул ${JSON.stringify(kind)}`);
                });
            }
        } catch (e) { broken.push(`${c.label}: ${e.message}`); }
    });
    assert(broken.length === 0, broken.join('; '));
});

test('причина названа у большинства настоящих вариантов ответа', () => {
    // Часть вариантов — случайные наполнители: когда модели ошибок для темы кончаются,
    // генератор добирает недостающие числа рядом с ответом. У них причины нет и быть
    // не может, поэтому требование не «разобрать всё», а два порога, снятые с замера:
    // в среднем по всем темам сегодня разбирается 85%, хуже всего — 33% (дроби 1★ на
    // вычитание, где из трёх вариантов осмысленных моделей всего две).
    const poor = [];
    let sumPct = 0, topics = 0;
    forEachCombo(c => {
        let total = 0, named = 0;
        for (let i = 0; i < 60; i++) {
            const { p, meta, correct, options } = wrongOptionsFor(c);
            options.forEach(o => {
                total++;
                if (G.classifyMistake(meta, p, correct, o) !== 'другая ошибка') named++;
            });
        }
        if (!total) return;
        const pct = named / total;
        sumPct += pct; topics++;
        if (pct < 0.30) poor.push(`${c.label}: ${Math.round(pct * 100)}%`);
    });
    assert(poor.length === 0, `слишком много неразобранного: ${poor.join('; ')}`);
    const avg = sumPct / topics;
    assert(avg >= 0.70, `в среднем разбирается только ${Math.round(avg * 100)}%`);
});

test('верный ответ никогда не попадает в разбор как ошибка', () => {
    // Защита от обратной беды: если разбор назовёт причину там, где ученик ответил
    // верно, статистика начнёт показывать ошибки, которых не было.
    const bad = [];
    forEachCombo(c => {
        for (let i = 0; i < 40; i++) {
            const { p, meta, correct, options } = wrongOptionsFor(c);
            const sameAsCorrect = options.filter(o => JSON.stringify(o) === JSON.stringify(correct));
            if (sameAsCorrect.length) bad.push(`${c.label}: верный ответ оказался среди неверных вариантов`);
        }
    });
    assert(bad.length === 0, bad[0]);
});

test('известные ошибки узнаются по имени', () => {
    // Точечные случаи, посчитанные на бумаге. Если разбор перестанет их узнавать,
    // значит модель разошлась с тем, как строятся варианты ответа.
    const F = (num, den) => ({ num, den });
    const cases = [
        // 1/2 + 1/3: сложил числители и знаменатели отдельно
        [{ opKey: 'add', category: 'fraction' }, { f1: F(1, 2), f2: F(1, 3), opKey: 'add' }, F(5, 6), F(2, 5), 'сложил знаменатели'],
        // 1/2 ÷ 1/3: не перевернул вторую дробь
        [{ opKey: 'div', category: 'fraction' }, { f1: F(1, 2), f2: F(1, 3), opKey: 'div' }, F(3, 2), F(1, 6), 'не перевернул дробь'],
        // 2/3 × 3/4: перемножил числители, знаменатель взял готовый
        [{ opKey: 'mul', category: 'fraction' }, { f1: F(2, 3), f2: F(3, 4), opKey: 'mul' }, F(1, 2), F(2, 1), 'забыл перемножить знаменатели'],
        // 3/12 + 7/12 = 5/6, а выбрано несокращённое 10/12
        [{ opKey: 'add', category: 'fraction' }, { f1: F(3, 12), f2: F(7, 12), opKey: 'add' }, F(5, 6), F(120, 144), 'общий знаменатель зря'],
        // то же условие, но выбран просто несокращённый ответ
        [{ opKey: 'add', category: 'fraction' }, { f1: F(3, 12), f2: F(7, 12), opKey: 'add' }, F(5, 6), F(10, 12), 'не сократил'],
        // 7 × 7 = 49, выбрано 56 — соседняя клетка таблицы
        [{ opKey: 'mul', category: 'integer' }, { a: 7, b: 7 }, 49, 56, 'таблица умножения'],
        // 12 ÷ 4 = 3, названо само делимое
        [{ opKey: 'div', category: 'integer' }, { a: 12, b: 4 }, 3, 12, 'взял одно из чисел'],
        // 5 − 3 = 2, выбрано 8 — перепутал действие
        [{ opKey: 'sub', category: 'integer' }, { a: 5, b: 3 }, 2, 8, 'перепутал действие'],
        // 17 + 18 = 35, названо 25: единицы верные, потерян десяток
        [{ opKey: 'add', category: 'integer' }, { a: 17, b: 18 }, 35, 25, 'ошибка в десятках'],
        // то же, но десяток лишний
        [{ opKey: 'add', category: 'integer' }, { a: 17, b: 18 }, 35, 45, 'ошибка в десятках'],
        // 62 − 38 = 24, названо 34 — тот же промах при вычитании
        [{ opKey: 'sub', category: 'integer' }, { a: 62, b: 38 }, 24, 34, 'ошибка в десятках'],
        // 62 − 38 = 24, названо 36 — поразрядный модуль разности, это другая ошибка
        [{ opKey: 'sub', category: 'integer' }, { a: 62, b: 38 }, 24, 36, 'не занял десяток'],
        // деление на ноль: выбрано число вместо «нет решения»
        [{ opKey: 'div', category: 'integer' }, { a: 4, b: 0, noSolution: true }, null, 4, 'делил на ноль']
    ];
    const bad = [];
    cases.forEach(([meta, problem, correct, chosen, expected]) => {
        const got = G.classifyMistake(Object.assign({ level: 3, isNegative: false }, meta), problem, correct, chosen);
        if (got !== expected) bad.push(`ожидалось «${expected}», получено «${got}»`);
    });
    assert(bad.length === 0, bad.join('; '));
});

test('у каждой причины есть и полная подпись, и короткая', () => {
    const missing = [];
    Object.keys(G.MISTAKE_LABELS).forEach(k => {
        if (!G.MISTAKE_SHORT[k]) missing.push(`нет короткой подписи: ${k}`);
        if (G.MISTAKE_SHORT[k] && G.MISTAKE_SHORT[k].length > 22) missing.push(`короткая подпись слишком длинная: ${k}`);
    });
    Object.keys(G.MISTAKE_SHORT).forEach(k => {
        if (!G.MISTAKE_LABELS[k]) missing.push(`нет полной подписи: ${k}`);
    });
    assert(missing.length === 0, missing.join('; '));
});

group('Умножение: разбор таблицы на группы');

// Главный инвариант всей схемы. Пять групп обязаны РОВНО покрыть таблицу от 2×2
// до 9×9: без дыр (иначе факт не встретится никогда) и без наложений (иначе доли
// врут, а факт на пересечении выпадает вдвое чаще соседей — ровно тот дефект,
// из-за которого в старом генераторе {1,2,5,10} занимали 27,7% первой звезды).
test('пять групп ровно покрывают таблицу 2..9', () => {
    const inTable = new Set();
    for (let a = 2; a <= 9; a++) for (let b = a; b <= 9; b++) inTable.add(`${a}×${b}`);

    const seen = new Map();
    ['two', 'five', 'small', 'nine', 'core'].forEach(name => {
        G.MUL_GROUPS[name].forEach(([a, b]) => {
            const k = `${Math.min(a, b)}×${Math.max(a, b)}`;
            seen.set(k, (seen.get(k) || 0) + 1);
        });
    });

    const dup = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    const missing = [...inTable].filter(k => !seen.has(k));
    const extra = [...seen.keys()].filter(k => !inTable.has(k));

    assert(dup.length === 0, `факт в двух группах сразу: ${dup.join(', ')}`);
    assert(missing.length === 0, `факт не попал ни в одну группу: ${missing.join(', ')}`);
    assert(extra.length === 0, `лишний факт вне таблицы: ${extra.join(', ')}`);
    assert(seen.size === 36, `в таблице 36 фактов, а покрыто ${seen.size}`);
});

test('ядро — ровно шесть фактов, и это те самые шесть', () => {
    const core = G.MUL_GROUPS.core.map(([a, b]) => `${a}×${b}`).sort().join(' ');
    assert(core === '6×6 6×7 6×8 7×7 7×8 8×8', `состав ядра: ${core}`);
});

test('доли по каждой звезде дают ровно единицу', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        const sum = G.MUL_SHARES[lvl].reduce((s, [, p]) => s + p, 0);
        assert(Math.abs(sum - 1) < 1e-9, `звезда ${lvl}: сумма долей ${sum}`);
    }
    const bands = G.MUL_TWO_BAND_WEIGHTS.reduce((s, p) => s + p, 0);
    assert(Math.abs(bands - 1) < 1e-9, `полосы двузначного: сумма ${bands}`);
});

test('ни один ответ во всей игре не длиннее трёх цифр', () => {
    let worst = null;
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 60000; i++) {
            const e = G.genMulPositive(lvl);
            if (e.answer > 960 && (!worst || e.answer > worst.answer)) worst = e;
        }
    }
    assert(worst === null, worst && `${worst.text} = ${worst.answer}`);
    // И тот же предел заложен в списке двузначное × круглое: 25…29 × 40 выброшены.
    const mx = Math.max(...G.MUL_TWO_ROUND.map(([a, b]) => a * b));
    assert(mx === 960, `максимум в группе «двузначное × круглое»: ${mx}`);
});

group('Умножение: что выдаёт генератор');

// Шесть фактов ядра обязаны идти РОВНО одинаково. Если факты не перечислять
// списком, а собирать как «выбрать множитель, потом партнёра», то 6×7 рождается
// двумя путями, а 6×6 одним — и квадраты выпадают вдвое реже. Проверяем именно это.
test('внутри ядра все шесть фактов равновероятны', () => {
    const N = 200000, seen = {};
    for (let i = 0; i < N; i++) {
        const e = G.genMulPositive(3);
        const k = `${Math.min(e.a, e.b)}×${Math.max(e.a, e.b)}`;
        if (['6×6', '6×7', '6×8', '7×7', '7×8', '8×8'].includes(k)) seen[k] = (seen[k] || 0) + 1;
    }
    const vals = Object.values(seen);
    assert(vals.length === 6, `встретилось фактов ядра: ${vals.length} из 6`);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    assert(hi / lo < 1.1, `разброс внутри ядра ${(hi / lo).toFixed(2)}x — квадраты снова просели`);
});

test('ядро есть на 3, 4 и 5 звезде и его нет на 1 и 2', () => {
    const N = 60000;
    const share = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genMulPositive(lvl);
            const lo = Math.min(e.a, e.b), hi = Math.max(e.a, e.b);
            if (lo >= 6 && lo <= 8 && hi >= 6 && hi <= 8) c++;
        }
        return c / N;
    };
    assert(share(1) === 0, 'ядро на первой звезде');
    assert(share(2) === 0, 'ядро на второй звезде');
    assert(Math.abs(share(3) - 0.45) < 0.02, `на 3★ ядра ${(share(3) * 100).toFixed(1)}% вместо 45%`);
    assert(share(4) > 0.15 && share(5) > 0.08, 'ядро исчезло на старших звёздах — ровно то, что чинили');
});

test('«без счёта» убывает со звездой и на пятой почти исчезает', () => {
    const N = 60000;
    const triv = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genMulPositive(lvl);
            if (e.a < 2 || e.b < 2 || e.a === 10 || e.b === 10) c++;
        }
        return c / N;
    };
    const t = [1, 2, 3, 4, 5].map(triv);
    assert(t[0] < 0.13, `на 1★ без счёта ${(t[0] * 100).toFixed(1)}% — было 63%`);
    for (let i = 1; i < 5; i++) {
        assert(t[i] <= t[i - 1] + 0.005, `доля выросла со звездой: ${t[i - 1]} -> ${t[i]}`);
    }
    assert(t[4] < 0.04, `на 5★ без счёта ${(t[4] * 100).toFixed(1)}%`);
});

test('полосы двузначного соблюдаются', () => {
    const N = 300000, band = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < N; i++) {
        const e = G.genMulPositive(5);
        const hi = Math.max(e.a, e.b), lo = Math.min(e.a, e.b);
        if (hi < 11 || lo > 9 || hi % 10 === 0) continue;   // только двузначное × однозначное
        n++;
        band[hi <= 30 ? 0 : hi <= 50 ? 1 : 2]++;
    }
    const got = band.map(v => v / n);
    [0.60, 0.30, 0.10].forEach((want, i) => {
        assert(Math.abs(got[i] - want) < 0.03,
            `полоса ${i}: ${(got[i] * 100).toFixed(1)}% вместо ${(want * 100)}%`);
    });
    assert(got[2] > 0.05, 'верхняя полоса пропала — 78 × 7 снова невозможен');
});

test('перенос на пятой звезде занимает заявленную долю', () => {
    const N = 300000;
    let c = 0;
    for (let i = 0; i < N; i++) {
        const e = G.genMulPositive(5);
        const hi = Math.max(e.a, e.b), lo = Math.min(e.a, e.b);
        if (hi >= 11 && lo < 10 && (hi % 10) * lo >= 10) c++;
    }
    const share = c / N;
    assert(Math.abs(share - 0.40) < 0.02, `перенос ${(share * 100).toFixed(1)}% вместо 40%`);
});

test('ответ всегда равен произведению', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const e = G.genMulPositive(lvl);
            assert(e.answer === e.a * e.b, `${e.text} даёт ${e.answer}`);
            assert(e.text === `${e.a} × ${e.b}`, `подпись разошлась с числами: ${e.text}`);
        }
    }
});

test('оба порядка множителей встречаются', () => {
    let big = 0, small = 0;
    for (let i = 0; i < 40000; i++) {
        const e = G.genMulPositive(5);
        if (e.a > e.b) big++; else if (e.a < e.b) small++;
    }
    const ratio = big / (big + small);
    assert(ratio > 0.45 && ratio < 0.55, `перекос порядка: ${(ratio * 100).toFixed(1)}%`);
});

group('Деление: зеркало умножения');

// Тот же инвариант, что у умножения, но считать надо ЗАДАЧИ, а не факты.
// Один факт даёт две задачи (42÷6 и 42÷7), а квадрат — одну (36÷6). Если брать
// равномерно по фактам, вся доля квадрата ложится на единственную задачу и 36÷6
// выпадает ВДВОЕ ЧАЩЕ соседей — точная инверсия дефекта, который чинили в
// умножении. Здесь проверяется, что этого нет.
test('внутри ядра все девять задач равновероятны', () => {
    const N = 300000, want = ['36/6', '42/6', '42/7', '48/6', '48/8', '49/7', '56/7', '56/8', '64/8'];
    const seen = {};
    for (let i = 0; i < N; i++) {
        const e = G.genDivPositive(3);
        const k = `${e.a}/${e.b}`;
        if (want.includes(k)) seen[k] = (seen[k] || 0) + 1;
    }
    const missing = want.filter(k => !seen[k]);
    assert(missing.length === 0, `задача ядра не встретилась: ${missing.join(', ')}`);
    const vals = want.map(k => seen[k]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    assert(hi / lo < 1.1, `разброс внутри ядра ${(hi / lo).toFixed(2)}x — квадраты снова перекошены`);
});

test('доли деления по каждой звезде дают ровно единицу', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        const sum = G.DIV_SHARES[lvl].reduce((s, [, p]) => s + p, 0);
        assert(Math.abs(sum - 1) < 1e-9, `звезда ${lvl}: сумма долей ${sum}`);
    }
});

// Остатков в разделе нет вовсе: «17 ÷ 5» — это другая тема, и ученик, увидев её
// среди кнопок с целыми ответами, решает не деление, а угадайку.
test('ответ всегда целый и равен делимому, делённому на делитель', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 30000; i++) {
            const e = G.genDivPositive(lvl);
            if (e.noSolution) {
                assert(e.b === 0, `«нет решения» не при делении на ноль: ${e.text}`);
                continue;
            }
            assert(Number.isInteger(e.answer), `остаток: ${e.text} = ${e.answer}`);
            assert(e.answer === e.a / e.b, `${e.text} даёт ${e.answer}`);
            assert(e.text === `${e.a} ÷ ${e.b}`, `подпись разошлась с числами: ${e.text}`);
        }
    }
});

// Делим на однозначное и на круглое. Двузначный делитель (84 ÷ 12) — зеркало
// двузначного на двузначное, которого в умножении нет тоже.
test('делитель всегда однозначный или круглый', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 30000; i++) {
            const e = G.genDivPositive(lvl);
            if (e.noSolution) continue;
            const ok = (e.b >= 1 && e.b <= 10) || (e.b % 10 === 0 && e.b >= 20 && e.b <= 90);
            assert(ok, `недопустимый делитель: ${e.text}`);
        }
    }
});

test('ядро есть на 3, 4 и 5 звезде и его нет на 1 и 2', () => {
    const N = 60000;
    const share = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genDivPositive(lvl);
            if (e.noSolution) continue;
            const q = e.answer, b = e.b;
            if (q >= 6 && q <= 8 && b >= 6 && b <= 8) c++;
        }
        return c / N;
    };
    assert(share(1) === 0, 'ядро на первой звезде');
    assert(share(2) === 0, 'ядро на второй звезде');
    assert(Math.abs(share(3) - 0.45) < 0.02, `на 3★ ядра ${(share(3) * 100).toFixed(1)}% вместо 45%`);
    assert(share(4) > 0.15 && share(5) > 0.08, 'ядро исчезло на старших звёздах');
});

// «На ноль делить нельзя» — правило, а не пример: узнаётся один раз. Раньше оно
// занимало ровно 10% всей игры на каждой звезде, то есть каждый десятый вопрос
// пятой звезды не требовал счёта вообще.
test('доля «÷ 0» убывает со звездой и нигде не больше пяти процентов', () => {
    const N = 200000;
    const zero = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) if (G.genDivPositive(lvl).noSolution) c++;
        return c / N;
    };
    // Потолок и убывание — свойства ТАБЛИЦЫ, а не выборки: на первой звезде доля
    // равна ровно 0,05, и проверка «замер не больше 5%» падала бы через раз просто
    // от разброса. Поэтому таблицу проверяем точно, а генератор — с допуском.
    for (let lvl = 1; lvl <= 5; lvl++) {
        assert(G.DIV_ZERO_SHARES[lvl] <= 0.05,
            `${lvl}★: в таблице «÷ 0» ${G.DIV_ZERO_SHARES[lvl] * 100}% — больше пяти процентов`);
        if (lvl > 1) assert(G.DIV_ZERO_SHARES[lvl] <= G.DIV_ZERO_SHARES[lvl - 1],
            `доля выросла со звездой: ${G.DIV_ZERO_SHARES[lvl - 1]} -> ${G.DIV_ZERO_SHARES[lvl]}`);
    }
    assert(G.DIV_ZERO_SHARES[5] < G.DIV_ZERO_SHARES[1], 'доля «÷ 0» так и стоит на месте');

    const z = [1, 2, 3, 4, 5].map(zero);
    for (let i = 0; i < 5; i++) {
        assert(Math.abs(z[i] - G.DIV_ZERO_SHARES[i + 1]) < 0.005,
            `${i + 1}★: «÷ 0» ${(z[i] * 100).toFixed(1)}% вместо ${G.DIV_ZERO_SHARES[i + 1] * 100}%`);
    }
});

// Кнопка «Нет решения» была прямой лазейкой мимо счёта: на пятой звезде она
// показывалась в 12,6% примеров и в 79% из них оказывалась верной. Теперь она
// подмешивается ОТ доли «÷ 0», поэтому верна примерно в четверти показов —
// ровно случайный уровень при четырёх кнопках.
test('«Нет решения» верно не чаще, чем наугад', () => {
    const N = 120000;
    for (let lvl = 1; lvl <= 5; lvl++) {
        let shown = 0, right = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genDivPositive(lvl);
            if (e.noSolution) { shown++; right++; continue; }
            const d = G.buildDistractors('div', e.a, e.b, e.answer, false, 3, lvl);
            if (d.some(x => x === 'NO_SOLUTION')) shown++;
        }
        assert(shown > 0, `${lvl}★: вариант «Нет решения» не появился ни разу`);
        const acc = right / shown;
        assert(acc < 0.32, `${lvl}★: «Нет решения» верно в ${(acc * 100).toFixed(0)}% показов`);
    }
});

// Нулевое частное — та самая путаница, ради которой вариант и нужен: 0 ÷ 7 = 0,
// а не «нельзя». Здесь вариант обязан быть всегда.
// Ответ не может быть не числом — но если станет, приложение обязано остаться
// живым. Последний цикл добора вариантов раньше не имел предела, а Set считает
// NaN равным самому себе: ни один вариант не проходил проверку used.has, и цикл
// крутился без выхода. В браузере это не ошибка в консоли, а замерший телефон
// посреди занятия. Именно так вешал страницу пример 0 ÷ 0, пока divisorAllowed
// пропускал делитель 0.
test('нечисловой ответ не вешает подбор вариантов', () => {
    const started = Date.now();
    const d = G.buildDistractors('div', 0, 0, NaN, false, 3, 3);
    assert(Date.now() - started < 2000, 'подбор вариантов не завершился за две секунды');
    assert(d.length === 3, `вариантов ${d.length} вместо 3 — на экране пустая кнопка`);
    assert(new Set(d).size === 3, `варианты повторяются: ${d.join(', ')}`);
});

test('при нулевом частном «Нет решения» подмешивается всегда', () => {
    for (let i = 0; i < 200; i++) {
        const d = G.buildDistractors('div', 0, 7, 0, false, 3, 3);
        assert(d.some(x => x === 'NO_SOLUTION'), 'ловушка не подмешана к 0 ÷ 7');
    }
});

test('ни одно делимое во всей игре не длиннее трёх цифр', () => {
    let worst = 0;
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 60000; i++) {
            const e = G.genDivPositive(lvl);
            if (!e.noSolution && e.a > worst) worst = e.a;
        }
    }
    assert(worst <= 960, `максимальное делимое ${worst}`);
    const mx = Math.max(...G.DIV_TWO_ROUND.map(([a]) => a));
    assert(mx === 960, `максимум в группе «двузначное ÷ круглое»: ${mx}`);
});

// Разнообразие: на третьей звезде ученик должен видеть таблицу, а не десяток
// примеров по кругу. У старого генератора на первой звезде их было 24 на всю игру.
test('на первой звезде примеров заметно больше двух десятков', () => {
    const seen = new Set();
    for (let i = 0; i < 60000; i++) {
        const e = G.genDivPositive(1);
        if (!e.noSolution) seen.add(`${e.a}/${e.b}`);
    }
    assert(seen.size >= 60, `на 1★ всего ${seen.size} разных примеров`);
});

group('Отрицательные умножение и деление: положительные плюс знак');

// Старая схема брала первый множитель из списка вида {1,2,5,10}, а второй наугад.
// Замер до правки: 61,6% примеров первой звезды не требовали счёта вообще, а на
// четвёртой и пятой таблицы умножения не было ВОВСЕ — первый множитель шёл из
// 10…20 и 10…99, и факты таблицы просто выпадали. Это была худшая клетка приложения.
test('таблица умножения есть на всех старших звёздах, а не только на третьей', () => {
    const N = 40000;
    const coreShare = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genMulNegative(lvl);
            const A = Math.abs(e.a), B = Math.abs(e.b);
            const lo = Math.min(A, B), hi = Math.max(A, B);
            if (lo >= 6 && lo <= 8 && hi >= 6 && hi <= 8) c++;
        }
        return c / N;
    };
    assert(Math.abs(coreShare(3) - 0.45) < 0.02, `на 3★ ядра ${(coreShare(3) * 100).toFixed(1)}% вместо 45%`);
    assert(coreShare(4) > 0.15, `на 4★ ядра ${(coreShare(4) * 100).toFixed(1)}% — было ровно 0`);
    assert(coreShare(5) > 0.08, `на 5★ ядра ${(coreShare(5) * 100).toFixed(1)}% — было ровно 0`);
});

test('«без счёта» в отрицательном умножении нигде не больше десятой части', () => {
    const N = 40000;
    const triv = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genMulNegative(lvl);
            const A = Math.abs(e.a), B = Math.abs(e.b);
            if (A < 2 || B < 2 || A === 10 || B === 10) c++;
        }
        return c / N;
    };
    const t = [1, 2, 3, 4, 5].map(triv);
    assert(t[0] < 0.12, `на 1★ без счёта ${(t[0] * 100).toFixed(1)}% — было 61,6%`);
    for (let i = 1; i < 5; i++) {
        assert(t[i] <= t[i - 1] + 0.005, `доля выросла со звездой: ${t[i - 1]} -> ${t[i]}`);
    }
    assert(t[4] < 0.03, `на 5★ без счёта ${(t[4] * 100).toFixed(1)}%`);
});

// Двузначное на однозначное («−78 × (−7)») здесь не берётся намеренно: если
// арифметика идёт на пределе, знак приписывается в последний момент не думая, и
// навык, ради которого раздел существует, тренируется хуже всего.
test('двузначного на однозначное в отрицательных нет', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const e = G.genMulNegative(lvl);
            const cls = G.mulClassOf(Math.abs(e.a), Math.abs(e.b));
            assert(cls !== 'twoPlain' && cls !== 'twoCarry',
                `${e.text} — двузначное на однозначное (${cls})`);
        }
    }
});

// Без этого пятая звезда была ТОЧНОЙ копией четвёртой: замер давал 1153 разных
// примера против 1155.
test('пятой звезде даёт содержание двузначное на круглое', () => {
    const N = 40000;
    let tw = 0;
    for (let i = 0; i < N; i++) {
        const e = G.genMulNegative(5);
        if (G.mulClassOf(Math.abs(e.a), Math.abs(e.b)) === 'tworound') tw++;
    }
    assert(Math.abs(tw / N - 0.35) < 0.02, `двузначного на круглое ${(100 * tw / N).toFixed(1)}% вместо 35%`);
    let four = 0;
    for (let i = 0; i < N; i++) {
        const e = G.genMulNegative(4);
        if (G.mulClassOf(Math.abs(e.a), Math.abs(e.b)) === 'tworound') four++;
    }
    assert(four === 0, 'двузначное на круглое пролезло на четвёртую звезду');
});

// Опечатка в имени группы больше не роняет генератор — mulPairForGroup подставит
// запасную. Значит, ловить её обязаны проверки, иначе звезда молча наполнится не тем.
test('генератор знает каждую группу, названную в долях', () => {
    // Списки РАЗНЫЕ по режимам, и это главное в проверке. Двузначное на однозначное
    // умеют только положительные генераторы: у отрицательных ветки для него нет, и
    // группа молча свалится в запасную, наполнив звезду не тем. Один общий список
    // такую подмену пропустил бы.
    const base = Object.keys(G.MUL_GROUPS).concat(['tworound']);
    const divBase = Object.keys(G.DIV_GROUPS).concat(['tworound', 'zero']);
    [['умножение', G.MUL_SHARES, base.concat(['twoPlain', 'twoCarry'])],
     ['умножение (отр.)', G.NEG_MUL_SHARES, base],
     ['деление', G.DIV_SHARES, divBase.concat(['twoPlain', 'twoCarry'])],
     ['деление (отр.)', G.NEG_DIV_SHARES, divBase]
    ].forEach(([name, shares, known]) => {
        for (let lvl = 1; lvl <= 5; lvl++) {
            shares[lvl].forEach(([g]) => {
                assert(known.indexOf(g) >= 0, `${name}, звезда ${lvl}: группа «${g}» генератору неизвестна`);
            });
        }
    });
});

test('доли отрицательных по каждой звезде дают ровно единицу', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        const m = G.NEG_MUL_SHARES[lvl].reduce((s, [, p]) => s + p, 0);
        const d = G.NEG_DIV_SHARES[lvl].reduce((s, [, p]) => s + p, 0);
        assert(Math.abs(m - 1) < 1e-9, `умножение, звезда ${lvl}: сумма долей ${m}`);
        assert(Math.abs(d - 1) < 1e-9, `деление, звезда ${lvl}: сумма долей ${d}`);
    }
});

test('ответ равен произведению вместе со знаком', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const e = G.genMulNegative(lvl);
            assert(e.answer === e.a * e.b, `${e.text} даёт ${e.answer}`);
        }
    }
});

test('деление отрицательных: ответ целый, делимое равно частному на делитель', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const e = G.genDivNegative(lvl);
            if (e.noSolution) {
                assert(e.b === 0, `«нет решения» не при делении на ноль: ${e.text}`);
                continue;
            }
            assert(Number.isInteger(e.answer), `остаток: ${e.text} = ${e.answer}`);
            assert(e.a === e.answer * e.b, `${e.text} = ${e.answer} не сходится`);
        }
    }
});

test('делитель в отрицательных всегда однозначный или круглый', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const e = G.genDivNegative(lvl);
            if (e.noSolution) continue;
            const B = Math.abs(e.b);
            const ok = (B >= 1 && B <= 10) || (B % 10 === 0 && B >= 20 && B <= 90);
            assert(ok, `недопустимый делитель: ${e.text}`);
        }
    }
});

// Раньше «÷ 0» стояло ровно на 4% всю игру. Это правило, а не пример: узнаётся один раз.
test('доля «÷ 0» в отрицательных убывает со звездой', () => {
    const N = 60000;
    const zero = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) if (G.genDivNegative(lvl).noSolution) c++;
        return c / N;
    };
    const z = [1, 2, 3, 4, 5].map(zero);
    for (let i = 0; i < 5; i++) {
        const row = G.NEG_DIV_SHARES[i + 1].filter(r => r[0] === 'zero');
        const want = row.length ? row[0][1] : 0;
        assert(Math.abs(z[i] - want) < 0.006,
            `${i + 1}★: «÷ 0» ${(z[i] * 100).toFixed(1)}% вместо ${(want * 100).toFixed(0)}%`);
        assert(z[i] <= 0.06, `${i + 1}★: «÷ 0» ${(z[i] * 100).toFixed(1)}%`);
    }
    assert(z[4] < z[0] - 0.01, `доля не убыла со звездой: ${z[0]} -> ${z[4]}`);
});

test('таблица есть и в отрицательном делении на всех старших звёздах', () => {
    const N = 40000;
    const core = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = G.genDivNegative(lvl);
            if (e.noSolution) continue;
            const q = Math.abs(e.answer), B = Math.abs(e.b);
            if (q >= 6 && q <= 8 && B >= 6 && B <= 8) c++;
        }
        return c / N;
    };
    assert(Math.abs(core(3) - 0.45) < 0.02, `на 3★ ядра ${(core(3) * 100).toFixed(1)}% вместо 45%`);
    assert(core(4) > 0.14, `на 4★ ядра ${(core(4) * 100).toFixed(1)}% — было 3,4%`);
    assert(core(5) > 0.07, `на 5★ ядра ${(core(5) * 100).toFixed(1)}% — было 1,7%`);
});

// Знак — предмет раздела, поэтому все четыре комбинации обязаны встречаться, а
// «оба положительных» остаётся редким: такой пример выглядит случайно попавшим.
test('встречаются все четыре комбинации знаков, «оба плюса» — редкость', () => {
    const N = 60000;
    ['genMulNegative', 'genDivNegative'].forEach(fn => {
        const seen = { '++': 0, '+-': 0, '-+': 0, '--': 0 };
        for (let i = 0; i < N; i++) {
            const e = G[fn](3);
            if (e.noSolution || e.a === 0 || e.b === 0) continue;
            seen[(e.a > 0 ? '+' : '-') + (e.b > 0 ? '+' : '-')]++;
        }
        Object.keys(seen).forEach(k => assert(seen[k] > 0, `${fn}: комбинация ${k} не встретилась`));
        const total = Object.values(seen).reduce((a, b) => a + b, 0);
        assert(seen['++'] / total < 0.10, `${fn}: «оба плюса» ${(100 * seen['++'] / total).toFixed(1)}%`);
    });
});

group('Отрицательные сложение и вычитание: знак как содержание');

// Класс считаем ТОЧНО, а не по видимому знаку: генератор переворачивает оператор
// при отображении («7 − (−3)» может показаться как «7 + 3»), поэтому второе число
// восстанавливаем из ответа. a — всегда первое число, answer = x + y.
function negParts(e) {
    const x = e.a, y = e.answer - e.a;
    let cls;
    if (Math.sign(x) === Math.sign(y)) cls = 0;                  // модули складываются
    else if (Math.abs(x) > Math.abs(y)) cls = 1;                 // ноль не переходим
    else cls = 2;                                                // ноль переходим
    return { x, y, cls };
}

test('классы идут ровно по заданным долям', () => {
    const N = 120000;
    for (let lvl = 1; lvl <= 5; lvl++) {
        const c = [0, 0, 0];
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            c[negParts(e).cls]++;
        }
        G.NEG_ADD_CLASS_SHARES[lvl].forEach((want, i) => {
            const got = c[i] / N;
            assert(Math.abs(got - want) < 0.02,
                `${lvl}★, класс ${i}: ${(got * 100).toFixed(1)}% вместо ${(want * 100)}%`);
        });
    }
});

// Переход через ноль — главная ошибка темы: считают 8 − 3 = 5 и оставляют знак
// первого числа. До правки доля таких примеров была делом случая.
test('переход через ноль растёт со звездой и на пятой больше половины', () => {
    const N = 80000;
    const cross = (lvl) => {
        let c = 0;
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            if (negParts(e).cls === 2) c++;
        }
        return c / N;
    };
    const v = [1, 2, 3, 4, 5].map(cross);
    for (let i = 1; i < 5; i++) assert(v[i] > v[i - 1] - 0.005, `доля упала со звездой: ${v[i - 1]} -> ${v[i]}`);
    assert(v[4] > 0.5, `на 5★ переход через ноль ${(v[4] * 100).toFixed(1)}%`);
    assert(v[0] < 0.25, `на 1★ переход через ноль ${(v[0] * 100).toFixed(1)}%`);
});

// Раньше скобки включались обрывом: ровно 0% на четырёх звёздах и 79,9% на пятой,
// потому что до пятой генератор сам переворачивал знак и показывал «7 + 3».
test('скобки нарастают со звездой, а не включаются разом', () => {
    const N = 80000;
    for (let lvl = 1; lvl <= 5; lvl++) {
        let par = 0;
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            if (e.text.indexOf('(') >= 0) par++;
        }
        const got = par / N, want = G.NEG_PAREN_SHARE[lvl];
        assert(Math.abs(got - want) < 0.015,
            `${lvl}★: скобок ${(got * 100).toFixed(1)}% вместо ${(want * 100)}%`);
    }
});

// Проверки выше сверяют генератор с ЕГО ЖЕ таблицами — они ловят расхождение кода
// с настройкой, но не саму настройку: поменяй таблицу, и проверка поедет следом.
// Поэтому здесь отдельно закреплена ФОРМА, ради которой всё делалось. Мутации
// «скобки снова обрывом», «минимум снова единица» и «потолки как у положительных»
// проходили мимо, пока этих трёх проверок не было.
test('форма: скобки появляются до пятой звезды и на пятой не подавляют счёт', () => {
    const N = 60000;
    const share = (lvl) => {
        let par = 0;
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            if (e.text.indexOf('(') >= 0) par++;
        }
        return par / N;
    };
    const v = [1, 2, 3, 4, 5].map(share);
    assert(v[3] > 0.05, `на 4★ скобок ${(v[3] * 100).toFixed(1)}% — запись сваливается на голову разом`);
    assert(v[3] < v[4] - 0.1, `4★ и 5★ по скобкам почти совпали: ${v[3]} и ${v[4]}`);
    assert(v[4] > 0.35 && v[4] < 0.65,
        `на 5★ скобок ${(v[4] * 100).toFixed(1)}% — либо мало, либо звезда перестаёт быть про счёт`);
});

test('форма: мелких операндов нет нигде, а минимум растёт со звездой', () => {
    const N = 40000;
    const smallest = (lvl) => {
        let m = Infinity;
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            const { x, y } = negParts(e);
            m = Math.min(m, Math.abs(x), Math.abs(y));
        }
        return m;
    };
    const v = [1, 2, 3, 4, 5].map(smallest);
    assert(v[0] >= 3, `на 1★ встретился операнд ${v[0]} — «−10 + 1» считать не надо`);
    for (let i = 1; i < 5; i++) {
        assert(v[i] >= v[i - 1], `минимум упал со звездой: ${v[i - 1]} -> ${v[i]}`);
    }
    assert(v[4] >= 10, `на 5★ минимальный операнд ${v[4]}`);
});

test('форма: потолки отрицательных ниже положительных', () => {
    const N = 40000;
    const biggest = (lvl) => {
        let m = 0;
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            const { x, y } = negParts(e);
            m = Math.max(m, Math.abs(x), Math.abs(y));
        }
        return m;
    };
    [3, 4, 5].forEach(lvl => {
        const got = biggest(lvl), pos = G.ADD_SUB_RANGE[lvl];
        assert(got < pos, `${lvl}★: потолок отрицательных ${got}, у положительных ${pos} — упор должен быть на знак, а не на разрядность`);
    });
    assert(biggest(1) <= 10, 'первая звезда переросла десяток');
});

test('скобки стоят только вокруг отрицательного второго числа', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            if (e.text.indexOf('(') >= 0) {
                assert(e.b < 0, `скобки вокруг неотрицательного: ${e.text}`);
                assert(e.text.indexOf('(' + e.b + ')') >= 0, `скобки не на месте: ${e.text}`);
            }
        }
    }
});

test('ответ сходится с записью примера', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        for (let i = 0; i < 20000; i++) {
            const a = G.genAddNegative(lvl);
            assert(a.answer === a.a + a.b, `сложение: ${a.text} даёт ${a.answer}`);
            const b = G.genSubNegative(lvl);
            assert(b.answer === b.a - b.b, `вычитание: ${b.text} даёт ${b.answer}`);
        }
    }
});

// До правки на первой звезде 48,5% примеров содержали операнд не больше двойки —
// «−10 + 1» считать не надо. Потолки при этом СВОИ, ниже положительных.
test('модули не ниже минимума и не выше потолка звезды', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
        const R = G.NEG_ADD_RANGE[lvl], MIN = G.NEG_ADD_MIN[lvl];
        for (let i = 0; i < 20000; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            const { x, y } = negParts(e);
            assert(Math.abs(x) >= MIN && Math.abs(y) >= MIN, `${lvl}★: слишком мелкий операнд в ${e.text}`);
            assert(Math.abs(x) <= R && Math.abs(y) <= R, `${lvl}★: операнд выше потолка в ${e.text}`);
            assert(Math.abs(e.answer) <= R, `${lvl}★: ответ выше потолка: ${e.text} = ${e.answer}`);
        }
    }
});

// Знак первого числа фиксируется намеренно. Без этого четверть первой звезды
// оказывалась вообще не про отрицательные числа: примеры вроде «9 − 4 = 5».
test('примеры без единого отрицательного числа — редкость', () => {
    const N = 80000;
    for (let lvl = 1; lvl <= 5; lvl++) {
        let none = 0;
        for (let i = 0; i < N; i++) {
            const e = Math.random() < 0.5 ? G.genAddNegative(lvl) : G.genSubNegative(lvl);
            if (e.text.indexOf('-') < 0 && e.answer >= 0) none++;
        }
        assert(none / N < 0.04, `${lvl}★: без единого минуса ${(100 * none / N).toFixed(1)}%`);
    }
});

// Пары модулей для «сложения модулей» перечисляются, а не разыгрываются
// последовательно: розыгрыш «второе из остатка» сужает выбор вслед за первым, и на
// краю остаётся единственный вариант — «−7 − 3» забирал 9,5% первой звезды.
test('на первой звезде ни один пример не забирает больше двадцатой части', () => {
    const N = 200000, seen = {};
    for (let i = 0; i < N; i++) {
        const e = Math.random() < 0.5 ? G.genAddNegative(1) : G.genSubNegative(1);
        seen[e.text] = (seen[e.text] || 0) + 1;
    }
    const top = Math.max(...Object.values(seen)) / N;
    assert(top < 0.05, `самый частый пример 1★ берёт ${(top * 100).toFixed(1)}%`);
    assert(Object.keys(seen).length >= 100, `на 1★ всего ${Object.keys(seen).length} разных примеров`);
});

// ---------- итог ----------
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
    console.log(`Все проверки пройдены: ${passed}`);
    process.exit(0);
} else {
    console.log(`Провалено: ${failed} из ${passed + failed}`);
    failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`));
    process.exit(1);
}
