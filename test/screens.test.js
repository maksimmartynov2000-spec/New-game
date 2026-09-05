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

    // Сама загрузка страницы — отдельная проверка, и она первая. Раньше ошибки при
    // загрузке никто не смотрел: список errors очищался перед первым же экраном, и
    // сломанный файл всплывал позже, приписанный чужому тесту («статистика на fr»).
    // Так и случилось при выносе js/topics.js: в него затесалась строка, которая при
    // загрузке лезет в DOM, а index.html подключает эти файлы в <head>, где <body>
    // ещё нет. Ошибка была на всех языках, а названы были два.
    console.log('\nЗагрузка страницы');
    record('приложение загружается без ошибок', errors.length ? errors.join(' | ') : null);
    record('вынесенные файлы объявлены', await page.evaluate(`
        [['t', typeof t], ['OP_ORDER', typeof OP_ORDER], ['generateProblem', typeof generateProblem],
         ['classifyMistake', typeof classifyMistake], ['renderMasteryMap', typeof renderMasteryMap],
         ['Progress', typeof Progress], ['parseTopicKey', typeof parseTopicKey],
         ['shiftDayKey', typeof shiftDayKey]]
            .filter(([, kind]) => kind === 'undefined').map(([name]) => name).join(', ') || null`));

    errors.length = 0;
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

    // Что видит УЧЕНИК, а не репетитор. Экран профиля один на обоих, и разделы в нём
    // прячутся кодом, а не разметкой. «Опасная зона» пряталась не всегда: ученику
    // показывались сброс всего прогресса и удаление профиля — необратимые оба, а пароль
    // при удалении не преграда, ученик его знает. Проверяем и то, что раздел скрыт, и то,
    // что сами действия отказываются работать в обход кнопки.
    console.log('\nПрофиль ученика');
    {
        errors.length = 0;
        const r = await page.evaluate(`(async () => {
            Progress.setAccountType('linked', 'TUTOR');
            // Обе функции выходят раньше защиты, если нет логина и нечем подтвердить
            // личность. Без этих двух строк проверки ниже проходили бы всегда — я на этом
            // и попался: подсадка «убрать защиту» их не роняла.
            Progress.setToken('TEST01', 'x'.repeat(64));
            Progress.get().playerCode = 'TEST01';
            document.querySelectorAll('.modal-screen').forEach(x => x.style.display = 'none');
            renderProfileScreen();
            const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
            const zone = vis('dangerSection');
            const students = vis('studentsSection');
            const backup = vis('backupSection');
            // Предыдущий экран («серия и заморозки») оставил окно открытым — закрываем,
            // иначе замер ниже поймает чужое окно и проверка станет ложной.
            closeAppDialog(null);
            await new Promise(r => setTimeout(r, 60));
            confirmHardReset();
            await new Promise(r => setTimeout(r, 120));
            const dlgAfterReset = document.getElementById('appDialog').classList.contains('open');
            closeAppDialog(null);
            await new Promise(r => setTimeout(r, 60));
            confirmDeleteOwnAccount();
            await new Promise(r => setTimeout(r, 120));
            const dlgAfterDelete = document.getElementById('appDialog').classList.contains('open');
            closeAppDialog(null);
            Progress.get().playerCode = null;
            return { zone, students, backup, dlgAfterReset, dlgAfterDelete };
        })()`);
        record('«Опасная зона» ученику не показывается', r.zone ? 'раздел виден' : null);
        record('«Мои ученики» ученику не показывается', r.students ? 'раздел виден' : null);
        record('«Резервная копия» ученику не показывается', r.backup ? 'раздел виден' : null);
        record('сброс прогресса не срабатывает в обход кнопки',
               r.dlgAfterReset ? 'открылось окно подтверждения' : null);
        record('удаление профиля не срабатывает в обход кнопки',
               r.dlgAfterDelete ? 'открылось окно подтверждения' : null);

        // Возвращаем как было — дальше идут языки, им нужен обычный аккаунт.
        await page.evaluate(`Progress.setAccountType('self', null); renderProfileScreen();`);
    }

    // Резервная копия. Единственный экземпляр данных лежит на одном сервере, поэтому
    // выгрузка — не украшение, а то, чем закрывается самый дорогой риск в системе.
    // Проверяем не «кнопка есть», а что она отдаёт разбираемый JSON с настоящими числами.
    console.log('\nРезервная копия');
    {
        errors.length = 0;
        const r = await page.evaluate(`(async () => {
            Progress.setAccountType('self', null);
            Progress.setToken('TUTOR1', 'x'.repeat(64));
            Progress.get().playerCode = 'TUTOR1';
            document.querySelectorAll('.modal-screen').forEach(x => x.style.display = 'none');
            renderProfileScreen();
            const visible = getComputedStyle(document.getElementById('backupSection')).display !== 'none';
            closeAppDialog(null);
            exportAllProgress();
            // Сбор данных ходит на сервер; сети в проверке нет, но обещание всё равно
            // разрешается — ждём чуть дольше одного кадра.
            await new Promise(r => setTimeout(r, 900));
            const area = document.querySelector('.backup-text');
            const note = document.querySelector('#appDialogCard .dlg-text');
            let parsed = null, err = null;
            try { parsed = JSON.parse(area ? area.value : ''); } catch (e) { err = String(e.message); }
            const btns = Array.from(document.querySelectorAll('#appDialogCard .dlg-btn')).map(x => x.innerText);
            closeAppDialog(null);
            Progress.get().playerCode = null;
            return {
                visible, err, btns,
                noteText: note ? note.innerText : '',
                format: parsed && parsed.format,
                hasOwn: !!(parsed && parsed.profiles && parsed.profiles.length >= 1),
                correct: parsed && parsed.profiles && parsed.profiles[0].state.totals.correct
            };
        })()`);
        record('раздел «Резервная копия» открыт репетитору', r.visible ? null : 'раздела нет');
        record('копия — разбираемый JSON', r.err ? `не разобрался: ${r.err}` : null);
        record('в копии есть свой профиль с числами',
               (r.hasOwn && typeof r.correct === 'number' && r.correct > 0)
                   ? null : `формат ${r.format}, верных ${r.correct}`);
        record('есть и копирование, и скачивание',
               (r.btns.includes('Скопировать') && r.btns.includes('Скачать файл'))
                   ? null : `кнопки: ${r.btns.join(', ')}`);
        // Без сети учеников достать нельзя, и копия обязана об этом сказать: молчаливая
        // неполная копия хуже отсутствия копии — на неё понадеются.
        record('без связи с сервером копия честно предупреждает',
               /достучаться не удалось/.test(r.noteText) ? null : `сказано: «${r.noteText}»`);
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
