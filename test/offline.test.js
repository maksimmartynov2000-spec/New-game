// Тесты офлайн-оболочки (service worker).
//
// Зачем: index.html разрезается на файлы, и каждый вынесенный кусок — это ещё один
// запрос по сети. Про service worker при этом легко забыть: приложение на компьютере
// разработчика откроется как ни в чём не бывало, потому что сеть есть всегда. У ученика
// с айпадом в метро — нет. Цена ошибки прямая: js/progress.js не доехал — приложения нет.
//
// Проверяется ровно одно правило и его следствие: всякий скрипт, подключённый в
// index.html со своего домена, обязан быть в списке SHELL_ASSETS; и запрос, который
// не удалось ни скачать, ни найти в кеше, не должен подменяться на index.html, если это
// не переход на страницу (иначе браузер получает HTML вместо кода).
//
// Как запускать:  node test/offline.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function group(name) { console.log(`\n${name}`); }

// Список файлов оболочки достаём из самого sw.js, а не переписываем сюда: иначе
// проверка сверяла бы копию с копией.
function shellAssets() {
    const from = SW.indexOf('const SHELL_ASSETS = [');
    const to = SW.indexOf('];', from);
    assert(from >= 0 && to > from, 'в sw.js не найден список SHELL_ASSETS');
    return SW.slice(SW.indexOf('[', from), to + 1)
        .match(/'([^']+)'/g).map(s => s.slice(1, -1));
}

// Подключённые скрипты — только свои. Чужой домен service worker не трогает вовсе.
function localScriptSrcs() {
    const out = [];
    const re = /<script\s+src="([^"]+)"/g;
    let m;
    while ((m = re.exec(HTML))) {
        if (!/^https?:/i.test(m[1])) out.push('./' + m[1].replace(/^\.\//, ''));
    }
    return out;
}

group('Офлайн: оболочка знает про все свои файлы');

test('каждый подключённый скрипт есть в SHELL_ASSETS', () => {
    const assets = shellAssets();
    const missing = localScriptSrcs().filter(src => !assets.includes(src));
    assert(missing.length === 0,
        `в sw.js не хватает: ${missing.join(', ')} — без сети эти файлы не откроются`);
});

test('в SHELL_ASSETS нет файлов, которых нет на диске', () => {
    const gone = shellAssets()
        .filter(a => a !== './')
        .filter(a => !fs.existsSync(path.join(ROOT, a.replace(/^\.\//, ''))));
    assert(gone.length === 0, `перечислены, но отсутствуют: ${gone.join(', ')}`);
});

test('версия кеша меняется вместе со списком файлов', () => {
    // Новый файл в списке доедет до ученика только вместе с новой версией: старый
    // service worker живёт, пока его не сменит другой, и переустанавливать кеш он не станет.
    const m = SW.match(/const VERSION = '([^']+)'/);
    assert(m, 'в sw.js не найдена VERSION');
    assert(/v(\d+)$/.test(m[1]), `версия '${m[1]}' не заканчивается номером — его нечем увеличить`);
});

test('несохранённый скрипт не подменяется страницей', () => {
    // Запасной index.html — только для перехода на страницу. Отдать его в ответ на
    // <script> значит скормить браузеру HTML под видом кода.
    const idx = SW.indexOf("caches.match('./index.html')", SW.indexOf('.catch(() => caches.match(req)'));
    assert(idx > 0, 'не найден запасной путь при отсутствии сети');
    const guard = SW.slice(Math.max(0, idx - 400), idx);
    assert(/req\.mode\s*===\s*'navigate'/.test(guard),
        'запасной index.html отдаётся без проверки req.mode — он попадёт и в ответ на <script>');
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
