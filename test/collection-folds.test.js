// СВОРАЧИВАНИЕ В КОЛЛЕКЦИИ: разделы и ряды действий в обеих вкладках.
//
// Зачем этот файл. Коллекция выросла: пазлы и задачи двух разделов, по четыре действия в
// каждом, и до нужного ряда приходилось листать. Теперь «Положительные» и «Отрицательные»,
// а в них «Сложение», «Вычитание», «Умножение» и «Деление» сворачиваются нажатием на
// заголовок. Здесь стережётся:
//   • по умолчанию раскрыт только первый раздел, ряды в нём раскрыты;
//   • свёрнутый раздел не молчит: справа в заголовке счёт;
//   • нажатие раскрывает и сворачивает, подпись ряда остаётся прежней;
//   • выбор запоминается на устройстве, и у вкладок «Пазлы» и «Задачи» он свой;
//   • заголовок — кнопка: работает с клавиатуры и говорит, раскрыт ли он;
//   • у ученика с одним разделом названий разделов нет, а ряды сворачиваются;
//   • окно не уезжает из-под пальца, когда от сворачивания становится короче;
//   • листание собранных пазлов от свёрнутого не зависит.
//
// Как запускать:  node test/collection-folds.test.js

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
    console.log('Playwright не установлен — проверки сворачивания пропущены.');
    finish();
    process.exit(0);
}

// Собрано: сложение 1★ (картинка 0) и сложение отрицательных 2★ (картинка 21). Мастерство
// на сложении 1★ — две задачи во вкладке «Задачи».
const SOLVED = { 'integer+:add:1': 100, 'integer-:add:2': 130 };
const MASTER = ['s', 'a', 'c'].map(l => `integer+:add:1:${l}5`);
const byTopic = (solved) => Object.fromEntries(Object.entries(solved).map(([k, n]) => [k, { correct: n, wrong: 0 }]));

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
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); localStorage.removeItem('mathCitadelFolds_v1'); null`);

    const as = (code, type, access) => page.evaluate(`(() => {
        Progress.switchTo(${JSON.stringify(code)}, null, { accountType: ${JSON.stringify(type)}, ownerCode: 'TUT1' });
        const access = ${JSON.stringify(access)};
        if (access) Progress.setAccess(access);
        enterApp();
        const st = Progress.get();
        st.byTopic = ${JSON.stringify(byTopic(SOLVED))};
        st.collections.paradoxes = new Array(PUZZLE_IMAGE_SRCS.length).fill(false);
        ${JSON.stringify(MASTER)}.forEach(id => Progress.unlock(id));
        refreshSectionLocks();
        return null; })()`);
    const open = () => page.evaluate(`closeCollectionModal(); openCollectionModal(); null`);
    const tab = (which) => page.evaluate(`showCollectionTab(${JSON.stringify(which)}); null`);

    // Что видно в открытой вкладке: разделы и ряды с их состоянием, сколько плиток и задач
    // на экране (видимые — те, что не спрятаны свёрнутым заголовком).
    const look = (which) => page.evaluate(`(() => {
        const root = document.getElementById(${JSON.stringify(which === 'tasks' ? 'collectionTasks' : 'collectionGroups')});
        const shown = (el) => !!el.offsetParent;
        const heads = [...root.querySelectorAll('.collection-section > .collection-fold-toggle')];
        const rows = [...root.querySelectorAll('.collection-group > .collection-group-title')];
        return {
            sections: heads.map(h => ({ label: h.querySelector('.collection-fold-label').innerText,
                sum: h.querySelector('.collection-fold-sum').innerText,
                expanded: h.getAttribute('aria-expanded'), folded: h.parentElement.classList.contains('folded'),
                role: h.getAttribute('role'), tab: h.tabIndex })),
            rows: rows.map(r => ({ title: r.innerText, shown: shown(r), expanded: r.getAttribute('aria-expanded'),
                folded: r.parentElement.classList.contains('folded') })),
            tiles: [...root.querySelectorAll('.collection-item')].filter(shown).length,
            tasks: [...root.querySelectorAll('.ladder-challenge')].filter(shown).length,
            locks: [...root.querySelectorAll('.collection-task-lock')].filter(shown).length
        }; })()`);
    // Нажатие на заголовок — настоящим кликом мыши по видимому заголовку с этим текстом.
    const press = async (which, text) => {
        const sel = `#${which === 'tasks' ? 'collectionTasks' : 'collectionGroups'} .collection-fold-toggle`;
        await page.locator(sel, { hasText: text }).first().click();
        await page.waitForTimeout(80);
    };

    console.log('\nПо умолчанию');
    await as('TUT1', 'self', null);
    await open();
    let v = await look('pics');
    await checkAsync('раскрыт только первый раздел, ряды в нём раскрыты', async () => {
        eq(v.sections.map(s => s.label).join(' | '), '🔵 Положительные | 🔴 Отрицательные', 'разделы');
        eq(v.sections.map(s => s.folded).join(','), 'false,true', 'свёрнут');
        eq(v.sections.map(s => s.expanded).join(','), 'true,false', 'aria-expanded');
        eq(v.tiles, 20, 'плиток на экране');
        eq(v.rows.filter(r => r.shown).map(r => r.expanded).join(','), 'true,true,true,true', 'ряды положительных');
    });
    await checkAsync('свёрнутый раздел не молчит: справа счёт', async () => {
        eq(v.sections.map(s => s.sum).join(' | '), '1/20 | 1/5', 'счёт в заголовке');
    });
    await checkAsync('заголовок — кнопка, до неё можно дойти клавишей Tab', async () => {
        assert(v.sections.every(s => s.role === 'button' && s.tab === 0), JSON.stringify(v.sections));
    });
    await checkAsync('листание собранных от свёрнутого не зависит', async () => {
        eq((await page.evaluate(`collectionFlipList()`)).join(','), '0,21', 'порядок листания');
    });

    console.log('\nНажатие');
    await press('pics', 'Отрицательные');
    v = await look('pics');
    await checkAsync('нажал на «Отрицательные» — раздел раскрылся', async () => {
        eq(v.sections[1].folded, false, 'свёрнут');
        eq(v.sections[1].expanded, 'true', 'aria-expanded');
        eq(v.tiles, 25, 'плиток на экране');
    });
    await press('pics', 'Вычитание');
    v = await look('pics');
    await checkAsync('нажал на «Вычитание» — ряд свернулся, подпись прежняя', async () => {
        const row = v.rows.find(r => /Вычитание/.test(r.title));
        eq(row.title, '➖ Вычитание — 0/5', 'подпись');
        eq(row.folded, true, 'свёрнут');
        eq(row.expanded, 'false', 'aria-expanded');
        eq(v.tiles, 20, 'плиток на экране');
    });

    console.log('\nВыбор запоминается');
    await open();
    v = await look('pics');
    await checkAsync('закрыл окно и открыл снова — всё как оставил', async () => {
        eq(v.sections.map(s => s.folded).join(','), 'false,false', 'разделы свёрнуты');
        eq(v.rows.filter(r => r.folded).map(r => r.title).join(), '➖ Вычитание — 0/5', 'свёрнутые ряды');
    });

    console.log('\nВкладка «Задачи»');
    await tab('tasks');
    v = await look('tasks');
    await checkAsync('у задач свой выбор: снова раскрыт только первый раздел', async () => {
        eq(v.sections.map(s => s.label).join(' | '), '🔵 Положительные | 🔴 Отрицательные', 'разделы');
        eq(v.sections.map(s => s.folded).join(','), 'false,true', 'свёрнут');
        eq(v.sections.map(s => s.sum).join(' | '), '2/40 | 0/40', 'счёт в заголовке');
        eq(v.tasks, 2, 'задач на экране');
    });
    await press('tasks', 'Сложение');
    v = await look('tasks');
    await checkAsync('свернул «Сложение» в задачах — задачи спрятаны, в пазлах ряд не тронут', async () => {
        eq(v.tasks, 0, 'задач на экране');
        eq(v.rows.find(r => /Сложение/.test(r.title)).title, '➕ Сложение — 2/10', 'подпись');
        await tab('pics');
        const pics = await look('pics');
        eq(pics.rows.find(r => /Сложение/.test(r.title)).folded, false, '«Сложение» в пазлах');
        await tab('tasks');
    });

    console.log('\nКлавиатура');
    const keyState = async (key) => {
        await page.evaluate(`document.querySelector('#collectionTasks .collection-section > .collection-fold-toggle').focus(); null`);
        await page.keyboard.press(key);
        await page.waitForTimeout(80);
        return page.evaluate(`document.querySelector('#collectionTasks .collection-section').classList.contains('folded')`);
    };
    await checkAsync('Enter сворачивает раздел, пробел раскрывает обратно', async () => {
        eq(await keyState('Enter'), true, 'после Enter');
        eq(await keyState(' '), false, 'после пробела');
    });

    console.log('\nОкно не уезжает');
    // Свернуть оба раздела — окно станет коротким. Раньше короткое окно вставало посередине,
    // и заголовок, на который только что нажали, уходил из-под пальца.
    await page.evaluate(`localStorage.removeItem('mathCitadelFolds_v1'); null`);
    await open();
    await tab('tasks');
    const headTop = () => page.evaluate(`Math.round(document.querySelector('#collectionTasks .collection-fold-toggle').getBoundingClientRect().top)`);
    const before = await headTop();
    await press('tasks', 'Положительные');
    const after = await headTop();
    await checkAsync('свернул раздел — заголовок остался под пальцем', async () => {
        const folded = await page.evaluate(`[...document.querySelectorAll('#collectionTasks .collection-section')].every(s => s.classList.contains('folded'))`);
        assert(folded, 'свёрнуты не оба раздела — окно не стало коротким, проверять нечего');
        assert(Math.abs(after - before) <= 1, `заголовок был на ${before}, стал на ${after}`);
    });
    await open();
    await checkAsync('открыл окно заново — верх больше не закреплён', async () => {
        eq(await page.evaluate(`document.querySelector('#collectionModal .puzzle-modal-inner').style.marginTop`), '', 'отступ сверху');
    });

    console.log('\nКоллекция из окна пазла');
    // Новый пазл отрицательных лежит в разделе, свёрнутом по умолчанию. Из окна пазла его
    // раздел и ряд раскрываются сами — даже если ряд свернули нарочно.
    await page.evaluate(`localStorage.removeItem('mathCitadelFolds_v1'); null`);
    await as('TUT1', 'self', null);
    await page.evaluate(`(() => { const f = loadFolds(); f['collection:pics:integer-:add'] = false; saveFolds(f); return null; })()`);
    const tileShown = (i) => page.evaluate(`(() => {
        const img = [...document.querySelectorAll('#collectionGroups .collection-item img')]
            .find(x => x.getAttribute('src') === puzzleThumbSrc(${i}));
        return !!(img && img.offsetParent); })()`);
    await page.evaluate(`(() => {
        closeCollectionModal();
        Progress.get().byTopic['integer-:add:3'] = { correct: 100, wrong: 0 };
        pendingPuzzleReveals.length = 0;
        currentProblemMeta = { category: 'integer', opKey: 'add', level: 3, isNegative: true };
        addPuzzlePiece();
        showNextPuzzleReveal();
        document.getElementById('btnViewCollection').click();
        return null; })()`);
    v = await look('pics');
    await checkAsync('из собранного пазла: его раздел и ряд раскрыты, картинка видна', async () => {
        eq(v.sections.map(s => s.folded).join(','), 'false,false', 'разделы свёрнуты');
        eq(v.rows.find(r => r.title.indexOf('➕ Сложение — 2/5') === 0 && r.shown).folded, false, 'ряд сложения отрицательных');
        assert(await tileShown(22), 'картинки 22 не видно');
    });
    await page.evaluate(`localStorage.removeItem('mathCitadelFolds_v1'); closeCollectionModal();
        setupPuzzleForCell('integer-:add:4'); openPuzzleModal();
        document.getElementById('btnOpenCollectionLive').click(); null`);
    v = await look('pics');
    await checkAsync('из пазла, который собирается: его раздел раскрыт', async () => {
        eq(v.sections.map(s => s.folded).join(','), 'false,false', 'разделы свёрнуты');
        assert(await tileShown(23), 'картинки 23 не видно');
    });
    await page.evaluate(`closePuzzleModal(); closeCollectionModal(); null`);

    console.log('\nУченик с одним разделом');
    await page.evaluate(`localStorage.removeItem('mathCitadelFolds_v1'); null`);
    await as('KID1', 'linked', { 'integer+': 'all' });
    await open();
    v = await look('pics');
    await checkAsync('названий разделов нет, все ряды раскрыты', async () => {
        eq(v.sections.length, 0, 'заголовков разделов');
        eq(v.rows.map(r => r.expanded).join(','), 'true,true,true,true', 'ряды');
        eq(v.tiles, 20, 'плиток на экране');
    });
    await press('pics', 'Деление');
    v = await look('pics');
    await checkAsync('ряд сворачивается и без заголовка раздела', async () => {
        eq(v.rows.find(r => /Деление/.test(r.title)).folded, true, '«Деление» свёрнуто');
        eq(v.tiles, 15, 'плиток на экране');
    });

    await checkAsync('страница без ошибок', async () => {
        eq(errors.join(' | '), '', 'ошибки страницы');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
