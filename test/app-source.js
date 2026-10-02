// Где лежит код приложения.
//
// index.html постепенно разрезается на файлы, и тесты, которые вырезают из него куски
// по строковым меткам, каждый раз это замечали. Чтобы следующий вынос не пришлось
// разносить по двум десяткам тестов, место сборки одно — здесь.
//
// Порядок тот же, в каком файлы подключает страница: сначала вынесенный код, потом
// встроенный скрипт. Метки от этого не страдают — они ищутся по всему тексту сразу,
// и неважно, в каком файле оказалась искомая функция.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Совпадает со списком <script src="js/..."> в index.html. Если разойдётся —
// тесты начнут не находить метки, и это заметно сразу.
const CODE_FILES = ['js/i18n.js', 'js/topics.js', 'js/generator.js', 'js/mistakes.js',
                    'js/charts.js', 'js/progress.js'];

// Только встроенный скрипт index.html, без вынесенных файлов.
function inlineScript(html) {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    return src.match(/<script>([\s\S]*)<\/script>/)[1];
}

// Весь код приложения одной строкой: вынесенные файлы плюс встроенный скрипт.
function appScript(html) {
    return CODE_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
        + '\n' + inlineScript(html);
}

// Склонение и числа из js/i18n.js — для песочниц, которые вырезают куски кода и
// без этого не знают plural() и num(). Код берётся настоящий, а не переписанный:
// разойдись копия с оригиналом, и тесты проверяли бы не то, что видит ученик.
// Язык — тот, что уже задан в песочнице (LANG), иначе русский.
function i18nHelpers() {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'i18n.js'), 'utf8');
    const pick = (a, b) => {
        const from = src.indexOf(a), to = src.indexOf(b, from + 1);
        if (from < 0 || to < 0) throw new Error(`в js/i18n.js не найдено: ${a}`);
        return src.slice(from, to);
    };
    return 'var LANG = (typeof LANG === "undefined") ? "ru" : LANG;\n'
        + pick('const LANGS = [', '// Словари лежат').replace('const LANGS', 'var LANGS')
        + pick('function plural(', '// Разделитель дробной части')
        + src.slice(src.indexOf('function num('));
}

module.exports = { ROOT, CODE_FILES, appScript, inlineScript, i18nHelpers };
