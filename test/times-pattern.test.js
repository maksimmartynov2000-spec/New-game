// Узор в таблице умножения, вид «Как у меня».
//
// Зачем. Клетки там различались только цветом: зелёный — знаю, жёлтый — почти,
// красный — сбиваюсь. Примерно каждый двенадцатый мальчик плохо различает красный
// и зелёный, и для него «знаю» и «сбиваюсь» сливались в одну бурую клетку — ровно
// там, где экран должен сказать, что учить. Теперь у каждой отметки свой узор:
// сбиваюсь — косая штриховка, почти — точки, знаю — гладко. Цвета прежние.
//
// Проверяется по тому, что браузер в самом деле нарисовал (вычисленный стиль), а
// не по тексту CSS: правило можно написать и перебить следующим, тест по тексту
// этого не заметит.
//
// Как запускать:  node test/times-pattern.test.js
// Нужен Playwright и браузер в /opt/pw-browsers/chromium.

const path = require('path');
const ROOT = path.join(__dirname, '..');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* нет — пропускаем */ }

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }

(async () => {
    if (!chromium) {
        console.log('Playwright не установлен — проверка пропущена.');
        console.log('Всего: 0, прошло: 0, упало: 0');
        return;
    }
    console.log('Узор в таблице умножения');
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/rest/v1/rpc/*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200,
        contentType: 'application/javascript', body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto('file://' + path.join(ROOT, 'index.html'));
    await page.waitForFunction(`typeof openTimesScreen === 'function'`);
    // Все три отметки и «ещё не считали» сразу: группы с разной долей верных.
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();
        Progress.switchTo('MASHA', null, { accountType: 'solo' }); enterApp();
        Progress.get().byClass = { 'integer+:mul:2': { triv: [80, 1], small: [70, 12], core: [30, 25] } };
        document.querySelectorAll('.modal-screen').forEach(e => e.style.display = 'none');
        openTimesScreen();
        [...document.querySelectorAll('.times-tab')].find(x => x.dataset.view === 'mine').click(); null`);

    const look = (sel) => page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null; const s = getComputedStyle(el);
        return { image: s.backgroundImage, color: s.backgroundColor, shadow: s.textShadow }; })()`);
    const live = async (name, fn) => { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } };

    const low = await look('#timesGrid .times-a-low');
    const mid = await look('#timesGrid .times-a-mid');
    const high = await look('#timesGrid .times-a-high');
    const none = await look('#timesGrid .times-a-none');

    await live('в таблице есть все отметки — проверять есть что', async () => {
        assert(low && mid && high && none, `нет клеток: ${JSON.stringify({ low: !!low, mid: !!mid, high: !!high, none: !!none })}`);
    });
    await live('«сбиваюсь» — косая штриховка', async () => {
        assert(/repeating-linear-gradient\(135deg/.test(low.image), `узор: ${low.image}`);
    });
    await live('«почти» — точки', async () => {
        assert(/radial-gradient/.test(mid.image), `узор: ${mid.image}`);
    });
    await live('«знаю» и «ещё не считали» — гладкие', async () => {
        assert(high.image === 'none', `у «знаю» узор: ${high.image}`);
        assert(none.image === 'none', `у «ещё не считали» узор: ${none.image}`);
    });
    await live('цвета прежние: красный, янтарный, зелёный', async () => {
        assert(low.color === 'rgb(153, 27, 27)', `«сбиваюсь»: ${low.color}`);
        assert(mid.color === 'rgb(161, 98, 7)', `«почти»: ${mid.color}`);
        assert(high.color === 'rgb(22, 101, 52)', `«знаю»: ${high.color}`);
    });
    await live('цифра поверх узора — с тенью', async () => {
        assert(low.shadow !== 'none' && mid.shadow !== 'none', `тени нет: ${low.shadow} / ${mid.shadow}`);
        assert(high.shadow === 'none', `у гладкой клетки тень не нужна: ${high.shadow}`);
    });
    await live('легенда носит те же узоры', async () => {
        const l = await look('#timesLegend .times-a-low');
        const m = await look('#timesLegend .times-a-mid');
        const h = await look('#timesLegend .times-a-high');
        assert(l && l.image === low.image, `легенда «сбиваюсь»: ${l && l.image}`);
        assert(m && m.image === mid.image, `легенда «почти»: ${m && m.image}`);
        assert(h && h.image === 'none', `легенда «знаю»: ${h && h.image}`);
    });
    await live('в «Приёмах» узора нет: там цвет делит группы, а не оценивает', async () => {
        await page.evaluate(`[...document.querySelectorAll('.times-tab')].find(x => x.dataset.view !== 'mine').click(); null`);
        const any = await page.evaluate(`[...document.querySelectorAll('#timesGrid .times-cell')]
            .some(c => getComputedStyle(c).backgroundImage !== 'none')`);
        assert(!any, 'узор протёк в вид «Приёмы»');
    });
    await live('ошибок на странице нет', async () => { assert(!errs.length, errs.join('; ')); });

    await browser.close();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
