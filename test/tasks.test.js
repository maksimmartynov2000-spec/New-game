// Тесты заданий дня и недели.
//
// Зачем: заданий нигде не хранится — они выводятся из даты и логина, а выполнены или
// нет, видно из журнала. Это и есть их главная опасность: если выбор перестанет быть
// детерминированным, задание будет меняться прямо под ребёнком в течение дня, а
// «сделано 9 из 10» превратится в бессмыслицу. Ни одно поле в сохранении при этом не
// заводится, так что и починить задним числом будет нечего.
//
// Второе — КУДА задания ведут. Они единственное место, которое само решает, чем ученику
// заняться, и решать должны как репетитор: по карте звёзд. Снимок Максима от 23 октября
// показал обратное: при открытых умножении 3★, сложении 4★ и вычитании 4★ задания звали
// добрать алмаз за количество в умножении 2★, «подтянуть точность до 90%» там, где экран
// достижений показывал 95%, и вернуться в сложение 1★ с алмазом. Здесь стережётся новый
// порядок: домашка, главное через день (звезда или медаль), подтянуть по последней сотне,
// другое действие, медаль рядом, повторение — и сам тот снимок, чтобы он не вернулся.
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
// Пороги — из самого приложения, а не переписанные сюда: иначе проверка сверяла бы
// копию с копией и молчала бы, когда пороги поменяют.
function constant(name) {
    const m = SCRIPT.match(new RegExp(`const ${name} = ([^;]+);`));
    if (!m) throw new Error(`не найдена константа ${name}`);
    return m[1];
}

const TODAY = '2026-09-10';     // четверг
const MONDAY = '2026-09-07';
const LONG_AGO = '2026-08-01';  // дата медалей «давно»: до сегодняшнего дня и до начала месяца

function load(opts) {
    const o = opts || {};
    const has = (list, sec, op, lvl) => list.indexOf(`${sec}:${op}:${lvl}`) >= 0;
    const box = {
        console, Math, Number, Object, Array, String, JSON, Date,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        TIER_NAMES: ['', 'Бронза', 'Серебро', 'Золото', 'Алмаз', 'Легенда'],
        TIER_ICONS: ['', '🥉', '🥈', '🥇', '💎', '👑'],
        topicLabelWithLevel: (k) => k,
        // Открытые клетки задаёт сам тест: подбор заданий смотрит не только на то, где
        // ученик был, но и на то, куда ему вообще можно пойти. По умолчанию — первые две
        // звезды всех действий.
        MAP_SECTIONS: o.sections || [{ cat: 'integer', sign: '+', label: '', ops: ['add', 'sub', 'mul', 'div'] }],
        isLevelOpen: (sec, op, lvl) => (o.open ? has(o.open, sec, op, lvl) : lvl <= 2),
        // Доступ репетитора: какие звезды можно открыть вообще и какие открыты поимённо,
        // в обход ворот. И звезда домашки — она тоже открыта в обход.
        levelAllowedByAccess: (sec, op, lvl) => (o.allowed ? has(o.allowed, sec, op, lvl) : true),
        levelNamedByGrant: (sec, op, lvl) => (o.named ? has(o.named, sec, op, lvl) : false),
        homeworkOpensCell: (sec, op, lvl) => (o.hwOpen ? has(o.hwOpen, sec, op, lvl) : false),
        Progress: { dayKey: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(
        ['COUNT_TIERS', 'ACCURACY_TIERS', 'LEVEL_GATE_TIER', 'LADDER_WINDOW', 'MAP_PCT_MIN']
            .map(n => `const ${n} = ${constant(n)};`).join('\n')
        + slice('function shiftDayKey(key, deltaDays)', 'function isActiveDay', 'даты')
        + slice('function isActiveDay(d)', 'function aggregateDaily', 'активный день')
        + slice('function parseTopicKey(key) {', '// Ключ для ОТОБРАЖЕНИЯ', 'разбор ключа')
        + slice('function daysBetweenKeys(fromKey, toKey)', '        // Полный текст сообщения.', 'дни между датами')
        + slice('function recentTopicWindow(daily, topicKey, wantAttempts)', '        // Всё, что нужно лесенкам одной темы.', 'окно последней сотни')
        + slice('// ===================== ЗАДАНИЯ ДНЯ И НЕДЕЛИ', '        // Отрисовка заданий', 'задания')
        + '\n;globalThis.T = { dailyTasks, weeklyTask, weekStartKey, recentCells,'
        + ' taskAggregate, evalTask, DAILY_TASK_COUNT, roleAdvance, roleRepair, roleReview, roleHomework,'
        + ' roleMedalNear, starFrontier, laggingFrontier, medalCells, isStarDay, openCells, accuracyBefore,'
        + ' dailyBefore, recentTopicWindow };',
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
function keyBack(off) {
    const [y, m, d] = TODAY.split('-').map(Number);
    const dt = new Date(y, m - 1, d - Number(off));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function journal(map) {
    const out = {};
    Object.keys(map).forEach(off => { out[keyBack(off)] = map[off]; });
    return out;
}
// Ученик из занятий: [{ off, key, c, w }] — off дней назад, верных c, ошибок w. Итоги по
// клеткам складываются сами, как в приложении.
function student(sessions, unlocks) {
    const daily = {}, byTopic = {};
    sessions.forEach(({ off, key, c, w }) => {
        const k = keyBack(off);
        const d = daily[k] || (daily[k] = { c: 0, w: 0, a: 0, s: 60, p: 0, ms: 0, mc: 0, t: {}, e: {}, te: {} });
        d.c += c; d.w += w; d.ms += c * 4000; d.mc += c;
        const v = d.t[key] || (d.t[key] = [0, 0, 0, 0, 0, 0, 0]);
        v[0] += c; v[1] += w; v[3] += c * 4000; v[4] += c;
        v[5] = w ? 0 : v[5] + c; v[6] = Math.max(v[6], v[5]);
        const bt = byTopic[key] || (byTopic[key] = { correct: 0, wrong: 0 });
        bt.correct += c; bt.wrong += w;
    });
    return { daily, byTopic, unlocks: unlocks || {} };
}
// Медали с датой — все ступени до указанной, как их пишет приложение.
function medals(map, date) {
    const out = {};
    Object.keys(map).forEach(key => ['s', 'a', 'c'].forEach(l => {
        for (let i = 1; i <= (map[key][l] || 0); i++) out[`${key}:${l}${i}`] = date || LONG_AGO;
    }));
    return out;
}
const GOLD = { a: 3, c: 3 };

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }
const show = (list) => list.map(x => `${x.text} [${x.cell || 'где угодно'}]`).join(' | ');

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
    // Логин решает жребий добивки. Клеточные задания у двоих с одной историей одни и те
    // же — и должны быть: история одна. Поэтому сравниваем по многим кодам.
    const sets = new Set();
    ['ЯР7', 'АУР', 'МД1', 'МД2', 'АБ1', 'АБ2'].forEach(c =>
        sets.add(T.dailyTasks(busy(), TODAY, c).map(x => x.text + x.need).join('|')));
    assert(sets.size > 1, 'у шести учеников один и тот же набор — логин не участвует в выборе');
});

test('заданий ровно три', () => {
    eq(T.dailyTasks(busy(), TODAY, 'ЯР7').length, T.DAILY_TASK_COUNT);
});

group('Тема важнее общего задания');

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
    T.dailyTasks(busy(), TODAY, 'ЯР7').filter(x => x.go).forEach(task => {
        eq(`${task.go.secKey}:${task.go.op}:${task.go.level}`, task.cell, `кнопка задания «${task.text}»`);
    });
});

test('совсем пустому аккаунту задания дают, но общие', () => {
    // Вести некуда: открытых клеток нет, истории нет. Это нормальная первая неделя
    // нового ученика, а не сбой — как появится история, задания станут адресными.
    const w = load({ open: [] });
    const list = w.dailyTasks({ daily: {} }, TODAY, 'НОВ');
    assert(list.length > 0, 'новичок остался без заданий');
    assert(list.every(x => !x.go), 'кнопка ведёт в клетку, которая ему не открыта');
});

test('новичку сразу показывают, куда пойти: начало карты', () => {
    const list = T.dailyTasks({ daily: {} }, TODAY, 'НОВ');
    eq(list[0].cell, 'integer+:add:1', `первое задание новичка: ${show(list)}`);
    assert(list[0].go, 'у первого задания нет кнопки');
    assert(/Новая тема/.test(list[0].text), `сказано: «${list[0].text}»`);
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

test('«подряд без ошибки» считает серию, а не сумму за день', () => {
    // Раньше здесь показывали число верных за день, а засчитывали при нуле ошибок.
    // После первой же ошибки задание становилось невыполнимым, а полоска продолжала
    // набираться до «10 из 10» и не превращалась в «готово». Семь ошибок и полная
    // полоса — это был настоящий снимок с телефона.
    const task = { kind: 'clean', need: 10 };
    const agg = (o) => Object.assign({ correct: 0, wrong: 0, days: 1, cells: 1, run: 0, best: 0 }, o);
    eq(T.evalTask(task, agg({ correct: 12, wrong: 7, run: 1, best: 3 })).have, 1,
        'полоска должна показывать идущую серию');
    eq(T.evalTask(task, agg({ correct: 12, wrong: 7, run: 1, best: 3 })).done, false,
        'серии не было — засчитывать нечего');
    eq(T.evalTask(task, agg({ correct: 12, wrong: 0, run: 12, best: 12 })).done, true,
        'двенадцать подряд — задание сделано');
});

test('полоска падает в ноль сразу после ошибки', () => {
    // Это и есть главное: ученик видит, что серия сбилась, а не набирает дальше
    // счётчик, который уже ничего не даст.
    const agg = { correct: 9, wrong: 1, days: 1, cells: 1, run: 0, best: 9 };
    eq(T.evalTask({ kind: 'clean', need: 10 }, agg).have, 0);
});

test('сделанное задание не разавтоматится от следующей ошибки', () => {
    // Серия сбита, но десять подряд уже были — «готово» обязано остаться.
    const agg = { correct: 15, wrong: 1, days: 1, cells: 1, run: 2, best: 10 };
    eq(T.evalTask({ kind: 'clean', need: 10 }, agg).done, true);
});

test('«подряд без ошибки» не даётся за ноль решённых', () => {
    // Ноль из нуля — не подвиг.
    eq(T.evalTask({ kind: 'clean', need: 10 },
        { correct: 0, wrong: 0, days: 0, cells: 0, run: 0, best: 0 }).done, false);
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
        const t = T.weeklyTask(st, TODAY, 'ЯР7-' + w);   // разные логины — разные жребии
        if (t) kinds.add(t.kind);
    }
    assert(kinds.has('days'), `задание про регулярность не выпало ни разу: ${[...kinds].join(', ')}`);
});

test('до медали обещаем только когда она реально достижима за неделю', () => {
    for (let i = 0; i < 20; i++) {
        const near = T.weeklyTask(busy(), TODAY, 'ЯР' + i);
        if (near && near.tier) assert(near.need >= 20 && near.need <= 80, `обещали медаль с недобором ${near.need}`);
    }
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

test('медаль недели — там, где ученик был, а не где он давно не бывал', () => {
    // Та же поломка, что у дневной медали: недельная брала любую открытую тему и звала
    // в давно пройденную — туда, где доля до медали больше.
    const w = load({ open: ['integer+:add:1', 'integer+:mul:2'] });
    const s = [];
    for (let d = 70; d >= 40; d--) s.push({ off: d, key: 'integer+:add:1', c: 4, w: 0 });   // 124: до алмаза 26
    for (let d = 19; d >= 4; d--) s.push({ off: d, key: 'integer+:mul:2', c: 7, w: 0 });   // 112: до алмаза 38
    const st = student(s, medals({ 'integer+:add:1': GOLD, 'integer+:mul:2': GOLD }));
    const cells = new Set();
    for (let i = 0; i < 30; i++) { const wk = w.weeklyTask(st, TODAY, 'W' + i); if (wk && wk.cell) cells.add(wk.cell); }
    assert(!cells.has('integer+:add:1'), 'недельная медаль позвала в сложение 1★, где ученика не было сорок дней');
    assert(cells.has('integer+:mul:2'), `недельная медаль не нашла умножение 2★: ${[...cells].join(', ')}`);
});

group('Главное: через день — к звезде или к медали');

// День звезды или медали считается по дням ЗАНЯТИЙ с начала месяца до вчерашнего.
const withDays = (n, extra) => {
    const s = [];
    for (let i = 0; i < n; i++) s.push({ off: 9 - i, key: 'integer+:add:1', c: 5, w: 0 });   // 1, 2, … сентября
    return student(s.concat(extra || []));
};

test('день звезды и день медали чередуются по дням занятий', () => {
    const got = [0, 1, 2, 3, 4].map(n => T.isStarDay(withDays(n).daily, TODAY));
    eq(got.join(','), 'true,false,true,false,true', 'чёт и нечет дней занятий');
});

test('календарь чередованию не указ: занимается через день — дни всё равно разные', () => {
    // По календарному чёт-нечету у того, кто занимается через день, выпадало бы всегда одно.
    const everyOther = (upTo) => {
        const s = [];
        for (let off = 9; off >= 1; off -= 2) if (off >= 10 - upTo) s.push({ off, key: 'integer+:add:1', c: 5, w: 0 });
        return student(s).daily;
    };
    // 1, 3, 5, 7, 9 сентября. После 1-го — день медали, после 1-го и 3-го — день звезды.
    eq(T.isStarDay(everyOther(1), '2026-09-02'), false, 'после одного дня занятий');
    eq(T.isStarDay(everyOther(3), '2026-09-04'), true, 'после двух дней занятий');
    eq(T.isStarDay(everyOther(5), '2026-09-06'), false, 'после трёх');
});

test('сегодняшние занятия чередования не сдвигают', () => {
    const before = T.isStarDay(withDays(3).daily, TODAY);
    const after = T.isStarDay(withDays(3, [{ off: 0, key: 'integer+:add:1', c: 30, w: 2 }]).daily, TODAY);
    eq(after, before, 'занялся сегодня — и главное задание сменилось посреди дня');
});

test('занятия прошлого месяца чередования не трогают', () => {
    // Счёт идёт с начала месяца: глубже журнал подчищается, и счёт с начала времён мог бы
    // сдвинуться посреди дня, когда уходит самый старый день.
    const a = T.isStarDay(withDays(3).daily, TODAY);
    const b = T.isStarDay(withDays(3, [{ off: 30, key: 'integer+:add:1', c: 5, w: 0 },
                                       { off: 31, key: 'integer+:add:1', c: 5, w: 0 },
                                       { off: 33, key: 'integer+:add:1', c: 5, w: 0 }]).daily, TODAY);
    eq(b, a, 'дни августа сдвинули чередование в сентябре');
});

test('в день звезды главное — следующая звезда, в день медали — медаль', () => {
    const w = load({ open: ['integer+:add:1', 'integer+:add:2'] });
    // Сложение 1★ пройдено, 2★ — рубеж (40 верных); в 1★ до алмаза 10.
    const mk = (n) => {
        const s = [];
        for (let i = 0; i < n; i++) s.push({ off: 9 - i, key: 'integer+:add:2', c: 5, w: 0 });
        const st = student(s.concat([{ off: 25, key: 'integer+:add:2', c: 40 - 5 * n, w: 0 }]),
                           medals({ 'integer+:add:1': GOLD }));
        st.byTopic['integer+:add:1'] = { correct: 140, wrong: 3 };
        return st;
    };
    const star = w.dailyTasks(mk(2), TODAY, 'ЯР7')[0];
    assert(star.star && star.cell === 'integer+:add:2', `день звезды: ${star.text} [${star.cell}]`);
    const medal = w.dailyTasks(mk(3), TODAY, 'ЯР7')[0];
    assert(medal.tier && medal.cell === 'integer+:add:2', `день медали: ${medal.text} [${medal.cell}]`);
});

test('нечего на свой день — главное всё равно есть', () => {
    // День медали, а медали в темах, где ученик был, все взяты: главным идёт звезда.
    const w = load({ open: ['integer+:add:1', 'integer+:add:2'] });
    const st = student([{ off: 9, key: 'integer+:add:1', c: 5, w: 0 }], medals({ 'integer+:add:1': { a: 5, c: 5 } }));
    st.byTopic['integer+:add:1'] = { correct: 300, wrong: 3 };
    assert(!w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день медали');
    const first = w.dailyTasks(st, TODAY, 'ЯР7')[0];
    eq(first.cell, 'integer+:add:2', `главное в день медали без медали: ${first.text}`);
    assert(first.star, 'главным пошла не звезда');
});

group('Рубеж: следующая звезда');

const ADD_OPEN = ['integer+:add:1', 'integer+:add:2', 'integer+:add:3'];

test('медали без даты — из старого формата — считаются взятыми давно', () => {
    const w = load({ open: ADD_OPEN });
    eq(w.starFrontier('integer+', 'add', medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }, '?'), TODAY),
       'integer+:add:3', 'ворота без даты не засчитались');
});

test('рубеж — открытая звезда без ворот, за которой следующая закрыта', () => {
    const w = load({ open: ADD_OPEN });
    const unlocks = medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD });
    eq(w.starFrontier('integer+', 'add', unlocks, TODAY), 'integer+:add:3');
    eq(w.starFrontier('integer+', 'add', {}, TODAY), 'integer+:add:1', 'без ворот рубеж — первая звезда');
});

test('пока не хватает верных — задание про верные, с честным остатком', () => {
    const w = load({ open: ADD_OPEN });
    // Два дня занятий в месяце — сегодня день звезды.
    const st = student([{ off: 3, key: 'integer+:add:3', c: 20, w: 1 }, { off: 2, key: 'integer+:add:3', c: 20, w: 1 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    assert(w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день звезды');
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0];
    assert(t, 'задания на рубеже нет');
    eq(t.text, 'Реши верно 20 — до 4★ останется 40', 'текст');
});

test('обещание «верных хватит» сбывается буквально', () => {
    // «И верных для 4★ хватит» имеет право стоять, только если после сделанного верных
    // действительно сотня. Иначе это обман, который ребёнок заметит.
    const w = load({ open: ADD_OPEN });
    const bad = [];
    for (let have = 1; have < 100; have++) {
        // Второй день занятий — одна ошибка в той же теме: сегодня день звезды.
        const st = student([{ off: 3, key: 'integer+:add:3', c: 0, w: 1 }, { off: 2, key: 'integer+:add:3', c: have, w: 0 }],
                           medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
        const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3' && x.star)[0];
        if (!t) bad.push(`${have} верных: задания на рубеже нет`);
        if (t && /хватит/.test(t.text) && have + t.need < 100) bad.push(`${have} верных: «${t.text}»`);
        if (t && /останется (\d+)/.test(t.text) && have + t.need + Number(t.text.match(/останется (\d+)/)[1]) !== 100) {
            bad.push(`${have} верных: «${t.text}» не сходится с сотней`);
        }
    }
    assert(bad.length === 0, bad[0] || '');
});

test('верных хватает — задание про точность, с тем же числом, что на экране достижений', () => {
    const w = load({ open: ADD_OPEN });
    // 120 верных, по последней сотне 86%: 100 ответов, 14 ошибок.
    const st = student([{ off: 30, key: 'integer+:add:3', c: 34, w: 0 },
                        { off: 3, key: 'integer+:add:3', c: 43, w: 7 },
                        { off: 1, key: 'integer+:add:3', c: 43, w: 7 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    const screen = Math.round(w.recentTopicWindow(st.daily, 'integer+:add:3', 100).c
                              / w.recentTopicWindow(st.daily, 'integer+:add:3', 100).attempts * 100);
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0];
    assert(t, 'задания на рубеже нет');
    eq(t.text, `Для 4★ нужна точность 90%, сейчас ${screen}% — реши 10 подряд без ошибки`, 'текст');
    eq(t.kind, 'clean', 'засчитывается серией');
});

test('«сейчас N%» — на начало дня: сегодняшние ответы его не меняют', () => {
    // Иначе текст задания менялся бы с каждым ответом: «сейчас 86%», потом «87%»…
    const w = load({ open: ADD_OPEN });
    const base = [{ off: 30, key: 'integer+:add:3', c: 34, w: 0 },
                  { off: 3, key: 'integer+:add:3', c: 43, w: 7 }, { off: 1, key: 'integer+:add:3', c: 43, w: 7 }];
    const texts = [0, 5, 30].map(n => {
        const st = student(n ? base.concat([{ off: 0, key: 'integer+:add:3', c: n, w: n > 5 ? 3 : 0 }]) : base,
                           medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
        return (w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0] || {}).text;
    });
    eq(texts.filter(x => x !== texts[0]).join(' / '), '', `текст менялся за день, был «${texts[0]}»`);
});

test('сотня верных есть, а журнал о теме не помнит — зовём вернуться, а не про точность', () => {
    // Журнал хранит не всё время. Говорить «сейчас 100%» по пяти ответам нельзя.
    const w = load({ open: ADD_OPEN });
    const st = student([{ off: 3, key: 'integer+:add:2', c: 5, w: 0 }, { off: 2, key: 'integer+:add:3', c: 5, w: 0 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    st.byTopic['integer+:add:3'] = { correct: 140, wrong: 6 };
    assert(w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день звезды');
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0];
    eq(t && t.text, 'Давно не было — повтори 10', 'текст');
});

test('на рубеже при совсем низкой точности — примеры, а не серия', () => {
    const w = load({ open: ADD_OPEN });
    const st = student([{ off: 30, key: 'integer+:add:3', c: 60, w: 0 },
                        { off: 3, key: 'integer+:add:3', c: 25, w: 25 }, { off: 1, key: 'integer+:add:3', c: 25, w: 25 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0];
    eq(t && t.text, 'Здесь нужна практика — реши 12', 'текст');
});

test('точность уже есть, а золото не записано — точности не просим', () => {
    // Сотня верных и 96% по сотне, а золота в записях нет — так бывает со старыми данными.
    // «Нужна точность 90%, сейчас 96%» было бы бессмыслицей на экране ребёнка.
    const w = load({ open: ADD_OPEN });
    const st = student([{ off: 30, key: 'integer+:add:3', c: 20, w: 0 },
                        { off: 3, key: 'integer+:add:3', c: 48, w: 2 }, { off: 1, key: 'integer+:add:3', c: 48, w: 2 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    assert(w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день звезды');
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0];
    assert(t, 'задания на рубеже нет');
    assert(!/точност/.test(t.text), `просят точность, которая уже есть: «${t.text}»`);
});

test('тема без единого ответа — «Новая тема»', () => {
    const w = load({ open: ADD_OPEN });
    const st = student([{ off: 3, key: 'integer+:add:2', c: 5, w: 0 }, { off: 2, key: 'integer+:add:2', c: 5, w: 0 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    assert(w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день звезды');
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:3')[0];
    assert(t && t.text === 'Новая тема — реши 20', `сказано: «${t && t.text}»`);
});

test('звезда, открытая в обход золота, рубежом не считается', () => {
    // Репетитор назвал 4★ поимённо — золото на 3★ её уже не откроет. Рубеж — на 4★.
    const open = ADD_OPEN.concat(['integer+:add:4']);
    const unlocks = medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD });
    eq(load({ open, named: ['integer+:add:4'] }).starFrontier('integer+', 'add', unlocks, TODAY), 'integer+:add:4', 'назвал репетитор');
    eq(load({ open, hwOpen: ['integer+:add:4'] }).starFrontier('integer+', 'add', unlocks, TODAY), 'integer+:add:4', 'задана домашка');
});

test('звезду нельзя открыть вовсе — рубежа нет', () => {
    // Репетитор открыл сложение только до 2★: золото на 2★ ничего не откроет.
    const w = load({ open: ['integer+:add:1', 'integer+:add:2'], allowed: ['integer+:add:1', 'integer+:add:2'] });
    eq(w.starFrontier('integer+', 'add', medals({ 'integer+:add:1': GOLD }), TODAY), null);
});

test('взял ворота сегодня — задание дня не сдвигается', () => {
    // Сегодня взято золото на 3★, и 4★ уже открыта. Но задание дня обещано на 3★ — там
    // оно и остаётся до завтра, иначе выполненное исчезло бы прямо под рукой.
    const open = ADD_OPEN.concat(['integer+:add:4']);
    const w = load({ open });
    const unlocks = Object.assign(medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }),
                                  medals({ 'integer+:add:3': GOLD }, TODAY));
    eq(w.starFrontier('integer+', 'add', unlocks, TODAY), 'integer+:add:3', 'рубеж уехал вслед за сегодняшним золотом');
});

test('своё действие пройдено — рубеж ищется в отстающем', () => {
    const open = ['integer+:add:1', 'integer+:sub:1', 'integer+:mul:1', 'integer+:mul:2'];
    const w = load({ open, allowed: ['integer+:add:1', 'integer+:sub:1', 'integer+:sub:2',
                                     'integer+:mul:1', 'integer+:mul:2', 'integer+:mul:3'] });
    // Сложение открыто репетитором только на 1★ и пройдено; вычитание — ни одних ворот,
    // умножение — одни. Два дня занятий — день звезды.
    const st = student([{ off: 3, key: 'integer+:add:1', c: 10, w: 0 }, { off: 2, key: 'integer+:add:1', c: 10, w: 0 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:mul:1': GOLD }));
    assert(w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день звезды');
    const first = w.dailyTasks(st, TODAY, 'ЯР7')[0];
    eq(first && first.cell, 'integer+:sub:1', `главное после пройденного действия: ${first && first.text}`);
    assert(first.star, 'главным пошла не звезда');
});

group('Медаль');

test('медаль — только в темах, где ученик был за две недели', () => {
    // Сложение пройдено давно, сейчас ученик в умножении 2★. В сложении 1★ доля до алмаза
    // больше (124 из 150 против 114 из 150), но звать туда, куда месяц не заходил, — значит
    // уводить с работы.
    const w = load({ open: ['integer+:add:1', 'integer+:mul:1', 'integer+:mul:2'] });
    const s = [];
    for (let d = 70; d >= 40; d--) s.push({ off: d, key: 'integer+:add:1', c: 4, w: 0 });
    for (let d = 19; d >= 1; d--) s.push({ off: d, key: 'integer+:mul:2', c: 6, w: 0 });
    const st = student(s, medals({ 'integer+:add:1': GOLD, 'integer+:mul:1': GOLD, 'integer+:mul:2': GOLD }));
    const t = w.roleAdvance(st, w.medalCells(st, st.daily, w.recentCells(st.daily, keyBack(1), 14), st.unlocks, TODAY, TODAY),
                            st.daily, TODAY, TODAY);
    eq(t && t.cell, 'integer+:mul:2', 'медаль увела в давно пройденную тему');
    assert(!w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день медали');
    const first = w.dailyTasks(st, TODAY, 'ЯР7')[0];
    eq(first.cell, 'integer+:mul:2', `главное в день медали: ${first.text}`);
});

test('медаль не зовёт туда, где звезду держит точность', () => {
    // Сложение 2★: 133 верных, но точность 88% — 3★ закрыта из-за точности. Алмаз за
    // количество там отвлёк бы от того, что действительно нужно.
    const w = load({ open: ['integer+:add:1', 'integer+:add:2'] });
    const s = [];
    for (let d = 19; d >= 1; d--) s.push({ off: d, key: 'integer+:add:2', c: 7, w: 1 });
    const st = student(s, medals({ 'integer+:add:1': GOLD, 'integer+:add:2': { a: 2, c: 4 } }));
    eq(w.medalCells(st, st.daily, ['integer+:add:2'], st.unlocks, TODAY, TODAY).length, 0, 'тему, где держит точность, взяли за медалью');
    const list = w.dailyTasks(st, TODAY, 'ЯР7');
    const there = list.filter(x => x.cell === 'integer+:add:2');
    assert(there.length === 1 && /точность 90%/.test(there[0].text), `в сложении 2★ ждали задание на точность: ${show(list)}`);
});

test('обещание медали сбывается буквально', () => {
    // «Реши верно N — и медаль твоя» имеет право стоять, только если N верных ответов
    // ДЕЙСТВИТЕЛЬНО закрывают медаль. Иначе это обман, который ребёнок заметит.
    const w = load({ open: ['integer+:add:1', 'integer+:add:2'] });
    const bad = [];
    let medalsSeen = 0;
    for (let have = 1; have < 250; have++) {
        // Вчера в теме был, ворота взяты — медаль ищется здесь. Один день занятий в месяце —
        // день медали.
        const st = student([{ off: 1, key: 'integer+:add:2', c: have, w: 0 }],
                           medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
        w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.tier).forEach(x => {
            medalsSeen++;
            if (/медаль .* твоя/.test(x.text) && x.need < x.gap) bad.push(`${have} верных: обещали медаль за ${x.need}, а нужно ${x.gap}`);
        });
    }
    assert(medalsSeen > 100, `заданий на медаль нашлось всего ${medalsSeen} — проверять нечего`);
    assert(bad.length === 0, bad[0] || '');
});

test('«к медали» ведёт туда, где вложено больше всего, а не где осталось меньше', () => {
    // Раньше побеждала клетка с наименьшим остатком — и задание уводило с ежедневной
    // работы в клетку, куда ученик заглянул однажды. 218 из 250 (87%) должно обходить
    // 12 из 25 (48%), хотя остаток там больше: 32 против 13.
    const w = load({ open: ['integer+:add:2', 'integer+:mul:1'] });
    const st = { daily: {}, byTopic: {
        'integer+:add:2': { correct: 218, wrong: 20 },
        'integer+:mul:1': { correct: 12, wrong: 1 }
    } };
    const t = w.roleAdvance(st, ['integer+:add:2', 'integer+:mul:1'], st.daily, TODAY, TODAY);
    eq(t.cell, 'integer+:add:2', 'задание увело с той клетки, в которую вложено больше');
});

test('«к медали» считает верные, а не решённые', () => {
    // Медаль даётся за верные ответы. Если задание считает попытки, то «реши 13 — и
    // медаль твоя» не сбудется у того, кто из тринадцати ошибётся трижды.
    const w = load({ open: ['integer+:add:2'] });
    const st = { daily: {}, byTopic: { 'integer+:add:2': { correct: 20, wrong: 5 } } };
    eq(w.roleAdvance(st, ['integer+:add:2'], st.daily, TODAY, TODAY).kind, 'correct');
});

test('медаль рядом — когда до неё не больше 15 верных, и ближайшая', () => {
    const w = load({ open: ['integer+:add:1', 'integer+:add:2', 'integer+:sub:1'] });
    const st = student([{ off: 2, key: 'integer+:add:1', c: 137, w: 0 },   // до алмаза 13
                        { off: 2, key: 'integer+:sub:1', c: 52, w: 0 },    // до серебра 8
                        { off: 2, key: 'integer+:add:2', c: 80, w: 0 }],   // до золота 20 — далеко
                       medals({ 'integer+:add:1': GOLD, 'integer+:sub:1': { a: 3, c: 3 }, 'integer+:add:2': { a: 3, c: 2 } }));
    const t = w.roleMedalNear(st, st.daily, ['integer+:add:1', 'integer+:sub:1', 'integer+:add:2'], TODAY);
    eq(t && t.cell, 'integer+:sub:1', 'выбрана не ближайшая медаль');
    eq(t.text === undefined && t.need, 10, 'хвост меньше десяти — задание на десять');
    eq(w.roleMedalNear(st, st.daily, ['integer+:add:2'], TODAY), null, 'до медали 20 — это уже не «рядом»');
});

group('Подтянуть');

// Тема, где золото по точности было: 100 ответов по последней сотне с ошибками errors.
const fixWorld = () => load({ open: ['integer+:add:1', 'integer+:add:2', 'integer+:sub:1'] });
const fixStudent = (errors, opts) => {
    const o = opts || {};
    const s = [{ off: 40, key: 'integer+:add:1', c: 60, w: 0 },
               { off: 3, key: 'integer+:add:1', c: 50 - Math.ceil(errors / 2), w: Math.ceil(errors / 2) },
               { off: 1, key: 'integer+:add:1', c: 50 - Math.floor(errors / 2), w: Math.floor(errors / 2) }];
    return student(s, o.noGold ? medals({ 'integer+:add:1': { a: 2, c: 4 } })
                               : medals({ 'integer+:add:1': { a: o.crown ? 5 : 3, c: 4 } }));
};

test('подтянуть — где золото по точности было, а по последней сотне уже ниже 90%', () => {
    const w = fixWorld();
    const st = fixStudent(14);    // 86%
    const t = w.roleRepair(w.dailyBefore(st.daily, TODAY), ['integer+:add:1'], st.unlocks, TODAY, []);
    assert(t, 'задания «подтянуть» нет');
    eq(w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:1').map(x => x.text)[0],
       'Точность здесь просела до 86% — реши 10 подряд без ошибки', 'текст');
});

test('та же точность, что на экране: провал за две недели при 95% по сотне — не повод', () => {
    // Ровно снимок: за две недели 28 ответов и 4 ошибки (86%), а по последней сотне — 96%.
    // Задание «подтяни до 90%» спорило с экраном достижений. Теперь мерка одна.
    const w = fixWorld();
    const s = [{ off: 40, key: 'integer+:add:1', c: 80, w: 0 }];
    [12, 9, 6, 3].forEach(d => s.push({ off: d, key: 'integer+:add:1', c: 6, w: 1 }));
    const st = student(s, medals({ 'integer+:add:1': { a: 5, c: 4 } }));
    eq(w.accuracyBefore(w.dailyBefore(st.daily, TODAY), 'integer+:add:1'), 96, 'точность по последней сотне');
    eq(w.roleRepair(w.dailyBefore(st.daily, TODAY), ['integer+:add:1'], st.unlocks, TODAY, []), null,
       'при 96% по сотне просят подтянуть точность');
    const bad = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => /точност/i.test(x.text));
    eq(bad.map(x => x.text).join(' | '), '', 'задание про точность при 96%');
});

test('совсем низкая точность — примеры, а не серия', () => {
    // 50% — это не небрежность, а незнание. Серия без ошибки тут недостижима сегодня.
    const w = fixWorld();
    const t = w.roleRepair(w.dailyBefore(fixStudent(50).daily, TODAY), ['integer+:add:1'], fixStudent(50).unlocks, TODAY, []);
    eq(t && t.kind, 'count', `при 50% ждали примеры: ${JSON.stringify(t)}`);
});

test('тема без золота по точности в «подтянуть» не идёт', () => {
    // «Просела» про неё было бы неправдой: до золота там рубеж, и это задание на рубеже.
    const w = fixWorld();
    const st = fixStudent(14, { noGold: true });
    eq(w.roleRepair(w.dailyBefore(st.daily, TODAY), ['integer+:add:1'], st.unlocks, TODAY, []), null);
});

group('Другое действие');

test('другое действие — отстающее, со своей следующей звездой', () => {
    const open = ['integer+:add:1', 'integer+:add:2', 'integer+:add:3', 'integer+:sub:1', 'integer+:sub:2',
                  'integer+:mul:1', 'integer+:div:1'];
    const w = load({ open });
    // Ученик в сложении 3★. Вычитание: одни ворота, умножение и деление — ни одних.
    const st = student([{ off: 1, key: 'integer+:add:3', c: 20, w: 0 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD, 'integer+:sub:1': GOLD }));
    const t = w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.role === 'explore')[0];
    assert(t, 'задания «другое действие» нет');
    eq(t.cell, 'integer+:mul:1', 'выбрано не отстающее действие (среди равных — первое по карте)');
    eq(t.text, 'Новая тема — реши 10', 'текст');
});

test('своё действие «другим» не считается', () => {
    const w = load({ open: ['integer+:add:1', 'integer+:add:2', 'integer+:sub:1'] });
    const st = student([{ off: 1, key: 'integer+:add:2', c: 20, w: 0 }], medals({ 'integer+:add:1': GOLD }));
    eq(w.laggingFrontier('integer+', 'add', st.unlocks, TODAY, []), 'integer+:sub:1');
});

test('в другой раздел — только когда в своём рубежей не осталось', () => {
    const sections = [{ cat: 'integer', sign: '+', label: '', ops: ['add', 'sub'] },
                      { cat: 'integer', sign: '-', label: '', ops: ['add', 'sub'] }];
    const open = ['integer+:add:1', 'integer+:sub:1', 'integer-:add:1', 'integer-:sub:1'];
    const w = load({ sections, open, allowed: open.concat(open.map(k => k.replace(/1$/, '2'))) });
    eq(w.laggingFrontier('integer+', 'add', {}, TODAY, []), 'integer+:sub:1', 'в своём разделе рубеж есть');
    // В своём разделе всё пройдено, что можно, — идём в отрицательные.
    const allowedPlus = load({ sections, open, allowed: ['integer+:add:1', 'integer+:sub:1', 'integer-:add:1', 'integer-:add:2', 'integer-:sub:1'] });
    eq(allowedPlus.laggingFrontier('integer+', 'add', medals({ 'integer+:sub:1': GOLD }), TODAY, []), 'integer-:add:1');
});

group('Повторение');

const reviewWorld = () => load({ open: ['integer+:add:1', 'integer+:add:2', 'integer+:add:3', 'integer+:mul:1', 'integer+:mul:2'] });

test('повторение — тема с золотом, где не был три недели и дольше', () => {
    const w = reviewWorld();
    const st = student([{ off: 30, key: 'integer+:add:1', c: 100, w: 0 }, { off: 5, key: 'integer+:mul:1', c: 100, w: 0 },
                        { off: 2, key: 'integer+:mul:2', c: 20, w: 0 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:mul:1': GOLD }));
    const t = w.roleReview(st.daily, w.openCells(), st.unlocks, TODAY, []);
    eq(t && t.cell, 'integer+:add:1', 'не позвали повторить давнее');
    eq(w.dailyTasks(st, TODAY, 'ЯР7').filter(x => x.cell === 'integer+:add:1').map(x => x.text)[0],
       'Давно не было — повтори 10', 'текст');
});

test('из одинаково давних — самая высокая звезда', () => {
    const w = reviewWorld();
    const st = student([{ off: 30, key: 'integer+:add:1', c: 100, w: 0 }, { off: 30, key: 'integer+:add:2', c: 100, w: 0 }],
                       medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD }));
    eq((w.roleReview(st.daily, w.openCells(), st.unlocks, TODAY, []) || {}).cell, 'integer+:add:2');
});

test('меньше трёх недель и без золота — не зовём', () => {
    const w = reviewWorld();
    const recent = student([{ off: 20, key: 'integer+:add:1', c: 100, w: 0 }], medals({ 'integer+:add:1': GOLD }));
    eq(w.roleReview(recent.daily, w.openCells(), recent.unlocks, TODAY, []), null, 'двадцать дней — ещё не повод');
    const noGold = student([{ off: 40, key: 'integer+:add:1', c: 100, w: 0 }], medals({ 'integer+:add:1': { a: 2, c: 3 } }));
    eq(w.roleReview(noGold.daily, w.openCells(), noGold.unlocks, TODAY, []), null, 'без золота повторять нечего');
});

group('Домашка');

const HW_CELL = 'integer+:mul:2';
const hwWorld = () => load({ open: ['integer+:add:1', 'integer+:add:2', 'integer+:mul:1', HW_CELL], hwOpen: [HW_CELL] });
// Домашка: «need верных в клетке», base — сколько было при выдаче.
const hw = (o) => Object.assign({ id: 7, topic: HW_CELL, need: 60, base: 0, dueOn: null }, o);
const hwStudent = (todayDone) => {
    const s = [{ off: 2, key: 'integer+:add:2', c: 20, w: 0 }];
    if (todayDone) s.push({ off: 0, key: HW_CELL, c: todayDone, w: 0 });
    return student(s, medals({ 'integer+:add:1': GOLD }));
};

test('домашка — первым заданием, дневной долей до срока', () => {
    const w = hwWorld();
    // 60 верных до субботы 12-го: сегодня, завтра и в субботу — по 20.
    const first = w.dailyTasks(hwStudent(0), TODAY, 'ЯР7', [hw({ dueOn: '2026-09-12' })])[0];
    eq(first.cell, HW_CELL, 'первым идёт не домашка');
    eq(first.text, 'Реши верно 20 — по домашке останется 40', 'текст');
});

test('срок прошёл — всё сразу; срока нет — по двадцать в день', () => {
    const w = hwWorld();
    eq(w.dailyTasks(hwStudent(0), TODAY, 'ЯР7', [hw({ dueOn: '2026-09-08' })])[0].text,
       'Реши верно 60 — и домашка сделана', 'просроченная');
    eq(w.dailyTasks(hwStudent(0), TODAY, 'ЯР7', [hw({ dueOn: null })])[0].text,
       'Реши верно 20 — по домашке останется 40', 'без срока');
    eq(w.dailyTasks(hwStudent(0), TODAY, 'ЯР7', [hw({ need: 6, dueOn: null })])[0].text,
       'Реши верно 6 — и домашка сделана', 'остаток меньше дневной доли');
});

test('доля считается от остатка на начало дня и не тает от ответов', () => {
    const w = hwWorld();
    const seen = [];
    for (const n of [0, 1, 5, 19, 20, 33]) {
        const st = hwStudent(n);
        st.byTopic[HW_CELL] = { correct: n, wrong: 0 };
        const t = w.dailyTasks(st, TODAY, 'ЯР7', [hw({ dueOn: '2026-09-12' })])[0];
        seen.push(`${t.id} :: ${t.text}`);
        if (n >= 20) assert(t.done, `сделано ${n} из 20, а задание не закрылось`);
    }
    eq(seen.filter(x => x !== seen[0]).join(' / '), '', `задание про домашку изменилось за день, было ${seen[0]}`);
});

test('из задания про домашку миссия запускается как домашка', () => {
    // Миссия из домашки — без подсказок: иначе ответы не шли бы в счёт.
    const first = hwWorld().dailyTasks(hwStudent(0), TODAY, 'ЯР7', [hw({ dueOn: '2026-09-12' })])[0];
    eq(first.go && first.go.homeworkId, 7, 'кнопка не знает, что это домашка');
    const plain = hwWorld().dailyTasks(hwStudent(0), TODAY, 'ЯР7', []).filter(x => x.go)[0];
    eq(plain.go.homeworkId, null, 'обычное задание вдруг стало домашкой');
});

test('сделанная домашка заданием не висит', () => {
    const st = hwStudent(0);
    st.byTopic[HW_CELL] = { correct: 70, wrong: 0 };
    const list = hwWorld().dailyTasks(st, TODAY, 'ЯР7', [hw({ base: 10, dueOn: '2026-09-12' })]);
    assert(list.every(x => !x.hw), `сделанная домашка осталась заданием: ${show(list)}`);
});

test('из нескольких — самая срочная', () => {
    const w = load({ open: ['integer+:add:1', 'integer+:add:2', 'integer+:mul:1', HW_CELL, 'integer+:sub:1'],
                     hwOpen: [HW_CELL, 'integer+:sub:1'] });
    const list = [hw({ id: 1, dueOn: '2026-09-20' }), hw({ id: 2, topic: 'integer+:sub:1', dueOn: '2026-09-11' }),
                  hw({ id: 3, topic: 'integer+:add:1', dueOn: null })];
    eq(w.dailyTasks(hwStudent(0), TODAY, 'ЯР7', list)[0].hw, 2);
});

test('тему домашки другие задания не повторяют', () => {
    const list = hwWorld().dailyTasks(hwStudent(0), TODAY, 'ЯР7', [hw({ dueOn: '2026-09-12' })]);
    const cells = list.filter(x => x.cell).map(x => x.cell);
    eq(cells.length, new Set(cells).size, `клетки повторяются: ${cells.join(', ')}`);
});

group('Задание не двигается под руками у того, кто его делает');

// Один день, одна клетка, ответы копятся. Ровно то, что было на экране у ученика:
// «Реши верно 20 — до медали «Бронза» останется 3», следующий ответ — «останется 2»,
// ещё один — «останется 1», а на шестом строка в игре пропадала совсем.
// before — сколько верных было в клетке ВЧЕРА, today — сколько добавили сегодня.
// Разделять обязательно: задание выбирается по вчерашней картине, а счётчик считает
// сегодняшнее. Вчерашний день занятий один — значит, сегодня день медали.
function dayOf(cell, before, today) {
    const j = {};
    if (before > 0) j[1] = day(before, 0, { [cell]: [before, 0] });
    if (today > 0) j[0] = day(today, 0, { [cell]: [today, 0] });
    return { byTopic: { [cell]: { correct: before + today, wrong: 0 } }, daily: journal(j) };
}

test('за день не меняются ни цель, ни текст, ни номер задания', () => {
    const cell = 'integer+:add:1';
    const w = load({ open: [cell, 'integer+:sub:1'] });
    const seen = [];
    for (let n = 0; n <= 12; n++) {
        const list = w.dailyTasks(dayOf(cell, 2, n), TODAY, 'ЯР7');
        assert(list[0] && list[0].tier, `на ${n} верных главное задание перестало быть медалью: ${show(list)}`);
        seen.push(list.map(x => `${x.id} :: ${x.text}`).join(' | '));
    }
    const first = seen[0];
    const moved = seen.filter(x => x !== first);
    assert(moved.length === 0,
        `задания изменились за день:\n      было  ${first}\n      стало ${moved[0]}`);
});

test('обещанное «останется N» сбывается', () => {
    // Раньше цель уезжала навстречу: каждый верный ответ прибавлял счётчику единицу
    // и отнимал единицу у цели. «Реши верно 20» закрывалось на тринадцатом, и число
    // 20 на глазах превращалось в 13.
    const cell = 'integer+:add:1';
    const w = load({ open: [cell, 'integer+:sub:1'] });
    const start = w.dailyTasks(dayOf(cell, 2, 0), TODAY, 'ЯР7')[0];
    assert(start && start.tier, 'главного задания на медаль нет');
    // Сделали ровно столько, сколько просили, — и до медали осталось ровно обещанное.
    const after = w.dailyTasks(dayOf(cell, 2, start.need), TODAY, 'ЯР7')[0];
    assert(after && after.done, `сделали ${start.need}, а задание не закрылось`);
    const left = 25 - 2 - start.need;      // COUNT_TIERS[0] — бронза
    assert(start.gap - start.need === left,
        `обещали «останется ${start.gap - start.need}», а осталось ${left}`);
});

test('рубеж не двигается, пока его делают', () => {
    // День звезды: рубеж — сложение 3★. Ответы там копятся, и сегодня же взято золото —
    // задание обязано стоять на 3★ до конца дня.
    const open = ADD_OPEN.concat(['integer+:add:4']);
    const w = load({ open });
    const seen = [];
    for (const n of [0, 5, 20, 60]) {
        // Два дня занятий в месяце до сегодняшнего — день звезды.
        const s = [{ off: 9, key: 'integer+:add:2', c: 5, w: 0 }, { off: 2, key: 'integer+:add:3', c: 40, w: 0 }];
        if (n) s.push({ off: 0, key: 'integer+:add:3', c: n, w: 0 });
        const unlocks = medals({ 'integer+:add:1': GOLD, 'integer+:add:2': GOLD });
        if (n >= 60) Object.assign(unlocks, medals({ 'integer+:add:3': GOLD }, TODAY));
        const st = student(s, unlocks);
        assert(w.isStarDay(st.daily, TODAY), 'проверка рассчитана на день звезды');
        const t = w.dailyTasks(st, TODAY, 'ЯР7')[0];
        assert(t.star && t.cell === 'integer+:add:3', `главное не рубеж: ${t.text} [${t.cell}]`);
        seen.push(`${t.id} :: ${t.text}`);
    }
    eq(seen.filter(x => x !== seen[0]).join(' / '), '', `рубеж сдвинулся за день, был ${seen[0]}`);
});

test('«Новая тема» не убегает, когда её начинают делать', () => {
    // Роль выбирала клетку, где ещё не были. Первый же ответ там делал её «сегодняшней»,
    // роль выбирала другую, и счёт начинался с нуля. Выполнить такое было нельзя.
    const home = 'integer+:add:1';
    const w = load({ open: [home, 'integer+:sub:1', 'integer+:mul:1', 'integer+:div:1'] });
    const cells = {};
    const st = (k) => {
        const t = { [home]: [30, 0] };
        if (k > 0 && cells.target) t[cells.target] = [k, 0];
        return { byTopic: Object.assign({ [home]: { correct: 30, wrong: 0 } },
                     k > 0 && cells.target ? { [cells.target]: { correct: k, wrong: 0 } } : {}),
                 daily: journal({ 1: day(30, 0, { [home]: [30, 0] }), 0: day(30 + k, 0, t) }) };
    };
    const first = w.dailyTasks(st(0), TODAY, 'ЯР7').filter(x => x.role === 'explore')[0];
    assert(first && /Новая тема/.test(first.text), `задания «Новая тема» нет: ${first && first.text}`);
    cells.target = first.cell;
    for (let k = 1; k <= 4; k++) {
        const now = w.dailyTasks(st(k), TODAY, 'ЯР7').filter(x => x.role === 'explore')[0];
        assert(now, `после ${k} ответов задание «Новая тема» пропало`);
        eq(now.cell, first.cell, `после ${k} ответов задание перепрыгнуло в другую клетку`);
        eq(now.text, first.text, `после ${k} ответов задание сменило текст`);
    }
});

test('недельное задание тоже стоит на месте всю неделю', () => {
    const cell = 'integer+:add:1';
    const w = load({ open: [cell, 'integer+:sub:1'] });
    // Недельное выбирается жребием из трёх, и на две трети кодов выпадает не то
    // задание, что считается от прогресса. Тогда проверка молчала бы при любой
    // поломке — берём код, у которого выпадает именно оно.
    // Недельное меряет от начала НЕДЕЛИ, поэтому история нужна из прошлой недели:
    // вчерашние ответы лежат внутри текущей и в основание не годятся. Восемь дней
    // назад — всегда прошлая неделя, какой бы день сегодня ни был.
    const weekOf = (today) => {
        const j = { 8: day(30, 0, { [cell]: [30, 0] }) };
        if (today > 0) j[0] = day(today, 0, { [cell]: [today, 0] });
        return { byTopic: { [cell]: { correct: 30 + today, wrong: 0 } }, daily: journal(j) };
    };
    let code = null;
    for (const c of ['ЯР7', 'ЯР8', 'ЯР9', 'МД1', 'МД2', 'МД3', 'АБ1', 'АБ2', 'АБ3']) {
        const wk = w.weeklyTask(weekOf(1), TODAY, c);
        if (wk && wk.cell === cell) { code = c; break; }
    }
    assert(code, 'не нашлось кода, у которого недельное задание считается от прогресса');
    const seen = [];
    for (let n = 1; n <= 8; n++) {
        const wk = w.weeklyTask(weekOf(n), TODAY, code);
        assert(wk && wk.cell === cell, `на ${n} верных недельное задание сменилось на другое`);
        seen.push(`${wk.id} :: ${wk.text}`);
    }
    const moved = seen.filter(x => x !== seen[0]);
    assert(moved.length === 0,
        `недельное изменилось:\n      было  ${seen[0]}\n      стало ${moved[0]}`);
});

test('у нового ученика набор не перетасовывается на первом же ответе', () => {
    // Совсем новый аккаунт: ничего никогда не решал. Первый верный ответ рождал роль
    // «продвинуться», она занимала клетку, «Новая тема» съезжала в соседнюю, третье
    // задание вытеснялось, а у недельного менялась длина жребия — и оно тоже
    // сменялось. Весь набор перетасовывался на одном ответе.
    const cell = 'integer+:add:1';
    const w = load({ open: [cell, 'integer+:sub:1', 'integer+:mul:1', 'integer+:div:1'] });
    const shot = (n) => {
        const st = n === 0 ? { byTopic: {}, daily: {} } : dayOf(cell, 0, n);
        const wk = w.weeklyTask(st, TODAY, 'ЯР7');
        return w.dailyTasks(st, TODAY, 'ЯР7').map(x => x.id).join(' , ')
             + '  ||  ' + (wk ? wk.id : '—');
    };
    const first = shot(0);
    for (const n of [1, 2, 5, 9, 14]) {
        eq(shot(n), first, `после ${n} верных набор заданий стал другим`);
    }
});

test('недельный жребий всегда из трёх вариантов', () => {
    // Первый вариант добавлялся, только если роль «продвинуться» нашлась, — и длина
    // списка менялась с двух на три, а вместе с ней остаток от деления. Недельное
    // задание из-за этого сменялось посреди недели. Длину проверяем прямо: у пустого
    // аккаунта по разным кодам должны встречаться ВСЕ ТРИ варианта, а не два.
    const w = load({ open: ['integer+:add:1', 'integer+:sub:1'] });
    const empty = { byTopic: {}, daily: {} };
    const kinds = {};
    for (let i = 0; i < 60; i++) {
        const wk = w.weeklyTask(empty, TODAY, 'S' + i);
        if (wk) kinds[wk.id] = true;
    }
    eq(Object.keys(kinds).length, 3,
        `вариантов недельного задания ${Object.keys(kinds).length}, а должно быть три: ${Object.keys(kinds).join(', ')}`);
});

group('Общие задания');

test('подпись общего задания не читается как «в каждой теме»', () => {
    // Под «Реши 25 примеров» стояло «по всем темам» — и вместе это читалось как
    // «по двадцать пять в каждой теме». Задание считает ответы где угодно, и подпись
    // не должна называть темы вовсе.
    const w = load({ open: ['integer+:add:1', 'integer+:sub:1'] });
    const list = w.dailyTasks({ byTopic: {}, daily: {} }, TODAY, 'ЯР7');
    const common = list.filter(x => !x.cell);
    assert(common.length > 0, 'общих заданий не нашлось');
    common.forEach(x => {
        assert(!/тем/i.test(x.where || ''),
            `подпись общего задания называет темы: «${x.where}»`);
        assert((x.where || '').trim(), 'подпись общего задания снова пустая');
    });
});

test('дневное задание не повторяет дневную цель', () => {
    // Дневная цель считает ВЕРНЫЕ ответы за сегодня и стоит наверху экрана крупно,
    // с огоньком и серией. Добивка «Набери 15 верных ответов» считала ровно ту же
    // величину, только с другим порогом: два счётчика одного числа, и второй
    // закрывался сам собой по дороге к первому. Максим это и заметил.
    //
    // Правило: дневное задание БЕЗ клетки не имеет права считать верные ответы.
    // С клеткой можно — там величина другая, верные в одной теме.
    const w = load({ open: ['integer+:add:1', 'integer+:sub:1', 'integer+:mul:1'] });
    const bad = [];
    for (let i = 0; i < 60; i++) {
        w.dailyTasks({ byTopic: {}, daily: {} }, TODAY, 'S' + i).forEach(x => {
            if (!x.cell && x.kind === 'correct') bad.push(`S${i}: «${x.text}»`);
        });
    }
    assert(bad.length === 0,
        `дневное задание снова считает то же, что дневная цель: ${bad[0]}`);
});

test('общие задания не начинаются одинаково', () => {
    // «Реши 25 примеров» и «Реши верно 15 примеров» стояли рядом и отличались одним
    // словом в середине — Максим прочитал их как одно требование. Считают они разное:
    // первое любые ответы, второе только верные. Разное надо и называть по-разному,
    // причём с первого слова: дальше ребёнок уже не вчитывается.
    const w = load({ open: ['integer+:add:1', 'integer+:sub:1'] });
    const seen = {};
    const all = {};
    for (let i = 0; i < 60; i++) {
        w.dailyTasks({ byTopic: {}, daily: {} }, TODAY, 'S' + i)
            .filter(x => !x.cell)
            .forEach(x => { seen[x.text.split(' ')[0].toLowerCase()] = x.text; all[x.text] = true; });
    }
    // Одно первое слово — один текст. Если два разных задания начинаются одинаково,
    // в seen останется только последнее, и число текстов не сойдётся с числом заданий.
    eq(Object.keys(seen).length, Object.keys(all).length,
        `общих заданий ${Object.keys(all).length}, а разных первых слов ${Object.keys(seen).length}`);
});

test('новое зовут темой, а не «местом»', () => {
    // «Новое место» — оборот из нашей головы: у ученика мест нет, у него есть темы,
    // и слово «тема» стоит тут же, в подписи под строкой.
    const w = load({ open: ['integer+:add:1', 'integer+:sub:1'] });
    const fresh = w.dailyTasks({ byTopic: {}, daily: {} }, TODAY, 'ЯР7').filter(x => x.fresh);
    assert(fresh.length > 0, 'заданий в новую тему нет');
    fresh.forEach(x => {
        assert(/тем/i.test(x.text), `сказано: «${x.text}»`);
        assert(!/мест/i.test(x.text), `снова про «место»: «${x.text}»`);
    });
});

test('роль не пропадает из-за того, что клетку заняла другая', () => {
    // У нового ученика главное и «другое действие» оба указывали бы на первую клетку
    // карты. Совпавшую нельзя просто отбрасывать — заданий выходило бы два вместо трёх.
    const w = load({ open: ['integer+:add:1', 'integer+:sub:1', 'integer+:mul:1'] });
    const list = w.dailyTasks({ byTopic: {}, daily: {} }, TODAY, 'ЯР7');
    const roles = list.filter(x => x.role).map(x => x.role);
    assert(roles.indexOf('advance') >= 0, `нет главного задания: ${show(list)}`);
    assert(roles.indexOf('explore') >= 0, `нет «другого действия» — его съело главное: ${show(list)}`);
    const cellsUsed = list.filter(x => x.cell).map(x => x.cell);
    eq(cellsUsed.length, new Set(cellsUsed).size, 'два задания про одну клетку');
});

test('порядок не перемешивается жребием: домашка, главное, остальное', () => {
    const w = hwWorld();
    const st = hwStudent(0);
    const list = w.dailyTasks(st, TODAY, 'ЯР7', [hw({ dueOn: '2026-09-12' })]);
    assert(list[0].hw, `первой не домашка: ${show(list)}`);
    assert(list[1] && (list[1].star || list[1].tier), `вторым не главное: ${show(list)}`);
});

group('Слова, которые видит ученик');

test('в заданиях нет наших внутренних слов', () => {
    // Это слова, которых ученик нигде больше не встречает. «Ступень» — на экране
    // достижений те же вещи называются поимённо, 🥉 Бронза, 🥈 Серебро и так далее.
    // «Клетка» — то же самое в приложении зовётся темой: «в теме %2», «Медали по темам».
    // Оба раза строка сообщала ребёнку слово из нашей головы вместо своего дела.
    //
    // Комментарии выбрасываем: ученик их не читает, а объяснение этой самой правки
    // стоит рядом с текстами и называет оба слова — проверка ловила себя.
    const body = slice('function taskText(task)', '// --- Кого куда вести', 'тексты заданий')
        .replace(/\/\/[^\n]*/g, '');
    [['ступен', 'у ученика это медали'], ['клетк', 'у ученика это темы']].forEach(([w, why]) => {
        assert(!new RegExp(w, 'i').test(body),
            `в текстах заданий снова появилось «${w}» — ${why}`);
    });
});

test('в заданиях нет прошедшего времени во втором лице', () => {
    // По-русски «ты не был» подходит мальчику и не подходит девочке, а пол мы не
    // спрашиваем и спрашивать не будем. Значит, таких оборотов в заданиях быть не
    // должно вовсе: остаются повелительное наклонение и безличные обороты.
    const body = slice('function taskText(task)', '// --- Кого куда вести', 'тексты заданий')
        .replace(/\/\/[^\n]*/g, '');
    // Границу слова здесь нельзя задавать через \b: в JavaScript \b знает только
    // латиницу и цифры, и рядом с кириллицей его просто нет. Первая версия этой
    // проверки из-за этого не находила ни «не был», ни «набрал» — молчала на всём.
    // Границы задаём явно: слева и справа не должно быть русской буквы.
    const bad = [...body.matchAll(
        /'[^']*(?<![а-яё])(ты\s+[а-яё]+л|не был|набрал|справился|смог|взял|дошёл|прошёл)(?![а-яё])[^']*'/gi)]
        .map(m => m[0]);
    assert(bad.length === 0, `род выдаёт: ${bad.join('; ')}`);
});

test('медаль называется по имени и со значком', () => {
    const list = T.dailyTasks(busy(), TODAY, 'ЯР7');
    const adv = list.filter(x => x.tier)[0];
    assert(adv, `задания на медаль не нашлось: ${show(list)}`);
    assert(/Бронза|Серебро|Золото|Алмаз|Легенда/.test(adv.text),
        `медаль не названа: «${adv.text}»`);
    assert(/🥉|🥈|🥇|💎|👑/.test(adv.text), `нет значка медали: «${adv.text}»`);
});

test('перевыполненное задание не показывает больше цели', () => {
    // «13 из 10» формально верно, но читается как сбой счётчика: цель одна, а число
    // рядом другое. Выполненное показываем ровно как цель.
    const body = slice('const row = (task, isWeek) =>', 'list.forEach', 'строка задания');
    assert(/task\.done \? task\.need/.test(body),
        'счётчик выполненного задания снова показывает набранное, а не цель');
});

group('Снимок 23 октября больше не повторяется');

// Ученик со снимка: сложение и вычитание 1–3★ взяты давно; умножение 1★ — 150 верных,
// по последней сотне 96%, но за две недели 28 ответов и 4 ошибки; умножение 2★ — 137
// верных, им он занят каждый день; умножение 3★ — начато; 5★ открыта репетитором.
function snapshot(skipDay) {
    const s = [];
    const add = (off, key, c, w) => s.push({ off, key, c, w });
    for (let d = 60; d >= 30; d--) { add(d, 'integer+:add:1', 6, 0); add(d, 'integer+:add:2', 6, 0); add(d, 'integer+:sub:2', 6, 0); }
    for (let d = 50; d >= 25; d--) { add(d, 'integer+:add:3', 4, 0); add(d, 'integer+:sub:1', 4, 0); add(d, 'integer+:sub:3', 4, 0); }
    for (let d = 44; d >= 17; d--) add(d, 'integer+:mul:1', 4, 0);
    add(16, 'integer+:mul:1', 2, 0);
    [12, 9, 6, 3].forEach(d => add(d, 'integer+:mul:1', 6, 1));
    for (let d = 23; d >= 1; d--) if (d !== skipDay) add(d, 'integer+:mul:2', 6, d % 5 ? 0 : 1);
    add(2, 'integer+:mul:3', 4, 2);
    add(3, 'integer+:mul:5', 5, 1);
    const st = student(s, medals({
        'integer+:add:1': { a: 5, c: 5 }, 'integer+:add:2': { a: 5, c: 5 }, 'integer+:add:3': GOLD,
        'integer+:sub:1': GOLD, 'integer+:sub:2': { a: 5, c: 5 }, 'integer+:sub:3': GOLD,
        'integer+:mul:1': { a: 5, c: 4 }, 'integer+:mul:2': GOLD }));
    st.byTopic['integer+:mul:1'].correct = 150;
    st.byTopic['integer+:mul:2'].correct = 137;
    return st;
}
const SNAP_OPEN = ['integer+:add:1', 'integer+:add:2', 'integer+:add:3', 'integer+:add:4',
                   'integer+:sub:1', 'integer+:sub:2', 'integer+:sub:3', 'integer+:sub:4',
                   'integer+:mul:1', 'integer+:mul:2', 'integer+:mul:3', 'integer+:mul:5'];
const snapWorld = () => load({ open: SNAP_OPEN, named: ['integer+:mul:5'] });

test('экран достижений ученика со снимка: умножение 1★ — 96% по последней сотне', () => {
    const st = snapshot();
    eq(snapWorld().accuracyBefore(snapWorld().dailyBefore(st.daily, TODAY), 'integer+:mul:1'), 96);
});

test('ни «подтяни точность» при 96%, ни «вернись» в сложение 1★ с алмазом', () => {
    for (const skip of [0, 5]) {
        const list = snapWorld().dailyTasks(snapshot(skip), TODAY, 'ЯР7');
        assert(!list.some(x => x.cell === 'integer+:mul:1'), `задание про умножение 1★: ${show(list)}`);
        assert(!list.some(x => x.cell === 'integer+:add:1'), `зовут в сложение 1★: ${show(list)}`);
    }
});

test('день звезды ведёт к умножению 3★, день медали — к алмазу в умножении 2★', () => {
    const w = snapWorld();
    const days = [0, 5].map(skip => ({ star: w.isStarDay(snapshot(skip).daily, TODAY), list: w.dailyTasks(snapshot(skip), TODAY, 'ЯР7') }));
    const star = days.filter(d => d.star)[0], medalDay = days.filter(d => !d.star)[0];
    assert(star && medalDay, 'проверка рассчитана на оба дня');
    eq(star.list[0].cell, 'integer+:mul:3', `главное в день звезды: ${show(star.list)}`);
    assert(/до 4★/.test(star.list[0].text), `в день звезды: «${star.list[0].text}»`);
    eq(medalDay.list[0].cell, 'integer+:mul:2', `главное в день медали: ${show(medalDay.list)}`);
    assert(/💎/.test(medalDay.list[0].text), `в день медали: «${medalDay.list[0].text}»`);
});

test('и в другое действие — на следующую звезду, а не на первую', () => {
    const list = snapWorld().dailyTasks(snapshot(0), TODAY, 'ЯР7');
    const other = list.filter(x => x.role === 'explore')[0];
    assert(other && other.cell === 'integer+:add:4', `другое действие: ${show(list)}`);
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
