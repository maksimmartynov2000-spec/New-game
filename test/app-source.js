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
const CODE_FILES = ['js/i18n.js', 'js/generator.js', 'js/mistakes.js', 'js/progress.js'];

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

module.exports = { ROOT, CODE_FILES, appScript, inlineScript };
