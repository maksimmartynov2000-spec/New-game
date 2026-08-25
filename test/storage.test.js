// Тесты хранилища и слияния прогресса.
//
// Зачем: генератор покрыт тестами, а вот эта часть — нет, хотя цена ошибки здесь выше.
// Плохой пример ученик просто решит; потерянный прогресс не вернуть. Все дефекты, что
// мы тут ловили — утечка рекорда между профилями, пропажа даты достижения по дороге
// на сервер, невыполнявшаяся прополка журнала — находились руками и по одному, и ни
// один из них не поймал бы ни один существующий тест.
//
// Как запускать:  node test/storage.test.js
// Браузер не нужен: модуль Progress вырезается из index.html и исполняется в песочнице
// с поддельным localStorage. Ничего не устанавливается.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---------- запуск модуля хранилища без браузера ----------
// Progress — самостоятельный модуль: снаружи он зовёт только встроенные функции.
// Поэтому его можно вырезать по границам и исполнить отдельно от всего остального.
function loadProgress() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

    const START = 'const Progress = (() => {';
    const END = 'Progress.init();';
    const from = script.indexOf(START);
    const to = script.indexOf(END);
    if (from < 0 || to < 0) throw new Error('не найдены границы модуля Progress');
    const moduleSrc = script.slice(from, to);

    // Поддельное хранилище: обычный объект. Даёт заодно возможность заглянуть внутрь
    // и проверить, что именно уходит на диск, а не только что читается обратно.
    const store = {};
    const sandbox = {
        console, Math, Number, Object, Array, String, JSON, Set, Map, Date,
        isNaN, parseInt, parseFloat, Promise,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        setTimeout: () => 0, clearTimeout: () => {},
        setInterval: () => 0, clearInterval: () => {}
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    // Модуль объявлен через const, а такие объявления не становятся свойствами
    // глобального объекта — поэтому вытаскиваем ссылку наружу явно.
    vm.runInContext(moduleSrc + '\n;globalThis.Progress = Progress;', sandbox,
                    { filename: 'index.html<Progress>' });
    return { Progress: sandbox.Progress, store, sandbox };
}

// Каждый тест получает свежий модуль: состояние живёт в замыкании, между тестами
// его иначе не сбросить.
function fresh() {
    const env = loadProgress();
    env.Progress.init();
    return env;
}

// ---------- крошечный тест-раннер ----------
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, message: e.message });
        console.log(`  ✗ ${name}\n      ${e.message}`);
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'не выполнилось');
}
function eq(actual, expected, what) {
    assert(actual === expected, `${what}: ожидалось ${expected}, получено ${actual}`);
}
function group(name) { console.log(`\n${name}`); }

// ---------- вспомогательное ----------
const DAY = 86400000;
function dayKeyOffset(daysAgo) {
    const d = new Date(Date.now() - daysAgo * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

group('Слияние: прогресс только растёт');

test('счётчики берут максимум, а не последнее значение', () => {
    const { Progress } = fresh();
    const a = { schema: 2, playerCode: 'X', updatedAt: 100, totals: { correct: 500, wrong: 30, puzzlesCompleted: 2 } };
    const b = { schema: 2, playerCode: 'X', updatedAt: 200, totals: { correct: 120, wrong: 90, puzzlesCompleted: 1 } };
    const m = Progress._merge(a, b);
    eq(m.totals.correct, 500, 'верных');   // более свежая запись НЕ откатывает счётчик
    eq(m.totals.wrong, 90, 'ошибок');
    eq(m.totals.puzzlesCompleted, 2, 'собранных пазлов');
});

test('слияние симметрично: порядок аргументов не меняет счётчики', () => {
    const { Progress } = fresh();
    const a = { schema: 2, playerCode: 'X', updatedAt: 100, totals: { correct: 500, wrong: 30, puzzlesCompleted: 2 },
                byTopic: { 'integer+:add:1': { correct: 10, wrong: 1 } } };
    const b = { schema: 2, playerCode: 'X', updatedAt: 200, totals: { correct: 120, wrong: 90, puzzlesCompleted: 1 },
                byTopic: { 'integer+:add:1': { correct: 4, wrong: 7 } } };
    const ab = Progress._merge(a, b), ba = Progress._merge(b, a);
    eq(ab.totals.correct, ba.totals.correct, 'верных');
    eq(ab.totals.wrong, ba.totals.wrong, 'ошибок');
    eq(ab.byTopic['integer+:add:1'].correct, ba.byTopic['integer+:add:1'].correct, 'верных по теме');
});

test('слияние идемпотентно: повторный flush ничего не надувает', () => {
    // Важно потому, что flush() сливает при каждом заходе на сервер, раз в 8 секунд.
    // Если бы счётчики складывались, статистика росла бы сама по себе.
    const { Progress } = fresh();
    const s = { schema: 2, playerCode: 'X', updatedAt: 100, totals: { correct: 77, wrong: 5, puzzlesCompleted: 1 },
                daily: { '2026-08-20': { c: 40, w: 3, a: 1, s: 600, p: 1, ms: 300000, mc: 40, t: {} } } };
    let m = Progress._merge(s, s);
    for (let i = 0; i < 5; i++) m = Progress._merge(m, s);
    eq(m.totals.correct, 77, 'верных после шести слияний');
    eq(m.daily['2026-08-20'].c, 40, 'верных за день после шести слияний');
});

test('коллекция объединяется: собранное на одном устройстве не пропадает', () => {
    const { Progress } = fresh();
    const a = { schema: 2, playerCode: 'X', updatedAt: 100, collections: { paradoxes: [true, false, true, false] } };
    const b = { schema: 2, playerCode: 'X', updatedAt: 200, collections: { paradoxes: [false, true, false, false] } };
    const m = Progress._merge(a, b);
    assert(JSON.stringify(m.collections.paradoxes) === JSON.stringify([true, true, true, false]),
        `получилось ${JSON.stringify(m.collections.paradoxes)}`);
});

test('пазл: одна картинка — больший прогресс, разные — более свежая', () => {
    const { Progress } = fresh();
    const same = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, puzzle: { idx: 3, filled: 80 } },
        { schema: 2, playerCode: 'X', updatedAt: 200, puzzle: { idx: 3, filled: 12 } });
    eq(same.puzzle.filled, 80, 'кусочков на той же картинке');
    const other = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, puzzle: { idx: 3, filled: 80 } },
        { schema: 2, playerCode: 'X', updatedAt: 200, puzzle: { idx: 7, filled: 5 } });
    eq(other.puzzle.idx, 7, 'номер картинки');
    eq(other.puzzle.filled, 5, 'кусочков на новой картинке');
});

group('Слияние: достижения');

test('достижения объединяются и снять их нельзя', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, unlocks: { 'integer+:add:1:s1': '2026-01-10' } },
        { schema: 2, playerCode: 'X', updatedAt: 900, unlocks: { 'integer+:add:1:c1': '2026-02-02' } });
    eq(Object.keys(m.unlocks).length, 2, 'достижений после слияния');
});

test('при разных датах побеждает более ранняя — первое получение и есть правда', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 900, unlocks: { 'integer+:add:1:s1': '2026-05-20' } },
        { schema: 2, playerCode: 'X', updatedAt: 100, unlocks: { 'integer+:add:1:s1': '2026-01-10' } });
    eq(m.unlocks['integer+:add:1:s1'], '2026-01-10', 'дата получения');
});

test('достижение не теряется по дороге на сервер даже без даты', () => {
    // Пустая строка пережила бы merge, но пропала бы при JSON.stringify — и достижение
    // просто исчезло бы у ученика. Ровно так один раз и случилось.
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, unlocks: { 'integer+:add:1:s1': '' } },
        { schema: 2, playerCode: 'X', updatedAt: 200, unlocks: {} });
    const afterTrip = JSON.parse(JSON.stringify(m));
    assert('integer+:add:1:s1' in afterTrip.unlocks,
        `достижение исчезло после сериализации: ${JSON.stringify(m.unlocks)}`);
    assert(afterTrip.unlocks['integer+:add:1:s1'], 'значение пустое — не переживёт следующую поездку');
});

test('старый формат достижений (массив) читается и не теряется', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, unlocks: ['integer+:add:1:s1', 'integer+:add:1:c1'] },
        { schema: 2, playerCode: 'X', updatedAt: 200, unlocks: {} });
    eq(Object.keys(m.unlocks).length, 2, 'достижений из массива');
    assert(JSON.parse(JSON.stringify(m)).unlocks['integer+:add:1:s1'], 'дата не пережила сериализацию');
});

group('Слияние: свежая запись выигрывает там, где это не прогресс');

test('имя, тип аккаунта и владелец берутся из более свежей записи', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, profileLabel: 'Старое', accountType: 'self', ownerCode: null },
        { schema: 2, playerCode: 'X', updatedAt: 200, profileLabel: 'Новое', accountType: 'linked', ownerCode: 'Tutor' });
    eq(m.profileLabel, 'Новое', 'имя');
    eq(m.accountType, 'linked', 'тип аккаунта');
    eq(m.ownerCode, 'Tutor', 'владелец');
});

test('при ничьей по времени побеждает сервер, а не пустая заготовка', () => {
    // Свежесозданный сервером ученик и локальная пустая заготовка оба идут с updatedAt = 0.
    // Если бы при ничьей выигрывала заготовка, привязка к репетитору стиралась бы при
    // первом же входе — и записывалась обратно на сервер. Ровно так и было.
    const { Progress } = fresh();
    const server = { schema: 2, playerCode: 'X', updatedAt: 0, profileLabel: 'Вася', accountType: 'linked', ownerCode: 'Tutor' };
    const blank = { schema: 2, playerCode: 'X', updatedAt: 0, profileLabel: '', accountType: 'self', ownerCode: null };
    const m = Progress._merge(server, blank); // server = a (пришёл с сервера), blank = b (локальный)
    eq(m.accountType, 'linked', 'тип аккаунта');
    eq(m.ownerCode, 'Tutor', 'владелец');
    eq(m.profileLabel, 'Вася', 'имя');
});

group('Журнал занятий по дням');

test('дни объединяются, а внутри дня счётчики берут максимум', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, daily: {
            '2026-08-19': { c: 30, w: 2, a: 0, s: 400, p: 0, ms: 200000, mc: 30, t: { 'integer+:add:1': [30, 2, 0, 200000, 30] } } } },
        { schema: 2, playerCode: 'X', updatedAt: 200, daily: {
            '2026-08-20': { c: 12, w: 5, a: 1, s: 300, p: 1, ms: 90000, mc: 12, t: { 'fraction+:add:2': [12, 5, 1, 90000, 12] } } } });
    eq(Object.keys(m.daily).length, 2, 'дней в журнале');
    eq(m.daily['2026-08-19'].c, 30, 'верных за 19-е');
    eq(m.daily['2026-08-20'].c, 12, 'верных за 20-е');
    eq(m.daily['2026-08-19'].t['integer+:add:1'][0], 30, 'верных по теме за 19-е');
});

test('один и тот же день с двух устройств не удваивается', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, daily: { '2026-08-20': { c: 40, w: 3, a: 0, s: 600, p: 0, ms: 300000, mc: 40, t: {} } } },
        { schema: 2, playerCode: 'X', updatedAt: 200, daily: { '2026-08-20': { c: 25, w: 8, a: 2, s: 400, p: 1, ms: 180000, mc: 25, t: {} } } });
    eq(m.daily['2026-08-20'].c, 40, 'верных за день');
    eq(m.daily['2026-08-20'].w, 8, 'ошибок за день');
    assert(m.daily['2026-08-20'].c !== 65, 'счётчики сложились вместо максимума — статистика будет надуваться');
});

test('журнал пропалывается при сохранении, а не только при слиянии', () => {
    // Прополка когда-то жила только в merge и normalize, и журнал спокойно рос до 400 дней.
    const { Progress } = fresh();
    const st = Progress.get();
    for (let d = 0; d < 400; d++) {
        st.daily[dayKeyOffset(d)] = { c: 10, w: 1, a: 0, s: 100, p: 0, ms: 50000, mc: 10, t: {} };
    }
    Progress.setProfileLabel('кто-нибудь'); // любое изменение вызывает persistLocal
    const days = Object.keys(Progress.get().daily).length;
    assert(days <= 210, `в журнале осталось ${days} дней — прополка не сработала`);
    assert(days >= 150, `в журнале осталось всего ${days} дней — прополка съела лишнее`);
});

test('старые дни сворачиваются в карточки эпох, а не пропадают', () => {
    const { Progress } = fresh();
    const st = Progress.get();
    for (let d = 0; d < 400; d++) {
        st.daily[dayKeyOffset(d)] = { c: 10, w: 1, a: 0, s: 100, p: 0, ms: 50000, mc: 10, t: {} };
    }
    Progress.setProfileLabel('кто-нибудь');
    const epochs = Progress.get().epochs || {};
    assert(Object.keys(epochs).length >= 1, 'эпохи не запечатались, история просто потерялась');
    const total = Object.values(epochs).reduce((n, e) => n + (e.c || 0), 0);
    assert(total > 0, 'карточки эпох пустые');
});

test('карточка эпохи — снимок, а не копилка: повторные сохранения её не раздувают', () => {
    const { Progress } = fresh();
    const st = Progress.get();
    for (let d = 0; d < 400; d++) {
        st.daily[dayKeyOffset(d)] = { c: 10, w: 1, a: 0, s: 100, p: 0, ms: 50000, mc: 10, t: {} };
    }
    Progress.setProfileLabel('раз');
    const first = JSON.stringify(Progress.get().epochs);
    Progress.setProfileLabel('два');
    Progress.setProfileLabel('три');
    eq(JSON.stringify(Progress.get().epochs), first, 'карточки эпох изменились при пустых сохранениях');
});

test('время по темам хранится только за последний месяц', () => {
    // Слот темы внутри дня — [верно, ошибок, почти, суммарное время, сколько ответов].
    // Последние два числа нужны только лесенке скорости, которая смотрит недалеко назад,
    // поэтому у старых дней они выбрасываются: счётчики остаются, время уходит.
    const { Progress } = fresh();
    const st = Progress.get();
    for (let d = 0; d < 120; d++) {
        st.daily[dayKeyOffset(d)] = { c: 10, w: 1, a: 0, s: 100, p: 0, ms: 50000, mc: 10,
                                      t: { 'integer+:add:1': [10, 1, 0, 50000, 10] } };
    }
    Progress.setProfileLabel('кто-нибудь');
    const daily = Progress.get().daily;
    const keys = Object.keys(daily).sort();
    const oldest = daily[keys[0]].t['integer+:add:1'];
    const newest = daily[keys[keys.length - 1]].t['integer+:add:1'];
    eq(oldest.length, 3, 'длина слота у старого дня');
    eq(oldest[0], 10, 'верных у старого дня — счётчик должен остаться');
    eq(newest.length, 5, 'длина слота у свежего дня');
});

group('Профили на одном устройстве');

test('переключение профиля не смешивает прогресс', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.get().totals.correct = 500;
    Progress.setProfileLabel('Вася');

    Progress.switchTo('Petya', 'pw2');
    eq(Progress.get().totals.correct, 0, 'верных у нового профиля');
    eq(Progress.getProfileLabel(), '', 'имя нового профиля');
    Progress.get().totals.correct = 7;
    Progress.setProfileLabel('Петя');

    Progress.switchTo('Vasya', 'pw1');
    eq(Progress.get().totals.correct, 500, 'верных у Васи после возврата');
    eq(Progress.getProfileLabel(), 'Вася', 'имя Васи после возврата');
});

test('ни один рекорд не утекает между профилями', () => {
    // Однажды рекорд серии жил в переменной модуля и не сбрасывался при смене профиля:
    // свежезаведённый ученик сразу видел чужие достижения.
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.unlock('integer+:add:1:s3');
    Progress.get().totals.correct = 900;

    Progress.switchTo('Novichok', 'pw2');
    eq(Object.keys(Progress.getUnlocks()).length, 0, 'достижений у новичка');
    eq(Progress.get().totals.correct, 0, 'верных у новичка');
    assert(!Progress.getUnlocks()['integer+:add:1:s3'], 'чужое достижение видно новичку');
});

test('забытый профиль уносит с собой пароль и токен', () => {
    const { Progress, store } = fresh();
    Progress.switchTo('Vasya', 'pw-secret');
    Progress.setToken('Vasya', 'a'.repeat(64));
    Progress.switchTo('Petya', 'pw2');
    Progress.forgetProfile('Vasya');
    const raw = store['mathCitadelState_v3'] || '';
    assert(raw.indexOf('pw-secret') === -1, 'пароль забытого профиля остался на диске');
    assert(raw.indexOf('a'.repeat(64)) === -1, 'токен забытого профиля остался на диске');
    assert(!Progress.listProfiles().some(p => p.code === 'Vasya'), 'профиль остался в списке');
});

test('нельзя забыть профиль, под которым сидишь', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    eq(Progress.forgetProfile('Vasya'), false, 'результат forgetProfile');
    assert(Progress.listProfiles().some(p => p.code === 'Vasya'), 'активный профиль пропал');
});

group('Токены и пароли на диске');

test('обмен пароля на токен стирает пароль', () => {
    const { Progress, store } = fresh();
    Progress.switchTo('Vasya', 'pw-secret');
    assert((store['mathCitadelState_v3'] || '').indexOf('pw-secret') >= 0, 'пароль не сохранился — тест бессмысленен');
    Progress.setToken('Vasya', 'b'.repeat(64));
    const raw = store['mathCitadelState_v3'] || '';
    assert(raw.indexOf('pw-secret') === -1, 'пароль остался на диске после получения токена');
    assert(raw.indexOf('b'.repeat(64)) >= 0, 'токен не сохранился');
    eq(Progress.getPasswordFor('Vasya'), null, 'пароль в памяти');
});

test('токен предпочитается паролю, а негодный токен возвращает к паролю', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    eq(Progress.authFor('Vasya').password, 'pw1', 'до обмена — пароль');
    Progress.setToken('Vasya', 'c'.repeat(64));
    eq(Progress.authFor('Vasya').token, 'c'.repeat(64), 'после обмена — токен');
    Progress.dropToken('Vasya');
    eq(Progress.authFor('Vasya'), null, 'после сброса токена подтверждать нечем');
});

test('полная очистка убирает всё, включая чужие профили', () => {
    const { Progress, store } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.switchTo('Petya', 'pw2');
    Progress.wipeAllLocal();
    assert(!('mathCitadelState_v3' in store), 'хранилище пережило полную очистку');
});

group('Сохранение и чтение');

test('состояние переживает перезапуск приложения', () => {
    const env = loadProgress();
    env.Progress.init();
    env.Progress.switchTo('Vasya', 'pw1');
    env.Progress.get().totals.correct = 314;
    env.Progress.setProfileLabel('Вася');
    env.Progress.unlock('fraction+:add:2:c1');
    const saved = env.store['mathCitadelState_v3'];

    // Новый «запуск»: тот же диск, свежий модуль.
    const env2 = loadProgress();
    env2.store['mathCitadelState_v3'] = saved;
    env2.Progress.init();
    eq(env2.Progress.getCode(), 'Vasya', 'активный профиль');
    eq(env2.Progress.get().totals.correct, 314, 'верных');
    eq(env2.Progress.getProfileLabel(), 'Вася', 'имя');
    assert(env2.Progress.getUnlocks()['fraction+:add:2:c1'], 'достижение');
});

test('битое хранилище не роняет приложение', () => {
    const env = loadProgress();
    env.store['mathCitadelState_v3'] = '{это не json';
    env.Progress.init();
    assert(env.Progress.get(), 'состояние не создалось из битого хранилища');
    eq(env.Progress.get().totals.correct, 0, 'верных в чистом состоянии');
});

test('чужие поля в состоянии не ломают чтение', () => {
    const env = loadProgress();
    env.store['mathCitadelState_v3'] = JSON.stringify({
        activeCode: 'Vasya',
        profiles: { Vasya: { schema: 2, playerCode: 'Vasya', totals: { correct: 'сорок' }, daily: null, unlocks: 42, чтоТоЛишнее: true } }
    });
    env.Progress.init();
    const st = env.Progress.get();
    assert(typeof st.totals.correct === 'number', `верных стало ${JSON.stringify(st.totals.correct)}`);
    assert(st.daily && typeof st.daily === 'object', 'журнал не восстановился');
    assert(st.unlocks && typeof st.unlocks === 'object', 'достижения не восстановились');
});

group('Запись ответов');

test('ответ попадает и в общие счётчики, и в тему, и в журнал дня', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.recordAnswer('integer+:add:1', 'correct', 4200);
    Progress.recordAnswer('integer+:add:1', 'wrong', 9000);
    Progress.recordAnswer('integer+:add:1', 'correct', 3000);

    const st = Progress.get();
    eq(st.totals.correct, 2, 'верных всего');
    eq(st.totals.wrong, 1, 'ошибок всего');
    eq(st.byTopic['integer+:add:1'].correct, 2, 'верных по теме');
    eq(st.byTopic['integer+:add:1'].wrong, 1, 'ошибок по теме');

    const today = Object.keys(st.daily)[0];
    assert(today, 'день в журнале не завёлся');
    eq(st.daily[today].c, 2, 'верных за день');
    eq(st.daily[today].w, 1, 'ошибок за день');
    eq(st.daily[today].t['integer+:add:1'][0], 2, 'верных по теме за день');
});

test('день в журнале записывается по местной дате, а не по всемирной', () => {
    // Если бы день брался по UTC, вечернее занятие уезжало бы в завтра, и «сегодня»
    // в статистике не сходилось бы с тем, что ученик только что решал.
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.recordAnswer('integer+:add:1', 'correct', 4200);
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert(local in Progress.get().daily,
        `день записан как ${Object.keys(Progress.get().daily)} вместо местного ${local}`);
});

group('Виды ошибок');

test('вид ошибки пишется и в пожизненный счёт по теме, и в журнал дня', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.recordAnswer('fraction+:add:3', 'wrong', 8000);
    Progress.recordMistakeKind('fraction+:add:3', 'сложил знаменатели');
    Progress.recordAnswer('fraction+:add:3', 'wrong', 7000);
    Progress.recordMistakeKind('fraction+:add:3', 'сложил знаменатели');
    Progress.recordAnswer('fraction+:add:3', 'wrong', 9000);
    Progress.recordMistakeKind('fraction+:add:3', 'не сократил');

    eq(Progress.getErrorKinds()['fraction+:add:3']['сложил знаменатели'], 2, 'по теме');
    eq(Progress.getErrorKinds()['fraction+:add:3']['не сократил'], 1, 'по теме');
    const day = Object.values(Progress.get().daily)[0];
    eq(day.e['сложил знаменатели'], 2, 'за день');
    eq(day.e['не сократил'], 1, 'за день');
});

test('пустой вид ошибки ничего не записывает', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.recordMistakeKind('fraction+:add:3', null);
    Progress.recordMistakeKind('fraction+:add:3', '');
    eq(Object.keys(Progress.getErrorKinds()).length, 0, 'тем с ошибками');
});

test('виды ошибок сливаются как счётчики «только вверх»', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, errorKinds: {
            'fraction+:add:3': { 'сложил знаменатели': 12, 'не сократил': 3 } } },
        { schema: 2, playerCode: 'X', updatedAt: 200, errorKinds: {
            'fraction+:add:3': { 'сложил знаменатели': 5, 'перепутал действие': 7 },
            'integer+:mul:2': { 'таблица умножения': 4 } } });
    eq(m.errorKinds['fraction+:add:3']['сложил знаменатели'], 12, 'более свежая запись не откатывает');
    eq(m.errorKinds['fraction+:add:3']['не сократил'], 3, 'вид, известный только одной стороне');
    eq(m.errorKinds['fraction+:add:3']['перепутал действие'], 7, 'вид с другой стороны');
    eq(m.errorKinds['integer+:mul:2']['таблица умножения'], 4, 'тема с другой стороны');
});

test('время всех ответов делится на число верных', () => {
    // Раньше время ошибок не учитывалось вовсе: можно было думать над примером двадцать
    // секунд, ошибиться — и на скорости это никак не сказывалось.
    const { Progress } = fresh();
    Progress.switchTo('AAA', 'pw');
    Progress.recordAnswer('integer+:add:1', 'wrong', 4000);
    Progress.recordAnswer('integer+:add:1', 'correct', 6000);
    const day = Progress.getDaily()[Progress.dayKey()];
    eq(day.ms, 10000, 'время сложилось по обоим ответам');
    eq(day.mc, 1, 'в знаменателе только верный');
    const slot = day.t['integer+:add:1'];
    eq(slot[3], 10000, 'по теме время тоже по обоим');
    eq(slot[4], 1, 'по теме знаменатель только верный');
});

test('время одного ответа обрезается сверху', () => {
    // Таймер примера ничего не обрывает: полоска доходит до нуля, а пример висит.
    // Без потолка отложенный телефон записывается как «думал пять минут».
    const { Progress } = fresh();
    Progress.switchTo('AAA', 'pw');
    Progress.recordAnswer('integer+:add:1', 'correct', 300000);
    const day = Progress.getDaily()[Progress.dayKey()];
    eq(day.ms, 15000, 'пять минут обрезаны до пятнадцати секунд');
    Progress.recordClass('integer+:add:1', { cls: '0', hundred: false }, true, 300000);
    eq(Progress.getByClass()['integer+:add:1']['0'][2], 15000, 'в разборе по типам тот же потолок');
});

test('мусор вместо времени не портит счётчики', () => {
    const { Progress } = fresh();
    Progress.switchTo('AAA', 'pw');
    Progress.recordAnswer('integer+:add:1', 'correct', NaN);
    Progress.recordAnswer('integer+:add:1', 'correct', -5);
    const day = Progress.getDaily()[Progress.dayKey()];
    eq(day.ms, 0, 'нечисловое и отрицательное время дали ноль');
    eq(day.mc, 2, 'верные ответы при этом посчитаны');
});

test('разбор по типам примеров сливается как счётчики «только вверх»', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, byClass: {
            'integer+:sub:5': { '2': [40, 6, 52000, 40], 'h': [10, 4, 15000, 10] } } },
        { schema: 2, playerCode: 'X', updatedAt: 200, byClass: {
            'integer+:sub:5': { '2': [12, 9, 9000, 12], '0': [7, 1, 5000, 7] },
            'integer+:add:3': { '1': [5, 0, 4000, 5] } } });
    eq(m.byClass['integer+:sub:5']['2'][0], 40, 'верные не откатываются более свежей записью');
    eq(m.byClass['integer+:sub:5']['2'][1], 9, 'ошибки берут максимум с любой стороны');
    eq(m.byClass['integer+:sub:5']['2'][2], 52000, 'суммарное время тоже только вверх');
    eq(m.byClass['integer+:sub:5']['h'][0], 10, 'подмножество «через сотню» уцелело');
    eq(m.byClass['integer+:sub:5']['0'][0], 7, 'класс, известный только одной стороне');
    eq(m.byClass['integer+:add:3']['1'][0], 5, 'тема с другой стороны');
});

test('битый разбор по типам не ломает чтение', () => {
    // Слот мог прийти строкой, числом или из старой версии, где поля ещё не было.
    const { Progress } = fresh();
    const n = Progress._normalize({
        schema: 2, playerCode: 'X', updatedAt: 1,
        byClass: {
            'integer+:add:1': { '0': [3, 1, 'abc', null], '1': 'мусор' },
            'integer+:sub:2': 'совсем мусор'
        }
    });
    eq(n.byClass['integer+:add:1']['0'][2], 0, 'нечисловое время стало нулём');
    eq(n.byClass['integer+:add:1']['0'][3], 0, 'null стал нулём');
    eq(n.byClass['integer+:add:1']['1'], undefined, 'слот не массивом выброшен');
    eq(n.byClass['integer+:sub:2'], undefined, 'тема не объектом выброшена');
});

test('разбор по типам не утекает между профилями', () => {
    const { Progress } = fresh();
    Progress.switchTo('AAA', 'pw');
    Progress.recordClass('integer+:add:5', { cls: '2', hundred: true }, true, 3000);
    eq(Progress.getByClass()['integer+:add:5']['2'][0], 1, 'записалось в свой профиль');
    eq(Progress.getByClass()['integer+:add:5']['h'][0], 1, 'подмножество тоже записалось');
    Progress.switchTo('BBB', 'pw');
    eq(Object.keys(Progress.getByClass()).length, 0, 'у другого профиля пусто');
});

test('виды ошибок за день тоже берут максимум, а не сумму', () => {
    const { Progress } = fresh();
    const m = Progress._merge(
        { schema: 2, playerCode: 'X', updatedAt: 100, daily: {
            '2026-08-20': { c: 10, w: 5, a: 0, s: 200, p: 0, ms: 0, mc: 0, t: {}, e: { 'знак': 5 } } } },
        { schema: 2, playerCode: 'X', updatedAt: 200, daily: {
            '2026-08-20': { c: 8, w: 3, a: 0, s: 150, p: 0, ms: 0, mc: 0, t: {}, e: { 'знак': 3, 'таблица умножения': 2 } } } });
    eq(m.daily['2026-08-20'].e['знак'], 5, 'знак');
    eq(m.daily['2026-08-20'].e['таблица умножения'], 2, 'таблица умножения');
});

test('слияние идемпотентно и для видов ошибок', () => {
    const { Progress } = fresh();
    const s = { schema: 2, playerCode: 'X', updatedAt: 100,
                errorKinds: { 'integer+:mul:2': { 'таблица умножения': 9 } } };
    let m = Progress._merge(s, s);
    for (let i = 0; i < 5; i++) m = Progress._merge(m, s);
    eq(m.errorKinds['integer+:mul:2']['таблица умножения'], 9, 'после шести слияний');
});

test('битые виды ошибок не ломают чтение', () => {
    const env = loadProgress();
    env.store['mathCitadelState_v3'] = JSON.stringify({
        activeCode: 'Vasya',
        profiles: { Vasya: { schema: 2, playerCode: 'Vasya',
            errorKinds: { 'integer+:mul:2': { 'таблица умножения': 'много' }, 'плохая тема': 'вообще не объект' } } }
    });
    env.Progress.init();
    const ek = env.Progress.getErrorKinds();
    assert(!('плохая тема' in ek), 'мусорная запись осталась');
    assert(typeof ek['integer+:mul:2']['таблица умножения'] === 'number',
        `счётчик остался ${JSON.stringify(ek['integer+:mul:2']['таблица умножения'])}`);
});

test('виды ошибок не утекают между профилями', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.recordMistakeKind('integer+:mul:2', 'таблица умножения');
    Progress.switchTo('Petya', 'pw2');
    eq(Object.keys(Progress.getErrorKinds()).length, 0, 'тем с ошибками у второго профиля');
    Progress.switchTo('Vasya', 'pw1');
    eq(Progress.getErrorKinds()['integer+:mul:2']['таблица умножения'], 1, 'у первого профиля сохранилось');
});

group('Доступ к разделам');

test('доступ не попадает в состояние и, значит, не сливается как прогресс', () => {
    // Ключевое свойство: доступ — решение репетитора, а не достижение ученика.
    // Если бы он лежал в state, слияние «только растёт» сохраняло бы отозванный
    // доступ навсегда, и отобрать его было бы нечем.
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.setAccess({ 'fraction+': 'all' });
    assert(!('access' in Progress.get()), 'доступ утёк в состояние');
    const merged = Progress._merge(
        { schema: 2, playerCode: 'Vasya', updatedAt: 1, access: { 'fraction+': 'all' } },
        { schema: 2, playerCode: 'Vasya', updatedAt: 2 });
    assert(!merged.access, 'слияние вернуло доступ, хотя не должно им заниматься');
});

test('доступ переживает перезапуск', () => {
    const env = loadProgress();
    env.Progress.init();
    env.Progress.switchTo('Vasya', 'pw1');
    env.Progress.setAccess({ 'fraction+': { add: [1, 2, 3] } });
    const saved = env.store['mathCitadelState_v3'];

    const env2 = loadProgress();
    env2.store['mathCitadelState_v3'] = saved;
    env2.Progress.init();
    const a = env2.Progress.getAccess();
    assert(a && a['fraction+'], 'доступ не восстановился');
    eq(JSON.stringify(a['fraction+'].add), '[1,2,3]', 'уровни');
});

test('пока доступ не спрашивали, он null — это не то же самое, что пустой', () => {
    // На этом различии держится безопасность выкладки: «не знаем» означает
    // «открыто всё», а «знаем, что ничего» — только базовый раздел. Если бы
    // отсутствие ответа читалось как пустой доступ, ученик оказался бы заперт
    // из-за пропавшей сети.
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    eq(Progress.getAccess(), null, 'свежий профиль');
    Progress.setAccess({});
    assert(Progress.getAccess() !== null, 'пустой ответ должен отличаться от отсутствия ответа');
    eq(Object.keys(Progress.getAccess()).length, 0, 'ключей в пустом доступе');
});

test('чужой доступ не переезжает на другой профиль', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.setAccess({ 'fraction+': 'all' });
    Progress.switchTo('Petya', 'pw2');
    eq(Progress.getAccess(), null, 'доступ у второго профиля');
});

test('мусор вместо доступа читается как «не знаем»', () => {
    const { Progress } = fresh();
    Progress.switchTo('Vasya', 'pw1');
    Progress.setAccess('всё открыто');
    eq(Progress.getAccess(), null, 'строка вместо объекта');
    Progress.setAccess(undefined);
    eq(Progress.getAccess(), null, 'undefined');
});

// ---------- итог ----------
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
    console.log(`Все проверки пройдены: ${passed}`);
    process.exit(0);
} else {
    console.log(`Провалено: ${failed} из ${passed + failed}`);
    failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`));
    process.exit(1);
}
