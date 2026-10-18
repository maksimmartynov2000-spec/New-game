// Тесты картинок коллекции: имя файла — это обещание.
//
// Зачем этот файл появился. В #173 пять парадоксов заменили на новые, и новые
// картинки положили ПОД ТЕМИ ЖЕ ИМЕНАМИ. Ошибка тихая: в репозитории всё верно,
// у разработчика всё верно, тесты зелёные. А у ученика на телефоне карточка
// «Бесконечная шоколадка» открылась с рогом Гавриила — картинкой парадокса,
// которого в игре уже нет. Service worker кеширует картинки «сначала кеш» и
// никогда не спрашивает сеть заново: он исходит из того, что файл под данным
// именем всегда один и тот же. Это написано в самом sw.js — и было нарушено.
//
// Поэтому правило: КАРТИНКУ НЕЛЬЗЯ ПОДМЕНИТЬ ПОД ТЕМ ЖЕ ИМЕНЕМ. Новая картинка —
// новое имя файла. Старое имя больше не используется никогда.
//
// Слепок в test/image-fingerprints.json хранит по короткому хешу на каждый файл.
// Проверка ловит ровно ту ошибку: имя осталось, содержимое изменилось. Обновлять
// слепок руками — это и есть та осознанная остановка, ради которой он заведён.
//
// Как запускать:  node test/images.test.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const PRINTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-fingerprints.json'), 'utf8'));

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }

function hash(rel) {
    return crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 16);
}
function listed() {
    const from = HTML.indexOf('const PUZZLE_IMAGE_SRCS');
    const to = HTML.indexOf('];', from);
    assert(from > 0 && to > 0, 'не найден список PUZZLE_IMAGE_SRCS');
    return [...HTML.slice(from, to).matchAll(/'(images\/[^']+)'/g)].map(m => m[1]);
}
// Новые картинки, которые пока видит только репетитор: индекс клетки → файл.
function previewListed() {
    const from = HTML.indexOf('const PUZZLE_PREVIEW_SRCS');
    const to = HTML.indexOf('};', from);
    assert(from > 0 && to > 0, 'не найден список PUZZLE_PREVIEW_SRCS');
    return [...HTML.slice(from, to).matchAll(/(\d+):\s*'(images\/[^']+)'/g)].map(m => ({ idx: +m[1], src: m[2] }));
}

console.log('\nКартинки коллекции');

// Та самая ошибка: имя то же, картинка другая. У всех, кто уже открывал игру,
// останется старая — и текст разойдётся с рисунком ровно так, как разошёлся.
test('ни одна картинка не подменена под прежним именем', () => {
    const changed = Object.keys(PRINTS)
        .filter(rel => fs.existsSync(path.join(ROOT, rel)))
        .filter(rel => hash(rel) !== PRINTS[rel]);
    eq(changed.join(', '), '',
        'картинка заменена под тем же именем: ' + changed.join(', ')
        + '. У детей в кеше останется старая. Дай новому файлу НОВОЕ имя, '
        + 'а слепок test/image-fingerprints.json обнови отдельно и осознанно.');
});

// Имя, однажды побывавшее в игре, второй раз использовать нельзя: где-то может
// лежать его старое содержимое. Файл можно убрать из игры, но не переиспользовать.
test('исчезнувшие имена не всплывают заново', () => {
    const gone = Object.keys(PRINTS).filter(rel => !fs.existsSync(path.join(ROOT, rel)));
    const inGame = listed().concat(previewListed().map(p => p.src));
    const back = gone.filter(rel => inGame.indexOf(rel) >= 0);
    eq(back.join(', '), '', `имена вернулись в игру после того, как ушли: ${back.join(', ')}`);
});

test('каждая картинка из списка лежит на диске — и полная, и превью', () => {
    const lost = [];
    listed().concat(previewListed().map(p => p.src)).forEach(rel => {
        if (!fs.existsSync(path.join(ROOT, rel))) lost.push(rel);
        const thumb = rel.replace('images/', 'images/thumbs/');
        if (!fs.existsSync(path.join(ROOT, thumb))) lost.push(thumb);
    });
    eq(lost.join(', '), '', `нет файлов: ${lost.join(', ')}`);
});

// Двадцать парадоксов и двадцать картинок: индекс одного — индекс другой.
test('картинок ровно столько, сколько парадоксов, и все разные', () => {
    const box = { window: {} };
    require('vm').createContext(box);
    require('vm').runInContext(fs.readFileSync(path.join(ROOT, 'content/paradoxes.js'), 'utf8'), box);
    const ru = box.window.PARADOX_CONTENT.ru;
    const srcs = listed();
    eq(srcs.length, ru.length, 'картинок и парадоксов поровну');
    eq(new Set(srcs).size, srcs.length, 'в списке есть повторяющиеся файлы');
    // Одинаковое содержимое под разными именами — тоже ошибка: значит, два
    // парадокса показывают одну картинку и один из них остался без своей.
    const byHash = {};
    srcs.forEach(rel => {
        const h = hash(rel);
        assert(!byHash[h], `${rel} и ${byHash[h]} — это одна и та же картинка`);
        byHash[h] = rel;
    });
});

// Картинки игры защищает слепок, и защищает только те, что в нём есть: картинку без
// слепка можно подменить под тем же именем, и ни одна проверка выше этого не заметит.
// Поэтому каждая картинка из списка — и полная, и превью — обязана в нём быть.
test('каждая картинка игры есть в слепке — и полная, и превью', () => {
    const missing = [];
    listed().forEach(rel => [rel, rel.replace('images/', 'images/thumbs/')].forEach(r => {
        if (!PRINTS[r]) missing.push(r);
    }));
    eq(missing.join(', '), '', `нет в слепке test/image-fingerprints.json: ${missing.join(', ')}`);
});

// Картинки лежат в index.html, тексты к ним — в content/paradoxes.js, и связаны они только
// номером места. Сдвинь один из двух списков на одно место — и под каждой картинкой окажется
// соседняя история. Счёт тут не поможет: картинок и карточек останется поровну. Поэтому
// пары сверяются с таблицей. Таблица — тот же слепок: меняется вместе с картинкой, осознанно.
const PAIRS = [
    ['IMG_2458', 'Тайна игрального кубика'],
    ['IMG_2454', 'Черепаха с волшебным панцирем'],
    ['IMG_2455', 'Мальчик, который не стал считать подряд'],
    ['IMG_2456', 'Ряд, который растёт в шишке'],
    ['IMG_2457', 'Сколько квадратов на шахматной доске?'],
    ['IMG_2459', 'Обратный отсчёт придумали в кино'],
    ['IMG_2460', 'Когда куча перестаёт быть кучей?'],
    ['IMG_2461', 'Куда пропала монета?'],
    ['IMG_2462', 'Десять дней, которых не было'],
    ['IMG_2463', 'Корабль Тесея'],
    ['IMG_2464', 'Лист бумаги до Луны'],
    ['IMG_2465', 'Таблица на девять — на пальцах'],
    ['IMG_2466', 'Сколько стенок у сот?'],
    ['IMG_2467', 'Обезьяна за печатной машинкой'],
    ['IMG_2468', 'Парадокс дней рождения'],
    ['IMG_2469', 'Один режет, другой выбирает'],
    ['IMG_2470', 'Почему на ноль делить нельзя?'],
    ['IMG_2471', 'Двенадцатый верблюд'],
    ['IMG_2472', 'Ахиллес и черепаха'],
    ['IMG_2473', 'Три двери']
];
test('у каждой картинки на своём месте своя карточка', () => {
    const box = { window: {} };
    require('vm').createContext(box);
    require('vm').runInContext(fs.readFileSync(path.join(ROOT, 'content/paradoxes.js'), 'utf8'), box);
    const ru = box.window.PARADOX_CONTENT.ru, srcs = listed();
    eq(srcs.length, PAIRS.length, 'картинок в игре');
    PAIRS.forEach(([file, name], i) => {
        eq(srcs[i], `images/${file}.webp`, `картинка места ${i}`);
        eq(ru[i].name, name, `карточка места ${i} (под картинкой ${file})`);
    });
});

// Новые картинки репетитора идут к ученикам потом, и тогда у них в кеше уже не должно
// оказаться ничего чужого под этими именами. Поэтому правило то же: своё имя, свой
// слепок, ни одна не совпадает с прежней — ни именем, ни содержимым. Между партиями
// список пуст — новое уже открыто всем, — и тогда проверять здесь нечего.
test('новые картинки репетитора: свои имена, в слепке, не повторяют прежние', () => {
    const prev = previewListed();
    const old = listed();
    const oldHashes = new Set(old.map(hash));
    const seen = new Set();
    prev.forEach(({ idx, src }) => {
        assert(Number.isInteger(idx) && idx >= 0 && idx < old.length, `${src}: индекса ${idx} нет среди картинок`);
        assert(old.indexOf(src) < 0, `${src} уже есть среди картинок учеников`);
        assert(!seen.has(src), `${src} повторяется`);
        seen.add(src);
        [src, src.replace('images/', 'images/thumbs/')].forEach(rel => {
            assert(PRINTS[rel], `${rel} нет в слепке test/image-fingerprints.json`);
        });
        assert(!oldHashes.has(hash(src)), `${src} — та же картинка, что одна из прежних`);
    });
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
