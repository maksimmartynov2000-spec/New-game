// Тесты словарей перевода.
//
// Зачем отдельным файлом: словари — это 1400 строк данных, которые никто не читает
// глазами, а ломаются они молча. Пропал ключ — интерфейс в этом месте просто
// проваливается в русский. Потерялась подстановка %1 — из фразы молча исчезает число,
// и «до золота ещё 12 ответов» превращается в «до золота ещё ответов». Ни то, ни
// другое не роняет страницу и не видно, пока не откроешь нужный экран на нужном языке.
//
// Как запускать:  node test/i18n.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function loadDicts() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

    const dict = (name) => {
        const head = 'const ' + name + ' = {';
        const from = script.indexOf(head);
        if (from < 0) throw new Error('не найден словарь ' + name);
        const to = script.indexOf('\n        };', from);
        if (to < 0) throw new Error('не найден конец словаря ' + name);
        const src = script.slice(from, to + '\n        };'.length)
            + '\n;globalThis.__d = ' + name + ';';
        const sandbox = {};
        vm.createContext(sandbox);
        vm.runInContext(src, sandbox, { filename: 'index.html<' + name + '>' });
        return sandbox.__d;
    };

    // Список языков: коды и то, ставит ли язык запятую в дробях.
    const langsFrom = script.indexOf('const LANGS = [');
    const langsTo = script.indexOf('];', langsFrom);
    const langsSrc = script.slice(langsFrom, langsTo + 2) + '\n;globalThis.__l = LANGS;';
    const lb = {};
    vm.createContext(lb);
    vm.runInContext(langsSrc, lb, { filename: 'index.html<LANGS>' });

    return { en: dict('TR_EN'), fr: dict('TR_FR'), de: dict('TR_DE'), langs: lb.__l, script };
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(got, want, what) {
    if (got !== want) throw new Error(`${what}: ожидали ${want}, получили ${got}`);
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function group(name) { console.log(`\n${name}`); }

const D = loadDicts();
const LANGS_WITH_DICT = [['fr', D.fr], ['de', D.de]];
const enKeys = Object.keys(D.en);

group('Состав словарей');

test('английский словарь на месте и не пуст', () => {
    assert(enKeys.length > 400, `в TR_EN всего ${enKeys.length} ключей — похоже, он обрезался`);
});

test('во всех языках ровно те же ключи, что в английском', () => {
    // Разный состав ключей означает, что часть интерфейса на одном языке молча
    // проваливается в русский, а на другом — нет. Заметить это можно только глазами.
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        const keys = Object.keys(dict);
        const missing = enKeys.filter(k => !(k in dict));
        const extra = keys.filter(k => !(k in D.en));
        assert(!missing.length, `в ${lang} не хватает ${missing.length} ключей, первый: «${missing[0]}»`);
        assert(!extra.length, `в ${lang} лишние ключи (${extra.length}), первый: «${extra[0]}»`);
        eq(keys.length, enKeys.length, `число ключей в ${lang}`);
    });
});

test('ни одного пустого перевода', () => {
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        const empty = enKeys.filter(k => !String(dict[k] || '').trim());
        assert(!empty.length, `в ${lang} пустых переводов: ${empty.length}, первый у «${empty[0]}»`);
    });
});

test('перевод нигде не остался русским текстом', () => {
    // Пропущенная строка выглядит как работающая: она просто копия ключа.
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        const cyr = enKeys.filter(k => /[А-Яа-яЁё]/.test(dict[k]));
        assert(!cyr.length, `в ${lang} осталась кириллица в ${cyr.length} строках, первая: «${dict[cyr[0]]}»`);
    });
});

group('Подстановки и разметка');

const placeholders = (s) => (String(s).match(/%\d/g) || []).sort().join('');
const tagNames = (s) => (String(s).match(/<\/?[a-z]+/gi) || []).join(',');

test('все подстановки %N дошли до перевода', () => {
    // Потерянная %1 не роняет ничего: из фразы просто исчезает число.
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        enKeys.forEach(k => {
            eq(placeholders(dict[k]), placeholders(k), `подстановки в ${lang} у «${k.slice(0, 45)}»`);
        });
    });
});

test('разметка внутри строк не поехала', () => {
    // Часть строк несёт HTML целиком. Потерянный или лишний тег ломает вёрстку
    // ровно на том языке, на котором его потеряли.
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        enKeys.filter(k => /</.test(k)).forEach(k => {
            eq(tagNames(dict[k]), tagNames(D.en[k]), `теги в ${lang} у «${k.slice(0, 45)}»`);
        });
    });
});

test('краевые пробелы совпадают с английскими', () => {
    // Часть строк склеивается с соседними («до золота: » + «ещё 12»). Съеденный
    // пробел по краям слепляет слова, и заметно это только в готовой фразе.
    const lead = (s) => (String(s).match(/^ +/) || [''])[0].length;
    const trail = (s) => (String(s).match(/ +$/) || [''])[0].length;
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        enKeys.forEach(k => {
            eq(lead(dict[k]), lead(D.en[k]), `пробелы слева в ${lang} у «${k}»`);
            eq(trail(dict[k]), trail(D.en[k]), `пробелы справа в ${lang} у «${k}»`);
        });
    });
});

test('табуляции в копируемых таблицах на месте', () => {
    // Две строки — заголовки таблицы, которую репетитор вставляет в редактор.
    // Таб там разделитель колонок: потеряли — таблица склеилась в одну колонку.
    const tabs = (s) => (String(s).match(/\t/g) || []).length;
    LANGS_WITH_DICT.forEach(([lang, dict]) => {
        enKeys.filter(k => tabs(k) > 0).forEach(k => {
            eq(tabs(dict[k]), tabs(D.en[k]), `табы в ${lang} у «${k.replace(/\t/g, '→')}»`);
        });
    });
});

group('Список языков');

test('каждый язык кроме русского ПОДКЛЮЧЁН к словарю', () => {
    // Мало того, чтобы словарь существовал: t() берёт его из TRANSLATIONS, и язык,
    // забытый в этой карте, даёт полностью русский интерфейс при живом словаре рядом.
    // Первая версия теста проверяла только существование и такую мутацию пропускала.
    const from = D.script.indexOf('const TRANSLATIONS = {');
    assert(from >= 0, 'карта TRANSLATIONS не найдена');
    const map = D.script.slice(from, D.script.indexOf('};', from));
    D.langs.forEach(l => {
        if (l.code === 'ru') return;
        assert(new RegExp('\\b' + l.code + '\\s*:').test(map),
            `язык ${l.code} не подключён в TRANSLATIONS — интерфейс будет весь русский`);
    });
});

test('коды и подписи языков не повторяются', () => {
    const codes = D.langs.map(l => l.code);
    const shorts = D.langs.map(l => l.short);
    eq(new Set(codes).size, codes.length, 'уникальных кодов');
    eq(new Set(shorts).size, shorts.length, 'уникальных подписей на пилюле');
});

test('у каждого языка заполнены подпись, локаль и правило запятой', () => {
    D.langs.forEach(l => {
        assert(typeof l.uiLabel === 'string' && l.uiLabel, `у ${l.code} нет uiLabel`);
        assert(typeof l.locale === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(l.locale), `у ${l.code} странная локаль: ${l.locale}`);
        assert(typeof l.comma === 'boolean', `у ${l.code} не задано правило десятичной запятой`);
    });
});

test('десятичный разделитель: точка только в английском', () => {
    D.langs.forEach(l => {
        eq(l.comma, l.code !== 'en', `запятая у ${l.code}`);
    });
});

test('в словарях нет повторяющихся ключей', () => {
    // Дубль не заметен: второй молча перекрывает первый, и одна из двух фраз
    // навсегда остаётся непереведённой. Так уже случалось.
    ['TR_EN', 'TR_FR', 'TR_DE'].forEach(name => {
        const head = 'const ' + name + ' = {';
        const from = D.script.indexOf(head);
        const to = D.script.indexOf('\n        };', from);
        const body = D.script.slice(from + head.length, to);
        const keys = [...body.matchAll(/^\s{12}("(?:[^"\\]|\\.)*")\s*:/gm)].map(m => m[1]);
        eq(new Set(keys).size, keys.length, `уникальных ключей в ${name} (всего ${keys.length})`);
    });
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
