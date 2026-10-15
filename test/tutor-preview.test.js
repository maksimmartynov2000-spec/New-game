// НОВЫЕ КАРТИНКИ ПАЗЛОВ — СНАЧАЛА РЕПЕТИТОРУ.
//
// Зачем этот файл. Новые картинки сложения и тексты к ним идут в игру не всем сразу:
// сначала их смотрит репетитор на своём аккаунте, а ученик, самостоятельный игрок и
// гость видят прежние. Здесь стережётся ровно это — во всех местах, где картинку
// показывают: пазл миссии, собранный пазл, плитка коллекции, карточка парадокса и
// фоновая догрузка. И что смена аккаунта на том же устройстве меняет картину сразу,
// без перезагрузки: репетитор, который вышел и пустил за телефон ученика, не должен
// оставить ему свои новые картинки.
//
// Как запускать:  node test/tutor-preview.test.js

const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function checkAsync(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }
function finish() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`)); process.exit(1); }
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.route('**/rest/v1/rpc/*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof startGame === 'function' && typeof renderMaintenance === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); initPuzzle(); null`);

    // Кто сейчас за устройством. Ученик репетитора — с выданным доступом, чтобы его не
    // пускало во всё одно лишь «сервер ещё не ответил».
    const as = (who) => page.evaluate(`(() => {
        const who = ${JSON.stringify(who)};
        if (who === 'tutor') Progress.switchTo('TUT1', null, { accountType: 'self' });
        else if (who === 'linked') { Progress.switchTo('KID1', null, { accountType: 'linked', ownerCode: 'TUT1' });
                                     Progress.setAccess({ 'integer+': 'all' }); }
        else if (who === 'solo') Progress.switchTo('SOLO1', null, { accountType: 'solo' });
        else if (who === 'guest') Progress.startGuest();
        // Гость из старой версии: тогда гостю ставили тип 'self', и сохранённый профиль
        // так и живёт с ним. Отличить его можно только по самому гостевому коду.
        else if (who === 'oldguest') { Progress.startGuest(); Progress.setAccountType('self'); }
        else if (who === 'nobody') { Progress.switchTo('GONE1', null, { accountType: 'solo' }); Progress.logout(); }
        return { type: Progress.getAccountType(), code: Progress.getCode(), guest: Progress.isGuest() }; })()`);

    // Всё, что видно на экране от картинок клеток 0 и 4 (меняются) и 5 и 7 (не меняются).
    const look = () => page.evaluate(`(() => {
        const href = () => document.getElementById('puzzleFullImg').getAttribute('href');
        setupPuzzleForCell('integer+:add:1'); const add1 = href();
        setupPuzzleForCell('integer+:add:5'); const add5 = href();
        setupPuzzleForCell('integer+:sub:1'); const sub1 = href();
        const tile0 = buildCollectionItem(0, [1]).querySelector('img').getAttribute('src');
        const tile7 = buildCollectionItem(7, []).querySelector('img').getAttribute('src');
        showParadoxDetail(0);
        const detail0 = { img: document.getElementById('detailImg').getAttribute('src'),
                          name: document.getElementById('detailName').innerText };
        showParadoxDetail(5);
        const detail5 = { img: document.getElementById('detailImg').getAttribute('src'),
                          name: document.getElementById('detailName').innerText };
        return { add1, add5, sub1, tile0, tile7, detail0, detail5,
                 old: PUZZLE_IMAGE_SRCS.slice(), next: Object.assign({}, PUZZLE_PREVIEW_SRCS),
                 oldName0: window.PARADOX_CONTENT.ru[0].name, oldName5: window.PARADOX_CONTENT.ru[5].name,
                 newName0: window.PARADOX_PREVIEW.ru[0].name }; })()`);

    // Фоновая догрузка: какие файлы она запросила бы.
    const prefetched = () => page.evaluate(`(async () => {
        const got = [];
        const realFetch = window.fetch, ric = window.requestIdleCallback;
        window.fetch = (url) => { got.push(String(url)); return Promise.resolve(new Response('')); };
        window.requestIdleCallback = (fn) => fn();
        try { preloadPuzzleImages(); await new Promise(r => setTimeout(r, 100)); }
        finally { window.fetch = realFetch; window.requestIdleCallback = ric; }
        return got; })()`);

    // Собранный пазл: и то, что запомнилось для показа, и то, что встало в очередь.
    const completed = () => page.evaluate(`(() => {
        pendingPuzzleReveals.length = 0;
        onPuzzleComplete(0, 'integer+:add:1');
        const queued = pendingPuzzleReveals.length ? pendingPuzzleReveals[pendingPuzzleReveals.length - 1].src : null;
        pendingPuzzleReveals.length = 0;
        return { last: lastCompletedSrc, queued }; })()`);

    console.log('\nРепетитор видит новые картинки');
    const who = await as('tutor');
    await checkAsync('репетитор и правда репетитор', async () => {
        eq(who.type, 'self', 'тип'); eq(who.guest, false, 'гость'); eq(who.code, 'TUT1', 'код');
    });
    let v = await look();
    await checkAsync('пазл миссии: новые картинки на сложении 1★ и 5★', async () => {
        eq(v.add1, 'images/IMG_2453.webp', 'сложение 1★');
        eq(v.add1, v.next[0], 'сложение 1★ из списка новых');
        eq(v.add5, v.next[4], 'сложение 5★');
    });
    await checkAsync('клетка без новой картинки — прежняя', async () => {
        eq(v.sub1, v.old[5], 'вычитание 1★');
        eq(v.tile7, v.old[7].replace('images/', 'images/thumbs/'), 'плитка 7');
    });
    await checkAsync('плитка коллекции — новое превью', async () => {
        eq(v.tile0, v.next[0].replace('images/', 'images/thumbs/'), 'плитка 0');
    });
    await checkAsync('карточка парадокса — новая картинка и новый текст', async () => {
        eq(v.detail0.img, v.next[0], 'картинка карточки 0');
        eq(v.detail0.name, v.newName0, 'название карточки 0');
        eq(v.detail5.img, v.old[5], 'картинка карточки 5');
        eq(v.detail5.name, v.oldName5, 'название карточки 5');
    });
    await checkAsync('на другом языке — новый текст на этом языке', async () => {
        const r = await page.evaluate(`(() => {
            const keep = LANG; LANG = 'en';
            try { showParadoxDetail(0); return { got: document.getElementById('detailName').innerText,
                                                 want: window.PARADOX_PREVIEW.en[0].name }; }
            finally { LANG = keep; } })()`);
        eq(r.got, r.want, 'название по-английски');
    });
    await checkAsync('собранный пазл показывается новой картинкой', async () => {
        const c = await completed();
        eq(c.last, v.next[0], 'запомненная картинка');
        eq(c.queued, v.next[0], 'картинка в очереди показа');
    });
    await checkAsync('фоновая догрузка берёт новые картинки вместо прежних', async () => {
        const got = await prefetched();
        eq(got.length, v.old.length, 'сколько файлов');
        Object.keys(v.next).forEach(k => {
            assert(got.indexOf(v.next[k]) >= 0, `не догружается ${v.next[k]}`);
            assert(got.indexOf(v.old[k]) < 0, `догружается прежняя ${v.old[k]}`);
        });
        assert(got.indexOf(v.old[5]) >= 0, 'не догружаются клетки без новой картинки');
    });

    // Остальные — по очереди, на том же устройстве и без перезагрузки.
    for (const kind of ['linked', 'solo', 'guest', 'oldguest', 'nobody']) {
        const title = { linked: 'Ученик репетитора', solo: 'Самостоятельный игрок', guest: 'Гость',
                        oldguest: 'Гость из старой версии (тип «self»)', nobody: 'До входа (после выхода)' }[kind];
        console.log(`\n${title} видит прежние картинки`);
        const w = await as(kind);
        v = await look();
        await checkAsync(`${kind}: пазл миссии — прежние картинки`, async () => {
            eq(v.add1, v.old[0], 'сложение 1★');
            eq(v.add5, v.old[4], 'сложение 5★');
        });
        await checkAsync(`${kind}: плитка и карточка — прежние`, async () => {
            eq(v.tile0, v.old[0].replace('images/', 'images/thumbs/'), 'плитка 0');
            eq(v.detail0.img, v.old[0], 'картинка карточки 0');
            eq(v.detail0.name, v.oldName0, 'название карточки 0');
        });
        await checkAsync(`${kind}: собранный пазл — прежняя картинка`, async () => {
            const c = await completed();
            eq(c.last, v.old[0], 'запомненная картинка');
            eq(c.queued, v.old[0], 'картинка в очереди показа');
        });
        await checkAsync(`${kind}: фоновая догрузка — только прежние`, async () => {
            const got = await prefetched();
            eq(got.join(','), v.old.join(','), 'список догрузки');
        });
        // Сам тип проверяем последним: иначе падение настройки спряталось бы за чужими.
        await checkAsync(`${kind}: это и правда не репетитор`, async () => {
            assert(w.type !== 'self' || w.guest || !w.code, JSON.stringify(w));
        });
    }

    console.log('\nОбратно к репетитору');
    await as('tutor');
    v = await look();
    await checkAsync('репетитор снова видит новые картинки', async () => {
        eq(v.add1, v.next[0], 'сложение 1★');
        eq(v.detail0.name, v.newName0, 'название карточки 0');
    });

    await checkAsync('страница без ошибок', async () => {
        eq(errors.join(' | '), '', 'ошибки страницы');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
