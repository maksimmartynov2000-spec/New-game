// НАСТОЯЩИЙ МИНУС НА ЭКРАНЕ. В живом браузере.
//
// В отрицательных всё держится на знаке, а дефис «-» — короткая чёрточка, которая
// теряется: «-3» читается как «3». Теперь везде, где ученик видит целые числа, стоит
// настоящий «−» (U+2212): в примере, на кнопках ответов, в экзамене, в разборе
// ошибок и в копилке. Проверяется и обратная сторона: это только вид — ключи
// ответов и проверка остались прежними, и верная кнопка по-прежнему верная.
//
// Как запускать:  node test/minus-sign.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MINUS = '−';

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

// Проводка, которую глазом не увидеть: варианты ответа строятся по самому примеру
// (запись со скобками — своя типичная ошибка), и в игре, и в экзамене.
console.log('\nПроводка');
record('варианты в игре строятся по самому примеру',
    /buildDistractors\(opKey, problem\.a, problem\.b, correctAnswer, isNegative, 3, level, problem\)/.test(HTML)
        ? null : 'в игре buildDistractors зовётся без примера');
record('варианты в экзамене строятся по самому примеру',
    /buildDistractors\(op, problem\.a, problem\.b, problem\.answer, neg, 3, level, problem\)/.test(HTML)
        ? null : 'в экзамене buildDistractors зовётся без примера');
record('вопрос экзамена — с настоящим минусом',
    /examQuestion'\)\.innerText = showMinus\(problem\.text\)/.test(HTML) ? null : 'вопрос экзамена мимо showMinus');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — живые проверки минуса пропущены.');
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
    await page.waitForFunction(`typeof startGame === 'function' && typeof renderMaintenance === 'function'`);
    // Всё открыто только репетитору — им и играем.
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); playAsGuest();
                         Progress.setAccountType('self'); null`);

    // Миссия в клетке; forced — пример, который игра отдаст первым.
    const mission = (sign, op, level, forced) => page.evaluate(`(() => {
        if (gameActive) finishChallenge();
        document.getElementById('winScreen').classList.remove('active');
        resetSessionCounters();
        exampleConfig.category = 'integer';
        exampleConfig.numberType = ${JSON.stringify(sign === '-' ? 'negative' : 'positive')};
        exampleConfig.operations = { ${op}: ${level} };
        ${forced ? `forcedProblem = ${JSON.stringify(forced)};` : ''}
        document.getElementById('configScreen').style.display = 'none';
        startGame();
        const key = answerKey(correctAnswer);
        return {
            text: currentProblem.text,
            question: document.getElementById('mathQuestion').innerText,
            buttons: [...document.querySelectorAll('#answersGrid .btn-answer')].map(x => ({ label: x.innerText, key: x.dataset.key })),
            rightKey: key, answer: correctAnswer
        };
    })()`);

    console.log('\nПример и кнопки');
    let found = null;
    for (let i = 0; i < 40 && !found; i++) {
        const v = await mission('-', 'sub', 3);
        if (v.text.indexOf('-') >= 0 && v.buttons.some(x => x.key.indexOf('-') >= 0)) found = v;
    }
    await check('в отрицательном примере минус настоящий', () => {
        assert(found, 'за 40 миссий не нашлось примера с минусом — проверка ничего не проверила');
        assert(found.question.indexOf('-') < 0, `дефис в примере: «${found.question}»`);
        eq(found.question, found.text.replace(/-/g, MINUS), 'пример на экране');
    });
    await check('на кнопках минус настоящий, а ключи ответов прежние', () => {
        // Ключ числа — «N» и само число, как и раньше: «N-5».
        found.buttons.forEach(x => {
            assert(x.label.indexOf('-') < 0, `дефис на кнопке: «${x.label}»`);
            assert(x.key[0] === 'N', `ключ кнопки не числовой: ${x.key}`);
            eq(x.label, x.key.slice(1).replace(/-/g, MINUS), 'подпись кнопки');
        });
        assert(found.buttons.some(x => x.label.indexOf(MINUS) >= 0), 'ни на одной кнопке нет минуса');
    });
    const before = await page.evaluate(`correctCount`);
    await page.evaluate(`(() => { const key = answerKey(correctAnswer);
        [...document.querySelectorAll('#answersGrid .btn-answer')].find(x => x.dataset.key === key).click(); })()`);
    const after = await page.evaluate(`correctCount`);
    await check('верная кнопка по-прежнему засчитывается верной', () => eq(after, before + 1, 'верных'));

    const brackets = await mission('-', 'sub', 4, { text: '5 - (-3)', answer: 8, a: 5, b: -3 });
    await check('скобки — тоже с настоящим минусом: «5 − (−3)»', () => eq(brackets.question, `5 ${MINUS} (${MINUS}3)`, 'пример'));

    const positive = await mission('+', 'sub', 2, { text: '19 - 13', answer: 6, a: 19, b: 13 });
    await check('и у положительных вычитание с настоящим минусом: «19 − 13»', () => eq(positive.question, `19 ${MINUS} 13`, 'пример'));

    console.log('\nРазбор ошибок, экзамен и копилка');
    const wrong = await mission('-', 'sub', 1, { text: '3 - 8', answer: -5, a: 3, b: 8 });
    await page.evaluate(`(() => { const key = answerKey(correctAnswer);
        [...document.querySelectorAll('#answersGrid .btn-answer')].find(x => x.dataset.key !== key).click(); })()`);
    const snap = await page.evaluate(`sessionMistakes.length ? { q: sessionMistakes[0].questionHtml,
        opts: sessionMistakes[0].options.map(o => o.html).join(' ') } : null`);
    await check('в разборе ошибок пример и варианты — такие же, как были на экране', () => {
        assert(snap, 'ошибка не попала в разбор');
        assert(snap.q.indexOf('-') < 0 && snap.q.indexOf(MINUS) >= 0, `пример в разборе: «${snap.q}»`);
        assert(snap.opts.indexOf('-') < 0, `варианты в разборе: «${snap.opts}»`);
        assert(wrong.question === `3 ${MINUS} 8`, wrong.question);
    });

    const examLabels = await page.evaluate(`examOptions({ text: '3 - 8', answer: -5, a: 3, b: 8 }, 'sub', 2, true)
        .options.map(o => o.label)`);
    await check('варианты экзамена — с настоящим минусом', () => {
        assert(examLabels.every(l => l.indexOf('-') < 0), `дефис в вариантах: ${examLabels.join(', ')}`);
        assert(examLabels.indexOf(`${MINUS}5`) >= 0, `нет ответа «−5»: ${examLabels.join(', ')}`);
    });

    const bankText = await page.evaluate(`(() => {
        if (gameActive) finishChallenge();
        const bank = Progress.getBank();
        Object.keys(bank.items).forEach(k => delete bank.items[k]);
        const meta = { category: 'integer', isNegative: true, opKey: 'sub', level: 1 };
        const p = { text: '3 - 8', answer: -5, a: 3, b: 8 };
        bank.items[problemSig(meta, p)] = { k: 'integer-:sub:1', p, w: -11, e: 'спутал модули', t: Date.now(), ok: [] };
        renderRepeatCard();
        return [...document.querySelectorAll('#repeatList .repeat-item-ex')].map(x => x.innerText);
    })()`);
    await check('в списке копилки — тоже настоящий минус', () => {
        eq(bankText.join(' | '), `3 ${MINUS} 8`, 'пример в списке');
    });

    await check('всё это прошло без ошибок в консоли', () => eq(errors.join(' | '), '', 'ошибки'));

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
