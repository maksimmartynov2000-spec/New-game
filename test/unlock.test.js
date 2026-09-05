// Тесты уведомления «Открыта N★!».
//
// Зачем отдельным файлом: плашка об открытой звезде рождается в evaluateTopicLadders,
// а этот кусок лежит за границей, по которой режет ladders.test.js, — до него не
// дотягивался ни один загрузчик, и потому баг прожил незамеченным.
//
// А баг был такой: плашка смотрела ТОЛЬКО на ворота прогресса (золото по точности и
// количеству на предыдущей звезде). Но закрытой звезду делают три разные причины, и
// ворота — лишь одна из них. Отсюда три вранья сразу:
//   1) у репетитора ворот нет вовсе, все звёзды открыты с самого начала, — а ему
//      всё равно объявляли «Открыта 4★!»;
//   2) ученику, которому звезду открыли руками, объявляли её открытие второй раз;
//   3) худшее: ученику, у которого в доступе только 1–3★, обещали «Открыта 4★!»,
//      а за ней стоял замок.
// Ниже проверены все три случая.
//
// Как запускать:  node test/unlock.test.js

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

// Сценарий описывает мир вокруг темы: кто играет, что ему открыто и что намерили
// лесенки. Всё остальное — заглушки: здесь проверяется ОДНО решение (показывать
// плашку или нет), а не правила выдачи наград, у них свой файл.
function run(scenario) {
    const S = Object.assign({
        topicKey: 'integer+:add:2',
        gateApplies: true,     // false — это личный аккаунт репетитора, ворот нет
        access: null,          // null — открыто всё; массив — только эти звёзды
        named: [],             // звёзды, открытые репетитором вручную
        target: { a: 3, c: 3, s: 0 }
    }, scenario || {});

    const store = Object.assign({}, S.unlocks || {});
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        TIER_ICONS: ['', '🥉', '🥈', '🥇', '💎', '👑'],
        TIER_NAMES: ['', 'Бронза', 'Серебро', 'Золото', 'Алмаз', 'Легенда'],
        MASTERY_MIN_TIER: 4,
        LADDERS: [{ id: 'c', name: 'Количество' }, { id: 'a', name: 'Точность' }, { id: 's', name: 'Скорость' }],
        Progress: {
            get: () => ({}),
            getUnlocks: () => store,
            unlock: (key) => (store[key] ? false : (store[key] = true))
        },
        topicMasteryTier: () => 0,
        topicMetrics: () => ({ count: 100, accuracy: 95, speedSec: 5 }),
        ladderTierEarned: (unlocks, key, id) => {
            let top = 0;
            for (let tier = 1; tier <= 5; tier++) if (unlocks[`${key}:${id}${tier}`]) top = tier;
            return top;
        },
        ladderTierByMetrics: (id) => S.target[id] || 0,
        sessionGoal: () => null,
        pluralAnswers: () => 'ответов',
        challengeFor: () => null,
        pendingChallengeReveals: [],
        // Тот же порядок причин, что и в приложении: сперва доступ, потом ворота,
        // и отдельно — звезда, названная репетитором поимённо.
        isLevelOpen: (secKey, op, lvl) => {
            if (S.access && S.access.indexOf(lvl) < 0) return false;
            if (!S.gateApplies) return true;
            if (S.named.indexOf(lvl) >= 0) return true;
            if (lvl <= 1) return true;
            const prev = `${secKey}:${op}:${lvl - 1}`;
            return !!store[`${prev}:a3`] && !!store[`${prev}:c3`];
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(
        slice('function parseTopicKey(key) {', '// Ключ для ОТОБРАЖЕНИЯ', 'разбор ключа')
        + slice('function evaluateTopicLadders(topicKey) {', '// ===================== ЗАДАЧИ ЗА МАСТЕРСТВО', 'лесенки темы')
        + '\n;globalThis.evaluateTopicLadders = evaluateTopicLadders;',
        sandbox, { filename: 'index.html<плашка звезды>' });

    const fresh = sandbox.evaluateTopicLadders(S.topicKey);
    return {
        fresh,
        gate: fresh.filter(x => /:gate$/.test(x.id))[0] || null,
        titles: fresh.map(x => x.title)
    };
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

group('Когда звезда правда открывается');

test('ученик добрал золото — плашка есть и называет следующую звезду', () => {
    const r = run({});
    assert(r.gate, 'плашки нет, а звезда открылась');
    eq(r.gate.title, 'Открыта 3★!', 'номер звезды');
});

test('вместе с плашкой приходят и обычные ступени лесенок', () => {
    const r = run({});
    assert(r.fresh.length > 1, 'кроме плашки не пришло ничего');
});

group('Когда открывать нечего — молчим');

test('у репетитора ворот нет, звезда была открыта — плашки нет', () => {
    const r = run({ gateApplies: false });
    assert(r.fresh.length, 'ступени лесенок должны прийти и репетитору');
    eq(r.gate, null, 'репетитору объявили открытие того, что и так открыто');
});

test('звезда открыта репетитором вручную — второй раз не объявляем', () => {
    const r = run({ named: [3] });
    eq(r.gate, null, 'объявили открытие звезды, открытой руками');
});

test('звезды нет в доступе — не обещаем того, за чем стоит замок', () => {
    const r = run({ access: [1, 2] });
    assert(r.fresh.length, 'ступени лесенок приходят и здесь');
    eq(r.gate, null, 'пообещали звезду, которой у ученика нет');
});

test('на пятой звезде следующей не бывает', () => {
    const r = run({ topicKey: 'integer+:add:5' });
    eq(r.gate, null, 'объявили несуществующую 6★');
});

test('золото уже было взято раньше — плашка не повторяется', () => {
    const r = run({ unlocks: { 'integer+:add:2:a3': true, 'integer+:add:2:c3': true } });
    eq(r.gate, null, 'повторили объявление об уже открытой звезде');
});

group('Та же подпись в карточке достижений');

test('подпись «N★ открыта» тоже сверяется с доступом, а не с воротами', () => {
    const card = slice('const foot = card.querySelector', 'Задачи за мастерство', 'подвал карточки');
    assert(/isLevelOpen\(/.test(card),
        'подвал карточки решает по воротам — ученику без доступа он напишет «открыта» про замок');
    assert(card.indexOf('откроет репетитор') >= 0,
        'нет честного текста для случая, когда золото взято, а звезды в доступе нет');
});

group('Доступ к разделам выдаётся напрямую');

// Разделы открывает репетитор кнопкой ⭐ в карточке ученика — доступ меняется сразу.
// Одноразовые коды были вторым путём к тому же самому: репетитор выдавал код, ученик
// его вводил. Второй путь убран целиком, и эти проверки стерегут, чтобы он не отрос
// обратно наполовину — например, кнопкой без обработчика.
test('в приложении не осталось ни одного пути выдачи через код', () => {
    const found = (HTML.match(/access_code/g) || []).length;
    eq(found, 0, `упоминаний access_code осталось ${found}`);
});

test('прямая выдача доступа на месте', () => {
    assert(HTML.indexOf('set_student_access') >= 0,
        'исчезла прямая выдача — открывать разделы стало нечем');
});

test('у каждой кнопки в карточке ученика есть обработчик, и наоборот', () => {
    // Кнопки объявляются в разметке строки, а слушатели вешаются ниже по одному.
    // Убрать одно и забыть другое — значит получить либо мёртвую кнопку, либо
    // падение на querySelector(null). Ни того, ни другого в самой строке не видно.
    const all = HTML.match(/\[?data-act="[a-z]+"\]?/g) || [];
    const name = (x) => x.replace(/[^a-z]/g, '').replace(/^dataact/, '');
    const marks = new Set(all.filter(x => x[0] !== '[').map(name));
    const handlers = new Set(all.filter(x => x[0] === '[').map(name));
    assert(marks.size > 0, 'кнопки в карточке ученика не нашлись — изменилась разметка');
    const dead = [...marks].filter(x => !handlers.has(x));
    const lost = [...handlers].filter(x => !marks.has(x));
    eq(dead.join(',') + '|' + lost.join(','), '|',
        `кнопки без обработчика: [${dead}]; обработчики без кнопок: [${lost}]`);
});


group('Окно открытой звезды');

// Золото, открытая звезда и следующая миссия жили порознь: о звезде сообщала плашка
// посреди примеров, она пролетала за три секунды, и связь «набрал золото → открылось
// следующее» не складывалась. Теперь после миссии показывается окно с переходом.
//
// Опасных мест два. Первое: окно должно идти ПОСЛЕДНИМ в очереди наград — из него
// уходят играть, и всё, что показалось бы после, ученик просто не увидит. Второе:
// пока миссию доигрывали, доступ мог измениться, и обещать звезду, которой больше
// нет, нельзя.
function starBox(opts) {
    const o = opts || {};
    const vm = require('vm');
    const nodes = {};
    const el = () => ({ hidden: true, innerText: '', onclick: null, style: {},
                        classList: { add() {}, remove() {} } });
    ['starUnlock', 'starUnlockCap', 'starUnlockTopic', 'starUnlockText',
     'starUnlockNext', 'starUnlockStay', 'starUnlockMenu', 'winScreen',
     'mistakesScreen', 'configScreen'].forEach(id => (nodes[id] = el()));
    const box = {
        console, Math, Number, Object, Array, String, JSON,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        document: { getElementById: (id) => nodes[id] || null },
        isLevelOpen: () => (o.open === undefined ? true : o.open),
        topicLabelWithLevel: (k) => k,
        startGame: () => (box.started = true),
        resetSessionCounters() {}, resetConfigScreen() {}, refreshSectionLocks() {},
        renderDailyBar() {}, showToast: (m) => (box.toast = m),
        Progress: { flush() {}, setConfig: (c) => (box.config = JSON.parse(JSON.stringify(c))) },
        exampleConfig: { category: 'integer', numberType: 'positive', operations: {} },
        sessionMistakes: [],
        showNextPuzzleReveal: () => !!o.puzzle,
        showNextChallengeReveal: () => !!o.challenge
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(
        slice('function parseTopicKey(key) {', '// Ключ для ОТОБРАЖЕНИЯ', 'разбор ключа')
        + slice('function parseSectionKey(secKey) {', '\n\n', 'разбор ключа раздела')
        + slice('// ===================== ОТКРЫЛАСЬ ЗВЕЗДА', '\n        // Очередь наград после миссии', 'окно звезды')
        + slice('        function advanceMissionReveals() {', '\n\n', 'очередь наград')
        + '\n;globalThis.S = { showStarUnlock, advanceMissionReveals,'
        + ' set pending(v) { pendingStarUnlock = v; }, get pending() { return pendingStarUnlock; } };',
        box, { filename: 'index.html<окно звезды>' });
    return { box, nodes, S: box.S };
}

test('после золота окно показывается и называет обе звезды', () => {
    const w = starBox();
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    assert(w.S.showStarUnlock(), 'окно должно показаться');
    assert(!w.nodes.starUnlock.hidden, 'окно осталось скрытым');
    eq(w.nodes.starUnlockCap.innerText, '🔓 Открыта 4★!', 'заголовок');
    eq(w.nodes.starUnlockNext.innerText, '🚀 Играть на 4★', 'кнопка вверх');
    eq(w.nodes.starUnlockStay.innerText, '↩️ Ещё раз на 3★', 'кнопка остаться');
});

test('нечего показывать — окна нет', () => {
    const w = starBox();
    eq(w.S.showStarUnlock(), false, 'без открытой звезды окна быть не должно');
});

test('окно показывается один раз, а не при каждом заходе', () => {
    const w = starBox();
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    w.S.showStarUnlock();
    eq(w.S.showStarUnlock(), false, 'окно повторилось');
});

test('доступ отозвали, пока доигрывали, — звезду не обещаем', () => {
    const w = starBox({ open: false });
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    eq(w.S.showStarUnlock(), false, 'пообещали звезду, которой больше нет');
    assert(w.nodes.starUnlock.hidden, 'окно всё-таки показалось');
});

test('на пятой звезде подниматься некуда — кнопки вверх нет', () => {
    const w = starBox();
    w.S.pending = { key: 'integer+:add:5', level: 6 };
    w.S.showStarUnlock();
    assert(w.nodes.starUnlockNext.hidden, 'предложили шестую звезду');
});

test('«Играть на N★» уходит в миссию ровно с одной звездой', () => {
    const w = starBox();
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    w.S.showStarUnlock();
    w.nodes.starUnlockNext.onclick();
    assert(w.box.started, 'миссия не началась');
    eq(JSON.stringify(w.box.config.operations), '{"add":4}', 'настройки миссии');
});

test('«Ещё раз» возвращает на ту же звезду, а не на новую', () => {
    const w = starBox();
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    w.S.showStarUnlock();
    w.nodes.starUnlockStay.onclick();
    eq(JSON.stringify(w.box.config.operations), '{"add":3}', 'настройки миссии');
});

test('звезда идёт после пазлов и задач, а не вместо них', () => {
    // Из окна звезды уходят играть — всё, что показалось бы после, ученик не увидит.
    const w = starBox({ puzzle: true });
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    w.S.advanceMissionReveals();
    assert(w.nodes.starUnlock.hidden, 'звезда перебила пазл');
    const w2 = starBox({ challenge: true });
    w2.S.pending = { key: 'integer+:add:3', level: 4 };
    w2.S.advanceMissionReveals();
    assert(w2.nodes.starUnlock.hidden, 'звезда перебила задачу за мастерство');
});


group('Кнопка «Играть» и раздел');

// Это была настоящая поломка, прожившая четыре мержа. Кнопке передавали ключ раздела,
// но разобрать его было нечем: startMissionAt задавал действие и звезду, а раздел —
// нет. Возврат на экран выбора миссии обнуляет exampleConfig, поэтому миссия уходила
// в клетку «null+»: мимо задания, мимо карты, мимо лесенок, мимо медалей и пазла.
// Со стороны всё выглядело нормально — примеры-то шли обычные.
test('ключ раздела разбирается обратно', () => {
    const w = starBox();
    eq(JSON.stringify(w.box.parseSectionKey('integer+')),
       JSON.stringify({ category: 'integer', numberType: 'positive' }), 'положительные целые');
    eq(JSON.stringify(w.box.parseSectionKey('integer-')),
       JSON.stringify({ category: 'integer', numberType: 'negative' }), 'отрицательные');
    eq(JSON.stringify(w.box.parseSectionKey('fraction+')),
       JSON.stringify({ category: 'fraction', numberType: 'positive' }), 'дроби');
});

test('запуск миссии восстанавливает раздел, а не только действие', () => {
    const w = starBox();
    w.box.exampleConfig.category = null;      // так выглядит возврат на экран выбора
    w.box.exampleConfig.numberType = null;
    w.S.pending = { key: 'integer+:add:3', level: 4 };
    w.S.showStarUnlock();
    w.nodes.starUnlockNext.onclick();
    eq(w.box.config.category, 'integer', 'раздел');
    eq(w.box.config.numberType, 'positive', 'знак');
});

test('раздел берётся из ключа, а не из того, что осталось на экране', () => {
    // Иначе ученик, до этого выбиравший дроби, ушёл бы решать дроби вместо целых.
    const w = starBox();
    w.box.exampleConfig.category = 'fraction';
    w.box.exampleConfig.numberType = 'positive';
    w.S.pending = { key: 'integer-:mul:2', level: 3 };
    w.S.showStarUnlock();
    w.nodes.starUnlockNext.onclick();
    eq(w.box.config.category, 'integer', 'раздел');
    eq(w.box.config.numberType, 'negative', 'знак');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
