// Тесты дневной цели и серии дней.
//
// Зачем: это единственное место в игре, которое отвечает на вопрос «зачем заходить
// именно сегодня». Ошибка здесь не роняет ничего и не видна на экране разработчика —
// она видна ученику ровно один раз, утром, когда серия ни с того ни с сего обнулилась.
//
// Главная ловушка, которую тесты стерегут: серия НЕ должна обрываться из-за того, что
// сегодня ещё не начинали. День не кончился. Наивный подсчёт «считаем назад от
// сегодня» давал бы ноль каждое утро и восстанавливал цифру к вечеру.
//
// Как запускать:  node test/daily.test.js

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

function makeDoc() {
    const byId = {};
    const el = (tag) => ({
        tag, className: '', hidden: false, type: '', style: {}, children: [], handlers: {}, _text: '',
        get innerText() { return this._text; },
        set innerText(v) { this._text = String(v); },
        set innerHTML(v) { this.children.length = 0; },
        appendChild(ch) { this.children.push(ch); return ch; },
        addEventListener(name, fn) { this.handlers[name] = fn; }
    });
    return { doc: { getElementById: (id) => byId[id] || null, createElement: el,
                    createTextNode: (v) => ({ tag: '#text', className: '', children: [], _text: String(v),
                                              get innerText() { return this._text; } }) },
             add: (id) => (byId[id] = el('div')) };
}

function load(state) {
    const box = {
        console, Math, Number, Object, Array, String, Date,
        t: (x) => x,
        tf: function (x) {
            let out = x;
            for (let i = 1; i < arguments.length; i++) out = out.split('%' + i).join(String(arguments[i]));
            return out;
        },
        Progress: { get: () => state.st, dayKey: () => state.today }
    };
    const src = [
        slice('function shiftDayKey(key, deltaDays)', 'function isActiveDay', 'даты'),
        slice('function daysBetweenKeys(fromKey, toKey)', '\n\n', 'расстояние между днями'),
        slice('function pluralDaysWord(n)', '\n\n', 'склонение дней'),
        slice('function isActiveDay(d)', 'function aggregateDaily', 'активный день'),
        slice('// ===================== ДНЕВНАЯ ЦЕЛЬ', 'function earliestDayKey', 'дневная цель'),
        ';globalThis.R = { currentStreak, streakState, dailyProgress, renderDailyBar,'
            + ' DAILY_GOAL, FREEZE_EVERY, FREEZE_MAX };'
    ].join('\n');
    // shiftDayKey форматирует дату через Progress.dayKey — подменяем той же реализацией.
    box.Progress.dayKey = (d) => {
        if (!d) return state.today;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<дневная цель>' });
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

const TODAY = '2026-09-10';
const day = (c) => ({ c, w: 0, a: 0, s: 60, p: 0, ms: 0, mc: 0, t: {}, e: {}, te: {} });
function days(map) { const out = {}; Object.keys(map).forEach(k => (out[k] = day(map[k]))); return out; }

const R = load({ st: {}, today: TODAY }).R;

group('Серия дней');

test('серия считает дни подряд назад от сегодня', () => {
    eq(R.currentStreak(days({ '2026-09-08': 5, '2026-09-09': 5, '2026-09-10': 5 }), TODAY), 3);
});

test('сегодня ещё не начинали — серия жива, день не кончился', () => {
    // Наивный подсчёт дал бы ноль каждое утро и вернул бы цифру к вечеру.
    eq(R.currentStreak(days({ '2026-09-07': 5, '2026-09-08': 5, '2026-09-09': 5 }), TODAY), 3);
});

test('пропущенный вчерашний день серию обрывает', () => {
    eq(R.currentStreak(days({ '2026-09-05': 5, '2026-09-06': 5 }), TODAY), 0);
});

test('дыра в середине не склеивается', () => {
    eq(R.currentStreak(days({ '2026-09-06': 5, '2026-09-08': 5, '2026-09-09': 5, '2026-09-10': 5 }), TODAY), 3);
});

test('пустой журнал даёт ноль, а не падение', () => {
    eq(R.currentStreak({}, TODAY), 0);
    eq(R.currentStreak(null, TODAY), 0);
});

test('день без единого ответа за активный не считается', () => {
    const d = days({ '2026-09-09': 5, '2026-09-10': 5 });
    d['2026-09-08'] = { c: 0, w: 0, s: 0 };
    eq(R.currentStreak(d, TODAY), 2, 'пустой день должен обрывать серию');
});

test('длинный журнал считается за один проход, без ограничителя', () => {
    // Раньше здесь стоял ограничитель в 500 шагов: обход шёл по КАЛЕНДАРЮ назад и на
    // битом журнале мог не встретить дырки. Теперь обход идёт по записям журнала —
    // шагов ровно столько, сколько записей, и зациклиться негде. Значит, и правильный
    // ответ для девятисот подряд — девятьсот, а не «не больше пятисот».
    const d = {};
    for (let i = 0; i < 900; i++) {
        const dt = new Date(2026, 8, 10);
        dt.setDate(dt.getDate() - i);
        d[`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`] = day(3);
    }
    eq(R.currentStreak(d, TODAY), 900, 'длина серии');
});

test('далёкие друг от друга записи не разворачиваются в календарь', () => {
    // Журнал хранит записи, а не дни: у занимающегося через раз они растягиваются на
    // годы. Обход по календарю тут делал бы тысячи шагов на пустом месте.
    const d = { '2019-01-01': day(5), '2023-06-15': day(5), [TODAY]: day(5) };
    eq(R.currentStreak(d, TODAY), 1, 'серия — только сегодняшний день');
});

group('Дневная цель');

test('цель — двадцать примеров и одна для всех', () => {
    eq(R.DAILY_GOAL, 20, 'цель');
});

test('счёт идёт по верным ответам', () => {
    const d = days({ [TODAY]: 12 });
    d[TODAY].w = 7;
    const p = R.dailyProgress(d, TODAY);
    eq(p.done, 12, 'ошибки в дневной счёт не идут — иначе «сделано» на трёх экранах означало бы разное');
});

test('цель считается выполненной ровно на двадцатом', () => {
    eq(R.dailyProgress(days({ [TODAY]: 19 }), TODAY).complete, false);
    eq(R.dailyProgress(days({ [TODAY]: 20 }), TODAY).complete, true);
});

test('перевыполнение не ломает полоску', () => {
    eq(R.dailyProgress(days({ [TODAY]: 200 }), TODAY).ratio, 1, 'полоска не длиннее себя');
});

test('день, которого нет в журнале, — это ноль', () => {
    eq(R.dailyProgress({}, TODAY).done, 0);
});

group('Строка на экране');

function render(daily) {
    const dom = makeDoc();
    const box = load({ st: { daily }, today: TODAY });
    box.document = dom.doc;
    const bar = dom.add('dailyBar');
    box.R.renderDailyBar();
    const byClass = (cls) => {
        const out = [];
        (function walk(n) { n.children.forEach(ch => { if (ch.className === cls) out.push(ch); walk(ch); }); })(bar);
        return out;
    };
    return { bar, byClass, text: () => byClass('daily-goal-text')[0], streak: () => byClass('daily-streak')[0]
             || byClass('daily-streak fire')[0] };
}

test('до цели видно, сколько сделано и сколько нужно', () => {
    const v = render(days({ [TODAY]: 12 }));
    eq(v.text().innerText, 'Сегодня 12 из 20');
});

test('после цели цель не пропадает из строки', () => {
    // Раньше здесь было «Сегодня готово: 24» — 24 не с чем было сравнить,
    // и вопрос «а сколько надо было?» оставался без ответа.
    const v = render(days({ [TODAY]: 24 }));
    eq(v.text().innerText, 'Сегодня 24 из 20');
    assert(/done/.test(v.bar.className), 'выполненная цель должна быть помечена');
});

test('нулевую серию не показываем', () => {
    // «0 подряд» — это не факт, а укор. Занимался давно, вчера и сегодня — нет.
    const v = render(days({ '2026-09-01': 30 }));
    assert(!v.streak(), 'серии быть не должно');
});

// Огонь принадлежит сегодняшнему дню, а не длине серии. Прежнее правило (пять дней
// подряд) гасило огонёк у того, кто СЕГОДНЯ выполнил цель полностью, — и полоска
// «20 из 20» соседствовала с бледным значком.
test('цель не выполнена — огня нет, даже при длинной серии', () => {
    const d = days({ '2026-09-06': 5, '2026-09-07': 5, '2026-09-08': 5, '2026-09-09': 5, '2026-09-10': 5 });
    const chip = render(d).streak();
    assert(chip, 'серия должна показываться');
    assert(!/fire/.test(chip.className), `серия длинная, но сегодня 5 из 20: ${chip.className}`);
});

test('цель выполнена — огонь горит в тот же день', () => {
    const chip = render(days({ '2026-09-09': 5, [TODAY]: 20 })).streak();
    assert(chip && /fire/.test(chip.className), 'выполненная цель должна зажигать огонёк');
});

test('перевыполнил — огонь не гаснет', () => {
    const chip = render(days({ '2026-09-09': 5, [TODAY]: 33 })).streak();
    assert(chip && /fire/.test(chip.className), 'сверх цели огонь тем более горит');
});

test('полоска показывает долю, а не что попало', () => {
    const v = render(days({ [TODAY]: 10 }));
    eq(v.byClass('daily-goal-fill')[0].style.width, '50%');
});


group('Заморозки серии');

// Заморозка спасает серию за пропущенный день. Зарабатывается работой: одна за каждые
// пять дней с ВЫПОЛНЕННОЙ целью, в запасе не больше двух.
//
// Опасных мест два. Первое: направление обхода. Заморозка тратится на пропуск, а
// зарабатывается днями ДО него — считая назад, в момент дырки ещё неизвестно, есть ли
// чем платить, и любой пропуск прощался бы (или не прощался) наугад. Второе: заморозка
// не должна удлинять серию — она её только хранит, иначе пропущенные дни начнут
// накручивать число, за которым ребёнок следит.
const full = (c) => ({ c, w: 0, a: 0, s: 60, p: 0, ms: 0, mc: 0, t: {}, e: {}, te: {} });
// Даты подряд начиная с from: список значений «сколько верных в этот день».
function span(from, values) {
    const out = {};
    const [y, m, d] = from.split('-').map(Number);
    values.forEach((v, i) => {
        if (v === null) return;                       // null — пропущенный день
        const dt = new Date(y, m - 1, d + i);
        const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        out[k] = full(v);
    });
    return out;
}

test('пять дней с целью дают одну заморозку', () => {
    const s = R.streakState(span('2026-09-06', [20, 20, 20, 20, 20]), '2026-09-10');
    eq(s.streak, 5, 'серия');
    eq(s.freezes, 1, 'заморозок');
});

test('дни без выполненной цели заморозок не дают', () => {
    // Зайти на пять минут — серию продлит, но страховку не выслужит.
    const s = R.streakState(span('2026-09-06', [5, 5, 5, 5, 5]), '2026-09-10');
    eq(s.streak, 5, 'серия');
    eq(s.freezes, 0, 'заморозок');
});

test('больше двух в запасе не копится', () => {
    const days = [];
    for (let i = 0; i < 20; i++) days.push(20);
    const s = R.streakState(span('2026-08-22', days), '2026-09-10');
    eq(s.freezes, R.FREEZE_MAX, 'потолок запаса');
});

test('заморозка спасает пропущенный день', () => {
    // Пять дней с целью → заморозка. Потом пропуск. Потом ещё день.
    const s = R.streakState(span('2026-09-05', [20, 20, 20, 20, 20, null, 20]), '2026-09-11');
    eq(s.streak, 6, 'шесть занятых дней; пропущенный серию не удлиняет');
    eq(s.freezes, 0, 'заморозка потрачена');
    eq(s.spent, 1, 'потрачено');
});

test('без заморозки тот же пропуск серию рвёт', () => {
    const s = R.streakState(span('2026-09-05', [5, 5, 5, 5, 5, null, 5]), '2026-09-11');
    eq(s.streak, 1, 'после дырки счёт начинается заново');
    eq(s.spent, 0, 'тратить было нечего');
});

test('два пропуска подряд съедают обе заморозки', () => {
    const days = [];
    for (let i = 0; i < 10; i++) days.push(20);      // две заморозки
    days.push(null, null, 20);
    const s = R.streakState(span('2026-08-30', days), '2026-09-11');
    eq(s.streak, 11, 'серия цела');
    eq(s.freezes, 0, 'обе потрачены');
});

test('три пропуска подряд не переживает и полный запас', () => {
    const days = [];
    for (let i = 0; i < 10; i++) days.push(20);
    days.push(null, null, null, 20);
    const s = R.streakState(span('2026-08-29', days), '2026-09-11');
    eq(s.streak, 1, 'серия должна оборваться');
});

test('заморозки, заработанные ПОСЛЕ пропуска, его не оплачивают', () => {
    // Это и есть цена обхода вперёд: считая назад, легко «оплатить» дырку тем,
    // что заработано позже, и подарить серию, которой не было.
    const s = R.streakState(span('2026-09-04', [5, null, 20, 20, 20, 20, 20]), '2026-09-10');
    eq(s.streak, 5, 'до пропуска заморозок не было — серия начинается после него');
    eq(s.freezes, 1, 'заморозка заработана уже после дырки');
});

test('запас переживает обрыв серии', () => {
    const days = [];
    for (let i = 0; i < 5; i++) days.push(20);       // одна заморозка
    days.push(null, null, null, 20);                 // обрыв: одной не хватило
    const s = R.streakState(span('2026-09-02', days), '2026-09-10');
    eq(s.streak, 1, 'серия оборвана');
    eq(s.freezes, 0, 'единственная заморозка ушла в оплату первого пропущенного дня');
});

test('сегодняшний пустой день заморозку не тратит', () => {
    // День не кончился: это не пропуск.
    const s = R.streakState(span('2026-09-06', [20, 20, 20, 20, 20]), '2026-09-11');
    eq(s.streak, 5, 'серия жива');
    eq(s.freezes, 1, 'заморозка на месте');
});

test('видно, что заморозка сработала именно вчера', () => {
    const s = R.streakState(span('2026-09-04', [20, 20, 20, 20, 20, null, 20]), '2026-09-10');
    eq(s.lastFrozen, '2026-09-09', 'дата прощённого дня');
});

test('серия оборвалась — вчерашней заморозки не показываем', () => {
    const s = R.streakState(span('2026-09-04', [5, 5, 5, 5, 5, null, 5]), '2026-09-10');
    eq(s.lastFrozen, null, 'нечего было замораживать');
});

group('Заморозки на полоске дня');

test('снежинка появляется только когда запас есть', () => {
    const withIce = render(span('2026-09-06', [20, 20, 20, 20, 20]));
    assert(/❄️/.test(withIce.streak().children.map(c => c.innerText).join('')),
        'снежинки нет, хотя заморозка заработана');
    const without = render(span('2026-09-08', [5, 5, 5]));
    assert(!/❄️/.test(without.streak().children.map(c => c.innerText).join('')),
        'снежинка показана без запаса');
});

test('о сработавшей вчера заморозке сказано прямо', () => {
    const v = render(span('2026-09-04', [20, 20, 20, 20, 20, null, 20]));
    assert(v.byClass('daily-frozen-note')[0], 'нет сообщения о заморозке');
});

test('строка серии нажимается — иначе снежинку не объяснить', () => {
    const v = render(span('2026-09-06', [20, 20, 20, 20, 20]));
    assert(typeof v.streak().handlers.click === 'function', 'на строку серии не повесили обработчик');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
