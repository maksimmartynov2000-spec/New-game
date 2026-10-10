// Тесты вводного экзамена.
//
// Экзамен — единственное место в приложении, где ученик САМ себе открывает доступ.
// Поэтому опасных мест тут больше, чем обычно, и все они про честность:
//
//   1) Экзамен не должен попадать в статистику. 18 примеров, решённых на звезде,
//      которую ученик ещё не умеет, засеяли бы карту красным и испортили точность
//      за период. Проверяется прямо: в коде экзамена не должно быть НИ ОДНОГО
//      вызова записи.
//   2) Экзамен проверяет ОДНУ звезду — ту, на которую нажали, — и открывает её, только
//      если сдано 8 из 10. Раньше он ходил заходами вверх-вниз с 2★, и ребёнок с
//      открытой 2★ пересдавал её, прежде чем увидеть 3★.
//   3) Время на пример обязано считаться ошибкой. Без этого экзамен сдаётся счётом
//      на пальцах, и ученик уезжает туда, где пороги скорости втрое жёстче.
//
// Как запускать:  node test/exam.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SQL = fs.readFileSync(path.join(ROOT, 'supabase', 'exam.sql'), 'utf8');

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}
const EXAM_SRC = slice('// ===================== ВВОДНЫЙ ЭКЗАМЕН', '        // ===================== ТЕХНИЧЕСКИЕ РАБОТЫ', 'экзамен');

// Подставной мир: генератор выдаёт предсказуемые примеры, сервер соглашается.
function load(opts) {
    const o = opts || {};
    const byId = {};
    const el = () => {
        const cls = new Set();
        return { innerText: '', hidden: false, style: {}, children: [], disabled: false,
                 get className() { return [...cls].join(' '); },
                 set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
                 classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
                              toggle: (c, on) => (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c) },
                 set innerHTML(v) { this.children.length = 0; },
                 appendChild(c) { this.children.push(c); return c; },
                 setAttribute() {},
                 addEventListener(n, f) { this.handlers = this.handlers || {}; this.handlers[n] = f; } };
    };
    ['examScreen', 'examBody', 'examResult', 'examStep', 'examTime', 'examQuestion',
     'examAnswers', 'examResultCap', 'examResultText', 'examResultNote',
     'examDots', 'examGoal', 'examFeedback', 'examMistakes', 'examPlay'].forEach(id => (byId[id] = el()));
    const box = {
        console, Math, Number, Object, Array, String, JSON, Date,
        t: (x) => x,
        tf: function (x) { let r = x; for (let i = 1; i < arguments.length; i++) r = r.split('%' + i).join(String(arguments[i])); return r; },
        document: { getElementById: (id) => byId[id] || null,
                    createElement: () => el() },
        setInterval: (fn) => { box.tick = fn; return 1; },
        clearInterval: () => { box.tick = null; },
        // Часы проверки связи. Не запускаем по-настоящему: держать прогон шесть секунд
        // ради одного промиса незачем — а вот ЗАПОМНИТЬ срок полезно, по нему и
        // проверяется, что потолок вообще выставлен.
        // Таймеры копятся, а не запускаются: следующий пример приходит после подсветки
        // ответа, и проверке нужно самой решать, когда пауза кончилась (см. answer()).
        // Первый таймер — потолок ожидания проверки связи; его срок и запоминаем.
        timers: [],
        setTimeout: (fn, ms) => { box.timers.push({ fn, ms });
                                  if (box.probeCapMs === undefined) box.probeCapMs = ms;
                                  return box.timers.length; },
        clearTimeout: (id) => { if (box.timers[id - 1]) box.timers[id - 1].cancelled = true; },
        Promise,
        // Пример всегда один и тот же: экзамен проверяем, а не генератор.
        generateProblem: (op, level, neg) => { box.genNeg = (box.genNeg || []).concat(!!neg);
                                               box.genLevels = (box.genLevels || []).concat(level);
                                               return { text: `${level}0 + 1`, answer: level * 10 + 1, a: level * 10, b: 1 }; },
        buildDistractors: (op, a, b, ans, neg) => { box.decoyNeg = (box.decoyNeg || []).concat(!!neg); return [1, 2, 3]; },
        // Для «÷ 0» игра берёт варианты отсюда, а не из buildDistractors.
        buildNoSolutionOptions: (a, neg) => { box.decoyNeg = (box.decoyNeg || []).concat(!!neg); return [0, 63, 1]; },
        // Пробный экзамен — только у репетитора. o.notTutor изображает ученика.
        examTrialAllowed: () => !o.notTutor,
        OP_LABELS: { add: '➕ Сложение' },
        levelAllowedByAccess: () => o.allowed !== false,
        // Какие звёзды у ученика уже открыты — для совета, где тренироваться.
        isLevelOpen: (sec, op, lvl) => (o.open || [1]).indexOf(lvl) >= 0,
        startMissionAt: (op, level, sec) => { box.started = { op, level, sec }; },
        levelGateApplies: () => o.gated !== false,
        levelLockReason: () => 'нужно золото',
        showNotice: async () => undefined,
        showToast: () => {},
        askConfirm: async () => !!o.confirm,
        refreshSectionLocks: () => {},
        // Экзамен теперь останавливается на время технических работ: часы под
        // заглушкой шли, а ученик не видел вопроса и терял попытку дня.
        maintenanceActive: () => !!(box.maintenance || o.maintenance),
        renderMaintenance: () => { box.maintenanceShown = true; },
        refreshAccess: async () => { box.refreshed = true; },
        supabaseClient: o.offline ? null : {},
        // Экзамен теперь стучится на сервер ДО начала — проверить связь. Токен и код
        // он берёт отсюда; o.noAuth снимает их, изображая устройство без входа.
        Progress: { getCode: () => (o.noAuth ? null : 'PUPIL'),
                    authFor: () => (o.noAuth ? null : { token: 'tok' }) },
        // Проверка связи и сохранение результата — разные вызовы, и падать они должны
        // порознь: иначе нельзя проверить случай «связь была, но пропала посреди».
        callAuthed: async (fn, args) => {
            box.sent = { fn, args };
            box.calls = (box.calls || []).concat(fn);
            if (fn === 'session_my_access') {
                return o.probeFail ? { data: { ok: false, error: 'offline' } } : { data: { ok: true, access: {} } };
            }
            return o.serverFail
                ? { data: { ok: false, error: o.serverFail } } : { data: { ok: true, passed: true } };
        }
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(EXAM_SRC
        + '\n;globalThis.E = { examOpen, examClose, examAnswer, examFinish, examPracticeLevel,'
        + ' EXAM_QUESTIONS, EXAM_PASS, EXAM_SECONDS, EXAM_FEEDBACK_MS,'
        + ' EXAM_MAX_GRANT, EXAM_SECTIONS, examOptions,'
        + ' get exam() { return exam; }, set exam(v) { exam = v; } };',
        box, { filename: 'index.html<экзамен>' });
    return { E: box.E, box, byId };
}

// Пауза подсветки кончилась: запускаем отложенный переход к следующему примеру.
function endPause(w) {
    const ms = [w.E.EXAM_FEEDBACK_MS.right, w.E.EXAM_FEEDBACK_MS.wrong];
    w.box.timers.filter(x => !x.ran && !x.cancelled && ms.indexOf(x.ms) >= 0)
        .forEach(x => { x.ran = true; x.fn(); });
}
// Вариант на кнопке: верный или любой неверный.
function pick(w, right) {
    const set = w.E.exam.set;
    return set.options.filter(o => right ? o.value === set.correct : o.value !== set.correct)[0];
}
// Ответить на текущий пример и дождаться следующего.
function answer(w, right) {
    w.E.examAnswer(pick(w, right));
    endPause(w);
}
// Весь экзамен: сколько верных из десяти, верные — первыми.
function answerAll(w, right) {
    for (let i = 0; i < w.E.EXAM_QUESTIONS; i++) answer(w, i < right);
}
const settle = () => new Promise(r => setImmediate(r));

let passed = 0, failed = 0;
const failures = [];
const queue = [];
// Прогон по очереди и с ожиданием: часть проверок асинхронная (отправка результата
// на сервер), и прежний синхронный прогонщик молча выбрасывал их промисы — проверки
// «проходили», ничего не проверив. Мутация это и вскрыла.
function test(name, fn) {
    queue.push(async () => {
        try { await fn(); passed++; console.log(`  ✓ ${name}`); }
        catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
    });
}
function group(nameStr) { queue.push(async () => console.log(`\n${nameStr}`)); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }

group('Экзамен не трогает статистику');

test('в коде экзамена нет ни одной записи прогресса', async () => {
    // Это и есть вся гарантия: не флаг «сейчас экзамен», который можно забыть
    // проверить, а отсутствие самих вызовов.
    const banned = /Progress\.record|recordAnswer|recordMistakeKind|recordClass|evaluateTopicLadders|Progress\.unlock/;
    assert(!banned.test(EXAM_SRC),
        'экзамен зовёт запись прогресса — его ответы попадут в статистику');
});

test('экзамен не выдаёт пазлы и не двигает дневную цель', async () => {
    assert(!/PuzzleReveal|recordPuzzle|renderDailyBar/.test(EXAM_SRC),
        'экзамен задевает награды, которых не зарабатывал');
});

group('Экзамен на одну звезду');

test('экзамен идёт на ту звезду, на которую нажали, — все десять примеров', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.E.exam.level, 3, 'звезда экзамена');
    answerAll(w, 10);
    eq(JSON.stringify(w.box.genLevels), JSON.stringify(Array(10).fill(3)), 'звёзды примеров');
});

test('десять примеров, сдать — восемь', async () => {
    const w = load();
    eq(w.E.EXAM_QUESTIONS, 10, 'примеров');
    eq(w.E.EXAM_PASS, 8, 'порог');
});

test('8 из 10 — сдано: на сервер уходит эта звезда', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 8);
    await settle();
    eq(w.box.sent.args.p_level, 3, 'звезда');
});

test('7 из 10 — не сдано: на сервер уходит ноль', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 7);
    await settle();
    eq(w.box.sent.args.p_level, 0, 'звезда');
});

test('на 2★ так же: сдал — уходит 2', async () => {
    const w = load();
    await w.E.examOpen('sub', 'integer+', 2);
    answerAll(w, 9);
    await settle();
    eq(w.box.sent.args.p_level, 2, 'звезда');
    eq(w.box.sent.args.p_op, 'sub', 'действие');
});

test('досрочно не кончается: и после трёх ошибок, и после восьми верных — до десятого', async () => {
    // Решение Максима: ребёнок доходит до конца и видит весь свой счёт.
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    for (let i = 0; i < 3; i++) answer(w, false);
    assert(!w.E.exam.done, 'экзамен кончился после трёх ошибок');
    eq(w.E.exam.asked, 4, 'после трёх ошибок идёт четвёртый пример');
    const v = load();
    await v.E.examOpen('add', 'integer+', 3);
    for (let i = 0; i < 8; i++) answer(v, true);
    assert(!v.E.exam.done, 'экзамен кончился после восьми верных');
    for (let i = 0; i < 2; i++) answer(v, true);
    assert(v.E.exam.done, 'после десятого примера экзамен не кончился');
});

test('вниз не спускается: после провала второго захода нет', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 0);
    assert(w.E.exam.done, 'экзамен не кончился');
    eq(w.box.genLevels.length, 10, 'примеров всего');
    assert(w.box.genLevels.every(l => l === 3), 'был заход на другой звезде: ' + w.box.genLevels.join(','));
});

test('первую звезду не экзаменуют — она открыта всегда', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 1);
    eq(w.E.exam, null, 'экзамен на 1★ начался');
});

test('выше потолка экзамена нет', async () => {
    for (const lvl of [4, 5, undefined]) {
        const w = load();
        await w.E.examOpen('add', 'integer+', lvl);
        eq(w.E.exam, null, `экзамен на ${lvl}★ начался`);
    }
});

// Потолок выдачи. Экзамен считается в браузере, а серверу сообщается готовое
// число — подделать его можно из отладчика. По-настоящему это чинится только
// выдачей примеров с сервера, то есть второй копией правил сложности в SQL;
// для дыры ценой в звёздочку такой размен не окупается. Вместо этого экзамен
// открывает не больше трёх звёзд, а четвёртую и пятую открывает репетитор.
test('потолок — три звезды, и он один на клиенте и на сервере', async () => {
    const w = load();
    eq(w.E.EXAM_MAX_GRANT, 3, 'потолок в приложении');
    const cap = fs.readFileSync(path.join(ROOT, 'supabase', 'exam-cap.sql'), 'utf8');
    const m = cap.match(/function exam_max_grant\(\)[\s\S]*?select\s+(\d+)/);
    assert(m, 'в exam-cap.sql не найдена функция потолка');
    eq(Number(m[1]), w.E.EXAM_MAX_GRANT, 'потолок на сервере разошёлся с потолком в приложении');
});

test('ни при каком счёте экзамен не заявляет чужую звезду', async () => {
    // Перебор: обе звезды экзамена и любой счёт от 0 до 10. Уходит либо сама
    // звезда (8 и больше), либо ноль — и никогда выше потолка.
    const bad = [];
    for (const lvl of [2, 3]) for (let right = 0; right <= 10; right++) {
        const w = load();
        await w.E.examOpen('add', 'integer+', lvl);
        answerAll(w, right);
        await settle();
        const sent = w.box.sent.args.p_level;
        const want = right >= 8 ? lvl : 0;
        if (sent !== want || sent > w.E.EXAM_MAX_GRANT) bad.push(`${lvl}★, ${right} верных → ${sent}`);
    }
    assert(bad.length === 0, bad.slice(0, 4).join('; '));
});

group('Обратная связь');

const btnOf = (w, right) => w.E.exam.buttons.filter(b => right ? b.opt.value === w.E.exam.set.correct
                                                               : b.opt.value !== w.E.exam.set.correct)[0].btn;

test('неверный ответ: нажатый — красный, верный подсвечен, назван правильный', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    const wrongBtn = btnOf(w, false), rightBtn = btnOf(w, true);
    w.E.examAnswer(pick(w, false));
    assert(wrongBtn.classList.contains('btn-wrong'), 'нажатый неверный не красный');
    assert(rightBtn.classList.contains('btn-correct'), 'верный не подсвечен');
    assert(w.E.exam.buttons.every(b => b.btn.classList.contains('locked')), 'кнопки не заперты на время подсветки');
    eq(w.byId.examFeedback.innerText, '✗ Неверно. Правильный ответ: 31', 'подпись');
    assert(w.byId.examFeedback.classList.contains('wrong'), 'подпись не красная');
});

test('верный ответ: зелёный и «Верно»', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    const rightBtn = btnOf(w, true);
    w.E.examAnswer(pick(w, true));
    assert(rightBtn.classList.contains('btn-correct'), 'верный не зелёный');
    assert(!w.E.exam.buttons.some(b => b.btn.classList.contains('btn-wrong')), 'что-то покраснело при верном ответе');
    eq(w.byId.examFeedback.innerText, '✓ Верно', 'подпись');
    assert(w.byId.examFeedback.classList.contains('right'), 'подпись не зелёная');
});

test('пока горит подсветка, часы стоят и второе нажатие не считается', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    w.E.examAnswer(pick(w, true));
    w.E.examAnswer(pick(w, true));
    eq(w.E.exam.right, 1, 'двойное нажатие засчитано дважды');
    eq(w.box.tick, null, 'часы идут во время подсветки');
    eq(w.E.exam.asked, 1, 'следующий пример пришёл раньше конца подсветки');
    endPause(w);
    eq(w.E.exam.asked, 2, 'после подсветки следующий пример не пришёл');
    assert(typeof w.box.tick === 'function', 'часы нового примера не пошли');
});

test('неверный ответ держится дольше верного — успеть прочесть правильный', async () => {
    const w = load();
    assert(w.E.EXAM_FEEDBACK_MS.wrong > w.E.EXAM_FEEDBACK_MS.right, JSON.stringify(w.E.EXAM_FEEDBACK_MS));
    assert(w.E.EXAM_FEEDBACK_MS.wrong <= 2500, 'подсветка тянется слишком долго');
});

test('кружки: по одному на пример, ✓ и ✗ по порядку, текущий отмечен', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answer(w, true);
    answer(w, false);
    const dots = w.byId.examDots.children;
    eq(dots.length, 10, 'кружков');
    eq(dots[0].className, 'exam-dot right', 'первый');
    eq(dots[0].innerText, '✓', 'значок первого');
    eq(dots[1].className, 'exam-dot wrong', 'второй');
    eq(dots[1].innerText, '✗', 'значок второго');
    eq(dots[2].className, 'exam-dot now', 'текущий');
    eq(dots[3].className, 'exam-dot', 'ещё впереди');
});

test('сколько набрано и сколько нужно — на экране', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.byId.examGoal.innerText, 'Верных: 0 · нужно 8 из 10', 'в начале');
    answer(w, true);
    answer(w, false);
    eq(w.byId.examGoal.innerText, 'Верных: 1 · нужно 8 из 10', 'после двух ответов');
});

test('закрыл экзамен во время подсветки — следующий пример не приходит, и новый экзамен не сбивается', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    w.E.examAnswer(pick(w, true));
    const old = w.box.timers[w.box.timers.length - 1];
    w.E.examClose();
    assert(old.cancelled, 'переход к следующему примеру не отменён');
    await w.E.examOpen('add', 'integer+', 3);
    old.fn();   // даже если браузер всё-таки позовёт старый таймер
    eq(w.E.exam.asked, 1, 'старый таймер пролистал новый экзамен');
});

group('Время на пример');


test('время вышло — засчитывается ошибка, и это сказано', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    const before = w.E.exam.right;
    for (let s = 0; s < w.E.EXAM_SECONDS; s++) w.box.tick();
    eq(w.E.exam.right, before, 'просроченный пример засчитали верным');
    eq(w.byId.examFeedback.innerText, '⏱ Время вышло. Правильный ответ: 31', 'подпись');
    endPause(w);
    eq(w.E.exam.asked, 2, 'после просрочки должен прийти следующий пример');
});

test('ответ останавливает часы, а не идёт поверх них', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    w.box.tick(); w.box.tick(); w.box.tick();
    answer(w, true);
    // Новый пример завёл свои часы; старые не должны продолжать тикать в фоне.
    assert(typeof w.box.tick === 'function', 'часы нового примера не запустились');
    eq(w.E.exam.left, w.E.EXAM_SECONDS, 'новый пример начал не с полного времени');
});

group('Экзамен и технические работы');

// Заглушка накрывает экран, но экзамен идёт своим экраном и мимо startGame, где стоял
// единственный запрет на игру. Часы под заглушкой продолжали идти: ученик не видел
// вопроса, не мог ответить, каждые тридцать секунд получал ошибку — и терял попытку дня.
test('во время работ экзамен не начинается', async () => {
    const w = load({ maintenance: true });
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.E.exam, null, 'экзамен запустился во время технических работ');
    assert(w.box.maintenanceShown, 'заглушку даже не показали');
});

test('начавшийся экзамен замирает, а не сгорает', async () => {
    // Работы начались посреди экзамена — часы обязаны встать, иначе ученик проиграет
    // экран, которого не видит.
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    const before = w.E.exam.left;
    w.box.tick(); w.box.tick();
    assert(w.E.exam.left < before, 'часы не идут и в обычное время — проверка бессмысленна');
    const paused = w.E.exam.left;
    w.box.maintenance = true;
    for (let i = 0; i < 5; i++) w.box.tick();
    eq(w.E.exam.left, paused, 'часы шли под заглушкой');
});

group('Что уходит на сервер');

test('на сервер уходит подтверждённая звезда и действие', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 9);
    await settle();
    assert(w.box.sent, 'на сервер вообще ничего не ушло');
    eq(w.box.sent.args.p_op, 'add', 'действие');
    eq(w.box.sent.args.p_level, 3, 'звезда');
});

// Раньше эта проверка ловила несохранённый результат на экране итогов: без связи
// экзамен доходил до конца и показывал его. Теперь без связи он вовсе не начинается,
// и проверять нужно это — экрана итогов быть не должно, потому что нечего итожить.
test('без связи результат не выдаётся за сохранённый', async () => {
    const w = load({ offline: true });
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.E.exam, null, 'экзамен начался без связи — его результат некуда деть');
    eq(w.byId.examResultCap.innerText, '', 'экран итогов показан, хотя экзамена не было');
    // Связь пропала посреди экзамена — случай остался, и он проверяется отдельно
    // («результат не сохранился — про открытые звёзды молчим»).
});

group('Вход с закрытой звезды');

test('экзамен предлагается только когда дело в воротах', async () => {
    // Если звезду не выдал репетитор — экзамен ничего не решает: это его решение,
    // а не вопрос умения.
    const body = slice('async function openLockedStar', 'ВВОДНЫЙ ЭКЗАМЕН', 'панель звезды');
    assert(/levelAllowedByAccess/.test(body), 'панель не отличает ворота от невыданной звезды');
    assert(/EXAM_SECTIONS\.indexOf\(secKey\)/.test(body), 'экзамен предлагается вне разделов, где он открывает звёзды');
});

test('экзамен не предлагается там, где он не поможет', async () => {
    // Потолок экзамена — третья звезда. Проверки уровня в панели не было вовсе:
    // ребёнок нажимал 4★, ему предлагали экзамен, он его сдавал — и 4★ не
    // открывалась. Обещание, которое не может сбыться.
    const body = slice('async function openLockedStar', 'ВВОДНЫЙ ЭКЗАМЕН', 'панель звезды');
    assert(/level\)\s*<=\s*EXAM_MAX_GRANT/.test(body),
        'экзамен снова предлагается выше своего потолка');
});

test('панель не обещает, что выше открывает только репетитор', async () => {
    // У ворот нет потолка по уровню: золото на 3★ открывает 4★, золото на 4★ —
    // пятую. Фраза «дальше открывает репетитор» была прямой неправдой.
    const body = slice('async function openLockedStar', 'ВВОДНЫЙ ЭКЗАМЕН', 'панель звезды');
    const texts = [...body.matchAll(/tf?\('([^']*)'/g)].map(m => m[1]).join(' | ');
    assert(!/репетитор/.test(texts), `панель снова отсылает к репетитору: ${texts}`);
});

test('панель называет звезду экзамена и порог и запускает экзамен на ней', async () => {
    const body = slice('async function openLockedStar', 'ВВОДНЫЙ ЭКЗАМЕН', 'панель звезды');
    assert(/examOpen\(op, secKey, level\)/.test(body), 'экзамен запускается не на нажатой звезде');
    assert(/tf\('Или пройди экзамен на %1★[^']*нужно %5 верных/.test(body), 'в панели не названы звезда и порог');
    assert(/level, opName, EXAM_QUESTIONS, EXAM_SECONDS, EXAM_PASS/.test(body), 'в панель подставлены не те числа');
});

group('Итог');

test('сдал: звезда открыта, счёт и кнопка «Играть на 3★» ведёт в миссию на ней', async () => {
    const w = load();
    await w.E.examOpen('mul', 'integer+', 3);
    answerAll(w, 9);
    await settle();
    eq(w.byId.examResultCap.innerText, '🔓 3★ открыта!', 'заголовок');
    assert(/^Верных: 9 из 10 — экзамен сдан\./.test(w.byId.examResultText.innerText), w.byId.examResultText.innerText);
    assert(!w.byId.examPlay.hidden, 'кнопки «Играть» нет');
    eq(w.byId.examPlay.innerText, '🚀 Играть на 3★', 'кнопка');
    w.byId.examPlay.onclick();
    eq(JSON.stringify(w.box.started), JSON.stringify({ op: 'mul', level: 3, sec: 'integer+' }), 'миссия');
    eq(w.E.exam, null, 'экран экзамена не закрылся');
});

test('не сдал: звезда закрыта, сколько не хватило и где тренироваться; играть не зовут', async () => {
    const w = load({ open: [1, 2] });
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 6);
    await settle();
    eq(w.byId.examResultCap.innerText, '3★ пока закрыта', 'заголовок');
    eq(w.byId.examResultText.innerText, 'Верных: 6 из 10, а нужно 8. Потренируйся на 2★ и пересдай завтра.', 'текст');
    assert(w.byId.examPlay.hidden, 'зовут играть на закрытой звезде');
});

test('тренироваться — на самой высокой открытой звезде ниже', async () => {
    const w = load({ open: [1] });   // 2★ тоже закрыта
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.E.examPracticeLevel(), 1, 'при закрытой 2★');
    const v = load({ open: [1, 2] });
    await v.E.examOpen('add', 'integer+', 3);
    eq(v.E.examPracticeLevel(), 2, 'при открытой 2★');
});

test('ошибки — списком: пример, верный ответ и свой ответ или «время вышло»', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    const wrong = pick(w, false);
    w.E.examAnswer(wrong); endPause(w);
    for (let s = 0; s < w.E.EXAM_SECONDS; s++) w.box.tick();
    endPause(w);
    for (let i = 0; i < 8; i++) answer(w, true);
    await settle();
    const rows = w.byId.examMistakes.children.map(x => x.innerText);
    assert(!w.byId.examMistakes.hidden, 'список ошибок спрятан');
    eq(JSON.stringify(rows), JSON.stringify(['Где были ошибки', `30 + 1 · верно: 31 · твой ответ: ${wrong.label}`,
                                             '30 + 1 · верно: 31 · время вышло']), 'список');
});

test('без ошибок списка нет', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 10);
    await settle();
    assert(w.byId.examMistakes.hidden, 'пустой список ошибок показан');
});

test('в журнале экзаменов у репетитора нет рода', async () => {
    // «Не сдал» про девочку — ошибка. Пишем про экзамен: «экзамен не сдан».
    const body = slice('async function renderExamLog', '// ===================== ВВОДНЫЙ ЭКЗАМЕН', 'журнал экзаменов');
    const texts = [...body.matchAll(/tf?\('([^']*)'/g)].map(m => m[1]);
    assert(texts.length >= 2, 'строки журнала не нашлись — проверка стала пустой');
    const bad = texts.filter(x => /(^|[^А-Яа-яЁё])(сдал|сдала|прош[её]л|прошла)([^А-Яа-яЁё]|$)/.test(x));
    assert(bad.length === 0, 'род в журнале: ' + bad.join(' | '));
});

group('Серверная часть');

group('Без связи экзамен не начинается');

// Экзамен сдаётся один раз в день, а звёзды открывает только сервер. Без связи
// ребёнок проходил четыре захода, двадцать четыре примера, и получал «результат не
// сохранился»: единственная за день попытка потрачена впустую.
test('нет сервера — экзамен не стартует', async () => {
    const w = load({ offline: true });
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.E.exam, null, 'экзамен всё-таки начался без связи');
});

test('сервер не ответил — экзамен не стартует', async () => {
    const w = load({ probeFail: true });
    await w.E.examOpen('add', 'integer+', 3);
    eq(w.E.exam, null, 'экзамен начался, хотя проверка связи не прошла');
});

// Запрос без потолка по времени — это застывший экран. На плохой связи он не падает,
// а висит: ребёнок нажал «Пройти экзамен» и смотрит, как ничего не происходит.
// Проверка эту болезнь и нашла — сначала на себе: прогон экранов повис намертво.
test('проверка связи не ждёт вечно', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    assert(w.box.probeCapMs > 0 && w.box.probeCapMs <= 10000,
        `потолок ожидания не выставлен или слишком велик: ${w.box.probeCapMs}`);
});

test('связь есть — экзамен идёт как раньше', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    assert(w.E.exam && w.E.exam.level === 3 && w.E.exam.asked === 1,
        'проверка связи сломала обычный запуск');
});

group('Экран не поздравляет звёздами, которых не открыл');

// Связь могла пропасть посреди экзамена. Раньше «🔓 Открыто до 3★» писалось ДО ответа
// сервера: заголовок обещал звёзды, а приписка под ним сообщала, что ничего не
// сохранилось. Ребёнок читает крупное.
test('результат не сохранился — про открытые звёзды молчим', async () => {
    const w = load({ serverFail: 'save_failed' });
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 9);   // сдано
    await settle();
    const cap = w.byId.examResultCap.innerText;
    const text = w.byId.examResultText.innerText;
    assert(!/открыт/i.test(cap + ' ' + text),
        `экран обещает открытые звёзды, хотя результат не сохранён: «${cap}» / «${text}»`);
    assert(w.byId.examResultNote.innerText,
        'приписка про несохранённый результат пропала — ученик не узнает, что случилось');
    assert(w.byId.examPlay.hidden, 'зовут играть на звезде, которая не открылась');
});

test('результат сохранился — звёзды называются как прежде', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    answerAll(w, 9);
    await settle();
    eq(w.byId.examResultCap.innerText, '🔓 3★ открыта!', 'заголовок сохранённого результата');
    eq(w.byId.examResultNote.innerText, '', 'у успешного результата появилась приписка об ошибке');
});

test('экзамен работает только на положительных целых', async () => {
    assert(/v_section\s+text\s*:=\s*'integer\+'/.test(SQL),
        'раздел не зашит — экзамен мог бы сузить выданное репетитором в других разделах');
});

test('экзамен только добавляет звёзды, но не отнимает', async () => {
    assert(/union/i.test(SQL), 'новые звёзды не объединяются со старыми — часть могла бы пропасть');
});

test('одна попытка в день считает только НЕсданные', async () => {
    // «Сдал — можно пробовать выше»: сданный заход попытку не тратит.
    assert(/not passed/.test(SQL), 'сданный экзамен тоже расходует попытку дня');
});

test('уровень с сервера проверяется, а не берётся на веру', async () => {
    assert(/p_level\s*<\s*0\s*or\s*p_level\s*>\s*5/.test(SQL),
        'сервер примет любую звезду, которую пришлёт устройство');
});

group('Кнопки ответа');

// Раньше экзамен печатал значения вариантов как есть. На делении это давало
// кнопку «null» (верный ответ к «63 ÷ 0») и кнопку «NO_SOLUTION» (ловушка):
// сломанная кнопка стояла в 22% вопросов по делению на 1★.
const labels = (set) => set.options.map(o => o.label);

test('у «63 ÷ 0» верная кнопка — «Нет решения», а не «null»', async () => {
    const w = load();
    // Обычные ловушки деления сами бывают «Нет решения». Возьми их для «÷ 0» —
    // и на экране окажутся две такие кнопки: одна верная, другая нет.
    w.box.buildDistractors = () => [4, 'NO_SOLUTION', 56];
    const set = w.E.examOptions({ text: '63 ÷ 0', answer: null, noSolution: true, a: 63, b: 0 }, 'div', 2);
    assert(labels(set).indexOf('Нет решения') >= 0, 'нет кнопки «Нет решения»: ' + labels(set).join(' | '));
    assert(labels(set).indexOf('null') < 0, 'осталась кнопка «null»');
    eq(labels(set).filter(l => l === 'Нет решения').length, 1, 'кнопок «Нет решения»');
    const right = set.options.filter(o => o.value === set.correct);
    eq(right.length, 1, 'верная кнопка одна');
    eq(right[0].label, 'Нет решения', 'верная кнопка');
});

test('ловушка «Нет решения» подписана словами и засчитывается ошибкой', async () => {
    const w = load();
    w.box.buildDistractors = () => [4, 'NO_SOLUTION', 56];
    const set = w.E.examOptions({ text: '28 ÷ 2', answer: 14, a: 28, b: 2 }, 'div', 2);
    assert(labels(set).indexOf('NO_SOLUTION') < 0, 'служебное слово на кнопке');
    const trap = set.options.filter(o => o.label === 'Нет решения');
    eq(trap.length, 1, 'ловушка на месте');
    assert(trap[0].value !== set.correct, 'ловушка не может быть верной');
});

test('на кнопках нет служебных слов ни в одном вопросе', async () => {
    const w = load();
    w.box.buildDistractors = () => [4, 'NO_SOLUTION', 56];
    [{ answer: 14, a: 28, b: 2 }, { answer: null, noSolution: true, a: 63, b: 0 }].forEach(p => {
        labels(w.E.examOptions(p, 'div', 2)).forEach(l =>
            assert(!/^(null|undefined|NaN|NO_SOLUTION)$/.test(l), 'кнопка «' + l + '»'));
    });
});

test('в живом вопросе нажатие «Нет решения» засчитано верным', async () => {
    const w = load();
    w.box.generateProblem = () => ({ text: '63 ÷ 0', answer: null, noSolution: true, a: 63, b: 0 });
    await w.E.examOpen('div', 'integer+', 2);
    const btn = w.byId.examAnswers.children.filter(b => b.innerText === 'Нет решения')[0];
    assert(btn, 'кнопки «Нет решения» нет на экране');
    btn.handlers.click();
    eq(w.E.exam.right, 1, 'верный ответ не засчитан');
});

group('Экзамен по разделам');

// Сдать экзамен на 3★ без ошибок.
async function passToCap(w) {
    answerAll(w, 10);
    await settle();
}

test('разделы, где экзамен открывает звёзды, одни и те же в приложении и в базе', async () => {
    // Включение отрицательных — одно движение в двух местах. Разойдутся списки —
    // либо приложение предложит экзамен, который база не примет, либо база
    // примет то, чего приложение никогда не пошлёт.
    const SQL2 = fs.readFileSync(path.join(ROOT, 'supabase', 'exam-sections.sql'), 'utf8');
    const m = SQL2.match(/function exam_sections\(\)[\s\S]*?array\[([^\]]*)\]/);
    assert(m, 'в exam-sections.sql не найден список разделов');
    const inDb = m[1].match(/'[^']*'/g).map(x => x.slice(1, -1));
    const w = load();
    eq(JSON.stringify([...w.E.EXAM_SECTIONS]), JSON.stringify(inDb), 'списки разделов разошлись');
});

test('пока отрицательные не открыты всем, настоящего экзамена на них нет', async () => {
    // Решение репетитора: отрицательные открываются ученикам только готовыми.
    // В тот день эта проверка поменяется вместе со списком — и это правильно.
    const w = load();
    eq(w.E.EXAM_SECTIONS.indexOf('integer-'), -1, 'отрицательные уже в списке экзамена');
    await w.E.examOpen('add', 'integer-', 3);
    eq(w.E.exam, null, 'настоящий экзамен на отрицательных начался');
});

test('пробный экзамен на отрицательных строит отрицательные примеры и ловушки', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer-', 3, { trial: true });
    assert(w.E.exam && w.E.exam.trial, 'пробный экзамен не начался');
    assert(w.box.genNeg.length && w.box.genNeg.every(x => x), 'примеры строятся положительными');
    assert(w.box.decoyNeg.length && w.box.decoyNeg.every(x => x), 'ловушки строятся положительными');
});

test('на положительных примеры и ловушки остались положительными', async () => {
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    assert(w.box.genNeg.every(x => !x), 'положительный экзамен получил отрицательные примеры');
    assert(w.box.decoyNeg.every(x => !x), 'положительный экзамен получил отрицательные ловушки');
});

test('пробный экзамен ничего не отправляет и прямо говорит, что ничего не открыл', async () => {
    const w = load();
    await w.E.examOpen('mul', 'integer-', 3, { trial: true });
    await passToCap(w);
    const calls = w.box.calls || [];
    eq(calls.join(','), '', 'пробный экзамен ходил на сервер');
    eq(w.byId.examResultCap.innerText, '🎓 Пробный: 3★ сдана', 'итог');
    assert(/Верных: 10 из 10/.test(w.byId.examResultText.innerText), 'нет счёта: ' + w.byId.examResultText.innerText);
    assert(/ничего не открыто/.test(w.byId.examResultText.innerText), 'не сказано, что ничего не открыто');
    assert(!/открыта/.test(w.byId.examResultCap.innerText), 'пробный обещает открытые звёзды');
    assert(w.byId.examPlay.hidden, 'пробный зовёт играть, как будто звезда открылась');
});

test('пробный экзамен только у репетитора', async () => {
    const w = load({ notTutor: true });
    await w.E.examOpen('add', 'integer-', 3, { trial: true });
    eq(w.E.exam, null, 'ученик запустил пробный экзамен');
});

test('на положительных сохранение зовёт старую дверь, без раздела', async () => {
    // Так новое приложение работает и с базой, где exam-sections.sql ещё не запущен.
    const w = load();
    await w.E.examOpen('add', 'integer+', 3);
    await passToCap(w);
    eq(w.box.sent.fn, 'session_take_exam', 'результат ушёл не туда');
    assert(!('p_section' in w.box.sent.args), 'на положительных передан раздел: ' + JSON.stringify(w.box.sent.args));
});

test('в другом разделе сохранение передаёт раздел', async () => {
    // Список пока из одних положительных — расширяем его прямо в песочнице.
    const w = load();
    w.E.EXAM_SECTIONS.push('integer-');
    await w.E.examOpen('add', 'integer-', 3);
    await passToCap(w);
    eq(w.box.sent.args.p_section, 'integer-', 'раздел не передан');
});

test('кнопка пробного экзамена видна только репетитору и только на одном действии целых', () => {
    const body = slice('function examTrialAllowed', 'function startTrialExam', 'пробный экзамен');
    assert(/getAccountType\(\) === 'self'/.test(body), 'пробный экзамен не ограничен репетитором');
    assert(/isGuest\(\)/.test(body), 'гость мог бы увидеть пробный экзамен');
    assert(/category !== 'integer'/.test(body), 'пробный экзамен предлагается не на целых');
    assert(/ops\.length !== 1/.test(body), 'пробный экзамен — на нескольких действиях сразу');
    assert(/level >= 2 && level <= EXAM_MAX_GRANT/.test(body), 'пробный экзамен — на звезде, где настоящего не бывает');
    const start = slice('function startTrialExam', '// ===================== РЕЖИМ ОБУЧЕНИЯ', 'запуск пробного');
    assert(/examOpen\(target\.op, target\.secKey, target\.level, \{ trial: true \}\)/.test(start),
        'пробный экзамен идёт не на выбранной звезде');
});

(async () => {
    for (const step of queue) await step();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
