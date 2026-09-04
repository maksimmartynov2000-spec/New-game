// Тесты задач за мастерство.
//
// Зачем: это награда за самую дорогую вещь в игре — минимум из трёх лесенок,
// доведённый до алмаза. Она обязана появиться ровно один раз и ровно за ту клетку,
// за которую заработана, и обязана НЕ появиться, если текстов нет: файл внешний.
//
// Отдельно стережём главное решение: доступность считается из уже имеющихся
// достижений, никакого нового поля в сохранении. Стоит завести своё поле — и у трёх
// живых учеников появится риск, которого сейчас нет.
//
// Как запускать:  node test/challenges.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

function loadContent() {
    const box = { window: {} };
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content', 'challenges.js'), 'utf8'), box,
        { filename: 'content/challenges.js' });
    return box.window.CHALLENGE_CONTENT;
}

function makeDoc() {
    const byId = {};
    const el = (id) => (byId[id] = { id, hidden: false, _text: '',
        get innerText() { return this._text; }, set innerText(v) { this._text = String(v); },
        classList: { list: [], add(c) { this.list.push(c); }, remove(c) { this.list = this.list.filter(x => x !== c); },
                     contains(c) { return this.list.includes(c); } } });
    ['challengeReveal', 'challengeCap', 'challengeTopic', 'challengeTask', 'challengeAnswer',
     'challengeAnswerCap', 'challengeAnswerValue', 'challengeAnswerWhy',
     'challengeTap', 'winScreen'].forEach(el);
    return { doc: { getElementById: (id) => byId[id] || null }, byId };
}

function load(windowObj, opts) {
    const o = opts || {};
    const dom = makeDoc();
    const box = {
        console, Math, Number, Object, Array, String,
        window: windowObj, LANG: 'ru',
        t: (x) => x,
        tf: function (x) { let r = x; for (let i = 1; i < arguments.length; i++) r = r.split('%' + i).join(String(arguments[i])); return r; },
        TIER_ICONS: ['', '🥉', '🥈', '🥇', '💎', '👑'],
        MASTERY_MIN_TIER: 4,
        topicMasteryTier: (unlocks, key) => (unlocks && unlocks[key]) || 0,
        topicLabelWithLevel: (key) => key,
        showNextPuzzleReveal: () => !!o.puzzleFirst && !(box.puzzleShown = true),
        // Экран итогов теперь заодно проверяет, не начались ли технические работы.
        showStarUnlock: () => false,
        renderMaintenance: () => false,
        document: dom.doc
    };
    const src = slice('// ===================== ЗАДАЧИ ЗА МАСТЕРСТВО',
                      '// Показывает плашку о новом достижении', 'задачи')
        + ';globalThis.R = { challengeFor, earnedChallenges, showNextChallengeReveal,'
        + ' tapChallengeReveal, advanceMissionReveals, resolveChallenges,'
        + ' push: (k, t) => pendingChallengeReveals.push({ key: k, tier: t }),'
        + ' queued: () => pendingChallengeReveals.length };';
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<задачи>' });
    box.dom = dom;
    return box;
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }

const CONTENT = loadContent();
const RU = CONTENT.ru;
const CELLS = Object.keys(RU);

group('Содержимое');

test('задача есть у каждой клетки положительных чисел', () => {
    ['add', 'sub', 'mul', 'div'].forEach(op => {
        for (let lvl = 1; lvl <= 5; lvl++) {
            const key = `integer+:${op}:${lvl}`;
            assert(RU[key], `нет задач для ${key}`);
        }
    });
    eq(CELLS.length, 20, 'клеток должно быть двадцать');
});

test('у каждой клетки две задачи: за алмаз и за легенду', () => {
    CELLS.forEach(key => {
        ['diamond', 'legend'].forEach(tier => {
            const item = RU[key][tier];
            assert(item && item.task && item.answer, `${key}: нет ${tier}`);
        });
    });
});

test('условие короткое, ответ отдельно от разбора', () => {
    // Ответ ученик ищет глазами, и он не должен тонуть в объяснении.
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const item = RU[key][tier];
        assert(item.task.length <= 200, `${key} ${tier}: условие ${item.task.length} знаков — длинновато`);
        assert(item.answer.length <= 40, `${key} ${tier}: ответ ${item.answer.length} знаков — это уже разбор`);
        assert(item.why && item.why.length >= 40, `${key} ${tier}: разбор пустой или слишком короткий`);
        assert(item.answer !== item.task, `${key} ${tier}: ответ повторяет условие`);
        assert(!/\.$/.test(item.answer), `${key} ${tier}: у короткого ответа точки в конце быть не должно`);
    }));
});

test('у каждой задачи три части: условие, ответ, разбор', () => {
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const item = RU[key][tier];
        ['task', 'answer', 'why'].forEach(f => {
            assert(typeof item[f] === 'string' && item[f].trim(), `${key} ${tier}: пусто поле ${f}`);
        });
    }));
});

test('условие спрашивает', () => {
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        assert(/[?]/.test(RU[key][tier].task), `${key} ${tier}: условие ничего не спрашивает`);
    }));
});

test('ответ отделён от разбора и в карточке достижений', () => {
    // Два места показа не должны разъехаться: и там, и там сначала «Ответ», потом число.
    const from = SCRIPT.indexOf('earnedChallenges(unlocks, key).forEach');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('return card;', from));
    assert(/ladder-challenge-answer-value/.test(body), 'нет отдельной строки ответа');
    assert(/ladder-challenge-answer-why/.test(body), 'нет отдельной строки разбора');
    assert(/item\.why/.test(body), 'разбор не берётся из задачи');
});

test('задачи не повторяются', () => {
    const seen = {};
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const t = RU[key][tier].task;
        assert(!seen[t], `задача повторяется: ${key} ${tier} и ${seen[t]}`);
        seen[t] = `${key} ${tier}`;
    }));
});

group('Что и когда открыто');

const H = load({ CHALLENGE_CONTENT: CONTENT });

test('до алмаза задач нет', () => {
    eq(H.R.earnedChallenges({ 'integer+:add:1': 3 }, 'integer+:add:1').length, 0);
});

test('за алмаз открывается одна', () => {
    const got = H.R.earnedChallenges({ 'integer+:add:1': 4 }, 'integer+:add:1');
    eq(got.length, 1);
    eq(got[0].tier, 4);
});

test('за легенду открываются обе', () => {
    const got = H.R.earnedChallenges({ 'integer+:add:1': 5 }, 'integer+:add:1');
    eq(got.length, 2, 'алмазную задачу не отбирают');
    eq(got[1].tier, 5);
});

test('доступность считается из достижений, а не из своего поля', () => {
    // Стоит завести отдельное хранилище — и у живых учеников появится риск.
    const body = slice('function earnedChallenges', 'let pendingChallengeReveals', 'earnedChallenges');
    assert(/topicMasteryTier/.test(body), 'должна опираться на уже посчитанное мастерство');
    assert(!/Progress\.(set|get)Collection|localStorage/.test(body), 'своего хранилища быть не должно');
});

test('у чужой клетки задачи нет', () => {
    eq(H.R.challengeFor('decimal+:mul:2', 4), null);
    eq(H.R.challengeFor('integer-:add:1', 4), null);
});

group('Показ после миссии');

test('карточка показывается с условием и без ответа', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:mul:3', 4);
    eq(box.R.showNextChallengeReveal(), true);
    eq(box.dom.byId.challengeReveal.hidden, false, 'окно должно открыться');
    eq(box.dom.byId.challengeTask.innerText, RU['integer+:mul:3'].diamond.task);
    eq(box.dom.byId.challengeAnswerValue.innerText, RU['integer+:mul:3'].diamond.answer);
    eq(box.dom.byId.challengeAnswerWhy.innerText, RU['integer+:mul:3'].diamond.why);
    eq(box.dom.byId.challengeAnswer.hidden, true, 'ответ закрыт до тапа');
});

test('первый тап раскрывает ответ, второй закрывает', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:mul:3', 4);
    box.R.showNextChallengeReveal();
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeAnswer.hidden, false, 'ответ должен раскрыться');
    eq(box.dom.byId.challengeReveal.hidden, false, 'окно ещё не закрывается');
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeReveal.hidden, true, 'второй тап закрывает');
});

test('после последней задачи открывается экран итогов', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:div:1', 4);
    box.R.showNextChallengeReveal();
    box.R.tapChallengeReveal();
    box.R.tapChallengeReveal();
    assert(box.dom.byId.winScreen.classList.contains('active'), 'экран итогов должен показаться');
});

test('две ступени разом показываются по очереди', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:add:2', 4);
    box.R.push('integer+:add:2', 5);
    box.R.showNextChallengeReveal();
    eq(box.dom.byId.challengeTask.innerText, RU['integer+:add:2'].diamond.task);
    box.R.tapChallengeReveal();
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeTask.innerText, RU['integer+:add:2'].legend.task, 'вторая задача');
    assert(!box.dom.byId.winScreen.classList.contains('active'), 'итоги ждут своей очереди');
});

test('заголовок отличает легенду от алмаза', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:sub:5', 5);
    box.R.showNextChallengeReveal();
    assert(/👑/.test(box.dom.byId.challengeCap.innerText), box.dom.byId.challengeCap.innerText);
});

group('Очередь и постановка в неё');

test('в очередь попадает каждая новая ступень, а не только верхняя', () => {
    // Алмаз и легенда могут прийти одним ответом. Если ставить в очередь только
    // верхнюю, алмазная задача потеряется молча и навсегда.
    const from = SCRIPT.indexOf('if (mastery > masteryBefore && mastery >= MASTERY_MIN_TIER)');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('return fresh;', from));
    assert(/for \(let tier = masteryBefore \+ 1; tier <= mastery/.test(body),
        'перебирать надо все ступени от прошлой до новой');
});

test('очередь задач чистится вместе со счётчиками миссии', () => {
    // Иначе задача из прошлой миссии всплывёт в конце следующей.
    const from = SCRIPT.indexOf('function resetSessionCounters');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('\n        }', from));
    assert(/pendingChallengeReveals = \[\]/.test(body), 'очередь должна обнуляться');
    assert(/challengeReveal'\)\.hidden = true/.test(body), 'окно должно закрываться');
});

group('Когда текстов нет');

test('без файла с задачами мастерство просто не даёт карточку', () => {
    const box = load({});
    eq(box.R.challengeFor('integer+:add:1', 4), null);
    box.R.push('integer+:add:1', 4);
    eq(box.R.showNextChallengeReveal(), false, 'показывать нечего');
});

test('пустая очередь ведёт прямо к итогам', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.advanceMissionReveals();
    assert(box.dom.byId.winScreen.classList.contains('active'));
});

test('пазлы показываются раньше задач', () => {
    // Иначе задача перебивает картинку, ради которой собирали сто кусочков.
    const body = slice('function advanceMissionReveals', '// Показывает плашку', 'очередь наград');
    const puzzleAt = body.indexOf('showNextPuzzleReveal');
    const challengeAt = body.indexOf('showNextChallengeReveal');
    assert(puzzleAt > 0 && challengeAt > puzzleAt, 'пазл должен идти первым');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
