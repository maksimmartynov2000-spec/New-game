// ТАБЛИЦА УМНОЖЕНИЯ «КАК У МЕНЯ» — по самим примерам, с копилкой и тренировкой
// трудных. В живом браузере.
//
// Раньше цвет клетки шёл от группы целиком: 7 × 8 и 6 × 8 красились одинаково, хотя
// ребёнок сбивался ровно на одном из них. Теперь у примера свой счёт (byFact): с пяти
// ответов клетка красится по нему, до того — бледно, по группе. Примеры из копилки
// помечены точкой, над таблицей — сводка по 55 разным примерам, под ней — кнопка
// «Потренировать трудные»: десять примеров из тех, где сбиваешься.
//
// Здесь проверяется, что всё это говорит правду о хранимом счёте и что тренировка —
// настоящая миссия: ответы идут в счёт примера и туда же, куда ответы обычной игры.
//
// Как запускать:  node test/times-mine.test.js

const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

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
    console.log('Playwright не установлен — живые проверки таблицы пропущены.');
    finish();
    process.exit(0);
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof openTimesScreen === 'function' && typeof renderMaintenance === 'function'`);
    // Всё открыто только репетитору — им и играем.
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); playAsGuest();
                         Progress.setAccountType('self'); null`);

    // Счёт: 7 × 8 — пять ответов, 80% («почти»); 6 × 7 — пять, 40% («сбиваюсь»);
    // 3 × 4 — два ответа (мало — цвет от группы); 4 × 6 — в копилке.
    await page.evaluate(`(() => {
        const R = (a, b, right, wrong) => { for (let i = 0; i < right; i++) Progress.recordFact(a, b, true);
                                           for (let i = 0; i < wrong; i++) Progress.recordFact(a, b, false); };
        R(7, 8, 3, 1); R(8, 7, 1, 0);
        R(6, 7, 2, 3);
        R(3, 4, 2, 0);
        // Группе «small» (3 × 4) — свой счёт, чтобы бледной клетке было чем краситься.
        Progress.recordClass('integer+:mul:2', { cls: 'small' }, true, 3000);
        for (let i = 0; i < 40; i++) Progress.recordClass('integer+:mul:2', { cls: 'small' }, true, 3000);
        const bank = Progress.getBank();
        const meta = { category: 'integer', isNegative: false, opKey: 'mul', level: 2 };
        const p = { text: '4 × 6', answer: 24, a: 4, b: 6 };
        bank.items[problemSig(meta, p)] = { k: 'integer+:mul:2', p, w: 26, e: 'таблица умножения', t: Date.now(), ok: [] };
        return null;
    })()`);

    const view = () => page.evaluate(`(() => {
        const cell = (a, b) => document.querySelector('#timesGrid .times-cell[data-a="' + a + '"][data-b="' + b + '"]').className;
        const train = document.getElementById('timesTrain');
        return {
            c78: cell(7, 8), c87: cell(8, 7), c67: cell(6, 7), c34: cell(3, 4), c46: cell(4, 6), c64: cell(6, 4), c22: cell(2, 2),
            summary: document.getElementById('timesSummary').innerText.replace(/\\s+/g, ' ').trim(),
            trainHidden: train.hidden, train: train.innerText.replace(/\\s+/g, ' ').trim(),
            foot: document.getElementById('timesFoot').innerText
        };
    })()`);
    const has = (cls, x) => cls.split(' ').includes(x);

    console.log('\nВид «Приёмы» — как был');
    await page.evaluate(`openTimesScreen(); null`);
    let v = await view();
    await check('в «Приёмах» нет ни сводки, ни кнопки тренировки', () => {
        eq(v.summary, '', 'сводка');
        assert(v.trainHidden, 'кнопка тренировки видна в «Приёмах»');
    });

    console.log('\nВид «Как у меня»');
    await page.click('#timesViewRow [data-view="mine"]');
    v = await view();
    await check('клетка с пятью ответами красится по самому примеру — и в обе стороны', () => {
        assert(has(v.c78, 'times-a-mid') && !has(v.c78, 'times-fallback'), `7 × 8: ${v.c78}`);
        assert(has(v.c87, 'times-a-mid') && !has(v.c87, 'times-fallback'), `8 × 7: ${v.c87}`);
        assert(has(v.c67, 'times-a-low') && !has(v.c67, 'times-fallback'), `6 × 7: ${v.c67}`);
    });
    await check('при двух ответах цвет пока от группы — и бледный', () => {
        assert(has(v.c34, 'times-fallback') && !has(v.c34, 'times-a-none'), `3 × 4: ${v.c34}`);
    });
    await check('без ответов клетка серая, не бледная', () => {
        assert(has(v.c22, 'times-a-none') && !has(v.c22, 'times-fallback'), `2 × 2: ${v.c22}`);
    });
    await check('пример из копилки помечен точкой — в обеих клетках', () => {
        assert(has(v.c46, 'times-bank') && has(v.c64, 'times-bank'), `${v.c46} / ${v.c64}`);
        assert(!has(v.c78, 'times-bank'), '7 × 8 в копилке не лежит');
    });
    await check('сводка — по разным примерам: сбиваюсь 1, почти 1, в копилке 1', () => {
        assert(/почти 1/.test(v.summary) && /сбиваюсь 1/.test(v.summary) && /в копилке 1/.test(v.summary), v.summary);
    });
    await check('кнопка тренировки: сначала копилка, потом «сбиваюсь», потом «почти»', () => {
        assert(!v.trainHidden, 'кнопки нет');
        assert(v.train.indexOf('4 × 6, 6 × 7, 7 × 8') >= 0, v.train);
        assert(/10 примеров/.test(v.train), `не сказано, сколько примеров: ${v.train}`);
    });
    await check('сноска объясняет яркие и бледные клетки с порогом из кода', () => {
        assert(/от 5 раз/.test(v.foot), v.foot);
    });

    const pick = await page.evaluate(`(() => {
        document.querySelector('#timesGrid .times-cell[data-a="4"][data-b="6"]').click();
        const a = document.getElementById('timesPickLine').innerText;
        document.querySelector('#timesGrid .times-cell[data-a="7"][data-b="8"]').click();
        const b = document.getElementById('timesPickLine').innerText;
        return { a, b };
    })()`);
    await check('нажатая клетка называет счёт примера и копилку', () => {
        assert(/этот пример: верно 4 из 5/.test(pick.b), pick.b);
        assert(/ждёт в копилке/.test(pick.a), pick.a);
    });

    console.log('\nТренировка трудных');
    const run = await page.evaluate(`(() => {
        startTimesTraining();
        const r = repeatRun;
        return { focus: !!(r && r.focus), n: r ? r.queue.length : 0,
                 facts: r ? [...new Set(r.queue.map(it => { const a = it.p.a, b = it.p.b; return Math.min(a, b) + '×' + Math.max(a, b); }))].sort() : [],
                 keys: r ? [...new Set(r.queue.map(it => it.k))].sort() : [],
                 goal: document.getElementById('live-goal').innerText,
                 screen: document.getElementById('timesScreen').style.display };
    })()`);
    await check('десять примеров из трудных, и только из них', () => {
        assert(run.focus, 'это не тренировка трудных');
        eq(run.n, 10, 'примеров');
        eq(run.facts.join(','), '4×6,6×7,7×8', 'какие примеры');
    });
    await check('ответы идут в клетку той звезды, где группа впервые встречается', () => {
        // 4 × 6 — «small», 2★; 6 × 7 и 7 × 8 — «core», 3★.
        eq(run.keys.join(','), 'integer+:mul:2,integer+:mul:3', 'клетки');
    });
    await check('цель в строке миссии — «💪 1 из 10», экран таблицы закрыт', () => {
        eq(run.goal, '💪 1 из 10', 'цель');
        eq(run.screen, 'none', 'экран таблицы');
    });
    const before = await page.evaluate(`JSON.stringify(Progress.getByFact())`);
    for (let i = 0; i < 10; i++) {
        const live = await page.evaluate(`gameActive`);
        if (!live) break;
        await page.evaluate(`(() => { const key = answerKey(correctAnswer);
            [...document.querySelectorAll('#answersGrid .btn-answer')].find(x => x.dataset.key === key).click(); })()`);
        await page.waitForTimeout(60);
    }
    await page.evaluate(`if (gameActive) finishChallenge(); null`);
    await page.waitForTimeout(300);
    const after = await page.evaluate(`({ facts: Progress.getByFact(),
        kicker: document.getElementById('winKicker').textContent, big: document.getElementById('winBig').innerText,
        gate: document.getElementById('winGate').innerText })`);
    await check('верные ответы тренировки записались в счёт самих примеров', () => {
        const was = JSON.parse(before);
        const gained = ['4×6', '6×7', '7×8'].reduce((n, k) => n + ((after.facts[k] || [0])[0] - ((was[k] || [0])[0])), 0);
        eq(gained, 10, 'прибавилось верных');
    });
    await check('итог тренировки — свой: «Тренировка трудных», «10 из 10»', () => {
        eq(after.kicker, 'Тренировка трудных', 'надпись');
        eq(after.big, '10 из 10', 'число');
        assert(/таблиц/.test(after.gate), after.gate);
    });
    const again = await page.evaluate(`(() => { winPlayAgain(); return { focus: !!(repeatRun && repeatRun.focus), live: gameActive }; })()`);
    await check('«Ещё раз» — снова тренировка трудных', () => assert(again.focus && again.live, JSON.stringify(again)));
    await page.evaluate(`if (gameActive) finishChallenge(); document.getElementById('winScreen').classList.remove('active'); null`);

    console.log('\nСчёт примеров в обычной игре');
    const play = (sign, forced, rightAnswer, train) => page.evaluate(`(() => {
        if (gameActive) finishChallenge();
        document.getElementById('winScreen').classList.remove('active');
        resetSessionCounters();
        trainWanted = ${!!train};
        exampleConfig.category = 'integer';
        exampleConfig.numberType = ${JSON.stringify(sign === '-' ? 'negative' : 'positive')};
        exampleConfig.operations = { mul: 2 };
        forcedProblem = ${JSON.stringify(forced)};
        document.getElementById('configScreen').style.display = 'none';
        startGame();
        const before = JSON.stringify(Progress.getByFact());
        const key = answerKey(correctAnswer);
        [...document.querySelectorAll('#answersGrid .btn-answer')].find(x => (x.dataset.key === key) === ${!!rightAnswer}).click();
        const out = { before, after: JSON.stringify(Progress.getByFact()) };
        trainWanted = false;
        return out;
    })()`);
    let r = await play('+', { text: '9 × 3', answer: 27, a: 9, b: 3 }, true);
    await check('верный ответ в обычной игре прибавил примеру верный', () => {
        eq((JSON.parse(r.after)['3×9'] || [0])[0] - ((JSON.parse(r.before)['3×9'] || [0])[0]), 1, 'верных у 3×9');
    });
    r = await play('+', { text: '9 × 3', answer: 27, a: 9, b: 3 }, false);
    await check('ошибка прибавила примеру ошибку', () => {
        eq((JSON.parse(r.after)['3×9'] || [0, 0])[1] - ((JSON.parse(r.before)['3×9'] || [0, 0])[1]), 1, 'ошибок у 3×9');
    });
    r = await play('-', { text: '-9 × 3', answer: -27, a: -9, b: 3 }, true);
    await check('отрицательное умножение в таблицу не пишется', () => eq(r.after, r.before, 'счёт'));
    r = await play('+', { text: '9 × 3', answer: 27, a: 9, b: 3 }, true, true);
    await check('ответ с подсказками (режим обучения) в таблицу не пишется', () => eq(r.after, r.before, 'счёт'));

    await check('всё это прошло без ошибок в консоли', () => eq(errors.join(' | '), '', 'ошибки'));

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
