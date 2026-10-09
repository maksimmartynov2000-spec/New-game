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
