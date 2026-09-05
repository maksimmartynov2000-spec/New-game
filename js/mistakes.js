// Разбор ошибок и подсказки по ним.
//
// Приложение считало ошибки, но не знало, какие они. Здесь оно узнаёт: по условию,
// верному ответу и выбранному варианту заново считается, какая известная ошибка даёт
// ровно этот результат. Функции чистые, генератора не касаются.
//
// Файл идёт ПОСЛЕ js/generator.js и js/i18n.js, и это не вкусовщина:
//   — разбор пользуется дробной арифметикой генератора (fracAdd, gcd, simplifyFrac…);
//   — таблица подписей MISTAKE_LABELS строится через t() прямо при загрузке файла.
// Тексты самих подсказок лежат отдельно, в content/hints.js: они содержимое, а не код,
// и без них игра идёт как раньше, просто молча.

// =====================================================================
//  РАЗБОР ОШИБОК: ЧТО ИМЕННО СДЕЛАНО НЕ ТАК
// ---------------------------------------------------------------------
//  Приложение считало ошибки, но не знало, какие они. Репетитор видел
//  «12 ошибок», а не «9 из 12 — сложил знаменатели». Между тем варианты
//  ответа с самого начала строятся как модели конкретных ошибок: «сложил
//  в лоб», «не перевернул дробь», «забыл сократить». Оставалось понять,
//  какую из них ученик выбрал, — и это можно сделать, ничего не меняя
//  в генераторе.
//
//  Поэтому здесь разбор идёт ПОСЛЕ ответа, по самому числу: берём условие,
//  верный ответ и выбранный и заново считаем, какая известная ошибка даёт
//  ровно этот результат. Функция чистая, генератора не касается, и если
//  ни одна модель не подошла — честно возвращает «другая ошибка».
//
//  Порядок проверок важен: сначала самые узнаваемые причины, потом общие.
//  Первое совпадение и есть ответ.
// =====================================================================

const MISTAKE_LABELS = {
    'не сократил':                 t('Не сократил ответ'),
    'общий знаменатель зря':       t('Зря привёл к общему знаменателю'),
    'сложил знаменатели':          t('Сложил (вычел) и числители, и знаменатели'),
    'перепутал действие':          t('Перепутал действие'),
    'не перевернул дробь':         t('При делении не перевернул вторую дробь'),
    'забыл целую часть':           t('Потерял целую часть'),
    'ошибся в переводе':           t('Ошибся при переводе дроби'),
    'сократил не до конца':        t('Сократил не до конца'),
    'ошибся в сокращении':         t('Ошибся в сокращении'),
    'ошибся в знаке':              t('Ошибся в знаке'),
    'ошибся на единицу':           t('Промахнулся на единицу'),
    'таблица умножения':           t('Ошибка в таблице умножения'),
    'делил на ноль':               t('Не заметил деления на ноль'),
    'запятая не на месте':         t('Запятая не на месте'),
    'ошибка в десятках':           t('Единицы верные, ошибка в десятках'),
    'ошибка в единицах':           t('Десятки верные, ошибка в единицах'),
    'ноль в примере':              t('Не учёл ноль в примере'),
    'не перенёс десяток':          t('Не перенёс десяток'),
    'не занял десяток':            t('Не занял десяток при вычитании'),
    'переставил числа':            t('Поменял числа местами'),
    'взял одно из чисел':          t('Назвал одно из чисел примера'),
    'сложил вместо умножения':     t('Сложил вместо того чтобы умножить'),
    'не выровнял запятую':         t('Не выровнял запятые перед сложением'),
    'забыл поделить':              t('Умножил, но забыл поделить на знаменатель'),
    'нашёл только одну долю':      t('Нашёл одну долю, но не умножил'),
    'нашёл остаток':               t('Нашёл остаток вместо самой доли'),
    'ошибся на одну долю':         t('Промахнулся на одну долю'),
    'забыл перемножить знаменатели': t('Перемножил числители, но не знаменатели'),
    'перевернул не ту дробь':      t('Перевернул первую дробь вместо второй'),
    'перевёл не обе дроби':        t('Привёл к общему знаменателю только одну дробь'),
    'другая ошибка':               t('Другая ошибка')
};

// Короткие подписи для ярлычка на карточке разбора: там места на одну-две строки,
// а полные названия («Привёл к общему знаменателю только одну дробь») туда не влезают
// и уезжают за край карточки.
const MISTAKE_SHORT = {
    'не сократил':                 'не сократил',
    'общий знаменатель зря':       t('лишнее приведение'),
    'сложил знаменатели':          'сложил знаменатели',
    'перепутал действие':          t('другое действие'),
    'не перевернул дробь':         t('не перевернул'),
    'забыл целую часть':           t('без целой части'),
    'ошибся в переводе':           t('перевод дроби'),
    'сократил не до конца':        t('не до конца'),
    'ошибся в сокращении':         t('сокращение'),
    'ошибся в знаке':              t('знак'),
    'ошибся на единицу':           t('мимо на 1'),
    'таблица умножения':           t('таблица'),
    'делил на ноль':               t('деление на 0'),
    'запятая не на месте':         t('запятая'),
    'ошибка в десятках':           t('мимо на десяток'),
    'ошибка в единицах':           t('мимо в единицах'),
    'ноль в примере':              t('ноль'),
    'не перенёс десяток':          t('без переноса'),
    'не занял десяток':            t('без займа'),
    'переставил числа':            t('числа местами'),
    'взял одно из чисел':          t('число из примера'),
    'сложил вместо умножения':     t('сложил вместо ×'),
    'не выровнял запятую':         t('запятые не выровнены'),
    'забыл поделить':              'забыл поделить',
    'нашёл только одну долю':      t('одна доля'),
    'нашёл остаток':               t('остаток'),
    'ошибся на одну долю':         t('мимо на долю'),
    'забыл перемножить знаменатели': t('без знаменателей'),
    'перевернул не ту дробь':      t('не та дробь'),
    'перевёл не обе дроби':        t('привёл одну'),
    'другая ошибка':               t('ошибка')
};

function mistakeLabel(kind) { return MISTAKE_LABELS[kind] || kind; }
function mistakeShort(kind) { return MISTAKE_SHORT[kind] || MISTAKE_LABELS[kind] || kind; }

// Дробь ли это и равны ли две дроби по величине (а не по записи).
const isFrac = (v) => v && typeof v === 'object' && 'num' in v && 'den' in v;
const isDecimalValue = (v) => v && typeof v === 'object' && 'intVal' in v && 'dp' in v;
const sameValue = (x, y) => isFrac(x) && isFrac(y) && x.den !== 0 && y.den !== 0
    && x.num * y.den === y.num * x.den;
const sameFrac = (x, y) => isFrac(x) && isFrac(y) && x.num === y.num && x.den === y.den;

function classifyFractionArith(problem, correct, chosen) {
    const { f1, f2, opKey } = problem;
    if (!isFrac(chosen) || !isFrac(f1) || !isFrac(f2)) return null;

    // Величина верная, запись — нет. Если знаменатели были одинаковые, а ученик
    // всё равно перемножил их крест-накрест, это отдельная, очень характерная
    // история: не ошибка в счёте, а лишний шаг от неуверенности.
    if (sameValue(chosen, correct)) {
        if (f1.den === f2.den && chosen.den === f1.den * f2.den) return 'общий знаменатель зря';
        return 'не сократил';
    }

    if (chosen.num === -correct.num && chosen.den === correct.den) return 'ошибся в знаке';

    // «Сложил в лоб»: числители к числителям, знаменатели к знаменателям.
    const flat = opKey === 'sub'
        ? { num: f1.num - f2.num, den: f1.den - f2.den }
        : { num: f1.num + f2.num, den: f1.den + f2.den };
    if (flat.den !== 0 && (sameFrac(chosen, flat) || sameValue(chosen, flat))) return 'сложил знаменатели';

    // Деление без переворота второй дроби — то же самое, что умножение.
    if (opKey === 'div' && f2.num !== 0) {
        const asMul = fracMul(f1, f2);
        if (sameFrac(chosen, asMul) || sameValue(chosen, asMul)) return 'не перевернул дробь';
    }

    // Умножение: перемножил числители, а знаменатель взял из готового.
    if (opKey === 'mul') {
        const a = simplifyFrac(f1.num * f2.num, f1.den);
        const b = simplifyFrac(f1.num * f2.num, f2.den);
        if (sameFrac(chosen, a) || sameFrac(chosen, b)) return 'забыл перемножить знаменатели';
    }

    // Деление: перевернул первую дробь вместо второй.
    if (opKey === 'div' && f1.num !== 0 && f2.den !== 0) {
        const flipped = simplifyFrac(f1.den * f2.num, f1.num * f2.den);
        if (sameFrac(chosen, flipped)) return 'перевернул не ту дробь';
    }

    // Сложение и вычитание с разными знаменателями: привёл к общему только одну
    // дробь, а числитель второй взял как есть. Очень характерная половинчатая ошибка.
    if ((opKey === 'add' || opKey === 'sub') && f1.den !== f2.den) {
        const lcd = f1.den * f2.den / gcd(f1.den, f2.den);
        const sign = opKey === 'add' ? 1 : -1;
        const half1 = { num: f1.num * (lcd / f1.den) + sign * f2.num, den: lcd };
        const half2 = { num: f1.num + sign * f2.num * (lcd / f2.den), den: lcd };
        if (sameValue(chosen, half1) || sameValue(chosen, half2)) return 'перевёл не обе дроби';
    }

    const opposite = { add: 'sub', sub: 'add', mul: 'div', div: 'mul' }[opKey];
    if (opposite) {
        try {
            const other = opposite === 'add' ? fracAdd(f1, f2)
                : opposite === 'sub' ? fracSub(f1, f2)
                : opposite === 'mul' ? fracMul(f1, f2)
                : (f2.num !== 0 ? fracDiv(f1, f2) : null);
            if (other && (sameFrac(chosen, other) || sameValue(chosen, other))) return 'перепутал действие';
        } catch (e) { /* обратное действие неопределено — просто идём дальше */ }
    }

    // Ответ должен был быть смешанным числом, а взята только дробная часть.
    const m = toMixedParts(correct);
    if (m && m.whole !== 0 && m.remNum !== 0
        && Math.abs(chosen.num) === m.remNum && chosen.den === m.den) return 'забыл целую часть';

    return null;
}

function classifyIntegerLike(problem, correct, chosen, opKey) {
    if (typeof chosen !== 'number' || typeof correct !== 'number') return null;
    const a = problem.a, b = problem.b;
    const haveOperands = typeof a === 'number' && typeof b === 'number';

    if (chosen === -correct && correct !== 0) return 'ошибся в знаке';

    // Единицы посчитаны верно, десятки — нет: 17 + 18 = 35, а названо 45 или 25.
    // Проверяем раньше остальных разрядных моделей, потому что это самая частая
    // ошибка и самая узкая примета — ровно десять мимо при верной последней цифре.
    // Ярлык «не перенёс десяток» остался в словаре ради старых записей в журнале,
    // но новые в него больше не пишутся: модель, по которой он ставился, считала
    // разряды все сразу и на двух переносах давала не ошибку, а мусор.
    if ((opKey === 'add' || opKey === 'sub') && Math.abs(chosen - correct) === 10) {
        return 'ошибка в десятках';
    }

    // Разряды: вычел, не заняв десяток. Это та же модель, по которой строятся
    // варианты ответа, — см. buildDistractors.
    if (haveOperands) {
        if (opKey === 'sub') {
            const nb = noBorrowSub(a, b);
            if (nb !== null && (chosen === nb || chosen === -nb)) return 'не занял десяток';
            if (chosen === b - a && a !== b) return 'переставил числа';
        }

        const others = { add: a - b, sub: a + b, mul: (b !== 0 ? a / b : null), div: a * b };
        const other = others[opKey];
        if (other !== null && other !== undefined && chosen === other) return 'перепутал действие';
        if (opKey === 'mul' && chosen === a + b) return 'сложил вместо умножения';

        // Соседняя клетка таблицы умножения: 7×8 вместо 7×7.
        if (opKey === 'mul' && (chosen === a * (b + 1) || chosen === a * (b - 1)
            || chosen === (a + 1) * b || chosen === (a - 1) * b)) return 'таблица умножения';

        // При делении часто называют само делимое или делитель, не посчитав.
        if (opKey === 'div' && (chosen === a || chosen === b)) return 'взял одно из чисел';
    }

    // Промах на единицу проверяем последним: иначе он перехватывал бы более
    // говорящие причины, которые случайно оказались рядом с верным ответом.
    if (Math.abs(chosen - correct) === 1) return 'ошибся на единицу';

    // Зеркало «ошибки в десятках»: десятки верные, последняя цифра нет. Это вторая
    // половина столбикового счёта, и до сих пор она уходила в «другую ошибку» —
    // самую частую и самую бесполезную корзину на сложении и вычитании. По замеру
    // на шести тысячах неверных вариантов эта модель забирает из неё 46% на
    // сложении и 69% на вычитании.
    //
    // Ставится САМОЙ последней, ниже промаха на единицу: «34 вместо 35» это тоже
    // верные десятки при неверной единице, но там ученику полезнее услышать
    // «мимо на единицу». Отрицательные не трогаем: там своя арифметика разрядов.
    //
    // Оба числа должны быть не меньше десяти. Без этого условия «9 вместо 7»
    // тоже считалось «верными десятками» — их там просто нет ни одного, — и
    // подсказка говорила «десятки сошлись» на первой звезде вычитания в ста
    // процентах случаев. Однозначный промах честнее оставить «другой ошибкой»:
    // про него мы действительно ничего не знаем.
    if ((opKey === 'add' || opKey === 'sub') && chosen >= 10 && correct >= 10
        && chosen % 10 !== correct % 10
        && Math.floor(chosen / 10) === Math.floor(correct / 10)) {
        return 'ошибка в единицах';
    }
    return null;
}

// Ноль в примере — отдельная беда, и до сих пор она рассыпалась по трём чужим
// видам: «другая ошибка», «сложил вместо умножения», «мимо на единицу».
// Последнее особенно скверно: ребёнок, выбравший 1 вместо 0×8, не торопится —
// он не знает правила, а ему советовали «считать на полсекунды дольше».
//
// Деление ноля сюда же: 0 ÷ 10 путают с 10 ÷ 0 постоянно, и «Нет решения»
// в качестве ответа — это ровно та же путаница, поэтому строковый выбор
// здесь тоже считается ошибкой этого вида.
function classifyZeroInExample(opKey, problem, chosen) {
    const a = problem && problem.a, b = problem && problem.b;
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    if (chosen === 0) return null;              // ноль и выбрал — это не эта ошибка
    if (opKey === 'mul' && (a === 0 || b === 0)) return 'ноль в примере';
    if (opKey === 'div' && a === 0 && b !== 0) return 'ноль в примере';
    return null;
}

// «Дробь от числа»: модели ошибок здесь свои, см. buildFracOfNumberDistractors.
function classifyFracOfNumber(problem, correct, chosen) {
    if (typeof chosen !== 'number') return null;
    const { fracNum, N, k } = problem;
    if (chosen === N * fracNum) return 'забыл поделить';
    if (chosen === k && k !== correct) return 'нашёл только одну долю';
    if (chosen === N - correct) return 'нашёл остаток';
    if (k && (chosen === correct + k || chosen === correct - k)) return 'ошибся на одну долю';
    if (Math.abs(chosen - correct) === 1) return 'ошибся на единицу';
    return null;
}

// Главная точка входа. meta — то же, что в currentProblemMeta.
function classifyMistake(meta, problem, correct, chosen) {
    if (!meta || !problem) return 'другая ошибка';
    const opKey = meta.opKey;

    // Выбрали число там, где верный ответ — «нет решения» (деление на ноль).
    if (problem.noSolution && chosen !== 'NO_SOLUTION') return 'делил на ноль';

    try {
        if (meta.category === 'fraction') {
            if (opKey === 'simplify') {
                if (!isFrac(chosen)) return 'другая ошибка';
                // Величина та же, запись другая — значит сократил, но не до упора.
                if (sameValue(chosen, correct)) return 'сократил не до конца';
                return 'ошибся в сокращении';
            }
            if (opKey === 'toMixed' || opKey === 'toImproper') return 'ошибся в переводе';
            if (opKey === 'fracOfNumber') return classifyFracOfNumber(problem, correct, chosen) || 'другая ошибка';
            return classifyFractionArith(problem, correct, chosen) || 'другая ошибка';
        }

        if (meta.category === 'decimal') {
            if (!isDecimalValue(chosen) || !isDecimalValue(correct)) return 'другая ошибка';
            const d1 = problem.d1, d2 = problem.d2;
            const val = (d) => d.intVal / Math.pow(10, d.dp);
            const cv = val(correct), gv = val(chosen);

            if (gv === -cv && cv !== 0) return 'ошибся в знаке';

            // Те же цифры, но запятая сдвинута — самая частая беда десятичных.
            if (chosen.intVal === correct.intVal && chosen.dp !== correct.dp) return 'запятая не на месте';

            if (d1 && d2) {
                const commonDp = Math.max(d1.dp, d2.dp);
                const v1 = d1.intVal * Math.pow(10, commonDp - d1.dp);
                const v2 = d2.intVal * Math.pow(10, commonDp - d2.dp);
                const same = (iv, dp) => chosen.intVal === iv && chosen.dp === dp;

                // Сложил сырые цифры, не выровняв запятые (0.5 + 0.25 как 5 + 25).
                if ((opKey === 'add' || opKey === 'sub') && d1.dp !== d2.dp) {
                    const raw = opKey === 'add' ? d1.intVal + d2.intVal : d1.intVal - d2.intVal;
                    if (same(raw, Math.max(d1.dp, d2.dp))) return 'не выровнял запятую';
                }
                if (opKey === 'add' && same(v1 - v2, commonDp)) return 'перепутал действие';
                if (opKey === 'sub' && same(v1 + v2, commonDp)) return 'перепутал действие';
                if (opKey === 'mul') {
                    if (same(v1 + v2, commonDp)) return 'сложил вместо умножения';
                    const raw = d1.intVal * d2.intVal;
                    if (chosen.intVal === raw && chosen.dp !== d1.dp + d2.dp) return 'запятая не на месте';
                }
                if (opKey === 'div' && same(d1.intVal * d2.intVal, d1.dp + d2.dp)) return 'перепутал действие';
            }

            if (gv !== 0 && cv !== 0) {
                const ratio = gv / cv;
                for (const k of [0.001, 0.01, 0.1, 10, 100, 1000]) {
                    if (Math.abs(ratio - k) < 1e-9) return 'запятая не на месте';
                }
            }
            return 'другая ошибка';
        }

        const zero = classifyZeroInExample(opKey, problem, chosen);
        if (zero) return zero;
        return classifyIntegerLike(problem, correct, chosen, opKey) || 'другая ошибка';
    } catch (e) {
        // Разбор ошибок не имеет права уронить игру: не разобрались — и ладно.
        return 'другая ошибка';
    }
}

// ===================== ПОДСКАЗКИ ПО ОШИБКАМ =====================
// Тексты лежат в content/hints.js. Здесь — когда показывать и какие числа
// подставить: подсказка говорит числами того примера, на котором ученик
// споткнулся, иначе она превращается в общее место вроде «бывает перенос».
//
// Показываем скупо. Ошибка одного вида должна повториться трижды за миссию —
// один промах это случайность, а не пробел. Один вид подсказывается один раз,
// всего за миссию не больше двух подсказок: третья это уже урок посреди игры.
const HINT_REPEAT_AT = 3;
const HINT_MAX_PER_SESSION = 2;
// «Другая ошибка» — корзина, про которую мы честно ничего не знаем; «не сократил»
// это вообще не ошибка в счёте. Молчать здесь лучше, чем говорить наугад.
const HINT_NEVER = ['другая ошибка', 'не сократил'];

function resolveHints() {
    const all = (typeof window !== 'undefined' && window.HINT_CONTENT) || null;
    if (!all) return null;
    const lang = (typeof LANG === 'string' && LANG) || 'ru';
    return all[lang] || all.ru || null;
}

// Ключ ищем сначала с действием ('ошибка в десятках:add'), потом без него:
// у сложения и вычитания одна и та же ошибка объясняется разными словами.
function hintEntry(kind, opKey) {
    const table = resolveHints();
    if (!table || !kind) return null;
    return (opKey && table[kind + ':' + opKey]) || table[kind] || null;
}

// Какую клетку таблицы ученик посчитал на самом деле. Вид ошибки ставится
// ровно тогда, когда неверный ответ равен соседней клетке, — значит её можно
// назвать прямо, а не отделываться словом «соседняя».
function mulFactUsed(a, b, chosen) {
    const cands = [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]];
    for (const pair of cands) if (pair[0] * pair[1] === chosen) return pair;
    return null;
}

// Аргументы подстановки, отдельно для строки в игре и для разбора. Порядок
// описан в шапке content/hints.js и обязан совпадать во всех языках.
function hintArgs(kind, meta, problem, correct, chosen) {
    const op = meta && meta.opKey;
    const a = problem && problem.a, b = problem && problem.b;
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    const u = (x) => Math.abs(x) % 10;

    if (kind === 'ошибка в десятках') {
        // Про перенос и заём говорим, только если они в этом примере есть.
        // «10 + 7 = 17, выбрал 27» — единицы 0 + 7, наверх ничего не уходит,
        // и объяснять промах потерянным переносом значит врать. Молчим.
        if (op === 'add') {
            const su = u(a) + u(b);
            if (su < 10) return null;
            return { game: [], review: [a, b, u(a), u(b), su, su % 10] };
        }
        if (u(a) >= u(b)) return null;      // заёма нет — заём и не при чём
        return { game: [], review: [a, b] };
    }
    if (kind === 'ошибка в единицах') {
        // Столбик должен существовать. Если оба числа однозначные, единицы —
        // это и есть весь пример, и «посчитай отдельно 9 + 1» просто повторяет
        // условие. Это четверть всех срабатываний вида.
        if (Math.max(a, b) < 10) return null;
        if (op === 'add') { const su = u(a) + u(b); return { game: [u(a), u(b)], review: [a, b, u(a), u(b), su, su % 10] }; }
        if (typeof correct !== 'number') return null;
        return { game: [], review: [a, b, u(correct)] };
    }
    if (kind === 'не занял десяток') {
        return { game: [u(a), u(b), u(a) + 10],
                 review: [a, b, u(a), u(b), u(a) + 10, u(a) + 10 - u(b)] };
    }
    if (kind === 'таблица умножения') {
        const pair = mulFactUsed(a, b, chosen);
        if (!pair || typeof correct !== 'number') return null;
        // Клетка с нулём — формально соседняя, а сказать про неё нечего.
        if (pair[0] === 0 || pair[1] === 0) return null;
        return { game: [pair[0], pair[1], a, b, Math.abs(correct - chosen)],
                 review: [pair[0], pair[1], chosen, a, b, correct] };
    }
    if (kind === 'сложил вместо умножения') {
        // «1 × 6 — это 6 раза по 1» ничему не учит и звучит криво.
        if (a === 1 || b === 1) return null;
        const times = hintCountPhrase('times', b);
        return { game: [a, b, times], review: [a, b, correct, a + b, times] };
    }
    if (kind === 'перепутал действие') {
        return { game: [], review: [a, b, correct, chosen] };
    }
    if (kind === 'взял одно из чисел') {
        // При делителе 1 ответ равен делимому, и фраза «ответ всегда меньше
        // делимого» в разборе становится неправдой.
        if (b === 1) return null;
        return { game: [a, b], review: [a, b, correct] };
    }
    if (kind === 'ноль в примере') {
        if (op === 'div') return { game: [], review: [a, b] };
        // В умножении считаем нулями по второму множителю: «сложи восемь нулей».
        // Если оба нуля — считать нечего, молчим.
        if (a === 0 && b === 0) return null;
        return { game: [hintCountPhrase('zeros', a === 0 ? b : a)], review: [a, b] };
    }
    if (kind === 'делил на ноль') {
        return { game: [], review: [a] };
    }
    if (kind === 'ошибся на единицу') {
        return { game: [], review: [chosen, correct] };
    }
    return null;
}

// Готовый текст подсказки или пустая строка. Пустая — законный ответ: подсказки
// нет, файл не доехал, числа не сошлись. Игру это не должно задевать никак.
function hintText(form, kind, meta, problem, correct, chosen) {
    try {
        const entry = hintEntry(kind, meta && meta.opKey);
        if (!entry || !entry[form]) return '';
        const args = hintArgs(kind, meta, problem, correct, chosen);
        if (!args || !args[form]) return '';
        let out = entry[form];
        args[form].forEach((v, i) => { out = out.split('%' + (i + 1)).join(String(v)); });
        // Осталась неподставленная %N — значит шаблон и аргументы разъехались.
        // Показывать такое ученику нельзя, лучше промолчать.
        return /%\d/.test(out) ? '' : out;
    } catch (e) {
        return '';
    }
}

const HINT_OP_SIGNS = { add: '+', sub: '−', mul: '×', div: '÷' };

// Счётные слова склоняются, и на двузначных множителях это стало видно:
// «21 раза по 40» вместо «21 раз», «Сложи 2 нулей» вместо «2 нуля». Считаем
// словосочетание целиком и отдаём подсказке готовым одним аргументом: в
// остальных языках форма одна, но номер подстановки тот же, поэтому шаблоны
// всех четырёх языков остаются сверяемыми.
const HINT_COUNT_WORDS = {
    times: { ru: ['раз', 'раза', 'раз'], en: ['times'], fr: ['fois'], de: ['-mal'] },
    zeros: { ru: ['ноль', 'нуля', 'нулей'], en: ['zeros'], fr: ['zéros'], de: ['Nullen'] }
};

// 1, 21, 31 — первая форма; 2–4, 22–24 — вторая; остальное — третья.
function ruPluralIndex(n) {
    const d100 = Math.abs(n) % 100, d10 = Math.abs(n) % 10;
    if (d100 >= 11 && d100 <= 14) return 2;
    if (d10 === 1) return 0;
    if (d10 >= 2 && d10 <= 4) return 1;
    return 2;
}

function hintCountPhrase(what, n) {
    const table = HINT_COUNT_WORDS[what];
    if (!table) return String(n);
    const forms = table[(typeof LANG === 'string' && LANG) || 'ru'] || table.ru;
    const word = forms.length > 1 ? forms[ruPluralIndex(n)] : forms[0];
    // Немецкое «21-mal» пишется слитно, без пробела.
    return word.charAt(0) === '-' ? `${n}${word}` : `${n} ${word}`;
}

// Строка примера для карточки: «16 − 9 = 7». Карточка накрывает экран целиком,
// и без неё подсказка висит в воздухе — за ней не видно ни примера, ни ответа,
// и ученик не понимает, о чём вообще речь.
function hintProblemLine(meta, problem, correct) {
    const sign = HINT_OP_SIGNS[meta && meta.opKey];
    if (!sign || !problem || typeof problem.a !== 'number' || typeof problem.b !== 'number') return '';
    const right = (typeof correct === 'number') ? String(correct) : t('Нет решения');
    return `${problem.a} ${sign} ${problem.b} = ${right}`;
}

function hintChosenLine(chosen) {
    const what = (typeof chosen === 'number') ? String(chosen)
        : (chosen === 'NO_SOLUTION' ? t('Нет решения') : '');
    return what ? tf('ты выбрал %1', what) : '';
}

// Счётчики живут ровно одну миссию.
let sessionKindCounts = {};
let sessionHintsShown = 0;
let sessionHintKinds = {};

function resetSessionHints() {
    sessionKindCounts = {};
    sessionHintsShown = 0;
    sessionHintKinds = {};
    const box = document.getElementById('hintFreeze');
    if (box) box.hidden = true;
    const bar = document.getElementById('timerBar');
    if (bar) bar.classList.remove('frozen');
}

function shouldShowHint(kind) {
    if (!kind || HINT_NEVER.indexOf(kind) >= 0) return false;
    if (sessionHintsShown >= HINT_MAX_PER_SESSION) return false;
    if (sessionHintKinds[kind]) return false;
    return (sessionKindCounts[kind] || 0) >= HINT_REPEAT_AT;
}

// Заморозка. Часы миссии и полоска времени крутятся по одному флагу gameActive —
// снять его достаточно, чтобы всё встало. Ученику это видно: полоска покрывается
// инеем, поверх стоит надпись «время остановлено». Спешить незачем, поэтому
// автоскрытия нет: подсказка ждёт нажатия.
let hintFreezeResume = null;

function showHintFreeze(text, onDone, extra) {
    const done = typeof onDone === 'function' ? onDone : function () {};
    const box = document.getElementById('hintFreeze');
    if (!box || !text) { done(); return; }
    try {
        const put = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerText = value || '';
            el.hidden = !value;
        };
        put('hintFreezeExample', extra && extra.example);
        put('hintFreezeChosen', extra && extra.chosen);
        document.getElementById('hintFreezeText').innerText = text;
        document.getElementById('hintFreezeLabel').innerText = t('Время остановлено');
        document.getElementById('hintFreezeTap').innerText = t('Нажми, чтобы продолжить');
        const bar = document.getElementById('timerBar');
        if (bar) bar.classList.add('frozen');
        gameActive = false;
        box.hidden = false;
        hintFreezeResume = () => {
            hintFreezeResume = null;
            box.hidden = true;
            if (bar) bar.classList.remove('frozen');
            gameActive = true;
            done();
        };
        box.onclick = () => { if (hintFreezeResume) hintFreezeResume(); };
    } catch (e) {
        // Подсказка — надстройка. Что бы с ней ни случилось, игра обязана идти.
        box.hidden = true;
        gameActive = true;
        done();
    }
}
