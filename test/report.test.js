// Тесты отчёта репетитора: сравнение половин периода и подписи в списке учеников.
//
// Зачем отдельным файлом: этот код лежит ниже границы, по которой режут остальные
// загрузчики, и до него не дотягивался ни один тест. А цена ошибки здесь высокая —
// это единственный экран, содержимое которого уходит наружу, родителям.
//
// Два дефекта, которые тесты ниже закрывают и которые не поймал бы никто:
//   1. отчёт называл спадом рост: ученик перешёл на звезду выше, точность на новых
//      примерах закономерно просела, и в отчёт ушла красная стрелка вниз;
//   2. pluralDays и pluralStudents объявляли локальное `const t = n % 100`, затирая
//      функцию перевода, и падали на ЛЮБОМ аргументе — а вместе с ними падал весь
//      список учеников, стоило одному ученику замолчать.
//
// Как запускать:  node test/report.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// Оба среза самодостаточны: наружу зовут только встроенные функции и t()/tf().
function loadReport() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

    const slice = (startMark, endMark, what) => {
        const from = script.indexOf(startMark);
        const to = script.indexOf(endMark, from + 1);
        if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
        return script.slice(from, to);
    };

    // Один большой срез: от работы с датами до конца абзаца для родителей. В него
    // целиком попадают shiftDayKey, isActiveDay, aggregateDaily, avgLevelOf,
    // compareHalves и parentSummaryLines — они и составляют считающую часть отчёта.
    const core = slice('function shiftDayKey(key, deltaDays)',
                       '// Самая длинная череда дней подряд', 'ядро отчёта');
    // Дни занятий: счёт по дням, итоги и порог перехода на недели.
    const days = slice('// Сколько примеров решено в каждый день периода',
                       '// Календарь по неделям', 'дни занятий');
    // Остальное лежит по файлу врозь и подтягивается по кусочку.
    const plur = slice('function pluralDays(n)', 'function lastSeenText(iso)', 'склонения');
    const parse = slice('function parseTopicKey(key)', '// Ключ для ОТОБРАЖЕНИЯ', 'parseTopicKey');
    const acc = slice('function accuracyPct(correct, wrong, minAttempts)',
                      '// ===================== ЭКРАН СТАТИСТИКИ', 'accuracyPct');
    const ladders = slice('function ladderDatesByTopic(unlocks)',
                          '// Когда тема взяла мастерство', 'достижения');
    const re = slice('const LADDER_ID_RE = ', '\n', 'LADDER_ID_RE');

    // shiftDayKey форматирует дату через Progress.dayKey — единственная его связь
    // с хранилищем. Подменяем ровно её, той же реализацией, что и в приложении.
    const dayKey = (d) => {
        const dt = d || new Date();
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
             + `-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const sandbox = { console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN,
                      t: (x) => x, tf: (x) => x, LEVEL_GATE_TIER: 3,
                      Progress: { dayKey } };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext([re, parse, acc, ladders, core, days, plur].join('\n')
        + '\n;globalThis.aggregateDaily = aggregateDaily;'
        + '\n;globalThis.avgLevelOf = avgLevelOf;'
        + '\n;globalThis.compareHalves = compareHalves;'
        + '\n;globalThis.parentSummaryLines = parentSummaryLines;'
        + '\n;globalThis.parentSummaryText = parentSummaryText;'
        + '\n;globalThis.dayCounts = dayCounts;'
        + '\n;globalThis.daysSummary = daysSummary;'
        + '\n;globalThis.dayShade = dayShade;'
        + '\n;globalThis.parentTopicWords = parentTopicWords;'
        + '\n;globalThis.LEVEL_SHIFT_MIN = LEVEL_SHIFT_MIN;'
        + '\n;globalThis.PARENT_ACC_MIN_DELTA = PARENT_ACC_MIN_DELTA;'
        + '\n;globalThis.PARENT_SILENCE_MIN = PARENT_SILENCE_MIN;'
        + '\n;globalThis.pluralDays = pluralDays;'
        + '\n;globalThis.pluralStudents = pluralStudents;',
        sandbox, { filename: 'index.html<report>' });
    return sandbox;
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(got, want, what) {
    if (got !== want) throw new Error(`${what}: ожидали ${want}, получили ${got}`);
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function group(name) { console.log(`\n${name}`); }

const R = loadReport();

// Один день журнала: { темаКлюч: [верно, неверно, почти, времяВсех, числоВерных] }.
// Время задаём так, чтобы средняя скорость получалась ровной: ms = сек * 1000 * верных.
function day(topics) {
    const t = {};
    let c = 0, w = 0, ms = 0, mc = 0;
    Object.keys(topics).forEach(key => {
        const [right, wrong, sec] = topics[key];
        const spent = (sec || 5) * 1000 * (right + wrong);
        t[key] = [right, wrong, 0, spent, right];
        c += right; w += wrong; ms += spent; mc += right;
    });
    return { c, w, a: 0, s: 0, p: 0, ms, mc, t, e: {} };
}

group('Агрегация журнала доносит время по темам');

test('aggregateDaily складывает все пять ячеек темы, а не первые три', () => {
    const daily = {
        '2026-01-01': day({ 'integer+:add:1': [10, 0, 4] }),
        '2026-01-02': day({ 'integer+:add:1': [10, 0, 6] })
    };
    const out = R.aggregateDaily(daily, null, null);
    const slot = out.t['integer+:add:1'];
    eq(slot[0], 20, 'верных');
    eq(slot[3], 40000 + 60000, 'время');
    eq(slot[4], 20, 'число верных для скорости');
});

test('aggregateDaily складывает ошибки по клеткам за период', () => {
    const mk = (te) => ({ c: 0, w: 0, a: 0, s: 0, p: 0, ms: 0, mc: 0, t: {}, e: {}, te });
    const daily = {
        '2026-01-01': mk({ 'integer-:mul:3': { 'ошибся в знаке': 3 } }),
        '2026-01-02': mk({ 'integer-:mul:3': { 'ошибся в знаке': 2, 'таблица умножения': 1 },
                           'integer+:add:1': { 'ошибка в десятках': 5 } }),
        '2026-02-01': mk({ 'integer-:mul:3': { 'ошибся в знаке': 99 } })
    };
    const out = R.aggregateDaily(daily, '2026-01-01', '2026-01-31');
    eq(out.te['integer-:mul:3']['ошибся в знаке'], 5, 'суммируется по дням');
    eq(out.te['integer-:mul:3']['таблица умножения'], 1, 'вид из одного дня');
    eq(out.te['integer+:add:1']['ошибка в десятках'], 5, 'вторая клетка');
    assert(!('2026-02-01' in daily) === false, 'проверка данных');
    // Февраль за границей периода — и в сумму не попал.
    eq(out.te['integer-:mul:3']['ошибся в знаке'], 5, 'день вне периода не учтён');
});

test('день без разбивки по клеткам агрегацию не роняет', () => {
    // Записи из версий до этой разбивки te не несут вовсе.
    const daily = { '2026-01-01': { c: 5, w: 1, e: { 'другая ошибка': 1 } } };
    const out = R.aggregateDaily(daily, null, null);
    eq(Object.keys(out.te).length, 0, 'клеток');
    eq(out.e['другая ошибка'], 1, 'плоская карта на месте');
});

group('Средняя звёздность');

test('avgLevelOf взвешивает по числу попыток, а не по числу тем', () => {
    const agg = R.aggregateDaily({ '2026-01-01': day({
        'integer+:add:1': [90, 0, 5],
        'integer+:add:5': [10, 0, 5]
    }) }, null, null);
    // 90 попыток на 1★ и 10 на 5★ — среднее 1.4, а не 3 (среднее по темам).
    eq(R.avgLevelOf(agg).toFixed(2), '1.40', 'средняя звёздность');
});

test('без известной звёздности avgLevelOf возвращает null', () => {
    eq(R.avgLevelOf({ t: {} }), null, 'пустой период');
});

group('Половины периода сравниваются с поправкой на сложность');

test('та же сложность — сравниваем как есть', () => {
    const a = R.aggregateDaily({ '2026-01-01': day({ 'integer+:add:2': [40, 10, 5] }) }, null, null);
    const b = R.aggregateDaily({ '2026-01-02': day({ 'integer+:add:2': [45, 5, 5] }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq(cmp.mode, 'plain', 'режим');
    eq(cmp.a.c, 40, 'первая половина берётся целиком');
    eq(cmp.b.c, 45, 'вторая половина берётся целиком');
});

test('переход на звезду выше при общих темах — сравнение по общим темам', () => {
    // Первая половина: 1★. Вторая: та же 1★ (столько же и так же) плюс новая 4★,
    // на которой ученик закономерно ошибается. Целиком вторая половина выглядит
    // хуже — по общей теме не изменилось ничего.
    const a = R.aggregateDaily({ '2026-01-01': day({ 'integer+:add:1': [45, 5, 5] }) }, null, null);
    const b = R.aggregateDaily({ '2026-01-02': day({
        'integer+:add:1': [45, 5, 5],
        'integer+:add:4': [30, 30, 9]
    }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq(cmp.mode, 'common', 'режим');
    eq(cmp.a.c, 45, 'первая половина — только общая тема');
    eq(cmp.b.c, 45, 'вторая половина — только общая тема');
    eq(cmp.b.w, 5, 'ошибки с новой темы в сравнение не попали');
});

test('полная смена темы — половины объявляются несравнимыми', () => {
    const a = R.aggregateDaily({ '2026-01-01': day({ 'integer+:add:1': [45, 5, 5] }) }, null, null);
    const b = R.aggregateDaily({ '2026-01-02': day({ 'integer+:add:4': [30, 30, 9] }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq(cmp.mode, 'incomparable', 'режим');
    // Значения при этом остаются полными: показать их можно, стрелку рисовать нельзя.
    eq(cmp.a.c + cmp.a.w, 50, 'первая половина целиком');
    eq(cmp.b.c + cmp.b.w, 60, 'вторая половина целиком');
});

test('общих тем мало для выборки — тоже несравнимы, а не «сравнили по трём примерам»', () => {
    const a = R.aggregateDaily({ '2026-01-01': day({
        'integer+:add:1': [48, 2, 5], 'integer+:add:4': [2, 0, 9]
    }) }, null, null);
    const b = R.aggregateDaily({ '2026-01-02': day({ 'integer+:add:4': [40, 20, 9] }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq(cmp.mode, 'incomparable', 'режим');
});

test('поправка работает и в обратную сторону: примеры стали проще', () => {
    // Рост точности на подешевевших примерах — такая же неправда, как спад на
    // подорожавших. Проверяем, что режим меняется и здесь, а не только при росте.
    const a = R.aggregateDaily({ '2026-01-01': day({ 'integer+:add:5': [30, 30, 9] }) }, null, null);
    const b = R.aggregateDaily({ '2026-01-02': day({ 'integer+:add:1': [58, 2, 4] }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq(cmp.mode, 'incomparable', 'режим');
    assert(cmp.levelTo < cmp.levelFrom, 'сложность должна была упасть');
});

test('колебание внутри звезды сравнение не отменяет', () => {
    // Порог — треть звезды. Сдвиг на 0.2 не должен ничего ломать: иначе оговорка
    // «сложность сменилась» будет висеть почти всегда и перестанет что-то значить.
    const a = R.aggregateDaily({ '2026-01-01': day({
        'integer+:add:1': [40, 0, 5], 'integer+:add:2': [10, 0, 5]
    }) }, null, null);
    const b = R.aggregateDaily({ '2026-01-02': day({
        'integer+:add:1': [30, 0, 5], 'integer+:add:2': [20, 0, 5]
    }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq((cmp.levelTo - cmp.levelFrom).toFixed(1), '0.2', 'сдвиг сложности');
    eq(cmp.mode, 'plain', 'режим');
});

test('порог сложности — величина, а не «любой сдвиг»', () => {
    // Тест формы, а не таблицы: он не читает LEVEL_SHIFT_MIN, а проверяет, что
    // существует ненулевой зазор, внутри которого сравнение остаётся прямым.
    assert(R.LEVEL_SHIFT_MIN > 0, 'порог должен быть больше нуля');
    assert(R.LEVEL_SHIFT_MIN < 1, 'порог в целую звезду пропускал бы настоящие переходы');
});

test('пустая первая половина не делает сложность несравнимой', () => {
    // Самый обычный случай: ученик начал заниматься в середине периода. Звёздность
    // первой половины неизвестна, и без явной проверки на null сравнение уходило бы
    // в ветку «сложность сменилась», где отчёт зовёт levelFrom.toFixed() у пустоты
    // и падает целиком. Прямое сравнение здесь — единственный честный вариант.
    const a = R.aggregateDaily({}, '9999-01-01', '9999-01-01');
    const b = R.aggregateDaily({ '2026-01-02': day({ 'integer+:add:3': [40, 10, 7] }) }, null, null);
    const cmp = R.compareHalves(a, b, 15);
    eq(cmp.mode, 'plain', 'режим');
    eq(cmp.levelFrom, null, 'звёздность первой половины неизвестна');
});

test('однодневный период: половин нет, режим прямой', () => {
    const empty = R.aggregateDaily({}, '9999-01-01', '9999-01-01');
    eq(R.compareHalves(empty, empty, 15).mode, 'plain', 'режим');
});

group('Абзац для родителей');

// Журнал на N дней назад от опорной даты. Даты фиксированные: абзац читает календарь,
// и «сегодня» в тестах должно быть тем же самым при любом прогоне.
const TO = '2026-08-31';
function keyBack(n) {
    const dt = new Date(TO + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() - n);
    return dt.toISOString().slice(0, 10);
}
// days: { сколькоДнейНазад: {темаКлюч: [верно, неверно, сек]} }
function state(days, unlocks) {
    const daily = {};
    Object.keys(days).forEach(back => { daily[keyBack(Number(back))] = day(days[back]); });
    return { daily, unlocks: unlocks || {} };
}
const FROM = keyBack(29);
const summary = (st, from, to, word, oneDay) =>
    R.parentSummaryLines(st, from || FROM, to || TO, word || 'За месяц', !!oneDay);
function hasLine(lines, part, what) {
    if (!lines.some(l => l.indexOf(part) >= 0))
        throw new Error(`${what}: нет строки с «${part}». Получили:\n      ${lines.join('\n      ')}`);
}
function noLine(lines, part, what) {
    if (lines.some(l => l.indexOf(part) >= 0))
        throw new Error(`${what}: лишняя строка с «${part}». Получили:\n      ${lines.join('\n      ')}`);
}

test('пустой период — ровно одна строка и никакой воды', () => {
    const lines = summary(state({}));
    eq(lines.length, 1, 'строк');
    eq(lines[0], 'За месяц занятий не было.', 'текст');
});

test('обычный период начинается с ритма', () => {
    const lines = summary(state({ 5: { 'integer+:add:1': [45, 5, 5] } }));
    eq(lines[0], 'За месяц — 1 занятие, решено 50 примеров, 90% верных.', 'первая строка');
});

test('склонения в первой строке живые, а не «1 занятий»', () => {
    const one = summary(state({ 5: { 'integer+:add:1': [1, 0, 5] } }));
    eq(one[0], 'За месяц — 1 занятие, решено 1 пример, 100% верных.', 'единица');
    const two = summary(state({ 5: { 'integer+:add:1': [2, 0, 5] }, 6: { 'integer+:add:1': [2, 0, 5] } }));
    hasLine(two, '2 занятия, решено 4 примера', 'двойка');
    const five = summary(state({ 5: { 'integer+:add:1': [5, 0, 5] } }));
    hasLine(five, 'решено 5 примеров', 'пятёрка');
});

test('ученик, который занимался и пропал, — это видно', () => {
    // Именно ради этой строки всё и затевалось: без неё отчёт за месяц у пропавшего
    // ученика выглядел прилично, потому что средние считались по тем дням, что были.
    const lines = summary(state({ 25: { 'integer+:add:1': [45, 5, 5] }, 24: { 'integer+:add:1': [45, 5, 5] } }));
    hasLine(lines, 'Последние 3 недели занятий не было', 'тишина');
});

test('свежий пропуск в неделю тоже назван, но словом «неделю»', () => {
    const lines = summary(state({ 9: { 'integer+:add:1': [45, 5, 5] } }));
    hasLine(lines, 'Последнюю неделю занятий не было', 'тишина');
});

test('занимался вчера — про тишину ни слова', () => {
    const lines = summary(state({ 1: { 'integer+:add:1': [45, 5, 5] } }));
    noLine(lines, 'занятий не было', 'тишина');
});

test('награды называются именами, а не «ступенями»', () => {
    const lines = summary(state(
        { 5: { 'integer+:add:1': [45, 5, 5] } },
        { 'integer+:add:1:a3': keyBack(4), 'integer+:add:1:c2': keyBack(4) }
    ));
    hasLine(lines, 'Новые награды: сложение положительных чисел, 1★ — золото по точности и серебро по количеству', 'награды');
    noLine(lines, 'ступен', 'внутренний словарь');
    noLine(lines, 'лесен', 'внутренний словарь');
});

test('одинаковая ступень на двух лесенках не повторяет своё имя дважды', () => {
    const lines = summary(state(
        { 5: { 'integer+:add:1': [45, 5, 5] } },
        { 'integer+:add:1:a4': keyBack(4), 'integer+:add:1:s4': keyBack(4) }
    ));
    hasLine(lines, 'алмаз по точности и по скорости', 'сведение ступени');
    noLine(lines, 'алмаз по точности и алмаз', 'повтор');
});

test('бронза наградой не считается', () => {
    // Бронза по количеству — двадцать пять примеров. Назвать её наградой значит
    // хвалить за то, что приложение открыли.
    const lines = summary(state(
        { 5: { 'integer+:add:1': [45, 5, 5] } },
        { 'integer+:add:1:c1': keyBack(4), 'integer+:add:1:a1': keyBack(4) }
    ));
    noLine(lines, 'Новые награды', 'бронза');
    noLine(lines, 'бронза', 'бронза');
});

test('награды вне периода в отчёт не попадают', () => {
    const lines = summary(state(
        { 5: { 'integer+:add:1': [45, 5, 5] } },
        { 'integer+:add:1:a3': keyBack(200) }
    ));
    noLine(lines, 'Новые награды', 'старая награда');
});

test('открытая звезда названа отдельной строкой', () => {
    const lines = summary(state(
        { 5: { 'integer+:add:1': [45, 5, 5] } },
        { 'integer+:add:1:a3': keyBack(4), 'integer+:add:1:c3': keyBack(4) }
    ));
    hasLine(lines, 'Открыта новая звезда: сложение положительных чисел, 1★', 'ворота');
});

test('у новичка «начали новое» не пишется — у него ново всё', () => {
    const lines = summary(state({ 5: { 'integer+:mul:3': [45, 5, 5] } }));
    noLine(lines, 'Начали новое', 'новичок');
});

test('у того, кто занимался раньше, новая тема названа', () => {
    const st = state({
        40: { 'integer+:add:1': [45, 5, 5] },     // было до периода
        5: { 'integer+:add:1': [20, 2, 5], 'integer+:mul:3': [30, 5, 7] }
    });
    const lines = summary(st);
    hasLine(lines, 'Начали новое: умножение положительных чисел, 3★', 'новая тема');
});

test('случайные пять примеров новой темой не считаются', () => {
    const st = state({
        40: { 'integer+:add:1': [45, 5, 5] },
        5: { 'integer+:add:1': [45, 5, 5], 'integer+:mul:3': [2, 0, 7] }
    });
    noLine(summary(st), 'Начали новое', 'случайные попытки');
});

test('движение показывается только когда оно значимое', () => {
    // Точность 88% → 90%: два пункта. Это колебание замера, а не новость.
    const st = state({ 25: { 'integer+:add:1': [88, 12, 5] }, 5: { 'integer+:add:1': [90, 10, 5] } });
    noLine(summary(st), 'Точность', 'мелкое движение');
    // А четыре пункта — уже новость.
    const st2 = state({ 25: { 'integer+:add:1': [86, 14, 5] }, 5: { 'integer+:add:1': [90, 10, 5] } });
    hasLine(summary(st2), 'Точность выросла: с 86% до 90%.', 'значимое движение');
});

test('порог значимости — величина, а не «любое изменение»', () => {
    assert(R.PARENT_ACC_MIN_DELTA > 0, 'порог должен быть больше нуля');
    assert(R.PARENT_ACC_MIN_DELTA < 10, 'порог в десять пунктов молчал бы почти всегда');
});

test('переход на сложное не выдаётся за спад', () => {
    const st = state({
        25: { 'integer+:add:1': [90, 10, 5] },
        5: { 'integer+:add:4': [50, 50, 9] }
    });
    const lines = summary(st);
    hasLine(lines, 'перешли на более сложные примеры', 'переход');
    noLine(lines, 'Точность снизилась', 'ложный спад');
});

test('откат на простое не выдаётся за рост', () => {
    const st = state({
        25: { 'integer+:add:5': [50, 50, 9] },
        5: { 'integer+:add:1': [95, 5, 4] }
    });
    const lines = summary(st);
    hasLine(lines, 'примеры были проще', 'откат');
    noLine(lines, 'Точность выросла', 'ложный рост');
});

test('за один день про динамику молчим', () => {
    const st = state({ 0: { 'integer+:add:1': [45, 5, 5] } });
    const lines = summary(st, TO, TO, 'Сегодня', true);
    eq(lines[0], 'Сегодня решено 50 примеров, 90% верных.', 'первая строка');
    noLine(lines, 'Точность', 'динамика за день');
    noLine(lines, 'занятий не было', 'тишина за день');
});

test('в абзаце нет ни рода, ни внутреннего словаря', () => {
    // Пол по имени не угадывается, имени в тексте нет вовсе — значит, не должно быть
    // и слов, которые его требуют. Проверяем сразу на всех ветках сборки.
    const cases = [
        state({}),
        state({ 5: { 'integer+:add:1': [45, 5, 5] } }, { 'integer+:add:1:a3': keyBack(4) }),
        state({ 25: { 'integer+:add:1': [90, 10, 5] }, 5: { 'integer+:add:4': [50, 50, 9] } }),
        state({ 40: { 'integer+:add:1': [45, 5, 5] }, 5: { 'integer+:mul:3': [45, 5, 7] } }),
        state({ 25: { 'integer+:add:1': [45, 5, 5] } })
    ];
    const banned = ['лся', 'лась', 'ступен', 'лесен', 'класс', '(-а', 'ошиб'];
    cases.forEach((st, i) => {
        const text = summary(st).join(' ');
        banned.forEach(w => {
            if (text.indexOf(w) >= 0) throw new Error(`случай ${i}: в тексте есть «${w}» — ${text}`);
        });
    });
});

test('комментарий репетитора стоит первым, а не под цифрами', () => {
    // Имя и обращение пишет репетитор — значит, сообщение родителю обязано начинаться
    // с его строки. Иначе оно открывается словами «За месяц — 1 занятие».
    const st = state({ 5: { 'integer+:add:1': [45, 5, 5] } });
    const text = R.parentSummaryText(st, FROM, TO, 'За месяц', false, 'Здравствуйте! Маша молодец.');
    const lines = text.split('\n');
    eq(lines[0], 'Здравствуйте! Маша молодец.', 'первая строка');
    eq(lines[1], '', 'пустая строка между комментарием и цифрами');
    assert(lines[2].indexOf('За месяц') === 0, 'дальше идут цифры');
});

test('без комментария сообщение начинается сразу с цифр и без пустых строк', () => {
    const st = state({ 5: { 'integer+:add:1': [45, 5, 5] } });
    const text = R.parentSummaryText(st, FROM, TO, 'За месяц', false, '   ');
    assert(text.indexOf('За месяц') === 0, 'начало');
    assert(text.indexOf('\n\n') < 0, 'лишних пустых строк нет');
});

test('названия тем — слова, а не подписи из интерфейса', () => {
    eq(R.parentTopicWords('integer+:add:1'), 'сложение положительных чисел, 1★', 'положительные');
    eq(R.parentTopicWords('integer-:mul:5'), 'умножение отрицательных чисел, 5★', 'отрицательные');
    eq(R.parentTopicWords('decimal+:div:2'), 'деление десятичных дробей, 2★', 'десятичные');
    eq(R.parentTopicWords('fraction+:add:3'), 'сложение дробей, 3★', 'дроби');
    // У дробных действий предмет уже назван в самом действии — второй раз не приписываем.
    eq(R.parentTopicWords('fraction+:simplify:1'), 'сокращение дробей, 1★', 'сокращение');
});

group('Дни занятий');

// Журнал: { сколькоДнейНазадОтTO: числоПримеров }
function daysJournal(map) {
    const daily = {};
    Object.keys(map).forEach(back => {
        const n = map[back];
        daily[keyBack(Number(back))] = Object.assign(day({ 'integer+:add:1': [n, 0, 5] }), {});
    });
    return daily;
}

test('счёт по дням покрывает весь период, включая пустые дни', () => {
    const daily = daysJournal({ 5: 10, 2: 20 });
    const counts = R.dayCounts(daily, keyBack(6), TO);
    eq(counts.length, 7, 'дней в периоде');
    eq(counts.filter(d => d.n > 0).length, 2, 'активных дней');
    eq(counts[counts.length - 1].key, TO, 'последний день — конец периода');
});

test('итоги считают активные дни, перерыв и среднее за занятие', () => {
    // Занимался 6 и 2 дня назад по 10 и 20 примеров: между ними три пустых дня.
    const daily = daysJournal({ 6: 10, 2: 20 });
    const sum = R.daysSummary(R.dayCounts(daily, keyBack(6), TO));
    eq(sum.activeDays, 2, 'активных дней');
    eq(sum.spanDays, 7, 'дней в периоде');
    eq(sum.gap, 3, 'самый долгий перерыв');
    eq(sum.perDay, 15, 'в среднем за занятие');
});

test('перерыв считается от первого занятия, а не от начала периода', () => {
    // Ученик начал в середине периода. Пустые дни ДО начала — не пропуск: записывать
    // их в перерыв значит обвинять человека в том, что он ещё не начинал.
    const daily = daysJournal({ 2: 20, 1: 20 });
    const sum = R.daysSummary(R.dayCounts(daily, keyBack(20), TO));
    eq(sum.activeDays, 2, 'активных дней');
    eq(sum.gap, 1, 'перерыв — только сегодняшний пустой день, а не восемнадцать до начала');
});

test('период без занятий итогов не даёт', () => {
    eq(R.daysSummary(R.dayCounts({}, keyBack(6), TO)), null, 'итоги');
});

test('насыщенность клетки считается от медианы, а не от максимума', () => {
    // Один рекордный день иначе перекрашивает все остальные в бледное.
    eq(R.dayShade(0, 40), 'zero', 'пустой день');
    eq(R.dayShade(40, 40), 'd3', 'ровно медиана');
    eq(R.dayShade(80, 40), 'd4', 'вдвое выше медианы');
    eq(R.dayShade(10, 40), 'd1', 'сильно ниже медианы');
    eq(R.dayShade(5, 0), 'd3', 'без медианы — средний оттенок, а не пустота');
});

test('порог перехода на недели — около полутора месяцев', () => {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const limit = Number((src.match(/const DAY_CALENDAR_MAX_DAYS = (\d+);/) || [])[1]);
    assert(limit, 'порог DAY_CALENDAR_MAX_DAYS не найден');
    // Календарь по дням дальше не читается, но и переключаться на недели раньше месяца
    // нельзя: там календарь как раз и полезен.
    assert(limit >= 31, `порог ${limit} — месяц должен показываться днями`);
    assert(limit <= 70, `порог ${limit} — на таком периоде календарь по дням станет простынёй`);
});

group('Два вида экрана статистики');

// Здесь проверяется не отрисовка, а само правило: что скрыто от ребёнка и уцелели ли
// после переименований те идентификаторы, на которые правило ссылается. Именно это
// ломается молча — блок переименовали, строку в списке не поправили, и ребёнок начал
// видеть разбор ошибок, а заметить это можно только глазами на живом устройстве.
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function jsList(name) {
    // Без регулярных выражений: границы списка ищем по тексту, комментарии вырезаем.
    const head = 'const ' + name + ' = [';
    const from = HTML.indexOf(head);
    if (from < 0) throw new Error('не найден список ' + name);
    const to = HTML.indexOf('];', from);
    return HTML.slice(from + head.length, to)
        .split('\n').map(l => l.replace(/\/\/.*$/, '')).join(' ')
        .split(',').map(x => x.trim()).filter(Boolean)
        .map(x => (x[0] === "'" ? x.slice(1, -1) : Number(x)));
}

test('все блоки «только репетитору» существуют в вёрстке', () => {
    const ids = jsList('STATS_TUTOR_ONLY');
    assert(ids.length >= 4, `в списке всего ${ids.length} блоков — похоже, он потерялся`);
    ids.forEach(id => {
        assert(HTML.indexOf('id="' + id + '"') >= 0,
            `блок ${id} закрыт от ребёнка, но такого id в вёрстке нет`);
    });
});

test('оценочные блоки закрыты от ребёнка, а собранное — открыто', () => {
    const ids = jsList('STATS_TUTOR_ONLY');
    // Разбор ошибок и проценты по темам — оценка, их ребёнок видеть не должен.
    ['statsMistakesSection', 'statsCellMistakesSection', 'statsTopicSection', 'statsTrendSection']
        .forEach(id => assert(ids.indexOf(id) >= 0, `${id} должен быть закрыт от ребёнка`));
    // Дни занятий закрыты по другой причине, не «это оценка»: ребёнку тот же самый
    // ритм показан лучше — счётчиком «дней подряд» в карточках наверху. Тот говорит
    // «продолжай серию», календарь пропусков — «вот где ты не занимался»; работает
    // первое. А календарь с итогами стал инструментом разбора, то есть учительским.
    assert(ids.indexOf('statsStripSection') >= 0, 'дни занятий должны быть закрыты от ребёнка');
    // Карта и эпохи — это собранное: они остаются обоим.
    ['statsMapSection', 'statsEpochsSection']
        .forEach(id => assert(ids.indexOf(id) < 0, `${id} закрывать от ребёнка не надо`));
});

test('период по умолчанию есть в детском наборе', () => {
    // Иначе у ребёнка не окажется ни одной выбранной кнопки: значение выбрано, а кнопки,
    // которая его показывает, на экране нет.
    const child = jsList('CHILD_PERIODS');
    const def = Number((HTML.match(/let statsPeriod = (\d+);/) || [])[1]);
    assert(child.length >= 2, 'детских периодов должно остаться хотя бы два');
    assert(child.indexOf(def) >= 0, `период по умолчанию ${def} не входит в детский набор`);
});

test('каждый детский период есть среди кнопок на экране', () => {
    jsList('CHILD_PERIODS').forEach(p => {
        assert(HTML.indexOf('data-period="' + p + '"') >= 0,
            `у детского периода ${p} нет кнопки в вёрстке`);
    });
});

group('Подписи в списке учеников');

test('pluralDays не падает и склоняет верно', () => {
    // Здесь стояло `const t = n % 100`, затиравшее функцию перевода: любой вызов
    // бросал TypeError и уносил с собой весь список учеников.
    eq(R.pluralDays(1), 'день', '1');
    eq(R.pluralDays(2), 'дня', '2');
    eq(R.pluralDays(5), 'дней', '5');
    eq(R.pluralDays(11), 'дней', '11');
    eq(R.pluralDays(14), 'дней', '14');
    eq(R.pluralDays(21), 'день', '21');
    eq(R.pluralDays(22), 'дня', '22');
    eq(R.pluralDays(25), 'дней', '25');
    eq(R.pluralDays(111), 'дней', '111');
});

test('pluralStudents не падает и склоняет верно', () => {
    eq(R.pluralStudents(1), 'ученик', '1');
    eq(R.pluralStudents(3), 'ученика', '3');
    eq(R.pluralStudents(7), 'учеников', '7');
    eq(R.pluralStudents(12), 'учеников', '12');
    eq(R.pluralStudents(21), 'ученик', '21');
});

test('склонения не зовут наружу ничего — только возвращают строку', () => {
    // Прямая защита от возврата затирания: если внутри снова появится локальное t,
    // любой вызов бросит TypeError, и этот прогон по всем остаткам это покажет.
    for (let n = 0; n <= 120; n++) {
        assert(typeof R.pluralDays(n) === 'string', `pluralDays(${n}) вернул не строку`);
        assert(typeof R.pluralStudents(n) === 'string', `pluralStudents(${n}) вернул не строку`);
    }
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
