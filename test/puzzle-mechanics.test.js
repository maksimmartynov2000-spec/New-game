// МЕХАНИКА ПАЗЛА: раскладка, порядок кусочков, форма замков, вспышка, коллекция,
// просмотр на весь экран и финал со «склейкой».
//
// Зачем этот файл. Раскладка пазла бралась из Math.random при каждой настройке, а
// настраивается он при каждом старте миссии: при тех же сорока собранных на прежних
// местах оставалось меньше половины кусочков. Теперь раскладка выводится из клетки
// и номера сборки — и здесь стережётся, что она та же при каждом заходе, что кусочки
// встают островками, что соседние кусочки сходятся без щелей, что новый кусочек
// вспыхивает только от верного ответа, что начатый пазл виден в коллекции, что
// картинку можно рассмотреть, что пазл «склеивается» в финале и что отметки
// коллекции не обнуляются, когда картинок станет сорок.
//
// Как запускать:  node test/puzzle-mechanics.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = require('./app-source').appScript(HTML);

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
function check(name, fn) { try { fn(); record(name, null); } catch (e) { record(name, e.message); } }
async function checkAsync(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }
function finish() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`)); process.exit(1); }
}

// ---------------------------------------------------------------------------------
// Часть 1. Раскладка — чистые функции, прямо из index.html.
// ---------------------------------------------------------------------------------
function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}
const L = (() => {
    const box = { Math, Array, String, Number, PUZZLE_GRID: 10, PUZZLE_TILE: 100, PUZZLE_SIZE: 1000 };
    vm.createContext(box);
    vm.runInContext(slice('function puzzleSeed(text)', '// Текущая раскладка на экране.', 'раскладка')
        + ';globalThis.R = { puzzleSeed, seededRandom, bumpSeg, buildPiecePath, puzzleIslandOrder, puzzleLayout,'
        + ' PUZZLE_TAB_START, PUZZLE_TAB_SHAPE };', box, { filename: 'index.html<раскладка>' });
    return box.R;
})();

const CELLS = [];
['add', 'sub', 'mul', 'div'].forEach(op => { for (let l = 1; l <= 5; l++) CELLS.push(`integer+:${op}:${l}`); });

console.log('\nРаскладка выводится из клетки и сборки');

check('та же клетка и та же сборка — та же раскладка', () => {
    CELLS.forEach(key => [0, 1, 2].forEach(round => {
        const a = L.puzzleLayout(key, round), b = L.puzzleLayout(key, round);
        eq(JSON.stringify(a.order), JSON.stringify(b.order), `порядок ${key}#${round}`);
        eq(JSON.stringify(a.paths), JSON.stringify(b.paths), `форма ${key}#${round}`);
    }));
});

check('новая сборка и другая клетка — другая раскладка', () => {
    const base = L.puzzleLayout('integer+:add:3', 0);
    const next = L.puzzleLayout('integer+:add:3', 1);
    const other = L.puzzleLayout('integer+:add:4', 0);
    assert(JSON.stringify(base.order) !== JSON.stringify(next.order), 'вторая сборка повторила порядок первой');
    assert(JSON.stringify(base.paths) !== JSON.stringify(next.paths), 'вторая сборка повторила форму кусочков');
    assert(JSON.stringify(base.order) !== JSON.stringify(other.order), 'у соседней клетки тот же порядок');
});

check('все сто кусочков, каждый ровно по разу', () => {
    CELLS.forEach(key => {
        const seen = new Set(L.puzzleLayout(key, 0).order.map(([r, c]) => `${r},${c}`));
        eq(seen.size, 100, `разных мест у ${key}`);
    });
});

// Островки: новый кусочек почти всегда встаёт рядом с собранным. Вразброс таких
// около трёх четвертей, островками — больше девяти из десяти. И на пятнадцати
// кусочках это два-три пятна, а вразброс — восемь и больше отдельных крошек.
function islandStats(order) {
    const got = new Set();
    let touching = 0;
    let componentsAt15 = 0;
    order.forEach(([r, c], i) => {
        const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([y, x]) => got.has(`${y},${x}`));
        if (near) touching++;
        got.add(`${r},${c}`);
        if (i === 14) {
            const left = new Set(got);
            while (left.size) {
                componentsAt15++;
                const stack = [left.values().next().value];
                while (stack.length) {
                    const cur = stack.pop();
                    if (!left.delete(cur)) continue;
                    const [y, x] = cur.split(',').map(Number);
                    [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]].forEach(([a, b]) => {
                        if (left.has(`${a},${b}`)) stack.push(`${a},${b}`);
                    });
                }
            }
        }
    });
    return { touching: touching / order.length, componentsAt15 };
}
check('кусочки встают островками, а не вразброс', () => {
    let worstTouch = 1, worstComp = 0;
    CELLS.forEach(key => [0, 1, 2].forEach(round => {
        const st = islandStats(L.puzzleLayout(key, round).order);
        worstTouch = Math.min(worstTouch, st.touching);
        worstComp = Math.max(worstComp, st.componentsAt15);
    }));
    assert(worstTouch >= 0.88, `рядом с собранным встаёт только ${Math.round(worstTouch * 100)}% кусочков`);
    assert(worstComp <= 4, `на 15 кусочках ${worstComp} отдельных пятен — это уже вразброс`);
});

console.log('\nФорма кусочков');

// Точки сегмента, как их нарисует SVG: начало, затем все опорные и конечные точки.
function segPoints(x1, y1, x2, y2, amp) {
    const nums = L.bumpSeg(x1, y1, x2, y2, amp).match(/-?\d+(\.\d+)?/g).map(Number);
    const pts = [[x1, y1]];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return pts;
}
check('соседние кусочки сходятся точка в точку', () => {
    // Сосед проходит общую границу в обратную сторону. Если форма замка несимметрична,
    // его кривая не совпадёт с нашей — будут щели и нахлёсты.
    [[300, 200, 400, 200], [400, 200, 400, 300], [0, 900, 100, 900], [700, 0, 700, 100]].forEach(([x1, y1, x2, y2]) => {
        [1, -1].forEach(amp => {
            const there = segPoints(x1, y1, x2, y2, amp);
            const back = segPoints(x2, y2, x1, y1, amp).reverse();
            eq(there.length, back.length, 'число точек туда и обратно');
            there.forEach((p, i) => {
                const d = Math.hypot(p[0] - back[i][0], p[1] - back[i][1]);
                assert(d < 0.02, `граница ${x1},${y1}→${x2},${y2} (${amp}) расходится на ${d.toFixed(3)} в точке ${i}`);
            });
        });
    });
});

check('у замка есть шейка: головка шире основания', () => {
    // Классический замок: узкая шейка и круглая головка. Широкий бугорок без шейки
    // делал кусочки похожими на ромбики.
    const pts = [[L.PUZZLE_TAB_START, 0]];
    L.PUZZLE_TAB_SHAPE.forEach(s => pts.push([s[4], s[5]]));
    const width = (lo, hi) => {
        const us = pts.filter(([, v]) => v >= lo && v <= hi).map(([u]) => u);
        return Math.max(...us) - Math.min(...us);
    };
    const neck = width(0.05, 0.09), head = width(0.15, 0.19);
    assert(neck > 0 && head > neck * 1.5, `шейка ${neck.toFixed(2)}, головка ${head.toFixed(2)}`);
    const top = Math.max(...pts.map(([, v]) => v));
    assert(top > 0.2 && top < 0.35, `высота замка ${top}`);
});

// ---------------------------------------------------------------------------------
// Часть 2. В живом браузере.
// ---------------------------------------------------------------------------------
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — живые проверки пазла пропущены.');
    finish();
    process.exit(0);
}

(async () => {
    // Страница открыта с диска, и без этого флага холст с картинкой с диска считается
    // «чужим»: снимок со швами не снимается, и окно собранного пазла показывает запасной
    // вариант. На сайте картинки свои, и снимок снимается — как с флагом.
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.route('**/rest/v1/rpc/*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { if (!localStorage.getItem('mathCitadelLang_v1')) localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    const boot = async () => {
        await page.waitForFunction(`typeof startGame === 'function' && typeof renderMaintenance === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);
    };
    await page.goto(FILE);
    await boot();
    await page.evaluate(`Progress.switchTo('PZ1', null, { accountType: 'self' }); enterApp(); null`);

    // Ученик с correct верными в клетке «Сложение 2★» и открытой звездой.
    const seed = (byTopic, extra) => page.evaluate(`(() => {
        const st = Progress.get();
        st.byTopic = ${JSON.stringify(byTopic)};
        st.unlocks = Object.assign(st.unlocks || {}, { 'integer+:add:1:c3': '2026-01-01', 'integer+:add:1:a3': '2026-01-01' });
        const ex = ${JSON.stringify(extra || {})};
        if (ex.totals) st.totals = Object.assign(st.totals || {}, ex.totals);
        return null; })()`);
    const startMission = (op, level) => page.evaluate(`(() => {
        closeCollectionModal(); closePuzzleModal();
        exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
        exampleConfig.operations = { ${op}: ${level} };
        Progress.setConfig(exampleConfig);
        document.getElementById('configScreen').style.display = 'none';
        startGame(); return null; })()`);
    const placed = () => page.evaluate(`[...document.querySelectorAll('#miniPiecesGroup use')]
        .map(u => u.getAttribute('clip-path')).sort().join(' ')`);
    const shapes = () => page.evaluate(`[...document.querySelectorAll('#puzzleDefs clipPath path')].slice(0, 12)
        .map(p => p.getAttribute('d')).join('|')`);

    console.log('\nКусочки на своих местах');
    await seed({ 'integer+:add:2': { correct: 40, wrong: 3 } });
    await startMission('add', 2);
    await page.waitForTimeout(400);
    const first = await placed(), firstShapes = await shapes();
    await startMission('add', 2);
    await page.waitForTimeout(400);
    const second = await placed(), secondShapes = await shapes();
    await checkAsync('новая миссия — те же места и та же форма', async () => {
        eq(first.split(' ').length, 40, 'кусочков на экране');
        assert(first === second, 'кусочки переехали между миссиями');
        assert(firstShapes === secondShapes, 'форма кусочков поменялась между миссиями');
    });
    await page.goto(FILE);
    await boot();
    await startMission('add', 2);
    await page.waitForTimeout(400);
    await checkAsync('после перезагрузки — те же места и та же форма', async () => {
        assert(await placed() === first, 'кусочки переехали после перезагрузки');
        assert(await shapes() === firstShapes, 'форма кусочков поменялась после перезагрузки');
    });

    console.log('\nВспышка нового кусочка');
    const flashes = () => page.evaluate(`({ mini: document.querySelectorAll('#miniFlashGroup .piece-flash').length,
        big: document.querySelectorAll('#bigFlashGroup .piece-flash').length })`);
    await checkAsync('при старте миссии ничего не вспыхивает', async () => {
        const f = await flashes();
        assert(f.mini === 0 && f.big === 0, JSON.stringify(f));
    });
    const answered = await page.evaluate(`(() => {
        const next = PUZZLE_FILL_ORDER[puzzleFilled];
        checkAnswer(correctAnswer, null);
        const flash = document.querySelector('#miniFlashGroup .piece-flash');
        return { filled: puzzleFilled, flash: flash ? flash.getAttribute('d') : null,
                 piece: PUZZLE_PIECE_PATHS[next[0]][next[1]],
                 big: document.querySelectorAll('#bigFlashGroup .piece-flash').length };
    })()`);
    await checkAsync('верный ответ — вспыхивает ровно новый кусочек', async () => {
        eq(answered.filled, 41, 'кусочков после ответа');
        assert(answered.flash, 'вспышки нет');
        eq(answered.flash, answered.piece, 'вспыхнул не тот кусочек');
        eq(answered.big, 1, 'вспышек в большом окне');
    });
    await checkAsync('на экране итогов копия мини-пазла без вспышки', async () => {
        const r = await page.evaluate(`(() => { renderWinSummary();
            const art = document.getElementById('winArt');
            return { pieces: art.querySelectorAll('use').length, flash: art.querySelectorAll('.piece-flash').length }; })()`);
        assert(r.pieces >= 41, `в копии ${r.pieces} кусочков`);
        eq(r.flash, 0, 'вспышек в копии');
    });
    await page.waitForTimeout(1300);
    await checkAsync('вспышка гаснет за секунду', async () => {
        const f = await flashes();
        assert(f.mini === 0 && f.big === 0, JSON.stringify(f));
    });
    await page.waitForFunction(`!answerLocked`, null, { timeout: 5000 }).catch(() => {});
    const wrong = await page.evaluate(`(() => {
        const before = puzzleFilled;
        checkAnswer(typeof correctAnswer === 'number' ? correctAnswer + 1 : '__нет__', null);
        return { before, after: puzzleFilled, flash: document.querySelectorAll('.piece-flash').length };
    })()`);
    await checkAsync('неверный ответ ничего не зажигает', async () => {
        eq(wrong.after, wrong.before, 'кусочков после ошибки');
        eq(wrong.flash, 0, 'вспышек после ошибки');
    });

    console.log('\nНачатый пазл в коллекции');
    await page.evaluate(`gameActive = false; null`);
    await seed({ 'integer+:add:3': { correct: 37, wrong: 1 }, 'integer+:mul:1': { correct: 120, wrong: 2 } });
    await page.evaluate(`openCollectionModal(); null`);
    await page.waitForFunction(`(() => { const c = document.querySelector('#collectionGroups .collection-item.started canvas');
        return c && c.dataset.pieces; })()`, null, { timeout: 5000 }).catch(() => {});
    const tiles = await page.evaluate(`(() => {
        const items = [...document.querySelectorAll('#collectionGroups .collection-item')];
        const at = (i) => { const el = items[i]; const canvas = el.querySelector('canvas');
            const count = el.querySelector('.collection-progress-count');
            return { cls: el.className, canvas: !!canvas, drawn: canvas ? canvas.dataset.pieces || '' : '',
                     count: count ? count.innerText : '', after: getComputedStyle(el, '::after').content }; };
        return { started: at(2), untouched: at(0), collected: at(10) };
    })()`);
    await checkAsync('у начатого — собранные кусочки и счёт вместо «?»', async () => {
        const s = tiles.started;
        assert(/\blocked\b/.test(s.cls) && /\bstarted\b/.test(s.cls), s.cls);
        assert(s.canvas, 'нет холста с кусочками');
        eq(s.drawn, '37', 'нарисовано кусочков');
        eq(s.count, '37/100', 'счёт на плитке');
        eq(s.after, 'none', '«?» на начатой плитке');
    });
    await checkAsync('нетронутый — по-прежнему «?», собранный — без счёта', async () => {
        assert(!/\bstarted\b/.test(tiles.untouched.cls) && !tiles.untouched.canvas, JSON.stringify(tiles.untouched));
        assert(/\?/.test(tiles.untouched.after), `на нетронутой плитке ${tiles.untouched.after}`);
        assert(/\bunlocked\b/.test(tiles.collected.cls) && !tiles.collected.canvas && !tiles.collected.count,
               JSON.stringify(tiles.collected));
    });
    await checkAsync('кусочки на плитке — те же, что в игре', async () => {
        const same = await page.evaluate(`(() => {
            const a = puzzleLayout('integer+:add:3', 0);
            const before = PUZZLE_FILL_ORDER;
            setupPuzzleForCell('integer+:add:3');
            const r = JSON.stringify(PUZZLE_FILL_ORDER.slice(0, 37)) === JSON.stringify(a.order.slice(0, 37));
            return r; })()`);
        assert(same, 'порядок на плитке и в игре разный');
    });

    console.log('\nКартинку можно рассмотреть');
    await page.evaluate(`openCollectionModal(); null`);
    await page.click('#collectionGroups .collection-item.unlocked');
    await page.waitForTimeout(300);
    await checkAsync('в коллекции картинка во всю ширину окна', async () => {
        const w = await page.evaluate(`document.getElementById('detailImg').getBoundingClientRect().width`);
        assert(w >= 320, `ширина картинки ${Math.round(w)} px`);
    });
    await page.click('#detailImg');
    await page.waitForTimeout(200);
    // offsetParent у position: fixed всегда null, поэтому видимость — по стилю.
    const viewer = () => page.evaluate(`(() => { const v = document.getElementById('picViewer');
        const img = document.getElementById('picViewerImg');
        return { open: !v.hidden && getComputedStyle(v).display !== 'none', src: img.getAttribute('src') || '',
                 t: img.style.transform, k: picView.k }; })()`);
    let v = await viewer();
    await checkAsync('нажатие открывает картинку на весь экран', async () => {
        assert(v.open, 'просмотр не открылся');
        const want = await page.evaluate(`PUZZLE_IMAGE_SRCS[10]`);
        assert(v.src.endsWith(want), `в просмотре ${v.src}, ждали ${want}`);
    });
    await page.mouse.dblclick(195, 422);
    await page.waitForTimeout(100);
    v = await viewer();
    await checkAsync('двойное нажатие приближает, повторное — возвращает', async () => {
        assert(v.k > 2, `увеличение ${v.k}`);
        await page.mouse.dblclick(195, 422);
        await page.waitForTimeout(100);
        const back = await viewer();
        assert(Math.abs(back.k - 1) < 0.01, `после второго двойного нажатия увеличение ${back.k}`);
    });
    await checkAsync('двумя пальцами — крупнее', async () => {
        const k = await page.evaluate(`(() => {
            const box = document.getElementById('picViewer');
            const fire = (type, id, x, y) => box.dispatchEvent(new PointerEvent(type,
                { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
            fire('pointerdown', 1, 150, 420); fire('pointerdown', 2, 240, 420);
            fire('pointermove', 2, 330, 420);
            fire('pointerup', 2, 330, 420); fire('pointerup', 1, 150, 420);
            return picView.k; })()`);
        assert(k > 1.8 && k < 2.2, `увеличение после разведения пальцев ${k}`);
    });
    await checkAsync('приближенную картинку двигают, и пустоты по краям не бывает', async () => {
        const r = await page.evaluate(`(() => {
            const before = { tx: picView.tx, ty: picView.ty };
            const box = document.getElementById('picViewer');
            const fire = (type, x, y) => box.dispatchEvent(new PointerEvent(type,
                { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
            fire('pointerdown', 200, 400); fire('pointermove', 260, 430); fire('pointerup', 260, 430);
            const moved = picView.tx !== before.tx || picView.ty !== before.ty;
            fire('pointerdown', 200, 400); fire('pointermove', 2000, 2000); fire('pointerup', 2000, 2000);
            const img = document.getElementById('picViewerImg').getBoundingClientRect();
            return { moved, left: img.left, top: img.top }; })()`);
        assert(r.moved, 'картинка не сдвинулась');
        assert(r.left <= 0.5 && r.top <= 0.5 + (844 - 390) / 2, `край уехал внутрь: ${JSON.stringify(r)}`);
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await checkAsync('Escape закрывает просмотр', async () => {
        assert(!(await viewer()).open, 'просмотр не закрылся');
    });

    console.log('\nФинал: пазл склеивается');
    await seed({ 'integer+:add:2': { correct: 99, wrong: 3 } }, { totals: { puzzlesCompleted: 6 } });
    await startMission('add', 2);
    await page.waitForTimeout(300);
    await page.evaluate(`checkAnswer(correctAnswer, null); null`);
    await page.waitForTimeout(200);
    const shown = await page.evaluate(`(() => { gameActive = false; return showNextPuzzleReveal(); })()`);
    await page.waitForTimeout(400);
    const fin = await page.evaluate(`(() => ({
        base: document.getElementById('puzzleCompleteImg').getAttribute('src') || '',
        seams: (document.getElementById('puzzleCompleteSeams').getAttribute('src') || '').slice(0, 11),
        stats: document.getElementById('puzzleCompleteStats').innerText,
        want: PUZZLE_IMAGE_SRCS[1] }))()`);
    await checkAsync('снизу чистая картинка, сверху — она же со швами', async () => {
        assert(shown, 'собранный пазл не показался');
        assert(fin.base.endsWith(fin.want), `снизу ${fin.base}`);
        eq(fin.seams, 'data:image/', 'слой со швами');
    });
    await page.waitForTimeout(2600);
    await checkAsync('швы тают', async () => {
        const r = await page.evaluate(`(() => ({
            melt: document.getElementById('puzzleCompleteArt').classList.contains('melt'),
            opacity: Number(getComputedStyle(document.getElementById('puzzleCompleteSeams')).opacity) }))()`);
        assert(r.melt, 'склейка не началась');
        assert(r.opacity < 0.05, `швы видны: прозрачность ${r.opacity}`);
    });
    await checkAsync('«Пазлов собрано» — за всё время', async () => {
        assert(/Пазлов собрано: 7\b/.test(fin.stats), fin.stats);
    });
    await page.click('#puzzleCompleteArt');
    await page.waitForTimeout(200);
    await checkAsync('собранный пазл тоже открывается на весь экран', async () => {
        const r = await viewer();
        assert(r.open && r.src.endsWith(fin.want), JSON.stringify(r));
    });
    await page.evaluate(`closePicViewer(); closePuzzleModal(); null`);

    console.log('\nОдно название коллекции');
    const names = () => page.evaluate(`(() => ({
        title: document.getElementById('collectionPicsTitle').innerText.trim(),
        live: document.getElementById('btnOpenCollectionLive').innerText.trim(),
        done: document.getElementById('btnViewCollection').innerText.trim(),
        menu: [...document.querySelectorAll('.menu-btn')].map(x => x.innerText.trim()).filter(x => x.indexOf('🧩') === 0),
        body: document.body.innerText }))()`);
    let n = await names();
    await checkAsync('кнопки и заголовок называют коллекцию одинаково', async () => {
        assert(/^🧩 Коллекция пазлов: \d+\/\d+$/.test(n.title), `заголовок «${n.title}»`);
        eq(n.live, '🧩 Коллекция пазлов', 'кнопка в окне пазла');
        eq(n.done, '🧩 Коллекция пазлов', 'кнопка после сборки');
        assert(!/Моя коллекция|Парадоксы математики|🖼️/.test(HTML.replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), 'в разметке осталось старое название');
    });
    await page.evaluate(`setLang('en')`).catch(() => {});
    await page.waitForTimeout(500);
    await boot();
    n = await names();
    await checkAsync('и по-английски тоже одно название', async () => {
        assert(/^🧩 Puzzle collection: \d+\/\d+$/.test(n.title), `заголовок «${n.title}»`);
        eq(n.live, '🧩 Puzzle collection', 'кнопка в окне пазла');
        eq(n.done, '🧩 Puzzle collection', 'кнопка после сборки');
    });
    await page.evaluate(`setLang('ru')`).catch(() => {});
    await page.waitForTimeout(500);
    await boot();

    console.log('\nОтметки коллекции при переходе на сорок картинок');
    await checkAsync('короткий массив дополняется, а не обнуляется', async () => {
        const r = await page.evaluate(`(() => {
            const st = Progress.get();
            st.collections.paradoxes = [true, false, true];
            const a = Progress.getCollection('paradoxes', 5).slice();
            st.collections.paradoxes = [true, false, false, false, false, true];
            const b = Progress.getCollection('paradoxes', 5).slice();
            return { a, b }; })()`);
        eq(JSON.stringify(r.a), JSON.stringify([true, false, true, false, false]), 'после дополнения');
        eq(JSON.stringify(r.b), JSON.stringify([true, false, false, false, false, true]), 'длинный массив');
    });

    await checkAsync('без ошибок на странице', async () => {
        assert(!errors.length, errors.join(' | '));
    });

    await b.close();
    finish();
})().catch(e => { console.error('ошибка теста:', e); process.exit(1); });
