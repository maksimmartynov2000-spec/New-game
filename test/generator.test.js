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
                         + '\n;globalThis.MISTAKE_SHORT = MISTAKE_SHORT;',
                    sandbox, { filename: 'index.html<script>' });
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
