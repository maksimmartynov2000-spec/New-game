// НОВЫЕ КАРТИНКИ ПАЗЛОВ — СНАЧАЛА РЕПЕТИТОРУ.
//
// Зачем этот файл. Новые картинки пазлов и тексты к ним идут в игру не всем сразу:
// сначала их смотрит репетитор на своём аккаунте, а ученик, самостоятельный игрок и
// гость видят прежние. Здесь стережётся ровно это — во всех местах, где картинку
// показывают: пазл миссии, собранный пазл, плитка коллекции, карточка парадокса и
// фоновая догрузка. И что смена аккаунта на том же устройстве меняет картину сразу,
// без перезагрузки: репетитор, который вышел и пустил за телефон ученика, не должен
// оставить ему свои новые картинки.
//
// Проверка в две части. Сначала — как есть сейчас: что видит каждый, считается по
// самим спискам (PUZZLE_IMAGE_SRCS у всех, PUZZLE_PREVIEW_SRCS поверх — у репетитора).
// 18 октября все двадцать новых картинок открылись всем, список новых опустел, и тогда
// одно и то же видят все. Но правило «сначала репетитору» понадобится следующей партии,
// поэтому потом — проба: на две клетки подкладываются пробные картинка и карточка, и
// всё проверяется заново. Без пробы правило осталось бы непроверенным до первой поломки.
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
// Списки сверяются поштучно: при расхождении видно, на каком месте.
function sameList(got, want, what) {
    eq(got.length, want.length, `${what}: сколько`);
    got.forEach((x, i) => eq(x, want[i], `${what}, место ${i}`));
}
function finish() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`)); process.exit(1); }
}
const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

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

    // Всё, что видно на экране от картинок, — по всем двадцати клеткам: пазл миссии,
    // плитка коллекции и карточка (картинка и название). И сами списки, по которым
    // считается, что должно быть видно.
    const look = () => page.evaluate(`(() => {
        const ops = ['add', 'sub', 'mul', 'div'], cells = [], tiles = [], details = [];
        for (let i = 0; i < PUZZLE_IMAGE_SRCS.length; i++) {
            setupPuzzleForCell('integer+:' + ops[Math.floor(i / 5)] + ':' + (i % 5 + 1));
            cells.push(document.getElementById('puzzleFullImg').getAttribute('href'));
            tiles.push(buildCollectionItem(i, []).querySelector('img').getAttribute('src'));
            showParadoxDetail(i);
            details.push({ img: document.getElementById('detailImg').getAttribute('src'),
                           name: document.getElementById('detailName').innerText });
        }
        const preview = window.PARADOX_PREVIEW || {};
        return { cells, tiles, details, old: PUZZLE_IMAGE_SRCS.slice(), next: Object.assign({}, PUZZLE_PREVIEW_SRCS),
                 oldNames: window.PARADOX_CONTENT.ru.map(p => p.name),
                 nextNames: Object.fromEntries(Object.entries(preview.ru || {}).map(([k, p]) => [k, p.name])) }; })()`);

    // Что должно быть видно: у репетитора — новое там, где оно есть, у остальных — основное.
    const wantSrcs = (v, tutor) => v.old.map((src, i) => (tutor && has(v.next, i) ? v.next[i] : src));
    const wantNames = (v, tutor) => v.oldNames.map((n, i) => (tutor && has(v.nextNames, i) ? v.nextNames[i] : n));
    const thumb = (src) => src.replace('images/', 'images/thumbs/');

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
    const DONE = [[0, 'integer+:add:1'], [9, 'integer+:sub:5'], [14, 'integer+:mul:5'], [17, 'integer+:div:3'], [19, 'integer+:div:5']];

    const TITLES = { tutor: 'Репетитор', linked: 'Ученик репетитора', solo: 'Самостоятельный игрок', guest: 'Гость',
                     oldguest: 'Гость из старой версии (тип «self»)', nobody: 'До входа (после выхода)' };

    // Один круг по всем, кто бывает за устройством, — на том же устройстве и без перезагрузки.
    // Репетитор — первым и последним: вернувшись, он снова видит своё.
    const round = async (tag) => {
        for (const kind of ['tutor', 'linked', 'solo', 'guest', 'oldguest', 'nobody', 'tutor']) {
            const tutor = kind === 'tutor';
            console.log(`\n${tag}: ${TITLES[kind]}`);
            const w = await as(kind);
            const v = await look();
            const want = wantSrcs(v, tutor), names = wantNames(v, tutor);
            await checkAsync(`${tag}, ${kind}: пазл миссии — свои картинки на всех двадцати клетках`, async () => {
                sameList(v.cells, want, 'пазл миссии');
            });
            await checkAsync(`${tag}, ${kind}: плитки коллекции — свои превью`, async () => {
                sameList(v.tiles, want.map(thumb), 'плитка');
            });
            await checkAsync(`${tag}, ${kind}: карточки — своя картинка и свой текст`, async () => {
                sameList(v.details.map(d => d.img), want, 'картинка карточки');
                sameList(v.details.map(d => d.name), names, 'название карточки');
            });
            await checkAsync(`${tag}, ${kind}: собранный пазл показывается своей картинкой`, async () => {
                for (const [idx, key] of DONE) {
                    const c = await completed(idx, key);
                    eq(c.last, want[idx], `запомненная картинка, клетка ${idx}`);
                    eq(c.queued, want[idx], `картинка в очереди показа, клетка ${idx}`);
                }
            });
            await checkAsync(`${tag}, ${kind}: фоновая догрузка — свои картинки, каждая по разу`, async () => {
                sameList(await prefetched(), want, 'догрузка');
            });
            // Сам тип проверяем последним: иначе падение настройки спряталось бы за чужими.
            await checkAsync(`${tag}, ${kind}: и правда ${tutor ? 'репетитор' : 'не репетитор'}`, async () => {
                if (tutor) { eq(w.type, 'self', 'тип'); eq(w.guest, false, 'гость'); eq(w.code, 'TUT1', 'код'); }
                else assert(w.type !== 'self' || w.guest || !w.code, JSON.stringify(w));
            });
        }
    };

    await round('Как сейчас');

    // Проба правила на следующую партию: на клетки 2 и 17 кладутся пробные новые картинка и
    // карточка на всех языках. Картинки — настоящие файлы из папки (прежние картинки этих
    // клеток), названия — заметные «Проба …». Что лежало в списках раньше, возвращается.
    const DEMO = { 2: 'images/IMG_2429.webp', 17: 'images/IMG_2445.webp' };
    await page.evaluate(`(() => {
        const demo = ${JSON.stringify(DEMO)}, has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
        window.__kept = { src: {}, txt: {} };
        Object.keys(demo).forEach(k => {
            window.__kept.src[k] = has(PUZZLE_PREVIEW_SRCS, k) ? [PUZZLE_PREVIEW_SRCS[k]] : null;
            PUZZLE_PREVIEW_SRCS[k] = demo[k];
            Object.keys(window.PARADOX_CONTENT).forEach(l => {
                const box = window.PARADOX_PREVIEW[l] = window.PARADOX_PREVIEW[l] || {};
                (window.__kept.txt[l] = window.__kept.txt[l] || {})[k] = has(box, k) ? [box[k]] : null;
                box[k] = Object.assign({}, window.PARADOX_CONTENT[l][k], { name: 'Проба ' + l + ' ' + k });
            });
        }); })()`);
    try {
        await round('Проба');
        await as('tutor');
        await checkAsync('Проба: на другом языке репетитор видит новую карточку на этом языке', async () => {
            const r = await page.evaluate(`(() => {
                const keep = LANG; LANG = 'en';
                const name = (i) => { showParadoxDetail(i); return document.getElementById('detailName').innerText; };
                try { return [name(2), name(17), name(5)]; } finally { LANG = keep; } })()`);
            eq(r[0], 'Проба en 2', 'клетка 2');
            eq(r[1], 'Проба en 17', 'клетка 17');
            eq(r[2], (await page.evaluate(`window.PARADOX_CONTENT.en[5].name`)), 'клетка 5 — основная');
        });
    } finally {
        await page.evaluate(`(() => {
            const k = window.__kept;
            Object.keys(k.src).forEach(i => { if (k.src[i]) PUZZLE_PREVIEW_SRCS[i] = k.src[i][0]; else delete PUZZLE_PREVIEW_SRCS[i]; });
            Object.keys(k.txt).forEach(l => Object.keys(k.txt[l]).forEach(i => {
                if (k.txt[l][i]) window.PARADOX_PREVIEW[l][i] = k.txt[l][i][0]; else delete window.PARADOX_PREVIEW[l][i]; }));
            delete window.__kept; })()`);
    }

    console.log('\nПроба убрана');
    await as('tutor');
    await checkAsync('после пробы репетитор снова видит то, что в списках', async () => {
        const v = await look();
        sameList(v.cells, wantSrcs(v, true), 'пазл миссии');
        sameList(v.details.map(d => d.name), wantNames(v, true), 'название карточки');
        assert(v.details.every(d => d.name.indexOf('Проба') !== 0), 'пробная карточка осталась');
    });

    await checkAsync('страница без ошибок', async () => {
        eq(errors.join(' | '), '', 'ошибки страницы');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
