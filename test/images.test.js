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
    const back = gone.filter(rel => listed().indexOf(rel) >= 0);
    eq(back.join(', '), '', `имена вернулись в игру после того, как ушли: ${back.join(', ')}`);
});

test('каждая картинка из списка лежит на диске — и полная, и превью', () => {
    const lost = [];
    listed().forEach(rel => {
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

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
