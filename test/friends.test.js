// ДРУЗЬЯ — раздел в профиле ученика, страница друга, сравнение и имена друзей
// у репетитора. В живом браузере, с подставным сервером.
//
// Что именно уходит другу, решает сервер: supabase/friends.sql, и проверяет его
// supabase/friends.test.sql на настоящей базе. Здесь — что с этим делает
// приложение: кому раздел виден, что заведомо неверное даже не уходит на сервер,
// что на странице друга не открывается и не рассказывает о закрытых разделах,
// и что сервер с приложением считают серию и картинки по одним и тем же числам.
//
// Как запускать:  node test/friends.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function check(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function checkNow(name, fn) { try { fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }
function finish() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`)); process.exit(1); }
}

// ---------------------------------------------------------------------
//  Сервер и приложение считают по одним числам
// ---------------------------------------------------------------------
// Серию дней и собранные картинки друга считает сервер — переносом кода
// приложения. Перенос верен, пока совпадают числа: поменяли цель дня здесь и
// забыли там — и у друга одна серия, а у самого ребёнка другая.
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SQL = fs.readFileSync(path.join(ROOT, 'supabase', 'friends.sql'), 'utf8');
const num = (re, src) => { const m = (src || HTML).match(re); return m ? Number(m[1]) : NaN; };
const sqlFn = (name) => {
    const from = SQL.indexOf(`create or replace function ${name}(`);
    return from < 0 ? '' : SQL.slice(from, SQL.indexOf('$$;', SQL.indexOf('$$', from) + 2));
};

console.log('\nСервер считает так же, как приложение');
checkNow('серия: цель дня, заморозка и запас — те же числа', () => {
    const body = sqlFn('fr_streak');
    const goal = num(/const DAILY_GOAL = (\d+);/), every = num(/const FREEZE_EVERY = (\d+);/),
          max = num(/const FREEZE_MAX = (\d+);/);
    assert(goal > 0 && every > 0 && max > 0, 'не найдены числа серии в index.html');
    assert(new RegExp(`fr_num\\(v_val -> 'tr'\\) >= ${goal} then`).test(body), `цель дня в fr_streak не ${goal}`);
    assert(new RegExp(`v_goal_days % ${every} = 0 and v_freezes < ${max} then`).test(body),
        `заморозка в fr_streak не каждые ${every} дней и не до ${max}`);
});
checkNow('картинки: сотня ответов и порядок клеток — те же', () => {
    const body = sqlFn('fr_collected');
    const grid = num(/const PUZZLE_GRID = (\d+);/), levels = num(/const PUZZLE_CELL_LEVELS = (\d+);/);
    const ops = (HTML.match(/const PUZZLE_CELL_OPS = \[([^\]]*)\];/) || [])[1];
    assert(grid > 0 && levels > 0 && ops, 'не найдены числа пазла в index.html');
    assert(body.indexOf(`>= ${grid * grid}`) >= 0, `сотня ответов в fr_collected не ${grid * grid}`);
    assert(body.indexOf(`array[${ops}]`) >= 0, `порядок клеток в fr_collected не ${ops}`);
    assert(body.indexOf(`* ${levels} +`) >= 0 && body.indexOf(`generate_series(1, ${levels})`) >= 0,
        `звёзд в клетке не ${levels}`);
});
checkNow('имя для друзей: приложение и сервер пропускают одни и те же знаки', () => {
    const js = (HTML.match(/const FRIEND_NAME_RE = \/\^\[([^\]]*)\]\+\$\//) || [])[1];
    const sql = (sqlFn('fr_clean_name').match(/and v ~ '\^\[([^\]]*)\]\+\$'/) || [])[1];
    assert(js && sql, 'не найдены правила имени');
    eq(js, sql.replace(/''/g, "'"), 'знаки имени');
});

// ---------------------------------------------------------------------
//  Живой браузер
// ---------------------------------------------------------------------
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — живые проверки друзей пропущены.');
    finish();
    process.exit(0);
}

const iso = (n) => { const d = new Date(Date.now() + n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const day = (c) => ({ c, w: 1, a: 0, s: 300, p: 0, ms: 0, mc: 0, tr: 0, t: {}, e: {}, te: {} });

// Петя: золото на сложении 1★, мастерство на 2★ (алмаз по всем трём — задача
// за мастерство), бронза и серебро на вычитании, плюс медали в отрицательных —
// а они у того, кто смотрит, закрыты.
const PETYA = { id: 11, name: 'Петя', streak: 12, week: 140, pics: [0, 1, 5, 99, -1, 2.5],
    ladders: ['integer+:add:1:a3', 'integer+:add:1:c3', 'integer+:add:1:s2',
              'integer+:add:2:a4', 'integer+:add:2:c4', 'integer+:add:2:s4',
              'integer+:sub:1:a1', 'integer+:sub:1:c2', 'integer+:sub:1:c1',
              'integer-:add:1:a3', 'integer-:add:1:c3', 'integer-:mul:1:s5'] };
const LIZA = { id: 12, name: 'Лиза', streak: 0, ladders: ['integer+:mul:1:c1'], pics: [], week: 35 };
const OLYA = { id: 13, name: 'Оля', streak: 3, ladders: [], pics: [] };   // в сравнении не участвует

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    const calls = [];
    const server = { me: null, friends: [], incoming: [], outgoing: [], answer: {}, delay: 0, names: { MASHA: ['Лиза', 'Петя'] } };
    await page.route('**/rest/v1/rpc/*', async r => {
        const fn = r.request().url().split('/rpc/')[1];
        let req = null; try { req = r.request().postDataJSON(); } catch (e) {}
        calls.push([fn, req]);
        let body = { ok: true };
        if (fn === 'session_state') body = { ok: true, state: { schema: 2, playerCode: 'X', updatedAt: 0 } };
        if (fn === 'session_my_access') body = { ok: true, access: {} };
        if (fn === 'session_friends') {
            body = { ok: true, me: server.me, friends: server.friends, incoming: server.incoming, outgoing: server.outgoing };
            if (server.delay) { const d = server.delay; server.delay = 0; await new Promise(res => setTimeout(res, d)); }
        }
        if (fn === 'session_friend_setup') {
            server.me = { code: 'K7QM4F', name: String(req.p_name).replace(/\s+/g, ' ').trim(), compare: false };
            body = Object.assign({ ok: true }, server.me);
        }
        if (fn === 'session_friend_compare') { server.me.compare = !!req.p_on; body = { ok: true, compare: server.me.compare }; }
        if (server.answer[fn]) body = server.answer[fn];
        if (fn === 'session_list_students') body = { ok: true, students: [{ code: 'MASHA', label: 'Маша', totals: { correct: 5, wrong: 0 },
                                                                            updatedAt: new Date().toISOString() }] };
        if (fn === 'session_student_state') body = { ok: true, state: { schema: 2, playerCode: 'MASHA', updatedAt: 1,
            accountType: 'linked', ownerCode: 'MAKS', profileLabel: 'Маша', byTopic: {}, daily: {}, unlocks: {} } };
        if (fn === 'session_tutor_homework') body = { ok: true, homework: [] };
        if (fn === 'session_student_friends') body = server.names[req.p_student_code]
            ? { ok: true, names: server.names[req.p_student_code] } : { ok: false, error: 'not_your_student' };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    // Язык ставим, только если его ещё нет: иначе перезагрузка в конце теста снова
    // включала бы русский поверх английского.
    await page.addInitScript(() => { try { if (!localStorage.getItem('mathCitadelLang_v1')) localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);

    const as = (code, type, label) => page.evaluate(`(() => {
        Progress.switchTo(${JSON.stringify(code)}, null, { accountType: ${JSON.stringify(type)}, profileLabel: ${JSON.stringify(label)} });
        Progress.setToken(${JSON.stringify(code)}, 'tok-' + ${JSON.stringify(code)}); enterApp(); return null; })()`);
    const count = (fn) => calls.filter(c => c[0] === fn).length;
    const lastCall = (fn) => { const c = calls.filter(x => x[0] === fn).pop(); return c ? c[1] : null; };
    const body = () => page.evaluate(`document.getElementById('friendsBody').innerText`);
    const shown = () => page.evaluate(`document.getElementById('friendsSection').style.display !== 'none'`);
    const openProfile = async () => {
        await page.evaluate(`window.__friendsBefore = friendsState; closeAppDialog(null); closeProfileScreen();
                             document.getElementById('friendsBody').innerHTML = '';
                             document.getElementById('toastWrap').innerHTML = ''; openProfileScreen(); null`);
        // Ждём именно свежий ответ: пока он идёт, раздел честно показывает прошлый,
        // и проверка, не дождавшись, прочла бы старое. Не дождались — не падаем:
        // проверки ниже сами скажут, что на экране не то.
        await page.waitForFunction(`document.getElementById('friendsSection').style.display === 'none'
            || (friendsState !== window.__friendsBefore
                && document.getElementById('friendsBody').textContent.length > 0
                && !/Загружаю|Loading/.test(document.getElementById('friendsBody').textContent))`, null, { timeout: 5000 })
            .catch(() => null);
        // Раздел по умолчанию свёрнут, а у свёрнутого innerText без переносов строк.
        await page.evaluate(`document.getElementById('friendsSection').classList.remove('folded'); null`);
    };
    const toast = () => page.evaluate(`[...document.querySelectorAll('#toastWrap .toast')].map(x => x.innerText).pop() || ''`);
    const clearToasts = () => page.evaluate(`document.getElementById('toastWrap').innerHTML = ''; null`);
    const dialog = () => page.evaluate(`document.getElementById('appDialog').classList.contains('open')
                                        ? document.getElementById('appDialogCard').innerText : ''`);
    const press = (re) => page.evaluate(`(() => { const b = [...document.querySelectorAll('#friendsBody button')]
        .find(x => ${re}.test(x.innerText)); if (b) b.click(); return !!b; })()`);
    const dlgFill = (value) => page.evaluate(`(() => { const i = document.querySelector('#appDialogCard .dlg-input');
        i.value = ${JSON.stringify(value)}; document.querySelector('#appDialogCard .dlg-btn.primary').click(); return null; })()`);
    const dlgError = () => page.evaluate(`(document.querySelector('#appDialogCard .dlg-err') || {}).innerText || ''`);
    const settle = () => page.waitForTimeout(350);

    console.log('\nКому раздел виден');
    // Гость по типу — «самостоятельный», и отличать его надо отдельно.
    await page.evaluate(`Progress.startGuest(); enterApp(); null`);
    await openProfile();
    await check('гостю раздела нет, хотя по типу он «самостоятельный»', async () => {
        assert(!(await shown()), 'раздел виден гостю');
        eq(count('session_friends'), 0, 'запросов друзей');
    });
    await as('MAKS', 'self', 'Максим');
    await openProfile();
    await check('репетитору раздела нет, и на сервер за друзьями не ходим', async () => {
        assert(!(await shown()), 'раздел виден репетитору');
        eq(count('session_friends'), 0, 'запросов друзей');
    });
    await as('MASHA', 'linked', 'Маша Иванова');
    await openProfile();
    await check('ученику репетитора раздел виден', async () => assert(await shown(), 'раздела нет'));
    await as('SOLO', 'solo', 'Маша Иванова');
    await openProfile();
    await check('самостоятельному виден, «сегодня» уходит по его часам', async () => {
        assert(await shown(), 'раздела нет');
        eq((lastCall('session_friends') || {}).p_today, iso(0), 'p_today');
    });

    console.log('\nВключить друзей');
    await check('пока не включены — объяснение, что видно, и кнопка', async () => {
        const t = await body();
        assert(/Ошибки и точность не видит никто/.test(t) && /Включить друзей/.test(t), t);
    });
    await press(/Включить друзей/);
    await settle();
    await check('имя предложено из профиля, но решает сам ребёнок', async () => {
        eq(await page.evaluate(`document.querySelector('#appDialogCard .dlg-input').value`), 'Маша Иванова', 'в поле');
        assert(/без фамилии и телефона/.test(await dialog()), await dialog());
    });
    for (const [bad, why] of [['89161234567', /телефон/], ['Маша 12345', /телефон/], ['М', /две буквы/],
                              ['Маша@почта', /только буквы/], ['Мария-Анна Петровна Ив', /20 знаков/], ['1234', /хотя бы одна буква/]]) {
        await dlgFill(bad);
        await settle();
        const err = await dlgError();
        await check(`«${bad}» не уходит на сервер: ${why.source}`, () => {
            assert(why.test(err), err);
            eq(count('session_friend_setup'), 0, 'вызовов');
        });
    }
    await dlgFill('  Маша   К. ');
    await settle();
    await openProfile();
    await check('хорошее имя уходит, и появляется код дружбы двумя тройками', async () => {
        eq((lastCall('session_friend_setup') || {}).p_name, 'Маша   К.', 'p_name');
        const t = await body();
        assert(/K7Q-M4F/.test(t) && /Друзья видят тебя как «Маша К\.»/.test(t), t);
    });

    console.log('\nПозвать по коду');
    const tryAdd = async (code, answer) => {
        server.answer.session_friend_add = answer;
        await clearToasts();
        await press(/Добавить друга/);
        await settle();
        await dlgFill(code);
        await settle();
        return toast();
    };
    await press(/Добавить друга/);
    await settle();
    await dlgFill('K7QM4');
    await settle();
    await check('пять знаков вместо шести — на сервер не уходит', async () => {
        assert(/шесть знаков/.test(await dlgError()), await dlgError());
        eq(count('session_friend_add'), 0, 'вызовов');
    });
    await page.evaluate(`closeAppDialog(null); null`);
    let msg = await tryAdd('abc-def', { ok: true, status: 'sent', name: 'Ваня' });
    await check('код уходит как набран — сервер сам уберёт дефис и строчные', () => {
        eq((lastCall('session_friend_add') || {}).p_fcode, 'abc-def', 'p_fcode');
        assert(/Запрос отправлен\. Когда Ваня примет его/.test(msg), msg);
    });
    msg = await tryAdd('ABCDEF', { ok: true, status: 'friends', name: 'Ваня' });
    await check('звали друг друга — сразу друзья', () => assert(/Ваня теперь в друзьях/.test(msg), msg));
    msg = await tryAdd('ABCDEF', { ok: false, error: 'bad_code', wait: 0 });
    await check('неверный код — «проверь буквы»', () => assert(/Такого кода нет\. Проверь буквы/.test(msg), msg));
    msg = await tryAdd('ABCDEF', { ok: false, error: 'bad_code', wait: 120 });
    await check('после пяти ошибок — сколько ждать', () => assert(/Следующая попытка — через 2\sминуты/.test(msg), msg));
    msg = await tryAdd('ABCDEF', { ok: false, error: 'too_many', wait: 3600 });
    await check('во время паузы — через сколько можно', () => assert(/Попробуй через 60\sминут/.test(msg), msg));
    msg = await tryAdd('ABCDEF', { ok: false, error: 'self' });
    await check('свой код — так и сказано', () => assert(/собственный код/.test(msg), msg));
    delete server.answer.session_friend_add;

    console.log('\nЗапросы и друзья');
    server.incoming = [{ id: 21, name: 'Ваня' }];
    server.outgoing = [{ id: 22, name: 'Оля' }];
    server.friends = [LIZA, PETYA, OLYA].map(f => Object.assign({}, f, { week: undefined }));
    await openProfile();
    const t1 = await body();
    await check('кто зовёт, кого позвал и друзья — отдельно', () => {
        assert(/Хотят дружить\s+Ваня/i.test(t1) && /Ждут ответа\s+Оля/i.test(t1) && /Друзья · 3/i.test(t1), t1);
    });
    await check('в строке друга — серия, звёзды и картинки; нулевой серии нет', async () => {
        const rows = await page.evaluate(`[...document.querySelectorAll('#friendsBody .friend-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())`);
        eq(JSON.stringify(rows), JSON.stringify(['Лиза ⭐ 0 · 🏆 0', 'Петя 🔥 12 · ⭐ 2 · 🏆 3', 'Оля 🔥 3 · ⭐ 0 · 🏆 0']), 'строки');
    });
    await page.evaluate(`[...document.querySelectorAll('#friendsBody .list-row')].find(r => /Ваня/.test(r.innerText))
        .querySelector('button').click(); null`);
    await settle();
    await check('«Принять» уходит с номером запроса', () => eq((lastCall('session_friend_accept') || {}).p_id, 21, 'p_id'));
    await page.evaluate(`[...document.querySelectorAll('#friendsBody .list-row')].find(r => /Ваня/.test(r.innerText))
        .querySelectorAll('button')[1].click(); null`);
    await settle();
    await check('«Отклонить» — та же строка пары', () => eq((lastCall('session_friend_remove') || {}).p_id, 21, 'p_id'));
    await page.evaluate(`[...document.querySelectorAll('#friendsBody .list-row')].find(r => /Оля/.test(r.innerText) && !r.classList.contains('friend-row'))
        .querySelector('button').click(); null`);
    await settle();
    await check('свой запрос отзывается', () => eq((lastCall('session_friend_remove') || {}).p_id, 22, 'p_id'));

    console.log('\nСтраница друга');
    await page.evaluate(`[...document.querySelectorAll('#friendsBody .friend-row')].find(r => /Петя/.test(r.innerText)).click(); null`);
    await settle();
    const card = await dialog();
    await check('серия, звёзды, медали по высшей ступени, задача за мастерство', () => {
        assert(/Серия: 12 дней/.test(card), card);
        assert(/Звёзд взято: 2/.test(card), card);
        assert(card.indexOf('Медали: 🥉 1 · 🥈 2 · 🥇 2 · 💎 3') >= 0, card);
        assert(/Задач за мастерство: 1/.test(card), card);
    });
    await check('закрытый у ребёнка раздел на странице друга не появляется', () => {
        assert(/Положительные/i.test(card) && !/Отрицательные/i.test(card) && card.indexOf('👑') < 0, card);
    });
    const pics = await page.evaluate(`[...document.querySelectorAll('#appDialogCard .friend-pics img')]
        .map(i => ({ src: i.getAttribute('src'), alt: i.alt, title: i.title, parent: i.parentElement.className }))`);
    await check('коллекция — только настоящие номера картинок, маленькими', () => {
        eq(pics.length, 3, 'картинок');
        assert(pics.every(p => /images\/thumbs\//.test(p.src)), JSON.stringify(pics));
        assert(/Коллекция: 3 из 20/i.test(card), card);
    });
    await check('картинки не подписаны и не открываются — это подсказка к чужим задачам', async () => {
        assert(pics.every(p => !p.alt && !p.title), JSON.stringify(pics));
        await page.evaluate(`document.querySelector('#appDialogCard .friend-pics img').click(); null`);
        await settle();
        assert(!(await page.evaluate(`document.getElementById('collectionDetail').classList.contains('show')
                                      || document.getElementById('collectionModal').classList.contains('active')`)),
            'открылась картинка');
        assert(await dialog(), 'страница друга закрылась от нажатия на картинку');
    });
    await check('звёзды друга не разворачиваются: это витрина, а не кнопки', async () => {
        eq(await page.evaluate(`document.querySelectorAll('#appDialogCard .ach-star').length`), 20, 'звёзд');
        eq(await page.evaluate(`document.querySelectorAll('#appDialogCard button.ach-star').length`), 0, 'кнопок');
    });
    await page.evaluate(`[...document.querySelectorAll('#appDialogCard button')].find(x => /Удалить из друзей/.test(x.innerText)).click(); null`);
    await settle();
    await check('удалить друга — только после отдельного «да»', async () => {
        assert(/Сообщения об этом никто не получит/.test(await dialog()), await dialog());
        eq(calls.filter(c => c[0] === 'session_friend_remove' && c[1].p_id === 11).length, 0, 'удалено без подтверждения');
    });
    await page.evaluate(`document.querySelector('#appDialogCard .dlg-btn.danger').click(); null`);
    await settle();
    await check('после «да» — уходит номер пары этого друга', () => eq((lastCall('session_friend_remove') || {}).p_id, 11, 'p_id'));

    console.log('\nСравнение');
    await openProfile();
    await check('пока не включено — таблицы нет', async () => {
        assert(!/Эта неделя/i.test(await body()), await body());
        eq(await page.evaluate(`document.querySelector('#friendsBody .friend-compare input').checked`), false, 'галочка');
    });
    await page.evaluate(`document.querySelector('#friendsBody .friend-compare input').click(); null`);
    await settle();
    await check('галочка уходит на сервер', () => eq((lastCall('session_friend_compare') || {}).p_on, true, 'p_on'));
    // Свои числа — с этого устройства. Сегодня и понедельник этой недели считаются,
    // воскресенье перед ним — уже нет: неделя начинается в понедельник.
    const mondayBack = await page.evaluate(`(new Date().getDay() + 6) % 7`);
    const myDays = { [iso(0)]: day(30) };
    if (mondayBack > 0) myDays[iso(-mondayBack)] = day(30);
    myDays[iso(-mondayBack - 1)] = day(500);
    const myWeek = mondayBack > 0 ? 60 : 30;
    await page.evaluate(`Progress.get().daily = ${JSON.stringify(myDays)}; null`);
    const myStreak = await page.evaluate(`currentStreak(Progress.get().daily, Progress.dayKey())`);
    server.friends = [LIZA, PETYA, OLYA];
    await openProfile();
    const table = await page.evaluate(`[...document.querySelectorAll('#friendsBody .friend-table-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())`);
    await check('в таблице — только те, кто тоже включил, по убыванию верных за неделю', () => {
        const order = table.map(r => r.replace(/^\d+\. /, '').split(' ')[0]);
        assert(table.length === 3 && order.indexOf('Оля') < 0, JSON.stringify(table));
        assert(/^1\. Петя ✅ 140 · 🔥 12$/.test(table[0]), JSON.stringify(table));
    });
    await check('свои числа — с этого устройства: неделя с понедельника, серия по дням', () => {
        const me = table.find(r => /\(ты\)/.test(r)) || '';
        assert(new RegExp(`Маша К\\. \\(ты\\) ✅ ${myWeek} · 🔥 ${myStreak}$`).test(me), me + ' / ждали ' + myWeek);
    });
    server.friends = [OLYA];
    await openProfile();
    await check('никто из друзей не включил — так и сказано, без таблицы', async () => {
        assert(/Пока никто из друзей не включил сравнение/.test(await body()), await body());
        eq(await page.evaluate(`document.querySelectorAll('#friendsBody .friend-table-row').length`), 0, 'строк');
    });

    console.log('\nСеть и смена профиля');
    server.answer.session_friends = { ok: false, error: 'network' };
    await page.evaluate(`friendsState = { code: null, data: null, failed: false }; null`);
    await openProfile();
    await check('нет связи — так и сказано, и есть «ещё раз»', async () => {
        const t = await body();
        assert(/Не удалось загрузить друзей/.test(t) && /Попробовать ещё раз/.test(t), t);
    });
    delete server.answer.session_friends;
    server.friends = [PETYA];
    // Профиль сменили, пока шёл медленный ответ для прежнего: свой ответ нового
    // профиля приходит раньше, чужой — позже, и затирать свой он не должен.
    server.delay = 600;
    await page.evaluate(`closeProfileScreen(); openProfileScreen(); null`);
    await page.waitForTimeout(100);
    server.me = null;
    await as('OTHER', 'solo', 'Другой');
    await page.evaluate(`closeProfileScreen(); openProfileScreen(); null`);
    await page.waitForTimeout(900);
    await check('ответ, пришедший уже для другого профиля, не рисуется и не затирает свой', async () => {
        const t = await body();
        assert(!/Петя/.test(t) && /Включить друзей/.test(t), t);
    });

    console.log('\nРепетитор видит имена друзей ученика');
    await as('MAKS', 'self', 'Максим');
    await page.evaluate(`helpCache = null; null`);
    const lesson = async () => {
        await page.evaluate(`closeAppDialog(null); openLessonCard({ code: 'MASHA', label: 'Маша' }); null`);
        await page.waitForFunction(`document.getElementById('appDialog').classList.contains('open')`, null, { timeout: 10000 });
        return dialog();
    };
    let lc = await lesson();
    await check('в карточке к уроку — имена друзей, и только они', () => {
        assert(/Друзья в приложении\s+Лиза, Петя/i.test(lc), lc);
        eq((lastCall('session_student_friends') || {}).p_student_code, 'MASHA', 'p_student_code');
    });
    server.names.MASHA = [];
    lc = await lesson();
    await check('друзей нет — так и сказано', () => assert(/Друзья в приложении\s+Друзей пока нет\./i.test(lc), lc));
    delete server.names.MASHA;
    lc = await lesson();
    await check('сервер не ответил — карточка всё равно открылась', () => assert(/Друзья в приложении\s+Не удалось узнать\./i.test(lc), lc));

    console.log('\nДругой язык');
    await page.evaluate(`localStorage.setItem('mathCitadelLang_v1', 'en'); null`);
    await page.reload();
    await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);
    server.me = null;
    await as('SOLO', 'solo', 'Masha');
    await openProfile();
    await check('по-английски раздел и кнопка переведены', async () => {
        const title = await page.evaluate(`document.querySelector('#friendsSection .config-section-title').innerText`);
        assert(/Friends/i.test(title) && /Turn on friends/.test(await body()), title + ' / ' + (await body()));
    });

    record('всё это прошло без ошибок в консоли', errors.length ? errors.slice(0, 3).join(' | ') : null);
    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
