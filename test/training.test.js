// Тесты режима обучения: подсказка до ответа и цена, которую за неё платят.
//
// Главное, что здесь стережётся, — ОТВЕТЫ С ПОДСКАЗКОЙ НЕ ИДУТ В СТАТИСТИКУ.
// Пример решён при подсказке на экране, и засчитывать такое значит портить те
// самые цифры, ради которых заведены лесенки, точность и скорость. Ошибка была бы
// совершенно тихой: убери кто-нибудь одну проверку — всё продолжит работать, просто
// у детей начнут расти медали за решённое с подсказкой. Ни экран, ни другой тест
// этого не увидят, поэтому проверка смотрит на сам код обработчика ответа.
//
// Второе — сами подсказки. Их правило: останавливаться ЗА ШАГ ДО ОТВЕТА. Дважды
// оно уже нарушалось (пятёрки и четвёрки выдавали результат целиком), и оба раза
// это заметил человек, а не тест. Теперь считает тест — по всей таблице умножения.
//
// Как запускать:  node test/training.test.js

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

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }

// Живые функции выбора приёма — из кода приложения, не переписанные сюда.
function loadPicker() {
    const box = { window: {} };
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content/hints.js'), 'utf8'), box);
    vm.runInContext(
        fs.readFileSync(path.join(ROOT, 'js/topics.js'), 'utf8')
        // structuralClassOf зовёт unitsClass из генератора. Без неё выбор приёма
        // у сложения и вычитания молча падал в try/catch, и проверки проходили
        // впустую — на пустой строке любое утверждение о подстановках верно.
        + slice('function unitsClass', 'function pickByShare', 'unitsClass')
        + 'const LANG = "ru";'
        + slice('function resolveTricks', '\n// Готовая строка для экрана', 'выбор приёма')
        + slice('function trickHint', '\n// ===', 'сборка строки')
        + ';globalThis.R = { trickPick, trickHint, mulClassOf };', box);
    return box.R;
}
// Приём ВМЕСТЕ с настоящим генератором. Перебор по всем парам чисел отвечает на
// вопрос «может ли подсказка выдать ответ», а этот загрузчик — на вопрос «выдаёт ли
// она его на том, что ученик реально видит». Второй вопрос важнее: именно на нём
// 1★ вычитания оказалось стопроцентной утечкой, хотя по всем парам доля была 10%.
function loadWithGenerator() {
    const stubEl = () => ({ style: {}, dataset: {}, innerHTML: '', innerText: '', value: '',
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {}, removeChild() {}, remove() {}, addEventListener() {}, setAttribute() {},
        getAttribute: () => null, querySelector: () => stubEl(), querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
    const box = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN,
        parseInt, parseFloat, RegExp,
        document: { getElementById: () => stubEl(), querySelectorAll: () => [],
                    querySelector: () => stubEl(), addEventListener() {},
                    createElement: () => stubEl(), body: stubEl() },
        window: { addEventListener() {}, innerWidth: 400, innerHeight: 800 }, navigator: {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setInterval: () => 0, setTimeout: () => 0, clearInterval() {}, requestAnimationFrame: () => 0
    };
    box.globalThis = box;
    vm.createContext(box);
    const MARKER = '// ===================== ПАЗЛ: ГЕНЕРАЦИЯ КУСОЧКОВ (jigsaw)';
    const inline = require('./app-source').inlineScript(HTML);
    const files = require('./app-source').CODE_FILES
        .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n';
    vm.runInContext(files + inline.slice(0, inline.indexOf(MARKER)), box);
    // structuralClassOf, trickPick и trickHint объявлены НИЖЕ метки обрыва — они нужны
    // экранам, а не генератору. Достаём каждую по телу функции.
    ['structuralClassOf', 'trickPick', 'trickHint', 'resolveTricks'].forEach(name => {
        const from = SCRIPT.indexOf('function ' + name + '(');
        if (from < 0) throw new Error('не найдена функция ' + name);
        let depth = 0, to = SCRIPT.indexOf('{', from);
        for (let i = to; i < SCRIPT.length; i++) {
            if (SCRIPT[i] === '{') depth++;
            else if (SCRIPT[i] === '}' && --depth === 0) { to = i + 1; break; }
        }
        vm.runInContext(SCRIPT.slice(from, to) + ';globalThis.' + name + ' = ' + name + ';', box);
    });
    vm.runInContext('globalThis.LANG = "ru";', box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content/hints.js'), 'utf8'), box);
    return box;
}

const meta = (op, level) => ({ category: 'integer', opKey: op, level: level || 3, isNegative: false });

// Печатает ли подсказка сам пример вместе с его ответом? Это и есть «списал, а не решил».
function givesAnswer(a, b, op, txt) {
    const answer = op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : a / b;
    return new RegExp('(^|\\D)' + a + '\\s*[−+×÷*\\-]\\s*' + b + '\\s*=\\s*' + answer + '(\\D|$)')
        .test(txt);
}

console.log('\nРежим обучения');

// ============ Цена режима ============

const ANSWER = slice('function checkAnswer(chosen, event)', 'function spawnRewardText', 'обработчик ответа');

// Всё, что пишет в прогресс или выдаёт награду, обязано стоять под проверкой режима.
test('в обработчике ответа каждая запись в прогресс закрыта проверкой режима', () => {
    const guarded = ['Progress.recordAnswer', 'Progress.recordClass', 'Progress.recordMistakeKind',
                     'addPuzzlePiece(', 'evaluateTopicLadders('];
    const lines = ANSWER.split('\n');
    const naked = [];
    lines.forEach((line, i) => {
        const hit = guarded.filter(g => line.indexOf(g) >= 0);
        if (!hit.length) return;
        // Проверка режима стоит на этой же строке или в пределах четырёх строк выше.
        const near = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
        if (near.indexOf('trainActive') < 0) naked.push(`${hit.join('/')} — строка ${i + 1}`);
    });
    eq(naked.join('; '), '',
        'запись в прогресс без проверки режима обучения: ' + naked.join('; ')
        + '. Ответы с подсказкой в статистику не идут — это решение, а не недосмотр.');
});

// Обратная сторона: дневная цель их засчитывает, иначе режим рвал бы серию дней
// и им бы просто не пользовались.
test('верный ответ в режиме обучения пишет дневную цель', () => {
    assert(/trainActive\)\s*Progress\.recordTrainingAnswer\(\)/.test(ANSWER),
        'recordTrainingAnswer не вызывается под проверкой режима');
    const rec = slice('recordTrainingAnswer()', 'recordPuzzleCompleted', 'запись обучения');
    assert(rec.indexOf('touchDay().tr++') > 0, 'recordTrainingAnswer не пишет счётчик дня');
    const forbidden = ['byTopic', 'totals', 'recordClass', 'day.c', 'slot'];
    const hit = forbidden.filter(f => rec.indexOf(f) >= 0);
    eq(hit.join(', '), '', `recordTrainingAnswer трогает лишнее: ${hit.join(', ')}`);
});

test('дневная цель и заморозки считают обучение одним и тем же правилом', () => {
    const fn = slice('function dayGoalDone', 'function dailyProgress', 'dayGoalDone');
    assert(/day\.c/.test(fn) && /day\.tr/.test(fn), 'dayGoalDone не складывает c и tr');
    const streak = slice('function streakState', 'function currentStreak', 'серия');
    assert(streak.indexOf('dayGoalDone(') > 0,
        'заморозки считают по d[k].c напрямую — разойдутся с полоской цели');
});

test('режим фиксируется на старте миссии и в миссии не меняется', () => {
    const start = slice('function startGame() {', 'function resizeCanvas', 'startGame');
    assert(/trainActive\s*=\s*trainWanted/.test(start), 'startGame не фиксирует режим');
    const gen = slice('function generateMath()', 'const isNegative', 'generateMath');
    assert(gen.indexOf('trainActive =') < 0, 'режим переписывается по ходу миссии');
});

// ============ Сами подсказки ============

// Та самая ошибка, которую поймал человек: подсказка выдавала ответ целиком.
// Проверяем по всей таблице — это 100 клеток, перебрать их дешевле, чем надеяться.
test('подсказка умножения никогда не выдаёт произведение', () => {
    const R = loadPicker();
    const bad = [];
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
        const txt = R.trickHint(meta('mul'), { a, b });
        if (!txt) continue;
        const product = a * b;
        if (new RegExp('(^|\\D)' + product + '(\\D|$)').test(txt)) {
            bad.push(`${a}×${b}=${product}: «${txt}»`);
        }
    }
    eq(bad.join(' | '), '', 'подсказка содержит готовый ответ: ' + bad.join(' | '));
});

test('у каждого примера таблицы есть приём, кроме ×1 и ×0', () => {
    const R = loadPicker();
    const silent = [];
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
        if (!R.trickHint(meta('mul'), { a, b })) silent.push(`${a}×${b}`);
    }
    // Молчим ровно там, где приёма нет: один из множителей — единица.
    const unexpected = silent.filter(k => k.split('×').every(n => Number(n) !== 1));
    eq(unexpected.join(', '), '', `остались без приёма: ${unexpected.join(', ')}`);
});

// Ядро: три правила на шесть примеров, и у каждого свой самый короткий путь.
test('ядро 6·7·8 разбирается по правилу выбора', () => {
    const R = loadPicker();
    const want = {
        '6x6': 'mul:core6', '6x7': 'mul:core6', '6x8': 'mul:core6',
        '7x8': 'mul:core8', '8x8': 'mul:core8', '7x7': 'mul:core7'
    };
    Object.keys(want).forEach(k => {
        const [a, b] = k.split('x').map(Number);
        eq(R.mulClassOf(a, b), 'core', `${k} должен быть ядром`);
        eq(R.trickPick(meta('mul'), { a, b }).key, want[k], `правило для ${k}`);
        eq(R.trickPick(meta('mul'), { a: b, b: a }).key, want[k], `правило для ${b}×${a} — то же`);
    });
});

// Достраиваем до круглого БОЛЬШЕЕ число. У 25 + 80 от двадцати пяти до сотни не
// хватает 75, и ученику пришлось бы считать 80 − 75 — тяжелее самого примера.
test('сложение достраивает большее число, а не первое', () => {
    const R = loadPicker();
    const pick = R.trickPick(meta('add', 5), { a: 25, b: 80 });
    assert(pick, 'подсказки нет вовсе');
    eq(pick.args[0], 100, 'круглое');
    eq(pick.args[1], 20, 'сколько не хватает');
    eq(pick.args[2], 25, 'откуда брать');
    // И в обратном порядке слагаемых ответ тот же.
    eq(JSON.stringify(R.trickPick(meta('add', 5), { a: 80, b: 25 }).args), JSON.stringify(pick.args));
});

// 68 + 57 — это и «полный переход», и «через сотню». Первая подсказка доведёт
// только до семидесяти, а трудность здесь — сотня.
test('вторая ось важнее основного класса', () => {
    const R = loadPicker();
    eq(R.trickPick(meta('add', 5), { a: 68, b: 57 }).key, 'add:h', 'сложение через сотню');
    eq(R.trickPick(meta('sub', 5), { a: 123, b: 45 }).key, 'sub:h', 'двойной заём');
});

test('где приёма нет, подсказки нет', () => {
    const R = loadPicker();
    const nothing = [
        ['add', { a: 23, b: 41 }, 'сложение без перехода'],
        ['sub', { a: 48, b: 23 }, 'вычитание без заёма'],
        ['mul', { a: 7, b: 1 }, 'умножение на единицу'],
        ['div', { a: 8, b: 1 }, 'деление на единицу'],
        ['div', { a: 40, b: 10 }, 'деление на десять']
    ];
    nothing.forEach(([op, p, what]) => {
        eq(R.trickHint(meta(op, 3), p), '', `${what}: подсказки быть не должно`);
    });
});

// ============ Подсказка не выдаёт ответ. Все четыре действия ============
//
// Эта проверка была написана ТОЛЬКО для умножения — и потому вычитание почти два
// месяца печатало ученику готовый ответ. На 1★ в 100% подсказок, на 2★ в 94,6%.
// Нашёл это Максим на уроке с учеником, а не тест. Теперь считаются все четыре
// действия, и двумя способами сразу.

test('ни одна подсказка не печатает пример вместе с ответом', () => {
    const R = loadPicker();
    const bad = [];
    [['add', 5], ['sub', 5], ['mul', 5], ['div', 5]].forEach(([op, maxLvl]) => {
        for (let lvl = 1; lvl <= maxLvl; lvl++) {
            for (let a = 0; a <= 200; a++) for (let b = 0; b <= 100; b++) {
                const answer = op === 'add' ? a + b : op === 'sub' ? a - b
                             : op === 'mul' ? a * b : (b ? a / b : null);
                if (answer === null || !Number.isInteger(answer) || answer < 0) continue;
                let txt = '';
                try { txt = R.trickHint(meta(op, lvl), { a, b }); } catch (e) { continue; }
                if (txt && givesAnswer(a, b, op, txt)) bad.push(`${a} ${op} ${b}: «${txt}»`);
            }
        }
    });
    eq([...new Set(bad)].slice(0, 5).join(' | '), '',
        'подсказка печатает пример и ответ целиком: ' + [...new Set(bad)].slice(0, 5).join(' | '));
});

// Перебор выше отвечает «может ли». Этот — «выдаёт ли на том, что ученик видит».
// Разница огромна: по всем парам утечка была 10%, а на 1★ вычитания — 100%, потому
// что генератор там выдаёт только примеры вида 10 − b.
test('на настоящих примерах генератора подсказка тоже не выдаёт ответ', () => {
    const G = loadWithGenerator();
    const bad = [];
    const N = 4000;
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) {
            for (let i = 0; i < N; i++) {
                const p = G.generateProblem(op, lvl, false);
                if (!p || typeof p.a !== 'number' || typeof p.b !== 'number') continue;
                let txt = '';
                try { txt = G.trickHint(meta(op, lvl), p); } catch (e) { continue; }
                if (txt && givesAnswer(p.a, p.b, op, txt)) {
                    bad.push(`${op} ${lvl}★: ${p.a} ${op} ${p.b} → «${txt}»`);
                }
            }
        }
    });
    eq([...new Set(bad)].slice(0, 5).join(' | '), '',
        'на живых примерах подсказка выдаёт ответ: ' + [...new Set(bad)].slice(0, 5).join(' | '));
});

// Вычитание через сотню: тот же слабый случай, что у спуска к десятку. 101 − 51 = 50,
// и остаток «потом ещё 50» тоже 50. Раньше это оставалось намеренно — я считал, что
// защита даст молчание. Счёт показал другое: переворот в сложение подхватывает эти
// случаи, и молчания не появляется ни одного.
test('вычитание через сотню не оставляет ответ последним числом', () => {
    const R = loadPicker();
    const bad = [];
    for (let a = 100; a <= 400; a++) for (let b = 1; b <= Math.min(a, 200); b++) {
        let pick = null;
        try { pick = R.trickPick(meta('sub', 5), { a, b }); } catch (e) { continue; }
        if (!pick || pick.key !== 'sub:h') continue;
        if (pick.args[2] === a - b) {
            bad.push(`${a} − ${b} = ${a - b}: «${R.trickHint(meta('sub', 5), { a, b })}»`);
        }
    }
    eq(bad.slice(0, 5).join(' | '), '',
        'остаток совпал с ответом: ' + bad.slice(0, 5).join(' | '));
    // И подсказка при этом не пропала.
    eq(R.trickHint(meta('sub', 5), { a: 101, b: 51 }), '51 плюс что, чтобы получить 101?');
    // А там, где остаток честный, приём остался прежним.
    eq(R.trickPick(meta('sub', 5), { a: 123, b: 45 }).key, 'sub:h');
});

// Подсказку можно выдать и не печатая пример целиком: достаточно, чтобы на экране
// оказалось число, равное ответу. У спуска до десятка это ровно один случай —
// 14 − 9 → «Отними 4 — дойдёшь до 10. Потом ещё 5», где 5 и есть ответ. Ребёнку,
// который просто читает последнее число, считать уже нечего.
//
// Числа САМОГО примера не в счёт: у переворота 10 − 5 печатаются 5 и 10, то есть
// условие своими словами, и совпадение с ответом ничего не выдаёт.
//
// Вычитание через сотню (sub:h) сюда не входит НАМЕРЕННО: у него тот же слабый
// случай (101 − 51 → «…Потом ещё 50»), около 1% его срабатываний, и закрыть его
// той же защитой значит получить молчание — Максим это решение ещё не принимал.
test('спуск до десятка не оставляет ответ последним числом', () => {
    const R = loadPicker();
    const bad = [];
    for (let a = 0; a <= 200; a++) for (let b = 0; b <= Math.min(a, 100); b++) {
        let pick = null;
        try { pick = R.trickPick(meta('sub', 5), { a, b }); } catch (e) { continue; }
        if (!pick || (pick.key !== 'sub:ten' && pick.key !== 'sub:toAdd')) continue;
        const answer = a - b;
        const чужое = pick.args.filter(v => v !== a && v !== b);   // всё, кроме чисел примера
        if (чужое.indexOf(answer) >= 0) {
            bad.push(`${a} − ${b} = ${answer}: «${R.trickHint(meta('sub', 5), { a, b })}»`);
        }
    }
    eq(bad.slice(0, 5).join(' | '), '',
        'подсказка печатает ответ отдельным числом: ' + bad.slice(0, 5).join(' | '));
});

// Починка не должна была отобрать подсказку там, где она и так была честной: приём
// «займи десяток» у 23 − 7 показывает 13 − 7 = 6, а ответ 16 — ничего не выдано.
test('честные подсказки вычитания не тронуты', () => {
    const R = loadPicker();
    [[23, 7], [34, 18], [52, 27]].forEach(([a, b]) => {
        const pick = R.trickPick(meta('sub', 5), { a, b });
        assert(pick, `${a} − ${b}: подсказка пропала`);
        eq(pick.key, 'sub:borrow', `${a} − ${b}: приём подменили`);
    });
});

// Молчание — тоже потеря. До правки на 1★ подсказка была у каждого примера с заёмом,
// и после правки должна остаться у каждого: мы меняли ПРИЁМ, а не выключали режим.
test('вычитание не стало молчаливее, чем было', () => {
    const G = loadWithGenerator();
    const silent = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
        let сзаёмом = 0, сподсказкой = 0;
        for (let i = 0; i < 3000; i++) {
            const p = G.generateProblem('sub', lvl, false);
            const st = G.structuralClassOf(meta('sub', lvl), p);
            if (!st || (st.cls !== '1' && st.cls !== '2') || st.extra === 'h') continue;
            сзаёмом++;
            if (G.trickHint(meta('sub', lvl), p)) сподсказкой++;
        }
        if (сзаёмом && сподсказкой < сзаёмом) {
            silent.push(`${lvl}★: из ${сзаёмом} примеров с заёмом подсказка у ${сподсказкой}`);
        }
    }
    eq(silent.join(' | '), '', 'подсказка исчезла там, где была: ' + silent.join(' | '));
});

// Три приёма вычитания и повод для каждого. Значения проверены руками на бумаге.
test('приём вычитания выбирается по поводу, а не наугад', () => {
    const R = loadPicker();
    const want = [
        [10, 6, 'sub:toAdd', 'число круглое — спускаться некуда'],
        [20, 16, 'sub:toAdd', 'круглое и двузначное вычитаемое'],
        [14, 9, 'sub:toAdd', 'остаток спуска совпал бы с ответом'],
        [64, 57, 'sub:toAdd', 'остаток спуска был бы 53 — тяжелее примера'],
        [12, 4, 'sub:ten', 'спуск до десятка чистый'],
        [16, 9, 'sub:ten', 'спуск до десятка чистый'],
        [23, 7, 'sub:borrow', 'шаг не равен ответу — приём остаётся прежним']
    ];
    want.forEach(([a, b, key, why]) => {
        const pick = R.trickPick(meta('sub', 5), { a, b });
        assert(pick, `${a} − ${b}: подсказки нет вовсе (${why})`);
        eq(pick.key, key, `${a} − ${b} (${why})`);
    });
    // И сами строки: числа обязаны быть из его примера.
    eq(R.trickHint(meta('sub', 5), { a: 12, b: 4 }), 'Отними 2 — дойдёшь до 10. Потом ещё 2');
    eq(R.trickHint(meta('sub', 5), { a: 10, b: 6 }), '6 плюс что, чтобы получить 10?');
});

// ============ ОТРИЦАТЕЛЬНЫЕ ============
//
// Режим обучения на отрицательных МОЛЧАЛ: замер по генератору дал 0% подсказок у
// сложения и вычитания на всех пяти звёздах и 3–5% у умножения. Приёмы разбирали
// класс примера ('1', '2', 'h'), а у отрицательных классы другие — 'same', 'near',
// 'cross', — и ни одна ветка не срабатывала. Ни один тест этого не видел: проверки
// выше зовут picker только с isNegative: false.

const negMeta = (op, level) => ({ category: 'integer', opKey: op, level: level || 3, isNegative: true });

test('у отрицательных сложение и вычитание больше не молчат', () => {
    const G = loadWithGenerator();
    const молчит = [];
    ['add', 'sub'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) {
            let всего = 0, есть = 0;
            for (let i = 0; i < 2000; i++) {
                const p = G.generateProblem(op, lvl, true);
                if (!p || typeof p.answer !== 'number') continue;
                всего++;
                if (G.trickHint(negMeta(op, lvl), p)) есть++;
            }
            // Молчим только там, где правила знаков нет: слагаемое равно нулю или
            // числа гасят друг друга. На живом генераторе это доли процента.
            if (есть < всего * 0.95) молчит.push(`${op} ${lvl}★: ${есть} из ${всего}`);
        }
    });
    eq(молчит.join(' | '), '', 'подсказки нет почти нигде: ' + молчит.join(' | '));
});

test('у отрицательных умножение тоже не молчит', () => {
    const G = loadWithGenerator();
    const молчит = [];
    for (let lvl = 1; lvl <= 5; lvl++) {
        let всего = 0, есть = 0;
        for (let i = 0; i < 2000; i++) {
            const p = G.generateProblem('mul', lvl, true);
            if (!p || typeof p.answer !== 'number') continue;
            всего++;
            if (G.trickHint(negMeta('mul', lvl), p)) есть++;
        }
        // Порог ниже, чем у сложения: ×1, ×0 и три множителя приёма не имеют,
        // и на пятой звезде троек особенно много.
        if (есть < всего * 0.6) молчит.push(`${lvl}★: ${есть} из ${всего}`);
    }
    eq(молчит.join(' | '), '', 'умножение отрицательных молчит: ' + молчит.join(' | '));
});

test('приём отрицательных выбирается по правилу знаков', () => {
    const R = loadPicker();
    const пример = (a, b, answer) => ({ a, b, answer, text: `${a} + ${b}` });
    const want = [
        // Знаки одинаковые — модули складываются.
        [pair(-8, -6, -14), 'neg:same', 'оба со знаком минус'],
        // Знаки разные — из большего модуля вычитаем меньший.
        [pair(-14, 13, -1), 'neg:diff', 'минус больше по модулю'],
        [pair(-9, 21, 12), 'neg:diff', 'плюс больше по модулю'],
        // Модули равны — гасят друг друга, вычитать нечего.
        [pair(-7, 7, 0), null, 'взаимно уничтожаются']
    ];
    function pair(a, b, answer) { return { a, b, answer, text: `${a} + ${b}` }; }
    want.forEach(([p, key, why]) => {
        const pick = R.trickPick(negMeta('add', 3), p);
        if (key === null) { assert(!pick, `${p.text}: подсказки быть не должно (${why})`); return; }
        assert(pick, `${p.text}: подсказки нет вовсе (${why})`);
        eq(pick.key, key, `${p.text} (${why})`);
    });
    // Знак берётся у большего по модулю — и печатается СО ЗНАКОМ.
    eq(R.trickHint(negMeta('add', 3), pair(-14, 13, -1)),
       'Знаки разные: из 14 вычти 13, а знак возьми у -14');
    eq(R.trickHint(negMeta('add', 3), pair(-8, -6, -14)),
       'Знаки одинаковые: сложи 8 и 6, знак оставь тот же');
    // Умножение: правило знаков плюс счёт модулей.
    eq(R.trickPick(negMeta('mul', 3), { a: -7, b: -8, answer: 56 }).key, 'neg:mulSame');
    eq(R.trickPick(negMeta('mul', 3), { a: -7, b: 8, answer: -56 }).key, 'neg:mulDiff');
});

test('ни одна подсказка отрицательных не печатает ответ', () => {
    const G = loadWithGenerator();
    const bad = [];
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) {
            for (let i = 0; i < 1500; i++) {
                const p = G.generateProblem(op, lvl, true);
                if (!p || typeof p.answer !== 'number') continue;
                let pick = null, txt = '';
                try { pick = G.trickPick(negMeta(op, lvl), p); txt = G.trickHint(negMeta(op, lvl), p); }
                catch (e) { continue; }
                if (!txt || !pick) continue;
                // Числа самого примера не в счёт: они и так на экране.
                const своё = [p.a, p.b, Math.abs(p.a), Math.abs(p.b)];
                const чужое = pick.args.filter(v => typeof v === 'number' && своё.indexOf(v) < 0);
                if (чужое.indexOf(p.answer) >= 0 || чужое.indexOf(Math.abs(p.answer)) >= 0) {
                    bad.push(`${p.text} = ${p.answer} → «${txt}»`);
                }
            }
        }
    });
    eq([...new Set(bad)].slice(0, 5).join(' | '), '',
        'подсказка печатает ответ: ' + [...new Set(bad)].slice(0, 5).join(' | '));
});

test('деление круглых не оставляет ответ последним числом', () => {
    // «Убери по нулю: 4 ÷ 2» у примера 40 ÷ 20: двойка и есть ответ. Та же болезнь,
    // что была у спуска к десятку и у вычитания через сотню, и лечится так же —
    // уходом в общий приём, без молчания.
    const R = loadPicker();
    const bad = [];
    [false, true].forEach(isNeg => {
        const m = isNeg ? negMeta('div', 5) : meta('div', 5);
        for (let a = -960; a <= 960; a += 10) for (let b = -90; b <= 90; b += 10) {
            if (!b || a === 0 || a % b !== 0) continue;
            let pick = null;
            try { pick = R.trickPick(m, { a, b, answer: a / b }); } catch (e) { continue; }
            if (!pick || pick.key !== 'div:round') continue;
            if (Math.abs(pick.args[1]) === Math.abs(a / b)) bad.push(`${a} ÷ ${b} = ${a / b}`);
        }
    });
    eq(bad.slice(0, 5).join(' | '), '', 'сокращённый делитель совпал с ответом: ' + bad.slice(0, 5).join(' | '));
});

// Подсказка обязана говорить числами ЕГО примера. Шаблон, доехавший до экрана
// с неподставленной %1, хуже молчания.
test('в готовой строке не остаётся неподставленных мест', () => {
    const R = loadPicker();
    const bad = [];
    [['add', 5], ['sub', 5], ['mul', 3], ['div', 3]].forEach(([op, lvl]) => {
        for (let a = 0; a <= 130; a++) for (let b = 0; b <= 12; b++) {
            const p = { a, b, answer: op === 'add' ? a + b : a - b };
            let txt = '';
            try { txt = R.trickHint(meta(op, lvl), p); } catch (e) { bad.push(`${a}${op}${b}: упало`); continue; }
            if (/%\d/.test(txt)) bad.push(`${a} ${op} ${b}: «${txt}»`);
        }
    });
    eq(bad.slice(0, 5).join(' | '), '', 'остались места подстановки: ' + bad.slice(0, 5).join(' | '));
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
