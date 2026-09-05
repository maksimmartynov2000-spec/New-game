// Ключ темы и работа с журналом по дням. Опора для всего, что считает статистику.
//
// Здесь два раздела, и оба — счёт, а не рисование: как называется клетка
// («integer+:add:3»), как её разобрать обратно и как назвать по-человечески; и как
// ходить по журналу занятий по дням — сдвинуть дату, сложить период, сравнить половины.
//
// Файл идёт после js/i18n.js: подписи режимов строятся через t() при загрузке.
// OP_ORDER переехал сюда же — его читает таблица MAP_SECTIONS в js/charts.js,
// тоже при загрузке, а значит объявить его надо раньше.

const OP_ORDER = ['add', 'sub', 'mul', 'div', 'simplify', 'toMixed', 'toImproper', 'fracOfNumber'];

// ===================== КЛЮЧ ТЕМЫ =====================
// Формат: 'категория+знак:операция:уровень', например 'integer+:add:1'.
// Уровень и знак нужны достижениям: «сложение целых положительных на 1★» и
// «на 5★» — это разные навыки, и одна лесенка на них обе была бы бессмысленной.
//
// Записи старого формата ('integer:add', без знака и уровня) продолжают читаться:
// они просто не участвуют в лесенках (уровень из них не восстановить) и попадают
// в те же строки статистики, что и новые.
// Структурный класс примера для разбора статистики. Только целые положительные,
// сложение и вычитание: у дробей и десятичных «переход через десяток» смысла не имеет.
//
// Для вычитания два «слагаемых» зеркала — это вычитаемое и ответ, потому что
// «a − b = c» и «b + c = a» одна и та же тройка. Поэтому класс и переход через
// сотню считаются одной формулой на оба режима.
// Класс примера умножения — та же группа приёма, по которой его выбирал
// генератор. Считаем её заново по числам, а не тащим из генератора: разбор
// обязан уметь разобрать любой пример, включая сохранённые старым кодом.
// Порядок проверок и есть старшинство групп — оно совпадает с MUL_GROUPS.
function mulClassOf(a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (lo <= 1 || lo === 10 || hi === 10) return 'triv';
    if (lo >= 11 && hi >= 11) return 'tworound';        // 24 × 30
    if (hi >= 11) {
        // Продолжение двойки: 2 × 13 — то же удвоение, а не двузначная работа.
        if (lo === 2 && hi <= 15) return 'two';
        if (hi % 10 === 0) return 'round';              // 30 × 7
        return ((hi % 10) * lo >= 10) ? 'twoCarry' : 'twoPlain';
    }
    if (lo === 2) return 'two';
    if (lo === 5 || hi === 5) return 'five';
    if (hi === 9) return 'nine';
    if (lo === 3 || lo === 4) return 'small';
    return 'core';
}

// Класс примера на деление — та же группа, что и у зеркального умножения.
// Считаем по делимому и делителю: 56 ÷ 7 разбирается как факт 7 × 8.
function divClassOf(a, b) {
    if (b === 0) return 'zero';
    if (a === 0 || b === 1 || b === 10 || a === b) return 'triv';
    const q = a / b;
    if (!Number.isInteger(q)) return null;      // остатков у нас нет
    // Дальше — ровно тот же разбор, что у зеркального умножения. Своей
    // ветки для двузначного частного здесь быть не должно: mulClassOf уже
    // знает и про круглые (210 ÷ 30 → «круглые»), и про снос (84 ÷ 7 → «со
    // сносом»), и про исключение «2 × 13 — это всё ещё пополам». Написанная
    // заново, эта ветка расходилась с ним: 30 ÷ 2 = 15 попадало в
    // «двузначный ответ», хотя это половина, и первая звезда получала в
    // разборе класс, которого на ней нет.
    return mulClassOf(q, b);
}

// Разбор одного примера: основной класс плюс, если есть, ВТОРАЯ ось. Вторая ось
// считается отдельной строкой и в общую сумму ответов не входит: у положительного
// сложения это «через сотню», у отрицательного — «двойной минус в записи».
// И то, и другое сочетается с любым основным классом, а не заменяет его.
function structuralClassOf(meta, problem) {
    if (!meta || !problem) return null;
    if (meta.category !== 'integer') return null;
    const a = problem.a, b = problem.b;
    if (typeof a !== 'number' || typeof b !== 'number') return null;

    if (meta.isNegative) {
        // Умножение и деление отрицательных — те же группы таблицы, что и у
        // положительных: знак к разбору примера отношения не имеет, он либо
        // верен, либо нет, и это уже ловит отдельный код ошибки «ошибся в знаке».
        // Три множителя — свой класс: разбирать «12 × 7» по таблице бессмысленно,
        // это разложение для вариантов ответа, а не то, что видит ученик.
        if (meta.opKey === 'mul') {
            if (problem.triple) return { cls: 'triple' };
            return { cls: mulClassOf(Math.abs(a), Math.abs(b)) };
        }
        if (meta.opKey === 'div') {
            const dcls = divClassOf(Math.abs(a), Math.abs(b));
            return dcls ? { cls: dcls } : null;
        }
        if (meta.opKey !== 'add' && meta.opKey !== 'sub') return null;

        // Приводим к виду «x + y»: a — всегда первое число, поэтому второе
        // достаём из ответа. Так разбор не зависит от того, перевернул ли
        // генератор знак при отображении.
        const ans = problem.answer;
        if (typeof ans !== 'number') return null;
        const x = a, y = ans - a;
        if (x === 0 || y === 0) return null;
        let cls;
        if (Math.sign(x) === Math.sign(y)) cls = 'same';          // модули складываются
        else if (Math.abs(x) > Math.abs(y)) cls = 'near';         // ноль не переходим
        else cls = 'cross';                                       // ноль переходим
        const paren = typeof problem.text === 'string' && problem.text.indexOf('(') >= 0;
        return { cls, extra: paren ? 'par' : null };
    }

    if (meta.opKey === 'div') {
        if (a < 0 || b < 0) return null;
        const cls = divClassOf(a, b);
        return cls ? { cls } : null;
    }
    if (meta.opKey === 'mul') {
        if (a < 0 || b < 0) return null;
        // «Через сотню» — про разряды сложения; к умножению не относится.
        return { cls: mulClassOf(a, b) };
    }
    if (meta.opKey !== 'add' && meta.opKey !== 'sub') return null;
    const x = meta.opKey === 'add' ? a : b;
    const y = meta.opKey === 'add' ? b : (a - b);
    if (x < 0 || y < 0) return null;
    const carry = (x % 10 + y % 10) >= 10 ? 1 : 0;
    const hundred = (Math.floor(x / 10) % 10 + Math.floor(y / 10) % 10 + carry) >= 10;
    return { cls: String(unitsClass(x, y)), extra: hundred ? 'h' : null };
}

function buildTopicKey(meta) {
    if (!meta || !meta.category || !meta.opKey) return null;
    const sign = meta.isNegative ? '-' : '+';
    const lvl = meta.level || 1;
    return `${meta.category}${sign}:${meta.opKey}:${lvl}`;
}
function parseTopicKey(key) {
    const parts = String(key || '').split(':');
    const head = parts[0] || '';
    const sign = (head.slice(-1) === '+' || head.slice(-1) === '-') ? head.slice(-1) : null;
    return {
        category: sign ? head.slice(0, -1) : head,
        sign,
        op: parts[1] || '',
        level: parts.length > 2 ? Number(parts[2]) || null : null,
        hasLevel: parts.length > 2
    };
}
// Ключ для ОТОБРАЖЕНИЯ: уровни схлопываются в одну строку, знак остаётся —
// «целые положительные» и «целые отрицательные» это разные вещи и для ученика,
// и для репетитора, а вот «сложение на 2★ и на 4★» в отчёте разделять незачем.
function displayTopicKey(key) {
    const p = parseTopicKey(key);
    return `${p.category}${p.sign || ''}:${p.op}`;
}
function topicLabel(key) {
    const p = parseTopicKey(key);
    const op = (OP_LABELS[p.op] || p.op).replace(/^\S+\s/, '');
    return `${categoryLabel(p.category, p.sign)} · ${op}`;
}
// То же самое, но с уровнем — для достижений, где уровень и есть суть темы.
function topicLabelWithLevel(key) {
    const p = parseTopicKey(key);
    return topicLabel(key) + (p.level ? ` · ${p.level}★` : '');
}

// ===================== РАБОТА С ЖУРНАЛОМ ПО ДНЯМ =====================
// Всё, что считает периоды, работает с ЛЮБЫМ состоянием — своим или ученика,
// поэтому те же функции используются и в статистике, и в отчёте для родителей.

function shiftDayKey(key, deltaDays) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    return Progress.dayKey(dt);
}
function isActiveDay(d) {
    return !!d && (((d.c || 0) + (d.w || 0)) > 0 || (d.s || 0) > 0);
}

// Суммирует дни журнала за период [fromKey, toKey] включительно.
// fromKey = null означает "с самого начала".
function aggregateDaily(daily, fromKey, toKey) {
    const out = { days: 0, c: 0, w: 0, a: 0, s: 0, p: 0, ms: 0, mc: 0, t: {}, e: {}, te: {} };
    Object.keys(daily || {}).forEach(k => {
        if ((fromKey && k < fromKey) || (toKey && k > toKey)) return;
        const d = daily[k];
        if (!d) return;
        if (isActiveDay(d)) out.days++;
        ['c', 'w', 'a', 's', 'p', 'ms', 'mc'].forEach(f => { out[f] += d[f] || 0; });
        Object.keys(d.t || {}).forEach(tk => {
            // Пять ячеек, а не три: [верно, неверно, почти, время всех, число верных].
            // Время и число верных нужны, чтобы считать скорость ПО ОДНОЙ теме, —
            // без этого сравнить половины периода на одинаковых примерах нечем.
            const slot = out.t[tk] || (out.t[tk] = [0, 0, 0, 0, 0]);
            const v = d.t[tk] || [];
            for (let i = 0; i < 5; i++) slot[i] += v[i] || 0;
        });
        Object.keys(d.e || {}).forEach(kind => { out.e[kind] = (out.e[kind] || 0) + (d.e[kind] || 0); });
        Object.keys(d.te || {}).forEach(topic => {
            const src = d.te[topic] || {};
            const dst = out.te[topic] || (out.te[topic] = {});
            Object.keys(src).forEach(kind => { dst[kind] = (dst[kind] || 0) + (src[kind] || 0); });
        });
    });
    return out;
}

// Средняя звёздность примеров за отрезок, взвешенная по числу попыток.
// Нужна ровно для одного: понять, не сменилась ли сложность между половинами
// периода. Возвращает null, если примеров с известной звёздностью не было.
function avgLevelOf(agg) {
    let attempts = 0, sum = 0;
    Object.keys((agg && agg.t) || {}).forEach(key => {
        const lvl = parseTopicKey(key).level;
        const v = agg.t[key] || [];
        const n = (v[0] || 0) + (v[1] || 0);
        if (!lvl || !n) return;
        attempts += n; sum += lvl * n;
    });
    return attempts ? sum / attempts : null;
}

// Насколько должна сдвинуться средняя звёздность, чтобы половины перестали
// быть сравнимыми напрямую. Треть звезды: меньше — это обычные колебания
// набора внутри одной сложности, а не переход.
const LEVEL_SHIFT_MIN = 0.3;

// Ниже этого сравнение половин периода — просто шум замера.
const MIN_HALF = 15;

// Решает, на чём честно сравнивать половины периода.
//
// Зачем вообще: точность и скорость ПАДАЮТ, когда ученик переходит на звезду
// выше. Отчёт, который в этот момент рисует красную стрелку вниз, говорит
// родителю неправду — ребёнок вырос, а написано, что стало хуже. Ровно так
// и случилось на проверке: у ученика, взявшего четвёртую звезду, спад показали
// как ухудшение. Работает в обе стороны: рост точности на примерах, ставших
// проще, — тоже не рост, и хвалить за него так же нечестно.
//
//   'plain'        — сложность та же, сравниваем половины как есть;
//   'common'       — сложность сменилась, но темы, встречавшиеся в ОБЕИХ
//                    половинах, дают достаточную выборку — считаем по ним;
//   'incomparable' — сложность сменилась, общего слишком мало: показываем
//                    обе половины без стрелки и говорим об этом прямо.
function compareHalves(firstHalf, secondHalf, minHalf) {
    const whole = (agg) => ({ c: agg.c || 0, w: agg.w || 0, ms: agg.ms || 0, mc: agg.mc || 0 });
    const levelFrom = avgLevelOf(firstHalf), levelTo = avgLevelOf(secondHalf);
    const plain = { mode: 'plain', a: whole(firstHalf), b: whole(secondHalf), levelFrom, levelTo };
    if (levelFrom === null || levelTo === null) return plain;
    if (Math.abs(levelTo - levelFrom) < LEVEL_SHIFT_MIN) return plain;

    const keys = Object.keys(firstHalf.t || {}).filter(k => (secondHalf.t || {})[k]);
    const take = (agg) => {
        const acc = { c: 0, w: 0, ms: 0, mc: 0 };
        keys.forEach(k => {
            const v = agg.t[k] || [];
            acc.c += v[0] || 0; acc.w += v[1] || 0; acc.ms += v[3] || 0; acc.mc += v[4] || 0;
        });
        return acc;
    };
    const a = take(firstHalf), b = take(secondHalf);
    if (a.c + a.w >= minHalf && b.c + b.w >= minHalf) {
        return { mode: 'common', a, b, levelFrom, levelTo };
    }
    return { mode: 'incomparable', a: whole(firstHalf), b: whole(secondHalf), levelFrom, levelTo };
}
