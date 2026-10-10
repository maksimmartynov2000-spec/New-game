// ВКЛАДКА «ЗАДАЧИ» В КОЛЛЕКЦИИ — заработанные задачи за мастерство в одном месте.
// В живом браузере, с подставным сервером.
//
// Раньше перечитать задачу можно было только в достижениях, а во время техработ —
// никак: в перерыв открывается одна коллекция. Здесь проверяется, что вкладка
// показывает ровно заработанное (тем же правилом, что и достижения), не подсказывает
// незаработанное, не рассказывает о закрытых разделах, работает в перерыв и ничего
// не записывает.
//
// Как запускать:  node test/collection-tasks.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

// Тексты задач берём из самого файла содержимого: проверяем, что на экране именно они.
const box = { window: {} };
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'content', 'challenges.js'), 'utf8'), box);
const CONTENT = box.window.CHALLENGE_CONTENT;

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — живые проверки вкладки «Задачи» пропущены.');
    finish();
    process.exit(0);
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    const server = { access: {} };
    await page.route('**/rest/v1/rpc/*', r => {
        const fn = r.request().url().split('/rpc/')[1];
        let body = { ok: true };
        if (fn === 'session_state') body = { ok: true, state: { schema: 2, playerCode: 'X', updatedAt: 0 } };
        if (fn === 'session_my_access') body = { ok: true, access: server.access };
        if (fn === 'session_my_homework') body = { ok: true, homework: [] };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    // Язык ставим, только если его ещё нет: иначе перезагрузка ради английского снова
    // включила бы русский.
    await page.addInitScript(() => { try { if (!localStorage.getItem('mathCitadelLang_v1')) localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    const boot = async () => {
        await page.waitForFunction(`typeof renderSyncBadges === 'function'`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);
    };
    await page.goto(FILE);
    await boot();

    const as = async (code, type) => {
        await page.evaluate(`(() => {
            closeCollectionModal();
            Progress.switchTo(${JSON.stringify(code)}, null, { accountType: ${JSON.stringify(type)}, profileLabel: 'Маша' });
            Progress.setToken(${JSON.stringify(code)}, 'tok-' + ${JSON.stringify(code)}); enterApp(); return null; })()`);
        // Доступ ученику приходит с сервера — как при настоящем входе. Пока его нет,
        // ученик репетитора видит всё (так задумано), и проверка разделов ничего бы не
        // проверяла. Медали ставим после доступа: при его смене прогресс закрытых
        // разделов убирается.
        if (type !== 'self') await page.evaluate(`refreshAccess().then(() => null)`);
    };
    // Все три лесенки клетки на ступени tier — это и есть мастерство.
    const grant = (key, tier, ladders = ['s', 'a', 'c']) => page.evaluate(`(() => {
        ${JSON.stringify(ladders)}.forEach(l => Progress.unlock(${JSON.stringify(key)} + ':' + l + ${tier}));
        return null; })()`);
    const open = () => page.evaluate(`openCollectionModal(); null`);
    // Не нажалось (окно перекрыто) — это провал проверок ниже, а не падение всего теста.
    const tab = (id) => page.click('#' + id, { timeout: 3000 }).catch(e => errors.push('не нажалось: ' + id));
    const view = () => page.evaluate(`(() => {
        const $ = (id) => document.getElementById(id);
        const shown = (id) => !$(id).hidden && $(id).offsetParent !== null;
        return {
            picsView: shown('collectionPicsView'), tasksView: shown('collectionTasksView'),
            picsTitle: shown('collectionPicsTitle'), tasksTitle: shown('collectionTasksTitle'),
            activeTab: [...document.querySelectorAll('.collection-tab.active')].map(x => x.id),
            selected: [...document.querySelectorAll('.collection-tab')].filter(x => x.getAttribute('aria-selected') === 'true').map(x => x.id),
            count: $('collectionTasksCount').innerText,
            sections: [...document.querySelectorAll('#collectionTasks .collection-tasks-section')].map(x => x.innerText),
            groups: [...document.querySelectorAll('#collectionTasks .collection-group-title')].map(x => x.innerText),
            caps: [...document.querySelectorAll('#collectionTasks .ladder-challenge-cap')].map(x => x.innerText),
            tasks: [...document.querySelectorAll('#collectionTasks .ladder-challenge-task')].map(x => x.innerText),
            locks: [...document.querySelectorAll('#collectionTasks .collection-task-lock')].map(x => x.innerText),
            lockTitles: [...new Set([...document.querySelectorAll('#collectionTasks .collection-task-lock')].map(x => x.title))],
            text: $('collectionTasks').innerText,
        };
    })()`);
    const ru = CONTENT.ru;

    console.log('\nВкладки');
    await as('KT1', 'solo');
    await grant('integer+:add:1', 5);           // алмаз и легенда — обе задачи клетки
    await grant('integer+:mul:3', 4);           // только алмаз
    await grant('integer+:sub:2', 4, ['s', 'a']); // количество не дотянуло — мастерства нет
    await open();
    let v = await view();
    await check('окно открывается на пазлах', () => {
        assert(v.picsView && v.picsTitle && !v.tasksView && !v.tasksTitle, JSON.stringify(v));
        eq(v.activeTab.join(), 'collectionTabPics', 'активная вкладка');
        eq(v.selected.join(), 'collectionTabPics', 'aria-selected');
    });
    const centre = await page.evaluate(`(() => { const m = document.getElementById('collectionModal');
        const r = m.querySelector('.puzzle-modal-inner').getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(m.clientHeight - r.bottom), tall: m.scrollHeight > m.clientHeight }; })()`);
    await check('короткое окно стоит посередине, как и раньше', () => {
        assert(!centre.tall, 'пазлы не поместились — проверка ничего не проверяет');
        assert(centre.top > 40 && Math.abs(centre.top - centre.bottom) <= 2, JSON.stringify(centre));
    });
    await tab('collectionTabTasks');
    v = await view();
    await check('«Задачи» прячет пазлы и меняет заголовок', () => {
        assert(v.tasksView && v.tasksTitle && !v.picsView && !v.picsTitle, JSON.stringify(v));
        eq(v.activeTab.join(), 'collectionTabTasks', 'активная вкладка');
        eq(v.selected.join(), 'collectionTabTasks', 'aria-selected');
    });
    await tab('collectionTabPics');
    v = await view();
    await check('и обратно на пазлы', () => assert(v.picsView && v.picsTitle && !v.tasksView && !v.tasksTitle, JSON.stringify(v)));
    await tab('collectionTabTasks');
    await page.evaluate(`closeCollectionModal(); null`);
    await open();
    v = await view();
    await check('закрыл на задачах — снова открывается на пазлах', () => assert(v.picsView && !v.tasksView, JSON.stringify(v)));

    console.log('\nЧто показано');
    await tab('collectionTabTasks');
    v = await view();
    await check('счётчик: заработано из написанного — 3 из 40', () => eq(v.count, '3/40', 'счётчик'));
    await check('заработанные — те же, что считают достижения, с полным условием', () => {
        eq(v.tasks.length, 3, 'карточек');
        eq(v.tasks[0], ru['integer+:add:1'].diamond.task, 'первая');
        eq(v.tasks[1], ru['integer+:add:1'].legend.task, 'вторая');
        eq(v.tasks[2], ru['integer+:mul:3'].diamond.task, 'третья');
    });
    await check('у задачи видно ступень и звезду', () => {
        eq(v.caps[0], '💎 Задача за мастерство · 1★', 'алмаз');
        eq(v.caps[1], '👑 Задача за легенду · 1★', 'легенда');
        eq(v.caps[2], '💎 Задача за мастерство · 3★', 'умножение');
    });
    await check('две лесенки на алмазе из трёх — ещё не мастерство', () => {
        assert(v.tasks.indexOf(ru['integer+:sub:2'].diamond.task) < 0, 'задача вычитания 2★ показана');
        eq(v.groups[1], '➖ Вычитание — 0/10', 'вычитание');
    });
    await check('по действиям: сколько взято из десяти', () =>
        eq(v.groups.join(' | '), '➕ Сложение — 2/10 | ➖ Вычитание — 0/10 | ✖️ Умножение — 1/10 | ➗ Деление — 0/10', 'группы'));
    await check('незаработанные — замок со ступенью и звездой, по порядку звёзд', () => {
        eq(v.locks.length, 37, 'замков');
        eq(v.locks.slice(0, 3).join(' | '), '🔒 💎 2★ | 🔒 👑 2★ | 🔒 💎 3★', 'начало сложения');
        eq(v.locks.slice(8, 11).join(' | '), '🔒 💎 1★ | 🔒 👑 1★ | 🔒 💎 2★', 'начало вычитания');
        eq(v.lockTitles.join(), 'Ещё не открыто', 'подпись замка');
    });
    await check('условий незаработанных задач на экране нет', () => {
        const leaked = Object.keys(ru).filter(k => k.startsWith('integer+:'))
            .flatMap(k => ['diamond', 'legend'].map(tier => ru[k][tier].task))
            .filter(task => v.text.indexOf(task) >= 0);
        eq(leaked.length, 3, 'условий на экране (заработано три)');
    });
    await check('у одного раздела заголовка раздела нет', () => eq(v.sections.length, 0, 'заголовков'));

    console.log('\nОтвет по нажатию');
    const answer = () => page.evaluate(`(() => { const a = document.querySelector('#collectionTasks .ladder-challenge-answer');
        return { hidden: a.hidden, value: a.querySelector('.ladder-challenge-answer-value').innerText,
                 why: a.querySelector('.ladder-challenge-answer-why').innerText,
                 tap: document.querySelector('#collectionTasks .ladder-challenge-tap').innerText }; })()`);
    let a = await answer();
    await check('сначала ответ закрыт', () => { assert(a.hidden, 'ответ открыт сразу'); eq(a.tap, 'Нажми, чтобы увидеть ответ', 'подсказка'); });
    await page.click('#collectionTasks .ladder-challenge');
    a = await answer();
    await check('нажал — ответ и разбор', () => {
        assert(!a.hidden, 'ответ не открылся');
        eq(a.value, ru['integer+:add:1'].diamond.answer, 'ответ');
        eq(a.why, ru['integer+:add:1'].diamond.why, 'разбор');
        eq(a.tap, 'Скрыть ответ', 'подсказка');
    });
    await page.click('#collectionTasks .ladder-challenge');
    a = await answer();
    await check('нажал ещё раз — закрылся', () => assert(a.hidden, 'ответ не закрылся'));

    console.log('\nВ достижениях — та же задача');
    const card = await page.evaluate(`(() => { const c = buildLadderCard(Progress.get(), Progress.getUnlocks(), 'integer+:add:1');
        const boxes = [...c.querySelectorAll('.ladder-challenge')];
        if (boxes[0]) boxes[0].click();
        return { caps: boxes.map(x => x.querySelector('.ladder-challenge-cap').innerText),
                 tasks: boxes.map(x => x.querySelector('.ladder-challenge-task').innerText),
                 open: !!boxes[0] && !boxes[0].querySelector('.ladder-challenge-answer').hidden }; })()`);
    await check('карточка клетки показывает обе задачи и раскрывает ответ', () => {
        eq(card.caps.join(' | '), '💎 Задача за мастерство | 👑 Задача за легенду', 'заголовки');
        eq(card.tasks.join(' | '), ru['integer+:add:1'].diamond.task + ' | ' + ru['integer+:add:1'].legend.task, 'условия');
        assert(card.open, 'ответ не раскрылся');
    });

    console.log('\nТолько открытые разделы');
    await as('KT2', 'linked');
    await grant('integer-:add:1', 4);
    await open();
    await tab('collectionTabTasks');
    v = await view();
    await check('ученику без отрицательных — только положительные', async () => {
        eq(JSON.stringify(await page.evaluate(`Progress.getAccess()`)), '{}', 'доступ с сервера');
        eq(v.count, '0/40', 'счётчик');
        assert(!/Отрицательные/.test(v.text), 'отрицательные видны');
    });
    server.access = { 'integer-': 'all' };
    await as('KT3', 'linked');
    await grant('integer-:add:1', 4);
    await open();
    await tab('collectionTabTasks');
    v = await view();
    await check('репетитор открыл отрицательные — их задачи тоже здесь', async () => {
        eq(JSON.stringify(await page.evaluate(`Progress.getAccess()`)), '{"integer-":"all"}', 'доступ с сервера');
        eq(v.count, '1/80', 'счётчик');
        eq(v.sections.join(' | '), '🔵 Положительные | 🔴 Отрицательные', 'разделы');
        eq(v.tasks.join(), CONTENT.ru['integer-:add:1'].diamond.task, 'заработанная');
    });
    server.access = {};
    await as('KT4', 'self');
    await open();
    await tab('collectionTabTasks');
    v = await view();
    await check('репетитору открыто всё, но замков над ненаписанными задачами нет', () => {
        eq(v.count, '0/80', 'счётчик');
        assert(!/Десятичные|Дроби/.test(v.text), 'показаны разделы, где задач нет');
    });
    const top = await page.evaluate(`(() => { const m = document.getElementById('collectionModal'); m.scrollTop = 0;
        return { close: document.getElementById('collectionCloseBtn').getBoundingClientRect().top,
                 title: document.getElementById('collectionTasksTitle').getBoundingClientRect().top,
                 tall: m.scrollHeight > m.clientHeight }; })()`);
    await check('длинный список: заголовок и крестик не уходят за верхний край', () => {
        assert(top.tall, 'список не длиннее экрана — проверка ничего не проверяет');
        assert(top.close >= 0 && top.title >= 0, JSON.stringify(top));
    });
    await page.setViewportSize({ width: 390, height: 460 });
    await page.evaluate(`document.getElementById('collectionModal').scrollTop = 40; null`);
    await page.evaluate(`document.getElementById('collectionTabPics').click(); null`);
    const scrolled = await page.evaluate(`(() => { const m = document.getElementById('collectionModal');
        return { top: m.scrollTop, room: m.scrollHeight - m.clientHeight }; })()`);
    await check('новая вкладка начинается сверху', () => {
        assert(scrolled.room >= 40, 'пазлы помещаются целиком — проверка ничего не проверяет');
        eq(scrolled.top, 0, 'прокрутка');
    });
    await page.setViewportSize({ width: 390, height: 844 });

    console.log('\nКогда задачи не загрузились');
    await page.evaluate(`window.__savedChallenges = window.CHALLENGE_CONTENT; delete window.CHALLENGE_CONTENT; null`);
    await open();
    await tab('collectionTabTasks');
    v = await view();
    await check('вместо пустоты — что делать', () => {
        assert(/Задачи не загрузились\. Проверь интернет/.test(v.text), v.text);
        eq(v.count, '0/0', 'счётчик');
    });
    await page.evaluate(`window.CHALLENGE_CONTENT = window.__savedChallenges; null`);

    console.log('\nВо время техработ');
    // Свежий профиль: на прежнем вкладка уже рисовалась, и запись, случись она,
    // произошла бы раньше, чем мы запомнили «до».
    await as('KT5', 'solo');
    await grant('integer+:add:1', 4);
    const before = await page.evaluate(`JSON.stringify(Progress.get())`);
    await page.evaluate(`window.MAINTENANCE = { until: new Date(Date.now() + 600000).toISOString() }; renderMaintenance(); null`);
    await page.evaluate(`peekCollectionDuringBreak(); null`);
    await check('коллекция открыта поверх заглушки', async () =>
        eq(await page.evaluate(`document.getElementById('collectionModal').style.zIndex`), '9100', 'слой'));
    await tab('collectionTabTasks');
    v = await view();
    await check('и вкладка задач в ней работает', () => {
        assert(v.tasksView, 'вкладка не открылась');
        eq(v.count, '1/40', 'счётчик');
    });
    await page.click('#collectionTasks .ladder-challenge');
    await tab('collectionTabPics');
    await tab('collectionTabTasks');
    await check('вкладка ничего не записывает', async () =>
        eq(await page.evaluate(`JSON.stringify(Progress.get())`), before, 'прогресс'));
    await page.evaluate(`closeCollectionModal(); window.MAINTENANCE = { until: null }; renderMaintenance(); null`);

    console.log('\nНа английском');
    await page.evaluate(`localStorage.setItem('mathCitadelLang_v1', 'en'); null`);
    await page.reload();
    await boot();
    await as('KT1', 'solo');
    await open();
    await tab('collectionTabTasks');
    const en = await page.evaluate(`({ tab: document.getElementById('collectionTabTasks').innerText,
        pics: document.getElementById('collectionTabPics').innerText,
        title: document.getElementById('collectionTasksTitle').innerText,
        hint: document.querySelector('#collectionTasksView .puzzle-save-hint').innerText,
        first: document.querySelector('#collectionTasks .ladder-challenge-task').innerText,
        cap: document.querySelector('#collectionTasks .ladder-challenge-cap').innerText })`);
    await check('вкладки, заголовок и подсказка переведены, задача — из английского текста', () => {
        eq(en.tab, '💎 Problems', 'вкладка');
        eq(en.pics, '🧩 Puzzles', 'вкладка пазлов');
        eq(en.title, '💎 Mastery problems: 3/40', 'заголовок');
        assert(/^A problem opens when speed, accuracy and count/.test(en.hint), en.hint);
        eq(en.first, CONTENT.en['integer+:add:1'].diamond.task, 'условие');
        eq(en.cap, '💎 Mastery problem · 1★', 'ступень');
    });

    await check('без ошибок на странице', () => assert(!errors.length, errors.join(' | ')));
    await b.close();
    finish();
})().catch(e => { console.error('Тест упал целиком:', e); process.exit(1); });
