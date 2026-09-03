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
        tag, className: '', hidden: false, style: {}, children: [], _text: '',
        get innerText() { return this._text; },
        set innerText(v) { this._text = String(v); },
        set innerHTML(v) { this.children.length = 0; },
        appendChild(ch) { this.children.push(ch); return ch; }
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
        slice('function isActiveDay(d)', 'function aggregateDaily', 'активный день'),
        slice('// ===================== ДНЕВНАЯ ЦЕЛЬ', 'function earliestDayKey', 'дневная цель'),
        ';globalThis.R = { currentStreak, dailyProgress, renderDailyBar, DAILY_GOAL, STREAK_FIRE_AT };'
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

test('битый журнал не вешает подсчёт', () => {
    // Ограничитель цикла: 500 дней подряд руками не набрать, а зациклиться нельзя.
    const d = {};
    for (let i = 0; i < 900; i++) {
        const dt = new Date(2026, 8, 10);
        dt.setDate(dt.getDate() - i);
        d[`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`] = day(3);
    }
    const got = R.currentStreak(d, TODAY);
    assert(got > 0 && got <= 500, `подсчёт вышел за ограничитель: ${got}`);
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

test('после цели строка меняется, а не исчезает', () => {
    const v = render(days({ [TODAY]: 24 }));
    eq(v.text().innerText, 'Сегодня готово: 24');
    assert(/done/.test(v.bar.className), 'выполненная цель должна быть помечена');
});

test('нулевую серию не показываем', () => {
    // «0 подряд» — это не факт, а укор. Занимался давно, вчера и сегодня — нет.
    const v = render(days({ '2026-09-01': 30 }));
    assert(!v.streak(), 'серии быть не должно');
});

test('серия меньше ударной — без огня', () => {
    const v = render(days({ '2026-09-08': 5, '2026-09-09': 5, '2026-09-10': 5 }));
    const chip = v.streak();
    assert(chip, 'серия должна показываться');
    assert(!/fire/.test(chip.className), `серия 3 не ударная: ${chip.className}`);
});

test('с пятого дня загорается огонёк', () => {
    const d = days({ '2026-09-06': 5, '2026-09-07': 5, '2026-09-08': 5, '2026-09-09': 5, '2026-09-10': 5 });
    const chip = render(d).streak();
    assert(chip && /fire/.test(chip.className), 'ударный режим должен зажигать огонёк');
});

test('порог ударного режима — пятый день', () => {
    eq(R.STREAK_FIRE_AT, 5, 'порог');
});

test('полоска показывает долю, а не что попало', () => {
    const v = render(days({ [TODAY]: 10 }));
    eq(v.byClass('daily-goal-fill')[0].style.width, '50%');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
