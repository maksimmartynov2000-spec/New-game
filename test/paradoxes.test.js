// Тесты карточек парадоксов.
//
// Зачем отдельным файлом: тексты переехали в content/paradoxes.js, и с этого момента
// у приложения появилась внешняя зависимость. Файл может не доехать — тогда игра
// обязана работать без карточек, а не падать посреди примеров. Плюс порядок записей
// значим: индекс парадокса совпадает с индексом картинки пазла, и перестановка
// разъедет картинку с текстом у всех, кто уже собрал коллекцию.
//
// Как запускать:  node test/paradoxes.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function loadContent() {
    const box = { window: {} };
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content', 'paradoxes.js'), 'utf8'), box,
        { filename: 'content/paradoxes.js' });
    return box.window.PARADOX_CONTENT;
}

// resolveParadoxes вырезаем и исполняем: именно она решает, что делать, когда файла нет.
function loadResolver(windowObj) {
    const from = SCRIPT.indexOf('function resolveParadoxes()');
    const to = SCRIPT.indexOf('\n\n', from);
    const box = { window: windowObj, LANG: 'ru' };
    vm.createContext(box);
    vm.runInContext(SCRIPT.slice(from, to) + ';globalThis.R = resolveParadoxes;', box);
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

const CONTENT = loadContent();
const RU = CONTENT.ru;

group('Состав');

test('парадоксов ровно столько же, сколько картинок пазлов', () => {
    // Индекс парадокса — это индекс картинки. Расхождение сдвинет тексты у всех.
    const from = SCRIPT.indexOf('const PUZZLE_IMAGE_SRCS = [');
    const list = SCRIPT.slice(from, SCRIPT.indexOf('];', from));
    const images = (list.match(/'/g) || []).length / 2;
    eq(RU.length, images, 'парадоксов и картинок должно быть поровну');
});

test('у каждой карточки заполнены все поля', () => {
    RU.forEach((px, i) => {
        ['name', 'era', 'hook', 'body', 'probe', 'answer'].forEach(k => {
            assert(typeof px[k] === 'string' && px[k].trim().length > 0,
                `у карточки №${i + 1} («${px.name}») пусто поле ${k}`);
        });
    });
});

test('названия не повторяются', () => {
    const seen = {};
    RU.forEach(px => {
        assert(!seen[px.name], `«${px.name}» встречается дважды`);
        seen[px.name] = true;
    });
});

group('Форма текста');

test('в теле два абзаца: что происходит и в чём подвох', () => {
    RU.forEach(px => {
        const parts = px.body.split('\n\n').filter(x => x.trim());
        eq(parts.length, 2, `у «${px.name}» абзацев ${parts.length}, а должно быть два`);
    });
});

test('тело не разрастается: карточку читают с телефона', () => {
    RU.forEach(px => {
        assert(px.body.length <= 700, `у «${px.name}» тело ${px.body.length} символов — длинновато`);
    });
});

test('крючок — одна короткая фраза', () => {
    RU.forEach(px => {
        assert(px.hook.length <= 100, `крючок «${px.name}» длиной ${px.hook.length} — это уже не крючок`);
    });
});

test('вопрос «проверь» действительно вопрос', () => {
    RU.forEach(px => {
        assert(/[?？]\s*$/.test(px.probe.trim()) || /\?/.test(px.probe),
            `у «${px.name}» строка проверки не спрашивает: ${px.probe}`);
    });
});

test('ответ короче вопроса не бывает пустым и не повторяет его дословно', () => {
    RU.forEach(px => {
        assert(px.answer.length >= 20, `ответ у «${px.name}» слишком короткий`);
        assert(px.answer.trim() !== px.probe.trim(), `ответ у «${px.name}» повторяет вопрос`);
    });
});

group('Связь с приложением');

test('файл с текстами подключён в index.html', () => {
    assert(/<script src="content\/paradoxes\.js"><\/script>/.test(HTML),
        'content/paradoxes.js не подключён — карточек не будет');
});

test('текстов больше нет внутри index.html', () => {
    assert(!/const PARADOXES = \[/.test(SCRIPT),
        'массив парадоксов снова лежит в index.html');
});

test('без файла с текстами игра не падает', () => {
    // Внешний файл может не доехать: кэш, обрыв, чужая копия папки. Ронять из-за
    // текста игру, в которой считают примеры, нельзя.
    const box = loadResolver({});
    const got = box.R();
    assert(Array.isArray(got) && got.length === 0, 'без содержимого должен вернуться пустой список');
});

test('язык, которого нет, откатывается на русский', () => {
    const box = loadResolver({ PARADOX_CONTENT: CONTENT });
    box.LANG = 'fr';
    eq(box.R().length, RU.length, 'французского пока нет — должен показаться русский');
});

test('русский берётся, когда язык русский', () => {
    const box = loadResolver({ PARADOX_CONTENT: CONTENT });
    eq(box.R()[0].name, RU[0].name, 'первый парадокс');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
