// Тесты игры без регистрации и переезда прогресса в новый аккаунт.
//
// Зачем. «Играть без регистрации» и мягкое напоминание «заведи аккаунт, а то потеряешь»
// держатся на одном обещании: у гостя ЕСТЬ что терять. Если гостевой прогресс не
// переживает перезагрузку или не переезжает в аккаунт целиком — обещание ложное, и
// лучше бы кнопки не было вовсе.
//
// Отдельная опасность — служебный код гостя. Он не должен попасть на сервер ни при
// каких обстоятельствах: в базе такой строки быть не может, а попытка синхронизации
// под ним — это мусор в чужой таблице и ошибки в консоли у ребёнка.
//
// Как запускать:  node test/guest.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SQL = fs.readFileSync(path.join(ROOT, 'supabase', 'self-register.sql'), 'utf8');

// ---------- модуль Progress в песочнице с общим «диском» ----------
// disk передаётся снаружи, чтобы можно было пережить перезагрузку: новый экземпляр
// модуля читает то же хранилище, что записал предыдущий.
function loadProgress(disk) {
    const moduleSrc = fs.readFileSync(path.join(ROOT, 'js', 'progress.js'), 'utf8');
    const store = disk || {};
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
    vm.runInContext(moduleSrc + '\n;globalThis.Progress = Progress;', sandbox,
                    { filename: 'js/progress.js' });
    sandbox.Progress.init();
    return { P: sandbox.Progress, store };
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

group('Гостевой прогресс не пропадает');

test('гость переживает перезагрузку', async () => {
    // Ровно то, на чём прежний анонимный режим ломался: playerCode был null,
    // profiles его не хранил, и init() собирал пустое состояние.
    const disk = {};
    const a = loadProgress(disk);
    a.P.startGuest();
    a.P.recordAnswer('integer+:add:1', 'correct', 1200);
    a.P.recordAnswer('integer+:add:1', 'correct', 1100);

    const b = loadProgress(disk);          // «закрыли и открыли заново»
    eq(b.P.isGuest(), true, 'после перезапуска гость перестал быть гостем');
    eq(b.P.get().totals.correct, 2, 'верные ответы гостя не пережили перезапуск');
});

test('гость продолжает с того же места, а не с экрана входа', async () => {
    // bootCodeScreen обязан узнать гостя и не спрашивать его заново.
    const m = HTML.match(/function bootCodeScreen\(\) \{[\s\S]*?\n        \}/);
    assert(m, 'bootCodeScreen не найден — срез сломался');
    assert(/isGuest\(\)/.test(m[0]),
        'запуск не отличает гостя — при каждом открытии его будет встречать экран входа');
});

group('Гость не уходит на сервер');

test('обычная синхронизация гостя не отправляет', async () => {
    const { P } = loadProgress();
    P.startGuest();
    const log = [];
    P.attachRemote({
        async read() { log.push('read'); return {}; },
        async write() { log.push('write'); },
        writeKeepalive() { log.push('farewell'); return true; }
    });
    P.recordAnswer('integer+:add:1', 'correct', 1000);
    await P.flush(true);                   // даже с force
    eq(log.length, 0, `гость постучался на сервер: ${log.join(', ')}`);
});

test('гостю приписали пароль — он всё равно не уходит на сервер', async () => {
    // Проверка именно ЯВНОГО запрета в flush(). Без пароля гость не отправляется и так:
    // подтверждать личность нечем, и flush выходит раньше. Первая версия этой проверки
    // не заметила подсадки «убрать явный запрет» — потому что проверяла не то. Здесь
    // гостю нарочно приписывается пароль, то есть воспроизводится ровно та ошибка,
    // ради которой запрет и стоит.
    const { P } = loadProgress();
    P.switchTo(P.GUEST_CODE, 'случайно-приписанный-пароль');
    const log = [];
    P.attachRemote({
        async read() { log.push('read'); return {}; },
        async write() { log.push('write'); },
        writeKeepalive() { log.push('farewell'); return true; }
    });
    P.recordAnswer('integer+:add:1', 'correct', 1000);
    await P.flush(true);
    eq(log.length, 0, `служебный код ушёл на сервер: ${log.join(', ')}`);
    eq(P.farewell(), false, 'гостю с паролем разрешили прощальную запись');
});

test('прощальная запись гостя не отправляет', async () => {
    const { P } = loadProgress();
    P.startGuest();
    const log = [];
    P.attachRemote({
        async read() { return {}; }, async write() {},
        writeKeepalive() { log.push('farewell'); return true; }
    });
    P.recordAnswer('integer+:add:1', 'correct', 1000);
    eq(P.farewell(), false, 'гостю разрешили прощальную запись');
    eq(log.length, 0, 'служебный код ушёл на сервер при закрытии вкладки');
});

test('служебный код не похож на человеческий и не пройдёт проверку сервера', async () => {
    const { P } = loadProgress();
    // Сервер требует три знака из букв, цифр, дефиса и подчёркивания (см.
    // supabase/self-register.sql). Служебный код обязан этой проверке НЕ удовлетворять,
    // иначе однажды кто-то заведёт себе такой логин руками.
    assert(!/^[A-Za-z0-9А-Яа-яЁё_-]+$/.test(P.GUEST_CODE),
        `служебный код «${P.GUEST_CODE}» человек может ввести как обычный логин`);
});

group('Переезд в аккаунт');

test('прогресс переезжает целиком', async () => {
    const { P } = loadProgress();
    P.startGuest();
    P.recordAnswer('integer+:mul:2', 'correct', 900);
    P.recordAnswer('integer+:mul:2', 'wrong', 3000);
    P.recordPuzzleCompleted();
    const before = JSON.parse(JSON.stringify(P.get().totals));

    eq(P.adoptGuest('MASHA', 'secret'), true, 'переезд не состоялся');
    eq(P.isGuest(), false, 'после переезда всё ещё гость');
    eq(P.getCode(), 'MASHA', 'код профиля не сменился');
    eq(JSON.stringify(P.get().totals), JSON.stringify(before), 'счётчики изменились при переезде');
    eq(P.get().accountType, 'self', 'новый аккаунт должен быть сам себе хозяин');
});

test('после переезда гостевого профиля больше нет', async () => {
    const disk = {};
    const a = loadProgress(disk);
    a.P.startGuest();
    a.P.recordAnswer('integer+:add:1', 'correct', 1000);
    a.P.adoptGuest('MASHA', 'secret');

    const b = loadProgress(disk);
    eq(b.P.isGuest(), false, 'после перезапуска вернулись в гостя');
    // Гостевой профиль не должен остаться на устройстве вторым «призраком»
    // с копией того же прогресса.
    const codes = b.P.listProfiles().map(p => p.code || p);
    assert(codes.indexOf(a.P.GUEST_CODE) < 0,
        `гостевой профиль остался на устройстве: ${JSON.stringify(codes)}`);
});

test('переезд не затирает уже существующий профиль', async () => {
    const { P } = loadProgress();
    P.switchTo('MASHA', 'pw');              // этот профиль уже есть на устройстве
    P.recordAnswer('integer+:add:1', 'correct', 1000);
    P.startGuest();
    P.recordAnswer('integer+:add:1', 'correct', 1000);
    eq(P.adoptGuest('MASHA', 'pw'), false, 'переезд поверх чужого профиля разрешён');
    eq(P.isGuest(), true, 'после отказа перестали быть гостем');
});

test('переезд возможен только из гостя', async () => {
    const { P } = loadProgress();
    P.switchTo('PETYA', 'pw');
    eq(P.adoptGuest('MASHA', 'pw'), false, 'обычному профилю разрешили «переезд»');
    eq(P.getCode(), 'PETYA', 'профиль сменился, хотя переезд должен был отказать');
});

test('после переезда прогресс уходит на сервер', async () => {
    const { P } = loadProgress();
    P.startGuest();
    P.recordAnswer('integer+:add:1', 'correct', 1000);
    const log = [];
    P.attachRemote({
        async read() { return {}; },
        async write() { log.push('write'); },
        writeKeepalive() { return true; }
    });
    P.adoptGuest('MASHA', 'secret');
    await P.flush(true);
    assert(log.includes('write'), 'заведённый аккаунт всё ещё не синхронизируется');
});

group('Регистрация собрана правильно');

test('в приложении есть все три двери', () => {
    assert(/playAsGuest\(\)/.test(HTML), 'нет входа без регистрации');
    assert(/openRegisterScreen\(\)/.test(HTML), 'нет перехода к регистрации');
    assert(/loginWithExistingCode\(\)/.test(HTML), 'пропал обычный вход');
});

test('повтора пароля нет, а глазик есть', () => {
    // Решение принято осознанно: повтор дети проваливают чаще, чем он что-то спасает,
    // и заменён он именно возможностью увидеть набранное.
    assert(/togglePassword\(/.test(HTML), 'нечем показать пароль — проверить себя ребёнку нечем');
    assert(!/Повтори пароль|Повторите пароль|repeatPassword/i.test(HTML),
        'вернулось поле повтора пароля');
});

test('почты в регистрации нет', () => {
    const m = HTML.match(/id="registerScreen"[\s\S]*?\n    <\/div>/);
    assert(m, 'экран регистрации не найден — срез сломался');
    assert(!/type="email"|Почта|E-mail|email/i.test(m[0]),
        'в регистрации появилась почта — это лишние данные ребёнка');
});

test('пороги в приложении и на сервере совпадают', () => {
    const codeMin = HTML.match(/REG_CODE_MIN\s*=\s*(\d+)/);
    const pwMin = HTML.match(/REG_PW_MIN\s*=\s*(\d+)/);
    assert(codeMin && pwMin, 'пороги регистрации не найдены');
    const sqlCode = SQL.match(/length\(btrim\(p_code\)\)\s*<\s*(\d+)/);
    const sqlPw = SQL.match(/length\(p_password\)\s*<\s*(\d+)/);
    assert(sqlCode && sqlPw, 'пороги не найдены в self-register.sql');
    eq(sqlCode[1], codeMin[1], 'порог логина в базе и в приложении разошёлся');
    eq(sqlPw[1], pwMin[1], 'порог пароля в базе и в приложении разошёлся');
});

test('сервер не принимает состояние при регистрации', () => {
    // Иначе любой одним запросом заводил бы себе аккаунт с любыми цифрами.
    assert(!/p_state/.test(SQL),
        'session_register принимает состояние из браузера — это дыра в статистике');
});

test('подсказка под полями короткая, пока не во что упереться', () => {
    // Читать правила до того, как в них упёрся, ребёнок не станет. Поэтому по умолчанию
    // стоит одна короткая строчка, а длинное объяснение приходит только на ошибку —
    // и говорит ровно про то, во что упёрся именно он.
    const m = HTML.match(/function registerHint\([\s\S]*?\n        \}/);
    assert(m, 'registerHint не найден — срез сломался');
    assert(/return null;/.test(m[0]),
        'подсказка ничего не возвращает как «всё в порядке» — длинный текст будет висеть всегда');
    // Три разные беды — три разные строчки, а не одна на все случаи.
    const texts = m[0].match(/t f?\(|tf?\('/g) || [];
    assert(texts.length >= 3,
        `объяснений всего ${texts.length} — на все беды одна строчка не годится`);
    const call = HTML.match(/function onRegisterInput\(\)[\s\S]*?\n        \}/);
    assert(call && /registerHint\(/.test(call[0]),
        'подсказка считается, но на экран не попадает');
});

test('запрещённые знаки в логине ловятся до нажатия кнопки', () => {
    // Иначе «маша!» уедет на сервер и вернётся общим отказом, из которого не понять,
    // что именно не так.
    const m = HTML.match(/const REG_CODE_RE = (.+);/);
    assert(m, 'в приложении нет проверки знаков логина — она есть только на сервере');
    const re = new RegExp(m[1].trim().replace(/^\/|\/$/g, ''));
    assert(re.test('masha7') && re.test('Маша_1') && re.test('ma-sha'),
        'обычные логины отвергаются');
    assert(!re.test('маша!') && !re.test('ма ша') && !re.test('ma.sha'),
        'служебные знаки в логине проходят');
});

test('гость не видит учительских разделов', () => {
    // Нашлось на снимках экрана: гость формально 'self', и ему показывали «Мои ученики»,
    // «Резервную копию», «Вход на устройствах» и «Опасную зону» — весь учительский слой.
    // «Опасная зона» страшнее прочего: там необратимый сброс всего прогресса.
    const m = HTML.match(/function renderProfileScreen\(\)[\s\S]*?setupFolds\('profileScreen'\)/);
    assert(m, 'renderProfileScreen не найден — срез сломался');
    // Проверяем именно СТРОКУ, где решается видимость. Первая версия искала
    // Progress.isGuest() по всей функции — и не замечала подсадки: этот вызов есть в
    // renderProfileScreen и по другому поводу (подпись «Гость» вместо кода).
    const rule = m[0].split('\n').find(l => l.includes('const tutorHidden'));
    assert(rule, 'признак «прятать учительское» не найден — срез сломался');
    assert(/Progress\.isGuest\(\)/.test(rule),
        `видимость учительских разделов не смотрит на гостя: ${rule.trim()}`);
    // «Мои ученики» прячутся ветвлением, остальные три — тернарником. Проверяем и то,
    // и другое: одного правила на все четыре тут нет.
    assert(/if \(tutorHidden\) \{/.test(m[0]),
        'раздел «Мои ученики» прячется не от гостя, а только от ученика репетитора');
    ['dangerSection', 'backupSection', 'sessionsSection'].forEach(id => {
        const line = m[0].split('\n').find(l => l.includes(id) && l.includes('style.display'));
        assert(line && /tutorHidden/.test(line),
            `раздел ${id} прячется не от гостя, а только от ученика репетитора`);
    });
});

test('напоминание гостю показывается после картинки, а не вместо неё', () => {
    const m = HTML.match(/function onPuzzleComplete\([\s\S]*?\n        \}/);
    assert(m, 'onPuzzleComplete не найден — срез сломался');
    assert(/isGuest\(\)/.test(m[0]), 'гостю не напоминают про аккаунт вовсе');
    assert(/setTimeout\(\s*offerAccountToGuest/.test(m[0]),
        'разговор про аккаунт начинается сразу и перебивает показ собранной картинки');
});

(async () => {
    for (const step of queue) await step();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
