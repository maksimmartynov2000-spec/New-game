// Хранилище прогресса. Код, а не содержимое.
//
// Вынесено из index.html отдельным файлом: это тысяча строк, которые не касаются
// ни экранов, ни генератора, и снаружи модуль зовёт только встроенные функции —
// значит, его можно и читать, и проверять отдельно от всего остального.
//
// ВАЖНО, чем этот файл отличается от content/*.js: те — данные, и если они не
// доехали, игра работает просто без них. Этот файл — код. Не доехал — приложения
// нет. Поэтому он подключается первым и никаких «мягких» запасных путей на случай
// его отсутствия в index.html нет и быть не должно.

// =====================================================================
//  ХРАНИЛИЩЕ ПРОГРЕССА
// ---------------------------------------------------------------------
//  Единственное место во всём приложении, которое знает, ГДЕ лежат данные.
//  Остальной код работает только через Progress.* и понятия не имеет,
//  локальное это хранилище или сервер.
//
//  Модель: локальное хранилище — быстрый кэш, сервер — источник правды.
//  Игра никогда не ждёт сеть: пишем всегда локально и мгновенно,
//  а на сервер отправляем на контрольных точках (см. Progress.flush).
//
//  Слияние конфликтов (телефон + планшет) решается тем, что весь прогресс
//  здесь ТОЛЬКО РАСТЁТ: решённых примеров не становится меньше, собранная
//  картинка не рассобирается, открытый скин не закрывается. Поэтому
//  слияние = максимум по счётчикам и объединение по спискам, и потерять
//  данные "последняя запись затёрла первую" структурно невозможно.
// =====================================================================
// Идентификатор ступени лесенки: '<ключ темы>:<лесенка><ступень>', например
// 'integer+:add:1:s3'. Достижения «вообще» — старое 'streak7' и легаси
// 'master:fraction:add' — под это не подходят и нигде больше не считаются:
// достижения теперь бывают только по темам. Живёт здесь, а не рядом с лесенками,
// потому что нужен и модулю прогресса, который объявлен раньше.
const LADDER_ID_RE = /^(.+):([sac])([1-5])$/;

const Progress = (() => {
    const LOCAL_KEY = 'mathCitadelState_v3';
    const SCHEMA = 2;

    // Пустое состояние. Всё, что должно переживать перезапуск, живёт здесь.
    function emptyState() {
        return {
            schema: SCHEMA,
            playerCode: null,      // код ученика; null = играет анонимно на этом устройстве
            updatedAt: 0,

            profileLabel: '',      // имя, которое видно только на этом устройстве и в списке учеников
            accountType: 'self',   // 'self' — завёл себе сам; 'linked' — код выдал репетитор
            ownerCode: null,       // для accountType 'linked' — код репетитора, который выдал этот код

            config: null,          // последняя выбранная настройка примеров

            // Прогресс текущего пазла: какая картинка и сколько кусочков собрано
            puzzle: { idx: null, filled: 0 },

            // Коллекции по id. Сейчас коллекция одна ('paradoxes'), но структура
            // сразу рассчитана на то, что их станет несколько.
            collections: { paradoxes: [] },

            // Накопительная статистика за всё время — на ней будут строиться
            // достижения, скины и учительские отчёты.
            totals: { correct: 0, wrong: 0, puzzlesCompleted: 0 },
            byTopic: {},           // { 'fraction:add': { correct: N, wrong: N }, ... }

            // Виды ошибок за всё время, по темам:
            //   { 'fraction+:add:3': { 'сложил знаменатели': 12, 'не сократил': 4 } }
            // Отвечает на вопрос, который счётчик ошибок задать не позволял:
            // ученик ошибается вразнобой или у него одна и та же дыра.
            errorKinds: {},

            // Разбор по типам примеров — целые положительные: сложение,
            // вычитание, умножение. Отвечает на вопрос, которого нет ни у одной другой
            // записи: внутри одной клетки проседает всё подряд или конкретный
            // тип примера. Ключ — тема, значение — по классу:
            //   { 'integer+:sub:5': { '2': [верно, ошибок, мс, ответов], 'h': [...] } }
            // Классы '0' / '1' / '2' — без перехода, дополнение до круглого,
            // полный переход; они не пересекаются и в сумме дают всю клетку.
            // Ключ 'h' — переход через сотню (двойной заём). Он ПЕРЕСЕКАЕТСЯ
            // с остальными: это подмножество, а не четвёртый класс.
            byClass: {},

            // Журнал по дням — единственное место, где вообще есть измерение времени.
            // Без него нельзя ответить ни на один вопрос вида "а что изменилось за месяц":
            // totals/byTopic выше пожизненные и только растут, из них динамику не достать.
            // Ключ — локальная (не UTC) дата 'ГГГГ-ММ-ДД', см. dayKey().
            // Значение — компактная корзина, см. emptyDay().
            daily: {},

            unlocks: {},           // достижения: { id: 'ГГГГ-ММ-ДД' } — дата первого получения

            // Заметки репетитора об учениках: { кодУченика: текст }. Лежат в аккаунте
            // РЕПЕТИТОРА, а не ученика — это рабочая запись преподавателя, и ученик
            // не должен её видеть, открыв своё приложение.
            studentNotes: {},
            studentGroups: {},     // { код ученика: название папки }

            // Карточки эпох: замороженные сводки за прошедшие отрезки по 180 дней.
            // { '1': { from, to, days, c, w, a, s, p, ms, mc, top: [...], badges: N } }
            // Ключ — номер эпохи, считается от первого записанного дня.
            //
            // ВАЖНО: это СНИМОК, а не копилка. Цифры карточки нигде не складываются
            // с текущими — все живые периоды считаются только по daily. Именно поэтому
            // подчистка журнала безопасна: если старое устройство при слиянии вернёт
            // уже свёрнутый день, он просто снова подчистится, и двойного счёта
            // возникнуть не может.
            epochs: {}
        };
    }

    // Корзина одного дня. Поля короткие намеренно: этот объект уходит на сервер
    // при каждом сохранении, и на длинной дистанции размер начинает иметь значение.
    //   c  — верных ответов
    //   w  — ошибок
    //   a  — "почти" (посчитал верно, но забыл сократить) — в c тоже попадает
    //   s  — секунд за игрой
    //   p  — собрано пазлов
    //   ms — суммарное время раздумий на верных ответах, мс
    //   mc — сколько ответов попало в ms (чтобы считать среднее)
    //   t  — по темам: { 'integer+:add:1': [верно, ошибок, почти, время(мс), ответов ко времени] }
    function emptyDay() {
        // e  — виды ошибок за день одной плоской картой { 'сложил знаменатели': 3 }.
        //      Отвечает на вопрос «над чем работать вообще».
        // te — то же самое, но по клеткам: { 'integer-:mul:3': { 'ошибся в знаке': 4 } }.
        //      Раньше разбивки по темам здесь намеренно не было — считалось, что это
        //      восемь ключей на день против восьмисот. Оценка оказалась завышенной:
        //      восемьсот — это теоретический максимум (сорок клеток на все виды ошибок),
        //      а за один день ученик трогает две-три клетки и делает в них два-три
        //      разных промаха. Зато без разбивки нельзя ответить на вопрос, ради
        //      которого учитель сюда и приходит: «ошибается вразнобой или у него одна
        //      дыра — и в каком именно месте». Глубину ограничивает сам журнал:
        //      te живёт ровно столько, сколько живут дни, и старше не бывает.
        return { c: 0, w: 0, a: 0, s: 0, p: 0, ms: 0, mc: 0, t: {}, e: {}, te: {} };
    }

    // Дата ПО МЕСТНОМУ ВРЕМЕНИ, а не по UTC. toISOString() здесь был бы багом:
    // у нас вечерние занятия уехали бы в "завтра", и серии дней подряд врали бы.
    function dayKey(d) {
        const dt = d || new Date();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${dt.getFullYear()}-${m}-${day}`;
    }

    // Сколько дней журнала храним. Самый длинный период, который можно выбрать на
    // экране, — 180 дней; 200 даёт запас и при этом вдвое дешевле прежних 400 по
    // размеру и трафику (состояние уходит на сервер целиком при каждой синхронизации).
    // Один день = максимум одна запись, поэтому 200 записей всегда покрывают
    // не меньше 200 календарных дней — 180-дневный обзор не может остаться без данных.
    //
    // Ничего не теряется безвозвратно: перед подчисткой отрезок замораживается в
    // карточку эпохи (см. EPOCH_DAYS) — компактный снимок за 180 дней, который
    // хранится вечно.
    const DAILY_KEEP_DAYS = 200;
    function pruneDaily(daily) {
        const keys = Object.keys(daily);
        if (keys.length <= DAILY_KEEP_DAYS) return daily;
        keys.sort(); // 'ГГГГ-ММ-ДД' сортируется как строка правильно
        for (let i = 0; i < keys.length - DAILY_KEEP_DAYS; i++) delete daily[keys[i]];
        return daily;
    }

    // Время ответа по темам нужно ТОЛЬКО лесенке скорости, а она смотрит на последнюю
    // сотню попыток — то есть на считанные дни. Отчёты и статистика берут скорость из
    // дневного ms/mc, а не из тем. Поэтому у записей старше 30 дней хвост со временем
    // просто отбрасываем: счётчики верно/ошибок/почти остаются на всю глубину периода,
    // а самая объёмная часть живёт ровно столько, сколько реально используется.
    const TOPIC_SPEED_KEEP_DAYS = 30;
    function trimTopicSpeed(daily) {
        const keys = Object.keys(daily).sort();
        const cutoff = keys.length - TOPIC_SPEED_KEEP_DAYS;
        for (let i = 0; i < cutoff; i++) {
            const t = daily[keys[i]] && daily[keys[i]].t;
            if (!t) continue;
            Object.keys(t).forEach(k => {
                if (t[k] && t[k].length > 3) t[k] = t[k].slice(0, 3);
            });
        }
        return daily;
    }

    let state = emptyState();
    let dirty = false;

    // Локальный кэш ВСЕХ профилей, что когда-либо были активны на этом устройстве —
    // так два ребёнка на одном айпаде могут переключаться между своими аккаунтами,
    // не теряя офлайн-копию прогресса друг друга. Ключ — код профиля.
    let profiles = {};

    // Что этому ученику разрешено решать. Живёт РЯДОМ с состоянием, а не внутри:
    // это не прогресс ученика, а решение репетитора, и сливать его по правилу
    // «только растёт» нельзя — отозванный доступ обязан исчезать, а не выживать.
    // Правда о доступе на сервере; здесь только слепок, чтобы работало офлайн.
    //
    // null означает «мы ещё не спрашивали» — и это НЕ то же самое, что «ничего
    // не разрешено». Пока не спросили, открыто всё: иначе ученик оказался бы
    // заперт из-за отсутствия сети или неподнятой серверной части.
    let access = null;

    // Токены сессий — основной способ подтверждать личность при каждом запросе
    // к серверу (в т.ч. при тихих фоновых flush()). Токен ничего не значит нигде,
    // кроме этого приложения, гасится по одному и сам протухает.
    let tokens = {};

    // Пароли профилей — запасной путь, только пока устройство не успело обменять
    // пароль на токен (см. ensureSessions в блоке синхронизации). После обмена
    // пароль отсюда стирается и больше на устройстве не хранится.
    let passwords = {};

    // Чем подтверждать запрос по этому коду: токеном, если он уже есть,
    // иначе паролем (старый путь). null — подтверждать нечем, синхронизации нет.
    function authFor(code) {
        if (!code) return null;
        if (tokens[code]) return { token: tokens[code] };
        if (passwords[code]) return { password: passwords[code] };
        return null;
    }

    // --- драйвер хранилища -------------------------------------------
    // Пока реализован только локальный. Серверный подключается сюда же,
    // не затрагивая остальное приложение. Хранит не одно состояние, а конверт
    // { activeCode, profiles } — все известные устройству профили разом.
    const localDriver = {
        read() {
            try {
                const raw = localStorage.getItem(LOCAL_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) { return null; }
        },
        write(envelope) {
            try { localStorage.setItem(LOCAL_KEY, JSON.stringify(envelope)); } catch (e) { /* хранилище недоступно */ }
        }
    };
    let remoteDriver = null; // будет назначен при подключении сервера

    // --- слияние двух состояний --------------------------------------
    function mergeState(a, b) {
        if (!a) return b;
        if (!b) return a;
        const out = emptyState();

        out.playerCode = b.playerCode || a.playerCode;
        out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);

        // Имя, тип аккаунта и владелец — не прогресс, тут тоже побеждает более свежая запись.
        // Строго ">" (не ">="): при первом входе на новый код на устройстве локальная
        // заготовка тоже стартует с updatedAt=0 — ровно как только что созданный сервером
        // аккаунт ученика. При ничьей должен побеждать сервер, иначе пустая локальная
        // заготовка (accountType:'self' по умолчанию) затирает настоящие accountType/
        // ownerCode/имя, которые репетитор задал при создании — и это ещё и пишется
        // обратно на сервер при следующем flush(), реально портя запись.
        out.profileLabel = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.profileLabel : a.profileLabel) || '';
        out.accountType = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.accountType : a.accountType) || 'self';
        out.ownerCode = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.ownerCode : a.ownerCode) || null;

        // Настройки — не прогресс, здесь честно побеждает более свежая запись.
        out.config = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.config : a.config) || null;

        // Заметки об учениках — тоже не прогресс, а текст: побеждает более свежая
        // запись целиком. Сливать пословно нечего, а склеивать две версии одной
        // заметки было бы хуже, чем взять ту, что писали последней.
        out.studentNotes = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.studentNotes : a.studentNotes) || {};

        // Папки учеников — по той же причине, что и заметки: это раскладка,
        // которую репетитор ведёт руками, а не прогресс, который надо копить.
        // Побеждает более свежая запись целиком, иначе удалённая на одном
        // устройстве папка возвращалась бы с другого.
        out.studentGroups = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.studentGroups : a.studentGroups) || {};

        // Кусочки пазла: если это одна и та же картинка — берём больший прогресс,
        // если разные — берём тот, что записан позже.
        if (a.puzzle && b.puzzle && a.puzzle.idx === b.puzzle.idx) {
            out.puzzle = { idx: a.puzzle.idx, filled: Math.max(a.puzzle.filled || 0, b.puzzle.filled || 0) };
        } else {
            out.puzzle = ((b.updatedAt || 0) > (a.updatedAt || 0) ? b.puzzle : a.puzzle) || { idx: null, filled: 0 };
        }

        // Коллекции: объединение — собранное на одном устройстве остаётся собранным.
        const ids = new Set([...Object.keys(a.collections || {}), ...Object.keys(b.collections || {})]);
        out.collections = {};
        ids.forEach(id => {
            const x = (a.collections && a.collections[id]) || [];
            const y = (b.collections && b.collections[id]) || [];
            const len = Math.max(x.length, y.length);
            const merged = new Array(len).fill(false);
            for (let i = 0; i < len; i++) merged[i] = !!x[i] || !!y[i];
            out.collections[id] = merged;
        });

        // Счётчики только растут — берём максимум.
        out.totals = {
            correct: Math.max((a.totals && a.totals.correct) || 0, (b.totals && b.totals.correct) || 0),
            wrong: Math.max((a.totals && a.totals.wrong) || 0, (b.totals && b.totals.wrong) || 0),
            puzzlesCompleted: Math.max((a.totals && a.totals.puzzlesCompleted) || 0, (b.totals && b.totals.puzzlesCompleted) || 0)
        };

        // Виды ошибок — такие же счётчики «только вверх», как byTopic.
        out.errorKinds = {};
        const ekTopics = new Set([...Object.keys(a.errorKinds || {}), ...Object.keys(b.errorKinds || {})]);
        ekTopics.forEach(t => {
            const x = (a.errorKinds && a.errorKinds[t]) || {};
            const y = (b.errorKinds && b.errorKinds[t]) || {};
            const merged = {};
            new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => {
                merged[k] = Math.max(x[k] || 0, y[k] || 0);
            });
            out.errorKinds[t] = merged;
        });

        // Разбор по типам — те же счётчики «только вверх», что и byTopic.
        out.byClass = {};
        const bcTopics = new Set([...Object.keys(a.byClass || {}), ...Object.keys(b.byClass || {})]);
        bcTopics.forEach(t => {
            const x = (a.byClass && a.byClass[t]) || {};
            const y = (b.byClass && b.byClass[t]) || {};
            const merged = {};
            new Set([...Object.keys(x), ...Object.keys(y)]).forEach(cls => {
                const p = x[cls] || [], q = y[cls] || [];
                merged[cls] = [
                    Math.max(p[0] || 0, q[0] || 0),
                    Math.max(p[1] || 0, q[1] || 0),
                    Math.max(p[2] || 0, q[2] || 0),
                    Math.max(p[3] || 0, q[3] || 0)
                ];
            });
            out.byClass[t] = merged;
        });

        const topics = new Set([...Object.keys(a.byTopic || {}), ...Object.keys(b.byTopic || {})]);
        out.byTopic = {};
        topics.forEach(t => {
            const x = (a.byTopic && a.byTopic[t]) || {};
            const y = (b.byTopic && b.byTopic[t]) || {};
            out.byTopic[t] = {
                correct: Math.max(x.correct || 0, y.correct || 0),
                wrong: Math.max(x.wrong || 0, y.wrong || 0)
            };
        });

        // Журнал по дням: объединяем дни, а внутри одного дня берём максимум по
        // каждому счётчику — ровно та же логика "только растёт", что и у totals.
        //
        // Компромисс, который стоит назвать вслух: если ребёнок занимался в один и тот
        // же день и на телефоне, и на планшете, максимум возьмёт больший из двух, а не
        // сумму, — то есть день слегка недосчитается. Это выбрано осознанно: сложение
        // здесь некорректно, потому что слияние повторяется (при каждом flush), и одни
        // и те же ответы складывались бы снова и снова, надувая статистику. Лучше чуть
        // занизить, чем показать родителю цифры, которых не было.
        const days = new Set([...Object.keys(a.daily || {}), ...Object.keys(b.daily || {})]);
        out.daily = {};
        days.forEach(k => {
            const x = (a.daily && a.daily[k]) || {};
            const y = (b.daily && b.daily[k]) || {};
            const bucket = emptyDay();
            ['c', 'w', 'a', 's', 'p', 'ms', 'mc'].forEach(f => {
                bucket[f] = Math.max(x[f] || 0, y[f] || 0);
            });
            const ek = new Set([...Object.keys(x.e || {}), ...Object.keys(y.e || {})]);
            ek.forEach(k => { bucket.e[k] = Math.max((x.e || {})[k] || 0, (y.e || {})[k] || 0); });

            // Ошибки по клеткам — по тому же правилу «максимум», что и всё в дне.
            const teKeys = new Set([...Object.keys(x.te || {}), ...Object.keys(y.te || {})]);
            teKeys.forEach(topic => {
                const p = (x.te || {})[topic] || {}, q = (y.te || {})[topic] || {};
                const cell = {};
                new Set([...Object.keys(p), ...Object.keys(q)]).forEach(kind => {
                    cell[kind] = Math.max(p[kind] || 0, q[kind] || 0);
                });
                bucket.te[topic] = cell;
            });

            const tk = new Set([...Object.keys(x.t || {}), ...Object.keys(y.t || {})]);
            tk.forEach(key => {
                const p = (x.t && x.t[key]) || [];
                const q = (y.t && y.t[key]) || [];
                // [верно, ошибок, почти, суммарное время верных (мс), сколько ответов в этом времени]
                const slot = [
                    Math.max(p[0] || 0, q[0] || 0),
                    Math.max(p[1] || 0, q[1] || 0),
                    Math.max(p[2] || 0, q[2] || 0),
                    Math.max(p[3] || 0, q[3] || 0),
                    Math.max(p[4] || 0, q[4] || 0)
                ];
                bucket.t[key] = slot;
            });
            out.daily[k] = bucket;
        });
        trimTopicSpeed(out.daily);
        pruneDaily(out.daily);

        // Карточки эпох: объединение по номеру эпохи, при конфликте — максимум по
        // каждому полю. Границы эпох считаются от первого записанного дня по формуле,
        // поэтому оба устройства всегда получают одинаковый номер для одного отрезка,
        // а максимум разрешает случай, когда одно устройство знало о днях больше.
        out.epochs = {};
        const epochKeys = new Set([...Object.keys(a.epochs || {}), ...Object.keys(b.epochs || {})]);
        epochKeys.forEach(k => {
            const x = (a.epochs && a.epochs[k]) || null;
            const y = (b.epochs && b.epochs[k]) || null;
            if (!x || !y) { out.epochs[k] = x || y; return; }
            const merged = Object.assign({}, x);
            ['days', 'c', 'w', 'a', 's', 'p', 'ms', 'mc', 'badges', 'streak'].forEach(f => {
                merged[f] = Math.max(x[f] || 0, y[f] || 0);
            });
            merged.from = x.from || y.from;
            merged.to = x.to || y.to;
            merged.top = (x.top && x.top.length >= ((y.top || []).length)) ? x.top : (y.top || []);
            out.epochs[k] = merged;
        });

        // Достижения — объединение, снять обратно нельзя. При конфликте дат побеждает
        // более РАННЯЯ: первое получение и есть правда, второе устройство про него
        // просто ещё не знало.
        out.unlocks = {};
        const ua = toUnlockMap(a.unlocks), ub = toUnlockMap(b.unlocks);
        new Set([...Object.keys(ua), ...Object.keys(ub)]).forEach(id => {
            const known = [ua[id], ub[id]]
                .filter(d => typeof d === 'string' && d && d !== UNKNOWN_UNLOCK_DATE);
            out.unlocks[id] = known.length ? known.sort()[0] : UNKNOWN_UNLOCK_DATE;
        });

        return out;
    }

    // Дата получения может быть неизвестна (достижение пришло из старого формата-массива).
    // Важно, что это НЕ пустая строка: пустое значение пережило бы merge, но потерялось
    // бы при следующем JSON.stringify по дороге на сервер — и достижение просто исчезло
    // бы у ученика. Явный маркер переживает сериализацию.
    const UNKNOWN_UNLOCK_DATE = '?';

    // unlocks раньше был массивом id, стал словарём { id: дата }. Приводим любой
    // из двух видов к словарю. Риска тут нет ровно потому, что в старом формате
    // ничего никогда не записывалось — все существующие массивы пустые.
    function toUnlockMap(u) {
        if (!u) return {};
        if (Array.isArray(u)) {
            const out = {};
            u.forEach(id => { if (typeof id === 'string') out[id] = UNKNOWN_UNLOCK_DATE; });
            return out;
        }
        if (typeof u !== 'object') return {};
        const out = {};
        Object.keys(u).forEach(id => {
            const d = u[id];
            out[id] = (typeof d === 'string' && d) ? d : UNKNOWN_UNLOCK_DATE;
        });
        return out;
    }

    // Приводит данные любой версии к текущей схеме. Отдельно переносит
    // прогресс со старых ключей v1, чтобы у тех, кто уже играл, ничего не пропало.
    function normalize(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const s = Object.assign(emptyState(), raw);
        s.schema = SCHEMA;
        if (!s.puzzle || typeof s.puzzle !== 'object') s.puzzle = { idx: null, filled: 0 };
        if (!s.collections || typeof s.collections !== 'object') s.collections = { paradoxes: [] };
        if (!Array.isArray(s.collections.paradoxes)) s.collections.paradoxes = [];
        if (!s.totals || typeof s.totals !== 'object') s.totals = { correct: 0, wrong: 0, puzzlesCompleted: 0 };
        // Проверять только форму мало: счётчик мог прийти строкой или NaN из битого
        // хранилища, и тогда Math.max в слиянии даёт NaN, а JSON.stringify превращает
        // его в null — прогресс молча обнуляется по дороге на сервер. Приводим к числу.
        const num = (v) => (Number.isFinite(v) ? v : (Number.isFinite(Number(v)) ? Number(v) : 0));
        s.totals.correct = num(s.totals.correct);
        s.totals.wrong = num(s.totals.wrong);
        s.totals.puzzlesCompleted = num(s.totals.puzzlesCompleted);
        if (!s.errorKinds || typeof s.errorKinds !== 'object' || Array.isArray(s.errorKinds)) s.errorKinds = {};
        Object.keys(s.errorKinds).forEach(k => {
            const t = s.errorKinds[k];
            if (!t || typeof t !== 'object' || Array.isArray(t)) { delete s.errorKinds[k]; return; }
            Object.keys(t).forEach(kind => { t[kind] = num(t[kind]); });
        });
        if (!s.byClass || typeof s.byClass !== 'object' || Array.isArray(s.byClass)) s.byClass = {};
        Object.keys(s.byClass).forEach(k => {
            const t = s.byClass[k];
            if (!t || typeof t !== 'object' || Array.isArray(t)) { delete s.byClass[k]; return; }
            Object.keys(t).forEach(cls => {
                const slot = t[cls];
                if (!Array.isArray(slot)) { delete t[cls]; return; }
                t[cls] = [num(slot[0]), num(slot[1]), num(slot[2]), num(slot[3])];
            });
        });
        if (!s.byTopic || typeof s.byTopic !== 'object') s.byTopic = {};
        Object.keys(s.byTopic).forEach(k => {
            const t = s.byTopic[k];
            if (!t || typeof t !== 'object') { delete s.byTopic[k]; return; }
            s.byTopic[k] = { correct: num(t.correct), wrong: num(t.wrong) };
        });
        if (!s.daily || typeof s.daily !== 'object' || Array.isArray(s.daily)) s.daily = {};
        // Каждая корзина дня добивается до полного набора полей: данные могли прийти
        // с более старой версии, где части счётчиков (или всего дня) ещё не было.
        Object.keys(s.daily).forEach(k => {
            const raw = s.daily[k];
            if (!raw || typeof raw !== 'object') { delete s.daily[k]; return; }
            const bucket = Object.assign(emptyDay(), raw);
            bucket.t = (raw.t && typeof raw.t === 'object' && !Array.isArray(raw.t)) ? raw.t : {};
            bucket.e = (raw.e && typeof raw.e === 'object' && !Array.isArray(raw.e)) ? raw.e : {};
            bucket.te = (raw.te && typeof raw.te === 'object' && !Array.isArray(raw.te)) ? raw.te : {};
            // Внутри te — карта клетка → карта вида ошибки. Записи чужой формы
            // выбрасываем целиком: чинить их не из чего.
            Object.keys(bucket.te).forEach(topic => {
                const cell = bucket.te[topic];
                if (!cell || typeof cell !== 'object' || Array.isArray(cell)) delete bucket.te[topic];
            });
            s.daily[k] = bucket;
        });
        pruneDaily(s.daily);
        s.unlocks = toUnlockMap(s.unlocks);
        if (!s.studentNotes || typeof s.studentNotes !== 'object' || Array.isArray(s.studentNotes)) s.studentNotes = {};
        if (!s.studentGroups || typeof s.studentGroups !== 'object' || Array.isArray(s.studentGroups)) s.studentGroups = {};
        if (!s.epochs || typeof s.epochs !== 'object' || Array.isArray(s.epochs)) s.epochs = {};
        trimTopicSpeed(s.daily);
        if (typeof s.profileLabel !== 'string') s.profileLabel = '';
        if (s.accountType !== 'linked') s.accountType = 'self';
        if (typeof s.ownerCode !== 'string') s.ownerCode = null;
        rescueNullSection(s);
        return s;
    }

    // Разовый перенос: клетка «null+» → «integer+».
    //
    // Кнопки «Играть» у задания и «Играть на 4★» четыре мержа подряд запускали
    // миссию, не восстановив раздел: exampleConfig обнуляется при возврате на
    // экран выбора, а имя раздела туда никто не возвращал. Ответы записывались
    // под именем «null+», и приложение переставало их видеть — ни карта, ни
    // лесенки, ни медали, ни пазл. Занимался ученик по-настоящему, а по
    // приложению — нет.
    //
    // Кладём в положительные целые: сломанные кнопки вели только туда, где
    // ученик уже занимался, а других разделов у наших учеников и нет.
    // Складываем, а не заменяем: в правильной клетке уже могло что-то лежать.
    //
    // Ступени лесенок с фантомной клетки НЕ переносим, а выбрасываем: они выданы
    // за клетку, которой не существует. Ответы вернулись в настоящую, и там
    // ступени начислятся заново на следующем же ответе — по честному счёту.
    function rescueNullSection(s) {
        const BAD = 'null+:', GOOD = 'integer+:';
        const isBad = (k) => k.indexOf(BAD) === 0;
        const fix = (k) => GOOD + k.slice(BAD.length);
        let moved = 0;

        Object.keys(s.byTopic || {}).filter(isBad).forEach(k => {
            const from = s.byTopic[k], to = s.byTopic[fix(k)] || { correct: 0, wrong: 0 };
            to.correct += from.correct || 0;
            to.wrong += from.wrong || 0;
            s.byTopic[fix(k)] = to;
            delete s.byTopic[k];
            moved++;
        });

        Object.keys(s.daily || {}).forEach(day => {
            const d = s.daily[day];
            Object.keys(d.t || {}).filter(isBad).forEach(k => {
                const from = d.t[k] || [], to = d.t[fix(k)] || [0, 0, 0, 0, 0];
                for (let i = 0; i < 5; i++) to[i] = (to[i] || 0) + (from[i] || 0);
                d.t[fix(k)] = to;
                delete d.t[k];
                moved++;
            });
            Object.keys(d.te || {}).filter(isBad).forEach(k => {
                const from = d.te[k] || {}, to = d.te[fix(k)] || {};
                Object.keys(from).forEach(kind => { to[kind] = (to[kind] || 0) + (from[kind] || 0); });
                d.te[fix(k)] = to;
                delete d.te[k];
            });
        });

        Object.keys(s.errorKinds || {}).filter(isBad).forEach(k => {
            const from = s.errorKinds[k] || {}, to = s.errorKinds[fix(k)] || {};
            Object.keys(from).forEach(kind => { to[kind] = (to[kind] || 0) + (from[kind] || 0); });
            s.errorKinds[fix(k)] = to;
            delete s.errorKinds[k];
        });

        Object.keys(s.byClass || {}).filter(isBad).forEach(k => {
            const from = s.byClass[k] || {}, to = s.byClass[fix(k)] || {};
            Object.keys(from).forEach(cls => {
                const p = from[cls] || [], q = to[cls] || [0, 0, 0, 0];
                to[cls] = [ (q[0] || 0) + (p[0] || 0), (q[1] || 0) + (p[1] || 0),
                            (q[2] || 0) + (p[2] || 0), (q[3] || 0) + (p[3] || 0) ];
            });
            s.byClass[fix(k)] = to;
            delete s.byClass[k];
        });

        Object.keys(s.unlocks || {}).filter(isBad).forEach(k => { delete s.unlocks[k]; });
        return moved;
    }

    function migrateFromV2() {
        // Старое хранилище (до профилей) держало одно плоское состояние под
        // отдельным ключом — переносим его как первый профиль на устройстве.
        try {
            const raw = localStorage.getItem('mathCitadelState_v2');
            return raw ? normalize(JSON.parse(raw)) : null;
        } catch (e) { return null; }
    }

    function migrateFromV1() {
        let found = false;
        const s = emptyState();
        try {
            const col = localStorage.getItem('mathCitadelPuzzleCollection_v1');
            if (col) { const arr = JSON.parse(col); if (Array.isArray(arr)) { s.collections.paradoxes = arr; found = true; } }
        } catch (e) { /* пропускаем битые данные */ }
        try {
            const pz = localStorage.getItem('mathCitadelPuzzleProgress_v1');
            if (pz) { const o = JSON.parse(pz); if (o && Number.isInteger(o.idx)) { s.puzzle = { idx: o.idx, filled: o.filled || 0 }; found = true; } }
        } catch (e) { /* пропускаем битые данные */ }
        try {
            const cf = localStorage.getItem('mathCitadelExampleConfig_v1');
            if (cf) { s.config = JSON.parse(cf); found = true; }
        } catch (e) { /* пропускаем битые данные */ }
        return found ? s : null;
    }

    function persistLocal() {
        state.updatedAt = Date.now();
        // Порядок здесь принципиален: сначала замораживаем закрывшуюся эпоху, и только
        // потом подчищаем журнал. Наоборот — и карточка соберётся по обрезанным данным.
        // Обе проверки дешёвые и обычно сразу выходят: карточка за текущий отрезок ещё
        // не может быть заморожена, а дней в журнале почти всегда меньше лимита.
        sealEpochs();
        pruneDaily(state.daily);
        trimTopicSpeed(state.daily);
        if (state.playerCode) profiles[state.playerCode] = state;
        localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
        dirty = true;
    }

    // Корзина сегодняшнего дня, создаётся при первом обращении за день.
    // Потолок на время одного ответа. Таймер примера ничего не обрывает, поэтому
    // без потолка отложенный телефон записывается в статистику как «думал пять минут».
    const ANSWER_TIME_CAP_MS = 15000;
    function cappedAnswerMs(ms) {
        if (!Number.isFinite(ms) || ms <= 0) return 0;
        return Math.min(Math.round(ms), ANSWER_TIME_CAP_MS);
    }

    function touchDay() {
        if (!state.daily || typeof state.daily !== 'object') state.daily = {};
        const k = dayKey();
        if (!state.daily[k]) {
            state.daily[k] = emptyDay();
            pruneDaily(state.daily);
        }
        return state.daily[k];
    }

    // Счётчик для recordSecond() — чтобы не писать на диск каждую секунду.
    let secondsSincePersist = 0;

    // ===== ЭПОХИ =====
    // Отрезок в 180 дней. Границы считаются от первого записанного дня, поэтому
    // оба устройства всегда получают одинаковые номера и одинаковые ключи карточек —
    // рассинхронизации быть не может даже без всякой связи между ними.
    const EPOCH_DAYS = 180;

    function shiftKey(key, delta) {
        const [y, m, d] = key.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + delta);
        return dayKey(dt);
    }
    function daysBetween(fromKey, toKey) {
        const [y1, m1, d1] = fromKey.split('-').map(Number);
        const [y2, m2, d2] = toKey.split('-').map(Number);
        return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
    }

    // Замораживает все полностью прошедшие эпохи, для которых карточки ещё нет.
    // Вызывается на сохранении: к моменту, когда журнал начнёт подчищаться, снимок
    // уже сделан, поэтому старые данные не пропадают, а переезжают в карточку.
    function sealEpochs() {
        const daily = state.daily || {};
        const keys = Object.keys(daily).sort();
        if (!keys.length) return;
        const first = keys[0];
        const today = dayKey();
        const elapsed = daysBetween(first, today);
        const completed = Math.floor(elapsed / EPOCH_DAYS); // сколько отрезков закрылось
        if (completed < 1) return;
        if (!state.epochs || typeof state.epochs !== 'object') state.epochs = {};

        for (let n = 1; n <= completed; n++) {
            if (state.epochs[n]) continue; // уже заморожена
            const from = shiftKey(first, EPOCH_DAYS * (n - 1));
            const to = shiftKey(first, EPOCH_DAYS * n - 1);
            const card = { from, to, days: 0, c: 0, w: 0, a: 0, s: 0, p: 0, ms: 0, mc: 0, streak: 0, badges: 0, top: [] };
            const byTopic = {};
            let run = 0, prev = null;
            keys.forEach(k => {
                if (k < from || k > to) return;
                const d = daily[k];
                const active = ((d.c || 0) + (d.w || 0)) > 0 || (d.s || 0) > 0;
                if (active) {
                    card.days++;
                    run = (prev && shiftKey(prev, 1) === k) ? run + 1 : 1;
                    if (run > card.streak) card.streak = run;
                    prev = k;
                }
                ['c', 'w', 'a', 's', 'p', 'ms', 'mc'].forEach(f => { card[f] += d[f] || 0; });
                Object.keys(d.t || {}).forEach(tk => {
                    const v = d.t[tk] || [];
                    const acc = byTopic[tk] || (byTopic[tk] = [0, 0]);
                    acc[0] += v[0] || 0; acc[1] += v[1] || 0;
                });
            });
            // В карточку кладём только заметные темы — она должна остаться компактной
            card.top = Object.keys(byTopic)
                .map(k => ({ k, c: byTopic[k][0], w: byTopic[k][1] }))
                .filter(t => (t.c + t.w) >= 20)
                .sort((x, y) => (y.c + y.w) - (x.c + x.w))
                .slice(0, 6);
            // Только ступени лесенок. У старых профилей в unlocks могли остаться
            // достижения «вообще» из прошлой версии игры — они больше нигде не
            // показываются, и в счётчике их тоже быть не должно. Сами записи не
            // трогаем: удалять чужую историю ради счётчика ни к чему.
            card.badges = Object.keys(state.unlocks || {})
                .filter(id => {
                    const dt = state.unlocks[id];
                    return dt && dt >= from && dt <= to && LADDER_ID_RE.test(id);
                }).length;
            state.epochs[n] = card;
        }
    }

    // Переключение активного профиля: откладывает текущий в кэш, поднимает
    // уже известный устройству профиль или заводит новый с нужными метками.
    // password — обязателен для нового профиля, иначе им нельзя будет синхронизироваться.
    function doSwitch(code, password, opts) {
        if (!code) return;
        // Доступ принадлежит профилю, а не устройству: при переключении забываем.
        if (state.playerCode !== code) access = null;
        if (state.playerCode && state.playerCode !== code) profiles[state.playerCode] = state;
        if (password) passwords[code] = password;
        if (profiles[code]) {
            state = profiles[code];
        } else {
            const s = emptyState();
            s.playerCode = code;
            if (opts) {
                if (opts.accountType) s.accountType = opts.accountType;
                if (opts.ownerCode) s.ownerCode = opts.ownerCode;
                if (opts.profileLabel) s.profileLabel = opts.profileLabel;
            }
            state = s;
            profiles[code] = state;
        }
        // Не через persistLocal() — это просто переключение, не реальное изменение
        // данных, и оно не должно штамповать updatedAt=Date.now() на свежую пустую
        // заготовку. Если бы штамповало — заготовка (accountType:'self' по умолчанию)
        // выглядела бы "новее" настоящих данных с сервера при первом же flush() после
        // входа в только что созданный репетитором аккаунт (там updatedAt=0) и затирала
        // бы их — ровно так и произошло с студенческим аккаунтом, который "потерял"
        // привязку к репетитору после первого входа.
        localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
        dirty = true;
    }

    return {
        // Читает сохранённое состояние. Вызывается один раз при старте.
        init() {
            const envelope = localDriver.read();
            if (envelope && envelope.profiles && typeof envelope.profiles === 'object') {
                profiles = {};
                Object.keys(envelope.profiles).forEach(code => {
                    const n = normalize(envelope.profiles[code]);
                    if (n) { n.playerCode = code; profiles[code] = n; }
                });
                passwords = (envelope.passwords && typeof envelope.passwords === 'object') ? envelope.passwords : {};
                tokens = (envelope.tokens && typeof envelope.tokens === 'object') ? envelope.tokens : {};
                access = (envelope.access && typeof envelope.access === 'object') ? envelope.access : null;
                state = (envelope.activeCode && profiles[envelope.activeCode]) || emptyState();
            } else {
                const legacy = migrateFromV2() || migrateFromV1();
                state = legacy || emptyState();
                if (state.playerCode) profiles[state.playerCode] = state;
                persistLocal();
            }
            return state;
        },

        get() { return state; },
        getCode() { return state.playerCode; },
        // Пароль профиля — только пока он не обменян на токен: нужен самому обмену
        // и переключению на уже знакомый профиль, если обмен ещё не случился.
        getPasswordFor(code) { return passwords[code] || null; },

        // --- токены сессий ---
        getToken() { return tokens[state.playerCode] || null; },
        getTokenFor(code) { return tokens[code] || null; },
        // Обмен состоялся: держим токен, пароль с устройства убираем совсем —
        // ради этого всё и делалось.
        setToken(code, token) {
            if (!code || !token) return;
            tokens[code] = token;
            delete passwords[code];
            localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
        },
        // Сервер сказал, что токен больше не годится (погашен или протух).
        // Пароля тут уже нет, поэтому дальше нужен обычный вход.
        dropToken(code) {
            if (!code || !tokens[code]) return;
            delete tokens[code];
            localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
        },
        // Чем подтверждать запрос: токеном или паролем. Наружу нужно, чтобы
        // экраны репетитора выбирали серверную функцию под тот же способ.
        authFor(code) { return authFor(code || state.playerCode); },

        // --- доступ к разделам ---
        // null = ещё не спрашивали (значит открыто всё), объект = ответ сервера.
        getAccess() { return access; },
        setAccess(a) {
            access = (a && typeof a === 'object') ? a : null;
            localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
        },
        // При смене профиля чужой доступ надо забыть немедленно, не дожидаясь
        // ответа сервера, — иначе новый ученик на секунду увидит чужие разделы.
        clearAccess() {
            access = null;
            localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
        },
        // Коды, у которых на устройстве ещё лежит пароль, — их и надо обменять.
        codesWithPassword() { return Object.keys(passwords); },

        // --- профили на этом устройстве ---
        // code+password должны быть уже проверены сервером (через login/create_student)
        // до вызова этой функции — сама она чужие пароли не проверяет.
        switchTo(code, password, opts) { doSwitch(code, password, opts); },
        listProfiles() {
            return Object.keys(profiles).map(code => ({
                code,
                label: profiles[code].profileLabel || '',
                accountType: profiles[code].accountType || 'self',
                active: code === state.playerCode
            }));
        },
        forgetProfile(code) {
            if (!code || code === state.playerCode) return false;
            delete profiles[code];
            delete passwords[code];
            delete tokens[code];
            persistLocal();
            return true;
        },
        // Полностью стирает локальное хранилище этого устройства — для случая,
        // когда сам аккаунт удалён на сервере и хранить его кэш больше незачем.
        wipeAllLocal() {
            try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* хранилище недоступно */ }
        },
        setProfileLabel(label) { state.profileLabel = label || ''; persistLocal(); },
        getProfileLabel() { return state.profileLabel || ''; },

        // --- тип аккаунта ---
        setAccountType(type, ownerCode) {
            state.accountType = (type === 'linked') ? 'linked' : 'self';
            state.ownerCode = ownerCode || null;
            persistLocal();
        },
        getAccountType() { return state.accountType || 'self'; },
        getOwnerCode() { return state.ownerCode || null; },

        // Полный сброс прогресса текущего профиля — тот же код, чистые счётчики.
        // В отличие от flush(), НЕ сливается со старым состоянием на сервере:
        // слияние "прогресс только растёт" иначе немедленно вернуло бы всё обратно.
        async hardReset() {
            const code = state.playerCode;
            const keep = {
                profileLabel: state.profileLabel,
                accountType: state.accountType,
                ownerCode: state.ownerCode,
                config: state.config
            };
            state = emptyState();
            state.playerCode = code;
            Object.assign(state, keep);
            if (code) profiles[code] = state;
            persistLocal();
            if (remoteDriver && code) {
                const auth = authFor(code);
                if (!auth) return false;
                try { await remoteDriver.write(code, auth, state); dirty = false; return true; }
                catch (e) { return false; }
            }
            return true;
        },

        // --- настройки ---
        getConfig() { return state.config; },
        setConfig(cfg) { state.config = cfg; persistLocal(); },

        // --- текущий пазл ---
        getPuzzle() { return state.puzzle; },
        setPuzzle(idx, filled) { state.puzzle = { idx, filled }; persistLocal(); },

        // --- коллекции ---
        getCollection(id, size) {
            let arr = state.collections[id];
            if (!Array.isArray(arr) || arr.length !== size) {
                arr = new Array(size).fill(false);
                state.collections[id] = arr;
            }
            return arr;
        },
        setCollection(id, arr) { state.collections[id] = arr; persistLocal(); },

        // --- статистика: единственная точка учёта каждого ответа ---
        // outcome: 'correct' | 'almost' | 'wrong'. 'almost' — это "посчитал верно,
        // но забыл сократить": в пожизненные totals/byTopic он, как и раньше, идёт
        // как верный ответ (счёт-то был правильный), и дополнительно попадает в
        // отдельный дневной счётчик — это отдельный диагноз, а не ошибка в счёте.
        // Булево значение тоже принимается — на случай старых вызовов.
        // elapsedMs — сколько ученик думал; учитывается у всех ответов, но делится
        // потом на число верных, см. комментарий у recordAnswer.
        // Вид ошибки пишется отдельным вызовом сразу после recordAnswer:
        // так учёт ответов остаётся прежним, а разбор можно не звать вовсе,
        // если разобрать не удалось.
        recordMistakeKind(topicKey, kind) {
            if (!kind) return;
            if (topicKey) {
                if (!state.errorKinds || typeof state.errorKinds !== 'object') state.errorKinds = {};
                const t = state.errorKinds[topicKey] || (state.errorKinds[topicKey] = {});
                t[kind] = (t[kind] || 0) + 1;
            }
            const day = touchDay();
            if (!day.e || typeof day.e !== 'object') day.e = {};
            day.e[kind] = (day.e[kind] || 0) + 1;
            if (topicKey) {
                if (!day.te || typeof day.te !== 'object') day.te = {};
                const cell = day.te[topicKey] || (day.te[topicKey] = {});
                cell[kind] = (cell[kind] || 0) + 1;
            }
            persistLocal();
        },
        // Виды ошибок за всё время, по клеткам, без дат. Журнал глубже двухсот дней
        // не идёт, а этот счёт идёт: он и отвечает на «за всё время».
        getErrorKinds() { return state.errorKinds || {}; },

        // Разбор по типам примеров. Три класса не пересекаются и в сумме дают
        // всю клетку; 'h' — подмножество, а не четвёртый класс, поэтому пример
        // с переходом через сотню считается дважды: в своём классе и в 'h'.
        recordClass(topicKey, struct, isRight, elapsedMs) {
            if (!topicKey || !struct) return;
            if (!state.byClass || typeof state.byClass !== 'object') state.byClass = {};
            const t = state.byClass[topicKey] || (state.byClass[topicKey] = {});
            const spent = cappedAnswerMs(elapsedMs);
            const bump = (key) => {
                const slot = t[key] || (t[key] = [0, 0, 0, 0]);
                if (isRight) slot[0]++; else slot[1]++;
                // Как и у лесенки: время всех ответов, счётчик только верных.
                slot[2] += spent;
                if (isRight) slot[3]++;
            };
            bump(struct.cls);
            if (struct.extra) bump(struct.extra);
            persistLocal();
        },
        getByClass() { return state.byClass || {}; },

        // Скорость считается как «всё потраченное время, делённое на число верных
        // ответов». Раньше время ошибок не учитывалось вовсе: можно было думать над
        // примером двадцать секунд, ошибиться — и на скорости это никак не
        // сказывалось. Новая формула отвечает на честный вопрос: сколько времени
        // уходит на один правильный ответ.
        //
        // Потолок обязателен. Таймер примера ничего не обрывает: полоска доходит до
        // нуля, а пример продолжает висеть. Без потолка один поход на кухню посреди
        // занятия добавляет в клетку несколько минут и сдвигает среднее на две
        // ступени лестницы. Пятнадцать секунд — чуть выше таймера в 13,3, поэтому
        // любая настоящая попытка помещается целиком, а всё сверх — уже не счёт.
        recordAnswer(topicKey, outcome, elapsedMs) {
            const kind = (outcome === true) ? 'correct'
                : (outcome === false) ? 'wrong'
                : outcome;
            const isRight = (kind === 'correct' || kind === 'almost');

            if (isRight) state.totals.correct++; else state.totals.wrong++;
            if (topicKey) {
                const t = state.byTopic[topicKey] || (state.byTopic[topicKey] = { correct: 0, wrong: 0 });
                if (isRight) t.correct++; else t.wrong++;
            }

            const spent = cappedAnswerMs(elapsedMs);
            const day = touchDay();
            if (isRight) day.c++; else day.w++;
            if (kind === 'almost') day.a++;
            // ms — время ВСЕХ ответов, mc — число ВЕРНЫХ. Отношение и есть скорость.
            day.ms += spent;
            if (isRight) day.mc++;
            if (topicKey) {
                const slot = day.t[topicKey] || (day.t[topicKey] = [0, 0, 0, 0, 0]);
                while (slot.length < 5) slot.push(0); // запись могла прийти из старой версии
                if (isRight) slot[0]++; else slot[1]++;
                if (kind === 'almost') slot[2]++;
                slot[3] += spent;
                if (isRight) slot[4]++;
            }

            persistLocal();
        },
        recordPuzzleCompleted() {
            state.totals.puzzlesCompleted++;
            touchDay().p++;
            persistLocal();
        },
        // Секунды за игрой. Вызывается раз в секунду, поэтому на диск пишем не каждый
        // раз, а раз в 10 секунд: JSON.stringify всего состояния ежесекундно — заметная
        // и совершенно лишняя работа. Потерять при внезапном закрытии можно максимум
        // 9 секунд, что для статистики занятий несущественно.
        recordSecond() {
            touchDay().s++;
            secondsSincePersist++;
            if (secondsSincePersist >= 10) { secondsSincePersist = 0; persistLocal(); }
            else { dirty = true; }
        },

        // --- журнал по дням ---
        getDaily() { return state.daily || {}; },
        dayKey(d) { return dayKey(d); },
        getEpochs() { return state.epochs || {}; },
        epochLength() { return EPOCH_DAYS; },

        // --- заметки репетитора об учениках ---
        getStudentGroups() { return state.studentGroups || {}; },
        getStudentGroup(code) { return (state.studentGroups || {})[code] || ''; },
        setStudentGroup(code, name) {
            if (!code) return;
            if (!state.studentGroups || typeof state.studentGroups !== 'object') state.studentGroups = {};
            if (name) state.studentGroups[code] = name; else delete state.studentGroups[code];
            persistLocal();
        },

        getStudentNote(code) { return (state.studentNotes || {})[code] || ''; },
        setStudentNote(code, text) {
            if (!code) return;
            if (!state.studentNotes || typeof state.studentNotes !== 'object') state.studentNotes = {};
            if (text) state.studentNotes[code] = text; else delete state.studentNotes[code];
            persistLocal();
        },

        // --- достижения ---
        getUnlocks() { return state.unlocks || {}; },
        unlock(id) {
            if (!state.unlocks || typeof state.unlocks !== 'object') state.unlocks = {};
            if (Object.prototype.hasOwnProperty.call(state.unlocks, id)) return false;
            state.unlocks[id] = dayKey();
            persistLocal();
            return true;
        },

        // Контрольная точка синхронизации. Пока сервера нет — ничего не делает.
        // Когда появится, здесь пойдёт отправка на сервер со слиянием,
        // и НИ ОДНА строчка остального приложения не изменится.
        //
        // Явной блокировки от параллельных вызовов здесь нет (например, если сеть
        // медленная и следующий тик таймера синхронизации стартует раньше, чем
        // предыдущий flush() успел закончиться) — но это безопасно, а не гонка данных:
        // `state` ниже читается заново на каждой строке, а не захватывается один раз
        // в начале функции, поэтому второй, более поздний flush() всегда видит уже
        // обновлённый первым результат (JS есть JS — переменная в замыкании живая,
        // не снимок). А mergeState берёт максимум/объединение, а не "последняя запись
        // выигрывает", так что даже устаревший remote-снимок ничего не откатывает.
        // Худший исход при перекрытии — лишний, избыточный запрос, не потеря данных.
        async flush(force) {
            if (!remoteDriver || !state.playerCode) return;
            const auth = authFor(state.playerCode);
            if (!auth) return; // подтвердить личность нечем — ждём входа
            if (!dirty && !force) return;
            try {
                const remote = normalize(await remoteDriver.read(state.playerCode, auth));
                state = mergeState(remote, state);
                profiles[state.playerCode] = state; // merge вернул новый объект — обновляем кэш
                localDriver.write({ activeCode: state.playerCode, profiles, passwords, tokens, access });
                await remoteDriver.write(state.playerCode, auth, state);
                dirty = false;
                return true;
            } catch (e) {
                // Сеть недоступна — молча оставляем данные локально и попробуем позже.
                // Игра при этом не должна ничего заметить.
                return false;
            }
        },
        attachRemote(driver) { remoteDriver = driver; },
        _merge: mergeState,
        _normalize: normalize
    };
})();
