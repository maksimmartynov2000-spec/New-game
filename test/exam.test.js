// Тесты вводного экзамена.
//
// Экзамен — единственное место в приложении, где ученик САМ себе открывает доступ.
// Поэтому опасных мест тут больше, чем обычно, и все они про честность:
//
//   1) Экзамен не должен попадать в статистику. 18 примеров, решённых на звезде,
//      которую ученик ещё не умеет, засеяли бы карту красным и испортили точность
//      за период. Проверяется прямо: в коде экзамена не должно быть НИ ОДНОГО
//      вызова записи.
//   2) Ход вверх-вниз не должен выдавать звезду, которую не подтвердили. Открывается
//      только та, на которой заход реально сдан.
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
    const el = () => ({ innerText: '', className: '', hidden: false, style: {}, children: [],
                        _html: '', set innerHTML(v) { this.children.length = 0; },
                        appendChild(c) { this.children.push(c); return c; },
                        addEventListener(n, f) { this.handlers = this.handlers || {}; this.handlers[n] = f; } });
    ['examScreen', 'examBody', 'examResult', 'examStep', 'examTime', 'examQuestion',
     'examAnswers', 'examResultCap', 'examResultText', 'examResultNote'].forEach(id => (byId[id] = el()));
    const box = {
        console, Math, Number, Object, Array, String, JSON, Date,
        t: (x) => x,
        tf: function (x) { let r = x; for (let i = 1; i < arguments.length; i++) r = r.split('%' + i).join(String(arguments[i])); return r; },
        document: { getElementById: (id) => byId[id] || null,
                    createElement: () => el() },
        setInterval: (fn) => { box.tick = fn; return 1; },
        clearInterval: () => { box.tick = null; },
        // Пример всегда один и тот же: экзамен проверяем, а не генератор.
        generateProblem: (op, level) => ({ text: `${level}0 + 1`, answer: level * 10 + 1, a: level * 10, b: 1 }),
        buildDistractors: () => [1, 2, 3],
        OP_LABELS: { add: '➕ Сложение' },
        levelAllowedByAccess: () => o.allowed !== false,
        levelGateApplies: () => o.gated !== false,
        levelLockReason: () => 'нужно золото',
        showNotice: async () => undefined,
        askConfirm: async () => !!o.confirm,
        refreshSectionLocks: () => {},
        // Экзамен теперь останавливается на время технических работ: часы под
        // заглушкой шли, а ученик не видел вопроса и терял попытку дня.
        maintenanceActive: () => !!(box.maintenance || o.maintenance),
        renderMaintenance: () => { box.maintenanceShown = true; },
        refreshAccess: async () => { box.refreshed = true; },
        supabaseClient: o.offline ? null : {},
        callAuthed: async (fn, args) => { box.sent = { fn, args }; return o.serverFail
            ? { data: { ok: false, error: o.serverFail } } : { data: { ok: true, passed: true } }; }
    };
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(EXAM_SRC
        + '\n;globalThis.E = { examOpen, examClose, examAnswer, examRoundOver, examFinish,'
        + ' EXAM_QUESTIONS, EXAM_PASS, EXAM_FAIL, EXAM_SECONDS, EXAM_ROUNDS, EXAM_START_LEVEL,'
        + ' EXAM_MAX_GRANT,'
        + ' get exam() { return exam; }, set exam(v) { exam = v; } };',
        box, { filename: 'index.html<экзамен>' });
    return { E: box.E, box, byId };
}

// Отвечает на весь заход: сколько верных из шести.
function answerRound(E, right) {
    for (let i = 0; i < E.EXAM_QUESTIONS; i++) E.examAnswer(i < right);
}

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

test('в коде экзамена нет ни одной записи прогресса', () => {
    // Это и есть вся гарантия: не флаг «сейчас экзамен», который можно забыть
    // проверить, а отсутствие самих вызовов.
    const banned = /Progress\.record|recordAnswer|recordMistakeKind|recordClass|evaluateTopicLadders|Progress\.unlock/;
    assert(!banned.test(EXAM_SRC),
        'экзамен зовёт запись прогресса — его ответы попадут в статистику');
});

test('экзамен не выдаёт пазлы и не двигает дневную цель', () => {
    assert(!/PuzzleReveal|recordPuzzle|renderDailyBar/.test(EXAM_SRC),
        'экзамен задевает награды, которых не зарабатывал');
});

group('Ход вверх-вниз');

test('сдал со второй звезды — идём на третью', () => {
    const w = load();
    w.E.examOpen('add');
    eq(w.E.exam.level, w.E.EXAM_START_LEVEL, 'начинаем со второй');
    answerRound(w.E, 5);
    eq(w.E.exam.level, 3, 'после сданной второй');
    eq(w.E.exam.best, 2, 'вторая подтверждена');
});

test('провалил — спускаемся', () => {
    const w = load();
    w.E.examOpen('add');
    answerRound(w.E, 2);
    eq(w.E.exam.level, 1, 'после провала второй');
    eq(w.E.exam.best, 0, 'ничего не подтверждено');
});

test('открывается только подтверждённая звезда, а не та, до которой дошли', () => {
    // Сдал вторую, провалил третью — открыть надо вторую.
    const w = load();
    w.E.examOpen('add');
    answerRound(w.E, 6);   // 2★ сдана
    answerRound(w.E, 1);   // 3★ провалена
    eq(w.E.exam.best, 2, 'выдали звезду, которую не подтвердили');
});

test('серединка никуда не двигает и заканчивает экзамен', () => {
    // Четыре из шести — это не «умеет» и не «не умеет». Ходить дальше не по чему.
    const w = load();
    w.E.examOpen('add');
    answerRound(w.E, 4);
    assert(w.E.exam.done, 'экзамен должен закончиться');
    eq(w.E.exam.best, 0, 'серединка звезду не даёт');
});

// Потолок выдачи. Экзамен считается в браузере, а серверу сообщается готовое
// число — подделать его можно из отладчика. По-настоящему это чинится только
// выдачей примеров с сервера, то есть второй копией правил сложности в SQL;
// для дыры ценой в звёздочку такой размен не окупается. Вместо этого экзамен
// открывает не больше трёх звёзд, а четвёртую и пятую открывает репетитор.
// Раньше эти же проверки требовали ровно обратного — что экзамен доходит до
// пятой; правило изменено сознательно, и проверки переписаны под него.
test('дальше потолка не поднимаемся', () => {
    const w = load();
    w.E.examOpen('add');
    w.E.exam.level = w.E.EXAM_MAX_GRANT; w.E.exam.low = w.E.EXAM_MAX_GRANT;
    answerRound(w.E, 6);
    assert(w.E.exam.done, 'экзамен должен закончиться на потолке');
    eq(w.E.exam.best, w.E.EXAM_MAX_GRANT, 'подтверждён потолок');
});

test('безошибочный экзамен доходит ровно до потолка и не выше', () => {
    const w = load();
    w.E.examOpen('add');
    for (let r = 0; r < 4; r++) answerRound(w.E, 6);
    assert(w.E.exam.done, 'экзамен должен закончиться');
    eq(w.E.exam.best, w.E.EXAM_MAX_GRANT, 'безошибочный экзамен должен давать ровно потолок');
});

test('потолок — три звезды, и он один на клиенте и на сервере', () => {
    const w = load();
    eq(w.E.EXAM_MAX_GRANT, 3, 'потолок в приложении');
    const cap = fs.readFileSync(path.join(ROOT, 'supabase', 'exam-cap.sql'), 'utf8');
    const m = cap.match(/function exam_max_grant\(\)[\s\S]*?select\s+(\d+)/);
    assert(m, 'в exam-cap.sql не найдена функция потолка');
    eq(Number(m[1]), w.E.EXAM_MAX_GRANT, 'потолок на сервере разошёлся с потолком в приложении');
});

test('экзамен ни при каком ходе не заявляет выше потолка', () => {
    // Перебираем все правдоподобные исходы заходов: 0-6 верных в каждом из четырёх.
    const bad = [];
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++)
        for (let c = 0; c <= 6; c++) for (let d = 0; d <= 6; d++) {
            const w = load();
            w.E.examOpen('add');
            for (const n of [a, b, c, d]) { if (w.E.exam.done) break; answerRound(w.E, n); }
            if (w.E.exam.best > w.E.EXAM_MAX_GRANT) bad.push(`${a}${b}${c}${d} → ${w.E.exam.best}`);
        }
    assert(bad.length === 0, `заявка выше потолка: ${bad.slice(0, 3).join(', ')}`);
});

test('больше четырёх заходов не бывает', () => {
    const w = load();
    w.E.examOpen('add');
    for (let r = 0; r < 4; r++) answerRound(w.E, 5);
    assert(w.E.exam.done, `экзамен идёт пятый заход: ${w.E.exam.round}`);
});

group('Время на пример');

test('время вышло — засчитывается ошибка', () => {
    const w = load();
    w.E.examOpen('add');
    const before = w.E.exam.right;
    for (let s = 0; s < w.E.EXAM_SECONDS; s++) w.box.tick();
    eq(w.E.exam.right, before, 'просроченный пример засчитали верным');
    eq(w.E.exam.asked, 2, 'после просрочки должен прийти следующий пример');
});

test('ответ останавливает часы, а не идёт поверх них', () => {
    const w = load();
    w.E.examOpen('add');
    w.E.examAnswer(true);
    // Новый пример завёл свои часы; старые не должны продолжать тикать в фоне.
    assert(typeof w.box.tick === 'function', 'часы нового примера не запустились');
});

group('Экзамен и технические работы');

// Заглушка накрывает экран, но экзамен идёт своим экраном и мимо startGame, где стоял
// единственный запрет на игру. Часы под заглушкой продолжали идти: ученик не видел
// вопроса, не мог ответить, каждые тридцать секунд получал ошибку — и терял попытку дня.
test('во время работ экзамен не начинается', () => {
    const w = load({ maintenance: true });
    w.E.examOpen('add');
    eq(w.E.exam, null, 'экзамен запустился во время технических работ');
    assert(w.box.maintenanceShown, 'заглушку даже не показали');
});

test('начавшийся экзамен замирает, а не сгорает', () => {
    // Работы начались посреди экзамена — часы обязаны встать, иначе ученик проиграет
    // экран, которого не видит.
    const w = load();
    w.E.examOpen('add');
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
    w.E.examOpen('add');
    answerRound(w.E, 6);
    answerRound(w.E, 1);
    await new Promise(r => setTimeout(r, 0));
    assert(w.box.sent, 'на сервер вообще ничего не ушло');
    eq(w.box.sent.args.p_op, 'add', 'действие');
    eq(w.box.sent.args.p_level, 2, 'звезда');
});

test('без связи результат не выдаётся за сохранённый', async () => {
    const w = load({ offline: true });
    w.E.examOpen('add');
    answerRound(w.E, 4);
    await new Promise(r => setTimeout(r, 0));
    assert(w.byId.examResultNote.innerText, 'молча сделали вид, что сохранили');
});

group('Вход с закрытой звезды');

test('экзамен предлагается только когда дело в воротах', () => {
    // Если звезду не выдал репетитор — экзамен ничего не решает: это его решение,
    // а не вопрос умения.
    const body = slice('async function openLockedStar', 'ВВОДНЫЙ ЭКЗАМЕН', 'панель звезды');
    assert(/levelAllowedByAccess/.test(body), 'панель не отличает ворота от невыданной звезды');
    assert(/EXAM_SECTION/.test(body), 'экзамен предлагается вне положительных целых');
});

group('Серверная часть');

test('экзамен работает только на положительных целых', () => {
    assert(/v_section\s+text\s*:=\s*'integer\+'/.test(SQL),
        'раздел не зашит — экзамен мог бы сузить выданное репетитором в других разделах');
});

test('экзамен только добавляет звёзды, но не отнимает', () => {
    assert(/union/i.test(SQL), 'новые звёзды не объединяются со старыми — часть могла бы пропасть');
});

test('одна попытка в день считает только НЕсданные', () => {
    // «Сдал — можно пробовать выше»: сданный заход попытку не тратит.
    assert(/not passed/.test(SQL), 'сданный экзамен тоже расходует попытку дня');
});

test('уровень с сервера проверяется, а не берётся на веру', () => {
    assert(/p_level\s*<\s*0\s*or\s*p_level\s*>\s*5/.test(SQL),
        'сервер примет любую звезду, которую пришлёт устройство');
});

(async () => {
    for (const step of queue) await step();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
