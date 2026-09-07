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

// Ключи, которые видит ТОЛЬКО репетитор. Их и не переводим: экраны «Мои ученики»,
// отчёт родителям, выдача доступа, папки, смена пароля — все русские по решению,
// а не по недосмотру.
//
// Список нарочно записан целиком, а не выведен правилом: правила, отличающего
// экран репетитора от экрана ученика, в коде нет, и любое приближение однажды
// пропустило бы детскую строку. Добавлять сюда — сознательное действие: если
// новый текст правда видит только репетитор, строка дописывается руками.
const TUTOR_ONLY = [
    "Не удалось прочитать доступ ученика.",
    "Что открыто ученику",
    "Ученик: %1. Меняется сразу, без кода.",
    "Это не твой ученик.",
    "Ученик: %1",
    "«Почти» (счёт верный, но ответ не сокращён): %1",
    "Сообщение скопировано.",
    "Не удалось загрузить данные ученика.",
    "Комментарий для родителей",
    "Идёт первой строкой сообщения — здесь имя, обращение и всё личное. Цифры ниже подставятся сами.",
    "Например: Здравствуйте! Маша уверенно считает в уме до 20, дроби беру помедленнее.",
    " <span class=\"arrow %1\">%2%3 с</span>",
    "<div class=\"report-empty\">За этот период данных по темам пока мало.</div>",
    "<div class=\"report-empty\">В этот период новых достижений не было.</div>",
    "%1%2",
    "\n                    <div class=\"list-row-main\">\n                        <div class=\"list-row-name\"></div>\n                        <div class=\"list-row-sub\"></div>\n                    </div>\n                    %1\n                ",
    "<div class=\"menu-empty\">Пока нет учеников.<br>Добавь первого кнопкой ниже.</div>",
    "%1 %2 не выходил%3",
    " на связь больше недели. Проверь, занимается ли и доходит ли прогресс.",
    "\n                    <div class=\"list-row-main\">\n                        <div class=\"list-row-name\"></div>\n                        <div class=\"list-row-sub\"></div>\n                    </div>\n                    <button class=\"list-row-btn\" data-act=\"view\">Смотреть</button>\n                    <button class=\"list-row-btn\" data-act=\"report\" title=\"Отчёт родителям\">📄</button>\n                    <button class=\"list-row-btn\" data-act=\"access\" title=\"Что открыто\">⭐</button>\n                    <button class=\"list-row-btn\" data-act=\"group\" title=\"Папка\">📁</button>\n                    <button class=\"list-row-btn\" data-act=\"pw\" title=\"Сменить пароль\">🔑</button>\n                    <button class=\"list-row-btn\" data-act=\"del\" title=\"Удалить\">🗑️</button>\n                ",
    "⚠️ ни разу не выходил на связь",
    "⚠️ молчит %1 %2",
    "⏳ не было %1 %2",
    "📄 Без папки",
    "Папка ученика",
    "Название папки",
    "например: 5 класс",
    "Пустое поле — убрать из папки.",
    "Не удалось загрузить статистику ученика.",
    "Новый ученик",
    "Логин и пароль нужно будет передать ученику — под ними он войдёт со своего устройства.",
    "Логин ученика",
    "Добавлять учеников может только репетитор.",
    "Не удалось создать ученика.",
    "<div class=\"menu-code-line\"></div><div class=\"menu-stat-label\" style=\"margin-top:6px;\">Код и пароль ученика — передай их, чтобы он вошёл</div>",
    "Не удалось создать ученика. Проверь интернет.",
    "Пароль для ученика «%1». Старый перестанет работать сразу.",
    "Ученик: %1\nНовый пароль: %2\n\nПередай его — старый больше не работает,",
    "\nа устройства, где он уже был введён, попросят войти заново.",
    "Удалить ученика?",
    "Ученик «%1» пропадёт насовсем — весь прогресс и сам логин, без возможности восстановить.",
    "Не удалось удалить ученика.",
    "Ученик «%1» удалён."
];

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
