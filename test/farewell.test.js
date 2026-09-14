// Тесты прощальной записи — того, что уходит на сервер, когда приложение закрывают.
//
// Зачем она нужна. Обычная синхронизация — три шага по сети: прочитать серверную
// копию, слить её с нашей, записать обратно. Когда вкладку смахивают свайпом, до
// конца доходит хорошо если первый. Прогресс при этом не пропадает — локальная копия
// уже на диске и доедет при следующем запуске, — но до этого запуска репетитор видит
// вчерашние цифры, а если ребёнок пересядет на другое устройство, последнего занятия
// там не окажется.
//
// Чем она опасна. Один шаг — это запись БЕЗ слияния: серверная копия перезаписывается
// нашей. Поэтому здесь проверяется не только что она уходит, но и когда она НЕ должна
// уходить: без свежего слияния прощальная запись может затереть то, что записало
// другое устройство.
//
// Как запускать:  node test/farewell.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------- песочница для модуля Progress ----------
function loadProgress() {
    const moduleSrc = fs.readFileSync(path.join(ROOT, 'js', 'progress.js'), 'utf8');
    const store = {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date,
        isNaN, parseInt, parseFloat, Promise,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: () => {},
        setInterval: () => 0, clearInterval: () => {}
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(moduleSrc + '\n;globalThis.Progress = Progress;', sandbox,
                    { filename: 'index.html<Progress>' });
    return { Progress: sandbox.Progress, store, sandbox };
}

// Подставной сервер. Пишет в журнал, каким путём ушла запись: обычным или прощальным.
function fresh(opts) {
    const o = opts || {};
    const env = loadProgress();
    const P = env.Progress;
    P.init();
    P.switchTo('PUPIL', 'pw');
    P.setToken('PUPIL', 'tok');
    const log = [];
    P.attachRemote({
        async read() { if (o.readFails) throw new Error('offline'); return {}; },
        async write() { if (o.writeFails) throw new Error('offline'); log.push('flush'); },
        writeKeepalive() { log.push('farewell'); return o.beaconRefuses ? false : true; }
    });
    return { P, log, env };
}

// ---------- раннер ----------
let passed = 0, failed = 0;
const failures = [];
const queue = [];
function test(name, fn) {
    queue.push(async () => {
        try { await fn(); passed++; console.log(`  ✓ ${name}`); }
        catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
    });
}
function group(name) { queue.push(async () => console.log(`\n${name}`)); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }

group('Прощальная запись уходит, когда должна');

test('после свежего слияния изменения уходят одним запросом', async () => {
    const w = fresh();
    await w.P.flush(true);              // обычная синхронизация — слияние состоялось
    w.P.recordTrainingAnswer();         // появилось что отправлять
    eq(w.P.farewell(), true, 'прощальная запись не ушла');
    assert(w.log.includes('farewell'), 'драйвер не получил прощальную запись');
});

test('отправлять нечего — молчим', async () => {
    const w = fresh();
    await w.P.flush(true);
    // Ничего не записывали: dirty снят предыдущим flush.
    eq(w.P.farewell(), false, 'отправили пустую запись');
    assert(!w.log.includes('farewell'), 'драйвер получил запись, которой не было причины');
});

group('Прощальная запись НЕ затирает чужое');

test('слияния не было вовсе — прощальной записи нет', async () => {
    // Первый запуск без связи: серверную копию мы ещё ни разу не видели, и наша
    // запись стёрла бы всё, что там лежит.
    const w = fresh({ readFails: true });
    await w.P.flush(true);              // не удалась — слияния не состоялось
    w.P.recordTrainingAnswer();
    eq(w.P.farewell(), false, 'записали поверх серверной копии, которой ни разу не видели');
});

test('слияние было давно — прощальной записи нет', async () => {
    const w = fresh();
    await w.P.flush(true);
    w.P.recordTrainingAnswer();
    // Отматываем часы вперёд: с последнего слияния прошло больше порога.
    const realNow = Date.now;
    Date.now = () => realNow() + 10 * 60 * 1000;
    try {
        eq(w.P.farewell(), false, 'записали поверх копии, которую видели десять минут назад');
    } finally { Date.now = realNow; }
});

test('драйвер отказался — честно возвращаем false', async () => {
    // Слепок велик для keepalive или токена нет: вызывающий код должен узнать об
    // этом и попробовать обычный flush, а не считать, что всё отправлено.
    const w = fresh({ beaconRefuses: true });
    await w.P.flush(true);
    w.P.recordTrainingAnswer();
    eq(w.P.farewell(), false, 'выдали отказ драйвера за успешную отправку');
});

test('изменения остаются несохранёнными — следующий flush их всё равно отправит', async () => {
    // dirty после прощальной записи НЕ сбрасывается: дошёл ли запрос, мы не знаем.
    const w = fresh();
    await w.P.flush(true);
    w.P.recordTrainingAnswer();
    w.P.farewell();
    w.log.length = 0;
    await w.P.flush();                  // без force — уйдёт только если dirty
    assert(w.log.includes('flush'), 'после прощальной записи обычная синхронизация замолчала');
});

group('Драйвер и страница собраны правильно');

test('прощальная запись помечена keepalive', () => {
    const m = HTML.match(/writeKeepalive\(code, auth, state\) \{[\s\S]*?\n                \}/);
    assert(m, 'драйвер прощальной записи не найден — срез сломался');
    assert(/keepalive:\s*true/.test(m[0]),
        'запрос не помечен keepalive — браузер оборвёт его вместе со страницей, и смысла в нём нет');
});

test('слишком большой слепок не отправляется', () => {
    const m = HTML.match(/writeKeepalive\(code, auth, state\) \{[\s\S]*?\n                \}/);
    // keepalive молча роняет тела больше 64 КиБ: отправить половину хуже, чем ничего.
    assert(/6\d{4}/.test(m[0]) && /return false/.test(m[0]),
        'нет потолка на размер тела — большой слепок уйдёт в никуда, и молча');
});

test('без токена прощальной записи нет', () => {
    const m = HTML.match(/writeKeepalive\(code, auth, state\) \{[\s\S]*?\n                \}/);
    assert(/auth\.token/.test(m[0]),
        'драйвер не проверяет токен — обменивать пароль на токен уходящей странице уже некогда');
});

test('страница слушает и уход в фон, и закрытие вкладки', () => {
    assert(/addEventListener\('pagehide'/.test(HTML),
        'pagehide не слушается — на части телефонов закрытие вкладки проходит только через него');
    assert(/visibilityState === 'hidden'/.test(HTML),
        'уход в фон больше не отслеживается');
});

test('при закрытии сначала пробуют прощальную запись, и только потом обычную', () => {
    const m = HTML.match(/function saveOnHide\(\) \{[\s\S]*?\n        \}/);
    assert(m, 'обработчик закрытия не найден — срез сломался');
    const at = m[0].indexOf('farewell');
    const flushAt = m[0].indexOf('Progress.flush');
    assert(at >= 0 && flushAt >= 0, 'в обработчике нет одного из двух путей сохранения');
    assert(at < flushAt,
        'обычная синхронизация зовётся раньше прощальной — она не успеет, и прощальная не понадобится');
});

(async () => {
    for (const step of queue) await step();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
