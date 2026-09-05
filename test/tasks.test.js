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
// index.html разрезан на файлы: метки срезов ищем по всему коду приложения,
// а не только во встроенном скрипте (см. test/app-source.js).
const SCRIPT = require('./app-source').appScript(HTML);

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

const TODAY = '2026-09-10';     // четверг
const MONDAY = '2026-09-07';

function load(opts) {
    const o = opts || {};
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
        // Открытые клетки задаёт сам тест: подбор заданий теперь смотрит не только на
        // то, где ученик был, но и на то, куда ему вообще можно пойти.
        MAP_SECTIONS: [{ cat: 'integer', sign: '+', label: '', ops: ['add', 'sub', 'mul', 'div'] }],
        isLevelOpen: (secKey, op, lvl) => (o.open ? o.open.indexOf(`${secKey}:${op}:${lvl}`) >= 0 : lvl <= 2),
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
        + ' taskAggregate, evalTask, DAILY_TASK_COUNT, TASK_MIN_SAMPLE,'
        + ' roleAdvance, roleFix, roleExplore, openCells, cellForm };',
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

test('у адресных заданий всегда есть кнопка', () => {
    // Первый прогон на живых данных выдал три общих задания подряд, ни одной кнопки.
    // Общее задание без клетки допустимо только как добивка, когда ролей не хватило.
    const list = T.dailyTasks(busy(), TODAY, 'ЯР7');
    const roleTasks = list.filter(x => x.role);
    assert(roleTasks.length >= 2, `ролевых заданий всего ${roleTasks.length}`);
    const without = roleTasks.filter(x => !x.go).map(x => x.text);
    eq(without.join(', '), '', `ролевое задание без кнопки: ${without.join(', ')}`);
});

test('кнопка ведёт в ту клетку, о которой задание', () => {
    const task = T.dailyTasks(busy(), TODAY, 'ЯР7').filter(x => x.go)[0];
    eq(task.go.secKey, 'integer+', 'раздел');
    assert(['add', 'sub'].indexOf(task.go.op) >= 0, `неожиданное действие: ${task.go.op}`);
    assert(task.go.level >= 1 && task.go.level <= 5, `неожиданная звезда: ${task.go.level}`);
});

test('совсем пустому аккаунту задания дают, но общие', () => {
    // Вести некуда: открытых клеток нет, истории нет. Это нормальная первая неделя
    // нового ученика, а не сбой — как появится история, задания станут адресными.
    const w = load({ open: [] });
    const list = w.dailyTasks({ daily: {} }, TODAY, 'НОВ');
    assert(list.length > 0, 'новичок остался без заданий');
    assert(list.every(x => !x.go), 'кнопка ведёт в клетку, которая ему не открыта');
});

test('новичку с открытыми клетками сразу показывают, куда пойти', () => {
    const list = T.dailyTasks({ daily: {} }, TODAY, 'НОВ');
    const explore = list.filter(x => x.role === 'explore')[0];
    assert(explore && explore.go, 'некуда позвать, хотя открытые клетки есть');
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

test('недельное задание про регулярность вообще выпадает', () => {
    // Оно лежало в добивке и не выпадало никогда: основное задание есть у любого, кто
    // решил хоть что-нибудь, и занимало единственное место. Мёртвая ветка, притом
    // обидная — регулярность как раз стоит иногда просить.
    const st = { daily: journal({ 1: day(20, 2, { 'integer+:add:1': [20, 2] }) }),
                 byTopic: { 'integer+:add:1': { correct: 20, wrong: 2 } } };
    const kinds = new Set();
    for (let w = 0; w < 20; w++) {
        const monday = `2026-0${w < 4 ? '9' : '9'}-${String(7 + w * 7).padStart(2, '0')}`;
        const t = T.weeklyTask(st, TODAY, 'ЯР7-' + w);   // разные логины — разные жребии
        if (t) kinds.add(t.kind);
    }
    assert(kinds.has('days'), `задание про регулярность не выпало ни разу: ${[...kinds].join(', ')}`);
});

test('до ступени обещаем только когда она реально достижима за неделю', () => {
    // 44 верных, до серебра (60) — 16. Меньше двадцати: за ступень такое не выдаём.
    const near = T.weeklyTask(busy(), TODAY, 'ЯР7');
    if (near.tier) assert(near.need >= 20 && near.need <= 80, `обещали ступень с недобором ${near.need}`);
});

test('недельное считается с понедельника, а не за сегодня', () => {
    // Вид задания зависит от жребия недели, поэтому сравниваем не с числом, а с тем же
    // счётом за один сегодняшний день: недельный обязан быть больше.
    const w = T.weeklyTask(busy(), TODAY, 'ЯР7');
    const todayOnly = T.taskAggregate(busy().daily, TODAY, TODAY, w.cell);
    const sameForToday = w.kind === 'days' ? todayOnly.days
                       : w.kind === 'correct' ? todayOnly.correct
                       : todayOnly.correct + todayOnly.wrong;
    assert(w.have > sameForToday,
        `в недельный счёт попал только сегодняшний день: ${w.have} против ${sameForToday}`);
});


group('Три роли: куда вести ученика');

// Раньше подбор брал клетку, где ученик БОЛЬШЕ ВСЕГО занимался, — то есть вёл туда,
// где он и так сидит. Теперь у каждого задания своя роль и свой вопрос:
// продвинуться (ближе к ступени), подтянуть (где просела точность), попробовать
// (открытая клетка, куда давно не заходил).

test('«продвинуться» ведёт в клетку, где до ступени ближе всего', () => {
    const st = { daily: journal({ 1: day(20, 0, { 'integer+:add:1': [20, 0], 'integer+:sub:1': [20, 0] }) }),
                 byTopic: { 'integer+:add:1': { correct: 5, wrong: 0 },     // до бронзы 20
                            'integer+:sub:1': { correct: 22, wrong: 0 } } };  // до бронзы 3
    const t = T.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.role === 'advance')[0];
    assert(t, 'роли «продвинуться» нет');
    eq(t.cell, 'integer+:sub:1', 'выбрана не самая близкая клетка');
});

test('«подтянуть» ведёт туда, где точность просела', () => {
    // Клетки нарочно разные: «продвинуться» пойдёт в сложение (до бронзы три ответа),
    // «подтянуть» — в вычитание, где точность 30%. Иначе обе роли указали бы на одну
    // клетку и вторая была бы отброшена как повтор.
    const st = { daily: journal({ 1: day(30, 10, { 'integer+:add:1': [27, 3], 'integer+:sub:1': [3, 7] }) }),
                 byTopic: { 'integer+:add:1': { correct: 22, wrong: 3 }, 'integer+:sub:1': { correct: 3, wrong: 7 } } };
    const t = T.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.role === 'fix')[0];
    assert(t, 'роли «подтянуть» нет');
    eq(t.cell, 'integer+:sub:1', 'подтягиваем не ту клетку');
});

test('при совсем низкой точности просят примеры, а не проценты', () => {
    // 30% — это не небрежность, а незнание клетки. Любая планка в процентах тут
    // недостижима сегодня и висела бы невыполненной каждый день.
    // Клетки нарочно разные: «продвинуться» пойдёт в сложение (до бронзы три ответа),
    // «подтянуть» — в вычитание. Иначе обе роли указали бы на одну клетку.
    const st = { daily: journal({ 1: day(30, 10, { 'integer+:add:1': [27, 3], 'integer+:sub:1': [3, 7] }) }),
                 byTopic: { 'integer+:add:1': { correct: 22, wrong: 3 }, 'integer+:sub:1': { correct: 3, wrong: 7 } } };
    const t = T.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.role === 'fix')[0];
    eq(t.kind, 'count', `при 30% точности требуют процент: ${t.text}`);
    eq(t.cell, 'integer+:sub:1', 'тренируем не ту клетку');
});

test('цель по точности берётся от ученика, а не константой', () => {
    // «Набери 90%» при нынешних 64% — заметно выше, чем берётся за день.
    const st = { daily: journal({ 1: day(40, 12, { 'integer+:add:1': [22, 2], 'integer+:sub:1': [18, 10] }) }),
                 byTopic: { 'integer+:add:1': { correct: 22, wrong: 2 }, 'integer+:sub:1': { correct: 18, wrong: 10 } } };
    const t = T.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.role === 'fix')[0];
    eq(t.kind, 'accuracy', `при 64% ждали планку по точности, получили: ${t.text}`);
    assert(t.need > 64 && t.need <= 75, `цель ${t.need}% не похожа на шаг от нынешних 64%`);
});

test('«попробовать» вытаскивает того, кто закопался в одной клетке', () => {
    // Ровно случай «закончил сложение на одной звезде»: месяц одно и то же.
    const st = { daily: journal({ 0: day(20, 2, { 'integer+:add:1': [20, 2] }),
                                  1: day(20, 2, { 'integer+:add:1': [20, 2] }),
                                  2: day(20, 2, { 'integer+:add:1': [20, 2] }) }),
                 byTopic: { 'integer+:add:1': { correct: 60, wrong: 6 } } };
    const t = T.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.role === 'explore')[0];
    assert(t, 'ученика не позвали никуда, кроме его клетки');
    assert(t.cell !== 'integer+:add:1', `позвали в ту же клетку: ${t.cell}`);
    assert(t.go, 'у приглашения нет кнопки');
});

test('когда везде побывал недавно — никуда не зовём', () => {
    // Без этого «попробовать» выродилось бы в «сходи туда, где был вчера»: приглашение
    // никуда, занимающее место настоящего задания. Спрашиваем саму роль, а не готовый
    // список: в списке такое приглашение могло бы отсеяться заодно как повтор клетки,
    // и проверка молча ничего бы не проверяла.
    const all = {};
    ['add', 'sub', 'mul', 'div'].forEach(op => { all[`integer+:${op}:1`] = [10, 1]; all[`integer+:${op}:2`] = [10, 1]; });
    const daily = journal({ 0: day(80, 8, all), 1: day(80, 8, all) });
    eq(T.roleExplore(daily, TODAY, T.openCells()), null, 'позвали туда, где ученик был вчера');
});

test('две роли не дают двух заданий про одну клетку', () => {
    // Иначе второе читается как повтор первого.
    const st = { daily: journal({ 1: day(20, 8, { 'integer+:add:1': [20, 8] }) }),
                 byTopic: { 'integer+:add:1': { correct: 20, wrong: 8 } } };
    const cells = T.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell).map(x => x.cell);
    eq(cells.length, new Set(cells).size, `клетки повторяются: ${cells.join(', ')}`);
});

test('порядок ролей не перемешивается жребием', () => {
    // «Продвинуться» важнее, чем «попробовать новое», и это должно быть видно сверху.
    const st = { daily: journal({ 1: day(20, 2, { 'integer+:add:1': [20, 2] }) }),
                 byTopic: { 'integer+:add:1': { correct: 20, wrong: 2 } } };
    const roles = T.dailyTasks(st, TODAY, 'ЯР7').map(x => x.role).filter(Boolean);
    const order = ['advance', 'fix', 'explore'];
    const sorted = roles.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    eq(roles.join(','), sorted.join(','), 'роли перетасовались');
});

test('задания на точность и на количество не выглядят одинаково', () => {
    // Клетки нарочно разные: «продвинуться» пойдёт в сложение (до бронзы три ответа),
    // «подтянуть» — в вычитание, где точность 30%. Иначе обе роли указали бы на одну
    // клетку и вторая была бы отброшена как повтор.
    const st = { daily: journal({ 1: day(30, 10, { 'integer+:add:1': [27, 3], 'integer+:sub:1': [3, 7] }) }),
                 byTopic: { 'integer+:add:1': { correct: 22, wrong: 3 }, 'integer+:sub:1': { correct: 3, wrong: 7 } } };
    const texts = T.dailyTasks(st, TODAY, 'ЯР7').map(x => x.text);
    eq(texts.length, new Set(texts).size, `тексты повторяются: ${texts.join(' | ')}`);
});


group('«Загляни сюда» зовёт в ближайшее, а не в случайное');

// Раньше роль брала клетку с самым большим простоем — и у того, кто недавно прошёлся
// по всем положительным, укатывалась в следующий раздел по списку: со сложения
// положительных приглашение уводило в отрицательное умножение. Это не шаг в сторону,
// а прыжок через полкурса, и выглядело оно случайным.
const ALL_OPEN = [];
['integer+', 'integer-'].forEach(sec => ['add', 'sub', 'mul', 'div'].forEach(op => {
    for (let l = 1; l <= 5; l++) ALL_OPEN.push(`${sec}:${op}:${l}`);
}));
function wide() { return load({ open: ALL_OPEN }); }

test('зовёт на соседнюю звезду того же действия, и вниз, а не вверх', () => {
    // Вверх толкает роль «продвинуться». Эта — про пропущенное, а пропущенное почти
    // всегда осталось внизу: например, после экзамена, который открыл звёзды сразу
    // и оставил нижние клетки пустыми.
    const w = wide();
    const daily = journal({ 0: day(20, 2, { 'integer+:add:4': [20, 2] }) });
    const t = w.roleExplore(daily, TODAY, ALL_OPEN, 'integer+:add:4');
    eq(t.cell, 'integer+:add:3', 'ждали ближайшую непройденную звезду того же действия');
});

test('в другое действие зовёт с низкой звезды, а не с той же', () => {
    // Сила в сложении ничего не говорит о делении: начинать там надо с начала.
    const w = wide();
    const fresh = {};
    for (let l = 1; l <= 5; l++) fresh[`integer+:add:${l}`] = [10, 1];
    const daily = journal({ 0: day(50, 5, fresh), 1: day(50, 5, fresh) });
    const t = w.roleExplore(daily, TODAY, ALL_OPEN, 'integer+:add:4');
    assert(t.cell.indexOf('integer+:') === 0, `ушли из раздела: ${t.cell}`);
    assert(t.cell.indexOf(':add:') < 0, `остались в том же действии: ${t.cell}`);
    assert(t.cell.slice(-1) === '1', `в новом действии зовут не с первой звезды: ${t.cell}`);
});

test('в другой раздел — только когда в своём везде побывал', () => {
    const w = wide();
    const fresh = {};
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let l = 1; l <= 5; l++) fresh[`integer+:${op}:${l}`] = [4, 0];
    });
    const daily = journal({ 0: day(80, 0, fresh), 1: day(80, 0, fresh) });
    const t = w.roleExplore(daily, TODAY, ALL_OPEN, 'integer+:add:4');
    assert(t && t.cell.indexOf('integer-') === 0, `остались в исхоженном разделе: ${t && t.cell}`);
});

test('простой решает только среди одинаково близких', () => {
    // Клетка с огромным простоем в чужом разделе не должна перебивать соседнюю звезду
    // своего действия — именно это и делало приглашение случайным.
    const w = wide();
    const daily = journal({ 0: day(20, 2, { 'integer+:add:4': [20, 2] }),
                            13: day(5, 0, { 'integer-:mul:1': [5, 0] }) });
    const t = w.roleExplore(daily, TODAY, ALL_OPEN, 'integer+:add:4');
    eq(t.cell, 'integer+:add:3', 'дальняя клетка с большим простоем перебила ближнюю');
});

test('без истории зовём в самое начало карты', () => {
    const w = wide();
    const t = w.roleExplore({}, TODAY, ALL_OPEN, null);
    eq(t.cell, 'integer+:add:1', 'новичка позвали не с первой клетки');
});


test('перевыполненное задание не показывает больше цели', () => {
    // «13 из 10» формально верно, но читается как сбой счётчика: цель одна, а число
    // рядом другое. Выполненное показываем ровно как цель.
    const body = slice('const row = (task, isWeek) =>', 'list.forEach', 'строка задания');
    assert(/task\.done \? task\.need/.test(body),
        'счётчик выполненного задания снова показывает набранное, а не цель');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
