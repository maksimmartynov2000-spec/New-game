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
const LANGS = Object.keys(CONTENT);
const FIELDS = ['name', 'era', 'hook', 'body', 'probe', 'answer'];

group('Состав');

test('парадоксов ровно столько же, сколько картинок пазлов', () => {
    // Индекс парадокса — это индекс картинки. Расхождение сдвинет тексты у всех.
    const from = SCRIPT.indexOf('const PUZZLE_IMAGE_SRCS = [');
    const list = SCRIPT.slice(from, SCRIPT.indexOf('];', from));
    const images = (list.match(/'/g) || []).length / 2;
    eq(RU.length, images, 'парадоксов и картинок должно быть поровну');
});

test('у каждой карточки во всех языках заполнены все поля', () => {
    LANGS.forEach(lang => {
        CONTENT[lang].forEach((px, i) => {
            FIELDS.forEach(k => {
                assert(typeof px[k] === 'string' && px[k].trim().length > 0,
                    `[${lang}] у карточки №${i + 1} («${px.name}») пусто поле ${k}`);
            });
        });
    });
});

test('во всех языках одинаковое число карточек', () => {
    LANGS.forEach(lang => {
        eq(CONTENT[lang].length, RU.length, `в языке ${lang} карточек не столько же`);
    });
});

test('порядок карточек одинаков во всех языках', () => {
    // Индекс — это картинка пазла. Если перевод переставили, у собравшего коллекцию
    // под картинкой окажется чужой текст, и никакой тест кроме этого не заметит.
    const year = (era) => { const m = /\d{3,4}/.exec(era); return m ? m[0] : null; };
    let checked = 0;
    RU.forEach((px, i) => {
        const ruYear = year(px.era);
        if (!ruYear) return;
        checked++;
        LANGS.forEach(lang => {
            const other = year(CONTENT[lang][i].era);
            assert(other === ruYear,
                `[${lang}] карточка №${i + 1}: год ${other} вместо ${ruYear} — порядок разъехался`);
        });
    });
    assert(checked >= 15, `годов для сверки нашлось всего ${checked} — проверка ослабла`);
});

test('в переводах не осталось русского текста', () => {
    LANGS.filter(l => l !== 'ru').forEach(lang => {
        CONTENT[lang].forEach((px, i) => {
            FIELDS.forEach(k => {
                assert(!/[А-Яа-яЁё]/.test(px[k]),
                    `[${lang}] карточка №${i + 1}, поле ${k}: остался русский текст`);
            });
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

const each = (fn) => LANGS.forEach(lang => CONTENT[lang].forEach((px, i) => fn(px, lang, i)));

test('в теле два абзаца: что происходит и в чём подвох', () => {
    each((px, lang) => {
        const parts = px.body.split('\n\n').filter(x => x.trim());
        eq(parts.length, 2, `[${lang}] у «${px.name}» абзацев ${parts.length}, а должно быть два`);
    });
});

test('тело не разрастается: карточку читают с телефона', () => {
    // Немецкий и французский длиннее русского, поэтому потолок общий и с запасом.
    each((px, lang) => {
        assert(px.body.length <= 750, `[${lang}] у «${px.name}» тело ${px.body.length} символов — длинновато`);
    });
});

test('крючок — одна короткая фраза', () => {
    each((px, lang) => {
        assert(px.hook.length <= 120, `[${lang}] крючок «${px.name}» длиной ${px.hook.length} — это уже не крючок`);
    });
});

test('вопрос «проверь» действительно вопрос', () => {
    each((px, lang) => {
        assert(/\?/.test(px.probe), `[${lang}] у «${px.name}» строка проверки не спрашивает: ${px.probe}`);
    });
});

test('ответ не бывает пустым и не повторяет вопрос дословно', () => {
    each((px, lang) => {
        assert(px.answer.length >= 20, `[${lang}] ответ у «${px.name}» слишком короткий`);
        assert(px.answer.trim() !== px.probe.trim(), `[${lang}] ответ у «${px.name}» повторяет вопрос`);
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

test('каждый язык отдаёт свои тексты', () => {
    LANGS.forEach(lang => {
        const box = loadResolver({ PARADOX_CONTENT: CONTENT });
        box.LANG = lang;
        eq(box.R()[0].name, CONTENT[lang][0].name, `язык ${lang}`);
    });
});

test('язык, которого нет, откатывается на русский', () => {
    const box = loadResolver({ PARADOX_CONTENT: CONTENT });
    box.LANG = 'es';
    eq(box.R()[0].name, RU[0].name, 'испанского нет — должен показаться русский');
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
