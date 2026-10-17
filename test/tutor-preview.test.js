// НОВЫЕ КАРТИНКИ ПАЗЛОВ — СНАЧАЛА РЕПЕТИТОРУ.
//
// Зачем этот файл. Новые картинки сложения, вычитания и умножения и тексты к ним идут в игру не всем сразу:
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

    // Всё, что видно на экране от картинок: клетки сложения, вычитания и умножения (0–14)
    // меняются, клетки деления (15 и дальше) — нет. Берутся края каждого ряда: 1★ и 5★.
    const look = () => page.evaluate(`(() => {
        const cell = (key) => { setupPuzzleForCell(key);
            return document.getElementById('puzzleFullImg').getAttribute('href'); };
        const tile = (i, done) => buildCollectionItem(i, done).querySelector('img').getAttribute('src');
        const detail = (i) => { showParadoxDetail(i);
            return { img: document.getElementById('detailImg').getAttribute('src'),
                     name: document.getElementById('detailName').innerText }; };
        return { add1: cell('integer+:add:1'), add5: cell('integer+:add:5'),
                 sub1: cell('integer+:sub:1'), sub5: cell('integer+:sub:5'),
                 mul1: cell('integer+:mul:1'), mul5: cell('integer+:mul:5'), div1: cell('integer+:div:1'),
                 tile0: tile(0, [1]), tile7: tile(7, []), tile12: tile(12, []), tile17: tile(17, []),
                 detail0: detail(0), detail9: detail(9), detail14: detail(14), detail15: detail(15),
                 old: PUZZLE_IMAGE_SRCS.slice(), next: Object.assign({}, PUZZLE_PREVIEW_SRCS),
                 oldName0: window.PARADOX_CONTENT.ru[0].name, oldName9: window.PARADOX_CONTENT.ru[9].name,
                 oldName14: window.PARADOX_CONTENT.ru[14].name, oldName15: window.PARADOX_CONTENT.ru[15].name,
                 newName0: window.PARADOX_PREVIEW.ru[0].name, newName9: window.PARADOX_PREVIEW.ru[9].name,
                 newName14: window.PARADOX_PREVIEW.ru[14].name }; })()`);

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
    const completed = (idx, key) => page.evaluate(`(() => {
        pendingPuzzleReveals.length = 0;
        onPuzzleComplete(${idx}, '${key}');
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
        eq(v.add1, 'images/IMG_2458.webp', 'сложение 1★');
        eq(v.add1, v.next[0], 'сложение 1★ из списка новых');
        eq(v.add5, v.next[4], 'сложение 5★');
    });
    await checkAsync('пазл миссии: новые картинки на вычитании 1★ и 5★', async () => {
        eq(v.sub1, 'images/IMG_2459.webp', 'вычитание 1★ — обратный отсчёт');
        eq(v.sub5, 'images/IMG_2463.webp', 'вычитание 5★ — корабль Тесея');
        eq(v.sub1, v.next[5], 'вычитание 1★ из списка новых');
        eq(v.sub5, v.next[9], 'вычитание 5★ из списка новых');
    });
    await checkAsync('пазл миссии: новые картинки на умножении 1★ и 5★', async () => {
        eq(v.mul1, 'images/IMG_2464.webp', 'умножение 1★ — лист бумаги до Луны');
        eq(v.mul5, 'images/IMG_2468.webp', 'умножение 5★ — парадокс дней рождения');
        eq(v.mul1, v.next[10], 'умножение 1★ из списка новых');
        eq(v.mul5, v.next[14], 'умножение 5★ из списка новых');
    });
    await checkAsync('клетка без новой картинки — прежняя', async () => {
        eq(v.div1, v.old[15], 'деление 1★');
        eq(v.tile17, v.old[17].replace('images/', 'images/thumbs/'), 'плитка 17');
    });
    await checkAsync('плитки коллекции — новые превью', async () => {
        eq(v.tile0, v.next[0].replace('images/', 'images/thumbs/'), 'плитка 0');
        eq(v.tile7, v.next[7].replace('images/', 'images/thumbs/'), 'плитка 7');
        eq(v.tile12, v.next[12].replace('images/', 'images/thumbs/'), 'плитка 12');
    });
    await checkAsync('карточка парадокса — новая картинка и новый текст', async () => {
        eq(v.detail0.img, v.next[0], 'картинка карточки 0');
        eq(v.detail0.name, v.newName0, 'название карточки 0');
        eq(v.detail9.img, v.next[9], 'картинка карточки 9');
        eq(v.detail9.name, v.newName9, 'название карточки 9');
        eq(v.detail14.img, v.next[14], 'картинка карточки 14');
        eq(v.detail14.name, v.newName14, 'название карточки 14');
        eq(v.detail15.img, v.old[15], 'картинка карточки 15');
        eq(v.detail15.name, v.oldName15, 'название карточки 15');
    });
    await checkAsync('на другом языке — новый текст на этом языке', async () => {
        const r = await page.evaluate(`(() => {
            const keep = LANG; LANG = 'en';
            const name = (i) => { showParadoxDetail(i); return document.getElementById('detailName').innerText; };
            try { return { got: [name(0), name(9), name(14)],
                           want: [0, 9, 14].map(i => window.PARADOX_PREVIEW.en[i].name) }; }
            finally { LANG = keep; } })()`);
        eq(r.got.join(' | '), r.want.join(' | '), 'названия по-английски');
    });
    await checkAsync('собранный пазл показывается новой картинкой', async () => {
        const c = await completed(0, 'integer+:add:1');
        eq(c.last, v.next[0], 'запомненная картинка, сложение');
        eq(c.queued, v.next[0], 'картинка в очереди показа, сложение');
        const s = await completed(9, 'integer+:sub:5');
        eq(s.last, v.next[9], 'запомненная картинка, вычитание');
        eq(s.queued, v.next[9], 'картинка в очереди показа, вычитание');
        const m = await completed(14, 'integer+:mul:5');
        eq(m.last, v.next[14], 'запомненная картинка, умножение');
        eq(m.queued, v.next[14], 'картинка в очереди показа, умножение');
    });
    await checkAsync('фоновая догрузка берёт новые картинки вместо прежних', async () => {
        const got = await prefetched();
        eq(got.length, v.old.length, 'сколько файлов');
        Object.keys(v.next).forEach(k => {
            assert(got.indexOf(v.next[k]) >= 0, `не догружается ${v.next[k]}`);
            assert(got.indexOf(v.old[k]) < 0, `догружается прежняя ${v.old[k]}`);
        });
        assert(got.indexOf(v.old[15]) >= 0, 'не догружаются клетки без новой картинки');
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
            eq(v.sub1, v.old[5], 'вычитание 1★');
            eq(v.sub5, v.old[9], 'вычитание 5★');
            eq(v.mul1, v.old[10], 'умножение 1★');
            eq(v.mul5, v.old[14], 'умножение 5★');
        });
        await checkAsync(`${kind}: плитки и карточки — прежние`, async () => {
            eq(v.tile0, v.old[0].replace('images/', 'images/thumbs/'), 'плитка 0');
            eq(v.tile7, v.old[7].replace('images/', 'images/thumbs/'), 'плитка 7');
            eq(v.detail0.img, v.old[0], 'картинка карточки 0');
            eq(v.detail0.name, v.oldName0, 'название карточки 0');
            eq(v.detail9.img, v.old[9], 'картинка карточки 9');
            eq(v.detail9.name, v.oldName9, 'название карточки 9');
            eq(v.tile12, v.old[12].replace('images/', 'images/thumbs/'), 'плитка 12');
            eq(v.detail14.img, v.old[14], 'картинка карточки 14');
            eq(v.detail14.name, v.oldName14, 'название карточки 14');
        });
        await checkAsync(`${kind}: собранный пазл — прежняя картинка`, async () => {
            const c = await completed(0, 'integer+:add:1');
            eq(c.last, v.old[0], 'запомненная картинка, сложение');
            eq(c.queued, v.old[0], 'картинка в очереди показа, сложение');
            const s = await completed(9, 'integer+:sub:5');
            eq(s.last, v.old[9], 'запомненная картинка, вычитание');
            eq(s.queued, v.old[9], 'картинка в очереди показа, вычитание');
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
        eq(v.sub5, v.next[9], 'вычитание 5★');
        eq(v.mul5, v.next[14], 'умножение 5★');
        eq(v.detail0.name, v.newName0, 'название карточки 0');
        eq(v.detail9.name, v.newName9, 'название карточки 9');
    });

    await checkAsync('страница без ошибок', async () => {
        eq(errors.join(' | '), '', 'ошибки страницы');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
