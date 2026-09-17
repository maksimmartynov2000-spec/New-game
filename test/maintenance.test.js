// Тесты заглушки на время технических работ.
//
// Опасность у этой штуки ровно одна и очень крупная: она умеет запереть учеников.
// Поэтому все спорные случаи обязаны решаться В ПОЛЬЗУ ИГРЫ — файла нет, время не
// разобралось, часы устройства врут, работы уже кончились. Ошибка в другую сторону
// (поиграл во время работ) не стоит ничего, ошибка в эту — приложение, которое не
// открывается, и никто не понимает почему.
//
// Отсюда и устройство: в файле стоит время ОКОНЧАНИЯ работ, а не выключатель.
// Забытый выключатель запер бы всех насовсем; прошедшее время снимает заглушку само.
//
// Как запускать:  node test/maintenance.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const FLAG_FILE = fs.readFileSync(path.join(ROOT, 'content', 'maintenance.js'), 'utf8');

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

function load(flag, opts) {
    const o = opts || {};
    const byId = {};
    const el = () => ({ innerText: '', style: {} });
    ['maintenanceScreen', 'maintenanceWait', 'maintenanceNote',
     'maintenanceClock', 'maintenanceTrack', 'maintenanceFill'].forEach(id => (byId[id] = el()));
    const box = {
        console, Math, Number, Date, Object, String,
        // Язык ученика: записка на экране работ берётся по нему.
        LANG: o.lang || 'ru',
        t: (x) => x,
        tf: function (x) { let r = x; for (let i = 1; i < arguments.length; i++) r = r.split('%' + i).join(String(arguments[i])); return r; },
        window: flag === undefined ? {} : { MAINTENANCE: flag },
        gameActive: !!o.playing,
        setInterval: () => 0,
        // Полоска перерыва помнит, когда это устройство впервые увидела эту заглушку.
        // Заглушка хранилища своя: ей нужно только отдавать и принимать одну строку.
        localStorage: o.noStorage
            ? { getItem() { throw new Error('приватное окно'); },
                setItem() { throw new Error('приватное окно'); },
                removeItem() { throw new Error('приватное окно'); } }
            : (function () {
                const mem = {};
                return { getItem: (k) => (k in mem ? mem[k] : null),
                         setItem: (k, v) => { mem[k] = String(v); },
                         removeItem: (k) => { delete mem[k]; } };
            })(),
        JSON,
        document: { getElementById: (id) => byId[id] || null }
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(
        slice('// ===================== ТЕХНИЧЕСКИЕ РАБОТЫ', '        // ===================== ЗАДАНИЯ ДНЯ И НЕДЕЛИ', 'работы')
        + '\n;globalThis.M = { maintenanceActive, maintenanceLeftMs, maintenanceWaitText,'
        + ' renderMaintenance, renderMaintenanceClock };',
        box, { filename: 'index.html<технические работы>' });
    return { M: box.M, byId };
}

const inMinutes = (n) => new Date(Date.now() + n * 60000).toISOString();
const agoMinutes = (n) => new Date(Date.now() - n * 60000).toISOString();

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }

group('Спорное решается в пользу игры');

test('файла с флагом нет — работ нет', () => {
    eq(load(undefined).M.maintenanceActive(), false, 'без файла приложение заперлось');
});

test('файл есть, но пустой — работ нет', () => {
    eq(load({}).M.maintenanceActive(), false);
    eq(load({ until: null }).M.maintenanceActive(), false);
    eq(load({ until: '' }).M.maintenanceActive(), false);
});

test('время написано криво — работ нет, а не «навсегда»', () => {
    // Опечатка в дате не должна запирать учеников до следующего мержа.
    eq(load({ until: 'завтра в шесть' }).M.maintenanceActive(), false, 'кривая дата заперла игру');
    eq(load({ until: '2026-13-45T99:99:99Z' }).M.maintenanceActive(), false, 'невозможная дата заперла игру');
});

test('время прошло — заглушка снимается сама', () => {
    eq(load({ until: agoMinutes(1) }).M.maintenanceActive(), false, 'работы кончились минуту назад');
    eq(load({ until: agoMinutes(60 * 24 * 30) }).M.maintenanceActive(), false, 'забытый месяц назад флаг');
});

test('в файле не стоит перерыв на неделю вперёд', () => {
    // Включать перерыв — обычное дело, а вот забыть его включённым надолго — беда.
    // Само по себе время в будущем не страшно: оно проходит, и заглушка снимается.
    // Страшно другое — окно длиной в дни, поставленное по ошибке в дате.
    const m = /until:\s*'([^']+)'/.exec(FLAG_FILE);
    if (!m) {
        assert(/until:\s*null/.test(FLAG_FILE), 'until написан чем-то, чего мы не ждали');
        return;   // перерыв выключен — обсуждать нечего
    }
    const until = Date.parse(m[1]);
    assert(isFinite(until), `время перерыва не разбирается: ${m[1]}`);
    const hours = (until - Date.now()) / 3600000;
    assert(hours < 24, `перерыв заканчивается через ${Math.round(hours)} ч — это уже не перерыв`);
});

group('Когда работы идут');

test('время в будущем — играть нельзя', () => {
    eq(load({ until: inMinutes(20) }).M.maintenanceActive(), true);
});

test('заглушка показывается и говорит, когда приходить', () => {
    const w = load({ until: inMinutes(20) });
    eq(w.M.renderMaintenance(), true, 'заглушка не показалась');
    eq(w.byId.maintenanceScreen.style.display, 'flex');
    assert(/20/.test(w.byId.maintenanceWait.innerText), `нет времени ожидания: ${w.byId.maintenanceWait.innerText}`);
});

test('начатую миссию не рвём', () => {
    // Выкинуть ребёнка с половины примеров — ровно та неприятная ситуация,
    // ради которой заглушка и делается.
    const w = load({ until: inMinutes(20) }, { playing: true });
    eq(w.M.renderMaintenance(), false, 'заглушка перебила идущую миссию');
    eq(w.byId.maintenanceScreen.style.display, 'none');
});

test('записка написана на всех четырёх языках', () => {
    // Заголовок экрана и «приходи через пять минут» переводятся сами, а записка —
    // содержимое. Пока она была одной строкой, ученик на английском видел посреди
    // экрана русский текст. И видел чаще всего остального: экран работ показывается
    // всем и как раз после обновления.
    const src = fs.readFileSync(path.join(ROOT, 'content', 'maintenance.js'), 'utf8');
    const m = src.match(/note:\s*(\{[\s\S]*?\}|null)/);
    assert(m, 'записки в файле не нашлось');
    if (m[1] === 'null') return;                       // записку убрали совсем — это законно
    ['ru', 'en', 'fr', 'de'].forEach(l =>
        assert(new RegExp("\\b" + l + ":\\s*'").test(m[1]), `нет языка ${l}`));
});

test('на языке ученика берётся его строчка', () => {
    const w = load({ until: inMinutes(10),
                     note: { ru: 'Чиню статистику', en: 'Fixing stats' } }, { lang: 'en' });
    w.M.renderMaintenance();
    eq(w.byId.maintenanceNote.innerText, 'Fixing stats');
});

test('незнакомый язык откатывается на русский, а не на пустоту', () => {
    const w = load({ until: inMinutes(10), note: { ru: 'Чиню статистику' } }, { lang: 'fr' });
    w.M.renderMaintenance();
    eq(w.byId.maintenanceNote.innerText, 'Чиню статистику');
});

test('строчка от репетитора показывается, а пустая прячется', () => {
    const withNote = load({ until: inMinutes(10), note: 'Чиню статистику' });
    withNote.M.renderMaintenance();
    eq(withNote.byId.maintenanceNote.innerText, 'Чиню статистику');
    eq(withNote.byId.maintenanceNote.style.display, '');
    const without = load({ until: inMinutes(10) });
    without.M.renderMaintenance();
    eq(without.byId.maintenanceNote.style.display, 'none', 'пустая строка занимает место');
});

group('Сколько ждать');

test('вдалеке округляем вверх, а не вниз', () => {
    // «Через 21 минуту» и не успеть хуже, чем сказать «через 25»: ученик вернётся
    // ровно к названному сроку и упрётся в ту же заглушку.
    const w = load({ until: inMinutes(1) });
    eq(w.M.maintenanceWaitText(21 * 60000), 'Приходи примерно через 25 минут');
    eq(w.M.maintenanceWaitText(46 * 60000), 'Приходи примерно через 50 минут');
});

test('вблизи называем минуты точно — иначе экран кажется замершим', () => {
    // С округлением до пяти большое число держится одной и той же цифрой пять минут
    // подряд. Там, где ждать осталось немного, это и превращает ожидание в стену.
    eq(load({}).M.maintenanceWaitText(12 * 60000), 'Приходи через 12 минут');
    eq(load({}).M.maintenanceWaitText(4 * 60000), 'Приходи через 4 минуты');
    eq(load({}).M.maintenanceWaitText(2 * 60000), 'Приходи через 2 минуты');
});

test('последняя минута названа словами, а не «1 минуту»', () => {
    eq(load({}).M.maintenanceWaitText(40 * 1000), 'Осталась минута');
    eq(load({}).M.maintenanceWaitText(1 * 60000), 'Осталась минута');
});

test('число на экране меняется само, и не раз в полминуты', () => {
    // Экран без движения читается как сломанный. Перерисовка обязана заставать смену
    // минуты вскоре после того, как она случилась.
    const body = slice('const MAINTENANCE_POLL_MS', 'function maintenanceLeftMs', 'частота обновления');
    const ms = /MAINTENANCE_POLL_MS = (\d+)/.exec(body);
    assert(ms && Number(ms[1]) <= 15000, `обновление раз в ${ms && ms[1]} мс — экран будет казаться замершим`);
});

test('на долгие работы точное время не обещаем', () => {
    const w = load({ until: inMinutes(600) });
    eq(w.M.maintenanceWaitText(w.M.maintenanceLeftMs()), 'Загляни попозже');
});

group('Играть во время работ нельзя');

test('вход в миссию закрыт в одной точке — в самом startGame', () => {
    // Миссию запускают из четырёх мест: выбор миссии, окно открытой звезды, задания
    // и повтор. Караулить каждое по отдельности значило бы однажды забыть одно.
    const body = slice('function startGame() {', '\n        }', 'начало миссии');
    assert(/maintenanceActive\(\)/.test(body), 'startGame не проверяет технические работы');
});

test('после конца миссии заглушка появляется', () => {
    const body = slice('function advanceMissionReveals', '\n\n', 'очередь наград');
    assert(/renderMaintenance\(\)/.test(body),
        'во время миссии заглушку придержали и забыли показать после');
});

// ============ Отсчёт и полоска ============
//
// Заглушка была глухой дверью: гаечный ключ, строчка словами — и всё. Строчка к тому
// же обновлялась раз в пятнадцать секунд, столько же ученик после конца работ смотрел
// в неё впустую. Секунды на экране лечат и то и другое, но только если такт частый.

test('отсчёт идёт до секунды, а не до минуты', () => {
    const w = load({ until: new Date(Date.now() + 3 * 60000 + 25000).toISOString() });
    w.M.renderMaintenance();
    assert(/^\d\d:\d\d$/.test(w.byId.maintenanceClock.innerText),
        `отсчёт не в виде мм:сс: «${w.byId.maintenanceClock.innerText}»`);
    const [mm, ss] = w.byId.maintenanceClock.innerText.split(':').map(Number);
    assert(mm === 3 && ss >= 23 && ss <= 25,
        `отсчёт врёт: показывает ${w.byId.maintenanceClock.innerText}, а осталось 3:25`);
});

test('такт опроса не реже секунды', () => {
    // Полоска и секунды обновляются этим же таймером. Редкий такт — застывший экран.
    const m = SCRIPT.match(/const MAINTENANCE_POLL_MS = (\d+);/);
    assert(m, 'не найден такт опроса');
    assert(Number(m[1]) <= 1000, `такт ${m[1]} мс — секунды на экране будут стоять`);
});

test('полоска доходит до конца ровно к концу работ', () => {
    const w = load({ until: new Date(Date.now() + 60000).toISOString() });
    w.M.renderMaintenance();                       // первый взгляд: полоска в начале
    const начало = parseFloat(w.byId.maintenanceFill.style.width);
    assert(начало < 5, `полоска начинается не с нуля: ${w.byId.maintenanceFill.style.width}`);
    // Полминуты спустя — половина. Время двигаем подменой Date.now, а не ожиданием.
    const now = Date.now;
    try {
        Date.now = () => now() + 30000;
        w.M.renderMaintenance();
    } finally { Date.now = now; }
    const середина = parseFloat(w.byId.maintenanceFill.style.width);
    assert(середина > 40 && середина < 60,
        `к середине перерыва полоска на ${середина}%, а должна быть около половины`);
});

test('без хранилища полоска прячется, а отсчёт остаётся', () => {
    // Приватное окно: localStorage БРОСАЕТ на любое обращение. Заглушка обязана
    // работать и там — остаться без объяснения, почему игра заперта, хуже, чем
    // остаться без полоски.
    const w = load({ until: new Date(Date.now() + 5 * 60000).toISOString() }, { noStorage: true });
    w.M.renderMaintenance();
    assert(/^\d\d:\d\d$/.test(w.byId.maintenanceClock.innerText),
        `отсчёт пропал вместе с хранилищем: «${w.byId.maintenanceClock.innerText}»`);
    eq(w.byId.maintenanceTrack.style.display, 'none',
       'полоску нечем считать, а она показана — будет висеть пустой');
    eq(w.byId.maintenanceScreen.style.display, 'flex', 'заглушка не показалась вовсе');
});

test('во время работ в игру ведёт только коллекция', () => {
    // Кнопка на заглушке открывает коллекцию — она ТОЛЬКО ЧИТАЕТСЯ и в прогресс не
    // пишет ничего. А вот саму заглушку прятать нельзя: тогда, закрыв картинки,
    // ребёнок оказался бы в игре, которую мы только что заперли.
    const fn = SCRIPT.match(/function peekCollectionDuringBreak\(\)[\s\S]*?\n        \}/);
    assert(fn, 'peekCollectionDuringBreak не найдена');
    assert(!/maintenanceScreen/.test(fn[0]),
        'заглушка прячется при открытии коллекции — закрыв её, ученик попадёт в запертую игру');
    assert(/zIndex/.test(fn[0]), 'коллекция не поднята над заглушкой — её не будет видно');
    // И слой обязан возвращаться на место при закрытии.
    const close = SCRIPT.match(/function closeCollectionModal\(\)[\s\S]*?\n        \}/);
    assert(close && /zIndex\s*=\s*''/.test(close[0]),
        'поднятый слой коллекции не снимается — останется поверх всего навсегда');
    // Фон окна коллекции полупрозрачный: сквозь него просвечивало «Обновляюсь».
    assert(/background\s*=\s*'#/.test(fn[0]),
        'фон коллекции не заглушён — заглушка будет просвечивать сквозь картинки');
    assert(/background\s*=\s*''/.test(close[0]),
        'глухой фон не снимается — останется на окне коллекции навсегда');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
