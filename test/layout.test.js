// Тесты раскладки игрового экрана.
//
// Зачем: экран, на котором ученик решает примеры, ломается молча и только на чужом
// устройстве. Прокрутка в рабочей зоне не роняет ничего и не видна на телефоне
// разработчика — её нашли, когда репетитор пожаловался на айпад, лежащий боком.
//
// Проверяется не «красиво ли», а то, что стережёт правила от тихой поломки:
// порядок медиазапросов и наличие потолков по высоте окна.
//
// Как запускать:  node test/layout.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STYLE = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function group(name) { console.log(`\n${name}`); }

// Границы каждого блока @media внутри стилей.
function mediaBlocks() {
    const out = [];
    let i = 0;
    while ((i = STYLE.indexOf('@media', i)) >= 0) {
        const open = STYLE.indexOf('{', i);
        let depth = 0, j = open;
        for (; j < STYLE.length; j++) {
            if (STYLE[j] === '{') depth++;
            else if (STYLE[j] === '}') { depth--; if (depth === 0) break; }
        }
        out.push({ start: i, end: j, cond: STYLE.slice(i, open).trim(), body: STYLE.slice(open + 1, j) });
        i = j + 1;
    }
    return out;
}

group('Порядок правил');

test('медиазапросы стоят ниже базовых правил, которые они переопределяют', () => {
    // Специфичность у @media та же, что у обычного правила: при равной силе побеждает
    // то, что ниже по файлу. Медиазапрос выше базового правила молча не работает —
    // ровно это и случилось с ответами в один ряд на лежащем экране.
    //
    // Сравнивать надо СВОЙСТВА, а не селекторы: правило ниже мешает, только если
    // задаёт то же самое свойство. Первая версия теста этого не различала и ругалась
    // на #cityCanvas, где медиазапрос ставит display, а правило ниже — положение.
    const blocks = mediaBlocks();
    assert(blocks.length >= 2, `блоков @media всего ${blocks.length} — похоже, они потерялись`);
    const props = (body) => [...body.matchAll(/([-a-z]+)\s*:/g)].map(m => m[1]);
    const problems = [];
    blocks.forEach(b => {
        [...b.body.matchAll(/(^|\n)\s*([.#a-zA-Z][^{}\n]*?)\s*\{([^}]*)\}/g)].forEach(rule => {
            const sel = rule[2].trim();
            const mine = props(rule[3]).filter(pr => !/!important/.test(rule[3]));
            if (!mine.length) return;
            const re = new RegExp('(^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
            let m;
            while ((m = re.exec(STYLE)) !== null) {
                const pos = m.index;
                if (pos < b.end) continue;                                   // выше или внутри блока
                if (blocks.some(x => pos > x.start && pos < x.end)) continue; // внутри другого @media
                const clash = props(m[2]).filter(pr => mine.indexOf(pr) >= 0);
                if (clash.length) problems.push(`«${sel}» из «${b.cond}»: свойства ${clash.join(', ')} перебиваются правилом ниже по файлу`);
            }
        });
    });
    assert(!problems.length, problems.join('\n      '));
});

group('Потолки по высоте окна');

test('пазл ограничен не только шириной, но и высотой окна', () => {
    // Привязка только к ширине раздувала пазл именно там, где места нет:
    // в альбомной ориентации ширины много, а высоты мало.
    const m = STYLE.match(/\.puzzle-mini-thumb\s*\{[^}]*\}/);
    assert(m, 'правило .puzzle-mini-thumb не найдено');
    // Проверяем обе стороны по отдельности: пазл квадратный, и потолок, снятый
    // с одной из них, растянет его целиком — а правило, где vh есть хоть где-то,
    // такую поломку пропускало.
    ['width', 'height'].forEach(side => {
        const d = m[0].match(new RegExp(side + ':\\s*([^;]+);'));
        assert(d, `у пазла не задан ${side}`);
        assert(/vh/.test(d[1]), `у пазла нет потолка по высоте окна в ${side} — на лежащем экране он снова съест рабочую зону`);
    });
});

test('размер вопроса ограничен высотой окна, а не только шириной', () => {
    const m = STYLE.match(/\.math-question\s*\{[^}]*\}/);
    assert(m, 'правило .math-question не найдено');
    assert(/vw/.test(m[0]), 'вопрос не растёт вместе с экраном — на айпаде он останется мелким');
    assert(/vh/.test(m[0]), 'у вопроса нет потолка по высоте — на широком и низком экране он раздуется в прокрутку');
});

test('рабочая зона шире на больших экранах, но не шире окна', () => {
    const m = STYLE.match(/\.math-box\s*\{[^}]*\}/);
    assert(m, 'правило .math-box не найдено');
    const mw = m[0].match(/max-width:\s*([^;]+);/);
    assert(mw, 'у .math-box нет max-width');
    assert(/vw/.test(mw[1]), `max-width «${mw[1].trim()}» не привязан к ширине окна — на узком экране коробка вылезет за край`);
    assert(/\d{3}px/.test(mw[1]), `max-width «${mw[1].trim()}» без предела в пикселях — на широком мониторе коробка расползётся`);
});

group('Низкие экраны');

test('для низких экранов есть отдельные правила', () => {
    const conds = mediaBlocks().map(b => b.cond);
    const short = conds.filter(c => /max-height/.test(c));
    assert(short.length >= 2,
        `правил для низких экранов ${short.length}: должно быть хотя бы два — общее поджатие и самый тесный случай`);
});

test('на самом низком экране шапка с пазлом убирается', () => {
    const b = mediaBlocks().find(x => /max-height:\s*4\d\dpx/.test(x.cond));
    assert(b, 'нет правила для экрана ниже 500 px');
    assert(/header\s*\{[^}]*display:\s*none/.test(b.body),
        'на самом низком экране шапка должна убираться: иначе примерам не остаётся места');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
