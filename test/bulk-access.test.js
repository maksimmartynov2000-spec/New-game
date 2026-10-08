// Тесты «Открыть нескольким» — выдачи доступа сразу нескольким ученикам.
//
// Главное обещание этой кнопки: она только ДОБАВЛЯЕТ. У каждого ученика своё уже
// открытое, и выдача сразу нескольким не имеет права закрыть ни одной звезды ни у
// кого. Поэтому основная проверка здесь — не на примерах, а на тысячах случайных
// сочетаний «что было открыто» × «что отметили»: ни одна клетка не стала закрытее,
// а всё, что открыть не удалось, названо репетитору.
//
// Тонкость, из-за которой нельзя было просто сложить отметки. У открытого две
// формы: 'all' — «открыто, звёзды за золото», и список — «эти звёзды в обход
// золота». Полная строка в сетке — это 'all', и сложение через сетку молча
// превращало бы звёзды в обход золота в звёзды за золото.
//
// Как запускать:  node test/bulk-access.test.js
// Живая часть нужна Playwright и браузер в /opt/pw-browsers/chromium.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
function check(name, fn) {
    try { fn(); record(name, null); } catch (e) { record(name, e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
const J = (x) => JSON.stringify(x);

// ---------- срез: addToGrant и то, на чём она стоит ----------
function slice(name) {
    const at = HTML.indexOf(`function ${name}(`);
    if (at < 0) throw new Error(`в index.html нет функции ${name}`);
    const end = HTML.indexOf('\n        function ', at + 1);
    return HTML.slice(at, end);
}
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(`const BASE_SECTION = 'integer+';\n`
    + slice('grantFromPicks') + '\n' + slice('grantOpOf') + '\n' + slice('addToGrant')
    + '\n;globalThis.addToGrant = addToGrant; globalThis.grantFromPicks = grantFromPicks;', ctx);
const { addToGrant } = ctx;

const OPS4 = ['add', 'sub', 'mul', 'div'];
const OPS8 = ['add', 'sub', 'mul', 'div', 'simplify', 'toMixed', 'toImproper', 'fracOfNumber'];
const NEG = { key: 'integer-', ops: OPS4 };
const POS = { key: 'integer+', ops: OPS4 };
const FRAC = { key: 'fraction+', ops: OPS8 };

// Отметки в сетке: 'add:1' → true.
function picksOf(cells) { const p = {}; cells.forEach(c => { p[c] = true; }); return p; }
function row(op) { return [1, 2, 3, 4, 5].map(i => `${op}:${i}`); }
function whole(sec) { return sec.ops.flatMap(row); }

// Насколько открыта клетка — так, как её видит приложение у ученика:
// 0 — закрыта, 1 — открыта, но за золото, 2 — открыта в обход золота.
function openness(sec, grant, op, level) {
    if (sec.key === 'integer+') {
        // Раздел открыт всем; поимённо — только звезда из списка. Сырое 'all'
        // приложение поимённым не считает.
        const v = grant && typeof grant === 'object' ? grant[op] : null;
        return Array.isArray(v) && v.indexOf(level) >= 0 ? 2 : 1;
    }
    if (grant === 'all') return 1;
    if (!grant || typeof grant !== 'object') return 0;
    const v = grant[op];
    if (v === 'all') return 1;
    return Array.isArray(v) && v.indexOf(level) >= 0 ? 2 : 0;
}

// Та же проверка формы, что делает сервер (valid_grant в access-codes.sql).
function validGrant(g, sec) {
    if (g === 'all') return true;
    if (!g || typeof g !== 'object' || Array.isArray(g)) return false;
    const keys = Object.keys(g);
    if (!keys.length) return false;
    return keys.every(k => sec.ops.indexOf(k) >= 0 && (g[k] === 'all'
        || (Array.isArray(g[k]) && g[k].length && g[k].every(n => [1, 2, 3, 4, 5].indexOf(n) >= 0))));
}

console.log('Примеры');

check('ничего не было — раздел целиком открывается целиком', () => {
    const r = addToGrant(NEG, null, picksOf(whole(NEG)));
    assert(r.changed && r.grant === 'all', `получилось ${J(r)}`);
});

check('раздел уже открыт целиком — записывать нечего', () => {
    const r = addToGrant(NEG, 'all', picksOf(whole(NEG)));
    assert(!r.changed && r.grant === 'all' && !r.skipped.length, `получилось ${J(r)}`);
});

check('звёзды в обход золота не превращаются в звёзды за золото', () => {
    // Ученику открыли сложение до 3★ без золота. Теперь «весь раздел всем».
    const r = addToGrant(NEG, { add: [1, 2, 3] }, picksOf(whole(NEG)));
    assert(r.changed, 'остальные действия не открылись');
    assert(J(r.grant.add) === J([1, 2, 3]), `сложение стало ${J(r.grant.add)} — 2★ и 3★ ушли за золото`);
    assert(r.grant.sub === 'all' && r.grant.mul === 'all' && r.grant.div === 'all', `остальное: ${J(r.grant)}`);
    assert(J(r.skipped) === J([{ op: 'add', why: 'named' }]), `пропуск не назван: ${J(r.skipped)}`);
});

check('списки звёзд складываются', () => {
    const r = addToGrant(NEG, { add: [1, 2], mul: 'all' }, picksOf(['add:3']));
    assert(r.changed && J(r.grant) === J({ add: [1, 2, 3], mul: 'all' }), `получилось ${J(r.grant)}`);
});

check('уже открыто целиком — звёзды в обход золота не добавить, и это названо', () => {
    const r = addToGrant(NEG, 'all', picksOf(['add:1', 'add:2']));
    assert(!r.changed && r.grant === 'all', `получилось ${J(r)}`);
    assert(J(r.skipped) === J([{ op: 'add', why: 'gated' }]), `пропуск не назван: ${J(r.skipped)}`);
});

check('на первой звезде ворот нет — и пропуска нет', () => {
    const r = addToGrant(NEG, 'all', picksOf(['add:1']));
    assert(!r.changed && !r.skipped.length, `получилось ${J(r)}`);
});

check('все пять звёзд в обход золота больше, чем «целиком» — не пропуск', () => {
    const r = addToGrant(NEG, { add: [1, 2, 3, 4, 5] }, picksOf(row('add')));
    assert(!r.changed && !r.skipped.length, `получилось ${J(r)}`);
});

check('положительные: звёзды добавляются к своим, чужие действия не трогаются', () => {
    const r = addToGrant(POS, { add: [1, 2], div: [4] }, picksOf(['add:3', 'mul:2']));
    assert(r.changed && J(r.grant) === J({ add: [1, 2, 3], mul: [2], div: [4] }), `получилось ${J(r.grant)}`);
});

check('положительные: старое сырое «всё» разворачивается в пять звёзд, как это делает сервер', () => {
    // Приложение сырое «всё» поимённым не считает: у ребёнка 3★ оставалась за золотом.
    const r = addToGrant(POS, 'all', picksOf(['add:3']));
    const five = [1, 2, 3, 4, 5];
    assert(r.changed, 'не записано — звезда так и осталась за золотом');
    assert(J(r.grant) === J({ add: five, sub: five, mul: five, div: five }), `получилось ${J(r.grant)}`);
});

check('положительные: всё отмеченное уже названо — записывать нечего', () => {
    const r = addToGrant(POS, { add: [1, 2, 3] }, picksOf(['add:2', 'add:3']));
    assert(!r.changed && J(r.grant) === J({ add: [1, 2, 3] }), `получилось ${J(r)}`);
});

check('ничего не отмечено — ничего не меняется', () => {
    const r = addToGrant(NEG, { add: [2] }, {});
    assert(!r.changed && J(r.grant) === J({ add: [2] }), `получилось ${J(r)}`);
});

console.log('\nСлучайные сочетания: только добавляет, и всё несделанное названо');

// Детерминированный генератор: упавший случай воспроизводится.
let seed = 20261008;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
function randomGrant(sec) {
    const x = rnd();
    if (x < 0.15) return null;
    if (x < 0.25) return 'all';
    const g = {};
    sec.ops.forEach(op => {
        const y = rnd();
        if (y < 0.45) return;
        if (y < 0.6) { g[op] = 'all'; return; }
        const lv = [1, 2, 3, 4, 5].filter(() => rnd() < 0.5);
        if (lv.length) g[op] = rnd() < 0.3 ? lv.reverse() : lv;   // бывают и неупорядоченные
    });
    return Object.keys(g).length ? g : null;
}
function randomPicks(sec) {
    const x = rnd();
    if (x < 0.15) return picksOf(whole(sec));
    if (x < 0.35) return picksOf(sec.ops.filter(() => rnd() < 0.4).flatMap(row));
    return picksOf(whole(sec).filter(() => rnd() < 0.25));
}

check('3000 случаев: ни одна клетка не закрылась, всё неоткрытое названо, сервер примет', () => {
    for (let n = 0; n < 3000; n++) {
        const sec = [NEG, POS, FRAC][n % 3];
        const before = randomGrant(sec);
        const picks = randomPicks(sec);
        const asked = ctx.grantFromPicks(sec, picks);
        const r = addToGrant(sec, before, picks);
        const why = (op) => (r.skipped.find(x => x.op === op) || {}).why;
        const where = `случай ${n}: ${sec.key}, было ${J(before)}, отмечено ${J(Object.keys(picks))}, стало ${J(r.grant)}, пропуски ${J(r.skipped)}`;
        if (r.changed) assert(validGrant(r.grant, sec), 'сервер не примет: ' + where);
        else assert(J(r.grant) === J(before || null), 'ничего не менялось, а разрешение другое: ' + where);
        sec.ops.forEach(op => [1, 2, 3, 4, 5].forEach(level => {
            const was = openness(sec, before, op, level);
            const now = openness(sec, r.grant, op, level);
            const want = asked ? openness(sec, asked, op, level) : 0;
            assert(now >= was, `закрылось ${op} ${level}★ (${was}→${now}) — ${where}`);
            if (now >= want) return;
            // Не открылось то, что просили, — это обязано быть в пропусках.
            if (now === 0) assert(why(op) === 'named', `${op} ${level}★ не открыт и не назван — ${where}`);
            else if (level >= 2) assert(why(op) === 'gated', `${op} ${level}★ за золотом и не назван — ${where}`);
        }));
    }
});

// ---------- живой прогон ----------
(async () => {
    let chromium = null;
    try { ({ chromium } = require('playwright')); } catch (e) { /* нет — пропускаем */ }
    if (!chromium) { console.log('\nPlaywright не установлен — живой прогон пропущен.'); return finish(); }

    console.log('\nЖивой прогон: репетитор открывает отрицательные трём ученикам');
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));

    // Подставной сервер: доступ учеников в памяти. У PETYA сложение до 3★ в обход
    // золота, у OLYA раздел уже открыт целиком, у KOLYA запись не проходит.
    const server = {
        access: {
            MASHA: {},
            PETYA: { 'integer-': { add: [1, 2, 3] }, 'integer+': { mul: [2] } },
            OLYA: { 'integer-': 'all' },
            KOLYA: {},
            VANYA: {}
        },
        writes: []
    };
    await page.route('**/rest/v1/rpc/*', async r => {
        const fn = r.request().url().split('/rpc/')[1];
        const body = JSON.parse(r.request().postData() || '{}');
        let out = { ok: true };
        if (fn === 'session_list_students') {
            out = { ok: true, students: Object.keys(server.access).map(code => ({ code, label: code === 'MASHA' ? 'Маша' : '' })) };
        } else if (fn === 'session_student_access') {
            out = { ok: true, access: server.access[body.p_student_code] };
        } else if (fn === 'session_set_student_access') {
            if (body.p_student_code === 'KOLYA') out = { ok: false, error: 'write_failed' };
            else {
                server.writes.push([body.p_student_code, body.p_section]);
                server.access[body.p_student_code][body.p_section] = body.p_grant;
            }
        } else if (fn === 'session_state') {
            out = { ok: true, state: {} };
        }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    });
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200,
        contentType: 'application/javascript', body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto('file://' + path.join(ROOT, 'index.html'));
    await page.waitForFunction(`typeof openBulkAccess === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance();
        Progress.switchTo('TUTOR', null, { accountType: 'self' }); Progress.setToken('TUTOR', 'tok');
        Progress.setStudentGroup('MASHA', '5 класс'); Progress.setStudentGroup('PETYA', '5 класс');
        enterApp(); null`);

    const live = async (name, fn) => { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } };
    const dlg = (sel) => page.evaluate(`[...document.querySelectorAll('#appDialogCard ${sel}')].map(x => x.innerText)`);
    const clickDlgButton = (text) => page.evaluate(`(() => { const b = [...document.querySelectorAll('#appDialogCard .dlg-btn')]
        .find(x => x.innerText.trim() === ${J(text)}); if (!b) throw new Error('нет кнопки ' + ${J(text)}); b.click(); })()`);
    const tick = (label) => page.evaluate(`(() => { const l = [...document.querySelectorAll('#appDialogCard .pick-row')]
        .find(x => x.innerText.trim().startsWith(${J(label)})); if (!l) throw new Error('нет строки ' + ${J(label)});
        l.querySelector('input').click(); })()`);

    await page.evaluate(`openBulkAccess(); null`);
    await page.waitForSelector('#appDialogCard .pick-row');

    await live('без единого ученика дальше не пускает', async () => {
        await clickDlgButton('Дальше');
        const err = await page.evaluate(`document.querySelector('#appDialogCard .dlg-err').innerText`);
        assert(/хотя бы одного/.test(err), `ошибки нет: «${err}»`);
    });
    await live('галочка у папки отмечает всю папку и только её', async () => {
        await tick('📁 5 класс');
        const on = await page.evaluate(`[...document.querySelectorAll('#appDialogCard .pick-row:not(.pick-head)')]
            .filter(x => x.querySelector('input').checked).map(x => x.innerText.trim().split(/\\s+/)[0])`);
        assert(J(on.sort()) === J(['PETYA', 'Маша']), `отмечены: ${J(on)}`);
    });
    await live('выданное открывается только отмеченным', async () => {
        await tick('OLYA');
        await tick('KOLYA');
        await clickDlgButton('Дальше');
        await page.waitForSelector('#appDialogCard .grant-grid');
        // Вкладка отрицательных и «всё» — весь раздел.
        await page.evaluate(`[...document.querySelectorAll('#appDialogCard .grant-sec')].find(x => /Отрицательные/.test(x.innerText)).click()`);
        await page.evaluate(`document.querySelector('#appDialogCard .grant-corner').click()`);
        await clickDlgButton('Открыть');
        await page.waitForFunction(`[...document.querySelectorAll('#appDialogCard .dlg-btn')].some(x => x.innerText.trim() === 'Понятно')`, null, { timeout: 8000 });
        assert(J(server.access.MASHA['integer-']) === J('all'), `Маше: ${J(server.access.MASHA)}`);
        assert(!server.access.VANYA['integer-'], 'открылось неотмеченному');
    });
    await live('звёзды в обход золота у ученика уцелели, остальное открылось', async () => {
        const g = server.access.PETYA['integer-'];
        assert(J(g.add) === J([1, 2, 3]), `сложение у Пети стало ${J(g.add)}`);
        assert(g.sub === 'all' && g.mul === 'all' && g.div === 'all', `у Пети: ${J(g)}`);
    });
    await live('у кого уже всё открыто — ничего не записано; другие разделы не тронуты', async () => {
        assert(!server.writes.some(w => w[0] === 'OLYA'), 'Оле записали то, что у неё уже было');
        assert(!server.writes.some(w => w[1] !== 'integer-'), `записаны лишние разделы: ${J(server.writes)}`);
        assert(J(server.access.PETYA['integer+']) === J({ mul: [2] }), 'положительные у Пети изменились');
    });
    await live('итог называет и пропуск, и неудачу', async () => {
        const text = (await dlg('.dlg-text')).join('\n');
        assert(/Открыто 2 ученикам/.test(text), `нет числа открытых: ${text}`);
        assert(/У 1 ученика всё это уже было открыто/.test(text), `нет «уже было»: ${text}`);
        assert(/PETYA \(Отрицательные, сложение\)/.test(text), `пропуск у Пети не назван: ${text}`);
        assert(/Не получилось: KOLYA/.test(text), `неудача не названа: ${text}`);
    });
    await live('ошибок на странице нет', async () => { assert(!errs.length, errs.join('; ')); });

    await browser.close();
    finish();
})();

function finish() {
    console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.message}`)); process.exit(1); }
}
