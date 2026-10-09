// Тесты привязки к репетитору со стороны приложения.
//
// Сервер решает всё сам (supabase/account-link.sql и его .test.sql), но у приложения
// здесь две свои обязанности, и обе про то, чтобы ничего не потерять:
//
//   1) принять решение сервера. Тип аккаунта и владельца приложение берёт из ответа
//      сервера, а не из «более свежей» копии: иначе ученик, которого привязали или
//      отпустили, на втором устройстве видел бы прежний тип, пока играет. И при этом
//      никогда не становится репетитором синхронизацией — это уже было (Адам);
//
//   2) не стереть прогресс при смене хозяина. У ученика репетитора приложение чистит
//      прогресс в закрытых разделах, и устаревший доступ на руках стёр бы ровно то, что
//      сервер сохранил, открыв ученику эти разделы при привязке.
//
// Плюс экраны: кто видит какие кнопки, что говорит пауза после неверных паролей.
//
// Как запускать:  node test/account-link.test.js
// Живая часть нужна Playwright и браузер в /opt/pw-browsers/chromium.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function check(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }

// ---------- песочница для модуля Progress ----------
function loadProgress() {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'progress.js'), 'utf8');
    const store = {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date, isNaN, parseInt, parseFloat, Promise,
        localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
                        removeItem: (k) => { delete store[k]; } },
        setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src + '\n;globalThis.Progress = Progress;', sandbox, { filename: 'progress.js' });
    return sandbox.Progress;
}

// Устройство ученика: локальная копия свежее серверной (он только что играл).
function device(local, server) {
    const P = loadProgress();
    P.init();
    P.switchTo('KID', 'pw', { accountType: local.accountType, ownerCode: local.ownerCode });
    P.setToken('KID', 'tok');
    if (local.access !== undefined) P.setAccess(local.access);
    const st = P.get();
    st.byTopic = Object.assign({}, local.byTopic || {});
    st.totals = { correct: 30, wrong: 3, puzzlesCompleted: 0 };
    P.recordTrainingAnswer();          // локальная копия стала свежее
    const heard = [];
    P.onIdentityChange(() => heard.push(P.getAccountType()));
    P.attachRemote({
        async read() { return server; },
        async write() {}
    });
    return { P, heard };
}

(async () => {
    console.log('Тип аккаунта решает сервер');

    await check('привязали на другом устройстве — здесь тоже ученик, хотя копия свежее', async () => {
        const { P, heard } = device({ accountType: 'solo' },
            { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'linked', ownerCode: 'TUTOR' });
        await P.flush(true);
        eq(P.getAccountType(), 'linked', 'тип');
        eq(P.getOwnerCode(), 'TUTOR', 'владелец');
        eq(heard.length, 1, 'экраны не узнали о смене хозяина');
    });

    await check('отпустили — снова самостоятельный, владельца нет', async () => {
        const { P, heard } = device({ accountType: 'linked', ownerCode: 'TUTOR' },
            { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'solo', ownerCode: null });
        await P.flush(true);
        eq(P.getAccountType(), 'solo', 'тип');
        eq(P.getOwnerCode(), null, 'владелец');
        eq(heard.length, 1, 'экраны не узнали о смене хозяина');
    });

    await check('репетитором синхронизация не делает: ни самостоятельного, ни ученика', async () => {
        for (const from of ['solo', 'linked']) {
            const { P, heard } = device({ accountType: from, ownerCode: from === 'linked' ? 'TUTOR' : null },
                { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'self', ownerCode: null });
            await P.flush(true);
            eq(P.getAccountType(), from, `из «${from}» стал`);
            eq(heard.length, 0, 'смена хозяина услышана без смены');
        }
    });

    await check('сервер не сказал тип или сказал «ученик» без репетитора — не верим', async () => {
        for (const server of [{ schema: 2, playerCode: 'KID', updatedAt: 1 },
                              { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'linked', ownerCode: null }]) {
            const { P, heard } = device({ accountType: 'solo' }, server);
            await P.flush(true);
            eq(P.getAccountType(), 'solo', 'тип при ответе ' + JSON.stringify(server));
            eq(heard.length, 0, 'смена хозяина без оснований');
        }
    });

    await check('тот же хозяин — доступ не сбрасывается, экраны не дёргаются', async () => {
        const { P, heard } = device({ accountType: 'linked', ownerCode: 'TUTOR', access: { 'integer-': 'all' } },
            { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'linked', ownerCode: 'TUTOR' });
        await P.flush(true);
        assert(P.getAccess() && P.getAccess()['integer-'] === 'all', 'доступ потерян без причины');
        eq(heard.length, 0, 'смена хозяина услышана без смены');
    });

    console.log('\nСмена хозяина не стирает прогресс');

    await check('привязка: прогресс в разделе, которого нет в старом доступе, остаётся', async () => {
        // Самостоятельный с прогрессом в отрицательных (так бывает у аккаунтов, задетых
        // старой ошибкой с типом). Старый доступ на устройстве — пустой.
        const { P } = device({ accountType: 'solo', access: {}, byTopic: { 'integer-:add:2': { correct: 12, wrong: 3 } } },
            { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'linked', ownerCode: 'TUTOR',
              byTopic: { 'integer-:add:2': { correct: 12, wrong: 3 } } });
        await P.flush(true);
        eq(P.getAccess(), null, 'старый доступ не забыт — им будут чистить разделы');
        const t = (P.get().byTopic || {})['integer-:add:2'];
        assert(t && t.correct === 12, 'прогресс в отрицательных стёрт: ' + JSON.stringify(P.get().byTopic));
        // И следующая отправка, пока доступ не спросили заново, тоже ничего не трогает.
        P.recordTrainingAnswer();
        await P.flush();
        assert(((P.get().byTopic || {})['integer-:add:2'] || {}).correct === 12, 'стёрто следующей отправкой');
    });

    await check('экраны подписаны на смену хозяина и заново спрашивают доступ', async () => {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        const at = html.indexOf('Progress.onIdentityChange(');
        assert(at >= 0, 'подписки нет — после привязки на другом устройстве доступ останется старым');
        assert(/refreshAccess\(\)/.test(html.slice(at, at + 400)), 'подписка есть, но доступ заново не спрашивается');
    });

    // ---------- живая часть ----------
    let chromium = null;
    try { ({ chromium } = require('playwright')); } catch (e) { /* нет — пропускаем */ }
    if (!chromium) { console.log('\nPlaywright не установлен — живой прогон пропущен.'); return finish(); }
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

    // Подставной сервер, которым управляет тест.
    const open = async (setup, srv) => {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.errs = [];
        page.calls = [];
        page.on('pageerror', e => page.errs.push(e.message));
        await page.route('**/rest/v1/rpc/*', r => {
            const fn = r.request().url().split('/rpc/')[1];
            const body = JSON.parse(r.request().postData() || '{}');
            page.calls.push([fn, body]);
            const out = (srv && srv[fn]) ? srv[fn](body) : (fn === 'session_state' ? { ok: true, state: {} } : { ok: true });
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
        });
        await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200,
            contentType: 'application/javascript', body: 'window.MAINTENANCE={until:null,note:null};' }));
        await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
        await page.goto('file://' + path.join(ROOT, 'index.html'));
        await page.waitForFunction(`typeof linkToTutor === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); ${setup} enterApp(); null`);
        return page;
    };
    const shown = (page, id) => page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)});
        return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; })()`);
    const profile = (page) => page.evaluate(`document.querySelectorAll('.modal-screen').forEach(e => e.style.display = 'none');
        openProfileScreen(); null`);
    const dialogFill = (page, value) => page.evaluate(`(() => { const i = document.querySelector('#appDialogCard .dlg-input');
        i.value = ${JSON.stringify(value)}; })()`);
    const dialogOk = (page) => page.evaluate(`document.querySelector('#appDialogCard .dlg-btn.primary, #appDialogCard .dlg-btn.danger').click()`);
    const dialogText = (page) => page.evaluate(`document.getElementById('appDialogCard').innerText`);
    const toasts = (page) => page.evaluate(`document.getElementById('toastWrap').innerText`);

    console.log('\nКто видит какие кнопки');
    {
        const solo = await open(`Progress.switchTo('KID', null, { accountType: 'solo' }); Progress.setToken('KID', 'tok');`);
        await profile(solo);
        await check('самостоятельный видит «У меня есть код репетитора»', async () => {
            assert(await shown(solo, 'linkTutorRow'), 'кнопки нет');
        });
        await solo.close();
        const pupil = await open(`Progress.switchTo('KID', null, { accountType: 'linked', ownerCode: 'TUTOR' }); Progress.setToken('KID', 'tok');`);
        await profile(pupil);
        await check('у ученика репетитора кнопки нет — репетитор уже есть', async () => {
            assert(!(await shown(pupil, 'linkTutorRow')), 'кнопка видна ученику');
        });
        await pupil.close();
        const tutor = await open(`Progress.switchTo('TUTOR', null, { accountType: 'self' }); Progress.setToken('TUTOR', 'tok');`);
        await profile(tutor);
        await check('у репетитора кнопки нет, зато есть «Пригласить ученика»', async () => {
            assert(!(await shown(tutor, 'linkTutorRow')), 'кнопка видна репетитору');
            const has = await tutor.evaluate(`[...document.querySelectorAll('#studentsSection .menu-btn')].some(b => /Пригласить ученика/.test(b.innerText))`);
            assert(has, 'у репетитора нет «Пригласить ученика»');
        });
        await tutor.close();
        const guest = await open(`Progress.startGuest();`);
        await profile(guest);
        await check('гостю кнопки нет — привязывать нечего', async () => {
            assert(!(await shown(guest, 'linkTutorRow')), 'кнопка видна гостю');
        });
        await guest.close();
    }

    console.log('\nПривязка глазами ученика');
    {
        const srv = {
            session_peek_invite: (b) => b.p_invite === 'ABCD-2345' ? { ok: true, tutorName: 'Максим' } : { ok: false, error: 'bad_invite', wait: 0 },
            session_accept_invite: () => ({ ok: true, tutorName: 'Максим', ownerCode: 'TUTOR', access: { 'integer-': 'all' } }),
            session_state: () => ({ ok: true, state: { schema: 2, playerCode: 'KID', updatedAt: 1, accountType: 'linked', ownerCode: 'TUTOR',
                                                       byTopic: { 'integer-:add:2': { correct: 12, wrong: 3 } } } }),
            session_my_tutor: () => ({ ok: true, name: 'Максим' }),
            session_my_access: () => ({ ok: true, access: { 'integer-': 'all' } })
        };
        const kid = await open(`Progress.switchTo('KID', null, { accountType: 'solo' }); Progress.setToken('KID', 'tok');
            Progress.setAccess({});
            Progress.get().byTopic = { 'integer-:add:2': { correct: 12, wrong: 3 } };`, srv);
        await profile(kid);
        const reachConfirm = async () => {
            await kid.evaluate(`linkToTutor(); null`);
            await kid.waitForSelector('#appDialogCard .dlg-input');
            await dialogFill(kid, 'ABCD-2345');
            await dialogOk(kid);
            await kid.waitForFunction(`/Репетитор: Максим/.test(document.getElementById('appDialogCard').innerText)`, null, { timeout: 4000 }).catch(() => {});
        };
        await reachConfirm();
        await check('«Отмена» в окне согласия — ничего не привязано', async () => {
            await kid.evaluate(`[...document.querySelectorAll('#appDialogCard .dlg-btn')].find(b => !b.classList.contains('primary')).click()`);
            await kid.waitForTimeout(300);
            assert(!kid.calls.some(c => c[0] === 'session_accept_invite'), 'привязка ушла после «Отмена»');
            eq(await kid.evaluate(`Progress.getAccountType()`), 'solo', 'тип после отмены');
        });
        await reachConfirm();
        await check('до согласия ребёнок видит имя репетитора и что изменится', async () => {
            const txt = await dialogText(kid);
            assert(/Репетитор: Максим/.test(txt), `в окне: ${txt}`);
            assert(/сбросить пароль/.test(txt) && /прогресс сохранится/i.test(txt), `не сказано, что изменится: ${txt}`);
            assert(!/TUTOR/.test(txt), 'в окне виден логин репетитора');
        });
        await check('просмотр ничего не привязывает', async () => {
            eq(await kid.evaluate(`Progress.getAccountType()`), 'solo', 'тип до согласия');
            assert(!kid.calls.some(c => c[0] === 'session_accept_invite'), 'привязка ушла до согласия');
        });
        await dialogOk(kid);
        // Тип меняется сразу, а карточка перерисовывается после отправки на сервер —
        // ждём именно карточку.
        await kid.waitForFunction(`/Максим/.test(document.getElementById('profileTypeVal').innerText)`, null, { timeout: 4000 }).catch(() => {});
        await check('после согласия — ученик, и в профиле имя репетитора, а не логин', async () => {
            eq(await kid.evaluate(`Progress.getAccountType()`), 'linked', 'тип');
            const type = await kid.evaluate(`document.getElementById('profileTypeVal').innerText`);
            assert(/Максим/.test(type) && !/TUTOR/.test(type), `в карточке: ${type}`);
            assert(!(await shown(kid, 'linkTutorRow')), 'кнопка привязки осталась');
        });
        await check('прогресс в разделе, который сервер открыл при привязке, на месте', async () => {
            const c = await kid.evaluate(`((Progress.get().byTopic || {})['integer-:add:2'] || {}).correct`);
            eq(c, 12, 'верных в отрицательных');
            const a = await kid.evaluate(`JSON.stringify(Progress.getAccess())`);
            assert(/integer-/.test(a), 'новый доступ не принят: ' + a);
        });
        await check('ошибок на странице нет', async () => { assert(!kid.errs.length, kid.errs.join('; ')); });
        await kid.close();
    }

    console.log('\nНеверный код и пауза');
    {
        let mode = 'bad';
        const kid = await open(`Progress.switchTo('KID', null, { accountType: 'solo' }); Progress.setToken('KID', 'tok');`, {
            session_peek_invite: () => mode === 'bad' ? { ok: false, error: 'bad_invite', wait: 0 }
                                     : mode === 'pause' ? { ok: false, error: 'bad_invite', wait: 60 }
                                     : { ok: false, error: 'too_many', wait: 150 }
        });
        await profile(kid);
        const tryCode = async () => {
            await kid.evaluate(`document.getElementById('toastWrap').innerHTML = ''; linkToTutor(); null`);
            await kid.waitForSelector('#appDialogCard .dlg-input');
            await dialogFill(kid, 'WRONG');
            await dialogOk(kid);
            await kid.waitForFunction(`document.getElementById('toastWrap').innerText.length > 0`, null, { timeout: 4000 });
            return toasts(kid);
        };
        await check('неверный код — понятный отказ, без привязки', async () => {
            const t = await tryCode();
            assert(/Такого кода нет/.test(t), `сообщение: ${t}`);
            eq(await kid.evaluate(`Progress.getAccountType()`), 'solo', 'тип');
        });
        mode = 'pause';
        await check('с шестой ошибки — сказано, сколько ждать', async () => {
            const t = await tryCode();
            assert(/Следующая попытка — через 1\sминуту/.test(t), `сообщение: ${t}`);
        });
        mode = 'too_many';
        await check('во время паузы — сколько ещё ждать, минутами вверх', async () => {
            const t = await tryCode();
            assert(/Попробуй через 3\sминуты/.test(t), `сообщение: ${t}`);
        });
        await kid.close();
    }

    console.log('\nПауза при входе');
    {
        let reply = { ok: false, error: 'bad_credentials', wait: 0 };
        const page = await open(``, { session_login: () => reply });
        const login = async () => page.evaluate(`(async () => {
            document.getElementById('codeScreen').style.display = 'flex';
            document.getElementById('codeInputField').value = 'KID';
            document.getElementById('passwordInputField').value = 'wrongpassword';
            await loginWithExistingCode();
            return document.getElementById('codeErrorMsg').innerText; })()`);
        await check('обычная ошибка — как раньше', async () => {
            const t = await login();
            eq(t, 'Неверный код или пароль.', 'сообщение');
        });
        reply = { ok: false, error: 'bad_credentials', wait: 120 };
        await check('началась пауза — сказано, когда пробовать', async () => {
            const t = await login();
            assert(/Следующая попытка — через 2\sминуты/.test(t), `сообщение: ${t}`);
        });
        reply = { ok: false, error: 'too_many', wait: 3600 };
        await check('во время паузы — сколько ждать', async () => {
            const t = await login();
            assert(/Попробуй через 60\sминут/.test(t), `сообщение: ${t}`);
        });
        await page.close();
    }

    console.log('\nПриглашение и «отпустить» у репетитора');
    {
        const page = await open(`Progress.switchTo('TUTOR', null, { accountType: 'self' }); Progress.setToken('TUTOR', 'tok');`, {
            session_create_invite: () => ({ ok: true, code: 'ABCD2345', expiresAt: '2026-10-16T00:00:00Z' }),
            session_list_students: () => ({ ok: true, students: [{ code: 'MASHA2015', label: 'Маша', totals: { correct: 10, wrong: 1 }, updatedAt: new Date().toISOString() }] }),
            session_release_student: (b) => ({ ok: b.p_student_code === 'MASHA2015' })
        });
        await profile(page);
        // Раздел учеников мог остаться свёрнутым с прошлого раза — разворачиваем.
        await page.evaluate(`document.getElementById('studentsSection').classList.remove('folded'); null`);
        await page.waitForSelector('#studentsList .list-row', { timeout: 8000 });
        await check('код приглашения — крупно, двумя четвёрками', async () => {
            await page.evaluate(`createInvite()`);
            const txt = await page.evaluate(`document.getElementById('studentsBanner').innerText`);
            assert(/ABCD-2345/.test(txt), `в карточке: ${txt}`);
            assert(/7 дней/.test(txt) && /один раз/.test(txt), `не сказано, сколько действует: ${txt}`);
        });
        await check('«Отмена» в окне «отпустить» — ученик остаётся', async () => {
            await page.evaluate(`document.querySelector('#studentsList [data-act="release"]').click()`);
            await page.waitForSelector('#appDialogCard .dlg-btn.danger');
            await page.evaluate(`[...document.querySelectorAll('#appDialogCard .dlg-btn')].find(b => !b.classList.contains('danger')).click()`);
            await page.waitForTimeout(300);
            assert(!page.calls.some(c => c[0] === 'session_release_student'), 'отпустили после «Отмена»');
        });
        await check('«отпустить» — с предупреждением и только после согласия', async () => {
            await page.evaluate(`document.querySelector('#studentsList [data-act="release"]').click()`);
            await page.waitForSelector('#appDialogCard .dlg-btn.danger');
            const txt = await dialogText(page);
            assert(/Прогресс и открытые разделы останутся/.test(txt), `в окне: ${txt}`);
            assert(!page.calls.some(c => c[0] === 'session_release_student'), 'отпустили до согласия');
            await dialogOk(page);
            await page.waitForFunction(`/занимается самостоятельно/.test(document.getElementById('toastWrap').innerText)`, null, { timeout: 4000 });
            const call = page.calls.find(c => c[0] === 'session_release_student');
            assert(call && call[1].p_student_code === 'MASHA2015', 'на сервер ушёл не тот ученик');
        });
        await check('ошибок на странице нет', async () => { assert(!page.errs.length, page.errs.join('; ')); });
        await page.close();
    }

    await browser.close();
    finish();
})();

function finish() {
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
}
