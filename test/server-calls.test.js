// Тесты того, КАКИЕ серверные функции зовёт приложение.
//
// Зачем: на сервере долго жили два набора функций с одними и теми же правилами —
// по токену и по паролю, — а клиент умел ходить обоими путями. Два набора правил
// доступа расходятся молча: правку вносят в один, забывают про другой, и дыра
// появляется не в момент ошибки, а в момент, когда кто-то до этой ветки доберётся.
//
// Старый парольный путь убран. Эти проверки стерегут, чтобы он не вернулся:
// приложение обязано ходить на сервер ровно одним способом.
//
// Как запускать:  node test/server-calls.test.js

const fs = require('fs');
const path = require('path');

const { ROOT, CODE_FILES, inlineScript } = require('./app-source');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function group(name) { console.log(`\n${name}`); }

const SOURCES = CODE_FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
SOURCES.push(['index.html', inlineScript()]);
const ALL = SOURCES.map(([, src]) => src).join('\n');

// Единственные три функции, которые приложение зовёт напрямую: вход (он же обмен
// пароля на токен), чтение и запись состояния. Всё остальное идёт через callAuthed,
// который сам подставляет токен.
const DIRECT = ['session_login', 'session_state', 'session_save'];

group('Один путь к серверу');

test('все прямые вызовы rpc — только session_*', () => {
    const names = [...ALL.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map(m => m[1]);
    const bad = names.filter(n => !n.startsWith('session_'));
    assert(bad.length === 0,
        `приложение зовёт функции старого пути: ${[...new Set(bad)].join(', ')}`);
});

test('прямо вызываются только вход, чтение и запись', () => {
    const names = [...new Set([...ALL.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map(m => m[1]))];
    const extra = names.filter(n => !DIRECT.includes(n));
    assert(extra.length === 0,
        `мимо callAuthed зовётся ещё: ${extra.join(', ')} — подтверждение личности должно быть в одном месте`);
});

test('у callAuthed ровно два аргумента', () => {
    // Третий и четвёртый аргументы были именем и параметрами парольного варианта.
    // Пока они где-то остаются, старый путь жив, даже если функции в базе уже нет.
    const sig = ALL.match(/function callAuthed\(([^)]*)\)/);
    assert(sig, 'не найдено объявление callAuthed');
    const args = sig[1].split(',').map(s => s.trim()).filter(Boolean);
    assert(args.length === 2, `аргументов ${args.length}: ${args.join(', ')}`);
});

// Аргументы вызова считаем по скобкам, а не регулярным выражением: первая версия
// этой проверки резала хвост вызова по длине и подсадку с четырьмя аргументами
// пропускала — то есть была пустой и об этом молчала.
function callArgs(src, from) {
    let depth = 0, start = -1, args = [], last = 0;
    for (let i = from; i < src.length; i++) {
        const c = src[i];
        if (c === '(' ) { if (depth === 0) { start = i + 1; last = start; } depth++; }
        else if (c === ')') {
            depth--;
            if (depth === 0) { args.push(src.slice(last, i)); return args; }
        }
        else if (c === ',' && depth === 1) { args.push(src.slice(last, i)); last = i + 1; }
        else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') depth--;
    }
    return null;
}

test('ни один вызов callAuthed не передаёт лишнего', () => {
    const bad = [];
    const re = /callAuthed\(/g;
    let m;
    while ((m = re.exec(ALL))) {
        // Пропускаем само объявление функции.
        if (/function\s+$/.test(ALL.slice(Math.max(0, m.index - 12), m.index))) continue;
        const args = callArgs(ALL, m.index + 'callAuthed'.length);
        if (!args) continue;
        if (args.length !== 2) {
            bad.push(args.map(a => a.trim().replace(/\s+/g, ' ').slice(0, 34)).join(' | '));
        }
    }
    assert(bad.length === 0, `аргументов не два: ${bad[0]}`);
});

test('сам callAuthed не подкладывает пароль в запрос', () => {
    // Здесь имя функции подставляется переменной, поэтому проверка вызовов выше
    // это место не видит вовсе. Смотрим прямо в тело.
    const from = ALL.indexOf('async function callAuthed(');
    assert(from >= 0, 'не найдено тело callAuthed');
    const body = ALL.slice(from, ALL.indexOf('\n        }', from));
    assert(!/p_password|p_tutor_password|p_tutor_code/.test(body),
        'callAuthed снова кладёт в запрос пароль — подтверждение личности должно идти токеном');
});

test('пароль не уходит на сервер ни в одном вызове, кроме входа', () => {
    // p_password есть у входа (session_login), у удаления аккаунта (там он нужен как
    // подтверждение) и у смены пароля. Ни один ДРУГОЙ вызов пароля слать не должен —
    // ради этого пароль и меняли на токен.
    const bad = [];
    const re = /\.rpc\(\s*'([a-z_]+)'[\s\S]{0,300}?\)/g;
    let m;
    while ((m = re.exec(ALL))) {
        if (m[1] === 'session_login') continue;
        if (/p_password|p_tutor_password/.test(m[0])) bad.push(m[1]);
    }
    assert(bad.length === 0, `пароль уходит в: ${[...new Set(bad)].join(', ')}`);
});

test('в коде не осталось имён функций старого пути', () => {
    const legacy = ['save_state', 'my_access', 'list_my_students', 'get_student_state',
                    'take_exam', 'student_exams', 'set_student_access', 'student_access',
                    'create_student', 'reset_student_password', 'delete_own_account',
                    'issue_access_code', 'redeem_access_code', 'revoke_access_code',
                    'list_access_codes', 'exam_allowed'];
    const bad = [];
    SOURCES.forEach(([file, src]) => {
        legacy.forEach(name => {
            // Ищем именно строковый литерал: 'save_state', а не session_save_state.
            const re = new RegExp(`(?<![a-z_])'${name}'`, 'g');
            if (re.test(src)) bad.push(`${name} (${file})`);
        });
    });
    assert(bad.length === 0, `упоминаются: ${bad.join(', ')}`);
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
