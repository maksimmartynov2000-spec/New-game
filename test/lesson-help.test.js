// «КОМУ НУЖНА ПОМОЩЬ» И КАРТОЧКА К УРОКУ — экраны репетитора, в живом браузере.
//
// Новых данных здесь нет: сводка и карточка считаются из состояния ученика тем же
// кодом, по которому ему самому выдаются задания и открываются звёзды. Проверяем,
// что считается именно то, что обещано на экране, и на правильном отрезке: «за
// неделю» — это семь дней, а не всё время, и одна случайная ошибка — не «застрял».
//
// Как запускать:  node test/lesson-help.test.js

const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — проверка сводки пропущена.');
    console.log('Всего: 0, прошло: 0, упало: 0');
    process.exit(0);
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function check(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }

// ---------- подставные ученики ----------
const iso = (n) => { const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const day = (cells, e, te, s) => ({
    c: Object.values(cells).reduce((a, v) => a + v[0], 0), w: Object.values(cells).reduce((a, v) => a + v[1], 0),
    a: 0, s: s || 600, p: 0, ms: 0, mc: 0, tr: 0, t: cells, e: e || {}, te: te || {} });
const NOW = Date.now();
const STUDENTS = {
    MASHA: { label: 'Маша', updatedAt: new Date(NOW - 3600000).toISOString(), totals: { correct: 190, wrong: 40 }, state: {
        schema: 2, playerCode: 'MASHA', updatedAt: 1, accountType: 'linked', ownerCode: 'MAKS', profileLabel: 'Маша',
        byTopic: { 'integer+:mul:3': { correct: 70, wrong: 30 }, 'integer+:add:2': { correct: 120, wrong: 10 } },
        daily: {
            [iso(0)]: day({ 'integer+:mul:3': [8, 7, 0, 0, 8] }, { 'таблица умножения': 5, 'ошибка в десятках': 2 },
                          { 'integer+:mul:3': { 'таблица умножения': 5, 'ошибка в десятках': 2 } }, 900),
            [iso(-2)]: day({ 'integer+:mul:3': [8, 7, 0, 0, 8], 'integer+:add:2': [20, 1, 0, 0, 20] },
                           { 'таблица умножения': 5, 'перепутал действие': 2 },
                           { 'integer+:mul:3': { 'таблица умножения': 5, 'перепутал действие': 2 } }, 1500),
            // Девять дней назад — за пределами недели, но внутри двух недель для ошибок.
            [iso(-9)]: day({ 'integer+:add:2': [30, 3, 0, 0, 30] }, { 'ошибка в десятках': 3 }, {}, 1200)
        },
        unlocks: {},
        mistakeBank: { items: {
            'integer+:mul:3|7 × 8': { k: 'integer+:mul:3', p: { text: '7 × 8', answer: 56, a: 7, b: 8 }, w: 54, e: 'таблица умножения', t: NOW - 3600000, ok: [] },
            'integer+:mul:3|6 × 9': { k: 'integer+:mul:3', p: { text: '6 × 9', answer: 54, a: 6, b: 9 }, w: 56, e: 'таблица умножения', t: NOW - 7200000, ok: [] },
            'integer+:add:2|38 + 7': { k: 'integer+:add:2', p: { text: '38 + 7', answer: 45, a: 38, b: 7 }, w: 35, e: 'ошибка в десятках', t: NOW - 86400000, ok: [] }
        }, done: {} } } },
    PETYA: { label: 'Петя', updatedAt: new Date(NOW - 86400000).toISOString(), totals: { correct: 260, wrong: 12 }, state: {
        schema: 2, playerCode: 'PETYA', updatedAt: 1, accountType: 'linked', ownerCode: 'MAKS', profileLabel: 'Петя',
        byTopic: { 'integer+:add:2': { correct: 260, wrong: 12 } },
        daily: { [iso(-1)]: day({ 'integer+:add:2': [40, 2, 0, 0, 40] }, {}, {}, 1800) },
        unlocks: { 'integer+:add:2:c3': iso(-1), 'integer+:add:2:a3': iso(-1) },
        mistakeBank: { items: {}, done: {} } } },
    VANYA: { label: 'Ваня', updatedAt: new Date(NOW - 2 * 86400000).toISOString(), totals: { correct: 15, wrong: 1 }, state: {
        schema: 2, playerCode: 'VANYA', updatedAt: 1, accountType: 'linked', ownerCode: 'MAKS', profileLabel: 'Ваня',
        byTopic: { 'integer+:div:3': { correct: 15, wrong: 1 } },
        daily: { [iso(-2)]: day({ 'integer+:div:3': [15, 1, 0, 0, 15] }, {}, {}, 700) }, unlocks: {}, mistakeBank: { items: {}, done: {} } },
        exams: [{ op: 'div', section: 'integer+', level: 3, passed: true, takenAt: new Date(NOW - 2 * 86400000).toISOString() },
                { op: 'mul', section: 'integer+', level: 0, passed: false, takenAt: new Date(NOW - 86400000).toISOString() }] },
    LIZA: { label: 'Лиза', updatedAt: new Date(NOW - 3 * 86400000).toISOString(), totals: { correct: 6, wrong: 2 }, state: {
        schema: 2, playerCode: 'LIZA', updatedAt: 1, accountType: 'linked', ownerCode: 'MAKS', profileLabel: 'Лиза',
        byTopic: { 'integer+:sub:2': { correct: 6, wrong: 2 } }, daily: {}, unlocks: {}, mistakeBank: { items: {}, done: {} } } },
    // Давно молчит: за экзаменами к нему не ходим.
    OLEG: { label: 'Олег', updatedAt: new Date(NOW - 30 * 86400000).toISOString(), totals: { correct: 3, wrong: 0 }, state: {
        schema: 2, playerCode: 'OLEG', updatedAt: 1, accountType: 'linked', ownerCode: 'MAKS', profileLabel: 'Олег',
        byTopic: {}, daily: {}, unlocks: {}, mistakeBank: { items: {}, done: {} } } }
};
const HOMEWORK = [
    { id: 4, batch: 5, student: 'LIZA', label: 'Лиза', topic: 'integer+:sub:2', need: 20, done: 6, dueOn: iso(-1), doneOn: null },
    { id: 5, batch: 6, student: 'PETYA', label: 'Петя', topic: 'integer+:add:2', need: 10, done: 12, dueOn: iso(2), doneOn: iso(-1) },
    { id: 6, batch: 7, student: 'MASHA', label: 'Маша', topic: 'integer+:mul:3', need: 30, done: 14, dueOn: iso(2), doneOn: null }
];

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    const calls = [];
    let students = STUDENTS;
    await page.route('**/rest/v1/rpc/*', r => {
        const fn = r.request().url().split('/rpc/')[1];
        let req = null; try { req = r.request().postDataJSON(); } catch (e) {}
        calls.push([fn, req]);
        let body = { ok: true };
        if (fn === 'session_state') body = { ok: true, state: { schema: 2, playerCode: 'MAKS', updatedAt: 1, accountType: 'self' } };
        if (fn === 'session_my_access') body = { ok: true, access: {} };
        if (fn === 'session_list_students') body = { ok: true, students: Object.keys(students).map(code => ({
            code, label: students[code].label, totals: students[code].totals, updatedAt: students[code].updatedAt })) };
        if (fn === 'session_student_state') { const x = students[req && req.p_student_code];
            body = x ? { ok: true, state: x.state } : { ok: false, error: 'not_your_student' }; }
        if (fn === 'session_student_exams') { const x = students[req && req.p_student_code]; body = { ok: true, exams: (x && x.exams) || [] }; }
        if (fn === 'session_tutor_homework') body = { ok: true, homework: HOMEWORK };
        if (fn === 'session_assign_homework') body = { ok: true, batch: 9, assigned: (req && req.p_students) || [], skipped: [], opened: [] };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();
        Progress.switchTo('MAKS', null, { accountType: 'self', profileLabel: 'Максим' });
        Progress.setToken('MAKS', 'tok'); enterApp(); null`);
    await page.waitForTimeout(300);
    const count = (fn) => calls.filter(c => c[0] === fn).length;
    const openProfile = async () => {
        // Прошлую сводку стираем: иначе ожидание ниже увидело бы её, а не новую.
        await page.evaluate(`document.getElementById('studentsHelp').innerHTML = ''; openProfileScreen(); null`);
        await page.waitForFunction(`!/Смотрю/.test(document.getElementById('studentsHelp').innerText)
                                    && document.getElementById('studentsHelp').innerText.length > 0`, null, { timeout: 10000 });
    };
    const help = () => page.evaluate(`(() => {
        const out = {};
        let g = null;
        [...document.getElementById('studentsHelp').children].forEach(el => {
            if (el.classList.contains('help-group')) { g = el.innerText; out[g] = []; }
            if (el.classList.contains('help-line') && g) out[g].push(el.innerText.replace(/\\s+/g, ' ').trim());
        });
        return out; })()`);

    console.log('\nКому нужна помощь');
    await openProfile();
    const h = await help();
    await check('застрял: клетка, точность и ошибки за неделю, чаще всего — какая ошибка', () => {
        const l = (h['🧱 Застряли'] || [])[0] || '';
        assert(/^Маша Положительные → Умножение → 3★ — точность 53%, ошибок 14, чаще всего: ошибка в таблице умножения$/.test(l), l);
        eq((h['🧱 Застряли'] || []).length, 1, 'застрявших');
    });
    await check('готов к новой звезде: золото взято, на следующей ответов нет', () =>
        eq(JSON.stringify(h['🚀 Готовы к новой звезде']), JSON.stringify(['Петя Положительные → Сложение — золото взято, можно на 3★']), 'строки'));
    await check('экзамен за неделю — только сданный', () =>
        eq(JSON.stringify(h['🎓 Сдали экзамен']), JSON.stringify(['Ваня Деление — открыто до 3★']), 'строки'));
    await check('домашнее: просроченное и сделанное за неделю', () => {
        eq(JSON.stringify(h['⏰ Домашнее просрочено']), JSON.stringify(['Лиза Положительные → Вычитание → 2★ — 6 / 20']), 'просрочено');
        eq(JSON.stringify(h['✅ Сделали домашнее']), JSON.stringify(['Петя Положительные → Сложение → 2★']), 'сделано');
    });
    await check('за экзаменами молчащего больше двух недель не ходим', () => {
        const asked = calls.filter(c => c[0] === 'session_student_exams').map(c => c[1].p_student_code);
        assert(asked.indexOf('OLEG') < 0 && asked.indexOf('MASHA') >= 0, asked.join(','));
    });
    const before = count('session_student_state');
    await page.evaluate(`closeProfileScreen(); null`);
    await openProfile();
    await check('повторный заход в профиль не тянет учеников заново', () =>
        eq(count('session_student_state'), before, 'запросов состояния'));

    console.log('\nПороги');
    const sig = (st, exams, hw) => page.evaluate(`JSON.stringify(studentHelpSignals(studentStateForView(${JSON.stringify(st)}),
        ${JSON.stringify(exams || [])}, ${JSON.stringify(hw || [])}, Progress.dayKey()))`).then(JSON.parse);
    const base = { schema: 2, playerCode: 'X', updatedAt: 1, byTopic: {}, unlocks: {}, daily: {} };
    await check('девять ответов при нуле верных — ещё не «застрял»: судить рано', async () => {
        const s = await sig(Object.assign({}, base, { daily: { [iso(0)]: day({ 'integer+:add:1': [0, 9, 0, 0, 0] }) } }));
        assert(!s.stuck, JSON.stringify(s.stuck));
    });
    await check('десять ответов и 60% — застрял; 70% — уже нет', async () => {
        const s1 = await sig(Object.assign({}, base, { daily: { [iso(0)]: day({ 'integer+:add:1': [6, 4, 0, 0, 6] }) } }));
        const s2 = await sig(Object.assign({}, base, { daily: { [iso(0)]: day({ 'integer+:add:1': [7, 3, 0, 0, 7] }) } }));
        assert(s1.stuck && s1.stuck.accuracy === 60 && !s2.stuck, JSON.stringify([s1.stuck, s2.stuck]));
    });
    await check('ответы старше недели не считаются', async () => {
        const s = await sig(Object.assign({}, base, { daily: { [iso(-7)]: day({ 'integer+:add:1': [0, 20, 0, 0, 0] }) } }));
        assert(!s.stuck, JSON.stringify(s.stuck));
    });
    await check('«чаще всего» — та ошибка, которой больше, а не первая в записи', async () => {
        const s = await sig(Object.assign({}, base, { daily: { [iso(0)]: day({ 'integer+:add:1': [5, 5, 0, 0, 5] }, {},
            { 'integer+:add:1': { 'перепутал действие': 1, 'ошибка в десятках': 4 } }) } }));
        assert(s.stuck && s.stuck.kind === 'ошибка в десятках', JSON.stringify(s.stuck));
    });
    await check('из нескольких застрявших клеток — худшая', async () => {
        const s = await sig(Object.assign({}, base, { daily: { [iso(0)]: day({ 'integer+:add:1': [6, 4, 0, 0, 6], 'integer+:sub:1': [2, 8, 0, 0, 2] }) } }));
        assert(s.stuck && s.stuck.cell === 'integer+:sub:1', JSON.stringify(s.stuck));
    });
    await check('не готов к звезде: на следующей уже решал, золото только по количеству, пятая', async () => {
        const a = await sig(Object.assign({}, base, { byTopic: { 'integer+:add:2': { correct: 200 }, 'integer+:add:3': { correct: 0, wrong: 1 } },
            unlocks: { 'integer+:add:2:c3': '2026-01-01', 'integer+:add:2:a3': '2026-01-01' } }));
        const c = await sig(Object.assign({}, base, { byTopic: { 'integer+:add:2': { correct: 200 } }, unlocks: { 'integer+:add:2:c3': '2026-01-01' } }));
        const e = await sig(Object.assign({}, base, { byTopic: { 'integer+:add:5': { correct: 300 } },
            unlocks: { 'integer+:add:5:c3': '2026-01-01', 'integer+:add:5:a3': '2026-01-01' } }));
        assert(!a.ready.length && !c.ready.length && !e.ready.length, JSON.stringify([a.ready, c.ready, e.ready]));
    });
    await check('экзамен старше недели и домашнее со сроком сегодня в сводку не попадают', async () => {
        const s = await sig(base, [{ op: 'add', level: 2, passed: true, takenAt: new Date(NOW - 8 * 86400000).toISOString() }],
            [{ topic: 'integer+:add:1', need: 10, done: 1, dueOn: iso(0) },
             { topic: 'integer+:add:1', need: 10, done: 10, doneOn: iso(-8) }]);
        assert(!s.exams.length && !s.hwLate.length && !s.hwDone.length, JSON.stringify(s));
    });

    console.log('\nКарточка к уроку');
    await page.evaluate(`[...document.querySelectorAll('#studentsHelp .help-line')].find(l => /Маша/.test(l.innerText)).click(); null`);
    await page.waitForTimeout(400);
    const card = await page.evaluate(`document.getElementById('appDialogCard').innerText`);
    const lines = card.split('\n').map(x => x.trim()).filter(Boolean);
    const after = (head) => { const i = lines.indexOf(head); return i < 0 ? [] : lines.slice(i + 1); };
    await check('за неделю: дни, верно и ошибки с точностью, время', () => {
        const w = after('ЗА НЕДЕЛЮ').concat(after('За неделю'));
        assert(card.indexOf('Дней с занятиями: 2 из 7') >= 0 && card.indexOf('Верно 36, ошибок 15 — точность 71%') >= 0
               && card.indexOf('Время за игрой: 40 мин') >= 0, card);
    });
    await check('частые ошибки за две недели — по убыванию, с числом', () => {
        const a = card.indexOf('Ошибка в таблице умножения — 10'), b2 = card.indexOf('Единицы верные, ошибка в десятках — 5'),
              c = card.indexOf('Не то действие — 2');
        assert(a >= 0 && b2 > a && c > b2, card);
    });
    await check('у ошибки — живой пример из копилки, самый свежий', () => {
        assert(card.indexOf('7 × 8 = 56, ответ был 54') >= 0 && card.indexOf('6 × 9') < 0
               && card.indexOf('38 + 7 = 45, ответ был 35') >= 0, card);
    });
    await check('что взять на уроке: подтянуть и продвинуть', () => {
        assert(card.indexOf('Подтянуть: Положительные → Умножение → 3★ — точность 53% за две недели') >= 0
               && /Продвинуть: Положительные → Сложение → 2★ — до медали .* «Алмаз» ещё 30/.test(card), card);
    });
    await check('домашнее и копилка ученика', () => {
        assert(card.indexOf('Положительные → Умножение → 3★ — 14 / 30') >= 0 && card.indexOf('3 примера ждут повтора') >= 0, card);
    });
    await page.evaluate(`[...document.querySelectorAll('#appDialogCard button')].find(x => /Задать домашнее/.test(x.innerText)).click(); null`);
    await page.waitForTimeout(500);
    const picked = await page.evaluate(`[...document.querySelectorAll('#appDialogCard .pick-row:not(.pick-head)')]
        .filter(l => l.querySelector('input').checked).map(l => l.innerText.replace(/\\s+/g, ' ').trim())`);
    await check('«Задать домашнее» из карточки — ученик уже отмечен', () =>
        eq(JSON.stringify(picked), JSON.stringify(['Маша MASHA']), 'отмечено'));
    await page.evaluate(`[...document.querySelectorAll('#appDialogCard button')].find(x => x.innerText.trim() === 'Отмена').click(); null`);
    await page.waitForTimeout(200);

    console.log('\nПримеры из копилки любого вида');
    const ex = await page.evaluate(`[
        bankExampleText({ k: 'fraction+:add:2', p: { f1: { num: 1, den: 2 }, f2: { num: 1, den: 3 }, answer: { num: 5, den: 6 } }, w: { num: 2, den: 5 } }),
        bankExampleText({ k: 'fraction+:simplify:3', p: { given: { num: 4, den: 24 }, answer: { num: 1, den: 6 } }, w: { num: 2, den: 12 } }),
        bankExampleText({ k: 'fraction+:fracOfNumber:3', p: { fracNum: 7, fracDen: 10, N: 180, answer: 126 }, w: 120 }),
        bankExampleText({ k: 'decimal+:mul:3', p: { d1: { intVal: 3, dp: 1 }, d2: { intVal: 5, dp: 0 }, answer: { intVal: 15, dp: 1 } }, w: { intVal: 15, dp: 0 } }),
        bankExampleText({ k: 'integer+:div:1', p: { text: '28 ÷ 0', answer: null, noSolution: true, a: 28, b: 0 }, w: 0 }),
        bankExampleText({ k: 'integer-:add:2', p: { text: '-7 + 3', answer: -4, a: -7, b: 3 }, w: 'NO_SOLUTION' })
    ]`);
    await check('дроби, сокращение, дробь от числа, десятичные, «нет решения»', () => {
        eq(ex[0], '1/2 + 1/3 = 5/6, ответ был 2/5', 'дроби');
        eq(ex[1], 'сократить 4/24 = 1/6, ответ был 2/12', 'сокращение');
        eq(ex[2], '7/10 от 180 = 126, ответ был 120', 'дробь от числа');
        eq(ex[3], '0.3 × 5 = 1.5, ответ был 15', 'десятичные');
        eq(ex[4], '28 ÷ 0 = нет решения, ответ был 0', 'деление на ноль');
        eq(ex[5], '-7 + 3 = -4, ответ был нет решения', 'отрицательные');
    });

    console.log('\nСпокойная неделя');
    students = { PETYA: Object.assign({}, STUDENTS.PETYA, { state: Object.assign({}, STUDENTS.PETYA.state, { unlocks: {} }) }) };
    await page.evaluate(`helpCache = null; closeProfileScreen(); null`);
    calls.length = 0;
    await page.route('**/rest/v1/rpc/session_tutor_homework', r => r.fulfill({ status: 200, contentType: 'application/json',
                                                                               body: JSON.stringify({ ok: true, homework: [] }) }));
    await openProfile();
    const calm = await page.evaluate(`document.getElementById('studentsHelp').innerText`);
    await check('никто не застрял и ничего не ждёт — так и сказано', () =>
        assert(/никто не застрял и ничего не ждёт/.test(calm), calm));

    record('всё это прошло без ошибок в консоли', errors.length ? errors.slice(0, 3).join(' | ') : null);
    await b.close();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`)); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
