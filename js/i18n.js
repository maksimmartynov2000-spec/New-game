// Ядро переводов. Код, а не содержимое: сами словари лежат в content/i18n.js.
//
// Здесь только выбор языка и две функции подстановки, t() и tf(). Вынесено отдельно,
// потому что этим ядром пользуются другие вынесенные файлы: js/mistakes.js строит
// таблицу подписей к ошибкам прямо при загрузке, то есть t() обязана существовать
// раньше него. Порядок подключения в index.html поэтому не произволен.
//
// Язык переключается перезагрузкой страницы (см. setLang в index.html), поэтому
// LANG за время работы не меняется, и таблицы, собранные один раз при загрузке,
// не могут разойтись с текущим языком.

// uiLabel — слово «Язык» на самом этом языке: подпись кнопки должна быть на том
// языке, который сейчас выбран, а не на английском для всех нерусских.
const LANGS = [
    { code: 'ru', name: 'Русский',  short: 'RU', uiLabel: 'Язык: ',    locale: 'ru-RU', comma: true },
    { code: 'en', name: 'English',  short: 'EN', uiLabel: 'Language: ', locale: 'en-US', comma: false },
    { code: 'fr', name: 'Français', short: 'FR', uiLabel: 'Langue : ',  locale: 'fr-FR', comma: true },
    { code: 'de', name: 'Deutsch',  short: 'DE', uiLabel: 'Sprache: ',  locale: 'de-DE', comma: true }
];
// Словари лежат в content/i18n.js — это полторы тысячи строк чистых данных,
// и держать их посреди логики незачем. Файл не доехал — работаем по-русски:
// t() отдаёт ключ, когда перевода нет.
const TRANSLATIONS = (typeof window !== 'undefined' && window.TRANSLATIONS) || {};
const LANG_KEY = 'mathCitadelLang_v1';
let LANG = (() => {
    const known = (c) => LANGS.some(l => l.code === c);
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (known(saved)) return saved;
    } catch (e) { /* хранилище недоступно */ }
    const nav = (navigator.language || 'ru').toLowerCase().slice(0, 2);
    return known(nav) ? nav : 'en';
})();

function t(ru) {
    if (LANG === 'ru') return ru;
    const dict = TRANSLATIONS[LANG];
    const v = dict && dict[ru];
    // Нет перевода — отдаём русский. Недоделанный словарь так просвечивает
    // русским в отдельных местах, но приложение работает; это лучше пустоты.
    return v === undefined ? ru : v;
}
// То же для строк с подстановками: tf('Подряд: %1', n).
function tf(ru) {
    let out = t(ru);
    for (let i = 1; i < arguments.length; i++) {
        out = out.split('%' + i).join(String(arguments[i]));
    }
    return out;
}

// Разделитель дробной части: точка только в английском. В русском, французском
// и немецком — запятая. Числа собираются через toFixed, поэтому правим на выходе.
function num(x, digits) {
    const v = Number(x).toFixed(digits === undefined ? 1 : digits);
    return currentLang().comma ? v.replace('.', ',') : v;
}

function currentLang() {
    return LANGS.find(l => l.code === LANG) || LANGS[0];
}
