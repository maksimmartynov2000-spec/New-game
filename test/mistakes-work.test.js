// Тесты работы над ошибками.
//
// Главное, что здесь стережётся, — ОТВЕТЫ В РАБОТЕ НАД ОШИБКАМИ НЕ ИДУТ В
// СТАТИСТИКУ. Решение принято осознанно: пример в работе уже виден вместе со
// своими вариантами, ученик только что читал его в разборе, и попадание со
// второго раза не говорит о том, умеет он или нет. Засчитывать такое — значит
// портить те самые цифры, ради которых заведены лесенки, точность и скорость.
//
// Ошибка тут была бы совершенно тихой: добавь кто-нибудь в обработчик нажатия
// привычный Progress.recordAnswer — и всё продолжит работать, просто у детей
// начнёт расти точность от переделанных примеров. Ни экран, ни другой тест
// этого не увидят. Поэтому проверка смотрит на сам код режима.
//
// Как запускать:  node test/mistakes-work.test.js

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

// Весь код режима работы: от заголовка раздела до общей отрисовки экрана.
const WORK = slice('// ===================== РАБОТА НАД ОШИБКАМИ',
                   'function renderMistakesScreen', 'режим работы');

console.log('\nРабота над ошибками');

test('срез режима работы найден и не пустой', () => {
    assert(WORK.length > 1500, `срез подозрительно мал: ${WORK.length} символов`);
    assert(WORK.indexOf('function pickMistakeAnswer') > 0, 'в срезе нет обработчика нажатия');
});

// Вот она, та самая проверка.
test('режим работы не трогает Progress ни одним вызовом', () => {
    const calls = [...WORK.matchAll(/Progress\s*\.\s*([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
    eq(calls.join(', '), '',
        'работа над ошибками зовёт Progress: ' + calls.join(', ')
        + '. Повторные ответы в статистику не идут — это решение, а не недосмотр.');
});

// Записать можно не только через Progress: рядом живут функции самой миссии,
// которые ведут счётчики сессии и в конце сливают их в прогресс.
test('режим работы не зовёт учёт самой миссии', () => {
    const forbidden = ['recordAnswer', 'recordClass', 'registerAnswer', 'bumpDaily',
                       'correctCount', 'wrongCount', 'rememberMistake', 'persistLocal'];
    const hit = forbidden.filter(name => new RegExp('\\b' + name + '\\b').test(WORK));
    eq(hit.join(', '), '', `в работе над ошибками встретился учёт: ${hit.join(', ')}`);
});

// Подпись над списком — три разных состояния, и каждое легко потерять при правке.
test('подпись считает исправленные верно', () => {
    const box = { t: (x) => x, tf: (x, ...a) => a.reduce((s, v, i) => s.split('%' + (i + 1)).join(v), x) };
    vm.createContext(box);
    vm.runInContext(slice('function mistakeWorkSubtitle', 'function refreshMistakeWorkHead', 'подпись')
        + ';globalThis.f = mistakeWorkSubtitle;', box);
    const f = box.f;
    eq(f([]), 'Ошибок не было', 'пустой список');
    eq(f([{ fixed: false }, { fixed: false }]), 'Исправлено: 0 из 2', 'ничего не исправлено');
    eq(f([{ fixed: true }, { fixed: false }]), 'Исправлено: 1 из 2', 'половина');
    eq(f([{ fixed: true }, { fixed: true }]), 'Все исправлены', 'всё исправлено');
});

// Порядок вариантов перемешивается: иначе работа над ошибками превращается в
// «вспомни, где стояла зелёная клетка» — разбор ученик только что пролистал.
test('порядок вариантов — перестановка, а не тот же список', () => {
    const box = {};
    vm.createContext(box);
    vm.runInContext(slice('function shuffledOptionOrder', 'function startMistakeWork', 'перемешивание')
        + ';globalThis.f = shuffledOptionOrder;', box);
    for (let i = 0; i < 50; i++) {
        const order = box.f(4);
        eq(order.length, 4, 'длина перестановки');
        eq([...order].sort().join(','), '0,1,2,3', 'перестановка потеряла или продублировала вариант');
    }
    // И она действительно перемешивает: за сто попыток хоть раз должна отличаться.
    const moved = Array.from({ length: 100 }, () => box.f(4).join(',')).some(s => s !== '0,1,2,3');
    assert(moved, 'порядок никогда не меняется — перемешивания нет');
});

// Уходя с итогов, миссию обнуляют. Режим должен обнуляться вместе с ней, иначе
// следующий разбор откроется недоделанной работой над чужими ошибками.
test('новая миссия сбрасывает режим вместе со списком', () => {
    const start = slice('function startGame() {', 'resizeCanvas()', 'startGame');
    assert(/sessionMistakes\s*=\s*\[\]/.test(start), 'startGame не чистит список ошибок');
    assert(/mistakesMode\s*=\s*'review'/.test(start), 'startGame не возвращает режим к разбору');
    assert(/mistakeWork\s*=\s*\[\]/.test(start), 'startGame не чистит состояние работы');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
