// ПАУЗА ВО ВРЕМЯ МИССИИ.
//
// Проверяется не «кнопка есть», а то, ради чего пауза вообще нужна и чем она опасна:
//   * часы миссии стоят — иначе это не пауза;
//   * занятое время не капает в прогресс — отчёт родителям не должен врать;
//   * пример СПРЯТАН — время ответа это мерка автоматизма, по ней идёт лесенка
//     скорости и открываются звёзды, и пауза с примером перед глазами превратила бы
//     её в «думай сколько хочешь»;
//   * раздумье над примером не растёт на длину паузы — иначе честная пауза (отвлекли)
//     наказывала бы ученика, отнимая у него скорость.
//
// Всё — в настоящем браузере и настоящими нажатиями. Как запускать:
//   node test/pause.test.js

const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('Playwright не установлен — проверка паузы пропущена.');
    console.log('Всего: 0, прошло: 0, упало: 0');
    process.exit(0);
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });

    await page.goto(FILE);
    await page.waitForFunction(`typeof startGame === 'function' && typeof pauseGame === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();`);
    // Без этого поверх игры так и висит экран входа, и «пример спрятан» проверяло бы
    // не паузу, а форму логина. Заходим той же дверью, что и человек без аккаунта.
    await page.evaluate(`playAsGuest(); null;`);

    // Настоящая миссия: тот же путь, которым в неё входит ученик.
    const startMission = () => page.evaluate(`
        resetSessionCounters();
        exampleConfig.category = 'arithmetic';
        exampleConfig.numberType = 'positive';
        exampleConfig.operations = { add: 1 };
        Progress.setConfig(exampleConfig);
        document.getElementById('configScreen').style.display = 'none';
        startGame(); null;`);

    const look = () => page.evaluate(`(() => {
        const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none';
        return {
            экранПаузы: vis('pauseScreen'),
            кнопкаПаузы: vis('btnPause'),
            часы: document.getElementById('clockTimeText').innerText,
            полоска: document.getElementById('timerBar').style.width,
            // Кто на самом деле окажется под пальцем в середине примера. Прозрачный
            // экран паузы прошёл бы проверку «экран показан», но пример остался бы виден.
            примерВиден: (() => {
                const q = document.getElementById('mathQuestion');
                const r = q.getBoundingClientRect();
                const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return !!el && (el === q || q.contains(el));
            })(),
            занято: (Progress.get().daily[Progress.dayKey()] || {}).s || 0
        };
    })()`);

    console.log('\nКнопка паузы');
    {
        errors.length = 0;
        const before = await look();
        record('вне миссии кнопки паузы нет', before.кнопкаПаузы ? 'кнопка видна до начала миссии' : null);
        await startMission();
        await page.waitForTimeout(200);
        const after = await look();
        record('в миссии кнопка паузы есть', after.кнопкаПаузы ? null : 'кнопки нет');
        record('миссия началась без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nЧасы и занятое время стоят');
    {
        await startMission();
        await page.waitForTimeout(2200);           // часы успели тикнуть
        const шли = await look();
        // Нажимаем настоящую кнопку, а не функцию.
        await page.evaluate(`document.getElementById('btnPause').click(); null;`);
        const наПаузе = await look();
        record('экран паузы открылся', наПаузе.экранПаузы ? null : 'экран паузы не показался');
        record('пример спрятан', наПаузе.примерВиден ? 'пример виден сквозь паузу' : null);
        record('часы успели пойти до паузы', шли.часы !== '00:00' ? null : `часы стоят: ${шли.часы}`);

        await page.waitForTimeout(2600);           // на паузе не должно набежать ничего
        const после = await look();
        record('часы на паузе стоят',
               после.часы === наПаузе.часы ? null : `${наПаузе.часы} → ${после.часы}`);
        record('занятое время на паузе не растёт',
               после.занято === наПаузе.занято ? null : `${наПаузе.занято}с → ${после.занято}с`);
        // Полоска — это то же время, только видимое. Если она ползёт на паузе, пример
        // «сгорит» у ученика, пока он отошёл.
        record('полоска времени на паузе стоит',
               после.полоска === наПаузе.полоска ? null : `${наПаузе.полоска} → ${после.полоска}`);
    }

    console.log('\nПродолжение');
    {
        errors.length = 0;
        // Главная проверка файла. Раздумье над примером меряется ровно так же, как его
        // меряет само приложение, — ДО паузы и СРАЗУ ПОСЛЕ продолжения. Пауза длиной в
        // две с половиной секунды не должна попасть в этот счёт: иначе честная пауза
        // (отвлекли) отнимала бы у ученика скорость, а по скорости идёт лесенка.
        await startMission();
        await page.waitForTimeout(700);
        const ПАУЗА_МС = 2500;
        const r = await page.evaluate(`(async () => {
            const доПаузы = Date.now() - questionShownAt;
            document.getElementById('btnPause').click();
            await new Promise(r => setTimeout(r, ${ПАУЗА_МС}));
            document.querySelector('#pauseScreen button').click();
            const послеПаузы = Date.now() - questionShownAt;
            return { доПаузы, послеПаузы, пауза: paused };
        })()`);
        const s = await look();
        record('экран паузы закрылся', s.экранПаузы ? 'экран паузы остался' : null);
        record('пример вернулся', s.примерВиден ? null : 'примера не видно');
        record('пауза снята', r.пауза === false ? null : 'флаг паузы остался');
        record('пауза не попала в раздумье над примером',
               r.послеПаузы < r.доПаузы + ПАУЗА_МС / 2 ? null
                   : `было ${r.доПаузы} мс, стало ${r.послеПаузы} мс — пауза (${ПАУЗА_МС} мс) в счёте`);
        record('раздумье до паузы не потерялось',
               r.послеПаузы >= r.доПаузы ? null
                   : `было ${r.доПаузы} мс, стало ${r.послеПаузы} мс — отсчёт начали заново`);
        record('часы снова идут', await page.evaluate(`(async () => {
            const было = document.getElementById('clockTimeText').innerText;
            await new Promise(r => setTimeout(r, 2200));
            return document.getElementById('clockTimeText').innerText !== было;
        })()`) ? null : 'часы не пошли после продолжения');
        record('продолжение прошло без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nНа паузе не отвечают');
    {
        await startMission();
        await page.waitForTimeout(200);
        const r = await page.evaluate(`(() => {
            const было = correctCount + wrongCount;
            pauseGame();
            // Пробуем ответить в обход экрана — так, как это сделала бы клавиатура
            // или касание, проскочившее сквозь закрывающуюся анимацию.
            const btn = document.querySelector('#answersGrid button');
            if (btn) btn.click();
            checkAnswer(correctAnswer, null);
            return { было, стало: correctCount + wrongCount };
        })()`);
        record('ответ на паузе не засчитывается',
               r.стало === r.было ? null : `счёт вырос с ${r.было} до ${r.стало}`);
        await page.evaluate(`resumeGame(); null;`);
    }

    console.log('\nЗавершение миссии с паузы');
    {
        await startMission();
        await page.waitForTimeout(200);
        await page.evaluate(`pauseGame(); finishChallenge(); null;`);
        await page.waitForTimeout(200);
        const s = await look();
        record('экран паузы не висит поверх итогов', s.экранПаузы ? 'экран паузы остался' : null);
        record('кнопка паузы убралась', s.кнопкаПаузы ? 'кнопка осталась после миссии' : null);
        record('пауза не пережила миссию',
               await page.evaluate(`paused`) === false ? null : 'флаг паузы остался поднятым');
    }

    await b.close();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
