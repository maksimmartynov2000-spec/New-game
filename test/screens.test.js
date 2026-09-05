// Дымовой прогон: открыть КАЖДЫЙ экран в настоящем браузере и упасть на любой ошибке.
//
// Зачем этот файл появился. Дважды подряд правка ломала экран статистики так, что он
// переставал открываться вообще, и оба раза это нашлось случайно — при попытке снять
// скриншот, а не тестом:
//   1) из разметки убрали подзаголовок, а строку кода, которая в него писала, оставили:
//      getElementById вернул null и отрисовка падала на первой строке;
//   2) при правке подсчёта серии удалилось объявление переменной, которой пользовалась
//      ДРУГАЯ функция на другом экране: ReferenceError у ученика, у репетитора всё цело.
//
// Ни один существующий тест такого поймать не мог: они режут куски скрипта и зовут
// отдельные функции с подставным DOM. Здесь наоборот — страница грузится целиком,
// экраны открываются по очереди, и любая ошибка на странице роняет проверку.
//
// Как запускать:  node test/screens.test.js
// Нужен Playwright и браузер в /opt/pw-browsers/chromium.

const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('Playwright не установлен — дымовой прогон пропущен.');
    console.log('Всего: 0, прошло: 0, упало: 0');
    process.exit(0);
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}

// Прогресс, на котором есть что рисовать: клетки, ступени, серия, ошибки.
const SEED = `(() => {
    // Перерыв в репозитории может быть включён прямо сейчас — тогда экраны
    // закрыты заглушкой, и прогон проверял бы не их, а её. У заглушки свой файл
    // проверок; здесь она только мешает.
    window.MAINTENANCE = { until: null };
    const st = Progress.get();
    const key = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return Progress.dayKey(d); };
    const cell = (c, w) => [c, w, 0, c * 3000, c];
    const day = (c, w) => ({ c, w, a: 1, s: 300, p: 0, ms: c * 3000, mc: c,
        t: { 'integer+:add:2': cell(Math.round(c * 0.7), w), 'integer+:sub:1': cell(Math.round(c * 0.3), 0) },
        e: { 'ошибка в десятках': w }, te: { 'integer+:add:2': { 'ошибка в десятках': w } } });
    st.daily = {};
    for (let o = 0; o < 9; o++) st.daily[key(o)] = day(22, 2);
    st.byTopic = { 'integer+:add:2': { correct: 140, wrong: 20 }, 'integer+:sub:1': { correct: 60, wrong: 9 } };
    st.totals = { correct: 200, wrong: 29, puzzlesCompleted: 2 };
    st.unlocks = { 'integer+:add:2:c3': true, 'integer+:add:2:a3': true, 'integer+:add:2:s2': true,
                   'integer+:sub:1:c2': true };
})()`;

// Экран: как открыть и что на нём обязано появиться.
const SCREENS = [
    { name: 'выбор миссии',   open: `document.getElementById('configScreen').style.display='flex'; renderDailyBar(); renderConfigTasks();`, must: '#dailyBar' },
    { name: 'выбор миссии, шаг 2', open: `showConfigStep(2);`, must: '#restStepScreen' },
    { name: 'статистика ученика',  open: `renderStatsScreen(); document.getElementById('statsScreen').style.display='flex';`, must: '#statsSolvedVal' },
    { name: 'статистика ученика: раскрытая карточка', open: `document.querySelectorAll('.stat-hero-card')[0].click();`, must: '#statsHeroDetail' },
    { name: 'статистика глазами репетитора', open: `renderStatsScreen(Progress.get(), 'Ярослава');`, must: '#statsMap' },
    { name: 'достижения',     open: `renderAchievementsScreen(); document.getElementById('achievementsScreen').style.display='flex';`, must: '#ladderList' },
    { name: 'профиль',        open: `renderProfileScreen(); document.getElementById('profileScreen').style.display='flex';`, must: '#profileList' },
    { name: 'коллекция',      open: `openCollectionModal();`, must: '#collectionGrid, #collectionModal' },
    { name: 'экзамен',        open: `examOpen('add');`, must: '#examQuestion' },
    { name: 'экзамен: итог',  open: `examOpen('add'); exam.best = 3; examFinish();`, must: '#examResultCap' },
    { name: 'окно открытой звезды', open: `pendingStarUnlock = { key: 'integer+:add:2', level: 3 }; advanceMissionReveals();`, must: '#starUnlock' },
    { name: 'серия и заморозки', open: `document.querySelector('.daily-streak').click();`, must: '.dlg-card' }
];

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(FILE);
    await page.waitForTimeout(1200);
    await page.evaluate(SEED);

    console.log('\nЭкраны открываются без ошибок');
    for (const s of SCREENS) {
        errors.length = 0;
        let problem = null;
        try {
            await page.evaluate(`document.querySelectorAll('.modal-screen').forEach(x => x.style.display='none');`);
            await page.evaluate(s.open);
            await page.waitForTimeout(180);
            const seen = await page.$(s.must);
            if (!seen) problem = `на экране нет ${s.must}`;
        } catch (e) {
            problem = String(e.message || e).split('\n')[0];
        }
        if (!problem && errors.length) problem = errors.join(' | ');
        record(s.name, problem);
    }

    // Языки: перевод не должен ронять отрисовку — в словарях легко потерять подстановку.
    console.log('\nТо же самое на других языках');
    for (const lang of ['en', 'fr', 'de']) {
        errors.length = 0;
        let problem = null;
        try {
            await page.evaluate(`setLang('${lang}')`);
            await page.waitForTimeout(150);
            await page.evaluate(`document.querySelectorAll('.modal-screen').forEach(x => x.style.display='none');
                                 renderStatsScreen(); document.getElementById('statsScreen').style.display='flex';
                                 renderDailyBar(); renderConfigTasks();`);
            await page.waitForTimeout(180);
        } catch (e) {
            problem = String(e.message || e).split('\n')[0];
        }
        if (!problem && errors.length) problem = errors.join(' | ');
        record(`статистика и задания на «${lang}»`, problem);
    }

    await b.close();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
