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

function loadWindow() {
    const box = { window: {} };
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content', 'paradoxes.js'), 'utf8'), box,
        { filename: 'content/paradoxes.js' });
    return box.window;
}
function loadContent() { return loadWindow().PARADOX_CONTENT; }

// resolveParadoxes вырезаем и исполняем: именно она решает, что делать, когда файла нет.
// extra — что ещё положить в песочницу (например, seesPuzzlePreview).
function loadResolver(windowObj, extra) {
    const from = SCRIPT.indexOf('function resolveParadoxes()');
    const to = SCRIPT.indexOf('\n\n', from);
    const box = Object.assign({ window: windowObj, LANG: 'ru' }, extra || {});
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
// Новые карточки к новым картинкам: пока их видит только репетитор.
const PREVIEW = loadWindow().PARADOX_PREVIEW;
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

// Новые карточки репетитора подчиняются тем же правилам формы: потом они займут места
// прежних, и разбираться с длиной и абзацами тогда будет поздно.
const each = (fn) => {
    LANGS.forEach(lang => CONTENT[lang].forEach((px, i) => fn(px, lang, i)));
    Object.keys(PREVIEW || {}).forEach(lang => Object.keys(PREVIEW[lang]).forEach(k => fn(PREVIEW[lang][k], lang, +k)));
};

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

group('Новые карточки (пока только у репетитора)');

// Индексы, у которых есть новая картинка, — прямо из index.html.
const PREVIEW_IDX = (() => {
    const from = SCRIPT.indexOf('const PUZZLE_PREVIEW_SRCS = {');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('};', from));
    return [...body.matchAll(/(\d+):\s*'images\//g)].map(m => m[1]).sort().join(',');
})();

test('новые карточки есть на всех языках, что и прежние', () => {
    assert(PREVIEW && typeof PREVIEW === 'object', 'window.PARADOX_PREVIEW не задан');
    eq(Object.keys(PREVIEW).sort().join(','), LANGS.slice().sort().join(','), 'языки новых карточек');
});

test('в каждом языке ровно те клетки, у которых есть новая картинка', () => {
    assert(PREVIEW_IDX.length > 0, 'в index.html не нашлось PUZZLE_PREVIEW_SRCS');
    LANGS.forEach(lang => {
        eq(Object.keys(PREVIEW[lang]).sort().join(','), PREVIEW_IDX, `[${lang}] клетки новых карточек`);
    });
});

test('у новых карточек заполнены все поля, а в переводах нет русского', () => {
    LANGS.forEach(lang => Object.keys(PREVIEW[lang]).forEach(k => {
        const px = PREVIEW[lang][k];
        FIELDS.forEach(f => {
            assert(typeof px[f] === 'string' && px[f].trim().length > 0, `[${lang}] новая карточка ${k}: пусто поле ${f}`);
            if (lang !== 'ru') assert(!/[А-Яа-яЁё]/.test(px[f]), `[${lang}] новая карточка ${k}, поле ${f}: остался русский текст`);
        });
    }));
});

test('у новых карточек во всех языках тот же год', () => {
    // Та же сверка порядка, что и у прежних: год в строке «кто и когда» один на всех.
    const year = (era) => { const m = /\d{3,4}/.exec(era); return m ? m[0] : null; };
    Object.keys(PREVIEW.ru).forEach(k => {
        const ruYear = year(PREVIEW.ru[k].era);
        LANGS.forEach(lang => eq(year(PREVIEW[lang][k].era), ruYear, `[${lang}] год новой карточки ${k}`));
    });
});

// Задача в строке «проверь» — пример той же клетки, только с историей. Берём последнее
// равенство, где ровно один «?» и только плюсы и минусы: «5 + ? = 7», «4 + 9 + ? = 15»,
// «34 + 55 = ?», «20 − 4 − 4 − 4 − 4 = ?». Время «5:49» и числа в словах сюда не попадают.
const EQUATION = /(?:\d+|\?)(?:\s*[+−-]\s*(?:\d+|\?))*\s*=\s*(?:\d+|\?)/g;
function probeEquation(probe) {
    const all = (probe.match(EQUATION) || []).filter(s => (s.match(/\?/g) || []).length === 1);
    return all.length ? all[all.length - 1].replace(/\s+/g, ' ').replace(/-/g, '−') : null;
}
// Чему равен «?» и самое большое число равенства — сумма или уменьшаемое.
function solveEquation(equation) {
    const [lhs, rhs] = equation.split('=').map(s => s.trim());
    const terms = [];
    let sign = 1;
    lhs.split(/\s*([+−])\s*/).forEach(tok => {
        if (tok === '+') sign = 1;
        else if (tok === '−') sign = -1;
        else if (tok) { terms.push({ sign, v: tok }); sign = 1; }
    });
    const known = terms.filter(t => t.v !== '?').reduce((s, t) => s + t.sign * Number(t.v), 0);
    const value = rhs === '?' ? known : (Number(rhs) - known) * terms.find(t => t.v === '?').sign;
    const numbers = terms.filter(t => t.v !== '?').map(t => Number(t.v)).concat(rhs === '?' ? [] : [Number(rhs)]);
    return { value, biggest: Math.max(value, ...numbers) };
}

// Ответ обязан сходиться с примером на каждом языке: переводчик ошибётся в одной цифре —
// и ребёнок, решивший верно, увидит под карточкой «другой» ответ.
test('у новых карточек ответ сходится с примером в строке «проверь»', () => {
    const bad = [];
    LANGS.forEach(lang => Object.keys(PREVIEW[lang]).forEach(k => {
        const px = PREVIEW[lang][k];
        const equation = probeEquation(px.probe);
        const lead = /^\s*(\d+)/.exec(px.answer);
        if (!equation) bad.push(`[${lang}] ${k}: в строке «проверь» нет примера с «?»: ${px.probe}`);
        else if (!lead) bad.push(`[${lang}] ${k}: ответ не начинается с числа: ${px.answer}`);
        else if (Number(lead[1]) !== solveEquation(equation).value)
            bad.push(`[${lang}] ${k}: ${equation} — это ${solveEquation(equation).value}, а в ответе ${lead[1]}`);
    }));
    assert(bad.length === 0, bad.join('; '));
});

test('у новых карточек пример одинаков во всех языках', () => {
    Object.keys(PREVIEW.ru).forEach(k => {
        const ruEquation = probeEquation(PREVIEW.ru[k].probe);
        LANGS.forEach(lang => eq(probeEquation(PREVIEW[lang][k].probe), ruEquation, `[${lang}] пример новой карточки ${k}`));
    });
});

// Задача не легче своей звезды: самое большое число равенства — не ниже главной полосы
// этой звезды в генераторе примеров (полосы берутся прямо из js/generator.js). Две карточки
// попались именно на этом: 91 на сложении 5★, где суммы 101–200, и 31 − 10 на вычитании 4★,
// где 51–100. Вверх чуть-чуть можно: пять пар по 11 у Гаусса дают 55 на 3★, где до 50, —
// а лёгкая задача на высокой звезде обесценивает звезду. Клетки 0–4 — сложение, 5–9 — вычитание.
const ADD_BANDS = vm.runInNewContext(
    /const ADD_BANDS = (\[[^;]*\]);/.exec(fs.readFileSync(path.join(ROOT, 'js', 'generator.js'), 'utf8'))[1]);
test('у новых карточек сложения и вычитания задача не легче своей звезды', () => {
    const keys = Object.keys(PREVIEW.ru).filter(k => +k < 10);
    assert(keys.length > 0, 'новых карточек сложения и вычитания не нашлось — проверять нечего');
    const bad = [];
    keys.forEach(k => {
        const level = +k % 5 + 1, [lo, hi] = ADD_BANDS[level - 1];
        const { biggest } = solveEquation(probeEquation(PREVIEW.ru[k].probe));
        if (biggest < lo) bad.push(`карточка ${k} (${+k < 5 ? 'сложение' : 'вычитание'} ${level}★): `
            + `самое большое число ${biggest}, а главная полоса этой звезды в игре — ${lo}–${hi}`);
    });
    assert(bad.length === 0, bad.join('; '));
});

// Повтор названия виден, только когда обе карточки на виду одновременно. У репетитора
// новая карточка заменяет прежнюю на том же месте, поэтому сверяется его коллекция
// целиком — новые на своих местах, прежние на остальных — и на каждом языке. Так новый
// «Корабль Тесея» (вычитание 5★) законен: прежний «Корабль Тесея» стоял на месте, которое
// у репетитора заняла шахматная доска. А второй такой же рядом с ним — уже нет.
test('у репетитора названия не повторяются ни на одном языке', () => {
    LANGS.forEach(lang => {
        const seen = {};
        CONTENT[lang].forEach((old, i) => {
            const px = Object.prototype.hasOwnProperty.call(PREVIEW[lang], i) ? PREVIEW[lang][i] : old;
            assert(!seen[px.name], `[${lang}] «${px.name}» встречается дважды`);
            seen[px.name] = true;
        });
    });
});

test('репетитор получает новые карточки на своих местах, остальное — прежнее', () => {
    LANGS.forEach(lang => {
        const box = loadResolver({ PARADOX_CONTENT: CONTENT, PARADOX_PREVIEW: PREVIEW },
                                 { seesPuzzlePreview: () => true, LANG: lang });
        const got = box.R();
        eq(got.length, RU.length, `[${lang}] карточек`);
        got.forEach((px, i) => {
            const want = Object.prototype.hasOwnProperty.call(PREVIEW[lang], i) ? PREVIEW[lang][i] : CONTENT[lang][i];
            eq(px.name, want.name, `[${lang}] карточка ${i}`);
        });
    });
});

test('ученик видит прежние карточки', () => {
    const box = loadResolver({ PARADOX_CONTENT: CONTENT, PARADOX_PREVIEW: PREVIEW }, { seesPuzzlePreview: () => false });
    eq(box.R().map(px => px.name).join('|'), RU.map(px => px.name).join('|'), 'список карточек');
});

test('без проверки репетитора и без новых карточек — прежние, и ничего не падает', () => {
    // Вырезанная отдельно функция не знает seesPuzzlePreview — так же, как страница,
    // где скрипт оборвался на середине. Это не повод показывать новое кому попало.
    const alone = loadResolver({ PARADOX_CONTENT: CONTENT, PARADOX_PREVIEW: PREVIEW });
    eq(alone.R()[0].name, RU[0].name, 'без seesPuzzlePreview');
    const noNew = loadResolver({ PARADOX_CONTENT: CONTENT }, { seesPuzzlePreview: () => true });
    eq(noNew.R()[0].name, RU[0].name, 'без PARADOX_PREVIEW');
});

test('язык, которого нет, и у репетитора откатывается на русский', () => {
    const box = loadResolver({ PARADOX_CONTENT: CONTENT, PARADOX_PREVIEW: PREVIEW },
                             { seesPuzzlePreview: () => true, LANG: 'es' });
    eq(box.R()[0].name, PREVIEW.ru[0].name, 'испанского нет — новая карточка по-русски');
    eq(box.R()[10].name, RU[10].name, 'и прежняя — по-русски');
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
