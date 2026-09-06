// Тесты языка, на котором приложение разговаривает с УЧЕНИКОМ.
//
// Зачем: у приложения два собеседника с разными словарями. Репетитор понимает «ступень
// количества», «клетка карты», «сводный ранг» — он это и придумывал. Одиннадцатилетний
// не понимает ничего из этого, а спросить ему некого: он просто перестаёт читать.
//
// Слова протекали к нему годами и незаметно. Самое яркое: на игровом экране крупно и
// золотом стояло «⏳ Время Эпохи» — это были обычные часы миссии, а «эпоха» в этом
// приложении значит совсем другое (свёрнутые 180 дней в статистике). А экзамен при сбое
// предлагал ребёнку «запустить supabase/exam.sql».
//
// Проверяется не красота, а два правила:
//   1) в текстах для ученика нет наших внутренних слов;
//   2) в них нет слов из машинного мира — сервер, SQL, токен и прочего, с чем ребёнок
//      всё равно ничего сделать не может.
//
// Как запускать:  node test/wording.test.js

const fs = require('fs');
const path = require('path');

const { ROOT, CODE_FILES, inlineScript } = require('./app-source');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function group(name) { console.log(`\n${name}`); }

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CODE = CODE_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
           + '\n' + inlineScript(HTML);

// Экраны репетитора остаются русскими и своими словами — они и не переводятся.
// Отделяем их по признаку: строки внутри t()/tf() показываются всем, включая ученика.
function studentStrings() {
    const out = [];
    const re = /(?<![\w$.])tf?\(\s*'((?:\\.|[^'\\])*)'/g;
    let m;
    while ((m = re.exec(CODE))) out.push(m[1].replace(/\\'/g, "'"));
    return out;
}

// Текст прямо в разметке ученик тоже видит — и его тоже переводит applyStaticI18n.
function markupStrings() {
    const body = HTML.slice(HTML.indexOf('<body>'), HTML.indexOf('<script>', HTML.indexOf('</head>')));
    const out = [];
    const re = />([^<>{}]{3,160})</g;
    let m;
    while ((m = re.exec(body))) {
        const x = m[1].trim();
        if (x && /[А-Яа-яЁё]/.test(x)) out.push(x);
    }
    return out;
}

const ALL = studentStrings().concat(markupStrings());

group('Слова, которых ученик не знает');

test('наших внутренних слов в текстах для ученика нет', () => {
    // «Эпоха» осталась в одном месте намеренно: в статистике так называется карточка
    // за 180 дней, и прямо под заголовком написано, что это. Слово там объяснено —
    // а на игровом экране оно стояло без объяснения и значило другое.
    const banned = [
        ['ступен', 'у ученика это медали: Бронза, Серебро, Золото'],
        ['лесенк', 'у ученика это медали и звёзды'],
        ['сводн',  'внутреннее название ранга'],
        ['дистрактор', 'название вариантов ответа из кода']
    ];
    const bad = [];
    ALL.forEach(x => {
        banned.forEach(([w, why]) => {
            if (x.toLowerCase().includes(w)) bad.push(`«${x.slice(0, 60)}» — ${why}`);
        });
    });
    assert(bad.length === 0, bad.join('; '));
});

test('«Эпоха» не встречается вне статистики', () => {
    // На игровом экране это были просто часы миссии.
    // Комментарии разметки выбрасываем: ученик их не читает, а объяснение этой самой
    // правки стоит рядом с часами и содержит слово «эпоха» — проверка ловила себя.
    const body = HTML.slice(HTML.indexOf('<body>'), HTML.indexOf('<script>', HTML.indexOf('</head>')))
        .replace(/<!--[\s\S]*?-->/g, '');
    const clock = body.slice(body.indexOf('id="gameClock"'), body.indexOf('</header>'));
    assert(clock.length > 0, 'часы миссии не нашлись — проверка стала пустой');
    assert(!/эпох/i.test(clock), 'на игровом экране снова появилась «эпоха»');
});

test('слова машинного мира ученику не показываются', () => {
    // Ребёнок не может ни запустить SQL, ни починить сервер: такое сообщение для него
    // просто страшный шум. Подсказка разработчику должна уходить в консоль.
    const banned = ['supabase', 'sql', 'токен', 'rpc', 'json'];
    const bad = [];
    studentStrings().forEach(x => {
        const low = x.toLowerCase();
        banned.forEach(w => { if (low.includes(w)) bad.push(`«${x.slice(0, 70)}»`); });
    });
    assert(bad.length === 0, `видит ученик: ${bad.join('; ')}`);
});

group('Одно и то же называется одинаково');

test('медаль всегда показывается значком и именем', () => {
    // Было три разных вида в трёх местах: «🥈 «Серебро»», «Серебро 🥈» и просто
    // «Серебро». Одна и та же вещь должна выглядеть одинаково всюду.
    const uses = [...CODE.matchAll(/TIER_NAMES\[[^\]]+\]/g)].length;
    const viaMedal = [...CODE.matchAll(/medal\([^)]+\)/g)].length;
    assert(viaMedal >= 3, `medal() зовётся всего ${viaMedal} раз — где-то медаль собирается вручную`);
    // TIER_NAMES допустим внутри самого medal(), в таблицах — и в подписи (title)
    // к значку медали: там значок и есть сам элемент, под которым всплывает подпись,
    // и medal() нарисовал бы значок второй раз.
    const inTexts = CODE.split('\n')
        .filter(line => /tf?\([^)]*TIER_NAMES/.test(line))
        .filter(line => !/\.title\s*=/.test(line));
    assert(inTexts.length === 0,
        `медаль подставляется в текст мимо medal(): ${(inTexts[0] || '').trim()}`);
});

test('шаги выбора миссии пронумерованы подряд с первого', () => {
    // Клавишная цифра — это три знака: цифра, селектор начертания и U+20E3.
    // Без \ufe0f регулярное выражение не находило ни одного шага и проверка молчала.
    const steps = [...HTML.matchAll(/config-section-title">([1-9]\ufe0f?\u20e3[^<]*)</g)].map(m => m[1]);
    const nums = steps.map(x => x.codePointAt(0) - 0x30);
    assert(nums.length >= 3, `шагов найдено ${nums.length}`);
    assert(nums[0] === 1, `нумерация начинается с ${nums[0]}, а не с первого экрана`);
    for (let i = 1; i < nums.length; i++) {
        assert(nums[i] === nums[i - 1] + 1, `после ${nums[i - 1]} идёт ${nums[i]}`);
    }
});

test('один и тот же вопрос не задаётся дважды', () => {
    // Сравнивать надо ВНУТРИ экрана. «🎯 Задания» стоит и в статистике, и на выборе
    // миссии — это один и тот же раздел, показанный в двух местах, а не повтор.
    // Повтор — это когда на одном экране два одинаковых заголовка подряд.
    const re = /id="([A-Za-z]+Screen)"|config-section-title">([^<]+)</g;
    const byScreen = {};
    let screen = '(до первого экрана)', m;
    while ((m = re.exec(HTML))) {
        if (m[1]) { screen = m[1]; continue; }
        const title = m[2].replace(/^[1-9]\ufe0f?\u20e3\s*/, '').trim();
        (byScreen[screen] = byScreen[screen] || []).push(title);
    }
    const dupes = [];
    Object.keys(byScreen).forEach(s => {
        const seen = {};
        byScreen[s].forEach(x => { if ((seen[x] = (seen[x] || 0) + 1) === 2) dupes.push(`${s}: ${x}`); });
    });
    assert(Object.keys(byScreen).length > 3, 'экраны не нашлись — проверка стала пустой');
    assert(dupes.length === 0, `повторяется заголовок: ${dupes.join(', ')}`);
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
