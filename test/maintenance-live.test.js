// ДОЕЗЖАЕТ ЛИ ОКНО РАБОТ ДО УЖЕ ОТКРЫТОГО ПРИЛОЖЕНИЯ.
//
// Заглушка написана ради тех, кто занимается В МОМЕНТ обновления. Именно им она и не
// показывалась: файл читался один раз, при загрузке страницы, а опрос раз в секунду
// перепроверял только часы. Ни переключение аккаунта, ни возврат из фона страницу не
// перезагружают — значит, про новое окно открытое приложение не узнавало никогда.
// Нашёл это Максим: поставили окно, он зашёл с двух аккаунтов и перерыва не увидел.
//
// Проверить это можно только на настоящем сервере: файл должен смениться ПОКА
// страница открыта. Поэтому здесь поднимается локальный http-сервер, отдающий папку
// проекта, а сам файл подменяется на лету — в ответе сервера, не на диске.
//
// Как запускать:  node test/maintenance-live.test.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('Playwright не установлен — проверка окна работ на лету пропущена.');
    console.log('Всего: 0, прошло: 0, упало: 0');
    process.exit(0);
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}

const ТИПЫ = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
               '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Что сервер отдаёт вместо настоящего файла работ. Меняется по ходу проверки.
let подмена = null;
let запросовФайла = 0;
let ломать = false;   // отдавать ли на файл работ ошибку — проверка «сети нет»

const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    if (clean === '/content/maintenance.js') {
        запросовФайла++;
        if (ломать) { res.writeHead(500); res.end(); return; }
        if (подмена !== null) {
            // Кешируемо — ровно как отдаёт GitHub Pages. Если бы здесь стояло
            // no-store, метка времени в адресе не проверялась бы ничем: браузер и так
            // ходил бы за файлом каждый раз, и подсадка «убрать метку» прошла бы мимо.
            res.writeHead(200, { 'Content-Type': ТИПЫ['.js'], 'Cache-Control': 'max-age=600' });
            res.end(подмена);
            return;
        }
    }
    const file = path.join(ROOT, clean === '/' ? 'index.html' : clean);
    fs.readFile(file, (e, data) => {
        if (e) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': ТИПЫ[path.extname(file)] || 'text/plain' });
        res.end(data);
    });
});

const файлСокном = (isoUntil) =>
    `window.MAINTENANCE = { until: ${isoUntil === null ? 'null' : "'" + isoUntil + "'"},\n` +
    `    note: { ru: 'Проверка', en: 'Test', fr: 'Test', de: 'Test' } };\n`;

(async () => {
    await new Promise(r => server.listen(8124, r));
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });

    // Открываем приложение БЕЗ работ — как ученик, который сел заниматься.
    подмена = файлСокном(null);
    await page.goto('http://127.0.0.1:8124/index.html');
    await page.waitForFunction(`typeof renderMaintenance === 'function'`);
    await page.evaluate(`playAsGuest(); null;`);
    await page.waitForTimeout(300);

    const виден = () => page.evaluate(
        `getComputedStyle(document.getElementById('maintenanceScreen')).display !== 'none'`);
    const until = () => page.evaluate(`(window.MAINTENANCE || {}).until || null`);

    console.log('\nОкно работ доезжает до открытого приложения');
    {
        record('пока работ нет, заглушки нет', await виден() ? 'заглушка показалась без работ' : null);

        // Работы объявлены УЖЕ ПОСЛЕ того, как страница открылась.
        подмена = файлСокном(new Date(Date.now() + 12 * 60000).toISOString());
        const было = запросовФайла;
        errors.length = 0;

        // Ждём, пока приложение само сходит за файлом. Раз в минуту — ждать столько
        // в проверке нельзя, поэтому зовём тот же путь, каким ходит возврат из фона.
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(700);

        record('приложение сходило за файлом заново',
               запросовФайла > было ? null : 'файл не перезапрашивался');
        record('новое окно доехало',
               await until() ? null : 'window.MAINTENANCE не обновился');
        record('заглушка появилась сама, без перезагрузки',
               await виден() ? null : 'страница открыта, работы идут, а заглушки нет');
        record('перечитывание прошло без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nОкончание работ тоже доезжает');
    {
        подмена = файлСокном(null);
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(700);
        record('заглушка ушла сама', await виден() ? 'заглушка осталась после конца работ' : null);
    }

    console.log('\nВозврат из фона');
    {
        // Ровно тот случай, на котором всё и вскрылось. На телефоне приложение из фона
        // ВОЗВРАЩАЕТСЯ, а не запускается заново: страница та же, скрипты те же. Если
        // за это время объявили работы, узнать о них можно только здесь.
        //
        // Спрятать вкладку по-настоящему headless-браузер не умеет (проверено тремя
        // способами в test/pause.test.js), поэтому подменяется само свойство
        // document.visibilityState и рассылается настоящее событие.
        подмена = файлСокном(null);
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(600);
        record('перед проверкой работ нет', await виден() ? 'заглушка уже показана' : null);

        const свернуть = (сост) => page.evaluate(`
            Object.defineProperty(document, 'visibilityState',
                { configurable: true, value: '${сост}' });
            document.dispatchEvent(new Event('visibilitychange')); null;`);

        await свернуть('hidden');
        // Работы объявлены, пока экран был выключен.
        подмена = файлСокном(new Date(Date.now() + 12 * 60000).toISOString());
        const было = запросовФайла;
        await свернуть('visible');
        await page.waitForTimeout(900);
        record('возврат из фона идёт за файлом',
               запросовФайла > было ? null : 'вернулись в приложение, а файл не перечитан');
        record('заглушка появилась после возврата',
               await виден() ? null : 'работы идут, приложение вернулось, а заглушки нет');
        подмена = файлСокном(null);
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(600);
    }

    console.log('\nНачатую миссию не рвём');
    {
        // Правило, которое Максим подтвердил отдельно: заглушка ждёт конца миссии.
        await page.evaluate(`
            exampleConfig.category='integer'; exampleConfig.numberType='positive';
            exampleConfig.operations={add:1}; Progress.setConfig(exampleConfig);
            document.getElementById('configScreen').style.display='none'; startGame(); null;`);
        await page.waitForTimeout(300);
        подмена = файлСокном(new Date(Date.now() + 12 * 60000).toISOString());
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(700);
        record('окно доехало и во время миссии', await until() ? null : 'файл не обновился');
        record('но миссию не прервало', await виден() ? 'заглушка накрыла идущую миссию' : null);
        // А как только миссия кончилась — показывается.
        await page.evaluate(`finishChallenge(); renderMaintenance(); null;`);
        await page.waitForTimeout(300);
        record('после конца миссии заглушка появляется',
               await виден() ? null : 'миссия кончилась, а заглушки нет');
    }

    console.log('\nПропавшая сеть не ломает игру');
    {
        подмена = файлСокном(null);
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(500);
        errors.length = 0;
        // Файл отдаёт ошибку — приложение обязано остаться с тем, что знало.
        // Ломаем на стороне сервера, а не перехватом маршрута: запрос идёт через
        // service worker, и перехват до него может не дойти — тогда проверка молчала бы.
        ломать = true;
        const дозапроса = запросовФайла;
        await page.evaluate(`reloadMaintenanceFile(); null;`);
        await page.waitForTimeout(800);
        ломать = false;
        record('приложение всё же сходило за файлом',
               запросовФайла > дозапроса ? null : 'запроса не было — проверять нечего');
        record('не упало от недоступного файла', errors.length ? errors.join(' | ') : null);
        record('игра не заперлась сама собой',
               await виден() ? 'заглушка появилась из-за оборвавшейся сети' : null);
    }

    await b.close();
    server.close();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
