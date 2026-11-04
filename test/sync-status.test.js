// Тесты значка «сохранено» — того, что приложение говорит человеку о синхронизации.
//
// Зачем он нужен. После сбоев синхронизации ребёнку и родителю важно видеть, что
// ничего не пропало. Но значок полезен, только пока он не врёт: «✓ сохранено» там,
// где запись не дошла, хуже, чем никакого значка. Поэтому здесь проверяется не
// столько отрисовка, сколько правда за ней:
//   - «сохранено» — только когда сервер действительно принял запись;
//   - «нет связи» — когда не принял, и это проходит само, когда связь вернулась;
//   - «войди заново» — когда вход на устройстве закрыт: само это не пройдёт;
//   - ответ, данный, пока запрос был в пути, не теряет отметку «есть что отправить».
//   - ответ сервера для прежнего профиля не трогает новый, если профиль сменили,
//     пока ответ был в пути: ни прогресс, ни доступ, ни задания, ни значок.
//
// Как запускать:  node test/sync-status.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------- песочница для модуля Progress ----------
function loadProgress() {
    const moduleSrc = fs.readFileSync(path.join(ROOT, 'js', 'progress.js'), 'utf8');
    const store = {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date,
        isNaN, parseInt, parseFloat, Promise,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: () => {},
        setInterval: () => 0, clearInterval: () => {}
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(moduleSrc + '\n;globalThis.Progress = Progress;', sandbox,
                    { filename: 'index.html<Progress>' });
    return sandbox.Progress;
}

// Подставной сервер, которым управляет тест: каждый запрос висит, пока его не
// отпустят (gate), или отвечает сразу. writes — сколько записей сервер принял.
function server(P, opts) {
    const o = opts || {};
    const srv = { writes: 0, reads: 0, fail: !!o.fail, held: [] };
    const hold = () => new Promise((resolve, reject) => srv.held.push({ resolve, reject }));
    P.attachRemote({
        async read() {
            srv.reads++;
            if (o.gateRead) await hold();
            if (srv.fail) throw new Error('offline');
            return {};
        },
        async write() {
            if (o.gateWrite) await hold();
            if (srv.fail) throw new Error('offline');
            srv.writes++;
        }
    });
    // Отпустить самый ранний висящий запрос.
    srv.release = () => { const h = srv.held.shift(); if (h) h.resolve(); };
    return srv;
}

function pupil() {
    const P = loadProgress();
    P.init();
    P.switchTo('PUPIL', 'pw');
    P.setToken('PUPIL', 'tok');
    return P;
}

// Дать отработать всем микрозадачам (ожиданиям внутри flush).
const settle = () => new Promise(r => setTimeout(r, 0));

// ---------- раннер ----------
let passed = 0, failed = 0;
const failures = [];
const queue = [];
function test(name, fn) {
    queue.push(async () => {
        try { await fn(); passed++; console.log(`  ✓ ${name}`); }
        catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
    });
}
function group(name) { queue.push(async () => console.log(`\n${name}`)); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }

group('Что значок говорит');

test('гостю — «только на устройстве»: сервера у него нет', async () => {
    const P = loadProgress();
    P.init();
    P.startGuest();
    server(P);
    await P.flush(true);
    eq(P.syncStatus(), 'local', 'статус гостя');
});

test('до первой попытки сказать нечего', async () => {
    const P = pupil();
    server(P);
    eq(P.syncStatus(), null, 'статус до отправки');
});

test('сервера нет вовсе — «нет связи», а не «сохранено»', async () => {
    const P = pupil();
    eq(P.syncStatus(), 'offline', 'статус без сервера');
});

test('пока запрос в пути — «сохраняю», после ответа — «сохранено»', async () => {
    const P = pupil();
    const srv = server(P, { gateRead: true });
    const done = P.flush(true);
    eq(P.syncStatus(), 'saving', 'статус во время отправки');
    srv.release();
    eq(await done, true, 'отправка не удалась');
    eq(P.syncStatus(), 'saved', 'статус после отправки');
});

test('сервер не принял — «нет связи»; принял в следующий раз — «сохранено»', async () => {
    const P = pupil();
    const srv = server(P, { fail: true });
    P.recordTrainingAnswer();
    eq(await P.flush(), false, 'отправка будто бы удалась');
    eq(P.syncStatus(), 'offline', 'статус после неудачи');
    srv.fail = false;
    eq(await P.flush(), true, 'повторная отправка не удалась — dirty потерян после неудачи?');
    eq(P.syncStatus(), 'saved', 'статус после повтора');
});

test('вход на устройстве закрыт — «войди заново», а не «нет связи»', async () => {
    // Сервер ответил bad_session: драйвер забывает токен и падает. Пароля на
    // устройстве уже нет, и само это не пройдёт — в отличие от пропавшей связи.
    const P = pupil();
    P.attachRemote({
        async read() { P.dropToken('PUPIL'); throw new Error('bad_session'); },
        async write() {}
    });
    P.recordTrainingAnswer();
    await P.flush();
    eq(P.syncStatus(), 'signin', 'статус при закрытом входе');
});

test('два наложившихся запроса: «сохраняю», пока не закончится последний', async () => {
    const P = pupil();
    const srv = server(P, { gateRead: true });
    const a = P.flush(true);
    const b = P.flush(true);
    srv.release();
    await a;
    eq(P.syncStatus(), 'saving', 'первый закончившийся снял «сохраняю» за второй');
    srv.release();
    await b;
    eq(P.syncStatus(), 'saved', 'статус после обоих');
});

test('новый профиль не наследует «сохранено» от прошлого', async () => {
    const P = pupil();
    server(P);
    await P.flush(true);
    eq(P.syncStatus(), 'saved', 'исходный профиль');
    P.switchTo('OTHER', 'pw2');
    P.setToken('OTHER', 'tok2');
    eq(P.syncStatus(), null, 'чужой итог перешёл на новый профиль');
});

group('Экраны узнают о переменах сами');

test('подписчик слышит начало и конец отправки и закрытие входа', async () => {
    const P = pupil();
    const srv = server(P, { gateRead: true });
    const seen = [];
    P.onSyncChange(() => seen.push(P.syncStatus()));
    const done = P.flush(true);
    srv.release();
    await done;
    assert(seen.includes('saving'), `не услышал начало отправки: ${JSON.stringify(seen)}`);
    eq(seen[seen.length - 1], 'saved', 'последнее услышанное');
    P.dropToken('PUPIL');
    eq(seen[seen.length - 1], 'signin', 'не услышал, что вход закрыт');
});

test('ошибка в подписчике не мешает сохранению', async () => {
    const P = pupil();
    const srv = server(P);
    P.onSyncChange(() => { throw new Error('значок упал'); });
    P.recordTrainingAnswer();
    eq(await P.flush(), true, 'сохранение сорвалось из-за значка');
    eq(srv.writes, 1, 'запись не дошла до сервера');
});

group('Ответ, данный во время отправки, не теряется');

test('изменение, пока запись в пути, — отправляется следующим flush()', async () => {
    const P = pupil();
    const srv = server(P, { gateWrite: true });
    P.recordTrainingAnswer();
    const first = P.flush();
    await settle();                     // чтение прошло, запись висит
    P.recordTrainingAnswer();           // ответ, которого в слепке уже нет
    srv.release();
    await first;
    const second = P.flush();           // без force — уйдёт, только если есть что
    await settle();
    srv.release();
    eq(await second, true, 'второй ответ остался на устройстве: dirty снят за чужую запись');
    eq(srv.writes, 2, 'записей на сервере');
});

test('ничего не менялось — второй flush() ничего не шлёт', async () => {
    const P = pupil();
    const srv = server(P);
    P.recordTrainingAnswer();
    await P.flush();
    const again = await P.flush();
    eq(again, undefined, 'отправили то, что уже отправлено');
    eq(srv.writes, 1, 'записей на сервере');
});

group('Профиль сменили, пока шёл ответ сервера');

// Пока ответ для одного профиля в пути, на устройстве включили другой (список
// профилей, вход в другой аккаунт). Раньше ответ прежнего вливался в новый: тот
// получал чужие ответы и имя, а слитое уходило на сервер под ключом прежнего.
function twoPupils() {
    const P = loadProgress();
    P.init();
    P.switchTo('ANNA', null, { accountType: 'linked', ownerCode: 'TUT', profileLabel: 'Аня' });
    P.setToken('ANNA', 'tokA');
    return P;
}
function toBoris(P) {
    P.switchTo('BORIS', null, { accountType: 'linked', ownerCode: 'TUT', profileLabel: 'Боря' });
    P.setToken('BORIS', 'tokB');
}
// Подставной сервер: что пришло на запись — с чьим ключом и чьими данными.
function recorder(P, o) {
    const srv = { writes: [], held: [], kept: [] };
    const hold = () => new Promise((resolve, reject) => srv.held.push({ resolve, reject }));
    P.attachRemote({
        async read() {
            if (o && o.gateRead) await hold();
            return (o && o.remote) || {};
        },
        async write(code, auth, state) {
            srv.writes.push({ code, token: auth.token, playerCode: state.playerCode,
                              label: state.profileLabel, correct: state.totals.correct });
            if (o && o.gateWrite) await hold();
        },
        writeKeepalive(code) { srv.kept.push(code); return true; }
    });
    srv.release = () => srv.held.shift().resolve();
    srv.fail = () => srv.held.shift().reject(new Error('offline'));
    return srv;
}
const ANNA_ON_SERVER = { schema: 2, playerCode: 'ANNA', updatedAt: 5, accountType: 'linked', ownerCode: 'TUT',
                         profileLabel: 'Аня', totals: { correct: 500, wrong: 0 } };

test('ответ для прежнего профиля не вливается в новый и не уходит на сервер', async () => {
    const P = twoPupils();
    const srv = recorder(P, { gateRead: true, remote: ANNA_ON_SERVER });
    const done = P.flush(true);
    await settle();
    toBoris(P);
    srv.release();
    eq(await done, false, 'обмен прежнего профиля не брошен');
    eq(P.getCode(), 'BORIS', 'текущий профиль');
    eq(P.getProfileLabel(), 'Боря', 'имя нового профиля');
    eq(P.getAccountType(), 'linked', 'тип нового профиля');
    eq(P.get().totals.correct, 0, 'новому профилю влились чужие ответы');
    eq(JSON.stringify(srv.writes), '[]', 'на сервер ушло');
});

test('изменения прежнего профиля не пропадают: уходят, когда он снова текущий', async () => {
    const P = twoPupils();
    P.get().totals.correct = 3;
    let srv = recorder(P, { gateRead: true, remote: {} });
    const done = P.flush(true);
    await settle();
    toBoris(P);
    srv.release();
    await done;
    P.switchTo('ANNA');
    srv = recorder(P, { remote: {} });
    eq(await P.flush(true), true, 'отправка прежнего профиля не удалась');
    const w = srv.writes[0] || {};
    eq(`${w.code} ${w.token} ${w.playerCode} ${w.correct}`, 'ANNA tokA ANNA 3', 'что ушло на сервер');
});

test('запись прежнего профиля дошла — новый не получает «сохранено» и не теряет «есть что отправить»', async () => {
    const P = twoPupils();
    const srv = recorder(P, { gateWrite: true });
    P.recordTrainingAnswer();
    const done = P.flush();
    await settle();                     // чтение прошло, запись висит
    toBoris(P);
    srv.release();
    eq(await done, true, 'запись прежнего профиля');
    const w = srv.writes[0] || {};
    eq(`${w.code} ${w.token} ${w.playerCode}`, 'ANNA tokA ANNA', 'запись ушла не с теми данными');
    eq(P.syncStatus(), null, 'новый профиль получил «сохранено» от чужой записи');
    const again = recorder(P);
    eq(await P.flush(), true, 'новый профиль ничего не отправил');
    eq((again.writes[0] || {}).code, 'BORIS', 'чья запись ушла');
});

test('сеть упала у прежнего профиля — новому не пишем «нет связи»', async () => {
    const P = twoPupils();
    const srv = recorder(P, { gateRead: true });
    const done = P.flush(true);
    await settle();
    toBoris(P);
    srv.fail();
    eq(await done, false, 'отправка прежнего профиля');
    eq(P.syncStatus(), null, 'новому профилю досталось «нет связи»');
});

test('прощальная запись нового профиля не опирается на слияние прежнего', async () => {
    // Прощальная запись уходит без слияния — только если слияние было меньше минуты
    // назад. Было оно у прежнего профиля: новый своей копии с сервером ещё не сверял.
    const P = twoPupils();
    const srv = recorder(P);
    P.recordTrainingAnswer();
    eq(await P.flush(), true, 'слияние прежнего профиля');
    toBoris(P);
    P.recordTrainingAnswer();
    eq(P.farewell(), false, 'прощальная запись ушла без слияния нового профиля');
    eq(JSON.stringify(srv.kept), '[]', 'что ушло прощальной записью');
    // И сама прощальная запись по-прежнему работает: после своего слияния — уходит.
    eq(await P.flush(), true, 'слияние нового профиля');
    P.recordTrainingAnswer();
    eq(P.farewell(), true, 'после своего слияния прощальная запись не ушла');
    eq(srv.kept.join(','), 'BORIS', 'чья прощальная запись');
});

// Доступ и задания приходят с сервера тем же путём — и тем же путём опаздывают.
// Срез асинхронной функции из index.html: от объявления до её закрывающей скобки.
function sliceAsync(name) {
    const at = HTML.indexOf(`async function ${name}(`);
    assert(at >= 0, `в index.html нет функции ${name}`);
    let depth = 0;
    for (let i = HTML.indexOf('{', at); i < HTML.length; i++) {
        if (HTML[i] === '{') depth++;
        else if (HTML[i] === '}' && --depth === 0) return HTML.slice(at, i + 1);
    }
    throw new Error(`не нашёлся конец функции ${name}`);
}
function lateAnswer(name, payload) {
    const box = { cur: 'ANNA', applied: [], saved: [], gate: null };
    box.Progress = {
        getCode: () => box.cur, authFor: () => ({ token: 't' }), getAccountType: () => 'linked',
        setAccess: (a) => box.applied.push(a)
    };
    box.supabaseClient = {};
    box.callAuthed = () => new Promise(resolve => { box.gate = () => resolve({ data: payload, error: null }); });
    box.refreshSectionLocks = () => {};
    box.refreshHomework = async () => {};
    box.saveMyHomework = (list) => box.saved.push(list);
    box.noteHomeworkDone = () => {};
    box.renderConfigTasks = () => {};
    box.renderHomeworkCard = () => {};
    vm.createContext(box);
    vm.runInContext(sliceAsync(name) + `;globalThis.run = ${name};`, box);
    return box;
}

test('опоздавший доступ прежнего профиля не применяется к новому', async () => {
    // setAccess тут же чистит закрытые разделы: чужой доступ стёр бы новому ученику
    // прогресс там, где у прежнего закрыто.
    const late = lateAnswer('refreshAccess', { ok: true, access: { 'integer-': 'all' } });
    const done = late.run();
    await settle();
    late.cur = 'BORIS';
    late.gate();
    await done;
    eq(late.applied.length, 0, 'чужой доступ применён');
    // Без переключения доступ применяется, как раньше.
    const same = lateAnswer('refreshAccess', { ok: true, access: { 'integer-': 'all' } });
    const ok = same.run();
    await settle();
    same.gate();
    await ok;
    eq(same.applied.length, 1, 'свой доступ не применился');
});

test('опоздавшие задания прежнего профиля не сохраняются новому', async () => {
    const late = lateAnswer('refreshHomework', { ok: true, homework: [{ id: 1 }] });
    const done = late.run();
    await settle();
    late.cur = 'BORIS';
    late.gate();
    await done;
    eq(late.saved.length, 0, 'чужие задания сохранены');
    const same = lateAnswer('refreshHomework', { ok: true, homework: [{ id: 1 }] });
    const ok = same.run();
    await settle();
    same.gate();
    await ok;
    eq(same.saved.length, 1, 'свои задания не сохранились');
});

group('Разметка и проводка');

// Срез функции из index.html — по объявлению до следующей функции.
function slice(name) {
    const at = HTML.indexOf(`function ${name}(`);
    assert(at >= 0, `в index.html нет функции ${name}`);
    const end = HTML.indexOf('\n        function ', at + 1);
    return HTML.slice(at, end);
}

test('слова значка: каждому состоянию — своё, гостю и «не пробовали» — ничего', () => {
    const ctx = { t: (s) => s };
    vm.createContext(ctx);
    vm.runInContext(slice('syncBadgeView') + ';globalThis.view = syncBadgeView;', ctx);
    const v = ctx.view;
    eq(v('local'), null, 'гостю');
    eq(v(null), null, 'до первой попытки');
    eq(v('saved').cls, 'ok', 'сохранено');
    eq(v('saving').cls, 'busy', 'сохраняю');
    eq(v('offline').cls, 'warn', 'нет связи');
    eq(v('signin').cls, 'bad', 'войди заново');
    assert(v('signin').action, 'у «войди заново» нет кнопки — что делать, непонятно');
    assert(!v('offline').action, 'у «нет связи» кнопка не нужна: это пройдёт само');
    const texts = ['saved', 'saving', 'offline', 'signin'].map(s => v(s).text);
    eq(new Set(texts).size, 4, 'два состояния говорят одно и то же');
});

test('значок стоит на экране выбора, на итогах и в профиле', () => {
    ['syncBadgeConfig', 'syncBadgeWin', 'syncBadgeProfile'].forEach(id => {
        assert(new RegExp(`class="sync-badge" id="${id}"`).test(HTML), `нет значка ${id}`);
    });
});

test('значки перерисовываются по сигналу Progress', () => {
    assert(/Progress\.onSyncChange\(renderSyncBadges\)/.test(HTML),
        'renderSyncBadges не подписан — значок застынет на первом состоянии');
});

test('«сохранится позже» сбывается само: повтор по таймеру и при возврате сети', () => {
    const fn = slice('retrySyncIfOffline');
    // flush(true), а не flush(): принудительная отправка при запуске, которая не
    // удалась, dirty не ставит — и обычный flush() вышел бы, ничего не отправив.
    assert(/Progress\.flush\(true\)/.test(fn), 'повтор без force — после неудачного запуска не сработает');
    assert(/setInterval\(retrySyncIfOffline,/.test(HTML), 'нет повтора по таймеру');
    assert(/addEventListener\('online', retrySyncIfOffline\)/.test(HTML), 'нет повтора при возврате сети');
});

(async () => {
    for (const step of queue) await step();

    // ---------- живой прогон в браузере ----------
    let chromium = null;
    try { ({ chromium } = require('playwright')); } catch (e) { /* нет — пропускаем */ }
    if (!chromium) {
        console.log('\nPlaywright не установлен — живой прогон пропущен.');
    } else {
        console.log('\nЖивой прогон: значок на экране выбора миссии');
        const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
        const run = async (name, serverUp, check) => {
            const page = await browser.newPage();
            const errs = [];
            page.on('pageerror', e => errs.push(e.message));
            await page.route('**/rest/v1/rpc/*', r => {
                if (!serverUp) return r.abort();
                const fn = r.request().url().split('/rpc/')[1];
                const body = fn === 'session_state' ? { ok: true, state: {} } : { ok: true, access: null };
                return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            });
            await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200,
                contentType: 'application/javascript', body: 'window.MAINTENANCE={until:null,note:null};' }));
            await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
            await page.goto('file://' + path.join(ROOT, 'index.html'));
            await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
            await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();
                Progress.switchTo('MASHA', null, { accountType: 'solo' }); Progress.setToken('MASHA', 'tok');
                enterApp(); Progress.flush(true); null`);
            await page.waitForFunction(`Progress.syncStatus() !== 'saving' && Progress.syncStatus() !== null`, null, { timeout: 5000 });
            const got = await page.evaluate(`(() => { const b = document.getElementById('syncBadgeConfig');
                return { hidden: b.hidden, text: b.textContent, cls: b.className }; })()`);
            try { check(got); record(name, errs.length ? 'ошибки на странице: ' + errs.join('; ') : null); }
            catch (e) { record(name, e.message); }
            await page.close();
        };
        const record = (name, err) => {
            if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
            else { passed++; console.log(`  ✓ ${name}`); }
        };
        await run('сервер принял — «✓ Прогресс сохранён»', true, (g) => {
            assert(!g.hidden, 'значок спрятан');
            assert(/Прогресс сохранён/.test(g.text), `на значке: ${g.text}`);
        });
        await run('сервер недоступен — «Нет связи — сохранится позже»', false, (g) => {
            assert(!g.hidden, 'значок спрятан');
            assert(/Нет связи/.test(g.text) && /warn/.test(g.cls), `на значке: ${g.text} (${g.cls})`);
        });
        // «Войди заново» → сказать нечего: плашка обязана исчезнуть с экрана. У неё свой
        // display: flex, и спрятанная атрибутом hidden она оставалась видна.
        {
            const page = await browser.newPage();
            await page.route('**/rest/v1/rpc/*', r => r.abort());
            await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200,
                contentType: 'application/javascript', body: 'window.MAINTENANCE={until:null,note:null};' }));
            await page.goto('file://' + path.join(ROOT, 'index.html'));
            await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
            const seen = await page.evaluate(`(() => {
                window.MAINTENANCE = { until: null }; renderMaintenance();
                Progress.switchTo('KID', null, { accountType: 'solo' });   // ключа нет — «войди заново»
                enterApp();
                const b = document.getElementById('syncBadgeConfig');
                const before = getComputedStyle(b).display;
                Progress.setToken('KID', 'tok');                             // ключ есть, отправок не было
                return { before, after: getComputedStyle(b).display, text: b.textContent };
            })()`);
            try {
                assert(seen.before !== 'none', 'плашка «войди заново» не показалась вовсе');
                assert(seen.after === 'none', `плашка осталась на экране: display ${seen.after}, «${seen.text}»`);
                record('плашка «войди заново» исчезает, когда сказать уже нечего', null);
            } catch (e) { record('плашка «войди заново» исчезает, когда сказать уже нечего', e.message); }
            await page.close();
        }
        await browser.close();
    }

    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
