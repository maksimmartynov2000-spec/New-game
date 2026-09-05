// Тесты общего пространства имён.
//
// Зачем: index.html разрезан на файлы, но сборки нет — все они подключаются обычными
// тегами <script> и делят одно глобальное пространство. Сейчас там больше шестисот имён
// верхнего уровня. Если два файла объявят одно и то же имя через const или let, браузер
// не «возьмёт последнее», а откажется исполнять скрипт целиком: SyntaxError при загрузке,
// приложение мёртвое на всех экранах сразу. Заметить это глазом при слиянии двух правок
// невозможно — имена лежат в разных файлах и в глаза друг другу не бросаются.
//
// Проверка нарочно грубая и быстрая: разбирать JavaScript целиком тут не нужно, нужно
// поймать ровно один вид беды.
//
// Как запускать:  node test/globals.test.js

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

// Имена, объявленные на верхнем уровне файла. Считаем глубину по фигурным скобкам:
// внутри функции объявления свои и наружу не видны.
function topLevelNames(src) {
    const found = new Map();
    let depth = 0;
    src.split('\n').forEach((line, i) => {
        const st = line.trim();
        if (depth === 0) {
            const m = /^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/.exec(st);
            if (m) found.set(m[1], { line: i + 1, kind: st.split(/\s/)[0] });
        }
        for (const ch of line) {
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
        }
    });
    return found;
}

// Встроенный скрипт лежит с отступом в восемь пробелов — снимаем, иначе «верхний
// уровень» в нём не найдётся вовсе.
function dedent(src) {
    return src.split('\n').map(l => (l.startsWith('        ') ? l.slice(8) : l)).join('\n');
}

const sources = [];
CODE_FILES.forEach(f => sources.push([f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
sources.push(['index.html', dedent(inlineScript())]);

group('Общее пространство имён');

test('ни одно имя не объявлено в двух файлах сразу', () => {
    const owners = new Map();
    sources.forEach(([file, src]) => {
        topLevelNames(src).forEach((info, name) => {
            if (!owners.has(name)) owners.set(name, []);
            owners.get(name).push(`${file}:${info.line}`);
        });
    });
    const clashes = [...owners.entries()].filter(([, v]) => v.length > 1);
    assert(clashes.length === 0,
        'одно имя в двух файлах — приложение не запустится: '
        + clashes.map(([n, v]) => `${n} (${v.join(', ')})`).join('; '));
});

test('имён верхнего уровня не стало неожиданно мало', () => {
    // Сторож самой проверки: если разбор перестанет находить объявления (например,
    // после смены отступов), первая проверка начнёт проходить всегда и молча.
    const total = sources.reduce((n, [, src]) => n + topLevelNames(src).size, 0);
    assert(total > 400, `найдено всего ${total} имён — разбор, похоже, сломался`);
});

test('каждый файл кода что-то объявляет', () => {
    const empty = sources.filter(([, src]) => topLevelNames(src).size === 0).map(([f]) => f);
    assert(empty.length === 0, `ничего не найдено в: ${empty.join(', ')}`);
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
