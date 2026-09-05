// Статистика в картинках: календарь дней, столбики недель, спарклайны, карта
// мастерства и разбор по видам примеров.
//
// Это единственный вынесенный файл, который РИСУЕТ: внутри 91 обращение к DOM.
// При загрузке, однако, исполняются только объявления функций и таблицы данных —
// ни одного касания страницы до того, как её попросят нарисовать. Это не мелочь:
// файлы подключены в <head>, то есть в момент их исполнения <body> ещё не существует,
// и любая строка вроде getElementById(...).addEventListener здесь уронила бы
// приложение целиком, на всех экранах сразу.
//
// Честно про связанность. В отличие от js/generator.js и js/progress.js этот файл
// не самостоятелен: внутри функций он зовёт около десятка имён из index.html
// (LADDERS, TIER_ICONS, topicLadderMarks, openPuzzleModal и другие). Это работает,
// потому что все вызовы происходят уже после загрузки страницы. Убрать их до нуля
// можно было бы, только утащив сюда заодно лесенки, коллекцию и окно пазла — то есть
// половину приложения; такой обмен не стоит того.

// ===================== СТАТИСТИКА: КАРТИНКИ =====================
//  Ни одного нового поля в хранилище: всё считается из того же журнала по дням
//  и тех же byTopic, что были раньше. Меняется только то, как это показано.
// =================================================================

// --- Полоса дней ---
// Отвечает на вопрос, которого не было видно в цифрах: занимается ли регулярно.
// Пять уровней яркости, пороги от медианы активного дня, а не абсолютные:
// у одного ученика насыщенный день это 30 примеров, у другого 150, и мерить
// их одной линейкой значит одному всегда рисовать бледное, другому всегда яркое.
// Сколько примеров решено в каждый день периода. Общая заготовка для календаря,
// итогов и недельных столбиков — чтобы три вида считали по одному и тому же.
function dayCounts(daily, fromKey, toKey) {
    const out = [];
    let k = fromKey || earliestDayKey(daily) || toKey, guard = 0;
    while (k <= toKey && guard++ < 400) {
        const d = daily[k];
        out.push({ key: k, n: d ? (d.c || 0) + (d.w || 0) : 0 });
        k = shiftDayKey(k, 1);
    }
    return out;
}

// Насыщенность клетки — относительно медианы активных дней, а не максимума:
// один рекордный день иначе перекрашивает все остальные в бледное.
function dayShade(n, median) {
    if (n <= 0) return 'zero';
    if (median <= 0) return 'd3';
    const r = n / median;
    return r >= 1.5 ? 'd4' : r >= 1.0 ? 'd3' : r >= 0.5 ? 'd2' : 'd1';
}

// Три факта, по которым репетитор принимает решения. В ленте квадратиков они
// были — но считать их приходилось глазами.
function daysSummary(counts) {
    const active = counts.filter(d => d.n > 0);
    if (!active.length) return null;
    const total = active.reduce((s, d) => s + d.n, 0);
    // Перерыв считаем от ПЕРВОГО занятия, а не от начала периода: пустые дни до
    // того, как ученик начал, — это не пропуск, и записывать их в перерыв нечестно.
    const from = counts.indexOf(active[0]);
    let gap = 0, run = 0;
    for (let i = from; i < counts.length; i++) {
        if (counts[i].n > 0) run = 0;
        else { run++; if (run > gap) gap = run; }
    }
    return { activeDays: active.length, spanDays: counts.length, gap,
             perDay: Math.round(total / active.length) };
}

function pluralDaysWord(n) {
    const d100 = n % 100, d10 = n % 10;
    if (d100 >= 11 && d100 <= 14) return t('дней');
    if (d10 === 1) return t('день');
    if (d10 >= 2 && d10 <= 4) return t('дня');
    return t('дней');
}

// Календарь по неделям: столбцы Пн–Вс, строки — недели. Пропуски читаются как
// дырки в правильной решётке, а не как разрыв ленты, и сразу видно, в какие дни
// недели ученик садится за примеры.
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// Понедельник считаем первым днём недели: getDay() отдаёт воскресенье нулём.
const mondayIndex = (dateObj) => (dateObj.getDay() + 6) % 7;

function renderDayCalendar(daily, fromKey, toKey, containerId) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return 0;
    wrap.innerHTML = '';
    const counts = dayCounts(daily, fromKey, toKey);
    if (!counts.length) return 0;

    const byKey = {};
    counts.forEach(d => { byKey[d.key] = d.n; });
    const active = counts.filter(d => d.n > 0).map(d => d.n).sort((a, b) => a - b);
    const median = active.length ? active[Math.floor(active.length / 2)] : 0;

    const grid = document.createElement('div');
    grid.className = 'day-cal';
    WEEKDAY_SHORT.forEach(w => {
        const h = document.createElement('div');
        h.className = 'day-head';
        h.innerText = t(w);
        grid.appendChild(h);
    });

    // Начинаем с понедельника той недели, в которую попал первый день периода,
    // иначе столбцы разъедутся и «по вторникам» будет не увидеть.
    const first = counts[0].key;
    const [fy, fm, fd] = first.split('-').map(Number);
    const cursor = new Date(fy, fm - 1, fd);
    cursor.setDate(cursor.getDate() - mondayIndex(cursor));

    const last = counts[counts.length - 1].key;
    let guard = 0;
    while (guard++ < 400) {
        const key = Progress.dayKey(cursor);
        const inRange = key >= first && key <= last;
        const n = inRange ? (byKey[key] || 0) : 0;
        const cell = document.createElement('div');
        cell.className = 'day-cell ' + (inRange ? dayShade(n, median) : 'out')
            + (key === toKey ? ' today' : '');
        cell.innerText = inRange ? (n > 0 ? String(n) : '·') : '';
        if (inRange) {
            cell.title = n > 0
                ? tf('%1 — решено %2', formatDayKeyHuman(key), n)
                : tf('%1 — не занимался', formatDayKeyHuman(key));
        }
        grid.appendChild(cell);
        if (key >= last && mondayIndex(cursor) === 6) break;
        cursor.setDate(cursor.getDate() + 1);
    }
    wrap.appendChild(grid);
    return counts.length;
}

// Запасной вид для длинных периодов: по дням там вышла бы простыня.
function renderWeekBars(daily, fromKey, toKey, containerId) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return 0;
    wrap.innerHTML = '';
    const counts = dayCounts(daily, fromKey, toKey);
    if (!counts.length) return 0;

    const weeks = [];
    for (let i = 0; i < counts.length; i += 7) {
        const chunk = counts.slice(i, i + 7);
        weeks.push({ n: chunk.reduce((s, d) => s + d.n, 0), from: chunk[0].key });
    }
    if (!weeks.some(w => w.n > 0)) return 0;
    const max = Math.max(...weeks.map(w => w.n));

    const row = document.createElement('div');
    row.className = 'week-bars';
    weeks.forEach((w, i) => {
        const box = document.createElement('div');
        box.className = 'week-bar-wrap';
        box.innerHTML = '<span class="week-bar-val"></span>'
            + '<span class="week-bar-space"><span class="week-bar"></span></span>'
            + '<span class="week-bar-label"></span>';
        box.querySelector('.week-bar-val').innerText = w.n || '';
        box.querySelector('.week-bar').style.height = Math.round(w.n / max * 100) + '%';
        // Подписываем каждую вторую: на девяноста днях тринадцать подписей в ряд
        // не помещаются и слипаются.
        box.querySelector('.week-bar-label').innerText =
            (weeks.length <= 8 || i % 2 === 0) ? tf('%1 нед', i + 1) : '';
        box.title = tf('%1 — решено %2', formatDayKeyHuman(w.from), w.n);
        row.appendChild(box);
    });
    wrap.appendChild(row);
    return weeks.length;
}

// Дольше полутора месяцев календарь по дням не читается — переходим на недели.
const DAY_CALENDAR_MAX_DAYS = 45;

function renderDaysBlock(daily, fromKey, toKey) {
    const counts = dayCounts(daily, fromKey, toKey);
    const byDays = counts.length <= DAY_CALENDAR_MAX_DAYS;
    const drawn = byDays
        ? renderDayCalendar(daily, fromKey, toKey, 'statsDayCal')
        : renderWeekBars(daily, fromKey, toKey, 'statsDayCal');
    document.getElementById('statsDaysTitle').innerText =
        byDays ? t('Занятия по дням') : t('Занятия по неделям');

    const sum = daysSummary(counts);
    const el = document.getElementById('statsDaySummary');
    // Существительного после «21 из 30» здесь нет намеренно. В русском оно требует
    // склонения по числу, в немецком в этом обороте — дательного падежа («von 30
    // Tagen», а не «Tage»), и подставлять одно и то же слово во все языки значит
    // где-то написать с ошибкой. Заголовок блока и так говорит «по дням».
    el.innerText = sum
        ? tf('%1 из %2 · самый долгий перерыв %3 · в среднем %4 за занятие',
             sum.activeDays, sum.spanDays,
             sum.gap ? `${sum.gap} ${pluralDaysWord(sum.gap)}` : t('без пропусков'),
             `${sum.perDay} ${t('примеров')}`)
        : '';
    return drawn;
}

// --- Кривые точности и скорости ---
// Точки — недели, а не дни: по дням линия скачет от одного неудачного захода
// и показывает шум вместо динамики. Если период короткий, берём дни.
function bucketize(daily, fromKey, toKey) {
    const days = [];
    let k = fromKey, guard = 0;
    while (k <= toKey && guard++ < 400) { days.push(k); k = shiftDayKey(k, 1); }
    const size = days.length <= 14 ? 1 : (days.length <= 60 ? 7 : 14);
    const out = [];
    for (let i = 0; i < days.length; i += size) {
        const slice = days.slice(i, i + size);
        const agg = { c: 0, w: 0, ms: 0, mc: 0 };
        slice.forEach(dk => {
            const d = daily[dk];
            if (!d) return;
            agg.c += d.c || 0; agg.w += d.w || 0;
            agg.ms += d.ms || 0; agg.mc += d.mc || 0;
        });
        out.push(agg);
    }
    return out;
}

// Маленький график линией. Возвращает SVG-разметку или пустую строку,
// если точек меньше двух — рисовать линию по одной точке нечестно.
function sparklineSvg(values, color, invert) {
    const pts = values.filter(v => v !== null);
    if (pts.length < 2) return '';
    let lo = Math.min(...pts), hi = Math.max(...pts);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    const W = 100, H = 42, pad = 4;
    const step = W / (values.length - 1);
    const y = (v) => {
        const t = (v - lo) / (hi - lo);
        const tt = invert ? 1 - t : t;                  // у скорости меньше = лучше
        return pad + (1 - tt) * (H - pad * 2);
    };
    let d = '', area = '', started = false;
    values.forEach((v, i) => {
        if (v === null) return;
        const x = i * step;
        d += (started ? ' L' : 'M') + x.toFixed(1) + ' ' + y(v).toFixed(1);
        started = true;
    });
    const first = values.findIndex(v => v !== null);
    const last = values.length - 1 - [...values].reverse().findIndex(v => v !== null);
    area = d + ` L${(last * step).toFixed(1)} ${H} L${(first * step).toFixed(1)} ${H} Z`;
    const lastVal = values[last];
    return `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <path d="${area}" fill="${color}" opacity="0.14"></path>
        <path d="${d}" fill="none" stroke="${color}" stroke-width="2"
              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
        <circle cx="${(last * step).toFixed(1)}" cy="${y(lastVal).toFixed(1)}" r="2.5" fill="${color}"></circle>
    </svg>`;
}

function renderTrends(daily, fromKey, toKey) {
    const buckets = bucketize(daily, fromKey, toKey);
    const MIN = 5; // меньше пяти ответов в корзине — точка ни о чём, пропускаем

    const accVals = buckets.map(b => (b.c + b.w) >= MIN ? Math.round(b.c / (b.c + b.w) * 100) : null);
    const spdVals = buckets.map(b => b.mc >= MIN ? +(b.ms / b.mc / 1000).toFixed(1) : null);

    const accSvg = sparklineSvg(accVals, '#34d399', false);
    const spdSvg = sparklineSvg(spdVals, '#06b6d4', true);

    const lastOf = (a) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] !== null) return a[i]; return null; };
    const accNow = lastOf(accVals), spdNow = lastOf(spdVals);

    document.getElementById('trendAccNow').innerText = accNow === null ? '—' : accNow + '%';
    document.getElementById('trendSpeedNow').innerText = spdNow === null ? '—' : spdNow + t(' с');
    document.getElementById('trendAccBody').innerHTML = accSvg
        || t('<div class="trend-empty">Мало данных<br>для кривой</div>');
    document.getElementById('trendSpeedBody').innerHTML = spdSvg
        || t('<div class="trend-empty">Мало данных<br>для кривой</div>');
}

// --- Карта разделов ---
// Сетка «действие × звёздность». Раньше такого быть не могло: сто тем в таблицу
// не помещаются. Когда раздел один, двадцать клеток читаются одним взглядом —
// сразу видно и где силён, и где остановился, и куда идти дальше.
const MAP_SECTIONS = [
    { cat: 'integer', sign: '+', label: t('🔵 Положительные'), ops: ['add', 'sub', 'mul', 'div'] },
    { cat: 'integer', sign: '-', label: t('🔴 Отрицательные'), ops: ['add', 'sub', 'mul', 'div'] },
    { cat: 'decimal', sign: '+', label: t('🔟 Десятичные'),          ops: ['add', 'sub', 'mul', 'div'] },
    { cat: 'fraction', sign: '+', label: t('🧮 Дроби'),              ops: OP_ORDER }
];
const OP_SHORT = {
    add: '➕', sub: '➖', mul: '✖️', div: '➗',
    simplify: t('сокр.'), toMixed: t('в см.'), toImproper: t('в непр.'), fracOfNumber: t('от числа')
};

// Что показывает клетка карты. Отдельной функцией — чтобы правило можно было
// проверить тестом: процент считался при ЛЮБОМ числе попыток, поэтому клетка
// с двумя ответами и одной ошибкой красилась в красное «50%».
//
// Цвет привязан к точности намеренно: он и крупное число в клетке должны
// говорить одно и то же, иначе клетка спорит сама с собой. «Что заработано
// навсегда» — слой отдельный, его несут значки лесенок.
const MAP_HI = 85, MAP_MID = 65;
function mapCellView(attempts, correct, minAttempts) {
    if (!attempts) return { tone: 'empty', pct: null };
    if (attempts < minAttempts) return { tone: 'dim', pct: null };
    const pct = Math.round(correct / attempts * 100);
    return { tone: pct >= MAP_HI ? 'hi' : pct >= MAP_MID ? 'mid' : 'lo', pct };
}

// byTopic — { 'integer+:add:1': {correct, wrong} }. Рисуем только те разделы,
// где ученик реально что-то решал: пустая сетка из двадцати прочерков не
// информация, а шум.
//
// Вид у ребёнка и у репетитора один и тот же. Раньше ребёнку показывали только
// количество, и экран противоречил сам себе: сверху карточка «Точность 91%»,
// ниже карта, где о точности ни слова.
function renderMasteryMap(byTopic, unlocks, containerId, opts) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return 0;
    wrap.innerHTML = '';
    const compact = !!(opts && opts.compact);
    let drawn = 0;

    MAP_SECTIONS.forEach(sec => {
        const cells = [];
        let anyData = false;
        sec.ops.forEach(op => {
            for (let lv = 1; lv <= 5; lv++) {
                const key = `${sec.cat}${sec.sign}:${op}:${lv}`;
                const t = byTopic[key] || {};
                const attempts = (t.correct || 0) + (t.wrong || 0);
                if (attempts > 0) anyData = true;
                cells.push({ key, op, lv, attempts, correct: t.correct || 0 });
            }
        });
        if (!anyData) return;
        drawn++;

        const block = document.createElement('div');
        block.className = 'map-block';
        const title = document.createElement('div');
        title.className = 'map-title';
        title.innerText = sec.label;
        block.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'map-grid' + (compact ? ' compact' : '');
        grid.style.gridTemplateColumns = 'auto repeat(5, 1fr)';

        grid.appendChild(Object.assign(document.createElement('div'), { className: 'map-head' }));
        for (let lv = 1; lv <= 5; lv++) {
            const h = document.createElement('div');
            h.className = 'map-head';
            h.innerText = `${lv}★`;
            grid.appendChild(h);
        }

        sec.ops.forEach(op => {
            const lab = document.createElement('div');
            lab.className = 'map-row-label';
            lab.innerText = OP_SHORT[op] || op;
            grid.appendChild(lab);

            for (let lv = 1; lv <= 5; lv++) {
                const c = cells.find(x => x.op === op && x.lv === lv);
                const cell = document.createElement('div');
                const view = mapCellView(c.attempts, c.correct, MAP_PCT_MIN);
                cell.className = 'map-cell ' + view.tone;

                // Пока процента нет, наверху стоит число решённых: клетка не
                // пустеет и не врёт, просто говорит меньше.
                const val = document.createElement('div');
                val.className = 'map-pct';
                val.innerText = view.pct !== null ? view.pct + '%'
                    : (c.attempts > 0 ? String(c.attempts) : '·');
                cell.appendChild(val);

                if (c.attempts > 0 && !compact) {
                    // Число решённых — только под процентом: без процента оно
                    // уже стоит наверху, и повторять его незачем.
                    if (view.pct !== null) {
                        const nEl = document.createElement('div');
                        nEl.className = 'map-n';
                        nEl.innerText = c.attempts;
                        cell.appendChild(nEl);
                    }

                    const marks = unlocks ? topicLadderMarks(unlocks, c.key) : null;
                    if (marks) {
                        const row = document.createElement('div');
                        row.className = 'map-marks';
                        marks.forEach(m => {
                            const el = document.createElement('div');
                            el.className = 'map-mark' + (m === '·' ? ' none' : '');
                            el.innerText = m;
                            row.appendChild(el);
                        });
                        cell.appendChild(row);
                    }
                }
                cell.title = c.attempts === 0
                    ? tf('%1 — ещё не решал', topicLabelWithLevel(c.key))
                    : view.pct === null
                        ? tf('%1 — решено %2, точность появится с %3', topicLabelWithLevel(c.key), c.attempts, MAP_PCT_MIN)
                        : tf('%1 — %2% из %3', topicLabelWithLevel(c.key), view.pct, c.attempts);
                grid.appendChild(cell);
            }
        });

        block.appendChild(grid);
        wrap.appendChild(block);
    });

    if (!drawn) {
        wrap.innerHTML = t('<div class="menu-empty">Пока пусто.<br>Реши несколько примеров — здесь появится карта.</div>');
    }
    return drawn;
}

// Образец под картой: клетка-пример и подписи к трём значкам. Ступени в примере
// взяты РАЗНЫЕ намеренно — три одинаковые медали не показали бы, что позиции
// означают разное. Подписи идут в том же порядке, в каком клетка рисует значки:
// и то и другое берётся из MAP_MARK_LADDERS, разойтись им негде.
const MAP_LEGEND_TIERS = [2, 3, 1];      // серебро, золото, бронза — чтобы различались
const MAP_LEGEND_SAMPLE = { pct: 92, n: 120 };
function renderMapLegend(containerId) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = '';

    const row = document.createElement('div');
    row.className = 'map-legend-row';

    const cell = document.createElement('div');
    cell.className = 'map-cell hi';
    const pct = document.createElement('div');
    pct.className = 'map-pct';
    pct.innerText = MAP_LEGEND_SAMPLE.pct + '%';
    cell.appendChild(pct);
    const n = document.createElement('div');
    n.className = 'map-n';
    n.innerText = MAP_LEGEND_SAMPLE.n;
    cell.appendChild(n);
    const marks = document.createElement('div');
    marks.className = 'map-marks';
    MAP_LEGEND_TIERS.forEach(tier => {
        const el = document.createElement('div');
        el.className = 'map-mark';
        el.innerText = TIER_ICONS[tier];
        marks.appendChild(el);
    });
    cell.appendChild(marks);
    row.appendChild(cell);

    const items = document.createElement('div');
    items.className = 'map-legend-items';
    MAP_MARK_LADDERS.forEach((id, i) => {
        const l = LADDERS.filter(x => x.id === id)[0];
        const line = document.createElement('div');
        line.className = 'map-legend-item';
        const mark = document.createElement('span');
        mark.className = 'map-legend-mark';
        mark.innerText = TIER_ICONS[MAP_LEGEND_TIERS[i]];
        line.appendChild(mark);
        const name = document.createElement('span');
        name.innerText = `${l.icon} ${l.name}`;
        line.appendChild(name);
        items.appendChild(line);
    });
    row.appendChild(items);
    wrap.appendChild(row);

    // Два числа в клетке до сих пор не были подписаны нигде: значки объяснялись,
    // а «92%» и «120» ученик читал как «моя точность вообще». Это разные вещи —
    // числа считаются за ВЫБРАННЫЙ ПЕРИОД, а значки за последнюю сотню.
    const nums = document.createElement('div');
    nums.className = 'map-legend-nums';
    [[MAP_LEGEND_SAMPLE.pct + '%', t('доля верных за выбранный период')],
     [String(MAP_LEGEND_SAMPLE.n), t('сколько примеров решено за тот же период')]
    ].forEach(([val, text]) => {
        const line = document.createElement('div');
        line.className = 'map-legend-item';
        const b = document.createElement('span');
        b.className = 'map-legend-num';
        b.innerText = val;
        line.appendChild(b);
        const name = document.createElement('span');
        name.innerText = text;
        line.appendChild(name);
        nums.appendChild(line);
    });
    wrap.appendChild(nums);

    // Окна у трёх лесенок разные, и с процентом в клетке они не совпадают:
    // тот считается за выбранный период. Не сказать — значит дать прочитать
    // «100% за последние сто» там, где написано «100% за сегодня».
    const note = document.createElement('div');
    note.className = 'map-legend-note';
    note.innerText = tf('Значки считаются иначе: скорость и точность — по последним %1 примерам, количество — за всё время.',
        LADDER_WINDOW)
        + tf(' Пока примеров меньше %1, вместо доли стоит их число: считать рано.', MAP_PCT_MIN);
    wrap.appendChild(note);
}

// ---- Разбор по типам примеров ----
// Отвечает на вопрос, которого не задаёт ни одна другая запись: внутри клетки
// проседает всё подряд или конкретный тип примера. Нужен для двух отложенных
// решений — про двойной заём и про маленький ответ при заёме.
const CLASS_TITLES = {
    add: { '0': t('без перехода'), '1': t('дополнение до круглого'), '2': t('полный переход'), 'h': t('через сотню') },
    sub: { '0': t('без заёма'), '1': t('вычитание из круглого'), '2': t('полный заём'), 'h': t('двойной заём') },
    div: {
        zero: t('деление на ноль'),
        triv: t('без счёта (÷1, ÷10, 0÷n)'),
        two: t('пополам'),
        five: t('пятёрки'),
        small: t('тройки и четвёрки'),
        nine: t('девятки'),
        core: t('ядро 6·7·8'),
        round: t('круглые'),
        tworound: t('деление на круглое'),
        twoPlain: t('двузначный ответ без сноса'),
        twoCarry: t('двузначный ответ со сносом')
    },
    mul: {
        triv: t('без счёта (×0, ×1, ×10)'),
        two: t('удвоение'),
        five: t('пятёрки'),
        small: t('тройки и четвёрки'),
        nine: t('девятки'),
        core: t('ядро 6·7·8'),
        round: t('круглые'),
        tworound: t('двузначное × круглое'),
        twoPlain: t('двузначное без переноса'),
        twoCarry: t('двузначное с переносом')
    }
};
// Порядок строк в разборе — по возрастанию трудности, а не по алфавиту.
const CLASS_ORDER = {
    add: ['0', '1', '2', 'h'],
    sub: ['0', '1', '2', 'h'],
    mul: ['triv', 'two', 'five', 'small', 'nine', 'core',
          'round', 'tworound', 'twoPlain', 'twoCarry', 'triple'],
    div: ['zero', 'triv', 'two', 'five', 'small', 'nine', 'core',
          'round', 'tworound', 'twoPlain', 'twoCarry']
};
// Отрицательные сложение и вычитание — свой предмет, свои классы. У умножения
// и деления таблицы общие с положительными: там знак не меняет разбор примера.
const CLASS_TITLES_NEG_ADDSUB = {
    same:  t('складываем модули'),
    near:  t('не переходим ноль'),
    cross: t('переходим ноль'),
    par:   t('двойной минус в записи')
};
const CLASS_ORDER_NEG_ADDSUB = ['same', 'near', 'cross', 'par'];
// Строки второй оси: считаются вдобавок к основному классу, поэтому в общую
// сумму ответов по клетке не входят — иначе примеры считались бы дважды.
const CLASS_SECOND_AXIS = ['h', 'par'];

function isNegAddSub(sign, op) {
    return sign === '-' && (op === 'add' || op === 'sub');
}
function classOrderFor(sign, op) {
    return isNegAddSub(sign, op) ? CLASS_ORDER_NEG_ADDSUB : CLASS_ORDER[op];
}
function classTitleFor(sign, op, cls) {
    if (isNegAddSub(sign, op)) return CLASS_TITLES_NEG_ADDSUB[cls] || cls;
    return (CLASS_TITLES[op] || {})[cls] || cls;
}

const CLASS_OP_ORDER = ['add', 'sub', 'mul', 'div'];
const CLASS_MIN_SAMPLE = 20;   // ниже этого считать рано

// Строки разбора: [{ topicKey, opKey, level, rows: [{ key, title, right, wrong, acc, sec }] }]
function classRows(byClass) {
    const out = [];
    Object.keys(byClass || {}).forEach(key => {
        const p = parseTopicKey(key);
        if (!p || p.category !== 'integer') return;
        if (p.sign !== '+' && p.sign !== '-') return;
        const order = classOrderFor(p.sign, p.op);
        if (!order) return;
        const cell = byClass[key] || {};
        const rows = [];
        order.forEach(cls => {
            const slot = cell[cls];
            if (!Array.isArray(slot)) return;
            const right = slot[0] || 0, wrong = slot[1] || 0;
            const attempts = right + wrong;
            if (!attempts) return;
            rows.push({
                key: cls,
                title: classTitleFor(p.sign, p.op, cls),
                second: CLASS_SECOND_AXIS.indexOf(cls) >= 0,
                right, wrong, attempts,
                acc: Math.round(100 * right / attempts),
                sec: (slot[3] || 0) > 0 ? (slot[2] / slot[3] / 1000) : null
            });
        });
        if (rows.length) out.push({
            topicKey: key, opKey: p.op, sign: p.sign,
            category: p.category, level: p.level || 1, rows
        });
    });
    // Сначала положительные, потом отрицательные; внутри — по действию и звезде.
    out.sort((x, y) => (x.sign !== y.sign)
        ? (x.sign === '+' ? -1 : 1)
        : (x.opKey === y.opKey)
            ? (x.level - y.level)
            : (CLASS_OP_ORDER.indexOf(x.opKey) - CLASS_OP_ORDER.indexOf(y.opKey)));
    return out;
}

function renderClassBreakdown(st) {
    const section = document.getElementById('statsClassSection');
    const wrap = document.getElementById('statsClassList');
    const cells = classRows((st && st.byClass) || {});
    if (!cells.length) { section.style.display = 'none'; return; }
    section.style.display = '';

    const table = document.createElement('table');
    table.className = 'cls-table';
    cells.forEach(cell => {
        const head = table.insertRow();
        head.className = 'cls-head';
        const total = cell.rows.reduce((n, r) => n + (r.second ? 0 : r.attempts), 0);
        const c1 = head.insertCell(); c1.colSpan = 2;
        // Подпись берём из общей таблицы, а не тернарником: с появлением
        // умножения «не add» перестало означать «вычитание». Раздел в подписи
        // обязателен с приходом отрицательных: «Вычитание 3★» бывает и там, и там.
        c1.innerText = `${categoryLabel(cell.category, cell.sign)} · `
            + `${(OP_LABELS[cell.opKey] || cell.opKey).replace(/^\S+\s/, '')} ${cell.level}★`;
        const c2 = head.insertCell(); c2.colSpan = 2;
        c2.innerText = tf('%1 ответов', total);

        cell.rows.forEach(r => {
            const tr = table.insertRow();
            tr.className = 'sub' + (r.attempts < CLASS_MIN_SAMPLE ? ' thin' : '');
            tr.insertCell().innerText = r.title;
            tr.insertCell().innerText = r.attempts;
            tr.insertCell().innerText = `${r.acc}%`;
            tr.insertCell().innerText = r.sec === null ? '—' : tf('%1 с', r.sec.toFixed(1));
        });
    });
    wrap.innerHTML = '';
    wrap.appendChild(table);
}
