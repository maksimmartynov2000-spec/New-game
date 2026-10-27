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

test('картинки догружаются в фоне, но только когда есть куда', () => {
    // Раньше картинка попадала в кеш лишь после того, как её показали, — значит без
    // сети незнакомая не открывалась вовсе. Класть все двадцать в установку service
    // worker'а тоже нельзя: установка ждала бы двадцать запросов или срывалась из-за
    // одного неудачного. Поэтому догрузка идёт со страницы, после загрузки, по одной.
    const body = HTML.slice(HTML.indexOf('function preloadPuzzleImages'),
                              HTML.indexOf("function preloadPuzzleImages") + 900);
    assert(/saveData/.test(body), 'режим экономии трафика не уважается');
    assert(/PUZZLE_IMAGE_SRCS/.test(body), 'догружаются не картинки пазла');
    // Картинки закрытого раздела ученик не увидит — и качать их незачем. Иначе каждый
    // новый раздел с картинками утяжелял бы догрузку у всех, кому он ещё не открыт.
    assert(/puzzleVisible\(i\)/.test(body), 'догружаются и картинки закрытых разделов');
    // Запускается ТОЛЬКО после успешной регистрации: без service worker кеша нет,
    // и запросы сожгли бы трафик впустую. Так и было в первой версии.
    const reg = HTML.slice(HTML.indexOf("register('sw.js')"),
                             HTML.indexOf("register('sw.js')") + 200);
    assert(/\.then\(preloadPuzzleImages/.test(reg),
        'догрузка запускается мимо регистрации service worker');
});

test('картинки перестали весить как фотоальбом', () => {
    // Было двадцать PNG 1024×1024 примерно по мегабайту: 20 МБ на приложение, которое
    // показывает их в 420 точек. WebP при том же качестве даёт в шестнадцать раз
    // меньше, и только после этого догрузка всех двадцати вообще имеет смысл.
    //
    // Меряется то, что скачивает одно устройство: картинки своей коллекции, их догружает
    // preloadPuzzleImages. Вся папка — мерка неверная: в ней лежат и прежние картинки, и
    // новые, а ни один аккаунт не качает и те, и другие. Ученик берёт картинки из
    // PUZZLE_IMAGE_SRCS, репетитор — новые там, где они есть (см. PUZZLE_PREVIEW_SRCS).
    //
    // Меряется по разделам, по двадцать картинок: догружаются картинки только открытых
    // разделов (проверка выше), и ученик с одними положительными качает ровно их. Предел
    // на раздел, а не на всё сразу: иначе каждый новый раздел с картинками упирался бы в
    // него, хотя большинство учеников его ещё не видит.
    //
    // Предел — 3,5 МБ. Было 3, но двадцать новых картинок весят 3,22 МБ: их нарочно рисуют
    // подробными по всему квадрату, потому что режут на 100 кусочков, и каждая выходит
    // в 120–220 КБ. Уложиться в 3 МБ можно было, только пережав все новые картинки сильнее
    // и выпустив под новыми именами уже показанные, — решили поднять предел. С 18 октября
    // эти 3,22 МБ качает каждое устройство. От PNG предел по-прежнему защищает: двадцать
    // PNG по мегабайту — это 20 МБ.
    const LIMIT_MB = 3.5;
    const dir = path.join(ROOT, 'images');
    const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const png = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
    assert(png.length === 0, `остались тяжёлые форматы: ${png.slice(0, 3).join(', ')}`);
    const block = (start, end) => {
        const from = HTML.indexOf(start);
        assert(from > 0, `в index.html не найден ${start}`);
        return HTML.slice(from, HTML.indexOf(end, from));
    };
    const old = [...block('const PUZZLE_IMAGE_SRCS = [', '];').matchAll(/'(images\/[^']+)'/g)].map(m => m[1]);
    const next = {};
    for (const m of block('const PUZZLE_PREVIEW_SRCS = {', '};').matchAll(/(\d+):\s*'(images\/[^']+)'/g)) next[+m[1]] = m[2];
    assert(old.length > 0, 'список PUZZLE_IMAGE_SRCS пуст — мерить нечего');
    const weigh = (list) => list.reduce((sum, rel) => sum + fs.statSync(path.join(ROOT, rel)).size, 0);
    const SECTION = 20;
    [['ученик', old], ['репетитор', old.map((rel, i) => next[i] || rel)]].forEach(([who, list]) => {
        for (let from = 0; from < list.length; from += SECTION) {
            const bytes = weigh(list.slice(from, from + SECTION));
            assert(bytes < LIMIT_MB * 1024 * 1024,
                `${who} скачивает картинки раздела ${from}–${Math.min(from + SECTION, list.length) - 1} на `
                + `${(bytes / 1048576).toFixed(2)} МБ — больше ${String(LIMIT_MB).replace('.', ',')}`);
        }
    });
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
