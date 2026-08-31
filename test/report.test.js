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

    // Срез 1: агрегация журнала и сравнение половин (вместе с isActiveDay, на который
    // агрегация опирается при подсчёте дней занятий).
    const agg = slice('function isActiveDay(d)',
                      '// Самая длинная череда дней подряд', 'агрегация');
    // Срез 2: множественные числа из списка учеников.
    const plur = slice('function pluralDays(n)', 'function lastSeenText(iso)', 'склонения');
    // parseTopicKey живёт выше и нужен avgLevelOf.
    const parse = slice('function parseTopicKey(key)', '// Ключ для ОТОБРАЖЕНИЯ', 'parseTopicKey');

    const sandbox = { console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN,
                      t: (x) => x, tf: (x) => x };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext([parse, agg, plur].join('\n')
        + '\n;globalThis.aggregateDaily = aggregateDaily;'
        + '\n;globalThis.avgLevelOf = avgLevelOf;'
        + '\n;globalThis.compareHalves = compareHalves;'
        + '\n;globalThis.LEVEL_SHIFT_MIN = LEVEL_SHIFT_MIN;'
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
