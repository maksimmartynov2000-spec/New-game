// Восстановление из резервной копии.
//
// Копия делалась, а положить её обратно было нечем: в приложении не было ни одного
// места, которое читает файл, и на сервере — ни одной функции, которой репетитор мог
// бы записать состояние ученика. Дверь работала в одну сторону, и при аварии на
// сервере от копии не было никакого проку — а раздел при этом честно просил её
// сохранять.
//
// Это единственное действие в приложении, которое ПЕРЕЗАПИСЫВАЕТ чужой прогресс,
// поэтому проверяется не только «работает», но и «не делает лишнего».
//
// Как запускать:  node test/backup.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = require('./app-source').appScript(HTML);

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }

function slice(a, b) {
    const from = SCRIPT.indexOf(a);
    const to = SCRIPT.indexOf(b, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${a}`);
    return SCRIPT.slice(from, to);
}

const box = { console, Math, Number, Object, Array, String, JSON, Date, BACKUP_FORMAT: 1 };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(
    slice('function backupSummary(state)', 'async function importAllProgress')
    + '\n;globalThis.B = { parseBackup, backupSummary };',
    box, { filename: 'index.html<копия>' });
const B = box.B;

const goodProfile = { code: 'PUPIL1', label: 'Ярослава', source: 'server',
                      state: { totals: { correct: 512, wrong: 40 } } };
const good = { format: 1, exportedAt: '2026-09-07T00:00:00Z', tutorCode: 'TUTOR',
               profiles: [goodProfile] };

group('Что принимается за копию');

test('своя копия разбирается', () => {
    const r = B.parseBackup(JSON.stringify(good));
    assert(!r.error, r.error);
    eq(r.profiles.length, 1);
    eq(r.profiles[0].code, 'PUPIL1');
});

test('не JSON — отказ, а не падение', () => {
    const r = B.parseBackup('это не json');
    assert(r.error, 'мусор приняли за копию');
    assert(/не разобрать/.test(r.error), r.error);
});

test('чужой JSON без профилей — отказ', () => {
    assert(B.parseBackup('{"hello":1}').error, 'приняли посторонний файл');
    assert(B.parseBackup('[]').error, 'приняли массив');
    assert(B.parseBackup('null').error, 'приняли null');
});

test('копия другого формата — отказ с названием формата', () => {
    const r = B.parseBackup(JSON.stringify(Object.assign({}, good, { format: 99 })));
    assert(r.error && /99/.test(r.error), `сказано: ${r.error}`);
});

test('профили без состояния выбрасываются, а не ломают разбор', () => {
    const mixed = { format: 1, profiles: [goodProfile, { code: 'X' }, { state: {} }, null] };
    const r = B.parseBackup(JSON.stringify(mixed));
    assert(!r.error, r.error);
    eq(r.profiles.length, 1, 'битые профили просочились');
});

test('пустой список профилей — отказ', () => {
    const r = B.parseBackup(JSON.stringify({ format: 1, profiles: [{ code: 'X' }] }));
    assert(r.error && /нет ни одного/.test(r.error), `сказано: ${r.error}`);
});

group('Что показывается перед заменой');

test('сводка читает верные ответы, а не что попало', () => {
    eq(B.backupSummary({ totals: { correct: 512 } }), 512);
    eq(B.backupSummary({}), 0, 'пустое состояние должно давать ноль, а не падать');
    eq(B.backupSummary(null), 0);
});

group('Осторожность самого опасного действия');

test('перед заменой спрашивают, и красным', () => {
    // Это единственное место, которое перезаписывает чужой прогресс. Оно обязано
    // выглядеть как необратимое — рядом с «Сбросить прогресс», а не как обычная кнопка.
    const body = slice('async function importAllProgress', 'async function exportAllProgress');
    assert(/askConfirm/.test(body), 'замена идёт без подтверждения');
    assert(/danger:\s*true/.test(body), 'подтверждение не помечено как необратимое');
});

test('в подтверждении названы имена и числа до и после', () => {
    // «Восстановил, и стало меньше» не должно быть неожиданностью: копия может быть
    // старее того, что на сервере, и увидеть это надо ДО замены, а не после.
    const body = slice('async function importAllProgress', 'async function exportAllProgress');
    assert(/сейчас \$\{x\.before\}/.test(body) && /станет \$\{x\.after\}/.test(body),
        'в подтверждении нет чисел «сейчас» и «станет»');
});

test('ученики, которых в копии нет, не трогаются', () => {
    const body = slice('async function importAllProgress', 'async function exportAllProgress');
    assert(/missing/.test(body), 'нет разбора «профиля из копии нет на сервере»');
    assert(/тронуты не будут/.test(body), 'про нетронутых не сказано вслух');
});

test('ученик восстановить ничего не может', () => {
    // Правило то же, что у сброса прогресса: экран решает, что показать, а действие
    // решает, что выполнить, и второе не зависит от первого.
    const body = slice('async function importAllProgress', 'async function exportAllProgress');
    assert(/getAccountType\(\) === 'linked'\) return/.test(body),
        'ученик может вызвать восстановление из отладчика');
});

test('чужой прогресс пишется только через свою функцию сервера', () => {
    const body = slice('async function importAllProgress', 'async function exportAllProgress');
    assert(/session_restore_student/.test(body), 'ученики пишутся мимо серверной проверки');
    assert(/Progress\.restoreOwn/.test(body), 'свой профиль пишется не через Progress');
});

group('Личность из копии не берётся');

test('свой профиль сохраняет код, метку, тип и владельца', () => {
    // Иначе копией можно подменить себе логин или тип аккаунта — это уже не
    // восстановление. То же правило на сервере делает pin_identity.
    const src = fs.readFileSync(path.join(ROOT, 'js/progress.js'), 'utf8');
    const from = src.indexOf('async restoreOwn(');
    assert(from > 0, 'restoreOwn не найден');
    const body = src.slice(from, src.indexOf('async hardReset()', from));
    ['playerCode', 'profileLabel', 'accountType', 'ownerCode', 'config'].forEach(f => {
        assert(new RegExp(f + ':').test(body), `из копии подставляется ${f}`);
    });
});

test('на сервере то же правило и той же функцией', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/restore.sql'), 'utf8');
    assert(/pin_identity\(p_student_code, p_state\)/.test(sql),
        'состояние пишется мимо pin_identity — владельца можно подменить копией');
    assert(/owner_code/.test(sql) && /not_your_student/.test(sql),
        'владелец не проверяется по колонке');
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
