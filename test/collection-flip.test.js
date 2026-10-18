// ЛИСТАТЬ СОБРАННЫЕ ПАЗЛЫ: в карточке коллекции и на весь экран.
//
// Зачем этот файл. Чтобы посмотреть соседний пазл, карточку приходилось закрывать и
// открывать другую, а с полного экрана — ещё и выходить из просмотра. Теперь пазлы
// листаются: стрелками по бокам картинки, свайпом, на компьютере — клавишами ← →, по
// кругу и со счётчиком «3 из 7». Здесь стережётся:
//   • листаются только собранные и ровно в том порядке, что в сетке, по кругу;
//   • карточка меняется целиком: картинка, название, рамка, ответ снова закрыт;
//   • свайп — это заметный сдвиг вбок: прокрутка карточки и короткий сдвиг не листают,
//     а свайп вправо не уводит со страницы (без touch-action телефон принимал его за «назад»);
//   • на весь экран листается вместе с карточкой под ним, приближенную картинку свайп не
//     листает, а двигает; у только что собранного пазла стрелок нет;
//   • один собранный — ни стрелок, ни счётчика.
//
// Касания здесь настоящие, через CDP, а не придуманные события: только так видно, что
// с жестом делает сам браузер. Уход «назад» по свайпу ловится только так.
//
// Как запускать:  node test/collection-flip.test.js

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
    console.log('Playwright не установлен — проверки листания пропущены.');
    finish();
    process.exit(0);
}

// Собраны по ответам: сложение 2★ и 5★, вычитание 1★, умножение 3★, деление 5★.
// Вычитание 3★ — старой отметкой коллекции: она тоже считается собранной. Сложение 3★
// только начато, его листать нельзя.
const SOLVED = { 'integer+:add:2': 100, 'integer+:add:5': 230, 'integer+:sub:1': 300,
                 'integer+:mul:3': 520, 'integer+:div:5': 1000, 'integer+:add:3': 37 };
const MARKS = [7];
const OPEN = [1, 4, 5, 7, 12, 19];
const byTopic = (solved) => Object.fromEntries(Object.entries(solved).map(([k, n]) => [k, { correct: n, wrong: 0 }]));

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
    // Телефон: касания и мобильная разметка, как у ученика с айфоном.
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    // Не дождались кнопки — значит, упала проверка раньше. Пять секунд, а не тридцать:
    // иначе одна поломка тянет за собой минуты ожидания в следующих проверках.
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.route('**/rest/v1/rpc/*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { if (!localStorage.getItem('mathCitadelLang_v1')) localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    const client = await ctx.newCDPSession(page);

    // Открыть приложение, разложить собранное и открыть коллекцию. Сборы — по ответам в
    // клетках и старым отметкам; прямо в Progress, без записи: после перезагрузки заново.
    const setup = async (solved, marks) => {
        if (page.url() !== FILE) await page.goto(FILE);
        await page.waitForFunction(`typeof startGame === 'function' && typeof renderMaintenance === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);
        await page.evaluate(`Progress.switchTo('FLIP1', null, { accountType: 'self' }); enterApp(); null`);
        await page.evaluate(`(() => {
            const st = Progress.get();
            st.byTopic = ${JSON.stringify(byTopic(solved))};
            const m = new Array(PUZZLE_IMAGE_SRCS.length).fill(false);
            ${JSON.stringify(marks)}.forEach(i => { m[i] = true; });
            st.collections.paradoxes = m;
            openCollectionModal(); return null; })()`);
        await page.waitForTimeout(200);
    };

    // Что на экране: какой пазл в карточке и на весь экран (по картинке), счётчики, стрелки.
    const look = () => page.evaluate(`(() => {
        const at = (id) => { const s = document.getElementById(id).getAttribute('src') || '';
                             return PUZZLE_IMAGE_SRCS.findIndex((x, i) => s === puzzleSrc(i)); };
        // Видно ли на экране — по стилю и размеру, а не по атрибуту hidden: атрибут без
        // своего правила в стилях кнопку не прячет.
        const shown = (id) => { const el = document.getElementById(id);
                                return getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0; };
        const modal = document.getElementById('collectionModal');
        return {
            detail: modal.classList.contains('active') && getComputedStyle(document.getElementById('collectionDetail')).display !== 'none',
            list: getComputedStyle(document.getElementById('collectionListView')).display !== 'none',
            idx: at('detailImg'), name: document.getElementById('detailName').innerText,
            count: shown('detailCount') ? document.getElementById('detailCount').innerText : null,
            arrows: [shown('detailPrev'), shown('detailNext')],
            viewer: !document.getElementById('picViewer').hidden, vidx: at('picViewerImg'),
            vcount: shown('picViewerCount') ? document.getElementById('picViewerCount').innerText : null,
            varrows: [shown('picViewerPrev'), shown('picViewerNext')],
            k: picView.k, scroll: modal.scrollTop, url: location.href }; })()`);
    const want = (idx, total) => `${OPEN.indexOf(idx) + 1} из ${total || OPEN.length}`;
    const nameOf = (idx) => page.evaluate(`resolveParadoxes()[${idx}].name`);
    const center = (sel) => page.evaluate(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);

    // Настоящий палец: восемь шагов по 16 мс, как на телефоне.
    const swipe = async (x0, y0, x1, y1) => {
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
        for (let i = 1; i <= 8; i++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove',
                touchPoints: [{ x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8 }] });
            await page.waitForTimeout(16);
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(250);
    };
    const swipeTwo = async (x0, y0, x1) => {
        const pts = (x) => [{ x, y: y0, id: 1 }, { x, y: y0 + 80, id: 2 }];
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(x0) });
        for (let i = 1; i <= 8; i++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(x0 + (x1 - x0) * i / 8) });
            await page.waitForTimeout(16);
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(250);
    };
    const doubleTap = async (x, y) => {
        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(80);
        await page.touchscreen.tap(x, y);
        await page.waitForTimeout(200);
    };
    const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(120); };
    const click = async (sel) => { await page.click(sel); await page.waitForTimeout(150); };

    await page.goto(FILE);
    await setup(SOLVED, MARKS);

    console.log('\nЛистаются собранные — в порядке сетки и по кругу');
    let s;
    await checkAsync('собранные в сетке — ровно те, что задуманы (иначе проверять нечего)', async () => {
        const tiles = await page.evaluate(`[...document.querySelectorAll('#collectionGroups .collection-item.unlocked img')]
            .map(img => PUZZLE_IMAGE_SRCS.findIndex((x, i) => img.getAttribute('src') === puzzleThumbSrc(i)))`);
        eq(tiles.join(','), OPEN.join(','), 'собранные плитки по порядку');
    });
    await click('#collectionGroups .collection-item.unlocked');
    await checkAsync('карточка первого собранного — со стрелками и счётчиком «1 из 6»', async () => {
        s = await look();
        assert(s.detail, 'карточка не открылась');
        eq(s.idx, OPEN[0], 'пазл в карточке');
        eq(s.count, want(OPEN[0]), 'счётчик');
        eq(s.arrows.join(','), 'true,true', 'стрелки ‹ ›');
    });
    await checkAsync('стрелка › проходит все собранные по порядку сетки и возвращается к первому', async () => {
        const seen = [], counts = [];
        for (let n = 0; n < OPEN.length; n++) {
            await click('#detailNext');
            s = await look();
            seen.push(s.idx);
            counts.push(s.count);
        }
        eq(seen.join(','), OPEN.slice(1).concat(OPEN[0]).join(','), 'порядок листания');
        eq(counts.join(' | '), OPEN.slice(1).concat(OPEN[0]).map(i => want(i)).join(' | '), 'счётчик на каждом шаге');
    });
    await checkAsync('стрелка ‹ с первого — на последний, › с последнего — на первый', async () => {
        await click('#detailPrev');
        s = await look();
        eq(s.idx, OPEN[OPEN.length - 1], 'после ‹ с первого');
        eq(s.count, want(OPEN[OPEN.length - 1]), 'счётчик');
        await click('#detailNext');
        eq((await look()).idx, OPEN[0], 'после › с последнего');
    });
    await checkAsync('карточка меняется целиком: картинка, название, рамка, полоска, ответ снова закрыт', async () => {
        await click('#detailProbe');
        eq(await page.evaluate(`document.querySelector('#detailProbe .paradox-probe-a').hidden`), false, 'ответ открыт перед листанием');
        await click('#detailNext');
        const r = await page.evaluate(`(() => ({
            frame: [...document.getElementById('detailImg').classList].filter(c => c.indexOf('pz-frame-') === 0).join(' '),
            current: document.querySelector('#detailFrameLadder .frame-step.current .frame-n').innerText,
            answerHidden: document.querySelector('#detailProbe .paradox-probe-a').hidden }))()`);
        s = await look();
        eq(s.idx, 4, 'пазл');
        eq(s.name, await nameOf(4), 'название');
        eq(r.frame, 'pz-frame-diamond', 'рамка за два сбора');
        eq(r.current, '×2', 'текущая ступень полоски');
        eq(r.answerHidden, true, 'ответ прежней карточки остался открытым');
    });

    console.log('\nСтрелки и счётчик на своих местах');
    await checkAsync('стрелки — по бокам картинки, посередине по высоте, не мельче 44×44', async () => {
        const g = await page.evaluate(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
            const box = (b) => ({ l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, cy: b.top + b.height / 2 });
            return { img: box(r('detailImg')), prev: box(r('detailPrev')), next: box(r('detailNext')) }; })()`);
        [['‹', g.prev], ['›', g.next]].forEach(([n, a]) => {
            assert(a.w >= 44 && a.h >= 44, `стрелка ${n} ${Math.round(a.w)}×${Math.round(a.h)}`);
            assert(Math.abs(a.cy - g.img.cy) <= 2, `стрелка ${n} не посередине картинки: ${Math.round(a.cy)} против ${Math.round(g.img.cy)}`);
            assert(a.t >= g.img.t && a.b <= g.img.b, `стрелка ${n} вылезает за картинку по высоте`);
        });
        assert(g.prev.l >= g.img.l && g.prev.r <= g.img.l + g.img.w / 4, `‹ не у левого края: ${JSON.stringify(g.prev)}`);
        assert(g.next.r <= g.img.r && g.next.l >= g.img.r - g.img.w / 4, `› не у правого края: ${JSON.stringify(g.next)}`);
    });
    await checkAsync('счётчик — над картинкой по центру и не наезжает на крестик окна', async () => {
        const g = await page.evaluate(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
            const c = r('detailCount'), x = r('collectionCloseBtn'), img = r('detailImg');
            return { overlap: !(c.right <= x.left || c.left >= x.right || c.bottom <= x.top || c.top >= x.bottom),
                     above: c.bottom <= img.top, mid: Math.abs((c.left + c.right) / 2 - (img.left + img.right) / 2) }; })()`);
        assert(!g.overlap, 'счётчик лежит на крестике');
        assert(g.above, 'счётчик наезжает на картинку');
        assert(g.mid <= 2, `счётчик не по центру: смещение ${g.mid}`);
    });

    console.log('\nСвайп по карточке');
    const img = await center('#detailImg');
    await checkAsync('свайп влево по тексту — следующий пазл', async () => {
        const body = await center('#detailBody');
        await swipe(320, body.y, 120, body.y + 8);
        s = await look();
        eq(s.idx, 5, 'пазл после свайпа влево');
        eq(s.count, want(5), 'счётчик');
    });
    await checkAsync('свайп вправо по картинке — предыдущий, и со страницы он не уводит', async () => {
        await swipe(80, img.y, 300, img.y + 6);
        const url = page.url();
        // Ушли «назад» — дальше проверять не на чем: возвращаемся, чтобы остальное шло своим чередом.
        if (url !== FILE) { await setup(SOLVED, MARKS); await click('#collectionGroups .collection-item.unlocked >> nth=1'); }
        eq(url, FILE, 'страница после свайпа вправо');
        eq((await look()).idx, 4, 'пазл после свайпа вправо');
    });
    await checkAsync('прокрутка карточки вверх-вниз не листает', async () => {
        await swipe(200, 700, 214, 300);
        s = await look();
        eq(s.idx, 4, 'пазл после прокрутки');
        assert(s.scroll > 40, `окно не прокрутилось: ${s.scroll}`);
    });
    await checkAsync('после листания карточка снова с картинки, а не с середины текста', async () => {
        assert((await look()).scroll > 40, 'перед свайпом окно не прокручено — проверять нечего');
        await swipe(320, 500, 120, 508);
        s = await look();
        eq(s.idx, 5, 'пазл после свайпа');
        eq(s.scroll, 0, 'прокрутка');
    });
    await checkAsync('короткий сдвиг и косой, больше вниз, чем вбок, — не листают', async () => {
        await swipe(250, img.y, 215, img.y + 4);
        eq((await look()).idx, 5, 'после сдвига на 35 точек');
        await page.evaluate(`document.getElementById('collectionModal').scrollTop = 0; null`);
        await swipe(300, 700, 220, 580);
        eq((await look()).idx, 5, 'после косого жеста 80 вбок и 120 вверх');
    });
    await checkAsync('двумя пальцами — не свайп', async () => {
        await page.evaluate(`document.getElementById('collectionModal').scrollTop = 0; null`);
        await swipeTwo(320, 500, 120);
        eq((await look()).idx, 5, 'после жеста двумя пальцами');
    });
    await checkAsync('палец ведёт по карточке, а второй лежит рядом, за её краем, — тоже не свайп', async () => {
        // Второй палец — на поле окна слева от карточки: его касание до карточки не доходит,
        // и видно его только в списке пальцев, когда первый отрывается.
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y: 500, id: 1 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove',
            touchPoints: [{ x: 320, y: 500, id: 1 }, { x: 6, y: 400, id: 2 }] });
        for (let i = 1; i <= 8; i++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove',
                touchPoints: [{ x: 320 - 25 * i, y: 500, id: 1 }, { x: 6, y: 400, id: 2 }] });
            await page.waitForTimeout(16);
        }
        // Первый палец отрывается, второй ещё лежит.
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 6, y: 400, id: 2 }] });
        await page.waitForTimeout(150);
        const mid = (await look()).idx;
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(250);
        eq(mid, 5, 'когда отпустили первый палец');
        eq((await look()).idx, 5, 'когда отпустили оба');
    });
    await checkAsync('два пальца, отпущенные разом, — не свайп, а один такой же — свайп', async () => {
        // Отрыв двух пальцев одним событием CDP не делает: Chrome сам делит его на два.
        // Другой браузер может прислать его и одним — здесь он смоделирован. Тот же жест
        // одним пальцем обязан листать: иначе проверка молчала бы и при неработающей модели.
        const fake = (fingers) => page.evaluate(`(() => {
            const el = document.getElementById('detailBody');
            const at = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
            const fire = (type, touches, changed) => el.dispatchEvent(new TouchEvent(type,
                { touches, targetTouches: touches, changedTouches: changed, bubbles: true, cancelable: true }));
            const a0 = at(1, 320, 500), a1 = at(1, 120, 505), b0 = at(2, 320, 580), b1 = at(2, 120, 585);
            fire('touchstart', [a0], [a0]);
            if (${fingers} === 2) fire('touchstart', [a0, b0], [b0]);
            fire('touchmove', ${fingers} === 2 ? [a1, b1] : [a1], ${fingers} === 2 ? [a1, b1] : [a1]);
            fire('touchend', [], ${fingers} === 2 ? [a1, b1] : [a1]);
            return null; })()`);
        await fake(1);
        eq((await look()).idx, 7, 'после такого же жеста одним пальцем');
        await click('#detailPrev');
        eq((await look()).idx, 5, 'вернулись');
        await fake(2);
        eq((await look()).idx, 5, 'после двух пальцев, отпущенных разом');
    });

    console.log('\nКлавиши в карточке');
    await checkAsync('→ — следующий, ← — предыдущий', async () => {
        await key('ArrowRight');
        eq((await look()).idx, 7, 'после →');
        await key('ArrowLeft');
        await key('ArrowLeft');
        eq((await look()).idx, 4, 'после ← ←');
    });
    await checkAsync('с Alt, Ctrl, Cmd и Shift стрелки — браузеру, не листают', async () => {
        for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
            await page.evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown',
                { key: 'ArrowRight', ${mod}: true, bubbles: true, cancelable: true })); null`);
            eq((await look()).idx, 4, `после ${mod} + →`);
        }
    });
    await checkAsync('в поле ввода стрелки двигают курсор, а не листают', async () => {
        await page.evaluate(`(() => { const inp = document.createElement('input'); inp.id = 'flipProbeInput';
            document.getElementById('collectionDetail').appendChild(inp); inp.focus(); return null; })()`);
        await key('ArrowRight');
        await page.evaluate(`document.getElementById('flipProbeInput').remove(); null`);
        eq((await look()).idx, 4, 'после → в поле ввода');
    });

    console.log('\nНа весь экран');
    // Окно могло остаться прокрученным, если упала проверка выше: картинку ищем заново.
    await page.evaluate(`document.getElementById('collectionModal').scrollTop = 0; null`);
    const pic = await center('#detailImg');
    await page.touchscreen.tap(pic.x, pic.y);
    await page.waitForTimeout(250);
    await checkAsync('нажатие на картинку по-прежнему открывает её на весь экран — со стрелками и тем же счётчиком', async () => {
        s = await look();
        assert(s.viewer, 'просмотр не открылся');
        eq(s.vidx, 4, 'пазл на весь экран');
        eq(s.vcount, want(4), 'счётчик на весь экран');
        eq(s.varrows.join(','), 'true,true', 'стрелки на весь экран');
    });
    await checkAsync('стрелки на весь экран — по бокам, не мельче 44×44 и не на крестике; счётчик тоже не на нём', async () => {
        const g = await page.evaluate(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
            const hit = (a, x) => !(a.right <= x.left || a.left >= x.right || a.bottom <= x.top || a.top >= x.bottom);
            const p = r('picViewerPrev'), n = r('picViewerNext'), c = r('picViewerCount'), x = r('picViewerClose');
            return { p: [p.width, p.height, p.left, p.top + p.height / 2], n: [n.width, n.height, innerWidth - n.right, n.top + n.height / 2],
                     mid: innerHeight / 2, hit: hit(p, x) || hit(n, x) || hit(c, x) }; })()`);
        [['‹', g.p], ['›', g.n]].forEach(([name, [w, h, edge, cy]]) => {
            assert(w >= 44 && h >= 44, `стрелка ${name} ${Math.round(w)}×${Math.round(h)}`);
            assert(edge <= 24, `стрелка ${name} далеко от края: ${Math.round(edge)}`);
            assert(Math.abs(cy - g.mid) <= 2, `стрелка ${name} не посередине экрана`);
        });
        assert(!g.hit, 'стрелка или счётчик лежит на крестике');
    });
    await checkAsync('стрелка листает и картинку, и карточку под ней; приближение сбрасывается', async () => {
        await doubleTap(195, 422);
        assert((await look()).k > 2, 'двойное касание не приблизило — проверять сброс не на чем');
        await click('#picViewerNext');
        s = await look();
        eq(s.vidx, 5, 'пазл на весь экран');
        eq(s.idx, 5, 'пазл в карточке под ним');
        eq(s.vcount, want(5), 'счётчик на весь экран');
        eq(s.count, want(5), 'счётчик в карточке');
        eq(s.k, 1, 'увеличение');
    });
    await checkAsync('свайп по неприближенной картинке листает в обе стороны', async () => {
        await swipe(320, 430, 100, 440);
        s = await look();
        eq(s.vidx, 7, 'после свайпа влево');
        eq(s.idx, 7, 'карточка под ним');
        await swipe(100, 430, 320, 436);
        eq((await look()).vidx, 5, 'после свайпа вправо');
        assert((await look()).viewer, 'просмотр закрылся');
    });
    await checkAsync('приближенную свайп не листает — двигает', async () => {
        await doubleTap(195, 422);
        const before = await look();
        assert(before.k > 2, `не приблизилось: ${before.k}`);
        await swipe(320, 430, 100, 440);
        s = await look();
        eq(s.vidx, 5, 'пазл после свайпа по приближенной');
        assert(s.k > 2, `увеличение сбросилось: ${s.k}`);
        await doubleTap(195, 422);
        eq((await look()).k, 1, 'второе двойное касание не вернуло картинку целиком');
    });
    await checkAsync('вертикальный жест и короткий сдвиг на весь экран не листают', async () => {
        await swipe(200, 650, 215, 250);
        eq((await look()).vidx, 5, 'после жеста вверх');
        await swipe(240, 430, 205, 432);
        eq((await look()).vidx, 5, 'после сдвига на 35 точек');
    });
    await checkAsync('клавиши листают и на весь экран', async () => {
        await key('ArrowRight');
        eq((await look()).vidx, 7, 'после →');
        await key('ArrowRight');
        s = await look();
        eq(s.vidx, 12, 'после → →');
        eq(s.idx, 12, 'карточка под ним');
    });
    await checkAsync('Escape закрывает просмотр, и под ним тот же пазл, что листали', async () => {
        await key('Escape');
        s = await look();
        assert(!s.viewer, 'просмотр не закрылся');
        assert(s.detail, 'карточка пропала');
        eq(s.idx, 12, 'пазл в карточке');
        eq(s.count, want(12), 'счётчик');
        eq(s.name, await nameOf(12), 'название');
    });

    console.log('\nГде листать нечего');
    await checkAsync('из сетки клавиши ничего не открывают', async () => {
        await click('#btnDetailBack');
        await key('ArrowRight');
        s = await look();
        assert(!s.detail && s.list, `после → в сетке: карточка ${s.detail}, сетка ${s.list}`);
    });
    await checkAsync('у только что собранного пазла на весь экран стрелок нет, и клавиши со свайпом не листают', async () => {
        await page.evaluate(`closeCollectionModal(); puzzleRevealSrc = puzzleSrc(12);
            document.getElementById('puzzleCompleteArt').click(); null`);
        await page.waitForTimeout(200);
        try {
            s = await look();
            assert(s.viewer, 'просмотр не открылся');
            eq(s.vidx, 12, 'пазл на весь экран');
            eq(s.varrows.join(','), 'false,false', 'стрелки');
            eq(s.vcount, null, 'счётчик');
            await key('ArrowRight');
            await swipe(320, 430, 100, 440);
            s = await look();
            eq(s.vidx, 12, 'пазл после → и свайпа');
            eq(s.idx, 12, 'спрятанная карточка коллекции после → и свайпа');
        } finally {
            // Просмотр поверх всего: не закрыть его — и следующие проверки не нажмут ни одной кнопки.
            await page.evaluate(`closePicViewer(); null`);
        }
    });
    await checkAsync('коллекцию закрыли прямо из карточки — клавиши ничего не трогают', async () => {
        await page.evaluate(`openCollectionModal(); null`);
        await click('#collectionGroups .collection-item.unlocked >> nth=2');
        eq((await look()).idx, 5, 'открытая карточка');
        await click('#collectionCloseBtn');
        await key('ArrowRight');
        s = await look();
        assert(!s.viewer && !s.detail, `после → открылось: просмотр ${s.viewer}, карточка ${s.detail}`);
        eq(s.idx, 5, 'пазл в спрятанной карточке');
    });
    await checkAsync('один собранный — ни стрелок, ни счётчика, листать нечем', async () => {
        await setup({ 'integer+:add:2': 100 }, []);
        await click('#collectionGroups .collection-item.unlocked');
        s = await look();
        eq(s.idx, 1, 'пазл');
        eq(s.arrows.join(','), 'false,false', 'стрелки');
        eq(s.count, null, 'счётчик');
        await key('ArrowRight');
        await swipe(320, img.y, 100, img.y + 6);
        eq((await look()).idx, 1, 'пазл после → и свайпа');
        await page.touchscreen.tap(img.x, img.y);
        await page.waitForTimeout(250);
        try {
            s = await look();
            assert(s.viewer, 'просмотр не открылся');
            eq(s.varrows.join(','), 'false,false', 'стрелки на весь экран');
            eq(s.vcount, null, 'счётчик на весь экран');
        } finally {
            await page.evaluate(`closePicViewer(); null`);
        }
    });

    console.log('\nПо-английски');
    await page.evaluate(`setLang('en')`).catch(() => {});
    await page.waitForTimeout(500);
    await setup(SOLVED, MARKS);
    await click('#collectionGroups .collection-item.unlocked >> nth=1');
    await checkAsync('счётчик «2 of 6», подписи стрелок переведены', async () => {
        const r = await page.evaluate(`({ count: document.getElementById('detailCount').innerText,
            labels: ['detailPrev', 'detailNext', 'picViewerPrev', 'picViewerNext']
                .map(id => document.getElementById(id).getAttribute('aria-label')) })`);
        eq(r.count, '2 of 6', 'счётчик');
        eq(r.labels.join(' | '), 'Previous puzzle | Next puzzle | Previous puzzle | Next puzzle', 'подписи стрелок');
    });
    await page.evaluate(`setLang('ru')`).catch(() => {});
    await page.waitForTimeout(300);

    await checkAsync('ошибок на странице нет', async () => {
        assert(errors.length === 0, errors.slice(0, 3).join(' | '));
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
