// ДОМАШНИЕ ЗАДАНИЯ — ученик и репетитор, в живом браузере с подставным сервером.
//
// Сервер проверяет supabase/homework.test.sql. Здесь — всё, что вокруг: что ученик
// видит и что ему засчитывается, и что уходит на сервер от репетитора. Цена ошибки
// с обеих сторон одна и та же — недоверие: ученик решил, а задание стоит на месте;
// репетитор задал, а у ученика пусто или звезда заперта.
//
// Сначала — отметки о выполнении в модуле прогресса (без браузера).
//
// Как запускать:  node test/homework.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function check(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }

// ---------- модуль прогресса в песочнице ----------
const RealDate = Date;
let shiftMs = 0;
class FakeDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(RealDate.now() + shiftMs); else super(...args); }
    static now() { return RealDate.now() + shiftMs; }
}
function loadProgress(store) {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'progress.js'), 'utf8');
    const box = store || {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date: FakeDate, isNaN, parseInt, parseFloat, Promise,
        localStorage: { getItem: (k) => (k in box ? box[k] : null), setItem: (k, v) => { box[k] = String(v); },
                        removeItem: (k) => { delete box[k]; } },
        setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src + '\n;globalThis.Progress = Progress;', sandbox, { filename: 'progress.js' });
    return { P: sandbox.Progress, store: box };
}
const dayOf = (offset) => {
    const d = new RealDate(RealDate.now() + offset * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

(async () => {
    console.log('\nОтметка «выполнено» в прогрессе');

    await check('отмечается сегодняшним днём и один раз', () => {
        shiftMs = 0;
        const { P } = loadProgress(); P.init(); P.switchTo('KID', 'pw');
        assert(P.markHomeworkDone(17), 'первая отметка не принята');
        eq(P.getHomeworkDone()['17'], dayOf(0), 'день');
        shiftMs = 86400000;
        assert(!P.markHomeworkDone(17), 'вторая отметка принята');
        eq(P.getHomeworkDone()['17'], dayOf(0), 'повторная отметка сдвинула день');
        shiftMs = 0;
    });

    await check('мусор вместо номера не принимается', () => {
        const { P } = loadProgress(); P.init(); P.switchTo('KID', 'pw');
        ['', 'abc', -3, 1.5, null, '12; drop'].forEach(id => assert(!P.markHomeworkDone(id), 'принято: ' + id));
        eq(Object.keys(P.getHomeworkDone()).length, 0, 'отметок');
    });

    await check('отметка переживает перезапуск', () => {
        const env = loadProgress(); env.P.init(); env.P.switchTo('KID', 'pw');
        env.P.markHomeworkDone(5);
        const again = loadProgress(env.store); again.P.init();
        eq(again.P.getHomeworkDone()['5'], dayOf(0), 'после перезапуска');
    });

    await check('слияние: объединение, при расхождении — более ранний день', () => {
        const { P } = loadProgress(); P.init();
        const st = (hw) => P._normalize({ schema: 2, playerCode: 'KID', updatedAt: 1, hwDone: hw });
        const m = P._merge(st({ 1: '2026-10-05', 2: '2026-10-07' }), st({ 2: '2026-10-06', 3: '2026-10-08' })).hwDone;
        eq(JSON.stringify(m), JSON.stringify({ 1: '2026-10-05', 2: '2026-10-06', 3: '2026-10-08' }), 'слияние');
        const m2 = P._merge(st({ 2: '2026-10-06', 3: '2026-10-08' }), st({ 1: '2026-10-05', 2: '2026-10-07' })).hwDone;
        eq(JSON.stringify(Object.keys(m2).sort().map(k => [k, m2[k]])),
           JSON.stringify(Object.keys(m).sort().map(k => [k, m[k]])), 'слияние зависит от порядка');
    });

    await check('битые отметки выбрасываются, лишние — самые давние', () => {
        const { P } = loadProgress(); P.init();
        const junk = P._normalize({ schema: 2, playerCode: 'KID', updatedAt: 1,
            hwDone: { 1: 'вчера', abc: '2026-10-05', 2: 5, 3: '2026-10-05' } }).hwDone;
        eq(JSON.stringify(junk), '{"3":"2026-10-05"}', 'чистка');
        const many = {};
        for (let i = 1; i <= 120; i++) many[i] = `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + i % 28).padStart(2, '0')}`;
        const cut = P._normalize({ schema: 2, playerCode: 'KID', updatedAt: 1, hwDone: many }).hwDone;
        eq(Object.keys(cut).length, 100, 'отметок после обрезки');
        const days = Object.values(cut).sort();
        const dropped = Object.values(many).sort().slice(0, 20);
        assert(days[0] >= dropped[dropped.length - 1], 'ушли не самые давние');
        eq(JSON.stringify(P._normalize({ schema: 2, playerCode: 'KID', updatedAt: 1, hwDone: [] }).hwDone), '{}', 'массив вместо карты');
    });

    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch (e) {
        console.log('\nPlaywright не установлен — живые проверки пропущены.');
        finish();
        return;
    }

    // ---------- подставной сервер ----------
    const today = dayOf(0);
    const server = { homework: [], tutorHomework: [], access: {}, down: false, calls: [], assign: null, accountType: 'linked' };
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const errors = [];
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/rest/v1/rpc/*', async r => {
        const fn = r.request().url().split('/rpc/')[1];
        let req = null;
        try { req = r.request().postDataJSON(); } catch (e) { req = null; }
        server.calls.push([fn, req]);
        if (server.down) return r.abort();
        let body = { ok: true };
        if (fn === 'session_state') body = { ok: true, state: { schema: 2, playerCode: server.code || 'KID', updatedAt: 1,
                                                                 accountType: server.accountType, ownerCode: server.accountType === 'linked' ? 'MAKS' : null } };
        if (fn === 'session_my_access') body = { ok: true, access: server.access };
        if (fn === 'session_my_homework') body = { ok: true, homework: server.homework };
        if (fn === 'session_tutor_homework') body = { ok: true, homework: server.tutorHomework };
        if (fn === 'session_list_students') body = { ok: true, students: [
            { code: 'MASHA', label: 'Маша', totals: { correct: 100, wrong: 5 }, updatedAt: new Date().toISOString() },
            { code: 'PETYA', label: 'Петя', totals: { correct: 50, wrong: 5 }, updatedAt: new Date().toISOString() },
            { code: 'VANYA', label: 'Ваня', totals: { correct: 10, wrong: 5 }, updatedAt: new Date().toISOString() }] };
        if (fn === 'session_assign_homework') body = server.assign || { ok: true, batch: 9, assigned: (req && req.p_students) || [], skipped: [], opened: [] };
        if (fn === 'session_cancel_homework') body = { ok: true, removed: ((req && req.p_ids) || []).length };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await ctx.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                   body: 'window.MAINTENANCE={until:null,note:null};' }));
    await ctx.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    const calls = (fn) => server.calls.filter(c => c[0] === fn);

    // Ученик репетитора с прогрессом в двух клетках.
    const asStudent = async (byTopic, opts) => {
        const o = opts || {};
        server.accountType = o.accountType || 'linked';
        server.code = o.code || 'KID';
        await page.goto(FILE);
        await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
        await page.evaluate(`(async () => {
            window.MAINTENANCE = { until: null }; renderMaintenance(); reloadMaintenanceFile = function () {};
            Progress.switchTo(${JSON.stringify(server.code)}, null, { accountType: ${JSON.stringify(server.accountType)},
                                       ownerCode: ${JSON.stringify(server.accountType === 'linked' ? 'MAKS' : null)} });
            Progress.setToken(${JSON.stringify(server.code)}, 'tok');
            Progress.get().byTopic = ${JSON.stringify(byTopic || {})};
            enterApp();
            await Progress.flush(true);
            await refreshAccess();
        })()`);
        await page.waitForTimeout(150);
    };
    const card = () => page.evaluate(`(() => {
        const w = document.getElementById('homeworkWrap');
        return { видна: !w.hidden && getComputedStyle(w).display !== 'none',
                 строки: [...document.querySelectorAll('#homeworkList .hw-row')].map(r => ({
                     текст: r.querySelector('.task-text').innerText,
                     срок: r.querySelector('.task-where').innerText,
                     счёт: r.querySelector('.task-count').innerText,
                     готово: r.classList.contains('done'),
                     кнопка: !!r.querySelector('.task-go') })) };
    })()`);
    const HW = (id, topic, need, base, dueOn) => ({ id, topic, need, base, dueOn: dueOn || null, createdAt: new Date().toISOString() });

    console.log('\nУченик видит задания');
    {
        server.access = {};
        server.homework = [
            HW(11, 'integer+:mul:3', 5, 10, dayOf(1)),
            HW(12, 'integer+:add:2', 20, 0, null),
            HW(13, 'integer+:sub:1', 10, 0, dayOf(-2)),
            HW(14, 'integer+:div:1', 10, 0, today)
        ];
        await asStudent({ 'integer+:mul:3': { correct: 12, wrong: 1 } });
        const c = await card();
        await check('карточка видна, по строке на задание', () => {
            assert(c.видна, 'карточки нет');
            eq(c.строки.length, 4, 'строк');
        });
        await check('просроченное — первым, дальше по сроку, без срока — в конце', () => {
            eq(JSON.stringify(c.строки.map(r => r.текст.split(' → ').slice(1).join(' '))),
               JSON.stringify(['Вычитание 1★', 'Деление 1★', 'Умножение 3★', 'Сложение 2★']), 'порядок');
        });
        await check('сделано = сколько стало минус сколько было при выдаче', () => {
            eq(c.строки[2].счёт, '2 / 5', 'умножение');
            eq(c.строки[3].счёт, '0 / 20', 'сложение');
        });
        await check('срок словами: был, сегодня, завтра, без срока', () => {
            assert(/^⏰ срок был /.test(c.строки[0].срок), c.строки[0].срок);
            eq(c.строки[1].срок, '⏰ срок — сегодня', 'сегодня');
            eq(c.строки[2].срок, 'срок — завтра', 'завтра');
            eq(c.строки[3].срок, 'без срока', 'без срока');
        });
        await check('звезда задания открыта без золота, соседняя — нет', async () => {
            const r = await page.evaluate(`({ задание: isLevelOpen('integer+', 'mul', 3), соседняя: isLevelOpen('integer+', 'mul', 4),
                                              кнопка: [...document.querySelectorAll('#homeworkList .hw-row')].every(r => !!r.querySelector('.task-go')) })`);
            assert(r.задание && !r.соседняя && r.кнопка, JSON.stringify(r));
        });
    }

    console.log('\nЗадание из карточки — без подсказок, с выполнением');
    {
        await page.evaluate(`trainWanted = true; null`);
        await page.evaluate(`[...document.querySelectorAll('#homeworkList .hw-row')]
            .find(r => /Умножение/.test(r.innerText)).querySelector('.task-go').click(); null`);
        await page.waitForTimeout(200);
        const r1 = await page.evaluate(`({ идёт: gameActive, подсказки: trainActive, задание: missionHomeworkId,
                                          строка: document.getElementById('missionTask').innerText.replace(/\\s+/g, ' ') })`);
        await check('миссия из задания идёт без подсказок, даже если они включены', () => {
            assert(r1.идёт && r1.подсказки === false && r1.задание === 11, JSON.stringify(r1));
        });
        await check('в миссии видно, сколько по заданию сделано', () => eq(r1.строка, '📚 Домашнее задание 2 из 5', 'строка'));
        for (let i = 0; i < 3; i++) { await page.evaluate(`checkAnswer(correctAnswer, null); null`); await page.waitForTimeout(60); }
        const r2 = await page.evaluate(`({ строка: document.getElementById('missionTask').innerText.replace(/\\s+/g, ' '),
                                          отметка: Progress.getHomeworkDone()['11'],
                                          плашка: document.getElementById('achWrap').innerText.replace(/\\s+/g, ' ') })`);
        await check('третий верный — задание выполнено, день отмечен', () => {
            eq(r2.строка, '📚 Домашнее задание готово ✅', 'строка');
            eq(r2.отметка, today, 'день');
        });
        await check('плашка — про домашнее задание, а не «новое достижение»',
                    () => assert(/домашнее задание/i.test(r2.плашка) && /Выполнено!/.test(r2.плашка)
                                 && !/достижение/i.test(r2.плашка), r2.плашка));
        await page.evaluate(`finishChallenge(); null`);
        await page.waitForTimeout(300);
        await page.evaluate(`document.querySelectorAll('#puzzleReveal, #challengeReveal, #starUnlock').forEach(e => e.hidden = true); advanceMissionReveals(); null`);
        const win = await page.evaluate(`document.getElementById('winRows').innerText.replace(/\\s+/g, ' ')`);
        await check('на итогах — строка задания', () => assert(/📚 Домашнее задание готово ✅/.test(win), win));
        await page.evaluate(`winPlayAgain(); null`);
        await page.waitForTimeout(150);
        const r3 = await page.evaluate(`({ задание: missionHomeworkId, подсказки: trainActive, идёт: gameActive })`);
        await check('«Ещё раз» после задания — снова задание, без подсказок',
                    () => assert(r3.задание === 11 && r3.подсказки === false && r3.идёт, JSON.stringify(r3)));
        await page.evaluate(`if (gameActive) finishChallenge(); document.getElementById('winScreen').classList.remove('active');
                             winLeaveToConfig(); trainWanted = false; null`);
        const c = await card();
        const done = c.строки.find(r => /Умножение/.test(r.текст));
        await check('выполненное остаётся в карточке с галочкой и без кнопки',
                    () => assert(done && done.готово && !done.кнопка && done.срок === 'сделано', JSON.stringify(done)));
    }

    console.log('\nЧто засчитывается');
    {
        server.homework = [HW(21, 'integer+:add:2', 3, 0, null)];
        await asStudent({});
        // Обычная миссия в той же клетке с подсказками — не засчитывается.
        await page.evaluate(`exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
            exampleConfig.operations = { add: 2 }; trainWanted = true;
            document.getElementById('configScreen').style.display = 'none'; startGame();
            for (let i = 0; i < 4; i++) checkAnswer(correctAnswer, null); null`);
        await page.waitForTimeout(100);
        let r = await page.evaluate(`({ отметка: Progress.getHomeworkDone()['21'] || null,
                                        сделано: homeworkProgress(myHomework()[0]) })`);
        await check('ответы с подсказкой в задание не идут', () => assert(r.сделано === 0 && !r.отметка, JSON.stringify(r)));
        // Та же клетка без подсказок, не из карточки — засчитывается.
        await page.evaluate(`finishChallenge(); resetSessionCounters(); trainWanted = false;
            exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive'; exampleConfig.operations = { add: 2 };
            startGame(); for (let i = 0; i < 3; i++) checkAnswer(correctAnswer, null); null`);
        await page.waitForTimeout(100);
        r = await page.evaluate(`({ отметка: Progress.getHomeworkDone()['21'] || null, сделано: homeworkProgress(myHomework()[0]) })`);
        await check('обычная миссия в той же клетке без подсказок — засчитывается',
                    () => assert(r.сделано === 3 && r.отметка === today, JSON.stringify(r)));
        await page.evaluate(`finishChallenge(); resetSessionCounters(); null`);
    }

    console.log('\nВыполненное на другом устройстве и старое');
    {
        server.homework = [HW(31, 'integer+:add:1', 5, 2, null), HW(32, 'integer+:sub:1', 5, 0, null)];
        await asStudent({ 'integer+:add:1': { correct: 9, wrong: 0 } });
        const r = await page.evaluate(`({ отметка: Progress.getHomeworkDone()['31'] || null,
                                          плашка: document.getElementById('achWrap').innerText })`);
        await check('сделанное раньше отмечается молча, без плашки',
                    () => assert(r.отметка === today && !/Выполнено/.test(r.плашка), JSON.stringify(r)));
        await page.evaluate(`Progress.get().hwDone['31'] = Progress.dayKey(new Date(Date.now() - 3 * 86400000));
                             renderHomeworkCard(); null`);
        let c = await card();
        await check('выполненное больше двух дней назад из карточки уходит',
                    () => assert(c.строки.length === 1 && /Вычитание/.test(c.строки[0].текст), JSON.stringify(c.строки)));
        await page.evaluate(`Progress.get().hwDone['31'] = Progress.dayKey(new Date(Date.now() - 1 * 86400000));
                             renderHomeworkCard(); null`);
        c = await card();
        await check('а вчерашнее — ещё видно', () => eq(c.строки.length, 2, 'строк'));
    }

    console.log('\nБез связи и после снятия');
    {
        server.homework = [HW(41, 'integer+:add:1', 5, 0, null)];
        await asStudent({});
        server.down = true;
        await page.reload();
        await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); renderConfigTasks(); null`);
        await page.waitForTimeout(300);
        let c = await card();
        await check('без связи карточка видна по слепку на устройстве',
                    () => assert(c.видна && c.строки.length === 1, JSON.stringify(c)));
        server.down = false;
        server.homework = [];
        await page.evaluate(`refreshAccess()`);
        await page.waitForTimeout(200);
        c = await card();
        await check('репетитор снял задание — карточка исчезает', () => assert(!c.видна && c.строки.length === 0, JSON.stringify(c)));
        // И не возвращается из слепка, когда приложение открыли снова без связи.
        server.down = true;
        await page.reload();
        await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); renderConfigTasks(); null`);
        await page.waitForTimeout(300);
        c = await card();
        server.down = false;
        await check('и снятое не возвращается из слепка после перезапуска без связи',
                    () => assert(!c.видна, JSON.stringify(c)));
    }

    console.log('\nЗадания бывают только у ученика репетитора');
    {
        // Ученика отпустили, а слепок заданий на устройстве остался: показывать его
        // нельзя — заданий у самостоятельного аккаунта нет и быть не может.
        server.homework = [HW(61, 'integer+:add:1', 5, 0, null)];
        await asStudent({}, { code: 'KIDR' });
        await page.evaluate(`Progress.setAccountType('solo'); renderHomeworkCard(); null`);
        const left = await card();
        await check('отпущенный ученик: прежние задания из слепка не показываются',
                    () => assert(!left.видна, JSON.stringify(left)));
        server.homework = [HW(51, 'integer+:add:1', 5, 0, null)];
        for (const type of ['solo', 'self']) {
            server.calls.length = 0;
            await asStudent({}, { accountType: type, code: 'X' + type.toUpperCase() });
            const c = await card();
            await check(`${type === 'solo' ? 'самостоятельный' : 'репетитор'}: карточки нет и за заданиями не ходим`,
                        () => assert(!c.видна && calls('session_my_homework').length === 0,
                                     `карточка: ${c.видна}, запросов: ${calls('session_my_homework').length}`));
        }
    }

    console.log('\nРепетитор: список');
    const asTutor = async () => {
        server.accountType = 'self';
        server.code = 'MAKS';
        await page.goto(FILE);
        await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
        await page.evaluate(`(async () => {
            window.MAINTENANCE = { until: null }; renderMaintenance();
            Progress.switchTo('MAKS', null, { accountType: 'self', profileLabel: 'Максим' });
            Progress.setToken('MAKS', 'tok');
            Progress.setStudentGroup('MASHA', '5 класс'); Progress.setStudentGroup('VANYA', '5 класс');
            enterApp();
        })()`);
        await page.waitForTimeout(200);
    };
    const dialog = () => page.evaluate(`document.getElementById('appDialogCard').innerText.replace(/[ \\t]+/g, ' ')`);
    const press = (text) => page.evaluate(`(() => {
        const b = [...document.querySelectorAll('#appDialogCard button')].find(x => x.innerText.trim() === ${JSON.stringify(text)});
        if (!b) throw new Error('нет кнопки ' + ${JSON.stringify(text)});
        b.click(); return true; })()`);
    {
        server.tutorHomework = [
            { id: 1, batch: 7, student: 'MASHA', label: 'Маша', topic: 'integer+:mul:3', need: 30, done: 12, dueOn: dayOf(3), doneOn: null },
            { id: 2, batch: 7, student: 'PETYA', label: 'Петя', topic: 'integer+:mul:3', need: 30, done: 34, dueOn: dayOf(3), doneOn: today },
            { id: 3, batch: 5, student: 'VANYA', label: 'Ваня', topic: 'fraction+:simplify:2', need: 20, done: 3, dueOn: dayOf(-2), doneOn: null }
        ];
        await asTutor();
        page.evaluate(`openHomeworkList()`).catch(() => {});
        await page.waitForTimeout(300);
        const text = await dialog();
        const lines = await page.evaluate(`[...document.querySelectorAll('#appDialogCard .hw-batch')].map(b => ({
            заголовок: b.querySelector('.hw-batch-head').innerText,
            ученики: [...b.querySelectorAll('.hw-line')].map(l => l.innerText.replace(/\\s+/g, ' ')) }))`);
        await check('выдачи сгруппированы: одна выдача нескольким — одна карточка', () => {
            eq(lines.length, 2, 'карточек');
            eq(lines[0].ученики.length, 2, 'учеников в первой');
        });
        await check('у каждого ученика — сколько сделано, выполнено ли и когда, просрочено ли', () => {
            eq(lines[0].ученики[0], 'Маша 12 / 30', 'Маша');
            assert(/^Петя ✅ \d+ /.test(lines[0].ученики[1]), lines[0].ученики[1]);
            eq(lines[1].ученики[0], 'Ваня ⏰ 3 / 20', 'Ваня');
        });
        await check('сказано, что сделанное приходит со связью ученика', () => assert(/выходит на связь/.test(text), text));

        // Снять — с подтверждением; отказ ничего не снимает.
        await page.evaluate(`document.querySelector('#appDialogCard .hw-drop').click(); null`);
        await page.waitForTimeout(150);
        await press('Отмена');
        await page.waitForTimeout(300);
        await check('передумал снимать — ничего не снято', () => eq(calls('session_cancel_homework').length, 0, 'запросов'));
        await page.evaluate(`document.querySelector('#appDialogCard .hw-drop').click(); null`);
        await page.waitForTimeout(150);
        const ask = await dialog();
        await press('Снять');
        await page.waitForTimeout(300);
        await check('снятие спрашивает и снимает выдачу целиком',
                    () => assert(/больше не будет у 2 учеников/.test(ask)
                                 && JSON.stringify(calls('session_cancel_homework')[0][1].p_ids) === '[1,2]',
                                 ask + ' | ' + JSON.stringify(calls('session_cancel_homework'))));
    }

    console.log('\nРепетитор: выдать');
    {
        await page.waitForTimeout(100);
        await press('➕ Задать');
        await page.waitForTimeout(300);
        // Папка целиком.
        await page.evaluate(`[...document.querySelectorAll('#appDialogCard .pick-head')]
            .find(l => /5 класс/.test(l.innerText)).querySelector('input').click(); null`);
        await press('Дальше');
        await page.waitForTimeout(200);
        const pick = (label) => page.evaluate(`[...document.querySelectorAll('#appDialogCard .dlg-pick')]
            .find(x => x.innerText.trim() === ${JSON.stringify(label)}).click()`);
        await pick('🔴 Отрицательные'); await pick('✖️ Умножение'); await pick('4★'); await pick('50'); await pick('через неделю');
        const summary = await page.evaluate(`document.querySelector('#appDialogCard .hw-summary').innerText`);
        const week = await page.evaluate(`formatDayKeyHuman(shiftDayKey(Progress.dayKey(), 7))`);
        await check('итог выбора назван одной строкой',
                    () => eq(summary, `Отрицательные → Умножение → 4★ · 50 верных ответов · до ${week}`, 'итог'));
        // Своё число: ноль не пускает, 45 — уходит.
        await page.fill('#appDialogCard .hw-need-input', '0');
        await press('Задать');
        await page.waitForTimeout(150);
        const err = await page.evaluate(`(document.querySelector('#appDialogCard .dlg-err') || {}).innerText || ''`);
        await check('ноль верных не задать — окно говорит, что не так',
                    () => assert(/от 1 до 500/.test(err) && calls('session_assign_homework').length === 0, err));
        await page.fill('#appDialogCard .hw-need-input', '45');
        server.assign = { ok: true, batch: 9, assigned: ['MASHA'], opened: ['MASHA'],
                          skipped: [{ code: 'VANYA', error: 'too_many' }] };
        await press('Задать');
        await page.waitForTimeout(300);
        const call = calls('session_assign_homework')[0];
        await check('на сервер уходит папка, клетка, своё число и срок через неделю', () => {
            assert(call, 'запроса нет');
            const p = call[1];
            eq(JSON.stringify(p.p_students.slice().sort()), '["MASHA","VANYA"]', 'кому');
            eq(p.p_topic, 'integer-:mul:4', 'клетка');
            eq(p.p_need, 45, 'сколько');
            eq(p.p_due, dayOf(7), 'срок');
        });
        const report = await dialog();
        await check('итог выдачи: кому задано, где открыта звезда, кому нет и почему',
                    () => assert(/Задано 1 ученику\./.test(report) && /Звезда открыта: Маша\./.test(report)
                                 && /уже тридцать заданий: Ваня\./.test(report), report));
        await press('Понятно');
        await page.waitForTimeout(300);
        await press('Закрыть');
    }

    console.log('\nВысокое окно на маленьком телефоне');
    {
        await page.setViewportSize({ width: 375, height: 600 });
        server.assign = null;
        page.evaluate(`openAssignHomework()`).catch(() => {});
        await page.waitForTimeout(300);
        await page.evaluate(`document.querySelector('#appDialogCard .pick-head input').click(); null`);
        await press('Дальше');
        await page.waitForTimeout(200);
        const g = await page.evaluate(`(() => { const back = document.getElementById('appDialog'); back.scrollTop = 0;
            const top = document.getElementById('appDialogCard').getBoundingClientRect().top;
            back.scrollTop = 1e6;
            const bottom = document.getElementById('appDialogCard').getBoundingClientRect().bottom;
            return { top, bottom, h: innerHeight }; })()`);
        await check('заголовок окна не уходит за верх экрана, низ доступен прокруткой',
                    () => assert(g.top >= 0 && g.bottom <= g.h, JSON.stringify(g)));
        await press('Отмена');
        await page.setViewportSize({ width: 390, height: 844 });
    }

    record('всё это прошло без ошибок в консоли', errors.length ? errors.slice(0, 3).join(' | ') : null);
    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });

function finish() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) {
        failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`));
        process.exit(1);
    }
}
