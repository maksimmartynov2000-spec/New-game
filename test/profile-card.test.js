// ВИЗИТКА В ПРОФИЛЕ: кто это, одним взглядом. В живом браузере.
//
// Раньше «Текущий аккаунт» начинался с логина точками, имя стояло полем ввода с
// кнопкой «Сохранить имя» (она сохраняла и то, что не менялось), а «Выйти» жила
// посреди раздела. Теперь сверху визитка — кружок с буквой, имя с карандашом,
// роль и три числа, — логин отдельной строкой с 👁 и 📋, выход тихо внизу экрана.
//
// Здесь проверяется то, что легко соврать молча:
//   - три числа визитки совпадают с теми же числами на других экранах
//     (серия — со стартовым, звёзды — со сводкой достижений);
//   - «Сохранить» появляется, только когда имя правда изменилось;
//   - буква и цвет кружка не скачут от перерисовки к перерисовке;
//   - гостю строки логина нет, а выход стоит последним, вне рамки.
//
// Как запускать:  node test/profile-card.test.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function check(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
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
    console.log('Playwright не установлен — живые проверки визитки пропущены.');
    finish();
    process.exit(0);
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    // who — кем сервер считает аккаунт. Без этого чтение состояния с сервера на
    // медленной машине успевало сделать ученика «самостоятельным»: у настоящего
    // сервера тип аккаунта в состоянии есть всегда.
    const server = { access: {}, who: {} };
    await page.route('**/rest/v1/rpc/*', r => {
        const fn = r.request().url().split('/rpc/')[1];
        let body = { ok: true };
        if (fn === 'session_state') body = { ok: true, state: Object.assign({ schema: 2, playerCode: 'X', updatedAt: 0 }, server.who) };
        if (fn === 'session_my_access') body = { ok: true, access: server.access };
        if (fn === 'session_my_homework') body = { ok: true, homework: [] };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof renderProfileScreen === 'function' && typeof renderMaintenance === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);

    const as = async (code, type, label) => {
        server.who = type === 'linked' ? { accountType: 'linked', ownerCode: 'TUT' } : {};
        await page.evaluate(`(() => {
            Progress.switchTo(${JSON.stringify(code)}, null, { accountType: ${JSON.stringify(type)},
                                                              ownerCode: ${JSON.stringify(type === 'linked' ? 'TUT' : null)},
                                                              profileLabel: ${JSON.stringify(label || '')} });
            Progress.setToken(${JSON.stringify(code)}, 'tok-' + ${JSON.stringify(code)}); enterApp(); return null; })()`);
        if (type === 'linked') await page.evaluate(`refreshAccess().then(() => null)`);
    };
    const openProfile = () => page.evaluate(`(() => {
        document.querySelectorAll('.modal-screen').forEach(x => x.style.display = 'none');
        openProfileScreen(); return null; })()`);
    const view = () => page.evaluate(`(() => {
        const $ = (id) => document.getElementById(id);
        const shown = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
        return {
            name: $('profileNameVal').innerText,
            nameEmpty: $('profileNameVal').classList.contains('empty'),
            avatar: $('profileAvatar').innerText,
            avatarBg: $('profileAvatar').style.background,
            role: $('profileTypeVal').innerText,
            stats: [...$('profileStats').children].map(c => [c.querySelector('b').innerText, c.querySelector('span').innerText]),
            subtitle: $('profileSubtitle').innerText,
            editOpen: shown($('profileNameEdit')),
            saveShown: shown($('profileNameSave')),
            input: $('profileLabelInput').value,
            loginRow: shown($('profileLoginRow')),
            copy: shown($('profileCopyBtn')),
            chips: [...$('accessSummary').children].map(c => (c.className ? '[' + c.innerText + ']' : c.innerText)),
            logoutParent: $('btnLogout').parentElement.id,
            logoutLast: $('profileScreen').lastElementChild === $('btnLogout'),
            logoutQuiet: $('btnLogout').classList.contains('quiet')
        };
    })()`);

    console.log('\nВизитка');
    await as('PCARD1', 'self', 'Маша');
    // Серия: сегодня и вчера — живая серия 2; неделю назад была серия длиннее, 3 дня,
    // чтобы живую нельзя было спутать с самой длинной. Звёзды: две пройденные звезды.
    // Верных за всё время — 123.
    await page.evaluate(`(() => {
        const st = Progress.get();
        const day = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return Progress.dayKey(d); };
        [0, 1, 7, 8, 9].forEach(o => { st.daily[day(o)] = { c: 5, w: 1, s: 60, p: 0, ms: 0, mc: 0, t: {}, e: {}, te: {} }; });
        st.totals.correct = 123;
        ['integer+:add:1', 'integer+:sub:1'].forEach(k => { Progress.unlock(k + ':a3'); Progress.unlock(k + ':c3'); });
        Progress.unlock('integer+:mul:1:a3');   // одна точность без количества — звезды нет
        return null; })()`);
    await openProfile();
    let v = await view();
    await check('имя и буква в кружке', () => {
        eq(v.name, 'Маша', 'имя');
        eq(v.avatar, 'М', 'буква');
        assert(!v.nameEmpty, 'имя помечено пустым');
    });
    await check('подзаголовок больше не повторяет имя', () => {
        eq(v.subtitle, 'Управление аккаунтом', 'подзаголовок');
    });
    const truth = await page.evaluate(`(() => {
        renderAchievementsScreen();
        const sub = document.getElementById('achievementsSubtitle').innerText;
        return { streak: currentStreak(Progress.get().daily, Progress.dayKey()),
                 achStars: Number((sub.match(/Звёзд взято: (\\d+)/) || [])[1]) };
    })()`);
    await check('серия — та же, что на стартовом экране', () => {
        eq(truth.streak, 2, 'серия в подготовленных данных');
        eq(v.stats[0][0], '🔥 2', 'серия в визитке');
        eq(v.stats[0][1], 'дня подряд', 'подпись серии склоняется');
    });
    await check('звёзды — столько же, сколько в сводке достижений', () => {
        eq(truth.achStars, 2, 'звёзды на экране достижений');
        eq(v.stats[1][0], '⭐ 2', 'звёзды в визитке');
        eq(v.stats[1][1], 'звезды', 'подпись звёзд склоняется');
    });
    await check('верных за всё время', () => {
        eq(v.stats[2][0], '✅ 123', 'верные');
        eq(v.stats[2][1], 'решено верно', 'подпись');
    });
    const bg1 = v.avatarBg;
    const again = [];
    for (let i = 0; i < 4; i++) { await openProfile(); again.push((await view()).avatarBg); }
    v = await view();
    await check('цвет кружка не скачет от перерисовки', () => {
        assert(bg1 && /gradient/.test(bg1), `кружок без цвета: ${bg1}`);
        assert(again.every(x => x === bg1), `цвет менялся: ${[bg1].concat(again).join(' | ')}`);
    });

    console.log('\nИмя по карандашу');
    await check('поле имени закрыто, пока не нажали карандаш', () => {
        assert(!v.editOpen, 'поле имени открыто без спроса');
    });
    await page.click('#profileEditBtn');
    v = await view();
    await check('карандаш открывает поле с текущим именем, «Сохранить» не видна', () => {
        assert(v.editOpen, 'поле не открылось');
        eq(v.input, 'Маша', 'в поле');
        assert(!v.saveShown, '«Сохранить» видна, хотя менять нечего');
    });
    await page.fill('#profileLabelInput', '  Маша  ');
    v = await view();
    await check('пробелы по краям — не изменение', () => {
        assert(!v.saveShown, '«Сохранить» появилась от пробелов');
    });
    await page.fill('#profileLabelInput', '🐢 Петя');
    v = await view();
    await check('новое имя — «Сохранить» появилась', () => {
        assert(v.saveShown, '«Сохранить» не появилась');
    });
    await page.press('#profileLabelInput', 'Enter');
    v = await view();
    const saved = await page.evaluate(`Progress.getProfileLabel()`);
    await check('Enter сохраняет, поле закрывается, визитка обновлена', () => {
        eq(saved, '🐢 Петя', 'сохранённое имя');
        assert(!v.editOpen, 'поле осталось открытым');
        eq(v.name, '🐢 Петя', 'имя в визитке');
        eq(v.avatar, 'П', 'буква — первая буква, а не эмодзи');
    });
    await page.click('#profileEditBtn');
    await page.fill('#profileLabelInput', '');
    await page.click('#profileNameSave');
    v = await view();
    await check('пустое имя — «Без имени» и улыбка вместо буквы', () => {
        eq(v.name, 'Без имени', 'имя');
        assert(v.nameEmpty, 'пустое имя не помечено');
        eq(v.avatar, '🙂', 'кружок');
    });

    console.log('\nЛогин и выход');
    await check('у своего аккаунта строка логина с 👁 и 📋', () => {
        assert(v.loginRow, 'строки логина нет');
        assert(v.copy, 'кнопки «скопировать» нет');
    });
    await check('выход — последним на экране, вне рамки, тихий', () => {
        assert(v.logoutLast, 'выход не последний на экране');
        eq(v.logoutParent, 'profileScreen', 'выход должен стоять вне рамки');
        assert(v.logoutQuiet, 'выход не тихий');
    });
    await check('у самостоятельного «Открыто репетитором» нет', () => {
        eq(v.chips.length, 0, 'лишние метки: ' + v.chips.join(' '));
    });

    console.log('\nУченик репетитора');
    server.access = { 'integer-': 'all' };
    await as('PCARD2', 'linked', 'Оля');
    // Доступ ставим прямо перед отрисовкой, одним вызовом: ответ сервера после входа
    // приходит когда придётся, и при загруженной машине профиль успевал открыться
    // раньше. Здесь проверяется, как профиль показывает доступ, а не как его грузят.
    await page.waitForTimeout(300);
    await page.evaluate(`(() => {
        document.querySelectorAll('.modal-screen').forEach(x => x.style.display = 'none');
        Progress.setAccess({ 'integer-': 'all' });
        openProfileScreen(); return null; })()`);
    v = await view();
    await check('открытые разделы — метками после «Открыто репетитором:»', () => {
        eq(v.chips[0], 'Открыто репетитором:', 'подпись');
        assert(v.chips.slice(1).some(c => /^\[Отрицательные/.test(c)), `меток нет: ${v.chips.join(' ')}`);
    });
    await check('о закрытых разделах метки молчат', () => {
        assert(!v.chips.some(c => /Десятичные|Дроби/.test(c)), `названы закрытые: ${v.chips.join(' ')}`);
    });
    await check('ученику тоже виден свой логин и 📋', () => {
        assert(v.loginRow && v.copy, JSON.stringify({ row: v.loginRow, copy: v.copy }));
    });

    console.log('\nГость');
    await page.evaluate(`(() => { playAsGuest(); return null; })()`);
    const isGuest = await page.evaluate(`Progress.isGuest()`);
    await openProfile();
    v = await view();
    await check('гостю строки логина нет', () => {
        assert(isGuest, 'войти гостем не удалось — проверка ничего бы не проверила');
        assert(!v.loginRow, 'гостю показана строка логина');
    });

    await check('всё это прошло без ошибок в консоли', () => {
        eq(errors.join(' | '), '', 'ошибки');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
