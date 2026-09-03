// Тесты подсказок по ошибкам.
//
// Зачем: это первая правка, которая живёт В ПУТИ ОТВЕТА на пример — самом горячем
// месте игры, где сейчас занимаются живые ученики. Подсказка обязана быть надстройкой:
// не собралась, файла нет, числа не сошлись — игра идёт дальше молча. Поэтому половина
// проверок ниже не про текст, а про то, что ничего не ломается и время не остаётся
// замороженным.
//
// Вторая половина — про сами тексты: подсказка говорит числами того примера, на котором
// споткнулись, и если шаблон разъедется с аргументами, ученик увидит «Из %1 не вычесть».
// Такое лучше не показывать вовсе, и на это есть отдельная проверка.
//
// Как запускать:  node test/hints.test.js

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

function loadContent() {
    const box = { window: {} };
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content', 'hints.js'), 'utf8'), box,
        { filename: 'content/hints.js' });
    return box.window.HINT_CONTENT;
}

function makeDoc() {
    const byId = {};
    const el = (id) => (byId[id] = { id, className: '', hidden: false, _text: '', onclick: null,
        classList: { list: [], add(c) { if (!this.list.includes(c)) this.list.push(c); },
                     remove(c) { this.list = this.list.filter(x => x !== c); },
                     contains(c) { return this.list.includes(c); } },
        get innerText() { return this._text; }, set innerText(v) { this._text = String(v); } });
    ['hintFreeze', 'hintFreezeText', 'hintFreezeLabel', 'hintFreezeTap', 'timerBar',
     'hintFreezeExample', 'hintFreezeChosen'].forEach(el);
    return { doc: { getElementById: (id) => byId[id] || null }, byId };
}

// Срез с логикой подсказок. gameActive объявлен в другом месте файла — объявляем сами.
function loadHints(windowObj) {
    const box = {
        console, Math, Number, Object, Array, String, JSON,
        window: windowObj,
        LANG: 'ru',
        t: (x) => x,
        tf: function (x) { let o = x; for (let i = 1; i < arguments.length; i++) o = o.split('%' + i).join(String(arguments[i])); return o; }
    };
    const dom = makeDoc();
    box.document = dom.doc;
    const src = 'var gameActive = true;\n'
        + slice('// ===================== ПОДСКАЗКИ ПО ОШИБКАМ',
                '// ===================== ПАЗЛ: ГЕНЕРАЦИЯ КУСОЧКОВ', 'подсказки')
        + ';globalThis.R = { hintText, hintEntry, hintArgs, mulFactUsed, shouldShowHint,'
        + ' showHintFreeze, resetSessionHints, HINT_REPEAT_AT, HINT_MAX_PER_SESSION, HINT_NEVER,'
        + ' hintProblemLine, hintChosenLine,'
        + ' bump: (k) => { sessionKindCounts[k] = (sessionKindCounts[k] || 0) + 1; },'
        + ' mark: (k) => { sessionHintKinds[k] = true; sessionHintsShown++; },'
        + ' isActive: () => gameActive };';
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<подсказки>' });
    box.dom = dom;
    return box;
}

// Классификатор — отдельным срезом: новый вид «ошибка в единицах» надо проверить прямо.
function loadClassifier() {
    const box = { console, Math, Number, String, parseInt };
    const src = slice('function noBorrowSub(a, b)', '\n\n', 'noBorrowSub')
        + '\n' + slice('function classifyIntegerLike(problem, correct, chosen, opKey)',
                       '// «Дробь от числа»', 'классификатор')
        + ';globalThis.C = classifyIntegerLike;';
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<классификатор>' });
    return box.C;
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

const CONTENT = loadContent();
const LANGS = Object.keys(CONTENT);
const KEYS = Object.keys(CONTENT.ru);

group('Тексты');

test('во всех языках одни и те же виды ошибок', () => {
    LANGS.forEach(lang => {
        const keys = Object.keys(CONTENT[lang]);
        eq(keys.length, KEYS.length, `в языке ${lang} видов не столько же`);
        KEYS.forEach(k => assert(CONTENT[lang][k], `[${lang}] нет вида «${k}»`));
    });
});

test('у каждого вида обе формы и они не пустые', () => {
    LANGS.forEach(lang => KEYS.forEach(k => {
        ['game', 'review'].forEach(form => {
            const v = CONTENT[lang][k][form];
            assert(typeof v === 'string' && v.trim().length > 0, `[${lang}] «${k}» пусто: ${form}`);
        });
    }));
});

test('подстановки совпадают во всех языках', () => {
    // Разъехались номера — ученик увидит «Из %1 не вычесть» или чужое число.
    KEYS.forEach(k => ['game', 'review'].forEach(form => {
        const want = (CONTENT.ru[k][form].match(/%\d/g) || []).sort().join(',');
        LANGS.forEach(lang => {
            const got = (CONTENT[lang][k][form].match(/%\d/g) || []).sort().join(',');
            eq(got, want, `[${lang}] «${k}» ${form}: подстановки`);
        });
    }));
});

test('строка для игры короткая — она встаёт поверх примера', () => {
    LANGS.forEach(lang => KEYS.forEach(k => {
        const v = CONTENT[lang][k].game;
        assert(v.length <= 80, `[${lang}] «${k}»: ${v.length} знаков — это уже не строка`);
    }));
});

test('коды видов ошибок не переведены', () => {
    // Ключи — идентификаторы базы. Перевести их значит разорвать всю статистику.
    LANGS.forEach(lang => Object.keys(CONTENT[lang]).forEach(k => {
        assert(/[А-Яа-яЁё]/.test(k), `[${lang}] ключ «${k}» перестал быть русским кодом`);
    }));
});

group('Подстановка чисел');

const H = loadHints({ HINT_CONTENT: CONTENT });
const meta = (op) => ({ opKey: op, category: 'integer' });

test('заём: подсказка говорит цифрами примера', () => {
    const got = H.R.hintText('game', 'не занял десяток', meta('sub'), { a: 52, b: 8 }, 44, 56);
    eq(got, 'Из 2 не вычесть 8. Займи десяток: 12 − 8.');
});

test('таблица умножения: названа та клетка, которую посчитал ученик', () => {
    // 7 × 8 = 56, ученик выбрал 49 — это 7 × 7.
    const got = H.R.hintText('game', 'таблица умножения', meta('mul'), { a: 7, b: 8 }, 56, 49);
    eq(got, 'Ты посчитал 7 × 7. В примере 7 × 8 — разница целых 7.');
});

test('единицы при сложении: подставлены последние цифры', () => {
    const got = H.R.hintText('game', 'ошибка в единицах', meta('add'), { a: 24, b: 38 }, 62, 68);
    eq(got, 'Десятки сошлись. Посчитай отдельно 4 + 8.');
});

test('разбор перепутанного действия показывает оба результата', () => {
    const got = H.R.hintText('review', 'перепутал действие', meta('div'), { a: 56, b: 8 }, 7, 448);
    assert(/56 ÷ 8 = 7/.test(got) && /56 × 8 = 448/.test(got), got);
});

test('деление: вопрос поставлен числами примера', () => {
    eq(H.R.hintText('game', 'взял одно из чисел', meta('div'), { a: 56, b: 8 }, 7, 8),
       '56 ÷ 8 — сколько раз 8 помещается в 56?');
});

test('у каждого вида собирается непустой текст в обеих формах', () => {
    const cases = [
        ['ошибка в десятках', 'add', { a: 17, b: 18 }, 35, 25],
        ['ошибка в десятках', 'sub', { a: 52, b: 17 }, 35, 45],
        ['ошибка в единицах', 'add', { a: 24, b: 38 }, 62, 68],
        ['ошибка в единицах', 'sub', { a: 52, b: 17 }, 35, 32],
        ['не занял десяток', 'sub', { a: 52, b: 8 }, 44, 56],
        ['таблица умножения', 'mul', { a: 7, b: 8 }, 56, 49],
        ['сложил вместо умножения', 'mul', { a: 6, b: 4 }, 24, 10],
        ['перепутал действие', 'add', { a: 9, b: 4 }, 13, 5],
        ['перепутал действие', 'sub', { a: 9, b: 4 }, 5, 13],
        ['перепутал действие', 'mul', { a: 8, b: 4 }, 32, 2],
        ['перепутал действие', 'div', { a: 56, b: 8 }, 7, 448],
        ['взял одно из чисел', 'div', { a: 56, b: 8 }, 7, 8],
        ['делил на ноль', 'div', { a: 7, b: 0 }, 'NO_SOLUTION', 7],
        ['ошибся на единицу', 'add', { a: 17, b: 18 }, 35, 34]
    ];
    LANGS.forEach(lang => {
        const box = loadHints({ HINT_CONTENT: CONTENT });
        box.LANG = lang;
        cases.forEach(([kind, op, problem, correct, chosen]) => {
            ['game', 'review'].forEach(form => {
                const got = box.R.hintText(form, kind, meta(op), problem, correct, chosen);
                assert(got && got.length > 0, `[${lang}] «${kind}» ${op} ${form}: пусто`);
                assert(!/%\d/.test(got), `[${lang}] «${kind}» ${op} ${form}: осталась подстановка — ${got}`);
            });
        });
    });
});

test('шаблон без аргументов не показывается вместо мусора', () => {
    // Числа примера потерялись — лучше молчать, чем показать «Из %1 не вычесть».
    eq(H.R.hintText('game', 'не занял десяток', meta('sub'), {}, 44, 56), '');
});

test('шаблон, которому не хватило аргументов, не показывается', () => {
    // Тексты и порядок аргументов лежат в разных файлах и однажды разъедутся. Тогда
    // ученик увидит «Займи десяток: %9» — показывать такое хуже, чем промолчать.
    const broken = JSON.parse(JSON.stringify(CONTENT));
    broken.ru['не занял десяток'].game += ' %9';
    const box = loadHints({ HINT_CONTENT: broken });
    eq(box.R.hintText('game', 'не занял десяток', meta('sub'), { a: 52, b: 8 }, 44, 56), '');
});

test('без файла с текстами подсказок нет, но и падения нет', () => {
    const box = loadHints({});
    eq(box.R.hintText('game', 'не занял десяток', meta('sub'), { a: 52, b: 8 }, 44, 56), '');
});

group('Когда показывать');

test('одна ошибка вида — ещё не повод', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.R.bump('таблица умножения');
    assert(!box.R.shouldShowHint('таблица умножения'), 'после первой ошибки подсказки быть не должно');
});

test('на третий раз подсказка появляется', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    for (let i = 0; i < 3; i++) box.R.bump('таблица умножения');
    assert(box.R.shouldShowHint('таблица умножения'), 'три одинаковые ошибки — это уже пробел');
});

test('порог — три', () => { eq(H.R.HINT_REPEAT_AT, 3); });

test('один вид подсказывается один раз за миссию', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    for (let i = 0; i < 5; i++) box.R.bump('таблица умножения');
    box.R.mark('таблица умножения');
    assert(!box.R.shouldShowHint('таблица умножения'), 'повторять то же самое незачем');
});

test('больше двух подсказок за миссию не показываем', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.R.mark('перепутал действие');
    box.R.mark('не занял десяток');
    for (let i = 0; i < 5; i++) box.R.bump('таблица умножения');
    assert(!box.R.shouldShowHint('таблица умножения'), 'третья подсказка — это уже урок посреди игры');
});

test('про «другую ошибку» молчим всегда', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    for (let i = 0; i < 9; i++) box.R.bump('другая ошибка');
    assert(!box.R.shouldShowHint('другая ошибка'), 'мы честно не знаем, что там случилось');
    assert(H.R.HINT_NEVER.indexOf('другая ошибка') >= 0, 'вид должен быть в списке молчания');
});

test('«не сократил» тоже не подсказываем — это не ошибка в счёте', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    for (let i = 0; i < 9; i++) box.R.bump('не сократил');
    assert(!box.R.shouldShowHint('не сократил'));
});

group('Заморозка времени');

test('пока подсказка висит, игра остановлена', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    let resumed = false;
    box.R.showHintFreeze('Проверь перенос.', () => { resumed = true; });
    eq(box.R.isActive(), false, 'часы миссии должны стоять');
    eq(box.dom.byId.hintFreeze.hidden, false, 'подсказка должна быть видна');
    assert(box.dom.byId.timerBar.classList.contains('frozen'), 'полоска времени должна выглядеть замёрзшей');
    eq(resumed, false, 'до нажатия игра не продолжается');
});

test('нажатие возвращает время и ведёт к следующему примеру', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    let resumed = 0;
    box.R.showHintFreeze('Проверь перенос.', () => { resumed++; });
    box.dom.byId.hintFreeze.onclick();
    eq(box.R.isActive(), true, 'время должно пойти дальше');
    eq(box.dom.byId.hintFreeze.hidden, true, 'подсказка должна исчезнуть');
    assert(!box.dom.byId.timerBar.classList.contains('frozen'), 'иней должен растаять');
    eq(resumed, 1, 'следующий пример ровно один раз');
});

test('повторное нажатие не запускает следующий пример дважды', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    let resumed = 0;
    box.R.showHintFreeze('Проверь перенос.', () => { resumed++; });
    box.dom.byId.hintFreeze.onclick();
    box.dom.byId.hintFreeze.onclick();
    eq(resumed, 1, 'два примера подряд за один тап — это потерянный пример');
});

test('пустая подсказка не морозит игру', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    let resumed = false;
    box.R.showHintFreeze('', () => { resumed = true; });
    eq(resumed, true, 'нечего показывать — идём дальше сразу');
    eq(box.R.isActive(), true, 'и ничего не замораживаем');
});

test('сброс миссии снимает заморозку', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.R.showHintFreeze('Проверь перенос.', () => {});
    box.R.resetSessionHints();
    eq(box.dom.byId.hintFreeze.hidden, true, 'подсказка не должна пережить конец миссии');
    assert(!box.dom.byId.timerBar.classList.contains('frozen'), 'иней тоже');
});

group('Пример в карточке');

test('карточка сама показывает, о каком примере речь', () => {
    // Она накрывает экран целиком: за ней не видно ни примера, ни ответа.
    eq(H.R.hintProblemLine(meta('sub'), { a: 16, b: 9 }, 7), '16 − 9 = 7');
    eq(H.R.hintProblemLine(meta('mul'), { a: 7, b: 8 }, 56), '7 × 8 = 56');
    eq(H.R.hintProblemLine(meta('div'), { a: 56, b: 8 }, 7), '56 ÷ 8 = 7');
});

test('деление на ноль показывает «нет решения», а не пустоту', () => {
    eq(H.R.hintProblemLine(meta('div'), { a: 7, b: 0 }, 'NO_SOLUTION'), '7 ÷ 0 = Нет решения');
});

test('без чисел примера строка не собирается', () => {
    eq(H.R.hintProblemLine(meta('sub'), {}, 7), '');
});

test('выбранный ответ подписан отдельно', () => {
    eq(H.R.hintChosenLine(9), 'ты выбрал 9');
    eq(H.R.hintChosenLine('NO_SOLUTION'), 'ты выбрал Нет решения');
    eq(H.R.hintChosenLine(null), '');
});

test('пример и выбор доходят до карточки', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.R.showHintFreeze('Займи десяток.', () => {},
        { example: '16 − 9 = 7', chosen: 'ты выбрал 9' });
    eq(box.dom.byId.hintFreezeExample.innerText, '16 − 9 = 7');
    eq(box.dom.byId.hintFreezeChosen.innerText, 'ты выбрал 9');
});

test('без примера строки прячутся, а не висят пустыми', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.R.showHintFreeze('Займи десяток.', () => {});
    eq(box.dom.byId.hintFreezeExample.hidden, true);
    eq(box.dom.byId.hintFreezeChosen.hidden, true);
});

group('Новый вид ошибки');

const C = loadClassifier();

test('десятки верные, единица нет — это «ошибка в единицах»', () => {
    eq(C({ a: 24, b: 38 }, 62, 68, 'add'), 'ошибка в единицах');
});

test('промах на десяток остаётся «ошибкой в десятках»', () => {
    eq(C({ a: 17, b: 18 }, 35, 25, 'add'), 'ошибка в десятках');
});

test('промах на единицу не отбирается новым видом', () => {
    // 34 вместо 35 — тоже верные десятки при неверной единице, но ученику полезнее
    // услышать про спешку.
    eq(C({ a: 17, b: 18 }, 35, 34, 'add'), 'ошибся на единицу');
});

test('заём важнее нового вида', () => {
    // 52 − 8 = 44, поразрядно без займа выходит 56. Разница 12, а не 10, поэтому
    // модель заёма срабатывает раньше разрядных.
    eq(C({ a: 52, b: 8 }, 44, 56, 'sub'), 'не занял десяток');
});

test('заём с разницей ровно в десяток уходит в «ошибку в десятках»', () => {
    // Это поведение БЫЛО и до подсказок: промах на 10 проверяется раньше заёма, а без
    // займа разница равна 2·(цифра вычитаемого − цифра уменьшаемого) и на пятёрке даёт
    // ровно 10. Не трогаю: перестановка правил сдвинула бы коды в уже собранной
    // статистике трёх учеников.
    eq(C({ a: 52, b: 7 }, 45, 55, 'sub'), 'ошибка в десятках');
});

test('однозначный промах не выдаётся за ошибку в единицах', () => {
    // 7 и 9 — десятков нет ни одного, а подсказка говорила «десятки сошлись».
    // На первой звезде вычитания это было сто процентов случаев.
    assert(C({ a: 16, b: 9 }, 7, 9, 'sub') !== 'ошибка в единицах',
        'про однозначный промах мы честно ничего не знаем');
});

test('двузначный промах в единицах распознаётся как прежде', () => {
    eq(C({ a: 24, b: 38 }, 62, 68, 'add'), 'ошибка в единицах');
});

test('в умножении и делении нового вида нет', () => {
    assert(C({ a: 7, b: 8 }, 56, 52, 'mul') !== 'ошибка в единицах', 'умножение считают не столбиком');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
