// ТРИ ДВЕРИ: вход, регистрация, игра без аккаунта — и то, куда они приводят.
//
// Зачем этот файл. Обе двери прятали свой экран и НАДЕЯЛИСЬ, что под ним лежит выбор
// миссии. При первом запуске так и было. Но выход из профиля (finishLogout) прячет все
// .modal-screen, а configScreen — один из них. После выхода дверь открывалась в пустоту:
// голый игровой слой с надписью «Загрузка…» и без единой кнопки. Именно это Максим
// дважды описал словом «виснет», и ни одна проверка этого не видела — прежние прогоны
// сами ставили configScreen в display:flex перед замером и потому мерили свою же
// подпорку, а не приложение.
//
// Отсюда правило этого файла: НИЧЕГО НЕ ПОКАЗЫВАТЬ РУКАМИ. Экраны здесь открываются
// только теми же функциями и кнопками, что и у человека.
//
// Как запускать:  node test/auth-doors.test.js

const path = require('path');
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('Playwright не установлен — проверка дверей пропущена.');
    console.log('Всего: 0, прошло: 0, упало: 0');
    process.exit(0);
}

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));

    // Язык фиксируем: кнопки ищутся по onclick, но сообщения об ошибках читать удобнее
    // на том же языке, на котором написан этот файл.
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof Progress !== 'undefined' && typeof playAsGuest === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();`);

    // Что видно прямо сейчас. Вычисленный стиль, а не inline: у configScreen при первом
    // запуске style.display пустой, display ему задаёт класс.
    const seen = () => page.evaluate(`(() => {
        const v = id => getComputedStyle(document.getElementById(id)).display !== 'none';
        return { вход: v('codeScreen'), регистрация: v('registerScreen'),
                 выбор: v('configScreen'), профиль: v('profileScreen') };
    })()`);

    // Состояние человека, который вышел из своего аккаунта. Зовём ту же finishLogout,
    // что и кнопка выхода: именно она гасит все экраны.
    const afterLogout = () => page.evaluate(`
        Progress.logout();
        Progress.switchTo('TUTOR', 'password1');
        Progress.logout();
        finishLogout(); null;`);

    console.log('\nПосле выхода из профиля');
    {
        await afterLogout();
        const s = await seen();
        record('виден экран входа', s.вход ? null : 'экрана входа нет');
        record('выбор миссии спрятан выходом', s.выбор ? 'выбор миссии остался открытым' : null);
    }

    console.log('\nДверь «Играть без регистрации»');
    {
        await afterLogout();
        errors.length = 0;
        // Настоящее нажатие по настоящей кнопке — никаких прямых вызовов.
        // Ищем по onclick, а не по подписи: подпись переводится, дверь — нет.
        const clicked = await page.evaluate(`(() => {
            const b = document.querySelector('#codeScreen button[onclick*="playAsGuest"]');
            if (!b) return false; b.click(); return true; })()`);
        await page.waitForTimeout(250);
        const s = await seen();
        record('кнопка на экране входа есть', clicked ? null : 'кнопки «Играть без регистрации» нет');
        record('гость попадает на выбор миссии, а не в пустоту',
               s.выбор ? null : 'ни одного экрана не видно — это и есть «зависло на Загрузка…»');
        record('экран входа закрылся', s.вход ? 'экран входа остался поверх' : null);
        record('переход прошёл без ошибок', errors.length ? errors.join(' | ') : null);
        record('это правда гость', await page.evaluate(`Progress.isGuest()`) ? null : 'гость не завёлся');
    }

    console.log('\nДверь «Вход» после выхода');
    {
        await afterLogout();
        errors.length = 0;
        // Сервера в проверке нет — подменяем ровно один вызов, ответ сервера. Всё, что
        // после него, остаётся настоящим: именно там и была поломка.
        await page.evaluate(`(async () => {
            // Присваиваем саму переменную, а не window.supabaseClient: она объявлена
            // через let в общей области видимости скриптов и свойством window не является.
            supabaseClient = { rpc: async () => ({ data: { ok: true, token: 'x'.repeat(64),
                                                           state: null }, error: null }) };
            document.getElementById('codeInputField').value = 'MASHA1';
            document.getElementById('passwordInputField').value = 'password1';
            await loginWithExistingCode();
        })()`);
        await page.waitForTimeout(250);
        const s = await seen();
        record('вошедший попадает на выбор миссии',
               s.выбор ? null : 'после входа не видно ни одного экрана');
        record('вход прошёл без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nДверь «Создать аккаунт»');
    {
        await afterLogout();
        errors.length = 0;
        await page.evaluate(`openRegisterScreen(); null;`);
        await page.waitForTimeout(150);
        let s = await seen();
        record('регистрация открывается', s.регистрация ? null : 'экран регистрации не показался');

        // Кнопка «назад». Ссылки «У меня уже есть аккаунт» внизу не хватало: она читается
        // как «войти», а не как «отмена».
        const back = await page.evaluate(`(() => {
            const b = document.querySelector('#registerScreen .start-menu-btn');
            if (!b) return null; b.click(); return b.getAttribute('aria-label'); })()`);
        await page.waitForTimeout(200);
        s = await seen();
        record('на регистрации есть кнопка «назад»', back ? null : 'кнопки назад нет');
        record('отмена со входа возвращает на вход',
               s.вход ? null : 'после отмены не видно ни одного экрана');
        record('отмена не оставляет форму открытой', s.регистрация ? 'форма осталась' : null);
    }

    console.log('\nАккаунт создан');
    {
        await afterLogout();
        errors.length = 0;
        await page.evaluate(`(async () => {
            supabaseClient = { rpc: async () => ({ data: { ok: true, token: 'x'.repeat(64) }, error: null }) };
            openRegisterScreen();
            document.getElementById('regCodeField').value = 'MASHA1';
            document.getElementById('regPasswordField').value = 'password1';
            onRegisterInput();
            await doRegister();
        })()`);
        await page.waitForTimeout(300);
        const s = await seen();
        // Тот же провал, что у гостя, только по другой двери: выход спрятал выбор миссии,
        // регистрация спрятала себя и вход — и показать было уже нечего.
        record('новый игрок попадает на выбор миссии',
               s.выбор ? null : 'после регистрации не видно ни одного экрана');
        record('форма закрылась', s.регистрация ? 'форма осталась' : null);
        record('на вход не возвращает', s.вход ? 'показался экран входа' : null);
        record('регистрация прошла без ошибок', errors.length ? errors.join(' | ') : null);
        record('аккаунт завёлся',
               await page.evaluate(`Progress.getCode()`) === 'MASHA1' ? null : 'логин не сохранился');
    }

    console.log('\nСохранить прогресс из профиля');
    {
        // Кнопка «Сохранить прогресс» стоит в профиле — именно оттуда Максим и пошёл
        // заводить аккаунт. Отмена обязана вернуть профиль, а не выбор миссии.
        await afterLogout();
        await page.evaluate(`
            playAsGuest();
            renderProfileScreen();
            document.getElementById('profileScreen').style.display = 'flex';
            openRegisterScreen(); null;`);
        await page.waitForTimeout(150);
        let s = await seen();
        record('профиль прячется под формой', s.профиль ? 'профиль остался под регистрацией' : null);
        errors.length = 0;
        await page.evaluate(`document.querySelector('#registerScreen .start-menu-btn').click(); null;`);
        await page.waitForTimeout(200);
        s = await seen();
        record('отмена возвращает в профиль', s.профиль ? null : 'профиль не вернулся');
        record('возврат прошёл без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nГость передумал заводить аккаунт');
    {
        await afterLogout();
        await page.evaluate(`playAsGuest(); openRegisterScreen(); null;`);
        await page.waitForTimeout(150);
        errors.length = 0;
        await page.evaluate(`document.querySelector('#registerScreen .start-menu-btn').click(); null;`);
        await page.waitForTimeout(200);
        const s = await seen();
        // Раньше здесь не показывалось НИЧЕГО: у гостя код есть, значит «он уже вошёл»,
        // значит на вход не возвращаем — и человек оставался без единого экрана.
        record('гость возвращается в игру, а не в пустоту',
               s.выбор ? null : 'после отмены не видно ни одного экрана');
        record('гостя не выбрасывает на экран входа', s.вход ? 'показался экран входа' : null);
        record('гость остался гостем',
               await page.evaluate(`Progress.isGuest()`) ? null : 'гость потерялся');
        record('отмена прошла без ошибок', errors.length ? errors.join(' | ') : null);
    }

    console.log('\nПриглашение завести аккаунт посреди миссии');
    {
        // Гостю предлагают сохранить прогресс после собранной картинки — то есть прямо
        // во время миссии. Отмена обязана вернуть миссию, а не выбросить на выбор:
        // иначе просьба сохраниться отнимала бы то, ради чего человек играл.
        await afterLogout();
        await page.evaluate(`
            playAsGuest();
            document.getElementById('configScreen').style.display = 'none';  // так делает сама игра, начиная миссию
            openRegisterScreen(); null;`);
        await page.waitForTimeout(150);
        await page.evaluate(`document.querySelector('#registerScreen .start-menu-btn').click(); null;`);
        await page.waitForTimeout(200);
        const s = await seen();
        record('отмена не выбрасывает из миссии на выбор',
               s.выбор ? 'вместо миссии показался выбор миссии' : null);
        record('форма закрылась', s.регистрация ? 'форма осталась' : null);
    }

    await b.close();
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
})();
