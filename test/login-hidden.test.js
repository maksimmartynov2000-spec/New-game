// Тесты спрятанного логина.
//
// Логин — половина ключа от аккаунта: зная его, остаётся подобрать пароль. Раньше он
// крупно висел в профиле и в меню игры, и его было видно через плечо. У ученика там
// же стоял логин репетитора — а через аккаунт репетитора открываются все ученики.
// Теперь вместо логинов точки, показать — по нажатию, и при новом открытии экрана
// они снова спрятаны.
//
// Проверяется по тексту экрана целиком, а не по одному полю: спрятать логин в
// карточке и оставить его строкой ниже — то же самое, что не прятать.
//
// Как запускать:  node test/login-hidden.test.js
// Живая часть нужна Playwright и браузер в /opt/pw-browsers/chromium.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
function check(name, fn) {
    try { fn(); record(name, null); } catch (e) { record(name, e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }

console.log('Точки вместо логина');

check('точек всегда одинаково, какой бы длины ни был логин', () => {
    const at = HTML.indexOf('const LOGIN_MASK');
    const end = HTML.indexOf('\n        // Одна кнопка на экран', at);
    assert(at >= 0 && end > at, 'срез с LOGIN_MASK не найден');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(HTML.slice(at, end).replace('let loginsShown', 'var loginsShown')
        + ';globalThis.shown = shownLogin; globalThis.set = (v) => { loginsShown = v; };', ctx);
    const a = ctx.shown('AB'), b = ctx.shown('VERYLONGLOGIN2015');
    assert(a === b, `длина маски выдаёт длину логина: «${a}» и «${b}»`);
    assert(!/[A-Za-z0-9]/.test(a), `в маске видны знаки логина: «${a}»`);
    ctx.set(true);
    assert(ctx.shown('MASHA') === 'MASHA', 'после «показать» логин не показался');
});

(async () => {
    let chromium = null;
    try { ({ chromium } = require('playwright')); } catch (e) { /* нет — пропускаем */ }
    if (!chromium) {
        console.log('\nPlaywright не установлен — живой прогон пропущен.');
        return finish();
    }
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const open = async (setup, remote) => {
        const page = await browser.newPage();
        page.errs = [];
        page.on('pageerror', e => page.errs.push(e.message));
        await page.route('**/rest/v1/rpc/*', r => {
            const fn = r.request().url().split('/rpc/')[1];
            const body = fn === 'session_state' ? { ok: true, state: remote || {} } : { ok: true };
            return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200,
            contentType: 'application/javascript', body: 'window.MAINTENANCE={until:null,note:null};' }));
        await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
        await page.goto('file://' + path.join(ROOT, 'index.html'));
        await page.waitForFunction(`typeof toggleLoginsShown === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); ${setup} enterApp(); null`);
        return page;
    };
    const live = async (name, fn) => {
        try { await fn(); record(name, null); } catch (e) { record(name, e.message); }
    };
    const text = (page, sel) => page.evaluate(`document.querySelector(${JSON.stringify(sel)}).innerText`);

    console.log('\nПрофиль ученика');
    const pupil = await open(`
        Progress.switchTo('PETYA2014', null, { accountType: 'linked', ownerCode: 'MAKSIM', profileLabel: 'Петя' });
        Progress.switchTo('MASHA2015', null, { accountType: 'linked', ownerCode: 'MAKSIM' });`);
    const openProfile = () => pupil.evaluate(`document.querySelectorAll('.modal-screen').forEach(e => e.style.display = 'none');
        openProfileScreen(); document.querySelectorAll('#profileScreen .config-section[data-fold]').forEach(f => f.classList.remove('folded')); null`);
    await openProfile();
    await live('на экране профиля нет ни своего логина, ни чужих', async () => {
        const all = await text(pupil, '#profileScreen');
        ['MASHA2015', 'PETYA2014'].forEach(code => assert(!all.includes(code), `виден логин ${code}`));
    });
    await live('логина репетитора у ученика не видно', async () => {
        const all = await text(pupil, '#profileScreen');
        assert(!all.includes('MAKSIM'), 'логин репетитора виден без «показать»');
        assert(/Ученик/.test(await text(pupil, '#profileTypeVal')), 'пропало, что это аккаунт ученика');
    });
    await live('«показать» открывает все логины на экране', async () => {
        await pupil.evaluate(`document.getElementById('profileLoginToggle').click(); null`);
        const all = await text(pupil, '#profileScreen');
        ['MASHA2015', 'PETYA2014', 'MAKSIM'].forEach(code => assert(all.includes(code), `после «показать» не виден ${code}`));
        assert(/Спрятать/.test(await text(pupil, '#profileLoginToggle')), 'кнопка не стала «спрятать»');
    });
    await live('«спрятать» прячет обратно', async () => {
        await pupil.evaluate(`document.getElementById('profileLoginToggle').click(); null`);
        const all = await text(pupil, '#profileScreen');
        ['MASHA2015', 'PETYA2014', 'MAKSIM'].forEach(code => assert(!all.includes(code), `после «спрятать» виден ${code}`));
    });
    await live('открыли профиль заново — снова спрятано', async () => {
        await pupil.evaluate(`document.getElementById('profileLoginToggle').click(); closeProfileScreen(); null`);
        await openProfile();
        const all = await text(pupil, '#profileScreen');
        assert(!all.includes('MASHA2015'), 'забытое «показать» дожило до следующего открытия');
    });
    await live('скопировать логин: в подтверждении логина нет', async () => {
        await pupil.evaluate(`navigator.clipboard.writeText = async () => {}; null`);
        // Кнопка копирования — у самостоятельного аккаунта; функцию зовём напрямую.
        await pupil.evaluate(`copyOwnCode()`);
        await pupil.waitForTimeout(100);
        const toast = await text(pupil, '#toastWrap');
        assert(/скопирован/i.test(toast), `подтверждения нет: «${toast}»`);
        assert(!toast.includes('MASHA2015'), `в подтверждении виден логин: «${toast}»`);
    });

    console.log('\nМеню игры');
    const menu = () => pupil.evaluate(`(() => { const c = document.getElementById('menuCodeVal').closest('.menu-stat-card'); return c.innerText; })()`);
    await pupil.evaluate(`closeProfileScreen(); openMainMenu(); null`);
    await live('в меню игры логин спрятан', async () => {
        assert(!(await menu()).includes('MASHA2015'), 'логин виден в меню игры');
    });
    await live('в меню игры «показать» работает', async () => {
        await pupil.evaluate(`document.getElementById('menuLoginToggle').click(); null`);
        assert((await menu()).includes('MASHA2015'), 'после «показать» логина нет');
    });
    await live('меню открыли заново — снова спрятано', async () => {
        await pupil.evaluate(`closeMainMenu(); openMainMenu(); null`);
        assert(!(await menu()).includes('MASHA2015'), 'забытое «показать» дожило до следующего открытия');
    });
    await live('ошибок на странице нет', async () => {
        assert(!pupil.errs.length, pupil.errs.join('; '));
    });
    await pupil.close();

    console.log('\nГость');
    const guest = await open(`Progress.startGuest();`);
    await live('в меню игры гостю не показан служебный код', async () => {
        await guest.evaluate(`openMainMenu(); null`);
        const m = await guest.evaluate(`document.getElementById('menuCodeVal').closest('.menu-stat-card').innerText`);
        assert(!m.includes('guest'), `гостю виден служебный код: «${m}»`);
        assert(!/другом устройстве/.test(m), `гостю обещают вход на другом устройстве: «${m}»`);
        const btn = await guest.evaluate(`document.getElementById('menuLoginToggle').hidden`);
        assert(btn, 'гостю показана кнопка «показать» — показывать нечего');
    });
    await live('в окне пазла у гостя нет кнопки «Мой логин», и панель не открывается', async () => {
        await guest.evaluate(`closeMainMenu(); openPuzzleModal(); null`);
        const shown = await guest.evaluate(`getComputedStyle(document.getElementById('btnShowMyCode')).display`);
        assert(shown === 'none', 'кнопка «Мой логин» видна гостю');
        await guest.evaluate(`openMyCodePanel(); null`);
        const val = await guest.evaluate(`document.getElementById('myCodeValue').innerText`);
        assert(!val.includes('guest'), `панель показала служебный код: «${val}»`);
    });
    await live('ошибок на странице нет', async () => {
        assert(!guest.errs.length, guest.errs.join('; '));
    });
    await guest.close();
    await browser.close();
    finish();
})();

function finish() {
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
}
