// ЭКРАН ИТОГОВ МИССИИ.
//
// Раньше он показывал «Время / Верно / Ошибок» — то есть ровно то, что ученик и так
// видел в верхней строке весь забег. За обычную миссию в игре сдвигается шесть вещей,
// и экран не говорил ни об одной: очередь наград показывает только ЗАВЕРШЁННОЕ, а
// движение, не дошедшее до конца, исчезало. При этом «не дошло» — девять забегов из
// десяти.
//
// Правило нового экрана, которое здесь и стережётся: НИ ОДНОГО УТВЕРЖДЕНИЯ, КОТОРОГО
// НЕЛЬЗЯ ПРОВЕРИТЬ ПО Progress. Он не хвалит и не обещает — он называет, сколько
// осталось. Врущий экран итогов хуже молчащего: ученик поверит числу один раз, увидит
// расхождение и перестанет верить всем остальным.
//
// Как запускать:  node test/win.test.js

const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('Playwright не установлен — проверка экрана итогов пропущена.');
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
    const page = await b.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof startGame === 'function'`);
    // Файл работ здесь ни при чём, а перечитывание вернуло бы настоящее окно из
    // репозитория и не дало бы начать миссию (см. test/maintenance-live.test.js).
    await page.evaluate(`
        window.MAINTENANCE = { until: null };
        reloadMaintenanceFile = function () {};
        renderMaintenance(); playAsGuest(); null;`);

    // Ученик, у которого в клетке «Сложение 2★» накоплено correct верных ответов.
    const посев = (correct, opts) => page.evaluate(`
        (() => {
            const o = ${JSON.stringify(opts || {})};
            const st = Progress.get();
            const dk = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return Progress.dayKey(d); };
            st.daily = {};
            for (let i = 0; i < 3; i++) st.daily[dk(i)] = { c: 24, w: 2, a: 1, s: 400, p: 0,
                ms: 24 * 4200, mc: 24, t: { 'integer+:add:2': [24, 2, 0, 24 * 4200, 24] }, e: {}, te: {} };
            st.byTopic = { 'integer+:add:2': { correct: ${correct}, wrong: 9 } };
            st.totals = { correct: ${correct}, wrong: 9, puzzlesCompleted: 0 };
            // Ворота действуют на гостя (он «solo»), поэтому по умолчанию открываем
            // золото на всех предыдущих звёздах: иначе клетка, в которой мы играем,
            // закрыта, и «Ещё раз» справедливо откажется — проверка падала бы не по делу.
            const lvl = o.level || 2;
            const u = {};
            for (let i = 1; i < lvl; i++) {
                u['integer+:add:' + i + ':c3'] = '2026-01-01';
                u['integer+:add:' + i + ':a3'] = '2026-01-01';
            }
            st.unlocks = o.unlocks ? Object.assign(u, o.unlocks) : u;
            exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
            exampleConfig.operations = { add: o.level || 2 };
            Progress.setConfig(exampleConfig);
            trainWanted = !!o.train;
            document.getElementById('configScreen').style.display = 'none';
            startGame();
        })()`);

    const завершить = async () => {
        await page.waitForTimeout(500);   // пазл рисуется не мгновенно
        await page.evaluate(`correctCount = 23; wrongCount = 2; totalSeconds = 184;
                             sessionMistakes = []; finishChallenge(); null;`);
        await page.waitForTimeout(400);
    };
    const карточка = () => page.evaluate(`document.getElementById('winCard').innerText`);

    console.log('\nСколько осталось');
    {
        errors.length = 0;
        await посев(88);
        await завершить();
        const r = await page.evaluate(`({
            крупное: document.getElementById('winBig').innerText,
            надпись: document.getElementById('winKicker').innerText,
            поProgress: PUZZLE_TOTAL - puzzleFilledFor(currentMissionTopicKey()),
            забег: document.getElementById('winRun').innerText
        })`);
        record('крупным числом названо, сколько осталось до картинки',
               r.крупное === String(r.поProgress) ? null
                   : `на экране «${r.крупное}», в Progress ${r.поProgress}`);
        record('это именно 12 при 88 собранных', r.крупное === '12' ? null : r.крупное);
        record('забег ушёл в мелкую строку, а не в заголовок',
               /23/.test(r.забег) && !/23/.test(r.крупное) ? null : `забег: «${r.забег}»`);
        record('экран собрался без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nКартинка на экране итогов — та же, что в игре');
    {
        const r = await page.evaluate(`(() => {
            const win = document.querySelector('#winArt svg');
            const mini = document.getElementById('miniPuzzleSvg');
            const кусков = (el) => el ? el.querySelectorAll('path, polygon, image').length : 0;
            return { есть: !!win, вИгре: кусков(mini), вИтогах: кусков(win) };
        })()`);
        record('картинка на экране есть', r.есть ? null : 'svg не появился');
        record('картинка не пустая', r.вИтогах > 1 ? null : `частей ${r.вИтогах}`);
        record('она совпадает с той, что была в игре',
               r.вИтогах === r.вИгре ? null : `в игре ${r.вИгре}, в итогах ${r.вИтогах}`);
    }

    console.log('\nВерх экрана не обрезан');
    {
        // Содержимое стало выше экрана, когда на итогах появилась карточка с картинкой,
        // и заголовок ушёл под системную строку iOS — прокруткой его было не достать.
        // Та же беда, что описана у .modal-screen, и тот же лечащий приём.
        // Чёлку подделываем: headless-браузер её не даёт, а без неё дефект не виден.
        //
        // И экран делаем НИЗКИМ. На высоком содержимое влезает целиком, центрирование
        // ставит его посередине, и дефекта не видно ни на пиксель: обе подсадки —
        // «вернуть center без safe» и «убрать безопасную зону» — проходили мимо.
        // Беда начинается ровно тогда, когда содержимое выше экрана: у Максима так и
        // было. 600 px — это маленький телефон или крупный системный шрифт.
        await page.setViewportSize({ width: 390, height: 600 });
        await посев(88);
        await завершить();
        const r = await page.evaluate(`(() => {
            const st = document.querySelector('style');
            st.textContent = st.textContent.split('env(safe-area-inset-top)').join('47px')
                .split('env(safe-area-inset-bottom)').join('34px')
                .split('env(safe-area-inset-left)').join('0px')
                .split('env(safe-area-inset-right)').join('0px');
            const scr = document.getElementById('winScreen');
            const kick = document.getElementById('winKicker');
            const k = kick.getBoundingClientRect();
            return { верхЗаголовка: k.top, высотаЗаголовка: k.height,
                     прокрутка: getComputedStyle(scr).overflowY,
                     можноПрокрутить: scr.scrollHeight > scr.clientHeight };
        })()`);
        record('заголовок не заехал под системную строку',
               r.верхЗаголовка >= 47 ? null
                   : `верх заголовка на ${Math.round(r.верхЗаголовка)} px, а чёлка занимает 47`);
        record('заголовок не уехал выше экрана',
               r.верхЗаголовка >= 0 ? null : `верх на ${Math.round(r.верхЗаголовка)} px`);
        record('если содержимое не влезло — его можно прокрутить',
               r.прокрутка === 'auto' || r.прокрутка === 'scroll'
                   ? null : `overflow-y: ${r.прокрутка}`);
        record('проверка и правда мерила переполненный экран',
               r.можноПрокрутить ? null : 'содержимое влезло — дефект так не воспроизвести');
        await page.setViewportSize({ width: 390, height: 900 });
    }

    console.log('\nСтрока про ворота не врёт');
    {
        // Следующая звезда ещё закрыта — строка обязана быть и называть ИМЕННО её.
        await посев(88);
        await завершить();
        let g = await page.evaluate(`({
            видна: getComputedStyle(document.getElementById('winGate')).display !== 'none',
            текст: document.getElementById('winGate').innerText })`);
        record('пока звезда закрыта — строка есть', g.видна ? null : 'строки нет');
        record('названа следующая звезда, а не текущая',
               /3★/.test(g.текст) ? null : `текст: «${g.текст}»`);

        // Ворота этой клетки уже пройдены — обещать открытое нельзя.
        await посев(150, { unlocks: { 'integer+:add:2:c3': '2026-01-01', 'integer+:add:2:a3': '2026-01-01' } });
        await завершить();
        g = await page.evaluate(`({
            видна: getComputedStyle(document.getElementById('winGate')).display !== 'none',
            текст: document.getElementById('winGate').innerText })`);
        record('когда звезда уже открыта — строки нет',
               g.видна ? `показано: «${g.текст}»` : null);

        // Репетитор открыл следующую звезду кодом доступа: золото её больше ничего
        // не открывает, и обещать это нельзя — даже если обе лесенки ещё не взяты.
        await посев(88);
        await завершить();
        const сГрантом = await page.evaluate(`(() => {
            Progress.setAccountType('linked', 'TUTOR');
            Progress.setAccess({ 'integer+': { add: [3] } });
            renderWinSummary();
            const el = document.getElementById('winGate');
            const r = { видна: getComputedStyle(el).display !== 'none', текст: el.innerText };
            Progress.setAccountType('self', null); Progress.setAccess(null);
            return r;
        })()`);
        record('открытую репетитором звезду не обещаем',
               сГрантом.видна ? `показано: «${сГрантом.текст}»` : null);

        // Пятая звезда — следующей не существует.
        await посев(88, { level: 5 });
        await завершить();
        g = await page.evaluate(`getComputedStyle(document.getElementById('winGate')).display !== 'none'`);
        record('на пятой звезде обещать нечего', g ? 'строка показана' : null);
    }

    console.log('\nРежим обучения говорит правду');
    {
        // Ответы с подсказкой не идут ни в пазл, ни в лесенки. Промолчать об этом
        // значит соврать самим видом экрана: «осталось 12» после забега, который
        // ничего не приблизил.
        await посев(88, { train: true });
        await завершить();
        const r = await page.evaluate(`({
            режим: trainActive,
            видна: getComputedStyle(document.getElementById('winGate')).display !== 'none',
            текст: document.getElementById('winGate').innerText })`);
        record('режим обучения действительно включился', r.режим ? null : 'trainActive не встал');
        record('экран предупреждает, что ответы не в счёт',
               r.видна && /не идут|тренировка/i.test(r.текст) ? null : `текст: «${r.текст}»`);
    }

    console.log('\nКнопка «Ещё раз»');
    {
        await посев(88);
        await завершить();
        errors.length = 0;
        const было = await page.evaluate(`JSON.stringify(exampleConfig.operations)`);
        await page.evaluate(`document.getElementById('btnWinAgain').click(); null;`);
        await page.waitForTimeout(500);
        const r = await page.evaluate(`({
            идёт: gameActive,
            итоги: document.getElementById('winScreen').classList.contains('active'),
            выбор: getComputedStyle(document.getElementById('configScreen')).display !== 'none',
            клетка: JSON.stringify(exampleConfig.operations),
            верно: correctCount
        })`);
        record('миссия началась снова', r.идёт ? null : 'игра не пошла');
        record('экран итогов закрылся', r.итоги ? 'экран итогов остался' : null);
        record('на выбор миссии не заходили', r.выбор ? 'показался экран выбора' : null);
        record('клетка та же', r.клетка === было ? null : `${было} → ${r.клетка}`);
        record('счётчики забега обнулились', r.верно === 0 ? null : `верно: ${r.верно}`);
        record('повтор прошёл без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\n«Ещё раз» не пускает в закрытое');
    {
        // Доступ мог измениться, пока шла миссия: репетитор отозвал звезду.
        // Кнопка не должна становиться дырой в воротах.
        await page.evaluate(`finishChallenge(); null;`);
        await посев(88, { level: 3 });
        await завершить();
        await page.evaluate(`
            Progress.setAccountType('solo', null);   // на самостоятельного ворота действуют
            Progress.get().unlocks = {};             // золота на 2★ нет — 3★ закрыта
            null;`);
        await page.evaluate(`document.getElementById('btnWinAgain').click(); null;`);
        await page.waitForTimeout(500);
        const r = await page.evaluate(`({
            идёт: gameActive,
            выбор: getComputedStyle(document.getElementById('configScreen')).display !== 'none'
        })`);
        record('в закрытую звезду не пустило', r.идёт ? 'миссия всё равно началась' : null);
        record('вернуло на выбор миссии', r.выбор ? null : 'экран выбора не показался');
        await page.evaluate(`Progress.setAccountType('self', null); null;`);
    }

    await b.close();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
