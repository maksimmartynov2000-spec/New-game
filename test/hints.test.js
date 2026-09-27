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

const { ROOT, appScript } = require('./app-source');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// Разбор ошибок и подсказки уехали в js/mistakes.js — метки ищем по всему коду сразу.
const SCRIPT = appScript(HTML);

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

// Подсказки и разбор ошибок целиком лежат в js/mistakes.js, и их срезы упираются
// в конец этого файла, а не в следующий раздел index.html. Режем прямо по нему:
// прежней меткой конца («ПАЗЛ: ГЕНЕРАЦИЯ КУСОЧКОВ») пользоваться больше нельзя —
// она теперь в другом файле, и срез утащил бы за собой пол-приложения.
const MISTAKES = fs.readFileSync(path.join(ROOT, 'js', 'mistakes.js'), 'utf8');
function sliceM(startMark, endMark, what) {
    const from = MISTAKES.indexOf(startMark);
    if (from < 0) throw new Error(`не найдено начало среза: ${what}`);
    const to = endMark === null ? MISTAKES.length : MISTAKES.indexOf(endMark, from + 1);
    if (to < 0) throw new Error(`не найден конец среза: ${what}`);
    return MISTAKES.slice(from, to);
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
        + sliceM('// ===================== ПОДСКАЗКИ ПО ОШИБКАМ', null, 'подсказки')
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

// Полный classifyMistake — для видов, которые ставятся выше разрядных моделей.
function loadFullClassifier() {
    const box = { console, Math, Number, String, parseInt,
                  isFrac: () => false, sameValue: () => false,
                  isDecimalValue: () => false, classifyFractionArith: () => null,
                  classifyFracOfNumber: () => null };
    const src = slice('function noBorrowSub(a, b)', '\n\n', 'noBorrowSub')
        + '\n' + slice('function classifyIntegerLike(problem, correct, chosen, opKey, isNegative)',
                       '// «Дробь от числа»', 'разрядные модели')
        + '\n' + slice('function classifyZeroInExample(opKey, problem, chosen)',
                       '// «Дробь от числа»', 'ноль в примере')
        + '\n' + sliceM('function classifyMistake(meta, problem, correct, chosen)',
                        '// ===================== ПОДСКАЗКИ ПО ОШИБКАМ', 'classifyMistake')
        + ';globalThis.CM = classifyMistake;';
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<classifyMistake>' });
    return box.CM;
}

// Классификатор — отдельным срезом: новый вид «ошибка в единицах» надо проверить прямо.
function loadClassifier() {
    const box = { console, Math, Number, String, parseInt };
    const src = slice('function noBorrowSub(a, b)', '\n\n', 'noBorrowSub')
        + '\n' + slice('function classifyIntegerLike(problem, correct, chosen, opKey, isNegative)',
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
const CM = loadFullClassifier();
const meta = (op) => ({ opKey: op, category: 'integer' });

test('заём: подсказка говорит цифрами примера', () => {
    const got = H.R.hintText('game', 'не занял десяток', meta('sub'), { a: 52, b: 8 }, 44, 56);
    eq(got, 'Из 2 не вычесть 8. Займи десяток: 12 − 8.');
});

test('таблица умножения: названа та клетка, которую посчитал ученик', () => {
    // 7 × 8 = 56, ученик выбрал 49 — это 7 × 7.
    const got = H.R.hintText('game', 'таблица умножения', meta('mul'), { a: 7, b: 8 }, 56, 49);
    eq(got, 'Это 7 × 7, а в примере 7 × 8. Разница — целых 7.');
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
        ['ошибся на единицу', 'add', { a: 17, b: 18 }, 35, 34],
        ['ошибся на единицу', 'div', { a: 16, b: 8 }, 2, 3],
        ['ошибка в десятках', 'mul', { a: 3, b: 5 }, 15, 45],
        ['ошибка в десятках', 'div', { a: 28, b: 2 }, 14, 24]
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

group('Когда молчим: текст был бы неправдой');

test('перенос не упоминается там, где переноса нет', () => {
    // 10 + 7 = 17: единицы 0 + 7, наверх ничего не уходит.
    eq(H.R.hintText('game', 'ошибка в десятках', meta('add'), { a: 10, b: 7 }, 17, 27), '');
    eq(H.R.hintText('review', 'ошибка в десятках', meta('add'), { a: 10, b: 7 }, 17, 27), '');
});

test('с настоящим переносом подсказка остаётся', () => {
    const got = H.R.hintText('review', 'ошибка в десятках', meta('add'), { a: 19, b: 46 }, 65, 75);
    assert(/9 \+ 6 = 15/.test(got), got);
});

test('заём не упоминается там, где занимать нечего', () => {
    // 13 − 2: единицы 3 и 2, заём не нужен.
    eq(H.R.hintText('game', 'ошибка в десятках', meta('sub'), { a: 13, b: 2 }, 11, 21), '');
});

test('с настоящим заёмом подсказка остаётся', () => {
    assert(H.R.hintText('game', 'ошибка в десятках', meta('sub'), { a: 52, b: 17 }, 35, 45), 'должна быть');
});

test('«посчитай отдельно единицы» не говорим, когда единицы — весь пример', () => {
    // 9 + 1 = 10: столбика нет, совет повторяет условие.
    eq(H.R.hintText('game', 'ошибка в единицах', meta('add'), { a: 9, b: 1 }, 10, 12), '');
});

test('при двузначном числе разбор по единицам остаётся', () => {
    assert(H.R.hintText('game', 'ошибка в единицах', meta('add'), { a: 24, b: 38 }, 62, 68), 'должна быть');
});

test('про множитель единицу молчим', () => {
    // «1 × 6 — это 6 раза по 1» ничему не учит.
    eq(H.R.hintText('game', 'сложил вместо умножения', meta('mul'), { a: 1, b: 6 }, 6, 7), '');
    eq(H.R.hintText('game', 'сложил вместо умножения', meta('mul'), { a: 6, b: 1 }, 6, 7), '');
});

test('про клетку таблицы с нулём молчим', () => {
    // 1 × 9, выбрал 0 — формально соседняя клетка 1 × 0, сказать нечего.
    eq(H.R.hintText('game', 'таблица умножения', meta('mul'), { a: 1, b: 9 }, 9, 0), '');
});

test('про делитель единицу молчим', () => {
    // Иначе разбор утверждает «ответ всегда меньше делимого», а он равен ему.
    eq(H.R.hintText('review', 'взял одно из чисел', meta('div'), { a: 12, b: 1 }, 12, 1), '');
});

group('Ноль в примере');

test('классификатор видит ноль в умножении', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    eq(CM({ opKey: 'mul', category: 'integer' }, { a: 0, b: 8 }, 0, 1), 'ноль в примере');
});

test('классификатор видит делённый ноль', () => {
    eq(CM({ opKey: 'div', category: 'integer' }, { a: 0, b: 10 }, 0, 10), 'ноль в примере');
});

test('«нет решения» при делении ноля — та же путаница', () => {
    // 0 ÷ 10 и 10 ÷ 0 путают постоянно; выбор «нет решения» это ровно она.
    eq(CM({ opKey: 'div', category: 'integer' }, { a: 0, b: 10 }, 0, 'NO_SOLUTION'), 'ноль в примере');
});

test('верный ноль ошибкой не считается', () => {
    assert(CM({ opKey: 'mul', category: 'integer' }, { a: 0, b: 8 }, 0, 0) !== 'ноль в примере');
});

test('подсказка про ноль считает нулями по второму множителю', () => {
    eq(H.R.hintText('game', 'ноль в примере', meta('mul'), { a: 0, b: 8 }, 0, 1),
       'Сложи 8 нулей — получится ноль.');
});

test('про деление ноля говорим отдельно от деления на ноль', () => {
    const got = H.R.hintText('review', 'ноль в примере', meta('div'), { a: 0, b: 10 }, 0, 10);
    assert(/НА ноль/.test(got), `разбор должен развести два случая: ${got}`);
});

test('ноль на ноль — молчим', () => {
    eq(H.R.hintText('game', 'ноль в примере', meta('mul'), { a: 0, b: 0 }, 0, 1), '');
});

group('Виды, которых раньше не было');

// Замер до правки: 31% всех обманок режима положительных чисел разбор называл
// «другой ошибкой» — на вычитании первой звезды 58%, то есть больше половины
// отчёта репетитору была строка, по которой ничего не сделаешь. Четыре вида
// ниже закрывают почти всё это, и каждый из них соответствует ловушке, которую
// генератор ставит НАМЕРЕННО (см. addSubDecoyPlan и sameUnitsDecoy).

test('не сошлись оба разряда — это свой вид, а не «другая ошибка»', () => {
    // Третий угол квадрата ловушек: и десятки, и единицы мимо.
    eq(CM(meta('add'), { a: 17, b: 18 }, 35, 46), 'оба разряда мимо');
});

test('сошлись десятки — по-прежнему «ошибка в единицах»', () => {
    // Более точное имя обязано выигрывать у более общего.
    eq(CM(meta('add'), { a: 17, b: 18 }, 35, 37), 'ошибка в единицах');
});

test('промах ровно на десяток — по-прежнему «ошибка в десятках»', () => {
    eq(CM(meta('add'), { a: 17, b: 18 }, 35, 45), 'ошибка в десятках');
});

test('промах на два-три у однозначных получил имя', () => {
    eq(CM(meta('sub'), { a: 10, b: 7 }, 3, 6), 'промахнулся рядом');
});

test('промах на единицу остаётся промахом на единицу', () => {
    // «Промахнулся рядом» стоит последним и не имеет права перехватывать.
    eq(CM(meta('sub'), { a: 10, b: 7 }, 3, 4), 'ошибся на единицу');
});

test('умножено только на единицы — 7 × 13 посчитано как 7 × 3', () => {
    eq(CM(meta('mul'), { a: 7, b: 13 }, 91, 21), 'не умножил десятки');
});

test('порядок множителей роли не играет', () => {
    eq(CM(meta('mul'), { a: 13, b: 7 }, 91, 21), 'не умножил десятки');
});

test('у круглого второго числа единиц нет — и вид не ставится', () => {
    // 7 × 20: сказать «посчитал только 7 × 0» нельзя, это неправда.
    eq(CM(meta('mul'), { a: 7, b: 20 }, 140, 70), 'ошибка в десятках');
});

test('лишний десяток — не потерянный десяток', () => {
    // 91 + 70: десяток посчитан дважды, а не пропущен. Слова нужны другие.
    eq(CM(meta('mul'), { a: 7, b: 13 }, 91, 161), 'ошибка в десятках');
});

test('та же последняя цифра в делении — тоже ошибка в десятках', () => {
    eq(CM(meta('div'), { a: 56, b: 7 }, 8, 18), 'ошибка в десятках');
});

test('«нет решения» там, где решение есть', () => {
    eq(CM(meta('div'), { a: 45, b: 9 }, 5, 'NO_SOLUTION'), 'нет решения зря');
});

test('подсказка про десятки называет обе части умножения', () => {
    eq(H.R.hintText('game', 'не умножил десятки', meta('mul'), { a: 7, b: 13 }, 91, 21),
       'Посчитано только 7 × 3. У второго числа есть ещё десятки.');
});

test('подсказка про оба разряда называет цифры верного ответа', () => {
    const got = H.R.hintText('review', 'оба разряда мимо', meta('add'), { a: 17, b: 18 }, 35, 46);
    assert(/46/.test(got) && /35/.test(got), `нужны оба числа: ${got}`);
    assert(/единицы — их должно быть 5/.test(got), `нужна цифра единиц: ${got}`);
    assert(/десятки — их 3/.test(got), `нужна цифра десятков: ${got}`);
});

test('подсказка про зря выбранное «нет решения» называет делитель', () => {
    const got = H.R.hintText('game', 'нет решения зря', meta('div'), { a: 45, b: 9 }, 5, 'NO_SOLUTION');
    assert(/на 9 делить можно/.test(got), got);
});

group('Счётные слова');

test('«раз» склоняется по числу множителя', () => {
    // На однозначных этого не было видно, на двузначных вылезло: «21 раза по 40».
    const at = (b) => H.R.hintText('game', 'сложил вместо умножения', meta('mul'), { a: 40, b }, 40 * b, 40 + b);
    assert(/взятое 21 раз,/.test(at(21)), at(21));
    assert(/взятое 22 раза,/.test(at(22)), at(22));
    assert(/взятое 25 раз,/.test(at(25)), at(25));
    assert(/взятое 12 раз,/.test(at(12)), at(12));   // 12–14 — исключение из правила
    assert(/взятое 3 раза,/.test(at(3)), at(3));
});

test('«ноль» тоже склоняется', () => {
    const at = (b) => H.R.hintText('game', 'ноль в примере', meta('mul'), { a: 0, b }, 0, 1);
    eq(at(2), 'Сложи 2 нуля — получится ноль.');
    eq(at(5), 'Сложи 5 нулей — получится ноль.');
    eq(at(21), 'Сложи 21 ноль — получится ноль.');
    eq(at(11), 'Сложи 11 нулей — получится ноль.');
});

test('в разборе счётное слово тоже согласовано', () => {
    const got = H.R.hintText('review', 'сложил вместо умножения', meta('mul'), { a: 40, b: 21 }, 840, 61);
    assert(/взятое 21 раз\./.test(got), got);
});

test('в других языках счётное слово одной формы', () => {
    const forms = { en: [/taken 21 times/, /taken 22 times/], fr: [/pris 21 fois/, /pris 22 fois/],
                    de: [/die 40 21-mal genommen/, /die 40 22-mal genommen/] };
    Object.keys(forms).forEach(lang => {
        const box = loadHints({ HINT_CONTENT: CONTENT });
        box.LANG = lang;
        forms[lang].forEach((re, i) => {
            const b = 21 + i;
            const got = box.R.hintText('game', 'сложил вместо умножения', meta('mul'), { a: 40, b }, 40 * b, 40 + b);
            assert(re.test(got), `[${lang}] ${got}`);
        });
    });
});

test('немецкое «-mal» пишется слитно, а не через пробел', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.LANG = 'de';
    const got = box.R.hintText('game', 'сложил вместо умножения', meta('mul'), { a: 40, b: 21 }, 840, 61);
    assert(/21-mal/.test(got) && !/21 -mal/.test(got), got);
});

group('Деление проверяется умножением');

test('промах на единицу в делении показывает саму проверку', () => {
    // 16 ÷ 8 = 2, ученик выбрал 3. Вместо уговоров «не спеши» — проверка, которая
    // ловит именно этот промах. Деление — самая частая клетка для этого вида.
    eq(H.R.hintText('game', 'ошибся на единицу', meta('div'), { a: 16, b: 8 }, 2, 3),
       'Проверь умножением: 2 × 8 = 16, а 3 × 8 = 24.');
});

test('в остальных действиях промах на единицу объясняется по-прежнему', () => {
    // Текст для деления не должен утечь в сложение: там проверять умножением нечего.
    const got = H.R.hintText('review', 'ошибся на единицу', meta('add'), { a: 17, b: 18 }, 35, 34);
    assert(/34 вместо 35/.test(got), got);
    assert(!/×/.test(got), `в сложении проверки умножением быть не должно: ${got}`);
});

test('промах на десяток в делении назван и проверен', () => {
    // 28 ÷ 2 = 14, ученик выбрал 24.
    eq(H.R.hintText('game', 'ошибка в десятках', meta('div'), { a: 28, b: 2 }, 14, 24),
       'Мимо ровно на десяток: 24 × 2 = 48, а не 28.');
});

test('если промах не десяток, про десяток не говорим', () => {
    // Сейчас генератор даёт в делении только ±10, но обещаний он не давал: текст
    // «мимо ровно на десяток» обязан проверять сам себя.
    eq(H.R.hintText('game', 'ошибка в десятках', meta('div'), { a: 28, b: 2 }, 14, 34), '');
});

test('в умножении не сказано ни про перенос, ни про заём', () => {
    // 3 × 5 = 15, выбрано 45. Переносить тут нечего — правда только в том, что
    // последняя цифра совпала, а промах кратен десяти.
    const got = H.R.hintText('game', 'ошибка в десятках', meta('mul'), { a: 3, b: 5 }, 15, 45);
    assert(/мимо на 30/.test(got), got);
    assert(!/перенос|за[её]м|займи/i.test(got), `в умножении этих слов быть не должно: ${got}`);
});

test('сложение и вычитание правку не заметили', () => {
    // Ветки умножения и деления вставлены в ту же функцию, и сквозной проход мог
    // увести сложение с вычитанием на чужие аргументы.
    eq(H.R.hintText('game', 'ошибка в десятках', meta('add'), { a: 19, b: 46 }, 65, 75),
       'Мимо ровно на десяток. Единицы верные — пересчитай десятки.');
    const sub = H.R.hintText('review', 'ошибка в десятках', meta('sub'), { a: 52, b: 17 }, 35, 45);
    assert(/52 − 17/.test(sub), sub);
});

test('вычитание без заёма по-прежнему молчит', () => {
    // 57 − 12: единицы 7 ≥ 2, заёма нет, и говорить о нём значит врать.
    eq(H.R.hintText('review', 'ошибка в десятках', meta('sub'), { a: 57, b: 12 }, 45, 35), '');
});

group('Слова, а не термины');

test('в игре сказано «пересчитай десятки», а не «проверь перенос»', () => {
    // «Перенос» — жаргон. Термин остаётся в разборе, где есть место объяснить.
    const got = H.R.hintText('game', 'ошибка в десятках', meta('add'), { a: 19, b: 46 }, 65, 75);
    assert(/пересчитай десятки/.test(got), got);
    assert(!/перенос/.test(got), `в игре термина быть не должно: ${got}`);
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
    eq(H.R.hintChosenLine(9), 'выбрано: 9');
    eq(H.R.hintChosenLine('NO_SOLUTION'), 'выбрано: Нет решения');
    eq(H.R.hintChosenLine(null), '');
});

test('пример и выбор доходят до карточки', () => {
    const box = loadHints({ HINT_CONTENT: CONTENT });
    box.R.showHintFreeze('Займи десяток.', () => {},
        { example: '16 − 9 = 7', chosen: 'выбрано: 9' });
    eq(box.dom.byId.hintFreezeExample.innerText, '16 − 9 = 7');
    eq(box.dom.byId.hintFreezeChosen.innerText, 'выбрано: 9');
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

group('Отрицательные: знак и разряды');

// Замер до правки: на отрицательных без единого слова оставалось 78% неверных
// ответов против 5% у положительных. Две корзины молчали целиком: «ошибся в
// знаке» (текста не было ни на одном языке) и «другая ошибка», куда падало всё,
// от чего разрядные правила были отключены. Проверки ниже стерегут и то, что
// заговорило, и то, что слова при этом остались правдой.

const N = (problem, correct, chosen, op) => C(problem, correct, chosen, op, true);

test('зеркальный ответ — по-прежнему «ошибся в знаке»', () => {
    eq(N({ a: -8, b: 7 }, -1, 1, 'add'), 'ошибся в знаке');
});

test('промах на десяток через ноль — это знак, а не десятки', () => {
    // −5 + 3 = −2, выбрано 8: разница ровно десять, но 8 по другую сторону
    // нуля. Раньше тут стояла «ошибка в десятках», и в журнал шла неправда.
    eq(N({ a: -5, b: 3 }, -2, 8, 'add'), 'знак и число мимо');
});

test('та же последняя цифра по одну сторону — ошибка в десятках, как у положительных', () => {
    eq(N({ a: -5, b: 5 }, -25, -75, 'mul'), 'ошибка в десятках');
});

test('оба числа кончаются нулём, но знаки разные — не десятки', () => {
    // 10 × (−4) = −40, выбрано 50. «Единицы сошлись» только формально.
    eq(N({ a: 10, b: -4 }, -40, 50, 'mul'), 'знак и число мимо');
});

test('рядом и по одну сторону — «промахнулся рядом»', () => {
    eq(N({ a: -8, b: 4 }, -4, -6, 'add'), 'промахнулся рядом');
});

test('на положительных ничего не изменилось', () => {
    // Для положительных «по одну сторону» верно всегда — правка их не касается.
    eq(C({ a: 17, b: 18 }, 35, 25, 'add'), 'ошибка в десятках');
    eq(C({ a: 3, b: 5 }, 15, 45, 'mul'), 'ошибка в десятках');
    eq(C({ a: 17, b: 18 }, 35, 46, 'add'), 'оба разряда мимо');
    eq(C({ a: 7, b: 13 }, 91, 21, 'mul'), 'не умножил десятки');
    eq(C({ a: 9, b: 4 }, 5, 3, 'sub'), 'промахнулся рядом');
    assert(C({ a: 5, b: 3 }, 8, -2, 'add') !== 'знак и число мимо', 'новый вид только для отрицательных');
});

const sign = (form, op, problem, correct, chosen) =>
    H.R.hintText(form, 'ошибся в знаке', meta(op), problem, correct, chosen);

test('разные знаки при сложении: знак берут у того, что дальше от нуля', () => {
    const got = sign('game', 'add', { a: -8, b: 7 }, -1, 1);
    assert(/-8/.test(got) && /дальше от нуля/.test(got), got);
});

test('при вычитании знак у того, что прибавили на деле: у 3 − 8 это −8', () => {
    // Ни 3, ни 8 в записи не несут «того самого» знака: 3 − 8 = 3 + (−8).
    const got = sign('game', 'sub', { a: 3, b: 8 }, -5, 5);
    assert(/-8/.test(got), got);
});

test('одинаковые знаки при сложении — свой текст', () => {
    const got = sign('game', 'sub', { a: -6, b: 3 }, -9, 9);
    assert(/одинаковые/.test(got) && /-6/.test(got), got);
});

test('умножение: одинаковые знаки — плюс, разные — минус', () => {
    assert(/дают плюс/.test(sign('game', 'mul', { a: -4, b: -5 }, 20, -20)), 'одинаковые');
    assert(/дают минус/.test(sign('game', 'mul', { a: -4, b: 5 }, -20, 20)), 'разные');
    assert(/дают минус/.test(sign('game', 'div', { a: 20, b: -4 }, -5, 5)), 'деление');
});

test('три множителя — текст про счёт минусов, а не про «два знака»', () => {
    // В задаче хранятся два числа: произведение первых двух и третье. Их знаки
    // совпадают, а на экране минусов два из трёх — «два одинаковых знака» тут
    // неправда, если не знать, что множителей три.
    const p = { a: -24, b: -8 };
    assert(/одинаковых знака/.test(sign('game', 'mul', p, 192, -192)), 'без пометки');
    const got = sign('game', 'mul', Object.assign({ triple: true }, p), 192, -192);
    assert(/Считай минусы/.test(got), got);
});

test('в текстах про знак нет слова «больше» ни на одном языке', () => {
    // «Знак у большего числа» — неправда уже на −8 + 7: −8 меньше семи. Эту
    // формулировку я сам предложил в первом варианте и сам же поймал.
    const WRONG = { ru: /больш/i, en: /bigger|larger|greater/i, fr: /plus grand/i, de: /größer/i };
    LANGS.forEach(lang => Object.keys(CONTENT[lang])
        .filter(k => k.indexOf('ошибся в знаке:') === 0 || k.indexOf('знак и число мимо:') === 0)
        .forEach(k => ['game', 'review'].forEach(form => {
            assert(!WRONG[lang].test(CONTENT[lang][k][form]), `[${lang}] «${k}» ${form}: ${CONTENT[lang][k][form]}`);
        })));
});

test('«знак и число мимо»: правило знака и что именно пересчитать', () => {
    const got = H.R.hintText('review', 'знак и число мимо', meta('add'), { a: -8, b: 3 }, -5, 4);
    assert(/-8/.test(got) && /из 8 вычти 3/.test(got), got);
});

test('десятки на −17 − 18 рассказывают про сложение, а не про заём', () => {
    // По записи это вычитание, по делу — 17 + 18. Раньше разбор говорил про
    // «десяток, который занимали», которого тут нет.
    const got = H.R.hintText('review', 'ошибка в десятках', meta('sub'), { a: -17, b: 18 }, -35, -25);
    assert(/17 \+ 18/.test(got) && /7 \+ 8 = 15/.test(got), got);
    assert(!/занима/.test(got), 'про заём здесь говорить нельзя: ' + got);
});

test('заёма на деле нет — про десятки молчим', () => {
    // 5 − 18 = −13: на деле это 18 − 5, заёма нет, и объяснять промах
    // потерянным десятком значит врать.
    eq(H.R.hintText('review', 'ошибка в десятках', meta('sub'), { a: 5, b: 18 }, -13, -23), '');
});

test('отрицательный множитель в подсказке — в скобках, как в примере', () => {
    const got = H.R.hintText('game', 'ошибка в десятках', meta('mul'), { a: -4, b: -5 }, 20, 40);
    assert(/-4 × \(-5\)/.test(got), got);
    // у положительных скобок не появилось
    assert(/3 × 5/.test(H.R.hintText('game', 'ошибка в десятках', meta('mul'), { a: 3, b: 5 }, 15, 45)));
});

test('строка примера на карточке — такая, какой её видел ребёнок', () => {
    // Раньше на отрицательных карточка почти не появлялась, и этого не было видно.
    // Теперь появляется — и собранная из a и b строка врала бы.
    eq(H.R.hintProblemLine(meta('mul'), { a: -24, b: -8, triple: true, text: '-8 × 3 × (-8)' }, 192),
       '-8 × 3 × (-8) = 192');
    eq(H.R.hintProblemLine(meta('add'), { a: -5, b: -3, text: '-5 - 3' }, -8), '-5 - 3 = -8');
    // у положительных запись прежняя, с типографским минусом
    eq(H.R.hintProblemLine(meta('sub'), { a: 16, b: 9, text: '16 - 9' }, 7), '16 − 9 = 7');
});

test('пометка «три множителя» доезжает до разбора после миссии', () => {
    // Разбор строит подсказку из сохранённой записи ошибки, а не из самого
    // примера. Потеряется пометка по дороге — разбор соврёт про «два знака».
    const push = slice('sessionMistakes.push({', '});', 'запись ошибки');
    assert(/triple:\s*!!\(currentProblem && currentProblem\.triple\)/.test(push), 'в записи ошибки нет пометки');
    const calls = SCRIPT.match(/hintText\('review'[^;]*;/g) || [];
    assert(calls.length >= 2, 'не нашлись вызовы разбора');
    calls.forEach(c => assert(/triple:\s*m\.triple/.test(c), 'разбор не передаёт пометку: ' + c));
});

test('у каждого варианта про знак собирается текст на всех языках', () => {
    const cases = [
        ['add', { a: -6, b: -3 }, -9, 9], ['add', { a: -8, b: 7 }, -1, 1],
        ['mul', { a: -4, b: -5 }, 20, -20], ['mul', { a: -4, b: 5 }, -20, 20],
        ['mul', { a: -24, b: -8, triple: true }, 192, -192]
    ];
    LANGS.forEach(lang => {
        const box = loadHints({ HINT_CONTENT: CONTENT });
        box.LANG = lang;
        ['ошибся в знаке', 'знак и число мимо'].forEach(kind => cases.forEach(([op, p, correct, chosen]) => {
            ['game', 'review'].forEach(form => {
                const got = box.R.hintText(form, kind, meta(op), p, correct, chosen);
                assert(got && !/%\d/.test(got), `[${lang}] «${kind}» ${op} ${form}: «${got}»`);
            });
        }));
    });
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
