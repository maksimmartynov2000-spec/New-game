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
const meta = (op, level) => ({ category: 'integer', opKey: op, level: level || 3, isNegative: false });

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
