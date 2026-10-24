// БЛОК «ЧТОБЫ ОТКРЫТЬ N★» в карточке клетки на экране достижений.
// В живом браузере: карточку собирает настоящая buildLadderCard.
//
// Раньше под лесенками стояла одна строка «До 2★: точность 90% и 100 верных» —
// без того, сколько уже есть, и без того, почему при «95%» звезды всё нет. Теперь
// там две полоски — точность и верные, — и у каждой сказано «есть», «сейчас» или
// «ещё столько». Здесь проверяется, что блок говорит правду о воротах:
//   - числа взяты у самих ворот (золото: ACCURACY_TIERS, COUNT_TIERS), а не вписаны;
//   - «хватает» при малой выборке объяснено строкой про LADDER_MIN_SAMPLE;
//   - взятое отмечено как взятое, и полоска полная;
//   - блока нет там, где звезда уже открыта, и на последней звезде;
//   - о скорости сказано, что на звезду она не влияет.
//
// Как запускать:  node test/next-star.test.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');

let passed = 0, failed = 0;
const failures = [];
function record(name, err) {
    if (err) { failed++; failures.push({ name, message: err }); console.log(`  ✗ ${name}\n      ${err}`); }
    else { passed++; console.log(`  ✓ ${name}`); }
}
async function check(name, fn) { try { await fn(); record(name, null); } catch (e) { record(name, e.message); } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, what) { assert(a === b, `${what}: ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)}`); }
function finish() {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Всего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
    if (failed) { failures.forEach(f => console.log(`  • ${f.name}\n    ${f.message}`)); process.exit(1); }
}

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
    console.log('Playwright не установлен — живые проверки блока «Чтобы открыть N★» пропущены.');
    finish();
    process.exit(0);
}

(async () => {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/content/maintenance.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript',
                                                                    body: 'window.MAINTENANCE={until:null,note:null};' }));
    await page.addInitScript(() => { try { localStorage.setItem('mathCitadelLang_v1', 'ru'); } catch (e) {} });
    await page.goto(FILE);
    await page.waitForFunction(`typeof buildLadderCard === 'function' && typeof renderMaintenance === 'function'`);
    await page.evaluate(`window.MAINTENANCE = { until: null }; renderMaintenance(); null`);

    // Пороги ворот — из самого приложения: тест не должен знать чисел наизусть.
    const G = await page.evaluate(`({ acc: ACCURACY_TIERS[LEVEL_GATE_TIER - 1], cnt: COUNT_TIERS[LEVEL_GATE_TIER - 1],
                                      sample: LADDER_MIN_SAMPLE[LEVEL_GATE_TIER - 1], gate: LEVEL_GATE_TIER })`);

    // Карточка клетки по готовому состоянию. right/wrong — ответы последних дней
    // (из них считается точность), lifetime — верных за всё время (количество).
    // Ступени — прямо в unlocks: здесь проверяется карточка, а не выдача медалей.
    const card = (key, { right = 0, wrong = 0, lifetime = right, tiers = {} } = {}) => page.evaluate(`(() => {
        const key = ${JSON.stringify(key)};
        const day = Progress.dayKey();
        const st = { daily: {}, byTopic: {} };
        if (${right + wrong} > 0) {
            st.daily[day] = { c: ${right}, w: ${wrong}, s: 0, p: 0, ms: 0, mc: 0, t: { [key]: [${right}, ${wrong}, 0, 0, 0, 0, 0] }, e: {}, te: {} };
            st.byTopic[key] = { correct: ${lifetime}, wrong: ${wrong} };
        }
        const unlocks = {};
        Object.entries(${JSON.stringify(tiers)}).forEach(([l, n]) => {
            for (let i = 1; i <= n; i++) unlocks[key + ':' + l + i] = '2026-10-01';
        });
        const c = buildLadderCard(st, unlocks, key);
        const foot = c.querySelector('.ladder-league');
        return {
            next: foot.classList.contains('next-star'),
            foot: foot.innerText,
            head: (foot.querySelector('.next-star-head') || {}).innerText || null,
            rows: [...foot.querySelectorAll('.next-star-row')].map(r => ({
                done: r.classList.contains('done'),
                icon: r.querySelector('.ns-icon').innerText,
                name: r.querySelector('.ns-name').innerText,
                text: r.querySelector('.ns-text').innerText,
                bar: r.querySelector('.ns-bar i').style.width
            })),
            notes: [...foot.querySelectorAll('.next-star-note')].map(n => n.innerText)
        };
    })()`);
    const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100) + '%';

    console.log('\nНичего ещё не решено');
    let v = await card('integer+:add:1');
    await check('блок на месте и называет следующую звезду', () => {
        assert(v.next, `вместо блока: ${v.foot}`);
        eq(v.head, 'Чтобы открыть 2★', 'заголовок');
    });
    await check('две строки: сначала точность, потом верные', () => {
        eq(v.rows.map(r => r.name).join(' / '), 'Точность / Верных', 'строки');
        eq(v.rows.map(r => r.icon).join(''), '🎯🔢', 'значки — те же, что у лесенок');
    });
    await check('без ответов точность не выдумывается: только сколько нужно', () => {
        eq(v.rows[0].text, `нужно ${G.acc}%`, 'точность');
        eq(v.rows[0].bar, '0%', 'полоска точности');
    });
    await check('верных — сколько есть, сколько надо и сколько осталось', () => {
        eq(v.rows[1].text, `0 из ${G.cnt} — ещё ${G.cnt}`, 'верные');
        eq(v.rows[1].bar, '0%', 'полоска верных');
    });
    await check('о скорости сказано, что на звезду она не влияет', () => {
        assert(v.notes.some(n => /Скорость на звезду не влияет/.test(n)), JSON.stringify(v.notes));
    });

    console.log('\nТочность ниже золота');
    v = await card('integer+:sub:1', { right: 30, wrong: 10 });     // 75%, 30 верных
    await check('строка говорит «сейчас» и «нужно», полоска — доля пути', () => {
        eq(v.rows[0].text, `сейчас 75%, нужно ${G.acc}%`, 'точность');
        eq(v.rows[0].bar, pct(75 / G.acc), 'полоска точности');
        assert(!v.rows[0].done, 'не взятое отмечено взятым');
    });
    await check('верные: 30 из сотни, полоска на 30%', () => {
        eq(v.rows[1].text, `30 из ${G.cnt} — ещё ${G.cnt - 30}`, 'верные');
        eq(v.rows[1].bar, pct(30 / G.cnt), 'полоска верных');
    });
    await check('оговорки про выборку при низкой точности нет', () => {
        assert(!v.notes.some(n => /засчитается/.test(n)), JSON.stringify(v.notes));
    });

    console.log('\nТочности хватает, верных мало');
    v = await card('integer+:mul:1', { right: 57, wrong: 3 });       // 95%, 57 верных
    await check('точность «хватает», но не «есть»: ступени ещё нет', () => {
        eq(v.rows[0].text, '95% — хватает ✓', 'точность');
        eq(v.rows[0].bar, '100%', 'полоска точности');
        assert(!v.rows[0].done, 'точность отмечена взятой, а ступени нет');
    });
    await check('и сказано, когда она засчитается — по числу верных', () => {
        assert(v.notes.some(n => n === `Точность засчитается, когда верных станет ${G.sample}.`),
            `нет строки про выборку: ${JSON.stringify(v.notes)}`);
    });

    console.log('\nТочности хватает и верных достаточно, ступень запишется со следующим ответом');
    v = await card('integer+:div:1', { right: 95, wrong: 5, lifetime: G.sample + 20 });
    await check('«хватает» без оговорки про выборку: выборка уже есть', () => {
        eq(v.rows[0].text, '95% — хватает ✓', 'точность');
        assert(!v.notes.some(n => /засчитается/.test(n)), `лишняя оговорка: ${JSON.stringify(v.notes)}`);
    });

    console.log('\nОдно из двух уже взято');
    v = await card('integer+:add:2', { right: 80, wrong: 8, tiers: { a: G.gate } });
    await check('взятая точность — «есть ✓», полоска полная и зелёная', () => {
        eq(v.rows[0].text, `${G.acc}% — есть ✓`, 'точность');
        assert(v.rows[0].done, 'взятая точность не отмечена');
        eq(v.rows[0].bar, '100%', 'полоска');
    });
    await check('верные при этом ещё в пути', () => {
        eq(v.rows[1].text, `80 из ${G.cnt} — ещё ${G.cnt - 80}`, 'верные');
        assert(!v.rows[1].done, 'не взятое количество отмечено');
    });
    v = await card('integer+:sub:2', { right: 120, wrong: 40, tiers: { c: G.gate } });
    await check('взятое количество — «есть ✓», без счётчика «ещё»', () => {
        eq(v.rows[1].text, `${G.cnt} — есть ✓`, 'верные');
        assert(v.rows[1].done, 'взятое количество не отмечено');
        eq(v.head, 'Чтобы открыть 3★', 'звезда в заголовке — следующая за клеткой');
    });

    console.log('\nГде блока быть не должно');
    v = await card('integer+:mul:2', { right: 100, wrong: 5, tiers: { a: G.gate, c: G.gate } });
    await check('ворота пройдены — вместо полосок строка об открытой звезде', () => {
        assert(!v.next && v.rows.length === 0, `блок остался при пройденных воротах: ${v.foot}`);
        assert(/3★/.test(v.foot), `строка не называет звезду: ${v.foot}`);
    });
    v = await card('integer+:mul:5', { right: 40, wrong: 10 });
    await check('на последней звезде открывать нечего', () => {
        assert(!v.next && v.rows.length === 0, `на 5★ обещана 6★: ${v.foot}`);
    });

    await check('всё это прошло без ошибок в консоли', () => {
        eq(errors.join(' | '), '', 'ошибки');
    });

    await b.close();
    finish();
})().catch(e => { console.error(e); process.exit(1); });
