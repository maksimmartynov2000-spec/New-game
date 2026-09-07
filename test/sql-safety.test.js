// Тесты безопасности миграций базы.
//
// Зачем: в supabase/migration.sql годами лежало безусловное удаление аккаунтов по
// списку кодов — остаток давней уборки. Сам по себе он ничего не удалял, потому что
// таких кодов больше нет. Но этот же файл значится в schema.sql как шаг восстановления
// базы с нуля, то есть его предлагается запускать повторно: однажды один из тех кодов
// совпал бы с настоящим логином, и восстановление молча снесло бы живой аккаунт.
//
// Здесь проверяется не SQL как таковой, а два свойства набора файлов:
//   1) файл, который можно запускать повторно, ничего не удаляет;
//   2) порядок восстановления в schema.sql полон и не разошёлся с папкой.
//
// Как запускать:  node test/sql-safety.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'supabase');
const SCHEMA = fs.readFileSync(path.join(DIR, 'schema.sql'), 'utf8');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function group(name) { console.log(`\n${name}`); }

// Одноразовые файлы и проверки в порядок восстановления не входят по замыслу.
const ONE_OFF = ['bootstrap-tutor.sql'];
const isTest = (f) => f.endsWith('.test.sql');
const isCheck = (f) => f.startsWith('check-');

// Тела функций вырезаем: delete внутри delete_own_account — это и есть её работа.
function outsideFunctions(src) {
    return src.replace(/\$\$[\s\S]*?\$\$/g, ' ');
}

// Список шагов восстановления, как он записан в schema.sql.
function rebuildOrder() {
    const from = SCHEMA.indexOf('ЧТОБЫ ПОДНЯТЬ БАЗУ С НУЛЯ');
    assert(from >= 0, 'в schema.sql не найден порядок восстановления');
    const to = SCHEMA.indexOf('И отдельно, ОДИН РАЗ', from);
    return [...SCHEMA.slice(from, to > 0 ? to : undefined)
        .matchAll(/supabase\/([a-z-]+\.sql)/g)].map(m => m[1]);
}

const ALL = fs.readdirSync(DIR).filter(f => f.endsWith('.sql'));
const MIGRATIONS = ALL.filter(f => !isTest(f) && !isCheck(f) && !ONE_OFF.includes(f));

group('Миграции безопасны для повторного запуска');

test('ни одна миграция не удаляет данные при запуске', () => {
    const bad = [];
    MIGRATIONS.forEach(f => {
        const src = outsideFunctions(fs.readFileSync(path.join(DIR, f), 'utf8'));
        const re = /^\s*(delete\s+from|truncate|drop\s+table)\b[^\n]*/gim;
        let m;
        while ((m = re.exec(src))) bad.push(`${f}: ${m[0].trim().slice(0, 70)}`);
    });
    assert(bad.length === 0,
        `удаление в файле, который запускают повторно: ${bad.join('; ')}`);
});

test('ни одна миграция не заводит аккаунт при запуске', () => {
    // Вставка аккаунта — одноразовое дело, ей место в bootstrap-tutor.sql.
    const bad = [];
    MIGRATIONS.forEach(f => {
        const src = outsideFunctions(fs.readFileSync(path.join(DIR, f), 'utf8'));
        if (/^\s*insert\s+into\s+citadel_progress/im.test(src)) bad.push(f);
    });
    assert(bad.length === 0, `заводят аккаунт: ${bad.join(', ')}`);
});

group('Порядок восстановления не разошёлся с папкой');

test('каждый файл из порядка лежит на диске', () => {
    const missing = rebuildOrder().filter(f => !ALL.includes(f));
    assert(missing.length === 0, `в schema.sql названы, но отсутствуют: ${missing.join(', ')}`);
});

test('каждая миграция названа в порядке восстановления', () => {
    const order = rebuildOrder();
    const forgotten = MIGRATIONS.filter(f => !order.includes(f));
    assert(forgotten.length === 0,
        `новая миграция не вписана в порядок восстановления: ${forgotten.join(', ')}`
        + ' — база, поднятая по schema.sql, окажется без неё');
});

test('одноразовые файлы в порядок восстановления не попали', () => {
    const order = rebuildOrder();
    const bad = ONE_OFF.filter(f => order.includes(f));
    assert(bad.length === 0, `одноразовое в списке повторяемого: ${bad.join(', ')}`);
});

test('у каждой проверки есть своя миграция', () => {
    const orphan = ALL.filter(isTest)
        .filter(f => !ALL.includes(f.replace('.test.sql', '.sql')));
    assert(orphan.length === 0, `проверка без миграции: ${orphan.join(', ')}`);
});

group('Права снимаются у ролей, а не у public');

test('внутренности закрываются отзывом у самих ролей', () => {
    // На этом я ошибся на живой базе. Supabase настраивает права по умолчанию так:
    //     alter default privileges in schema public grant all on functions to anon;
    // то есть каждая новая функция получает разрешение НЕ через public, а прямой
    // выдачей роли anon. «revoke ... from public» такую выдачу не трогает — она
    // остаётся, и проверка на живой базе показала 43 открытых имени, где кроме
    // session_* были все impl_*. Локальная база этого не поймала: роль anon там
    // была, а прав по умолчанию не было — то есть отличалась ровно тем местом,
    // которое и решало.
    const src = fs.readFileSync(path.join(DIR, 'lock-internals.sql'), 'utf8');
    assert(/revoke execute[^;]*from anon/i.test(src),
        'права не отзываются у самой роли anon — на Supabase это не сработает');
    assert(/authenticated/.test(src),
        'роль authenticated не тронута, а Supabase выдаёт права и ей');
});

test('замок ставится перебором, а не списком имён', () => {
    // Список пришлось бы дополнять при каждой новой внутренней функции, и однажды
    // его забыли бы. Перебор закрывает и то, чего ещё нет.
    const src = fs.readFileSync(path.join(DIR, 'lock-internals.sql'), 'utf8');
    assert(/pg_proc/.test(src) && /loop/i.test(src),
        'замок перечисляет функции поимённо — новую забудут');
    assert(/proname not like 'session/.test(src),
        'перебор не отличает внешний слой session_* от внутренностей');
});

test('функции расширений не трогаются', () => {
    // pgcrypto и подобные раздают права сами; лезть туда не наше дело, а сломать
    // чужое расширение отзывом — легко.
    const src = fs.readFileSync(path.join(DIR, 'lock-internals.sql'), 'utf8');
    assert(/pg_depend/.test(src) && /deptype = 'e'/.test(src),
        'перебор не исключает функции расширений');
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
