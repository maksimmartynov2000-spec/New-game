// Тесты копилки ошибок — того, из чего берёт примеры миссия «Повтори ошибки».
//
// Зачем отдельно от storage.test.js: копилка — единственное место в хранилище,
// где записи УХОДЯТ. Всё остальное сливается максимумом и объединением, и потерять
// там что-то «последней записью» нельзя по устройству. Здесь можно: выученный пример
// должен исчезнуть, а несвежий телефон — не вернуть его. Ошибка в любую сторону
// видна ученику сразу: либо копилка не пустеет, сколько ни решай, либо в ней
// пропадают примеры, которые он ещё не выучил.
//
// Как запускать:  node test/mistake-bank.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---------- часы, которые можно переводить ----------
// «Два разных дня» иначе не проверить: модуль берёт сегодняшнюю дату сам.
const RealDate = Date;
let shiftMs = 0;
class FakeDate extends RealDate {
    constructor(...args) {
        if (args.length === 0) super(RealDate.now() + shiftMs);
        else super(...args);
    }
    static now() { return RealDate.now() + shiftMs; }
}
const DAY = 86400000;

function loadProgress(store) {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'progress.js'), 'utf8');
    const box = store || {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date: FakeDate,
        isNaN, parseInt, parseFloat, Promise,
        localStorage: { getItem: (k) => (k in box ? box[k] : null), setItem: (k, v) => { box[k] = String(v); },
                        removeItem: (k) => { delete box[k]; } },
        setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src + '\n;globalThis.Progress = Progress;', sandbox, { filename: 'progress.js' });
    return { P: sandbox.Progress, store: box };
}
function fresh() {
    shiftMs = 0;
    const env = loadProgress();
    env.P.init();
    env.P.switchTo('KID', 'pw');
    return env;
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function test(name, fn) {
    try { await fn(); record(name, null); } catch (e) { record(name, e.message); }
    shiftMs = 0;
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }
function group(name) { console.log(`\n${name}`); }
// JSON с ключами по алфавиту: порядок ключей в объекте — не содержание.
function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v);
}

const SIG = 'integer+:add:3|int|add|38 + 7';
const ITEM = { k: 'integer+:add:3', p: { text: '38 + 7', answer: 45, a: 38, b: 7 }, w: 35, e: 'ошибка в десятках' };
// Готовая запись, как её хранит модуль, — для проверок слияния.
const rec = (t, ok, extra) => Object.assign({ k: 'integer+:add:3', p: { text: '38 + 7', answer: 45, a: 38, b: 7 },
                                              w: 35, e: '', t, ok: ok || [] }, extra || {});
const stateWith = (bank, extra) => Object.assign({ schema: 2, playerCode: 'KID', updatedAt: 1, mistakeBank: bank }, extra || {});
const dayOf = (offsetDays) => {
    const d = new RealDate(RealDate.now() + offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

(async () => {
    group('Ошибка кладёт пример в копилку');

    await test('запись хранит клетку, пример, ответ ученика и вид ошибки', () => {
        const { P } = fresh();
        assert(P.bankAdd(SIG, ITEM), 'запись не принята');
        const it = P.getBank().items[SIG];
        assert(it, 'записи нет');
        eq(it.k, 'integer+:add:3', 'клетка');
        eq(it.p.text, '38 + 7', 'пример');
        eq(it.w, 35, 'ответ ученика');
        eq(it.e, 'ошибка в десятках', 'вид ошибки');
        assert(it.t > 0, 'нет времени ошибки');
        eq(it.ok.length, 0, 'дни верных ответов');
    });

    await test('без клетки или без примера запись не принимается', () => {
        const { P } = fresh();
        assert(!P.bankAdd(SIG, { p: ITEM.p }), 'принята без клетки');
        assert(!P.bankAdd(SIG, { k: ITEM.k }), 'принята без примера');
        assert(!P.bankAdd(SIG, { k: ITEM.k, p: [1, 2] }), 'принята с массивом вместо примера');
        assert(!P.bankAdd('', ITEM), 'принята без подписи');
        eq(Object.keys(P.getBank().items).length, 0, 'записей');
    });

    await test('копилка переживает перезапуск', () => {
        const env = fresh();
        env.P.bankAdd(SIG, ITEM);
        const again = loadProgress(env.store);
        again.P.init();
        assert(again.P.getBank().items[SIG], 'после перезапуска записи нет');
    });

    await test('копилка у каждого профиля своя', () => {
        const { P } = fresh();
        P.bankAdd(SIG, ITEM);
        P.switchTo('SIS', 'pw2');
        eq(Object.keys(P.getBank().items).length, 0, 'чужая копилка у второго профиля');
        P.switchTo('KID');
        assert(P.getBank().items[SIG], 'своя копилка пропала после переключения');
    });

    await test('полный сброс прогресса очищает и копилку', async () => {
        const { P } = fresh();
        P.bankAdd(SIG, ITEM);
        await P.hardReset();
        // Смотрим в само состояние, а не через getBank: тот достроит копилку сам,
        // а экраны репетитора читают состояние ученика напрямую.
        eq(JSON.stringify(P.get().mistakeBank), '{"items":{},"done":{}}', 'копилка после сброса');
    });

    group('Пример уходит после верных ответов в два разных дня');

    await test('в один день засчитывается один раз', () => {
        const { P } = fresh();
        P.bankAdd(SIG, ITEM);
        eq(P.bankRight(SIG), 'counted', 'первый верный');
        eq(P.bankRight(SIG), null, 'второй верный в тот же день');
        eq(P.getBank().items[SIG].ok.length, 1, 'дней');
    });

    await test('второй день — выучен, запись ушла', () => {
        const { P } = fresh();
        P.bankAdd(SIG, ITEM);
        const t = P.getBank().items[SIG].t;
        P.bankRight(SIG);
        shiftMs = DAY;
        eq(P.bankRight(SIG), 'learned', 'второй день');
        assert(!P.getBank().items[SIG], 'выученный пример остался в копилке');
        eq(P.getBank().done[SIG], t, 'память о выученном');
    });

    await test('новая ошибка начинает счёт дней заново', () => {
        const { P } = fresh();
        P.bankAdd(SIG, ITEM);
        P.bankRight(SIG);
        const t0 = P.getBank().items[SIG].t;
        shiftMs = DAY;
        P.bankAdd(SIG, ITEM);
        const it = P.getBank().items[SIG];
        eq(it.ok.length, 0, 'дни после новой ошибки');
        assert(it.t > t0, 'время ошибки не обновилось');
        eq(P.bankRight(SIG), 'counted', 'вчерашний верный ответ засчитался после новой ошибки');
    });

    await test('новая ошибка в выученном примере возвращает его в копилку', () => {
        const { P } = fresh();
        P.bankAdd(SIG, ITEM);
        P.bankRight(SIG);
        shiftMs = DAY;
        P.bankRight(SIG);
        P.bankAdd(SIG, ITEM);
        assert(P.getBank().items[SIG], 'ошибка после выученного потерялась');
    });

    await test('часы ушли назад — новая ошибка всё равно новее прежней', () => {
        // Время ошибки пришло с устройства, где часы спешат. Новая ошибка здесь,
        // записанная «настоящим» временем, иначе проиграла бы ей слияние или
        // ушла бы как уже выученная.
        const { P } = fresh();
        shiftMs = 3600000;
        P.bankAdd(SIG, ITEM);
        const t0 = P.getBank().items[SIG].t;
        shiftMs = 0;
        P.bankAdd(SIG, ITEM);
        assert(P.getBank().items[SIG].t > t0, 'новая ошибка записана временем старой');

        P.bankRight(SIG);
        shiftMs = DAY;
        P.bankRight(SIG);                      // выучен: done = время ошибки «из будущего»
        shiftMs = 0;
        P.bankAdd(SIG, ITEM);
        assert(P.getBank().items[SIG], 'новая ошибка сразу ушла как выученная');
    });

    await test('верный ответ на пример не из копилки ничего не делает', () => {
        const { P } = fresh();
        eq(P.bankRight('нет такого'), null, 'ответ');
        eq(Object.keys(P.getBank().items).length + Object.keys(P.getBank().done).length, 0, 'появилась запись');
    });

    group('Размер ограничен');

    await test('записей не больше пятидесяти — уходят самые давние ошибки', () => {
        const { P } = fresh();
        for (let i = 0; i < 55; i++) {
            shiftMs = i * 1000;
            P.bankAdd(`integer+:add:3|${i}`, ITEM);
        }
        const keys = Object.keys(P.getBank().items);
        eq(keys.length, 50, 'записей');
        for (let i = 0; i < 5; i++) assert(keys.indexOf(`integer+:add:3|${i}`) < 0, `осталась давняя ${i}`);
        assert(keys.indexOf('integer+:add:3|54') >= 0, 'ушла самая свежая');
    });

    await test('память о выученном тоже не растёт без конца', () => {
        const { P } = fresh();
        const done = {};
        for (let i = 0; i < 70; i++) done[`s${i}`] = 1000 + i;
        const st = P._normalize(stateWith({ items: {}, done }));
        eq(Object.keys(st.mistakeBank.done).length, 50, 'выученных');
        assert(st.mistakeBank.done.s69 && !st.mistakeBank.done.s0, 'ушли не самые давние');
    });

    group('Слияние двух устройств');

    const merged = (P, a, b) => P._merge(P._normalize(stateWith(a)), P._normalize(stateWith(b))).mistakeBank;

    await test('записи с двух устройств объединяются', () => {
        const { P } = fresh();
        const m = merged(P, { items: { A: rec(100) } }, { items: { B: rec(200) } });
        assert(m.items.A && m.items.B, 'одна из записей потерялась');
    });

    await test('у одной записи побеждает более поздняя ошибка', () => {
        const { P } = fresh();
        const m = merged(P, { items: { A: rec(100, [dayOf(-3)], { w: 1 }) } },
                            { items: { A: rec(200, [], { w: 2 }) } });
        eq(m.items.A.t, 200, 'время');
        eq(m.items.A.w, 2, 'ответ ученика');
        eq(m.items.A.ok.length, 0, 'дни прежней ошибки перешли к новой');
    });

    await test('одна и та же ошибка: дни верных ответов складываются — пример выучен', () => {
        const { P } = fresh();
        const m = merged(P, { items: { A: rec(100, [dayOf(-2)]) } },
                            { items: { A: rec(100, [dayOf(-1)]) } });
        assert(!m.items.A, 'два дня на двух устройствах не засчитались');
        eq(m.done.A, 100, 'память о выученном');
    });

    await test('выученное на одном устройстве не возвращается со второго', () => {
        const { P } = fresh();
        const m = merged(P, { items: {}, done: { A: 100 } },
                            { items: { A: rec(100, [dayOf(-1)]) } });
        assert(!m.items.A, 'несвежий телефон вернул выученный пример');
    });

    await test('а новая ошибка со второго устройства возвращается', () => {
        const { P } = fresh();
        const m = merged(P, { items: {}, done: { A: 100 } },
                            { items: { A: rec(150) } });
        assert(m.items.A, 'новая ошибка потерялась при слиянии');
    });

    await test('порядок слияния ничего не меняет', () => {
        const { P } = fresh();
        const a = { items: { A: rec(100, [dayOf(-2)]), B: rec(300), C: rec(50, [dayOf(-1)]) }, done: { D: 70 } };
        const b = { items: { A: rec(100, [dayOf(-5)]), B: rec(200, [dayOf(-1)]), D: rec(60) }, done: { C: 50 } };
        eq(canon(merged(P, a, b)), canon(merged(P, b, a)), 'слияние зависит от порядка');
    });

    await test('слияние идемпотентно', () => {
        const { P } = fresh();
        const a = { items: { A: rec(100, [dayOf(-2)]), B: rec(300) }, done: { D: 70 } };
        const b = { items: { A: rec(100), B: rec(200, [dayOf(-1)]), D: rec(60) } };
        const once = merged(P, a, b);
        const twice = merged(P, once, b);
        eq(canon(twice), canon(once), 'повторное слияние изменило копилку');
    });

    await test('при равном времени из лишних уходит одно и то же на обоих устройствах', () => {
        const { P } = fresh();
        const a = { items: {} }, b = { items: {} };
        for (let i = 0; i < 30; i++) a.items[`a${i}`] = rec(500);
        for (let i = 0; i < 30; i++) b.items[`b${i}`] = rec(500);
        const ab = merged(P, a, b), ba = merged(P, b, a);
        eq(Object.keys(ab.items).length, 50, 'записей');
        eq(JSON.stringify(Object.keys(ab.items).sort()), JSON.stringify(Object.keys(ba.items).sort()),
           'устройства выбросили разное');
    });

    await test('flush увозит копилку на сервер и привозит чужую', async () => {
        const { P } = fresh();
        P.setToken('KID', 'tok');
        P.bankAdd(SIG, ITEM);
        let saved = null;
        P.attachRemote({
            async read() { return stateWith({ items: { 'integer+:mul:3|x': rec(100, [], { k: 'integer+:mul:3' }) } }); },
            async write(code, auth, st) { saved = JSON.parse(JSON.stringify(st)); }
        });
        assert(await P.flush(true), 'flush не прошёл');
        assert(saved && saved.mistakeBank && saved.mistakeBank.items[SIG], 'своя запись не уехала на сервер');
        assert(saved.mistakeBank.items['integer+:mul:3|x'], 'запись с сервера потерялась в слиянии');
        assert(P.getBank().items['integer+:mul:3|x'], 'запись с сервера не появилась на устройстве');
    });

    group('Битые данные');

    await test('мусор в копилке не роняет чтение', () => {
        const { P } = fresh();
        for (const junk of [null, 'x', 5, [], { items: [] }, { items: 'x', done: [] }]) {
            const st = P._normalize(stateWith(junk));
            assert(st.mistakeBank && typeof st.mistakeBank.items === 'object' && typeof st.mistakeBank.done === 'object',
                   'копилка не приведена к форме: ' + JSON.stringify(junk));
        }
    });

    await test('запись без клетки, примера или времени выбрасывается, дни чистятся', () => {
        const { P } = fresh();
        const st = P._normalize(stateWith({
            items: {
                good: rec(100, ['2026-01-02', 'мусор', 5, '2026-01-02', '2026-1-3']),
                noKey: rec(100, [], { k: '' }),
                noP: rec(100, [], { p: null }),
                badT: rec('вчера'),
                zeroT: rec(0),
                notObj: 7
            },
            done: { a: 'x', b: -1, c: 300 }
        }));
        const items = st.mistakeBank.items;
        eq(JSON.stringify(Object.keys(items)), '["good"]', 'оставшиеся записи');
        eq(JSON.stringify(items.good.ok), '["2026-01-02"]', 'дни');
        eq(JSON.stringify(st.mistakeBank.done), '{"c":300}', 'выученные');
    });

    await test('старое состояние без копилки читается с пустой', () => {
        const { P } = fresh();
        const st = P._normalize({ schema: 2, playerCode: 'KID', updatedAt: 1 });
        eq(JSON.stringify(st.mistakeBank), '{"items":{},"done":{}}', 'копилка');
        const m = P._merge(st, P._normalize({ schema: 2, playerCode: 'KID', updatedAt: 2 }));
        eq(JSON.stringify(m.mistakeBank), '{"items":{},"done":{}}', 'копилка после слияния');
    });

    group('Закрытые разделы');

    const linked = (env, access) => {
        env.store['mathCitadelState_v3'] = JSON.stringify({
            activeCode: 'KID',
            profiles: { KID: stateWith({ items: {
                plus: rec(100),
                minus: rec(100, [], { k: 'integer-:mul:3' })
            } }, { accountType: 'linked', ownerCode: 'MAKS' }) },
            passwords: {}, tokens: {}, access
        });
        env.P.init();
        return env.P.getBank().items;
    };

    await test('у ученика примеры закрытого раздела из копилки уходят', () => {
        const items = linked(loadProgress(), {});
        assert(!items.minus, 'пример закрытого раздела остался');
        assert(items.plus, 'положительные трогать нельзя');
    });

    await test('открытый раздел не трогается', () => {
        const items = linked(loadProgress(), { 'integer-': 'all' });
        assert(items.minus && items.plus, 'пример открытого раздела унесли');
    });

    console.log(`\n${'─'.repeat(50)}`);
    if (failed === 0) {
        console.log(`Все проверки пройдены: ${passed}`);
        process.exit(0);
    } else {
        console.log(`Провалено: ${failed} из ${passed + failed}`);
        failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`));
        process.exit(1);
    }
})();
