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

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
