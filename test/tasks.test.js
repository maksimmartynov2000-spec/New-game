// Тесты заданий дня и недели.
//
// Зачем: заданий нигде не хранится — они выводятся из даты и логина, а выполнены или
// нет, видно из журнала. Это и есть их главная опасность: если выбор перестанет быть
// детерминированным, задание будет меняться прямо под ребёнком в течение дня, а
// «сделано 9 из 10» превратится в бессмыслицу. Ни одно поле в сохранении при этом не
// заводится, так что и починить задним числом будет нечего.
//
// Второе опасное место — предпочтение заданий про КОНКРЕТНУЮ клетку. Ради них всё и
// затевалось: у такого задания есть кнопка «Играть», которая уводит прямо в нужную
// миссию. Первый же прогон на живых данных выдал три общих задания подряд, без единой
// кнопки, — поэтому теперь клеточные берутся первыми, а общие только добивают остаток.
//
// Как запускать:  node test/tasks.test.js

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

const TODAY = '2026-09-10';     // четверг
const MONDAY = '2026-09-07';

function load() {
    const box = {
        console, Math, Number, Object, Array, String, JSON, Date,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        COUNT_TIERS: [25, 60, 100, 150, 250],
        TIER_NAMES: ['', 'Бронза', 'Серебро', 'Золото', 'Алмаз', 'Легенда'],
        topicLabelWithLevel: (k) => k,
        Progress: { dayKey: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(
        slice('function shiftDayKey(key, deltaDays)', 'function isActiveDay', 'даты')
        + slice('function isActiveDay(d)', 'function aggregateDaily', 'активный день')
        + slice('function parseTopicKey(key) {', '// Ключ для ОТОБРАЖЕНИЯ', 'разбор ключа')
        + slice('// ===================== ЗАДАНИЯ ДНЯ И НЕДЕЛИ', '        // Отрисовка заданий', 'задания')
        + '\n;globalThis.T = { dailyTasks, weeklyTask, weekStartKey, recentCells,'
        + ' taskAggregate, evalTask, DAILY_TASK_COUNT, TASK_MIN_SAMPLE };',
        box, { filename: 'index.html<задания>' });
    return box.T;
}
const T = load();

// день: сколько верных/ошибок всего и по клеткам { ключ: [верных, ошибок] }
function day(c, w, cells) {
    const t = {};
    Object.keys(cells || {}).forEach(k => (t[k] = [cells[k][0], cells[k][1], 0, 1000, cells[k][0]]));
    return { c, w, a: 0, s: 60, p: 0, ms: 1000, mc: c, t, e: {}, te: {} };
}
// журнал: { смещение_в_днях_назад: запись }
function journal(map) {
    const out = {};
    Object.keys(map).forEach(off => {
        const [y, m, d] = TODAY.split('-').map(Number);
        const dt = new Date(y, m - 1, d - Number(off));
        out[`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`] = map[off];
    });
    return out;
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

const busy = () => ({ daily: journal({
    3: day(20, 2, { 'integer+:add:2': [18, 2], 'integer+:sub:1': [2, 0] }),
    2: day(20, 2, { 'integer+:add:2': [18, 2], 'integer+:sub:1': [2, 0] }),
    1: day(20, 2, { 'integer+:add:2': [18, 2], 'integer+:sub:1': [2, 0] }),
    0: day(5, 1, { 'integer+:add:2': [5, 1] })
}), byTopic: { 'integer+:add:2': { correct: 44, wrong: 9 } } });

group('Задания не хранятся, а выводятся');

test('одна и та же дата даёт один и тот же набор', () => {
    const a = T.dailyTasks(busy(), TODAY, 'ЯР7');
    const b = T.dailyTasks(busy(), TODAY, 'ЯР7');
    eq(JSON.stringify(a.map(x => x.text)), JSON.stringify(b.map(x => x.text)));
});

test('другой день — другой набор', () => {
    const a = T.dailyTasks(busy(), TODAY, 'ЯР7').map(x => x.text + x.need).join('|');
    const b = T.dailyTasks(busy(), '2026-09-11', 'ЯР7').map(x => x.text + x.need).join('|');
    assert(a !== b, 'наборы совпали — задания не меняются день ото дня');
});

test('у разных учеников задания разные', () => {
    const a = T.dailyTasks(busy(), TODAY, 'ЯР7').map(x => x.text + x.need).join('|');
    const b = T.dailyTasks(busy(), TODAY, 'АУР').map(x => x.text + x.need).join('|');
    assert(a !== b, 'два ученика получили один набор — логин не участвует в выборе');
});

test('заданий ровно три', () => {
    eq(T.dailyTasks(busy(), TODAY, 'ЯР7').length, T.DAILY_TASK_COUNT);
});

group('Клетка важнее общего задания');

test('когда есть где заниматься — все задания с кнопкой', () => {
    // Первый прогон на живых данных выдал три общих задания подряд, ни одной кнопки.
    const list = T.dailyTasks(busy(), TODAY, 'ЯР7');
    const without = list.filter(x => !x.go).map(x => x.text);
    eq(without.join(', '), '', `задания без кнопки: ${without.join(', ')}`);
});

test('кнопка ведёт в ту клетку, о которой задание', () => {
    const task = T.dailyTasks(busy(), TODAY, 'ЯР7').filter(x => x.go)[0];
    eq(task.go.secKey, 'integer+', 'раздел');
    assert(['add', 'sub'].indexOf(task.go.op) >= 0, `неожиданное действие: ${task.go.op}`);
    assert(task.go.level >= 1 && task.go.level <= 5, `неожиданная звезда: ${task.go.level}`);
});

test('новичку без истории задания всё равно есть, но без кнопки', () => {
    const list = T.dailyTasks({ daily: {} }, TODAY, 'НОВ');
    assert(list.length > 0, 'новичок остался без заданий');
    assert(list.every(x => !x.go), 'кнопка ведёт неизвестно куда');
});

test('клетки берутся только свежие', () => {
    // Задание про клетку, которую не открывали месяц, отправило бы с нуля.
    const old = { daily: journal({ 40: day(20, 0, { 'integer+:mul:3': [20, 0] }) }) };
    eq(T.recentCells(old.daily, TODAY, 14).length, 0, 'старая клетка попала в свежие');
});

test('старый ключ без звезды в задания не идёт', () => {
    const legacy = { daily: journal({ 1: day(20, 0, { 'integer+:add': [20, 0] }) }) };
    eq(T.recentCells(legacy.daily, TODAY, 14).length, 0, 'ключ без звезды прошёл — кнопка вела бы в никуда');
});

group('Проверка выполнения');

test('счёт идёт по той клетке, о которой задание, а не по всему дню', () => {
    const agg = T.taskAggregate(busy().daily, TODAY, TODAY, 'integer+:add:2');
    eq(agg.correct, 5, 'верных в клетке за сегодня');
    const all = T.taskAggregate(busy().daily, TODAY, TODAY, null);
    eq(all.correct, 5, 'верных за день всего');
});

test('точность не засчитывается на малой выборке', () => {
    const task = { kind: 'accuracy', need: 90 };
    const few = T.evalTask(task, { correct: 3, wrong: 0, days: 1, cells: 1 });
    eq(few.have, null, 'по трём ответам о точности говорить нельзя');
    eq(few.done, false, 'засчитали 100% по трём ответам');
    const enough = T.evalTask(task, { correct: 12, wrong: 0, days: 1, cells: 1 });
    eq(enough.have, 100, 'точность');
    eq(enough.done, true, 'не засчитали честные 100%');
});

test('«без единой ошибки» не засчитывается при ошибке', () => {
    const task = { kind: 'clean', need: 10 };
    eq(T.evalTask(task, { correct: 12, wrong: 1, days: 1, cells: 1 }).done, false, 'ошибка была');
    eq(T.evalTask(task, { correct: 12, wrong: 0, days: 1, cells: 1 }).done, true, 'ошибок не было');
});

test('«без единой ошибки» не даётся за ноль решённых', () => {
    // Ноль из нуля — не подвиг.
    eq(T.evalTask({ kind: 'clean', need: 10 }, { correct: 0, wrong: 0, days: 0, cells: 0 }).done, false);
});

group('Неделя');

test('неделя начинается с понедельника', () => {
    eq(T.weekStartKey(TODAY), MONDAY, 'четверг');
    eq(T.weekStartKey(MONDAY), MONDAY, 'сам понедельник');
    eq(T.weekStartKey('2026-09-13'), MONDAY, 'воскресенье принадлежит той же неделе');
});

test('недельное задание одно и держится всю неделю', () => {
    const a = T.weeklyTask(busy(), TODAY, 'ЯР7');
    const b = T.weeklyTask(busy(), '2026-09-08', 'ЯР7');   // вторник той же недели
    assert(a && b, 'недельное задание пропало');
    eq(a.text, b.text, 'задание сменилось посреди недели');
});

test('до ступени обещаем только когда она реально достижима за неделю', () => {
    // 44 верных, до серебра (60) — 16. Меньше двадцати: за ступень такое не выдаём.
    const near = T.weeklyTask(busy(), TODAY, 'ЯР7');
    if (near.tier) assert(near.need >= 20 && near.need <= 80, `обещали ступень с недобором ${near.need}`);
});

test('недельное считается с понедельника, а не за сегодня', () => {
    const w = T.weeklyTask(busy(), TODAY, 'ЯР7');
    assert(w.have > 5, `в недельный счёт попал только сегодняшний день: ${w.have}`);
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
