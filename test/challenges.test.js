// Тесты задач за мастерство.
//
// Зачем: это награда за самую дорогую вещь в игре — минимум из трёх лесенок,
// доведённый до алмаза. Она обязана появиться ровно один раз и ровно за ту клетку,
// за которую заработана, и обязана НЕ появиться, если текстов нет: файл внешний.
//
// Отдельно стережём главное решение: доступность считается из уже имеющихся
// достижений, никакого нового поля в сохранении. Стоит завести своё поле — и у трёх
// живых учеников появится риск, которого сейчас нет.
//
// Как запускать:  node test/challenges.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function slice(startMark, endMark, what) {
    const from = SCRIPT.indexOf(startMark);
    const to = SCRIPT.indexOf(endMark, from + 1);
    if (from < 0 || to < 0) throw new Error(`не найдены границы среза: ${what}`);
    return SCRIPT.slice(from, to);
}

function loadContent() {
    const box = { window: {} };
    vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'content', 'challenges.js'), 'utf8'), box,
        { filename: 'content/challenges.js' });
    return box.window.CHALLENGE_CONTENT;
}

function makeDoc() {
    const byId = {};
    const el = (id) => (byId[id] = { id, hidden: false, _text: '',
        get innerText() { return this._text; }, set innerText(v) { this._text = String(v); },
        classList: { list: [], add(c) { this.list.push(c); }, remove(c) { this.list = this.list.filter(x => x !== c); },
                     contains(c) { return this.list.includes(c); } } });
    ['challengeReveal', 'challengeCap', 'challengeTopic', 'challengeTask', 'challengeAnswer',
     'challengeAnswerCap', 'challengeAnswerValue', 'challengeAnswerWhy',
     'challengeTap', 'winScreen'].forEach(el);
    return { doc: { getElementById: (id) => byId[id] || null }, byId };
}

function load(windowObj, opts) {
    const o = opts || {};
    const dom = makeDoc();
    const box = {
        console, Math, Number, Object, Array, String,
        window: windowObj, LANG: 'ru',
        t: (x) => x,
        tf: function (x) { let r = x; for (let i = 1; i < arguments.length; i++) r = r.split('%' + i).join(String(arguments[i])); return r; },
        TIER_ICONS: ['', '🥉', '🥈', '🥇', '💎', '👑'],
        MASTERY_MIN_TIER: 4,
        topicMasteryTier: (unlocks, key) => (unlocks && unlocks[key]) || 0,
        topicLabelWithLevel: (key) => key,
        showNextPuzzleReveal: () => !!o.puzzleFirst && !(box.puzzleShown = true),
        // Экран итогов теперь заодно проверяет, не начались ли технические работы.
        showStarUnlock: () => false,
        renderMaintenance: () => false,
        document: dom.doc
    };
    const src = slice('// ===================== ЗАДАЧИ ЗА МАСТЕРСТВО',
                      '// Показывает плашку о новом достижении', 'задачи')
        + ';globalThis.R = { challengeFor, earnedChallenges, showNextChallengeReveal,'
        + ' tapChallengeReveal, advanceMissionReveals, resolveChallenges,'
        + ' push: (k, t) => pendingChallengeReveals.push({ key: k, tier: t }),'
        + ' queued: () => pendingChallengeReveals.length };';
    vm.createContext(box);
    vm.runInContext(src, box, { filename: 'index.html<задачи>' });
    box.dom = dom;
    return box;
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; failures.push({ name, message: e.message }); console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'не выполнилось'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'не совпало'}: получили ${JSON.stringify(a)}, ждали ${JSON.stringify(b)}`); }
function group(name) { console.log(`\n${name}`); }

const CONTENT = loadContent();
const RU = CONTENT.ru;
const CELLS = Object.keys(RU);

group('Содержимое');

test('задача есть у каждой клетки целых чисел', () => {
    // Оба знака: положительные написаны первыми, отрицательные добавлены позже.
    // Десятичных и дробей здесь пока нет намеренно — там показывается честная
    // карточка «ещё не написано», и она проверяется отдельно ниже.
    ['integer+', 'integer-'].forEach(sec => {
        ['add', 'sub', 'mul', 'div'].forEach(op => {
            for (let lvl = 1; lvl <= 5; lvl++) {
                const key = `${sec}:${op}:${lvl}`;
                assert(RU[key], `нет задач для ${key}`);
            }
        });
    });
    eq(CELLS.length, 40, 'клеток должно быть сорок');
});

test('у каждой клетки две задачи: за алмаз и за легенду', () => {
    CELLS.forEach(key => {
        ['diamond', 'legend'].forEach(tier => {
            const item = RU[key][tier];
            assert(item && item.task && item.answer, `${key}: нет ${tier}`);
        });
    });
});

test('условие короткое, ответ отдельно от разбора', () => {
    // Ответ ученик ищет глазами, и он не должен тонуть в объяснении.
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const item = RU[key][tier];
        assert(item.task.length <= 200, `${key} ${tier}: условие ${item.task.length} знаков — длинновато`);
        assert(item.answer.length <= 40, `${key} ${tier}: ответ ${item.answer.length} знаков — это уже разбор`);
        assert(item.why && item.why.length >= 40, `${key} ${tier}: разбор пустой или слишком короткий`);
        assert(item.answer !== item.task, `${key} ${tier}: ответ повторяет условие`);
        assert(!/\.$/.test(item.answer), `${key} ${tier}: у короткого ответа точки в конце быть не должно`);
    }));
});

test('у каждой задачи три части: условие, ответ, разбор', () => {
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const item = RU[key][tier];
        ['task', 'answer', 'why'].forEach(f => {
            assert(typeof item[f] === 'string' && item[f].trim(), `${key} ${tier}: пусто поле ${f}`);
        });
    }));
});

test('условие спрашивает', () => {
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        assert(/[?]/.test(RU[key][tier].task), `${key} ${tier}: условие ничего не спрашивает`);
    }));
});

test('ответ отделён от разбора и в карточке достижений', () => {
    // Два места показа не должны разъехаться: и там, и там сначала «Ответ», потом число.
    const from = SCRIPT.indexOf('earnedChallenges(unlocks, key).forEach');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('return card;', from));
    assert(/ladder-challenge-answer-value/.test(body), 'нет отдельной строки ответа');
    assert(/ladder-challenge-answer-why/.test(body), 'нет отдельной строки разбора');
    assert(/item\.why/.test(body), 'разбор не берётся из задачи');
});

test('задачи не повторяются', () => {
    const seen = {};
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const t = RU[key][tier].task;
        assert(!seen[t], `задача повторяется: ${key} ${tier} и ${seen[t]}`);
        seen[t] = `${key} ${tier}`;
    }));
});

test('приём не повторяется дважды', () => {
    // Дословных повторов условия не было — а повторы ПРИЁМА были, и это хуже:
    // мастерство берётся раз в несколько месяцев, «ага» и есть вся его ценность,
    // а второй раз того же поворота её убивает. Три пары почти совпадали:
    //   • сумма 20 и разница 4 → 12 и 8: два числа (сложение) и верёвка (вычитание);
    //   • лист сложили пополам: три раза (👑 1★) и пять раз (💎 2★);
    //   • пары с концов: 1…10 (👑 2★) и 1…100 (💎 5★).
    //
    // Честно про эту проверку: она НЕ ищет новые повторы — приём машине не виден.
    // Она держит те, что уже нашлись, чтобы правка не вернула их обратно. Новые
    // ловит только чтение всех сорока подряд.
    const once = [
        [/сложил[аи] пополам/i, 'лист складывают пополам'],
        [/пар(ами|ы) с концов/i, 'сложение парами с концов'],
        [/на 4 (метра длиннее|больше другого)/i, 'сумма и разница на 4']
    ];
    const all = [];
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const x = RU[key][tier];
        all.push({ where: `${key} ${tier}`, text: `${x.task} ${x.why}` });
    }));
    once.forEach(([re, name]) => {
        const hits = all.filter(x => re.test(x.text)).map(x => x.where);
        assert(hits.length <= 1, `приём «${name}» стоит дважды: ${hits.join(' и ')}`);
    });
});

test('ответ — ответ, а не начало разбора', () => {
    // Замысел файла: «ответ ученик ищет глазами». Ему мешало двоеточие («Два:
    // получается 1200», «Семь: от 8 до 14») и вычисление прямо в ответе
    // («100 ÷ 4 = 25, это больше, чем 20»). Обе приметы машине видны.
    //
    // Честно: «Поровну, оба равны 96» ни одна из примет не ловит — 21 знак, ни
    // двоеточия, ни равенства. Такое видно только глазами при чтении.
    ['ru', 'en', 'fr', 'de'].forEach(lang => {
        const table = CONTENT[lang];
        CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
            const a = table[key][tier].answer;
            assert(a.indexOf(':') < 0, `${lang} ${key} ${tier}: в ответе двоеточие — «${a}»`);
            assert(a.indexOf('=') < 0, `${lang} ${key} ${tier}: в ответе вычисление — «${a}»`);
            assert(a.length <= 26, `${lang} ${key} ${tier}: ответ ${a.length} знаков — «${a}»`);
        }));
    });
});

test('в условиях нет школьных существительных', () => {
    // «Множители», «делимое», «частное» ребёнок слышит только на уроке, и
    // условие с ними читается как контрольная, а не как загадка. Замер до
    // правки: у отрицательных таких условий было десять из сорока, и все
    // сидели в умножении и делении.
    //
    // Запрещены именно СУЩЕСТВИТЕЛЬНЫЕ. Глаголы «перемножили», «разделили»,
    // «прибавили» разрешены и остаются: их знают все.
    //
    // Разбор (why) проверка не трогает: там объяснение, и назвать вещи своими
    // именами уместно. Речь только про условие, которое читают первым.
    const TERMS = /множител|делимо|делител|произведени|слагаемо|частно|уменьшаемо|вычитаемо|разность|модул/i;
    const bad = [];
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const m = RU[key][tier].task.match(TERMS);
        if (m) bad.push(`${key} ${tier}: «${m[0]}»`);
    }));
    assert(bad.length === 0, bad.join('; '));
});

test('в задачах нет прошедшего времени во втором лице', () => {
    // По-русски «ты съел» подходит мальчику и не подходит девочке, а пол мы не
    // спрашиваем. Обращаться к ученику можно — но повелительным наклонением
    // («задумай число») или безлично («в вазе было десять конфет»).
    //
    // Границы слова тут нельзя задавать через \b: в JavaScript он знает только
    // латиницу, и рядом с кириллицей его просто нет.
    const bad = [];
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const x = RU[key][tier];
        [x.task, x.answer, x.why].forEach(v => {
            const m = v.match(/(?<![а-яё])(ты\s+[а-яё]+л|тебе|тебя|у тебя)(?![а-яё])/i);
            if (m) bad.push(`${key} ${tier}: «${m[0]}»`);
        });
    }));
    assert(bad.length === 0, bad.join('; '));
});

group('Все языки, а не только русский');

// Проверки выше смотрят только на русский — а показывается ученику тот язык, который
// он выбрал. Пока переводов не было, приложение молча выдавало русский текст
// француженке; теперь их четыре, и разъехаться они не должны.
const LANGS = ['ru', 'en', 'fr', 'de'];

test('во всех языках одни и те же клетки и ступени', () => {
    LANGS.forEach(lang => {
        const dict = CONTENT[lang];
        assert(dict, `нет языка ${lang}`);
        eq(Object.keys(dict).sort().join(','), CELLS.slice().sort().join(','), `клетки в ${lang}`);
        CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
            assert(dict[key] && dict[key][tier], `${lang} ${key}: нет ступени ${tier}`);
        }));
    });
});

test('в каждом языке у задачи три части и те же правила длины', () => {
    LANGS.forEach(lang => CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const item = CONTENT[lang][key][tier];
        assert(item.task && item.answer && item.why, `${lang} ${key} ${tier}: части не заполнены`);
        assert(item.task.length <= 200, `${lang} ${key} ${tier}: условие ${item.task.length} знаков`);
        assert(item.answer.length <= 40, `${lang} ${key} ${tier}: ответ ${item.answer.length} знаков — это уже разбор`);
        assert(item.why.length >= 40, `${lang} ${key} ${tier}: разбор слишком короткий`);
        assert(!/\.$/.test(item.answer), `${lang} ${key} ${tier}: точка в конце короткого ответа`);
    })));
});

test('перевод нигде не остался русским текстом', () => {
    // Самая частая беда переводов — забытая строка. Кириллица в английском тексте
    // видна сразу, и искать её глазами по сорока задачам никто не станет.
    ['en', 'fr', 'de'].forEach(lang => CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const item = CONTENT[lang][key][tier];
        ['task', 'answer', 'why'].forEach(part => {
            assert(!/[А-Яа-яЁё]/.test(item[part]), `${lang} ${key} ${tier}: ${part} остался русским`);
        });
    })));
});

test('переводы не копируют друг друга дословно', () => {
    // Копия русского, прогнанная мимо, выглядит как перевод, но им не является.
    CELLS.forEach(key => ['diamond', 'legend'].forEach(tier => {
        const seen = new Set(LANGS.map(l => CONTENT[l][key][tier].task));
        eq(seen.size, LANGS.length, `${key} ${tier}: одинаковые условия в разных языках`);
    }));
});

group('Что и когда открыто');

const H = load({ CHALLENGE_CONTENT: CONTENT });

test('до алмаза задач нет', () => {
    eq(H.R.earnedChallenges({ 'integer+:add:1': 3 }, 'integer+:add:1').length, 0);
});

test('за алмаз открывается одна', () => {
    const got = H.R.earnedChallenges({ 'integer+:add:1': 4 }, 'integer+:add:1');
    eq(got.length, 1);
    eq(got[0].tier, 4);
});

test('за легенду открываются обе', () => {
    const got = H.R.earnedChallenges({ 'integer+:add:1': 5 }, 'integer+:add:1');
    eq(got.length, 2, 'алмазную задачу не отбирают');
    eq(got[1].tier, 5);
});

test('доступность считается из достижений, а не из своего поля', () => {
    // Стоит завести отдельное хранилище — и у живых учеников появится риск.
    const body = slice('function earnedChallenges', 'let pendingChallengeReveals', 'earnedChallenges');
    assert(/topicMasteryTier/.test(body), 'должна опираться на уже посчитанное мастерство');
    assert(!/Progress\.(set|get)Collection|localStorage/.test(body), 'своего хранилища быть не должно');
});

test('у чужой клетки задачи нет', () => {
    // Десятичные и дроби ещё не написаны: там мастерство показывает карточку
    // «ещё не написано», а не молчит. Отрицательные из этого списка ушли —
    // у них теперь свои сорок задач.
    eq(H.R.challengeFor('decimal+:mul:2', 4), null);
    eq(H.R.challengeFor('fraction+:simplify:3', 4), null);
});

group('Показ после миссии');

test('карточка показывается с условием и без ответа', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:mul:3', 4);
    eq(box.R.showNextChallengeReveal(), true);
    eq(box.dom.byId.challengeReveal.hidden, false, 'окно должно открыться');
    eq(box.dom.byId.challengeTask.innerText, RU['integer+:mul:3'].diamond.task);
    eq(box.dom.byId.challengeAnswerValue.innerText, RU['integer+:mul:3'].diamond.answer);
    eq(box.dom.byId.challengeAnswerWhy.innerText, RU['integer+:mul:3'].diamond.why);
    eq(box.dom.byId.challengeAnswer.hidden, true, 'ответ закрыт до тапа');
});

test('первый тап раскрывает ответ, второй закрывает', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:mul:3', 4);
    box.R.showNextChallengeReveal();
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeAnswer.hidden, false, 'ответ должен раскрыться');
    eq(box.dom.byId.challengeReveal.hidden, false, 'окно ещё не закрывается');
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeReveal.hidden, true, 'второй тап закрывает');
});

test('после последней задачи открывается экран итогов', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:div:1', 4);
    box.R.showNextChallengeReveal();
    box.R.tapChallengeReveal();
    box.R.tapChallengeReveal();
    assert(box.dom.byId.winScreen.classList.contains('active'), 'экран итогов должен показаться');
});

test('две ступени разом показываются по очереди', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:add:2', 4);
    box.R.push('integer+:add:2', 5);
    box.R.showNextChallengeReveal();
    eq(box.dom.byId.challengeTask.innerText, RU['integer+:add:2'].diamond.task);
    box.R.tapChallengeReveal();
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeTask.innerText, RU['integer+:add:2'].legend.task, 'вторая задача');
    assert(!box.dom.byId.winScreen.classList.contains('active'), 'итоги ждут своей очереди');
});

test('мастерство без задачи не молчит', () => {
    // Сорок задач написаны только для положительных чисел. В остальных разделах
    // мастерство до сих пор не давало НИЧЕГО и молча: очередь пополнялась только
    // когда текст находился. Самая дорогая вещь в игре приходила пустой, и ученик
    // мог решить, что награда сломалась. Чего нет — про то и говорим прямо.
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('fraction+:mul:3', 4);
    eq(box.R.showNextChallengeReveal(), true, 'окно должно открыться и без задачи');
    eq(box.dom.byId.challengeReveal.hidden, false);
    assert(/Медаль уже твоя/.test(box.dom.byId.challengeTask.innerText),
        `сказано: «${box.dom.byId.challengeTask.innerText}»`);
    eq(box.dom.byId.challengeAnswerValue.innerText, '', 'раскрывать нечего — ответа нет');
});

test('окно без задачи закрывается первым тапом', () => {
    // Раскрывать там нечего, и второй тап пришёлся бы по пустому месту.
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('fraction+:mul:3', 4);
    box.R.showNextChallengeReveal();
    box.R.tapChallengeReveal();
    eq(box.dom.byId.challengeReveal.hidden, true, 'первый тап должен закрыть');
});

test('заголовок отличает легенду от алмаза', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.push('integer+:sub:5', 5);
    box.R.showNextChallengeReveal();
    assert(/👑/.test(box.dom.byId.challengeCap.innerText), box.dom.byId.challengeCap.innerText);
});

group('Очередь и постановка в неё');

test('в очередь попадает каждая новая ступень, а не только верхняя', () => {
    // Алмаз и легенда могут прийти одним ответом. Если ставить в очередь только
    // верхнюю, алмазная задача потеряется молча и навсегда.
    const from = SCRIPT.indexOf('if (mastery > masteryBefore && mastery >= MASTERY_MIN_TIER)');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('return fresh;', from));
    assert(/for \(let tier = masteryBefore \+ 1; tier <= mastery/.test(body),
        'перебирать надо все ступени от прошлой до новой');
});

test('в очередь ставит наличие файла, а не наличие текста', () => {
    // Условием было «нашёлся текст для этой клетки» — и мастерство в разделах без
    // задач не давало ничего, молча. Это надо проверять на структуре: сам показ
    // окна проверяется выше, но туда очередь наполняется руками, минуя это место.
    const from = SCRIPT.indexOf('if (mastery > masteryBefore && mastery >= MASTERY_MIN_TIER)');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('return fresh;', from));
    assert(/if \(resolveChallenges\(\)\) pendingChallengeReveals\.push/.test(body),
        'в очередь снова ставится только то, для чего нашёлся текст');
});

test('очередь задач чистится вместе со счётчиками миссии', () => {
    // Иначе задача из прошлой миссии всплывёт в конце следующей.
    const from = SCRIPT.indexOf('function resetSessionCounters');
    const body = SCRIPT.slice(from, SCRIPT.indexOf('\n        }', from));
    assert(/pendingChallengeReveals = \[\]/.test(body), 'очередь должна обнуляться');
    assert(/challengeReveal'\)\.hidden = true/.test(body), 'окно должно закрываться');
});

group('Когда текстов нет');

test('без файла с задачами мастерство просто не даёт карточку', () => {
    const box = load({});
    eq(box.R.challengeFor('integer+:add:1', 4), null);
    box.R.push('integer+:add:1', 4);
    eq(box.R.showNextChallengeReveal(), false, 'показывать нечего');
});

test('пустая очередь ведёт прямо к итогам', () => {
    const box = load({ CHALLENGE_CONTENT: CONTENT });
    box.R.advanceMissionReveals();
    assert(box.dom.byId.winScreen.classList.contains('active'));
});

test('пазлы показываются раньше задач', () => {
    // Иначе задача перебивает картинку, ради которой собирали сто кусочков.
    const body = slice('function advanceMissionReveals', '// Показывает плашку', 'очередь наград');
    const puzzleAt = body.indexOf('showNextPuzzleReveal');
    const challengeAt = body.indexOf('showNextChallengeReveal');
    assert(puzzleAt > 0 && challengeAt > puzzleAt, 'пазл должен идти первым');
});

console.log(`\nВсего: ${passed + failed}, прошло: ${passed}, упало: ${failed}`);
if (failed) {
    console.log('\nУпавшие проверки:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.message}`));
    process.exit(1);
}
