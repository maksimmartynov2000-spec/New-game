// Проверка словарей: они не должны разъезжаться с кодом ни в одну сторону.
//
// Зачем. Приложение говорит на четырёх языках, а тексты живут в двух местах:
// ключ в коде и перевод в content/i18n.js. Ничто их не сверяло, и оба края
// поехали. Новый текст можно было добавить без перевода — и француженка видела
// русскую строку; переименованный ключ оставлял в словарях сироту, которую
// никто уже не покажет. К моменту, когда это заметили, накопилось 49 ключей без
// перевода и 23 мёртвых.
//
// Самое обидное было в окне серии: ученик нажимал «🔥 9 дней» и получал три
// русские строки на любом языке.
//
// Как запускать:  node test/i18n-drift.test.js

const fs = require('fs');
const path = require('path');
const { ROOT, CODE_FILES, inlineScript } = require('./app-source');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  \u2713 ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  \u2717 ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function group(name) { console.log(`\n${name}`); }

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CODE = CODE_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
           + '\n' + inlineScript(HTML);

global.window = {};
require(path.join(ROOT, 'content/i18n.js'));
const DICT = global.window.TRANSLATIONS;
const LANGS = Object.keys(DICT);

// Ключи, которые видит ТОЛЬКО репетитор и которые можно не переводить.
//
// Раньше здесь лежало полсотни строк: экраны «Мои ученики», отчёт родителям,
// выдача доступа, папки были русскими по решению. Решение поменялось — репетитор
// попросил, чтобы и его экраны говорили на языке приложения. Список пуст, и
// дописывать в него снова — это отменять то решение, а не чинить тест.
const TUTOR_ONLY = [];

// Ключ в исходнике записан экранированным, а t() получает строку уже развёрнутой:
// '...%2.\\n' в коде — это перенос строки в памяти. Сравнивать надо то, что видит
// t(), иначе проверка объявит мёртвыми ровно те переводы, которые работают.
function unescape(lit) {
    return lit.replace(/\\(.)/g, (_, c) =>
        c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c);
}
function codeKeys() {
    const out = new Set();
    const re = /(?<![\w$.])tf?\(\s*'((?:\\.|[^'\\])*)'/g;
    let m;
    while ((m = re.exec(CODE))) out.add(unescape(m[1]));
    // Дни недели в календаре переводятся по одному — t(w) из списка WEEKDAY_SHORT,
    // — и литерала t('Пн') в коде нет. Без этой строки проверка считала их мёртвыми.
    // «Вт», «Ср» и остальные уцелели случайно: такие буквы находятся в разметке
    // внутри других слов («Втор…», «Сравн…»). А «Пн» и «Пт» не нашлись, их удалили
    // как сирот — и в календаре на английском неделя начиналась с «Пн».
    const week = CODE.match(/const WEEKDAY_SHORT = \[([^\]]*)\]/);
    if (week) (week[1].match(/'[^']*'/g) || []).forEach(x => out.add(x.slice(1, -1)));
    // Таблицы слов для сообщения родителям — тоже t(переменная), и по той же причине
    // перечислены здесь поимённо: литерала t('сложение') в коде нет.
    ['PARENT_OP_WORDS', 'PARENT_CAT_WORDS', 'PARENT_TIER_WORDS', 'PARENT_LADDER_WORDS'].forEach(name => {
        const m = CODE.match(new RegExp('const ' + name + ' = [\\[{]([\\s\\S]*?)[\\]}];'));
        assert(m, `не найдена таблица ${name}`);
        (m[1].match(/'[^']*'/g) || []).map(x => x.slice(1, -1))
            .filter(x => /[А-Яа-яЁё]/.test(x)).forEach(x => out.add(x));
    });
    // plural(n, одна, несколько, много): в словаре нужны «одна» и «много» — по ним
    // выбирают остальные языки. «Несколько» есть только в русском.
    const pl = /(?<![\w$.])plural\(\s*[^,()]+(?:\([^()]*\))?\s*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'(?:\\.|[^'\\])*'\s*,\s*'((?:\\.|[^'\\])*)'\s*\)/g;
    while ((m = pl.exec(CODE))) { out.add(unescape(m[1])); out.add(unescape(m[2])); }
    return out;
}

group('Словари и код не разъезжаются');

test('у каждого текста для ученика есть перевод', () => {
    const missing = [...codeKeys()].filter(k => {
        if (TUTOR_ONLY.indexOf(k) >= 0) return false;
        return LANGS.some(l => !DICT[l][k]);
    });
    assert(missing.length === 0,
        `без перевода: ${missing.slice(0, 5).map(x => `\u00ab${x.slice(0, 50)}\u00bb`).join('; ')}`
        + (missing.length > 5 ? ` \u2026 и ещё ${missing.length - 5}` : ''));
});

// Русский текст прямо в РАЗМЕТКЕ, который можно не переводить. Пуст по той же
// причине, что и TUTOR_ONLY выше: экраны репетитора теперь тоже переводятся.
const MARKUP_TUTOR_ONLY = [];

test('русский текст прямо в разметке тоже переведён', () => {
    // Дыра, которую нашёл Максим: проверка выше сторожит строки из кода (те, что
    // идут через t()), а текст, написанный прямо в вёрстке, не сторожил никто.
    // Так «2️⃣ Какое действие» осталось по-русски на всех четырёх языках — ровно
    // посреди детского экрана выбора миссии.
    //
    // applyStaticI18n переводит разметку по обрезанному тексту узла и по четырём
    // атрибутам. Здесь разбираем то же самое: между тегами и в этих атрибутах.
    // Комментарии убираем ДО среза: иначе от комментария, начавшегося выше <body>,
    // остаётся хвост, и он читается как текст.
    const clean = HTML.replace(/<!--[\s\S]*?-->/g, ' ');
    const body = clean.slice(clean.indexOf('<body>'), clean.indexOf('<script>', clean.indexOf('</head>')));
    const missing = [];
    const seen = new Set();
    const check = (raw, where) => {
        // Ключ — ровно то, что видит applyStaticI18n: textContent.trim(), БЕЗ
        // схлопывания пробелов внутри. Схлопнёшь — и длинные пояснения, разбитые
        // в вёрстке на строки, перестанут находиться в словаре, хотя перевод есть.
        const key = String(raw).trim();
        if (!key || !/[А-Яа-яЁё]/.test(key)) return;
        if (seen.has(key)) return;
        seen.add(key);
        if (MARKUP_TUTOR_ONLY.indexOf(key.replace(/\s+/g, ' ')) >= 0) return;
        if (!(key in DICT[LANGS[0]])) missing.push(`${where}: «${key.slice(0, 60)}»`);
    };
    // Текст между тегами — ровно то, что видит TreeWalker в applyStaticI18n.
    body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
        .split(/<[^>]*>/).forEach(chunk => check(chunk, 'текст'));
    // Атрибуты, которые переводятся отдельным проходом.
    ['placeholder', 'title', 'aria-label', 'alt'].forEach(attr => {
        const re = new RegExp(attr + '="([^"]*)"', 'g');
        let m;
        while ((m = re.exec(body))) check(m[1], attr);
    });
    assert(missing.length === 0,
        `в разметке без перевода (${missing.length}): ${missing.slice(0, 5).join('; ')}`);
});

test('список учительской разметки не протух', () => {
    const flat = HTML.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ');
    const stale = MARKUP_TUTOR_ONLY.filter(k => flat.indexOf(k) < 0);
    assert(stale.length === 0, `в списке есть то, чего в разметке нет: ${stale.slice(0, 3).join('; ')}`);
});

test('в словарях нет ключей, которых больше нет нигде', () => {
    // Переименовал текст — перевод старого остался сиротой. Показать его уже
    // некому, а при следующем переименовании легко поправить не ту строку.
    // Разметку тоже считаем: applyStaticI18n переводит её по тем же ключам.
    const inCode = codeKeys();
    const body = HTML.slice(HTML.indexOf('<body>'));
    const dead = Object.keys(DICT[LANGS[0]]).filter(k => !inCode.has(k) && body.indexOf(k) < 0);
    assert(dead.length === 0,
        `мёртвые ключи (${dead.length}): ${dead.slice(0, 5).map(x => `\u00ab${x.slice(0, 40)}\u00bb`).join('; ')}`);
});

test('во всех языках одинаковый набор ключей', () => {
    const base = Object.keys(DICT[LANGS[0]]).sort().join('\u0000');
    LANGS.forEach(l => {
        assert(Object.keys(DICT[l]).sort().join('\u0000') === base,
            `набор ключей в «${l}» отличается от «${LANGS[0]}»`);
    });
});

test('список «только для репетитора» не протух', () => {
    // Строка, которую убрали из кода, должна уходить и отсюда — иначе список
    // растёт мусором и однажды прикроет собой настоящую дыру.
    const inCode = codeKeys();
    const stale = TUTOR_ONLY.filter(k => !inCode.has(k));
    assert(stale.length === 0,
        `в списке есть то, чего в коде нет: ${stale.slice(0, 4).join('; ')}`);
});

console.log(`\n${'\u2500'.repeat(50)}`);
if (failed === 0) {
    console.log(`Все проверки пройдены: ${passed}`);
    process.exit(0);
} else {
    console.log(`Провалено: ${failed} из ${passed + failed}`);
    failures.forEach(f => console.log(`  \u2022 ${f.name}\n    ${f.message}`));
    process.exit(1);
}
