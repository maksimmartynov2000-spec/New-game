// «ПОВТОРИ ОШИБКИ» — миссия из копилки ошибок, в живом браузере.
//
// Хранилище копилки проверяет test/mistake-bank.test.js. Здесь — всё, что вокруг:
// что именно попадает в копилку из игры, что миссия показывает и что засчитывает,
// и что после неё игра остаётся той же, что была. Цена ошибки тут двойная: копилка,
// которая не пустеет, отбивает охоту в неё заглядывать, а миссия, оставившая после
// себя чужую клетку на экране выбора, путает ученика уже в обычной игре.
//
// Как запускать:  node test/repeat-mistakes.test.js

const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('Playwright не установлен — проверка повтора ошибок пропущена.');
    console.log('Всего: 0, прошло: 0, упало: 0');
    process.exit(0);
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof startGame === 'function'`);
    await page.evaluate(`
        window.MAINTENANCE = { until: null };
        reloadMaintenanceFile = function () {};
        renderMaintenance(); playAsGuest(); null;`);

    // ---------- помощники ----------
    // Чистый лист: копилка пуста, золото на 1★–3★ взято (иначе гость, у которого
    // работают ворота, не попал бы на 3★; 5★ при этом закрыта), игра стоит.
    const сначала = () => page.evaluate(`(() => {
        if (gameActive) finishChallenge();
        document.getElementById('winScreen').classList.remove('active');
        resetSessionCounters();
        const bank = Progress.getBank();
        Object.keys(bank.items).forEach(k => delete bank.items[k]);
        Object.keys(bank.done).forEach(k => delete bank.done[k]);
        const st = Progress.get();
        st.byTopic = {}; st.totals = { correct: 0, wrong: 0, puzzlesCompleted: 0 };
        const u = {};
        ['add', 'sub', 'mul', 'div'].forEach(op => {
            for (let i = 1; i <= 3; i++) { u['integer+:' + op + ':' + i + ':c3'] = '2026-01-01';
                                           u['integer+:' + op + ':' + i + ':a3'] = '2026-01-01'; }
        });
        st.unlocks = u;
        trainWanted = false;
        exampleConfig.category = null; exampleConfig.numberType = null; exampleConfig.operations = {};
        return true;
    })()`);
    // Обычная миссия в клетке.
    const миссия = (op, level, extra) => page.evaluate(`(() => {
        exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
        exampleConfig.operations = { ${op}: ${level} };
        ${extra || ''}
        document.getElementById('configScreen').style.display = 'none';
        startGame();
        return true;
    })()`);
    // Ответ кнопкой, как это делает ученик. После ошибки ждём следующего примера —
    // и если по дороге выпала подсказка, нажимаем на неё, как нажал бы ученик.
    const ответить = async (верно) => {
        const чем = await page.evaluate(`(() => {
            const key = answerKey(correctAnswer);
            const btns = [...document.querySelectorAll('#answersGrid .btn-answer')];
            const btn = btns.find(x => (x.dataset.key === key) === ${!!верно});
            btn.click();
            return btn.innerText;
        })()`);
        if (!верно) {
            await page.waitForFunction(`(() => {
                if (typeof hintFreezeResume === 'function') hintFreezeResume();
                return !answerLocked;
            })()`, null, { timeout: 8000, polling: 100 });
        }
        return чем;
    };
    const положить = (items) => page.evaluate(`(() => {
        const bank = Progress.getBank();
        Object.assign(bank.items, ${JSON.stringify(items)});
        return true;
    })()`);
    const вчера = await page.evaluate(`(() => { const d = new Date(); d.setDate(d.getDate() - 1); return Progress.dayKey(d); })()`);
    const сегодня = await page.evaluate(`Progress.dayKey()`);
    const давно = Date.now() - 3 * 86400000;
    const запись = (k, p, ok, extra) => Object.assign({ k, p, w: 0, e: 'как было', t: давно, ok: ok || [] }, extra || {});
    const сложение = (a, b) => ({ text: `${a} + ${b}`, answer: a + b, a, b });
    const ПРИМЕР_СЛОЖЕНИЯ = сложение(38, 7);          // 3★, через десяток
    const ПРИМЕР_УМНОЖЕНИЯ = { text: '8 × 9', answer: 72, a: 8, b: 9 };
    const SIG_ADD = 'integer+:add:3|38 + 7';
    const SIG_MUL = 'integer+:mul:3|8 × 9';
    const копилка = () => page.evaluate(`Progress.getBank()`);
    const экран = () => page.evaluate(`({
        вопрос: document.getElementById('mathQuestion').innerText,
        цель: document.getElementById('live-goal').innerText,
        пазл: document.getElementById('puzzleMiniBtn').style.display,
        идёт: gameActive,
        запись: repeatRun && repeatRun.current ? repeatRun.current.sig : null,
        класс: JSON.stringify(structuralClassOf(currentProblemMeta, currentProblem))
    })`);

    console.log('\nОшибка в игре кладёт пример в копилку');
    {
        await сначала();
        await миссия('mul', 3);
        await page.waitForTimeout(200);
        const до = await page.evaluate(`({ text: currentProblem.text, a: currentProblem.a, b: currentProblem.b })`);
        const ответ = await ответить(false);
        const bank = await копилка();
        const sig = `integer+:mul:3|${Math.min(до.a, до.b)} × ${Math.max(до.a, до.b)}`;
        const it = bank.items[sig];
        record('пример лежит в копилке под своей подписью',
               it ? null : `ждали ${sig}, есть: ${Object.keys(bank.items).join(', ') || 'ничего'}`);
        record('в записи клетка, сам пример, ответ ученика и вид ошибки',
               it && it.k === 'integer+:mul:3' && it.p.text === до.text && String(it.w) === ответ
               && typeof it.e === 'string' && it.e ? null : JSON.stringify(it));
        record('дней верных ответов пока нет', it && same(it.ok, []) ? null : JSON.stringify(it && it.ok));
    }

    console.log('\nВерный ответ на пример из копилки засчитывает день — и в обычной игре');
    {
        // 9 × 8 и 8 × 9 — один факт таблицы. Ошибся в одном, верно решил другой —
        // засчитано: выучить факт значит выучить оба.
        await сначала();
        await положить({ [SIG_MUL]: запись('integer+:mul:3', ПРИМЕР_УМНОЖЕНИЯ) });
        await миссия('mul', 3, `forcedProblem = { text: '9 × 8', answer: 72, a: 9, b: 8 };`);
        await page.waitForTimeout(150);
        const вопрос = await page.evaluate(`document.getElementById('mathQuestion').innerText`);
        await ответить(true);
        const it = (await копилка()).items[SIG_MUL];
        record('на экране был переставленный пример', вопрос === '9 × 8' ? null : вопрос);
        record('день засчитан записи «8 × 9»', it && same(it.ok, [сегодня]) ? null : JSON.stringify(it));
    }

    console.log('\n«Почти» и тренировка с подсказками копилку не трогают');
    {
        await сначала();
        await миссия('mul', 3, 'trainWanted = true;');
        await page.waitForTimeout(150);
        await ответить(false);
        const n1 = Object.keys((await копилка()).items).length;
        record('ошибка с подсказкой на экране в копилку не идёт', n1 === 0 ? null : `записей ${n1}`);

        // «Почти» бывает только в арифметике дробей: посчитано верно, не сокращено.
        await сначала();
        await page.evaluate(`(() => {
            exampleConfig.category = 'fraction'; exampleConfig.numberType = 'positive';
            exampleConfig.operations = { add: 2 };
            document.getElementById('configScreen').style.display = 'none';
            startGame();
        })()`);
        await page.waitForTimeout(150);
        await page.evaluate(`checkAnswer({ num: correctAnswer.num * 2, den: correctAnswer.den * 2 }, null)`);
        const n2 = Object.keys((await копилка()).items).length;
        const почти = await page.evaluate(`!!document.querySelector('#answersGrid .btn-correct') || answerLocked`);
        record('ответ действительно разобран как «почти»', почти ? null : 'ответ не остановил игру');
        record('«почти» в копилку не идёт', n2 === 0 ? null : `записей ${n2}`);
        await page.waitForFunction(`(() => { if (typeof hintFreezeResume === 'function') hintFreezeResume(); return !answerLocked; })()`,
                                   null, { timeout: 8000, polling: 100 });
    }

    console.log('\nКарточка на экране выбора миссии');
    {
        await сначала();
        const карточка = () => page.evaluate(`(() => { renderConfigTasks();
            const w = document.getElementById('repeatWrap');
            return { скрыта: w.hidden || getComputedStyle(w).display === 'none',
                     текст: document.getElementById('repeatSub').innerText }; })()`);
        let c = await карточка();
        record('пустая копилка — карточки нет', c.скрыта ? null : 'карточка видна при пустой копилке');
        const много = {};
        [[38, 7], [27, 8], [29, 6], [46, 5], [57, 4]].forEach(([a, b], i) => {
            много[i] = { ['integer+:add:3|' + a + ' + ' + b]: запись('integer+:add:3', сложение(a, b)) };
        });
        await положить(много[0]);
        c = await карточка();
        record('одна ошибка — «1 пример ждёт»', !c.скрыта && c.текст === '1 пример ждёт' ? null : JSON.stringify(c));
        await положить(Object.assign({}, много[1], много[2]));
        c = await карточка();
        record('три — «3 примера ждут»', c.текст === '3 примера ждут' ? null : c.текст);
        await положить(Object.assign({}, много[3], много[4]));
        c = await карточка();
        record('пять — «5 примеров ждут»', c.текст === '5 примеров ждут' ? null : c.текст);
        // Пятая звезда у гостя закрыта воротами: золото на 4★ не взято (см. «сначала»).
        await положить({ 'integer+:mul:5|3 × 37': запись('integer+:mul:5', { text: '3 × 37', answer: 111, a: 3, b: 37 }) });
        c = await карточка();
        record('пример с закрытой звезды не считается', c.текст === '5 примеров ждут' ? null : c.текст);
        // Испорченная по дороге запись: пример не сходится с подписью или его нет вовсе.
        await положить({ 'integer+:add:3|11 + 9': запись('integer+:add:3', сложение(12, 9)),
                         'fraction+:add:2|1_2|1_3': запись('fraction+:add:2', { isFraction: true }) });
        c = await карточка();
        record('испорченная запись не считается и в миссию не попадёт',
               c.текст === '5 примеров ждут' ? null : c.текст);
    }

    console.log('\nОчередь миссии');
    {
        // Первым — то, что можно выучить сегодня: верный ответ уже был, и не сегодня.
        // Потом остальное, давние ошибки раньше свежих. Засчитанное сегодня — в конце.
        await сначала();
        const t0 = Date.now() - 5 * 86400000;
        const имя = { '38 + 7': 'A', '27 + 8': 'B', '29 + 6': 'C', '46 + 5': 'D' };
        await положить({
            'integer+:add:3|38 + 7': запись('integer+:add:3', сложение(38, 7), [], { t: t0 + 2000 }),
            'integer+:add:3|27 + 8': запись('integer+:add:3', сложение(27, 8), [вчера], { t: t0 + 3000 }),
            'integer+:add:3|29 + 6': запись('integer+:add:3', сложение(29, 6), [сегодня], { t: t0 }),
            'integer+:add:3|46 + 5': запись('integer+:add:3', сложение(46, 5), [], { t: t0 + 1000 })
        });
        const порядок = (await page.evaluate(`repeatQueue(repeatItems()).slice(0, 4).map(it => it.sig.split('|')[1])`))
            .map(x => имя[x]);
        record('выучиваемое сегодня — первым, давнее раньше свежего, засчитанное сегодня — последним',
               same(порядок, ['B', 'D', 'A', 'C']) ? null : порядок.join(' '));

        await сначала();
        const двенадцать = {};
        [[3, 6], [3, 7], [3, 8], [4, 6], [4, 7], [4, 8], [6, 7], [6, 8], [6, 9], [7, 8], [7, 9], [8, 9]].forEach(([a, b], i) => {
            двенадцать[`integer+:mul:3|${a} × ${b}`] = запись('integer+:mul:3',
                { text: `${a} × ${b}`, answer: a * b, a, b }, [], { t: t0 + i });
        });
        await положить(двенадцать);
        const r = await page.evaluate(`(() => { const q = repeatQueue(repeatItems());
            return { n: q.length, разных: new Set(q.map(it => it.sig)).size }; })()`);
        record('в миссии не больше десяти примеров', r.n === 10 ? null : `примеров ${r.n}`);
        record('и каждый — своя ошибка, а не повтор одной', r.разных === 10 ? null : `разных ${r.разных}`);
    }

    console.log('\nМиссия повтора');
    {
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ),
                         [SIG_MUL]: запись('integer+:mul:3', ПРИМЕР_УМНОЖЕНИЯ) });
        // Выбор, сделанный на экране до повтора, — он должен вернуться после.
        await page.evaluate(`exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
                             exampleConfig.operations = { sub: 2 }; renderConfigTasks();
                             document.getElementById('configScreen').style.display = 'flex'; null`);
        // Кнопкой на карточке — так, как начинает ученик.
        await page.click('#repeatGo');
        await page.waitForTimeout(200);
        const первый = await экран();
        record('миссия началась с экрана выбора', первый.идёт ? null : 'игра не идёт');
        // Сложение повторяется похожим примером до трёх раз, умножение — один раз тем же.
        record('цель — пройти очередь: «🔁 1 из 4»', первый.цель === '🔁 1 из 4' ? null : первый.цель);
        record('картинки у повтора нет', первый.пазл === 'none' ? null : `пазл: «${первый.пазл}»`);
        const кадры = [первый];
        for (let i = 0; i < 6 && кадры[кадры.length - 1].идёт; i++) {
            await ответить(true);
            await page.waitForTimeout(80);
            кадры.push(await экран());
        }
        const игра = кадры.filter(k => k.идёт);
        const умн = игра.filter(k => k.запись === SIG_MUL);
        const слож = игра.filter(k => k.запись === SIG_ADD);
        record('умножение показано тем же самым примером, один раз',
               умн.length === 1 && умн[0].вопрос === '8 × 9' ? null : JSON.stringify(умн));
        record('сложение — три раза, и ни разу не тем же примером',
               слож.length === 3 && слож.every(k => k.вопрос !== '38 + 7') ? null : JSON.stringify(слож.map(k => k.вопрос)));
        const нужный = await page.evaluate(`JSON.stringify(structuralClassOf(
            { category: 'integer', opKey: 'add', level: 3, isNegative: false }, ${JSON.stringify(ПРИМЕР_СЛОЖЕНИЯ)}))`);
        record('похожий пример — того же типа, что и ошибка',
               слож.every(k => k.класс === нужный) ? null : `ждали ${нужный}: ${слож.map(k => k.класс).join(' ')}`);
        record('счётчик идёт по очереди', same(игра.map(k => k.цель), ['🔁 1 из 4', '🔁 2 из 4', '🔁 3 из 4', '🔁 4 из 4'])
               ? null : JSON.stringify(игра.map(k => k.цель)));
        const итог = await page.evaluate(`({
            экран: document.getElementById('winScreen').classList.contains('active'),
            надпись: document.getElementById('winKicker').innerText,
            число: document.getElementById('winBig').innerText,
            строки: document.getElementById('winRows').innerText,
            ворота: document.getElementById('winGate').innerText,
            выбор: JSON.stringify(exampleConfig),
            верных: (Progress.get().byTopic['integer+:add:3'] || {}).correct || 0
        })`);
        record('после очереди — экран итогов', итог.экран ? null : 'экран итогов не открылся');
        record('ответы повтора идут в статистику, как в любой миссии', итог.верных === 3 ? null : `верных ${итог.верных}`);
        record('итог называет, сколько ошибок ждёт',
               /копилке/i.test(итог.надпись) && итог.число === '2' ? null : `${итог.надпись} ${итог.число}`);
        record('обе ошибки решены сегодня впервые — «повтори завтра: 2»',
               /Повтори завтра\s*2/.test(итог.строки) && !/Выучено/.test(итог.строки) ? null : итог.строки);
        record('правило двух дней названо на экране', /два\s+разных\s+дня/.test(итог.ворота) ? null : итог.ворота);
        record('выбор миссии вернулся каким был',
               итог.выбор === JSON.stringify({ category: 'integer', numberType: 'positive', operations: { sub: 2 } })
               ? null : итог.выбор);
    }

    console.log('\nКак выбирается похожий пример');
    {
        // Генератор подменяем последовательностью: на настоящем «сложение 3★» почти все
        // примеры одного типа, и проверка типа проходила бы и без самой проверки.
        await сначала();
        const r = await page.evaluate(`(() => {
            const meta = { category: 'integer', opKey: 'add', level: 3, isNegative: false };
            const item = { sig: '${SIG_ADD}', k: 'integer+:add:3', p: ${JSON.stringify(ПРИМЕР_СЛОЖЕНИЯ)} };
            const P = (a, b) => ({ text: a + ' + ' + b, answer: a + b, a, b });
            const real = generateProblem;
            const run = (seq) => {
                let i = 0;
                generateProblem = () => seq[Math.min(i++, seq.length - 1)];
                try { return repeatProblemFor(item, meta).text; } finally { generateProblem = real; }
            };
            recentSignatures.length = 0;
            const out = {
                тип: run([P(31, 2), P(27, 8)]),       // 31 + 2 — без перехода через десяток
                сама: run([P(38, 7), P(27, 8)]),
                нет: run([P(31, 2)])
            };
            recentSignatures.push('int|add|29 + 6');
            out.недавний = run([P(29, 6), P(27, 8)]);
            recentSignatures.length = 0;
            return out;
        })()`);
        record('пример другого типа пропускается', r.тип === '27 + 8' ? null : r.тип);
        record('сама ошибка похожим не считается', r.сама === '27 + 8' ? null : r.сама);
        record('нужного типа нет — показывается тот же самый пример', r.нет === '38 + 7' ? null : r.нет);
        record('только что бывший на экране пример пропускается', r.недавний === '27 + 8' ? null : r.недавний);
    }

    console.log('\nКаждый вид примера показывается снова');
    {
        // Повтор не рисует примеры сам: он подкладывает пример в обычную ветку
        // generateMath. Значит, у каждой ветки пример из копилки должен проходить
        // тем же путём, что и свежий из генератора, — иначе миссия встанет посреди
        // забега. Всё открыто только репетитору — им и играем.
        await page.evaluate(`Progress.setAccountType('self'); null`);
        const клетки = [
            ['fraction', 'add', 3], ['fraction', 'div', 2], ['fraction', 'simplify', 3],
            ['fraction', 'toMixed', 3], ['fraction', 'toImproper', 4], ['fraction', 'fracOfNumber', 3],
            ['decimal', 'add', 3], ['decimal', 'mul', 4],
            ['integer-', 'mul', 5], ['integer-', 'div', 2], ['integer', 'div', 1],
            ['integer-', 'add', 3], ['integer-', 'sub', 4]
        ];
        const плохо = [];
        for (const [кат, op, lvl] of клетки) {
            const r = await page.evaluate(`(() => {
                if (gameActive) finishChallenge();
                document.getElementById('winScreen').classList.remove('active');
                resetSessionCounters();
                const bank = Progress.getBank();
                Object.keys(bank.items).forEach(k => delete bank.items[k]);
                exampleConfig.category = '${кат.replace('-', '')}';
                exampleConfig.numberType = '${кат.endsWith('-') ? 'negative' : 'positive'}';
                exampleConfig.operations = { ${op}: ${lvl} };
                document.getElementById('configScreen').style.display = 'none';
                startGame();
                const был = document.getElementById('mathQuestion').innerHTML;
                const meta = currentProblemMeta, p = JSON.parse(JSON.stringify(currentProblem));
                const класс = JSON.stringify(structuralClassOf(meta, p));
                Progress.bankAdd(problemSig(meta, p), { k: buildTopicKey(meta), p, w: null, e: '' });
                finishChallenge();
                document.getElementById('winScreen').classList.remove('active');
                resetSessionCounters();
                startRepeatMission();
                const key = answerKey(correctAnswer);
                return { был, стал: document.getElementById('mathQuestion').innerHTML, идёт: gameActive,
                         похожий: repeatsBySimilar(meta),
                         класс, классСтал: JSON.stringify(structuralClassOf(currentProblemMeta, currentProblem)),
                         кнопок: document.querySelectorAll('#answersGrid .btn-answer').length,
                         верныйЕсть: [...document.querySelectorAll('#answersGrid .btn-answer')].some(x => x.dataset.key === key) };
            })()`);
            const ок = r.идёт && r.кнопок === 4 && r.верныйЕсть
                && (r.похожий ? (r.стал !== r.был && r.классСтал === r.класс) : r.стал === r.был);
            if (!ок) плохо.push(`${кат} ${op} ${lvl}: ${JSON.stringify(r).slice(0, 160)}`);
        }
        await page.evaluate(`(() => { if (gameActive) finishChallenge();
            document.getElementById('winScreen').classList.remove('active');
            resetSessionCounters(); Progress.setAccountType('solo'); })()`);
        record('дроби, десятичные, отрицательные — пример из копилки показывается целиком',
               плохо.length ? плохо.join(' | ') : null);
    }

    console.log('\nДва разных дня');
    {
        await сначала();
        await положить({ [SIG_MUL]: запись('integer+:mul:3', ПРИМЕР_УМНОЖЕНИЯ, [вчера]) });
        await page.evaluate(`startRepeatMission()`);
        await page.waitForTimeout(150);
        await ответить(true);
        await page.waitForTimeout(300);
        const bank = await копилка();
        const итог = await page.evaluate(`({ строки: document.getElementById('winRows').innerText,
            надпись: document.getElementById('winKicker').innerText,
            ещё: getComputedStyle(document.getElementById('btnWinAgain')).display })`);
        record('вчера и сегодня — пример выучен и ушёл из копилки',
               !bank.items[SIG_MUL] && bank.done[SIG_MUL] ? null : JSON.stringify(bank));
        record('экран итогов говорит «Выучено: 1»', /Выучено\s*1/.test(итог.строки) ? null : итог.строки);
        record('копилка пуста — так и сказано', /пуста/i.test(итог.надпись) ? null : итог.надпись);
        record('повторять нечего — кнопки «Ещё раз» нет', итог.ещё === 'none' ? null : итог.ещё);
    }

    console.log('\nОшибка в повторе начинает счёт дней заново');
    {
        await сначала();
        await положить({ [SIG_MUL]: запись('integer+:mul:3', ПРИМЕР_УМНОЖЕНИЯ, [вчера]),
                         [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ, [вчера], { w: 35, e: 'как было' }) });
        await page.evaluate(`startRepeatMission()`);
        await page.waitForTimeout(150);
        const кадры = [];
        // В очереди сначала обе записи (обе «вчерашние», давность равная — порядок
        // по подписи): сложение, потом умножение. Ошибаемся в обоих.
        for (let i = 0; i < 2; i++) {
            const k = await экран();
            кадры.push(k);
            const ответ = await ответить(false);
            k.ответ = ответ;
        }
        const bank = await копилка();
        const mul = bank.items[SIG_MUL], add = bank.items[SIG_ADD];
        const кУмн = кадры.find(k => k.запись === SIG_MUL);
        record('запись осталась, вчерашний день стёрт',
               mul && add && same(mul.ok, []) && same(add.ok, []) ? null : JSON.stringify(bank.items));
        record('время ошибки обновилось', mul && mul.t > давно && add.t > давно ? null : 'время прежнее');
        record('свой пример (умножение) — ответ ученика записан',
               mul && кУмн && String(mul.w) === кУмн.ответ ? null : `${mul && mul.w} / ${кУмн && кУмн.ответ}`);
        record('похожий пример (сложение) — ответ к записи не приклеен',
               add && add.w === 35 && add.e === 'как было' ? null : JSON.stringify(add));
    }

    console.log('\nДве ошибки в одной записи за миссию');
    {
        // Первый раз похожего не нашлось — показан сам пример, и ответ ученика
        // записан. Второй раз показан похожий, и ошибка в нём не должна вернуть в
        // запись ответ, который был до миссии.
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ, [], { w: 35 }) });
        await page.evaluate(`(() => {
            const real = generateProblem;
            generateProblem = () => ({ text: '31 + 2', answer: 33, a: 31, b: 2 });   // другой тип
            try { startRepeatMission(); } finally { generateProblem = real; }
        })()`);
        const первый = await экран();
        const ответ = await ответить(false);
        const второй = await экран();
        await ответить(false);
        const it = (await копилка()).items[SIG_ADD];
        record('первый раз — сам пример, второй — похожий',
               первый.вопрос === '38 + 7' && второй.вопрос !== '38 + 7' ? null : `${первый.вопрос} / ${второй.вопрос}`);
        record('в записи остался ответ на сам пример, а не прежний',
               it && String(it.w) === ответ ? null : `в записи ${it && it.w}, ответ был ${ответ}`);
    }

    console.log('\nМиссию завершили раньше');
    {
        // Итог считает только то, что побывало на экране. Пример, засчитанный
        // сегодня в другой миссии и в эту так и не попавший, к ней не относится.
        await сначала();
        await положить({ [SIG_MUL]: запись('integer+:mul:3', ПРИМЕР_УМНОЖЕНИЯ, []),
                         'integer+:mul:3|6 × 7': запись('integer+:mul:3', { text: '6 × 7', answer: 42, a: 6, b: 7 }, [сегодня]) });
        await page.evaluate(`startRepeatMission(); finishChallenge(); null`);
        await page.waitForTimeout(200);
        const строки = await page.evaluate(`document.getElementById('winRows').innerText`);
        record('непоказанный пример в итог не попал', !/Повтори завтра/.test(строки) ? null : строки);
    }

    console.log('\nВыучил и тут же ошибся — пример возвращается');
    {
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ, [вчера]) });
        await page.evaluate(`startRepeatMission()`);
        await page.waitForTimeout(150);
        await ответить(true);
        const посреди = await копилка();
        await ответить(false);
        const после = await копилка();
        record('верный ответ сегодня — выучен', !посреди.items[SIG_ADD] ? null : 'не выучен');
        record('ошибка в том же типе следом — снова в копилке',
               после.items[SIG_ADD] && same(после.items[SIG_ADD].ok, []) ? null : JSON.stringify(после));
    }

    console.log('\n«Ещё раз» после повтора — снова повтор');
    {
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ) });
        await page.evaluate(`startRepeatMission()`);
        await page.waitForTimeout(150);
        for (let i = 0; i < 3; i++) { await ответить(true); await page.waitForTimeout(60); }
        await page.waitForTimeout(300);
        const видна = await page.evaluate(`getComputedStyle(document.getElementById('btnWinAgain')).display !== 'none'`);
        record('ошибки остались — кнопка «Ещё раз» есть', видна ? null : 'кнопки нет');
        await page.evaluate(`winPlayAgain()`);
        await page.waitForTimeout(150);
        const k = await экран();
        record('и она запускает повтор, а не обычную миссию',
               k.идёт && k.запись === SIG_ADD && /^🔁/.test(k.цель) ? null : JSON.stringify(k));
    }

    console.log('\nПосле повтора игра та же, что была');
    {
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ) });
        await page.evaluate(`exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
                             exampleConfig.operations = { div: 1 }; startRepeatMission(); null`);
        await page.waitForTimeout(150);
        await ответить(true);
        // Ушёл посреди миссии — через «Сменить миссию», как из меню паузы.
        await page.evaluate(`resetSessionCounters(); null`);
        const r = await page.evaluate(`({ выбор: JSON.stringify(exampleConfig), повтор: repeatRun, подложено: forcedProblem })`);
        record('ушёл посреди повтора — выбор миссии вернулся',
               r.выбор === JSON.stringify({ category: 'integer', numberType: 'positive', operations: { div: 1 } }) ? null : r.выбор);
        record('и сам повтор закончился', r.повтор === null && r.подложено === null ? null : JSON.stringify(r));
        await page.evaluate(`document.getElementById('configScreen').style.display = 'none'; startGame(); null`);
        await page.waitForTimeout(150);
        const k = await экран();
        record('следующая обычная миссия — обычная',
               k.запись === null && !/^🔁/.test(k.цель) && /÷/.test(k.вопрос) ? null : JSON.stringify(k));
    }

    console.log('\nПовтор без подсказок и мимо закрытых ворот');
    {
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ) });
        await page.evaluate(`trainWanted = true; startRepeatMission(); null`);
        await page.waitForTimeout(150);
        const r = await page.evaluate(`({ обучение: trainActive, подсказка: document.getElementById('trainHint').style.display })`);
        record('включённые подсказки в повтор не переходят', r.обучение === false ? null : JSON.stringify(r));

        // Работы на сервере: миссию не пускают. Собранный повтор не должен достаться
        // следующей обычной миссии, когда работы кончатся.
        await сначала();
        await положить({ [SIG_ADD]: запись('integer+:add:3', ПРИМЕР_СЛОЖЕНИЯ) });
        await page.evaluate(`window.MAINTENANCE = { until: new Date(Date.now() + 600000).toISOString() };
                             startRepeatMission(); null`);
        const закрыто = await page.evaluate(`!gameActive`);
        await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();
            exampleConfig.category = 'integer'; exampleConfig.numberType = 'positive';
            exampleConfig.operations = { div: 1 };
            document.getElementById('configScreen').style.display = 'none'; startGame(); null`);
        await page.waitForTimeout(150);
        const k = await экран();
        record('во время работ повтор не начинается', закрыто ? null : 'игра пошла');
        record('и после работ обычная миссия остаётся обычной',
               k.идёт && k.запись === null && /÷/.test(k.вопрос) ? null : JSON.stringify(k));
    }

    record('всё это прошло без ошибок в консоли', errors.length ? errors.slice(0, 3).join(' | ') : null);

    await b.close();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) {
        failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`));
        process.exit(1);
    }
})().catch(e => { console.error(e); process.exit(1); });
