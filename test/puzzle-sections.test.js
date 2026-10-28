// КАРТИНКИ РАЗДЕЛОВ: пазлы отрицательных видит тот, кому раздел открыт.
//
// Зачем этот файл. С пятью картинками сложения отрицательных коллекция впервые вышла за
// двадцать картинок положительных. Правило для них то же, что везде: закрытый раздел
// ученику не показывается — ни в выборе миссии, ни на карте, ни в задачах. Значит, и
// картинок его не видно: ни плиток, ни «из 25» в счёте. Здесь стережётся:
//   • репетитор видит все картинки по разделам, с названием раздела над его рядами;
//   • ученик с одними положительными — двадцать, без названий разделов, и счёт «из 20»
//     везде: в заголовке коллекции, значке пазла, меню, итогах миссии. Картинка
//     отрицательных, собранная раньше, не видна, не считается и не листается;
//   • раздел открыли — сразу и ряд картинок, и счёт «из 25», а собранное на месте;
//   • в клетке сложения отрицательных мини-пазл — со своей картинкой, в вычитании
//     отрицательных картинки пока нет, и он спрятан;
//   • сотый верный ответ в клетке отрицательных собирает её картинку: «Добавлено в
//     коллекцию! (N/25)» и своя карточка.
//
// Как запускать:  node test/puzzle-sections.test.js

const path = require('path');
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

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — проверки картинок разделов пропущены.');
    finish();
    process.exit(0);
}

// Собрано: сложение 1★ (картинка 0) и сложение отрицательных 2★ (картинка 21); сложение
// отрицательных 4★ (картинка 23) только начато.
const SOLVED = { 'integer+:add:1': 100, 'integer-:add:2': 130, 'integer-:add:4': 37 };
const byTopic = (solved) => Object.fromEntries(Object.entries(solved).map(([k, n]) => [k, { correct: n, wrong: 0 }]));
const NEG_THUMBS = [2474, 2475, 2476, 2477, 2478].map(n => `images/thumbs/IMG_${n}.webp`);

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.route('**/rest/v1/rpc/*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof startGame === 'function' && typeof renderMaintenance === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); initPuzzle(); null`);

    // Кто играет и что у него собрано. Доступ — как его отдаёт сервер: null у репетитора,
    // у ученика — список открытых разделов. Сборы — прямо в Progress, без записи.
    const as = (code, type, access, solved) => page.evaluate(`(() => {
        Progress.switchTo(${JSON.stringify(code)}, null, { accountType: ${JSON.stringify(type)}, ownerCode: 'TUT1' });
        const access = ${JSON.stringify(access)};
        if (access) Progress.setAccess(access);
        enterApp();
        const st = Progress.get();
        st.byTopic = ${JSON.stringify(byTopic(solved))};
        st.collections.paradoxes = new Array(PUZZLE_IMAGE_SRCS.length).fill(false);
        refreshSectionLocks();
        return null; })()`);

    // Всё, что видно от коллекции: сетка, счёт в заголовке, значок пазла, меню, порядок листания.
    const look = () => page.evaluate(`(() => {
        openCollectionModal();
        const grid = document.getElementById('collectionGroups');
        const items = [...grid.querySelectorAll('.collection-item')];
        renderMenuStats();
        const out = {
            tiles: items.map(x => x.querySelector('img').getAttribute('src')),
            unlocked: items.filter(x => x.classList.contains('unlocked')).map(x => x.querySelector('img').getAttribute('src')),
            started: items.filter(x => x.classList.contains('started')).map(x => x.querySelector('.collection-progress-count').innerText),
            heads: [...grid.querySelectorAll('.collection-pics-section .collection-fold-label')].map(x => x.innerText),
            sums: [...grid.querySelectorAll('.collection-pics-section .collection-fold-sum')].map(x => x.innerText),
            titles: [...grid.querySelectorAll('.collection-group-title')].map(x => x.innerText),
            label: document.getElementById('collectionCountLabel').innerText,
            badge: document.getElementById('puzzleCollectionBadge').innerText,
            menu: document.getElementById('menuCollectionVal').innerText,
            flip: collectionFlipList()
        };
        closeCollectionModal();
        return out; })()`);
    // Строка коллекции в итогах миссии.
    const winLine = () => page.evaluate(`(() => { renderWinSummary();
        const row = [...document.querySelectorAll('#winRows .win-row')].find(r => /Коллекция/.test(r.innerText));
        return row ? row.querySelector('b').innerText : null; })()`);

    console.log('\nРепетитор: все картинки, по разделам');
    await as('TUT1', 'self', null, SOLVED);
    const tutor = await look();
    await checkAsync('двадцать пять плиток, над рядами — названия разделов', async () => {
        eq(tutor.tiles.length, 25, 'плиток');
        eq(tutor.heads.join(' | '), '🔵 Положительные | 🔴 Отрицательные', 'разделы');
        eq(tutor.sums.join(' | '), '1/20 | 1/5', 'собрано в разделе');
        eq(tutor.titles.join(' | '), '➕ Сложение — 1/5 | ➖ Вычитание — 0/5 | ✖️ Умножение — 0/5 | ➗ Деление — 0/5 | ➕ Сложение — 1/5', 'ряды');
    });
    await checkAsync('ряд отрицательных — пять своих картинок по звёздам, начатая — со счётом', async () => {
        eq(tutor.tiles.slice(20).join(','), NEG_THUMBS.join(','), 'картинки ряда');
        eq(tutor.unlocked.join(','), ['images/thumbs/IMG_2458.webp', NEG_THUMBS[1]].join(','), 'собранные');
        eq(tutor.started.join(','), '37/100', 'начатая');
    });
    await checkAsync('счёт везде из двадцати пяти: коллекция, значок, меню, итоги', async () => {
        eq(tutor.label, '2/25', 'заголовок коллекции');
        eq(tutor.badge, '🏆 2/25', 'значок пазла');
        eq(tutor.menu, '2/25', 'меню');
        eq(await winLine(), '2 из 25', 'итоги миссии');
    });
    await checkAsync('листается и в раздел отрицательных — в порядке сетки', async () => {
        eq(tutor.flip.join(','), '0,21', 'порядок листания');
    });
    await checkAsync('карточка отрицательных — своя картинка и свой текст', async () => {
        const d = await page.evaluate(`(() => { openCollectionModal(); showParadoxDetail(21);
            const r = { img: document.getElementById('detailImg').getAttribute('src'),
                        name: document.getElementById('detailName').innerText,
                        era: document.getElementById('detailEra').textContent };
            closeCollectionModal(); return r; })()`);
        eq(d.img, 'images/IMG_2475.webp', 'картинка');
        eq(d.name, 'Пляж ниже моря', 'название');
        eq(d.era, 'Мёртвое море, наши дни', 'кто и когда');
    });

    console.log('\nУченик, которому открыты одни положительные');
    await as('KID1', 'linked', { 'integer+': 'all' }, SOLVED);
    const kid = await look();
    await checkAsync('двадцать плиток, без названий разделов и без картинок отрицательных', async () => {
        eq(kid.tiles.length, 20, 'плиток');
        eq(kid.heads.length, 0, 'названий разделов');
        eq(kid.titles.length, 4, 'рядов');
        assert(kid.tiles.every(src => NEG_THUMBS.indexOf(src) < 0), JSON.stringify(kid.tiles));
    });
    await checkAsync('счёт везде из двадцати, собранная картинка отрицательных не в счёте', async () => {
        eq(kid.label, '1/20', 'заголовок коллекции');
        eq(kid.badge, '🏆 1/20', 'значок пазла');
        eq(kid.menu, '1/20', 'меню');
        eq(await winLine(), '1 из 20', 'итоги миссии');
    });
    await checkAsync('картинка закрытого раздела не листается', async () => {
        eq(kid.flip.join(','), '0', 'порядок листания');
    });

    console.log('\nТому же ученику открыли отрицательные');
    await page.evaluate(`Progress.setAccess({ 'integer+': 'all', 'integer-': 'all' }); refreshSectionLocks(); null`);
    await checkAsync('значок пазла пересчитан сразу, вместе с кнопками разделов', async () => {
        eq(await page.evaluate(`document.getElementById('puzzleCollectionBadge').innerText`), '🏆 2/25', 'значок пазла');
    });
    const opened = await look();
    await checkAsync('появились и ряд отрицательных, и счёт из двадцати пяти, собранное на месте', async () => {
        eq(opened.tiles.length, 25, 'плиток');
        eq(opened.heads.join(' | '), '🔵 Положительные | 🔴 Отрицательные', 'разделы');
        eq(opened.label, '2/25', 'заголовок коллекции');
        eq(opened.flip.join(','), '0,21', 'порядок листания');
        eq(opened.started.join(','), '37/100', 'начатая');
    });

    console.log('\nМини-пазл в клетках отрицательных');
    await as('TUT1', 'self', null, { 'integer-:add:3': 64 });
    const mission = (operations) => page.evaluate(`(() => {
        exampleConfig = { category: 'integer', numberType: 'negative', operations: ${JSON.stringify(operations)} };
        currentProblemMeta = null;
        initPuzzle();
        return { shown: document.getElementById('puzzleMiniBtn').style.display !== 'none',
                 img: document.getElementById('puzzleFullImg').getAttribute('href'),
                 count: document.getElementById('puzzleMiniCount').innerText }; })()`);
    await checkAsync('сложение отрицательных 3★ — своя картинка и кусочки этой клетки', async () => {
        const m = await mission({ add: 3 });
        assert(m.shown, 'мини-пазл спрятан');
        eq(m.img, 'images/IMG_2476.webp', 'картинка');
        eq(m.count, '64/100', 'кусочков');
    });
    await checkAsync('вычитание отрицательных — картинки пока нет, мини-пазл спрятан', async () => {
        const m = await mission({ sub: 3 });
        assert(!m.shown, 'мини-пазл виден в клетке без картинки');
    });

    console.log('\nСотый верный ответ в клетке отрицательных');
    await as('TUT1', 'self', null, { 'integer+:add:1': 100, 'integer-:add:3': 100 });
    await checkAsync('собирает её картинку: «Добавлено в коллекцию! (2/25)» и её карточка', async () => {
        const r = await page.evaluate(`(() => {
            pendingPuzzleReveals.length = 0;
            currentProblemMeta = { category: 'integer', opKey: 'add', level: 3, isNegative: true };
            addPuzzlePiece();
            const queued = pendingPuzzleReveals.map(x => x.index);
            showNextPuzzleReveal();
            return { queued, line: document.getElementById('collectionAddedLine').innerText,
                     img: document.getElementById('puzzleCompleteImg').getAttribute('src'),
                     name: document.getElementById('completeParadoxName').innerText }; })()`);
        eq(r.queued.join(','), '22', 'собранная картинка');
        assert(r.line.indexOf('Добавлено в коллекцию! (2/25)') >= 0, r.line);
        eq(r.img, 'images/IMG_2476.webp', 'картинка');
        eq(r.name, 'Долги Брахмагупты', 'карточка');
    });

    await checkAsync('страница без ошибок', async () => {
        eq(errors.join(' | '), '', 'ошибки страницы');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
