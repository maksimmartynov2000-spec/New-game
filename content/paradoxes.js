// Карточки парадоксов — содержимое, а не код.
//
// Лежит отдельным файлом намеренно: это тексты, которые читают и правят глазами,
// и держать их посреди четырнадцати тысяч строк логики значит никогда их не
// перечитать. Формат — простые данные, без вызовов перевода: строк тут много и они
// длинные, а словари TR_* устроены под короткие подписи интерфейса.
//
// Языки добавляются сюда же новым ключом верхнего уровня. Приложение берёт язык
// пользователя, а чего нет — показывает по-русски.
//
// Порядок ЗНАЧИМ: индекс парадокса совпадает с индексом картинки пазла в
// PUZZLE_IMAGE_SRCS. Менять местами нельзя — у собравших коллекцию разъедется
// соответствие картинки и текста.
//
// Поля:
//   name   — название
//   era    — кто и когда, одной строкой
//   hook   — крючок: одна фраза, от которой хочется читать дальше
//   body   — два абзаца через пустую строку: что происходит, и в чём подвох
//   probe  — вопрос, который можно проверить самому
//   answer — ответ, раскрывается нажатием

window.PARADOX_CONTENT = {
    ru: [
        {
            name: 'Тайна игрального кубика',
            era: 'Устройство игрального кубика',
            hook: 'Посмотри на кубик сверху — и узнаешь, что у него снизу.',
            body: 'На игральном кубике напротив единицы стоит шестёрка, напротив тройки — четвёрка. Сложи — выйдет 7.\n\nТак устроены почти все кубики на свете: любые две противоположные грани вместе дают 7. Брось кубик, посмотри на верх — и скажешь, сколько точек снизу, не переворачивая его.',
            probe: 'Сверху 5 точек. Сколько снизу? 5 + ? = 7',
            answer: '2. Напротив пятёрки всегда двойка.'
        },
        {
            name: 'Черепаха с волшебным панцирем',
            era: 'Квадрат Ло Шу, древнекитайская легенда',
            hook: 'Девять чисел в квадрате — и любая строка даёт 15.',
            body: 'По древней китайской легенде из реки Ло вышла черепаха, а на её панцире был узор из точек: числа от 1 до 9, уложенные квадратом три на три.\n\nСложи любую строку, любой столбец или диагональ — всегда выйдет 15. Такие квадраты потом назвали магическими.',
            probe: 'Верхняя строка панциря: 4, 9 и ещё одно число. 4 + 9 + ? = 15',
            answer: '2. Весь панцирь: 4 9 2, 3 5 7, 8 1 6 — проверь любую строку.'
        },
        {
            name: 'Мальчик, который не стал считать подряд',
            era: 'Биография Гаусса, Сарториус фон Вальтерсхаузен, 1856',
            hook: 'Учитель задал сложить числа от 1 до 100 — маленький Гаусс справился за минуту.',
            body: 'Рассказывают, что учитель хотел надолго занять класс, а Карл Фридрих Гаусс почти сразу написал ответ: 5050.\n\nОн заметил пары: 1 + 100, 2 + 99, 3 + 98 — каждая даёт 101, и таких пар 50. Мальчик вырос одним из величайших математиков в истории.',
            probe: 'Сложи 1 + 2 + … + 10 по-гауссовски — первое с последним: 1 + 10, 2 + 9, 3 + 8, 4 + 7, 5 + 6. 11 + 11 + 11 + 11 + 11 = ?',
            answer: '55. Пять пар по 11 — и ни одно число не осталось без пары, совсем как у Гаусса.'
        },
        {
            name: 'Ряд, который растёт в шишке',
            era: 'Леонардо Пизанский, «Книга абака», 1202',
            hook: 'Простой ряд чисел прячется в каждой шишке и в каждом подсолнухе.',
            body: 'Начни с 1 и 1, а дальше складывай два последних числа: 1 + 1 = 2, 1 + 2 = 3, 2 + 3 = 5, 3 + 5 = 8, потом 13, 21, 34… Больше 800 лет назад этот ряд описал в своей книге итальянец Леонардо Пизанский — теперь его называют Фибоначчи.\n\nА потом оказалось, что так же «считает» природа. Возьми сосновую шишку и посчитай спирали из чешуек: часто их 8 в одну сторону и 13 в другую — два соседних числа из ряда. У подсолнуха спирали из семечек: 34 и 55, а у крупных — 55 и 89.',
            probe: 'Продолжи ряд: 21 + 34 = 55, а 34 + 55 = ?',
            answer: '89 — и это тоже спирали: у крупных подсолнухов их 55 в одну сторону и 89 в другую.'
        },
        {
            name: 'Сколько квадратов на шахматной доске?',
            era: 'Старинная задача про шахматную доску',
            hook: 'На шахматной доске 64 клетки. А квадратов — 204.',
            body: 'Начни с маленькой доски, 3 на 3. Клеток 9, а квадратов больше: 9 маленьких, ещё 4 средних — каждый из четырёх клеток, они налезают друг на друга, — и 1 большой, вся доска. Всего 9 + 4 + 1 = 14.\n\nНа шахматной доске так же, только размеров больше: 64 + 49 + 36 + 25 + 16 + 9 + 4 + 1 = 204. Выходит, две трети квадратов на доске прячутся у всех на виду.',
            probe: 'На шахматной доске квадратов в одну клетку — 64, а квадратов 2 на 2 — 49: 64 + 49 = ?',
            answer: '113. И это только два самых маленьких размера — а всего их восемь.'
        },
        {
            name: 'Обратный отсчёт придумали в кино',
            era: 'Фриц Ланг, фильм «Женщина на Луне», 1929',
            hook: '«Десять, девять, восемь… пуск!» — так считать придумал не инженер, а кинорежиссёр.',
            body: 'Считается, что отсчёт назад перед стартом ракеты придумал режиссёр Фриц Ланг для фильма «Женщина на Луне» в 1929 году.\n\nПочему назад, а не вперёд? Когда считаешь вперёд — «один, два, три…», — непонятно, когда старт. А при счёте назад каждое число говорит, сколько секунд осталось, а пуск — ровно на нуле. Инженерам идея понравилась, и теперь так стартуют настоящие ракеты.',
            probe: 'Отсчёт начали с 10, прошло 4 секунды: 10 − 4 = ?',
            answer: '6. Столько секунд осталось до старта — при счёте назад это число и звучит.'
        },
        {
            name: 'Когда куча перестаёт быть кучей?',
            era: 'Евбулид Милетский, IV век до н. э.',
            hook: 'Убери из кучи одну конфету — куча останется. А если повторять?',
            body: '20 конфет — точно куча. Съешь одну: 19 — всё ещё куча, одна конфета ничего не решает. И так шаг за шагом, пока не останется одна конфета — а её кучей уже не назовёшь. Где же была граница? Её нет: у слова «куча» нет точного числа. Об этом спорили ещё древние греки.\n\nВот почему в правилах пишут числа, а не «много»: «детям до 12 лет», «не больше 10 предметов». С числом не поспоришь.',
            probe: 'Каждый день съедаешь по 4 конфеты из 20. Через 4 дня: 20 − 4 − 4 − 4 − 4 = ? Это ещё куча?',
            answer: '4 конфеты. Куча это или нет — решать тебе: точного ответа нет, в этом и парадокс.'
        },
        {
            name: 'Куда пропала монета?',
            era: 'Старинная задача-обманка',
            hook: 'Путники заплатили 27 монет, посыльный оставил себе 2. А где тридцатая?',
            body: 'Трое путников заплатили за комнату 30 монет. Хозяйка вспомнила, что комната стоит 25, и отправила посыльного вернуть 5. Пять на троих не делится, и он отдал каждому по монете, а две оставил себе. Выходит, каждый заплатил по 9, вместе 27, да у посыльного 2 — всего 29. Где тридцатая?\n\nПосчитай, где лежит каждая монета. Из 27 монет путников 25 — у хозяйки, 2 — у посыльного. А ещё 3 вернулись путникам в карманы: 27 + 3 = 30. Все монеты на месте! Ошибка — прибавлять 2 к 27: эти две монеты уже входят в 27.',
            probe: 'Путники отдали 27, у хозяйки 25. Сколько у посыльного? 27 − 25 = ?',
            answer: '2. Эти 2 монеты — часть 27, поэтому прибавлять их к 27 нельзя. Правильный счёт: 25 у хозяйки + 2 у посыльного + 3 вернули путникам = 30.'
        },
        {
            name: 'Десять дней, которых не было',
            era: 'Календарная реформа 1582 года',
            hook: 'В 1582 году люди легли спать 4 октября, а проснулись 15-го.',
            body: 'В старом календаре год был на 11 минут длиннее настоящего. Мелочь — но за тысячу с лишним лет набежало 10 дней, и весна по календарю начиналась не тогда, когда на самом деле.\n\nЧтобы всё вернуть на место, лишние дни просто вычеркнули: в Италии, Испании, Португалии и Польше после четверга 4 октября сразу наступила пятница 15-го. Другие страны переходили позже — в Британии в 1752 году пропали уже 11 дней. По этому календарю сегодня живёт почти весь мир.',
            probe: 'По старому календарю в году 365 дней и 6 часов, а на самом деле — 365 дней, 5 часов и 49 минут. От 5:49 до 6:00: 60 − 49 = ?',
            answer: '11. Всего 11 минут в год — но за века из них набежали 10 дней.'
        },
        {
            name: 'Корабль Тесея',
            era: 'Плутарх, «Сравнительные жизнеописания», около 100 года',
            hook: 'Заменили все доски по одной. Это тот же корабль или уже другой?',
            body: 'В корабле 150 досок, каждый год меняют одну. Через 150 лет от прежнего корабля не осталось ни доски, а все эти годы никто не сказал бы, что его подменили.\n\nА если из старых досок собрать второй корабль — какой из двух настоящий? Строгого ответа нет — люди спорят об этом уже две тысячи лет.',
            probe: 'Из 150 досок заменили 120. Сколько старых осталось? 150 − 120 = ?',
            answer: '30. А если из 120 снятых досок собрать второй корабль — какой из двух настоящий?'
        },
        {
            name: 'Лист бумаги до Луны',
            era: 'Бритни Галливан, январь 2002',
            hook: 'Сложи лист пополам 42 раза — и стопка достанет до Луны.',
            body: 'Каждый раз, когда складываешь лист пополам, слоёв становится вдвое больше: 1, 2, 4, 8… Попробуй — обычный лист больше семи-восьми раз не сложить. Школьница Бритни Галливан в 2002 году сложила длинную бумажную ленту 12 раз и поставила рекорд.\n\nПодвох в том, как быстро растёт удвоение. Лист тоньше миллиметра, но после 42 сгибов слоёв было бы больше четырёх триллионов — и такая стопка дотянулась бы до Луны.',
            probe: 'Сложили 3 раза. Сколько слоёв? 2 × 2 × 2 = ?',
            answer: '8. Посмотри на лист на картинке: сгибы делят его ровно на 8 частей.'
        },
        {
            name: 'Таблица на девять — на пальцах',
            era: 'Старинный способ счёта на пальцах',
            hook: 'Вся таблица умножения на 9 спрятана у тебя в руках.',
            body: 'Положи руки на стол и загни палец с тем номером, на который умножаешь девять. Пальцы слева от загнутого — десятки, справа — единицы. Для 9 × 3 загни третий палец: слева 2, справа 7 — выходит 27.\n\nСекрет в том, что 9 × 3 — это 30 без 3. Десятков выходит на один меньше, чем множитель, а единиц — столько, сколько ему не хватает до десяти. Пальцы показывают ровно это.',
            probe: 'Загни шестой палец и посчитай пальцы слева и справа. 9 × 6 = ?',
            answer: '54. Слева от загнутого пальца 5, справа 4.'
        },
        {
            name: 'Сколько стенок у сот?',
            era: 'Варрон, I век до н. э.; Папп Александрийский; Томас Хейлз, 1999',
            hook: 'У одной ячейки 6 стенок. А у семи — гораздо меньше, чем семь раз по шесть.',
            body: 'Пчёлы строят соты из шестиугольников, и соседние ячейки делят общую стенку. Поэтому стенок выходит меньше, чем кажется, — а значит, и воска нужно меньше.\n\nПочему соты именно шестиугольные, спрашивали ещё в Древнем Риме. А доказать, что на шестиугольные ячейки уходит меньше всего воска, смог только математик Томас Хейлз в 1999 году.',
            probe: '7 ячеек: одна в центре и шесть вокруг. Будь у каждой свои стенки, их было бы 7 × 6 = ?',
            answer: '42. Но 12 стенок общие — каждая служит сразу двум ячейкам, поэтому на деле стенок 42 − 12 = 30.'
        },
        {
            name: 'Обезьяна за печатной машинкой',
            era: 'Эмиль Борель, 1913',
            hook: 'Обезьяна, которая бьёт по клавишам наугад, когда-нибудь напечатает «Гамлета».',
            body: 'Шанс, что случайные нажатия сложатся в слово, крошечный, но не нулевой. А то, у чего шанс не ноль, при бесконечном числе попыток обязательно случится.\n\nТолько ждать придётся невообразимо долго: каждая новая буква умножает число попыток. На машинке с картинки 10 клавиш, и слово из трёх букв выйдет на ней в среднем за 10 × 10 × 10 = 1000 попыток. А на одну строчку из «Гамлета» не хватило бы всего времени, что существует Вселенная.',
            probe: 'На настоящей машинке около 30 букв. Слово из двух букв выйдет в среднем за 30 × 30 = ? попыток',
            answer: '900. А слово из трёх букв — уже 27 000 попыток.'
        },
        {
            name: 'Парадокс дней рождения',
            era: 'Рихард фон Мизес, 1939',
            hook: 'В компании из 23 человек дни рождения совпадут с шансом больше половины.',
            body: 'Кажется, для совпадения нужны сотни людей: в году-то 365 дней. Но совпасть может любая пара, а пар гораздо больше, чем людей.\n\nКаждый из 23 образует пару с остальными 22: 23 × 22 = 506, и каждая пара посчитана дважды — значит, пар 253. Этого уже хватает, чтобы совпадение случалось чаще, чем нет. А в классе из 30 человек оно бывает примерно в семи случаях из десяти.',
            probe: 'В классе 30 человек. Каждый образует пару с остальными 29: 29 × 30 = ?',
            answer: '870. Каждая пара посчитана дважды, значит, пар 435 — неудивительно, что совпадение находится так часто.'
        },
        {
            name: 'Один режет, другой выбирает',
            era: 'Конвенция ООН по морскому праву, 1982',
            hook: 'Как поделить торт на двоих, чтобы никто не обиделся?',
            body: 'Один режет торт, а другой первым выбирает кусок. Тот, кто режет, старается разделить ровно пополам — иначе меньший кусок достанется ему самому.\n\nТак делят не только торты. По морскому праву ООН так же делят участки на дне океана: компания, которая хочет там добывать, делит найденный участок на две равные по ценности части, а Международный орган по морскому дну выбирает одну из них себе.',
            probe: '10 конфет на двоих по-честному: 10 ÷ 2 = ?',
            answer: '5. На картинке так и лежит: на тарелке два ряда по пять конфет.'
        },
        {
            name: 'Почему на ноль делить нельзя?',
            era: 'Бхаскара II, «Биджаганита», около 1150 года',
            hook: 'Двенадцать конфет на ноль друзей — сколько достанется каждому?',
            body: 'Деление проверяют умножением: 15 ÷ 3 = 5, потому что 5 × 3 = 15. Попробуем 12 ÷ 0: нужно число, которое после умножения на 0 даст 12. Но любое число, умноженное на 0, даёт 0. Такого числа нет — у примера просто нет ответа.\n\nНад этим думали веками: индийский математик Бхаскара ещё в XII веке назвал такой ответ бесконечностью. А вот 0 ÷ 12 — пожалуйста: ноль конфет на двенадцать друзей, каждому по нулю.',
            probe: '12 конфет на четверых: 12 ÷ 4 = ? Сверь умножением: ответ × 4 должен дать 12.',
            answer: '3. 3 × 4 = 12: у каждого из четверых на тарелке по три конфеты. А пустой скамейке раздать их нельзя — там ноль друзей.'
        },
        {
            name: 'Двенадцатый верблюд',
            era: 'Старинная задача о наследстве',
            hook: 'Мудрец одолжил братьям верблюда — и забрал его обратно.',
            body: 'Отец оставил трём сыновьям 11 верблюдов: старшему половину, среднему треть, младшему двенадцатую часть. Но 11 не делится ни на 2, ни на 3, ни на 12. Мудрец добавил своего верблюда — стало 12. Старший взял 6, средний 4, младший 1: вместе 11. Мудрец сел на своего верблюда и уехал.\n\nСекрет в том, что половина, треть и двенадцатая часть вместе меньше целого: не хватает как раз одной двенадцатой. В самой известной версии этой задачи верблюдов 17, а доли — половина, треть и девятая часть.',
            probe: 'Тот же фокус с 41 верблюдом: половина, треть и седьмая часть. Одолжи одного — сколько достанется младшему? 42 ÷ 7 = ?',
            answer: '6. Старшему 21, среднему 14, младшему 6: вместе 41 — и одолженный верблюд снова лишний.'
        },
        {
            name: 'Ахиллес и черепаха',
            era: 'Зенон Элейский, около 450 года до н. э.',
            hook: 'Самый быстрый бегун никогда не догонит черепаху. Или всё-таки догонит?',
            body: 'Ахиллес бежит в 5 раз быстрее черепахи и даёт ей 100 метров форы. Пока он добегает до места, где была черепаха, она успевает отползти дальше. Пока он добегает до нового места — она снова чуть впереди. И так без конца: кажется, догнать нельзя.\n\nНо кусочки пути всё короче: каждый в 5 раз меньше предыдущего. Вместе они складываются не в бесконечность, а ровно в 125 метров. Там Ахиллес черепаху и догонит.',
            probe: 'Пока Ахиллес пробегает первые 100 м, черепаха проползает в 5 раз меньше: 100 ÷ 5 = ?',
            answer: '20 метров. Как на картинке: за Ахиллесом пять больших следов, а за черепахой — один маленький.'
        },
        {
            name: 'Три двери',
            era: 'Задача Стива Селвина, 1975',
            hook: 'Три двери, за одной приз. Поменять выбор — выгоднее вдвое.',
            body: 'Ты выбираешь одну из трёх дверей. Ведущий знает, где приз, и открывает одну из двух других — там коза. Кажется, что шансы теперь пополам.\n\nНо твоя дверь угадана лишь в одном случае из трёх, а в двух случаях из трёх приз за другими дверями — и ведущий как раз убрал из них пустую. Поэтому, если играть много раз, менять выбор выгоднее: выигрываешь вдвое чаще.',
            probe: 'Сыграли 45 раз и ни разу не меняли дверь. Сколько примерно побед? 45 ÷ 3 = ?',
            answer: '15. Не меняя двери, выигрываешь примерно в одной игре из трёх. А если всегда менять — около 30 побед, вдвое больше.'
        }
    ],
    en: [
        {
            name: 'The Secret of the Die',
            era: 'How a die is made',
            hook: 'Look at the top of a die and you will know what is underneath.',
            body: 'On a die, the six is opposite the one, and the four is opposite the three. Add them up and you get 7.\n\nAlmost every die in the world is made this way: any two opposite faces add up to 7. Roll a die, look at the top, and you can tell how many dots are on the bottom without turning it over.',
            probe: 'The top shows 5 dots. How many are on the bottom? 5 + ? = 7',
            answer: '2. The two is always opposite the five.'
        },
        {
            name: 'The Turtle with the Magic Shell',
            era: 'The Lo Shu square, an ancient Chinese legend',
            hook: 'Nine numbers in a square — and every row adds up to 15.',
            body: 'An ancient Chinese legend says that a turtle came out of the River Lo, and its shell had a pattern of dots: the numbers from 1 to 9, arranged in a three-by-three square.\n\nAdd up any row, any column or either diagonal — you always get 15. Squares like this were later called magic squares.',
            probe: 'The top row of the shell: 4, 9 and one more number. 4 + 9 + ? = 15',
            answer: '2. The whole shell is 4 9 2, 3 5 7, 8 1 6 — check any row.'
        },
        {
            name: 'The Boy Who Did Not Add One by One',
            era: 'Biography of Gauss by Sartorius von Waltershausen, 1856',
            hook: 'The teacher set a sum of all the numbers from 1 to 100 — little Gauss did it in a minute.',
            body: 'The story goes that the teacher wanted to keep the class busy for a long time, but Carl Friedrich Gauss wrote the answer almost at once: 5050.\n\nHe noticed pairs: 1 + 100, 2 + 99, 3 + 98 — each makes 101, and there are 50 such pairs. The boy grew up to be one of the greatest mathematicians in history.',
            probe: 'Add 1 + 2 + … + 10 the Gauss way — first with last: 1 + 10, 2 + 9, 3 + 8, 4 + 7, 5 + 6. 11 + 11 + 11 + 11 + 11 = ?',
            answer: '55. Five pairs of 11 — and no number is left without a partner, just like in Gauss\'s sum.'
        },
        {
            name: 'The Sequence That Grows in a Pine Cone',
            era: 'Leonardo of Pisa, Liber Abaci, 1202',
            hook: 'A simple row of numbers hides in every pine cone and every sunflower.',
            body: 'Start with 1 and 1, then keep adding the last two numbers: 1 + 1 = 2, 1 + 2 = 3, 2 + 3 = 5, 3 + 5 = 8, then 13, 21, 34… More than 800 years ago the Italian Leonardo of Pisa described this sequence in his book — today we call him Fibonacci.\n\nLater it turned out that nature "counts" the same way. Take a pine cone and count the spirals of its scales: often there are 8 one way and 13 the other — two neighbouring numbers of the sequence. A sunflower has spirals of seeds: 34 and 55, and in big ones 55 and 89.',
            probe: 'Continue the sequence: 21 + 34 = 55, and 34 + 55 = ?',
            answer: '89 — and these are spirals too: big sunflowers have 55 one way and 89 the other.'
        },
        {
            name: 'How Many Squares Are on a Chessboard?',
            era: 'An old chessboard puzzle',
            hook: 'A chessboard has 64 cells. But it has 204 squares.',
            body: 'Start with a small board, 3 by 3. It has 9 cells but more squares: 9 small ones, 4 medium ones — each made of four cells, and they overlap — and 1 big one, the whole board. That makes 9 + 4 + 1 = 14.\n\nA chessboard works the same way, just with more sizes: 64 + 49 + 36 + 25 + 16 + 9 + 4 + 1 = 204. So two thirds of the squares on the board are hiding in plain sight.',
            probe: 'On a chessboard there are 64 one-cell squares and 49 squares of 2 by 2: 64 + 49 = ?',
            answer: '113. And that is only the two smallest sizes — there are eight sizes in all.'
        },
        {
            name: 'The Countdown Was Invented for a Film',
            era: 'Fritz Lang, the film "Woman in the Moon", 1929',
            hook: '"Ten, nine, eight… lift-off!" — counting like this was invented not by an engineer but by a film director.',
            body: 'It is said that the countdown before a rocket launch was invented by the director Fritz Lang for his film "Woman in the Moon" in 1929.\n\nWhy count down instead of up? When you count up — "one, two, three…" — nobody knows when the launch will be. But in a countdown every number tells you how many seconds are left, and the launch comes exactly at zero. Engineers liked the idea, and real rockets are launched this way today.',
            probe: 'The countdown started at 10, and 4 seconds have passed: 10 − 4 = ?',
            answer: '6. That is how many seconds are left before the launch — and in a countdown it is exactly the number you hear.'
        },
        {
            name: 'When Does a Heap Stop Being a Heap?',
            era: 'Eubulides of Miletus, 4th century BC',
            hook: 'Take one sweet from a heap — it is still a heap. But what if you keep going?',
            body: '20 sweets are definitely a heap. Eat one: 19 is still a heap — one sweet makes no difference. And so on, step by step, until only one sweet is left — and nobody would call that a heap. So where was the line? There is none: the word "heap" has no exact number. The ancient Greeks were already arguing about it.\n\nThat is why rules use numbers, not "lots": "for children under 12", "no more than 10 items". You cannot argue with a number.',
            probe: 'Every day you eat 4 of the 20 sweets. After 4 days: 20 − 4 − 4 − 4 − 4 = ? Is it still a heap?',
            answer: '4 sweets. Whether that is a heap is up to you: there is no exact answer — and that is the paradox.'
        },
        {
            name: 'Where Did the Coin Go?',
            era: 'An old trick puzzle',
            hook: 'The travellers paid 27 coins, and the porter kept 2. So where is the thirtieth?',
            body: 'Three travellers paid 30 coins for a room. The innkeeper remembered that the room cost only 25 and sent the porter to give back 5. Five does not split three ways, so he gave each traveller one coin and kept two for himself. So each paid 9, together 27, plus the porter\'s 2 — that makes 29. Where is the thirtieth?\n\nWork out where every coin is. Of the travellers\' 27 coins, 25 are with the innkeeper and 2 with the porter. And 3 more went back into the travellers\' pockets: 27 + 3 = 30. All the coins are there! The mistake is adding 2 to 27: those two coins are already part of the 27.',
            probe: 'The travellers gave 27, and the innkeeper has 25. How many does the porter have? 27 − 25 = ?',
            answer: '2. Those 2 coins are part of the 27, so you cannot add them to 27. The right count: 25 with the innkeeper + 2 with the porter + 3 given back to the travellers = 30.'
        },
        {
            name: 'The Ten Days That Never Happened',
            era: 'The calendar reform of 1582',
            hook: 'In 1582, people went to bed on 4 October and woke up on the 15th.',
            body: 'In the old calendar the year was 11 minutes longer than the real one. A tiny difference — but over more than a thousand years it added up to 10 days, and spring began on the calendar at the wrong time.\n\nTo put things right, the extra days were simply crossed out: in Italy, Spain, Portugal and Poland, Thursday 4 October was followed straight away by Friday 15 October. Other countries switched later — in Britain, in 1752, as many as 11 days disappeared. Almost the whole world lives by this calendar today.',
            probe: 'By the old calendar a year was 365 days and 6 hours, but in fact it is 365 days, 5 hours and 49 minutes. From 5:49 to 6:00: 60 − 49 = ?',
            answer: '11. Only 11 minutes a year — but over the centuries they added up to 10 days.'
        },
        {
            name: 'The Ship of Theseus',
            era: 'Plutarch, Parallel Lives, around AD 100',
            hook: 'Every plank was replaced, one at a time. Is it the same ship or a different one?',
            body: 'A ship has 150 planks, and one is replaced every year. After 150 years not a single plank of the old ship is left, yet in all those years nobody would have said it had been swapped.\n\nAnd if you build a second ship from the old planks — which of the two is the real one? There is no strict answer — people have been arguing about it for two thousand years.',
            probe: 'Of the 150 planks, 120 have been replaced. How many old ones are left? 150 − 120 = ?',
            answer: '30. And if you build a second ship from the 120 planks that came off — which of the two is the real one?'
        },
        {
            name: 'Folding Paper to the Moon',
            era: 'Britney Gallivan, January 2002',
            hook: 'Fold a sheet of paper in half 42 times — and the stack will reach the Moon.',
            body: 'Every time you fold a sheet in half, the number of layers doubles: 1, 2, 4, 8… Try it — an ordinary sheet will not fold more than seven or eight times. In 2002 a schoolgirl, Britney Gallivan, folded a long strip of paper 12 times and set a record.\n\nThe catch is how fast doubling grows. A sheet is thinner than a millimetre, but after 42 folds there would be more than four trillion layers — and such a stack would reach all the way to the Moon.',
            probe: 'Folded 3 times. How many layers? 2 × 2 × 2 = ?',
            answer: '8. Look at the sheet in the picture: the creases divide it into exactly 8 parts.'
        },
        {
            name: 'The Nine Times Table on Your Fingers',
            era: 'An old way of counting on your fingers',
            hook: 'The whole nine times table is hidden in your hands.',
            body: 'Put your hands on the table and bend down the finger whose number you are multiplying nine by. The fingers to the left of the bent one are the tens, those to the right are the ones. For 9 × 3, bend the third finger: 2 on the left, 7 on the right — that makes 27.\n\nThe secret is that 9 × 3 is 30 minus 3. There is one ten fewer than the number you multiply by, and as many ones as that number is short of ten. The fingers show exactly that.',
            probe: 'Bend the sixth finger and count the fingers on the left and on the right. 9 × 6 = ?',
            answer: '54. There are 5 fingers to the left of the bent one and 4 to the right.'
        },
        {
            name: 'How Many Walls Does a Honeycomb Have?',
            era: 'Varro, 1st century BC; Pappus of Alexandria; Thomas Hales, 1999',
            hook: 'One cell has 6 walls. Seven cells have far fewer than seven times six.',
            body: 'Bees build their combs out of hexagons, and neighbouring cells share a wall. So there are fewer walls than it seems — which means less wax is needed.\n\nPeople were already asking why honeycombs are hexagonal in ancient Rome. But it was only in 1999 that the mathematician Thomas Hales proved that hexagonal cells take the least wax of all.',
            probe: '7 cells: one in the middle and six around it. If each had its own walls, there would be 7 × 6 = ?',
            answer: '42. But 12 walls are shared — each one serves two cells at once, so there are really 42 − 12 = 30 walls.'
        },
        {
            name: 'The Monkey at the Typewriter',
            era: 'Émile Borel, 1913',
            hook: 'A monkey hitting keys at random will one day type out "Hamlet".',
            body: 'The chance that random key presses will make a word is tiny, but it is not zero. And something whose chance is not zero is bound to happen if you keep trying forever.\n\nOnly the wait would be unimaginably long: every new letter multiplies the number of tries. The typewriter in the picture has 10 keys, and on average a three-letter word will come out on it after 10 × 10 × 10 = 1000 tries. But a single line of "Hamlet" would take longer than the Universe has existed.',
            probe: 'A real typewriter has about 30 letters. On average a two-letter word will come out after 30 × 30 = ? tries',
            answer: '900. And a three-letter word already takes 27,000 tries.'
        },
        {
            name: 'The Birthday Paradox',
            era: 'Richard von Mises, 1939',
            hook: 'In a group of 23 people, the chance of a shared birthday is better than even.',
            body: 'It seems you would need hundreds of people for a match — a year has 365 days, after all. But any pair can match, and there are far more pairs than people.\n\nEach of the 23 makes a pair with each of the other 22: 23 × 22 = 506, and every pair has been counted twice — so there are 253 pairs. That is already enough for a match to be more likely than not. And in a class of 30 it happens about seven times out of ten.',
            probe: 'There are 30 children in a class. Each makes a pair with each of the other 29: 29 × 30 = ?',
            answer: '870. Every pair was counted twice, so there are 435 pairs — no wonder a match turns up so often.'
        },
        {
            name: 'I Cut, You Choose',
            era: 'UN Convention on the Law of the Sea, 1982',
            hook: 'How do you share a cake between two so that nobody feels cheated?',
            body: 'One person cuts the cake, and the other picks a piece first. The one who cuts tries to make two exactly equal halves — otherwise the smaller piece is the one left for them.\n\nCakes are not the only thing shared this way. Under the UN Law of the Sea, areas of the ocean floor are divided the same way: a company that wants to mine there splits the area it has found into two parts of equal value, and the International Seabed Authority picks one of them for itself.',
            probe: '10 sweets shared fairly between two: 10 ÷ 2 = ?',
            answer: '5. That is just how they lie in the picture: two rows of five sweets on the plate.'
        },
        {
            name: 'Why Can’t You Divide by Zero?',
            era: 'Bhaskara II, "Bijaganita", around 1150',
            hook: 'Twelve sweets for zero friends — how many does each one get?',
            body: 'Division is checked by multiplication: 15 ÷ 3 = 5, because 5 × 3 = 15. Let’s try 12 ÷ 0: we need a number that gives 12 when multiplied by 0. But any number multiplied by 0 gives 0. There is no such number — the problem simply has no answer.\n\nPeople puzzled over this for centuries: back in the 12th century the Indian mathematician Bhaskara called such an answer infinity. But 0 ÷ 12 is fine: zero sweets for twelve friends, zero each.',
            probe: '12 sweets for four friends: 12 ÷ 4 = ? Check with multiplication: the answer × 4 must make 12.',
            answer: '3. 3 × 4 = 12: each of the four has three sweets on their plate. And there is no way to hand any out to the empty bench — there are zero friends there.'
        },
        {
            name: 'The Twelfth Camel',
            era: 'An old inheritance puzzle',
            hook: 'A wise man lent the brothers a camel — and then took it back.',
            body: 'A father left his three sons 11 camels: half to the eldest, a third to the middle one and a twelfth to the youngest. But 11 cannot be divided by 2, by 3 or by 12. A wise man added his own camel — that made 12. The eldest took 6, the middle one 4, the youngest 1: 11 in all. The wise man got back on his camel and rode away.\n\nThe secret is that a half, a third and a twelfth together make less than a whole: exactly one twelfth is missing. In the best-known version of this puzzle there are 17 camels, and the shares are a half, a third and a ninth.',
            probe: 'The same trick with 41 camels: a half, a third and a seventh. Borrow one — how many does the youngest get? 42 ÷ 7 = ?',
            answer: '6. The eldest gets 21, the middle one 14, the youngest 6: 41 in all — and the borrowed camel is left over again.'
        },
        {
            name: 'Achilles and the Tortoise',
            era: 'Zeno of Elea, around 450 BC',
            hook: 'The fastest runner will never catch a tortoise. Or will he?',
            body: 'Achilles runs 5 times faster than the tortoise and gives it a 100-metre head start. By the time he reaches the spot where the tortoise was, it has crawled a little further. By the time he reaches that new spot, it is a little ahead again. And so on forever: it seems he can never catch up.\n\nBut the stretches keep getting shorter: each one is 5 times smaller than the one before. Together they add up not to infinity but to exactly 125 metres. That is where Achilles catches the tortoise.',
            probe: 'While Achilles runs the first 100 m, the tortoise crawls 5 times less: 100 ÷ 5 = ?',
            answer: '20 metres. Just like in the picture: five big footprints behind Achilles, and a single small one behind the tortoise.'
        },
        {
            name: 'Three Doors',
            era: 'Steve Selvin’s problem, 1975',
            hook: 'Three doors, a prize behind one. Switching your choice doubles your chances.',
            body: 'You pick one of three doors. The host knows where the prize is and opens one of the other two — there is a goat behind it. It seems your chances are now fifty-fifty.\n\nBut your door is right in only one case out of three, and in two cases out of three the prize is behind the other doors — and the host has just removed the empty one among them. So if you play many times, switching is better: you win twice as often.',
            probe: 'You played 45 times and never switched doors. Roughly how many wins? 45 ÷ 3 = ?',
            answer: '15. If you never switch, you win about one game in three. If you always switch — about 30 wins, twice as many.'
        }
    ],
    fr: [
        {
            name: 'Le secret du dé',
            era: 'La construction d’un dé à jouer',
            hook: 'Regarde le dessus d’un dé — et tu sauras ce qu’il y a dessous.',
            body: 'Sur un dé, le six est en face du un, et le quatre en face du trois. Additionne : cela fait 7.\n\nPresque tous les dés du monde sont faits ainsi : deux faces opposées font toujours 7 ensemble. Lance un dé, regarde le dessus — et tu sauras combien de points il y a dessous, sans le retourner.',
            probe: 'Le dessus montre 5 points. Combien y en a-t-il dessous ? 5 + ? = 7',
            answer: '2. En face du cinq, il y a toujours le deux.'
        },
        {
            name: 'La tortue à la carapace magique',
            era: 'Le carré Lo Shu, légende de la Chine ancienne',
            hook: 'Neuf nombres dans un carré — et chaque ligne fait 15.',
            body: 'Selon une légende de la Chine ancienne, une tortue sortit du fleuve Lo, et sa carapace portait un motif de points : les nombres de 1 à 9, rangés en un carré de trois sur trois.\n\nAdditionne n’importe quelle ligne, colonne ou diagonale — tu obtiens toujours 15. Plus tard, on a appelé de tels carrés des carrés magiques.',
            probe: 'La ligne du haut de la carapace : 4, 9 et encore un nombre. 4 + 9 + ? = 15',
            answer: '2. Toute la carapace : 4 9 2, 3 5 7, 8 1 6 — vérifie n’importe quelle ligne.'
        },
        {
            name: 'Le garçon qui n’a pas compté dans l’ordre',
            era: 'Biographie de Gauss par Sartorius von Waltershausen, 1856',
            hook: 'Le maître a demandé d’additionner les nombres de 1 à 100 — le petit Gauss a fini en une minute.',
            body: 'On raconte que le maître voulait occuper la classe longtemps, mais Carl Friedrich Gauss a écrit la réponse presque tout de suite : 5050.\n\nIl avait remarqué des paires : 1 + 100, 2 + 99, 3 + 98 — chacune fait 101, et il y a 50 paires de ce genre. Le garçon est devenu l’un des plus grands mathématiciens de l’histoire.',
            probe: 'Additionne 1 + 2 + … + 10 à la manière de Gauss — le premier avec le dernier : 1 + 10, 2 + 9, 3 + 8, 4 + 7, 5 + 6. 11 + 11 + 11 + 11 + 11 = ?',
            answer: '55. Cinq paires de 11 — et aucun nombre ne reste sans partenaire, exactement comme chez Gauss.'
        },
        {
            name: 'La suite qui pousse dans une pomme de pin',
            era: 'Léonard de Pise, Liber abaci, 1202',
            hook: 'Une suite de nombres toute simple se cache dans chaque pomme de pin et chaque tournesol.',
            body: 'Commence par 1 et 1, puis additionne toujours les deux derniers nombres : 1 + 1 = 2, 1 + 2 = 3, 2 + 3 = 5, 3 + 5 = 8, puis 13, 21, 34… Il y a plus de 800 ans, l’Italien Léonard de Pise a décrit cette suite dans son livre — aujourd’hui on l’appelle Fibonacci.\n\nPlus tard, on a découvert que la nature « compte » de la même façon. Prends une pomme de pin et compte les spirales de ses écailles : souvent 8 dans un sens et 13 dans l’autre — deux nombres voisins de la suite. Le tournesol a des spirales de graines : 34 et 55, et chez les grands, 55 et 89.',
            probe: 'Continue la suite : 21 + 34 = 55, et 34 + 55 = ?',
            answer: '89 — et ce sont aussi des spirales : les grands tournesols en ont 55 dans un sens et 89 dans l’autre.'
        },
        {
            name: 'Combien de carrés sur un échiquier ?',
            era: 'Une vieille énigme de l’échiquier',
            hook: 'Un échiquier a 64 cases. Mais il compte 204 carrés.',
            body: 'Commence par un petit plateau de 3 sur 3. Il a 9 cases, mais plus de carrés : 9 petits, encore 4 moyens — chacun fait de quatre cases, et ils se chevauchent — et 1 grand, tout le plateau. En tout 9 + 4 + 1 = 14.\n\nSur un échiquier, c’est pareil, avec plus de tailles : 64 + 49 + 36 + 25 + 16 + 9 + 4 + 1 = 204. Les deux tiers des carrés de l’échiquier se cachent donc sous nos yeux.',
            probe: 'Sur un échiquier, il y a 64 carrés d’une case et 49 carrés de 2 sur 2 : 64 + 49 = ?',
            answer: '113. Et ce ne sont que les deux plus petites tailles — il y en a huit en tout.'
        },
        {
            name: 'Le compte à rebours est né au cinéma',
            era: 'Fritz Lang, le film « La Femme sur la Lune », 1929',
            hook: '« Dix, neuf, huit… décollage ! » — ce compte, c’est un cinéaste qui l’a inventé, pas un ingénieur.',
            body: 'On dit que le compte à rebours avant le lancement d’une fusée a été inventé par le réalisateur Fritz Lang pour son film « La Femme sur la Lune », en 1929.\n\nPourquoi compter à rebours et pas dans l’ordre ? Quand on compte « un, deux, trois… », on ne sait pas quand aura lieu le départ. Mais à rebours, chaque nombre dit combien de secondes il reste, et le départ tombe pile sur zéro. L’idée a plu aux ingénieurs, et aujourd’hui les vraies fusées décollent ainsi.',
            probe: 'Le compte à rebours a commencé à 10, et 4 secondes sont passées : 10 − 4 = ?',
            answer: '6. C’est le nombre de secondes avant le départ — et dans un compte à rebours, c’est justement ce nombre qu’on entend.'
        },
        {
            name: 'Quand un tas cesse-t-il d’être un tas ?',
            era: 'Eubulide de Milet, IVe siècle av. J.-C.',
            hook: 'Enlève un bonbon d’un tas — c’est toujours un tas. Et si tu continues ?',
            body: '20 bonbons, c’est sûrement un tas. Mange-en un : 19, c’est toujours un tas — un seul bonbon ne change rien. Et ainsi de suite, pas à pas, jusqu’à ce qu’il ne reste qu’un bonbon — et celui-là, on ne peut plus l’appeler un tas. Où était donc la limite ? Il n’y en a pas : le mot « tas » n’a pas de nombre exact. Les Grecs anciens en débattaient déjà.\n\nVoilà pourquoi les règles donnent des nombres et pas « beaucoup » : « pour les enfants de moins de 12 ans », « pas plus de 10 articles ». Avec un nombre, impossible de discuter.',
            probe: 'Chaque jour, tu manges 4 des 20 bonbons. Au bout de 4 jours : 20 − 4 − 4 − 4 − 4 = ? Est-ce encore un tas ?',
            answer: '4 bonbons. Tas ou pas tas, c’est à toi de décider : il n’y a pas de réponse exacte, et c’est tout le paradoxe.'
        },
        {
            name: 'Où est passée la pièce ?',
            era: 'Une vieille énigme piège',
            hook: 'Les voyageurs ont payé 27 pièces, le garçon en a gardé 2. Où est la trentième ?',
            body: 'Trois voyageurs ont payé 30 pièces pour une chambre. L’aubergiste s’est souvenue que la chambre coûtait 25 et a envoyé le garçon rendre 5 pièces. Cinq ne se partage pas en trois : il a rendu une pièce à chacun et en a gardé deux. Chacun a donc payé 9, ensemble 27, plus 2 chez le garçon — cela fait 29. Où est la trentième ?\n\nCherche où se trouve chaque pièce. Sur les 27 pièces des voyageurs, 25 sont chez l’aubergiste et 2 chez le garçon. Et 3 sont retournées dans les poches des voyageurs : 27 + 3 = 30. Toutes les pièces sont là ! L’erreur, c’est d’ajouter 2 à 27 : ces deux pièces font déjà partie des 27.',
            probe: 'Les voyageurs ont donné 27, l’aubergiste en a 25. Combien en a le garçon ? 27 − 25 = ?',
            answer: '2. Ces 2 pièces font partie des 27, on ne peut donc pas les ajouter à 27. Le bon compte : 25 chez l’aubergiste + 2 chez le garçon + 3 rendues aux voyageurs = 30.'
        },
        {
            name: 'Les dix jours qui n’ont jamais existé',
            era: 'La réforme du calendrier de 1582',
            hook: 'En 1582, les gens se sont couchés le 4 octobre et se sont réveillés le 15.',
            body: 'Dans l’ancien calendrier, l’année durait 11 minutes de plus que la vraie. Une broutille — mais en plus de mille ans, cela faisait déjà 10 jours, et le printemps du calendrier ne commençait plus au bon moment.\n\nPour tout remettre en place, on a simplement supprimé les jours en trop : en Italie, en Espagne, au Portugal et en Pologne, le jeudi 4 octobre a été suivi directement du vendredi 15 octobre. D’autres pays ont changé plus tard — en Grande-Bretagne, en 1752, ce sont 11 jours qui ont disparu. Aujourd’hui, presque le monde entier vit selon ce calendrier.',
            probe: 'Selon l’ancien calendrier, une année durait 365 jours et 6 heures, mais en réalité elle dure 365 jours, 5 heures et 49 minutes. De 5 h 49 à 6 h : 60 − 49 = ?',
            answer: '11. Seulement 11 minutes par an — mais au fil des siècles, elles ont fait 10 jours.'
        },
        {
            name: 'Le bateau de Thésée',
            era: 'Plutarque, Vies parallèles, vers l’an 100',
            hook: 'On a remplacé toutes les planches, une par une. Est-ce le même bateau ou un autre ?',
            body: 'Un bateau compte 150 planches, et on en change une chaque année. Au bout de 150 ans, il ne reste plus une seule planche de l’ancien bateau — et pourtant, pendant toutes ces années, personne n’aurait dit qu’on l’avait remplacé.\n\nEt si on construit un second bateau avec les vieilles planches — lequel des deux est le vrai ? Il n’y a pas de réponse stricte — on en débat depuis deux mille ans.',
            probe: 'Sur 150 planches, 120 ont été remplacées. Combien d’anciennes reste-t-il ? 150 − 120 = ?',
            answer: '30. Et si on construit un second bateau avec les 120 planches retirées — lequel des deux est le vrai ?'
        },
        {
            name: 'Une feuille de papier jusqu’à la Lune',
            era: 'Britney Gallivan, janvier 2002',
            hook: 'Plie une feuille en deux 42 fois — et la pile atteindra la Lune.',
            body: 'Chaque fois qu’on plie une feuille en deux, le nombre de couches double : 1, 2, 4, 8… Essaie : une feuille ordinaire ne se plie pas plus de sept ou huit fois. En 2002, une lycéenne, Britney Gallivan, a plié une longue bande de papier 12 fois et a établi un record.\n\nTout le secret est dans la vitesse du doublement. Une feuille fait moins d’un millimètre d’épaisseur, mais après 42 pliages, il y aurait plus de quatre mille milliards de couches — et une telle pile irait jusqu’à la Lune.',
            probe: 'On a plié 3 fois. Combien de couches ? 2 × 2 × 2 = ?',
            answer: '8. Regarde la feuille sur l’image : les plis la divisent en exactement 8 parties.'
        },
        {
            name: 'La table de 9 sur les doigts',
            era: 'Une vieille méthode pour compter sur ses doigts',
            hook: 'Toute la table de 9 est cachée dans tes mains.',
            body: 'Pose tes mains sur la table et replie le doigt dont le numéro est le nombre par lequel tu multiplies neuf. Les doigts à gauche du doigt replié sont les dizaines, ceux de droite sont les unités. Pour 9 × 3, replie le troisième doigt : 2 à gauche, 7 à droite — cela fait 27.\n\nLe secret, c’est que 9 × 3, c’est 30 moins 3. Il y a une dizaine de moins que le nombre par lequel on multiplie, et autant d’unités qu’il lui manque pour arriver à dix. Les doigts montrent exactement cela.',
            probe: 'Replie le sixième doigt et compte les doigts à gauche et à droite. 9 × 6 = ?',
            answer: '54. Il y a 5 doigts à gauche du doigt replié et 4 à droite.'
        },
        {
            name: 'Combien de parois dans les alvéoles ?',
            era: 'Varron, Ier siècle av. J.-C. ; Pappus d’Alexandrie ; Thomas Hales, 1999',
            hook: 'Une alvéole a 6 parois. Sept alvéoles en ont bien moins que sept fois six.',
            body: 'Les abeilles construisent leurs rayons avec des hexagones, et les alvéoles voisines partagent une paroi. Il y a donc moins de parois qu’il n’y paraît — et il faut moins de cire.\n\nOn se demandait déjà dans la Rome antique pourquoi les alvéoles sont hexagonales. Mais il a fallu attendre 1999 pour que le mathématicien Thomas Hales prouve que les alvéoles hexagonales demandent le moins de cire.',
            probe: '7 alvéoles : une au centre et six autour. Si chacune avait ses propres parois, il y en aurait 7 × 6 = ?',
            answer: '42. Mais 12 parois sont communes — chacune sert à deux alvéoles à la fois, donc en réalité il y a 42 − 12 = 30 parois.'
        },
        {
            name: 'Le singe à la machine à écrire',
            era: 'Émile Borel, 1913',
            hook: 'Un singe qui tape au hasard sur les touches finira par écrire « Hamlet ».',
            body: 'La chance que des frappes au hasard forment un mot est minuscule, mais elle n’est pas nulle. Et ce qui a une chance non nulle finit forcément par arriver si l’on essaie indéfiniment.\n\nSeulement, l’attente serait inimaginablement longue : chaque nouvelle lettre multiplie le nombre d’essais. La machine de l’image a 10 touches, et un mot de trois lettres y sortira en moyenne au bout de 10 × 10 × 10 = 1000 essais. Mais une seule ligne d’« Hamlet » demanderait plus de temps que l’âge de l’Univers.',
            probe: 'Une vraie machine à écrire a environ 30 lettres. Un mot de deux lettres sortira en moyenne au bout de 30 × 30 = ? essais',
            answer: '900. Et un mot de trois lettres demande déjà 27 000 essais.'
        },
        {
            name: 'Le paradoxe des anniversaires',
            era: 'Richard von Mises, 1939',
            hook: 'Dans un groupe de 23 personnes, il y a plus d’une chance sur deux que deux anniversaires coïncident.',
            body: 'On croirait qu’il faut des centaines de personnes pour une coïncidence — une année compte bien 365 jours. Mais n’importe quelle paire peut tomber juste, et les paires sont bien plus nombreuses que les personnes.\n\nChacune des 23 personnes forme une paire avec chacune des 22 autres : 23 × 22 = 506, et chaque paire est comptée deux fois — il y a donc 253 paires. Cela suffit déjà pour qu’une coïncidence soit plus probable que le contraire. Et dans une classe de 30, cela arrive environ sept fois sur dix.',
            probe: 'Il y a 30 élèves dans une classe. Chaque élève forme une paire avec chacun des 29 autres : 29 × 30 = ?',
            answer: '870. Chaque paire a été comptée deux fois, il y a donc 435 paires — pas étonnant qu’une coïncidence arrive si souvent.'
        },
        {
            name: 'L’un coupe, l’autre choisit',
            era: 'Convention des Nations unies sur le droit de la mer, 1982',
            hook: 'Comment partager un gâteau à deux sans la moindre dispute ?',
            body: 'L’un coupe le gâteau, l’autre choisit sa part en premier. Celui qui coupe essaie de faire deux moitiés exactement égales — sinon, la plus petite part lui restera.\n\nOn ne partage pas que les gâteaux de cette façon. Selon le droit de la mer de l’ONU, les zones des fonds marins se partagent de la même manière : une entreprise qui veut y exploiter des minerais divise la zone trouvée en deux parts de même valeur, et l’Autorité internationale des fonds marins en choisit une pour elle.',
            probe: '10 bonbons partagés équitablement entre deux : 10 ÷ 2 = ?',
            answer: '5. C’est exactement ce que montre l’image : deux rangées de cinq bonbons sur l’assiette.'
        },
        {
            name: 'Pourquoi ne peut-on pas diviser par zéro ?',
            era: 'Bhaskara II, « Bijaganita », vers 1150',
            hook: 'Douze bonbons à partager entre zéro ami : combien par personne ?',
            body: 'On vérifie une division par une multiplication : 15 ÷ 3 = 5, parce que 5 × 3 = 15. Essayons 12 ÷ 0 : il faut un nombre qui, multiplié par 0, donne 12. Mais tout nombre multiplié par 0 donne 0. Ce nombre n’existe pas — l’opération n’a tout simplement pas de réponse.\n\nOn y a réfléchi pendant des siècles : au XIIe siècle déjà, le mathématicien indien Bhaskara appelait une telle réponse l’infini. En revanche, 0 ÷ 12 ne pose aucun problème : zéro bonbon pour douze amis, zéro pour chacun.',
            probe: '12 bonbons pour quatre amis : 12 ÷ 4 = ? Vérifie par une multiplication : la réponse × 4 doit donner 12.',
            answer: '3. 3 × 4 = 12 : chacun des quatre a trois bonbons dans son assiette. Et au banc vide, impossible d’en distribuer : il y a zéro ami.'
        },
        {
            name: 'Le douzième chameau',
            era: 'Une vieille énigme d’héritage',
            hook: 'Un sage a prêté un chameau aux frères — puis l’a repris.',
            body: 'Un père laissa à ses trois fils 11 chameaux : la moitié à l’aîné, le tiers au cadet, le douzième au benjamin. Mais 11 ne se divise ni par 2, ni par 3, ni par 12. Un sage ajouta son propre chameau — cela fit 12. L’aîné en prit 6, le cadet 4, le benjamin 1 : 11 en tout. Le sage remonta sur son chameau et s’en alla.\n\nLe secret, c’est que la moitié, le tiers et le douzième ensemble font moins qu’un tout : il manque justement un douzième. Dans la version la plus connue de cette énigme, il y a 17 chameaux, et les parts sont la moitié, le tiers et le neuvième.',
            probe: 'Le même tour avec 41 chameaux : la moitié, le tiers et le septième. Emprunte un chameau — combien en reçoit le benjamin ? 42 ÷ 7 = ?',
            answer: '6. L’aîné en reçoit 21, le cadet 14, le benjamin 6 : 41 en tout — et le chameau emprunté est de nouveau en trop.'
        },
        {
            name: 'Achille et la tortue',
            era: 'Zénon d’Élée, vers 450 av. J.-C.',
            hook: 'Le coureur le plus rapide ne rattrapera jamais une tortue. Ou bien si ?',
            body: 'Achille court 5 fois plus vite que la tortue et lui laisse 100 mètres d’avance. Le temps qu’il atteigne l’endroit où était la tortue, elle s’est déjà un peu éloignée. Le temps qu’il atteigne ce nouvel endroit, elle est de nouveau un peu devant. Et ainsi de suite, sans fin : on dirait qu’il ne pourra jamais la rattraper.\n\nMais les morceaux de chemin sont de plus en plus courts : chacun est 5 fois plus petit que le précédent. Ensemble, ils ne font pas l’infini, mais exactement 125 mètres. C’est là qu’Achille rattrape la tortue.',
            probe: 'Pendant qu’Achille court les 100 premiers mètres, la tortue avance 5 fois moins : 100 ÷ 5 = ?',
            answer: '20 mètres. Comme sur l’image : derrière Achille, cinq grandes empreintes, et derrière la tortue, une seule petite.'
        },
        {
            name: 'Trois portes',
            era: 'Problème de Steve Selvin, 1975',
            hook: 'Trois portes, un prix derrière l’une d’elles. Changer de choix rapporte deux fois plus.',
            body: 'Tu choisis une des trois portes. Le présentateur sait où est le prix et ouvre une des deux autres — derrière, il y a une chèvre. On dirait que maintenant, c’est une chance sur deux.\n\nMais ta porte n’est la bonne que dans un cas sur trois, et dans deux cas sur trois le prix est derrière les autres portes — or le présentateur vient justement d’écarter la mauvaise parmi elles. Donc, si l’on joue de nombreuses fois, il vaut mieux changer : on gagne deux fois plus souvent.',
            probe: 'Tu as joué 45 fois sans jamais changer de porte. Environ combien de victoires ? 45 ÷ 3 = ?',
            answer: '15. Sans changer de porte, on gagne environ une partie sur trois. En changeant à chaque fois — environ 30 victoires, deux fois plus.'
        }
    ],
    de: [
        {
            name: 'Das Geheimnis des Würfels',
            era: 'Wie ein Spielwürfel gebaut ist',
            hook: 'Schau oben auf einen Würfel — und du weißt, was unten ist.',
            body: 'Auf einem Spielwürfel liegt die Sechs gegenüber der Eins und die Vier gegenüber der Drei. Zähl zusammen: Es kommt 7 heraus.\n\nSo sind fast alle Würfel der Welt gebaut: Zwei gegenüberliegende Seiten ergeben zusammen immer 7. Wirf einen Würfel, schau auf die Oberseite — und du weißt, wie viele Augen unten sind, ohne ihn umzudrehen.',
            probe: 'Oben sind 5 Augen. Wie viele sind unten? 5 + ? = 7',
            answer: '2. Gegenüber der Fünf liegt immer die Zwei.'
        },
        {
            name: 'Die Schildkröte mit dem Zauberpanzer',
            era: 'Das Lo-Shu-Quadrat, eine altchinesische Legende',
            hook: 'Neun Zahlen in einem Quadrat — und jede Zeile ergibt 15.',
            body: 'Eine altchinesische Legende erzählt, dass aus dem Fluss Lo eine Schildkröte stieg. Auf ihrem Panzer war ein Muster aus Punkten: die Zahlen von 1 bis 9, angeordnet in einem Quadrat von drei mal drei.\n\nZähl eine beliebige Zeile, Spalte oder Diagonale zusammen — es kommt immer 15 heraus. Solche Quadrate nannte man später magische Quadrate.',
            probe: 'Die obere Zeile des Panzers: 4, 9 und noch eine Zahl. 4 + 9 + ? = 15',
            answer: '2. Der ganze Panzer: 4 9 2, 3 5 7, 8 1 6 — prüf eine beliebige Zeile.'
        },
        {
            name: 'Der Junge, der nicht der Reihe nach rechnete',
            era: 'Gauß-Biografie von Sartorius von Waltershausen, 1856',
            hook: 'Der Lehrer ließ die Zahlen von 1 bis 100 addieren — der kleine Gauß war in einer Minute fertig.',
            body: 'Man erzählt, der Lehrer wollte die Klasse lange beschäftigen, doch Carl Friedrich Gauß schrieb die Antwort fast sofort hin: 5050.\n\nEr hatte Paare entdeckt: 1 + 100, 2 + 99, 3 + 98 — jedes ergibt 101, und solche Paare gibt es 50. Der Junge wurde einer der größten Mathematiker der Geschichte.',
            probe: 'Rechne 1 + 2 + … + 10 wie Gauß — die erste mit der letzten Zahl: 1 + 10, 2 + 9, 3 + 8, 4 + 7, 5 + 6. 11 + 11 + 11 + 11 + 11 = ?',
            answer: '55. Fünf Paare zu je 11 — und keine Zahl bleibt ohne Partner, ganz wie bei Gauß.'
        },
        {
            name: 'Die Zahlenfolge im Kiefernzapfen',
            era: 'Leonardo von Pisa, Liber Abaci, 1202',
            hook: 'Eine einfache Zahlenreihe versteckt sich in jedem Zapfen und in jeder Sonnenblume.',
            body: 'Fang mit 1 und 1 an und addiere dann immer die letzten zwei Zahlen: 1 + 1 = 2, 1 + 2 = 3, 2 + 3 = 5, 3 + 5 = 8, dann 13, 21, 34… Vor über 800 Jahren beschrieb der Italiener Leonardo von Pisa diese Folge in seinem Buch — heute nennt man ihn Fibonacci.\n\nSpäter stellte sich heraus, dass die Natur genauso „zählt“. Nimm einen Kiefernzapfen und zähl die Spiralen seiner Schuppen: Oft sind es 8 in die eine und 13 in die andere Richtung — zwei benachbarte Zahlen der Folge. Die Sonnenblume hat Spiralen aus Kernen: 34 und 55, bei großen 55 und 89.',
            probe: 'Setz die Folge fort: 21 + 34 = 55, und 34 + 55 = ?',
            answer: '89 — und auch das sind Spiralen: Große Sonnenblumen haben 55 in die eine und 89 in die andere Richtung.'
        },
        {
            name: 'Wie viele Quadrate hat ein Schachbrett?',
            era: 'Ein altes Schachbrett-Rätsel',
            hook: 'Ein Schachbrett hat 64 Felder. Aber 204 Quadrate.',
            body: 'Fang mit einem kleinen Brett an, 3 mal 3. Es hat 9 Felder, aber mehr Quadrate: 9 kleine, dazu 4 mittlere — jedes aus vier Feldern, sie überlappen sich — und 1 großes, das ganze Brett. Zusammen 9 + 4 + 1 = 14.\n\nBeim Schachbrett ist es genauso, nur mit mehr Größen: 64 + 49 + 36 + 25 + 16 + 9 + 4 + 1 = 204. Zwei Drittel der Quadrate auf dem Brett verstecken sich also vor aller Augen.',
            probe: 'Auf einem Schachbrett gibt es 64 Quadrate aus einem Feld und 49 Quadrate aus 2 mal 2 Feldern: 64 + 49 = ?',
            answer: '113. Und das sind nur die zwei kleinsten Größen — insgesamt gibt es acht.'
        },
        {
            name: 'Der Countdown kam aus dem Kino',
            era: 'Fritz Lang, Film „Frau im Mond“, 1929',
            hook: '„Zehn, neun, acht … Start!“ — so zu zählen hat kein Ingenieur erfunden, sondern ein Filmregisseur.',
            body: 'Man sagt, den Countdown vor einem Raketenstart hat der Regisseur Fritz Lang erfunden — 1929, für seinen Film „Frau im Mond“.\n\nWarum rückwärts und nicht vorwärts? Wenn man vorwärts zählt — „eins, zwei, drei …“ —, weiß niemand, wann der Start ist. Beim Rückwärtszählen sagt jede Zahl, wie viele Sekunden noch bleiben, und gestartet wird genau bei null. Den Ingenieuren gefiel die Idee, und heute starten echte Raketen genau so.',
            probe: 'Der Countdown begann bei 10, und 4 Sekunden sind vergangen: 10 − 4 = ?',
            answer: '6. So viele Sekunden bleiben bis zum Start — und beim Countdown hört man genau diese Zahl.'
        },
        {
            name: 'Wann ist ein Haufen kein Haufen mehr?',
            era: 'Eubulides von Milet, 4. Jh. v. Chr.',
            hook: 'Nimm ein Bonbon aus einem Haufen — es bleibt ein Haufen. Und wenn du so weitermachst?',
            body: '20 Bonbons sind sicher ein Haufen. Iss eins: 19 sind immer noch ein Haufen — ein Bonbon macht keinen Unterschied. So geht es Schritt für Schritt weiter, bis nur noch ein Bonbon übrig ist — und das nennt niemand mehr einen Haufen. Wo war also die Grenze? Es gibt keine: Das Wort „Haufen“ hat keine genaue Zahl. Darüber stritten schon die alten Griechen.\n\nDeshalb stehen in Regeln Zahlen und nicht „viel“: „für Kinder unter 12 Jahren“, „nicht mehr als 10 Teile“. Mit einer Zahl kann man nicht streiten.',
            probe: 'Jeden Tag isst du 4 der 20 Bonbons. Nach 4 Tagen: 20 − 4 − 4 − 4 − 4 = ? Ist das noch ein Haufen?',
            answer: '4 Bonbons. Ob das ein Haufen ist, entscheidest du: Eine genaue Antwort gibt es nicht — genau das ist das Paradox.'
        },
        {
            name: 'Wo ist die Münze geblieben?',
            era: 'Ein altes Trickrätsel',
            hook: 'Die Reisenden zahlten 27 Münzen, der Bote behielt 2. Wo ist die dreißigste?',
            body: 'Drei Reisende zahlten für ein Zimmer 30 Münzen. Die Wirtin erinnerte sich, dass das Zimmer nur 25 kostete, und schickte den Boten los, um 5 zurückzugeben. Fünf lässt sich nicht durch drei teilen, also gab er jedem eine Münze und behielt zwei für sich. Jeder hat also 9 bezahlt, zusammen 27, dazu 2 beim Boten — macht 29. Wo ist die dreißigste?\n\nRechne nach, wo jede Münze liegt. Von den 27 Münzen der Reisenden hat die Wirtin 25 und der Bote 2. Und 3 sind zurück in den Taschen der Reisenden: 27 + 3 = 30. Alle Münzen sind da! Der Fehler ist, 2 zu 27 zu addieren: Diese zwei Münzen stecken schon in den 27.',
            probe: 'Die Reisenden gaben 27, die Wirtin hat 25. Wie viele hat der Bote? 27 − 25 = ?',
            answer: '2. Diese 2 Münzen sind ein Teil der 27, deshalb darf man sie nicht zu 27 addieren. Richtig gerechnet: 25 bei der Wirtin + 2 beim Boten + 3 zurück an die Reisenden = 30.'
        },
        {
            name: 'Zehn Tage, die es nie gab',
            era: 'Die Kalenderreform von 1582',
            hook: '1582 gingen die Menschen am 4. Oktober schlafen und wachten am 15. auf.',
            body: 'Im alten Kalender war das Jahr 11 Minuten länger als das echte. Eine Kleinigkeit — doch in über tausend Jahren kamen 10 Tage zusammen, und der Frühling begann im Kalender nicht dann, wenn er wirklich anfing.\n\nUm alles wieder geradezurücken, strich man die überzähligen Tage einfach: In Italien, Spanien, Portugal und Polen folgte auf Donnerstag, den 4. Oktober, direkt Freitag, der 15. Andere Länder stellten später um — in Großbritannien verschwanden 1752 sogar 11 Tage. Nach diesem Kalender lebt heute fast die ganze Welt.',
            probe: 'Nach dem alten Kalender hatte ein Jahr 365 Tage und 6 Stunden, in Wirklichkeit sind es 365 Tage, 5 Stunden und 49 Minuten. Von 5:49 bis 6:00: 60 − 49 = ?',
            answer: '11. Nur 11 Minuten im Jahr — doch im Lauf der Jahrhunderte wurden daraus 10 Tage.'
        },
        {
            name: 'Das Schiff des Theseus',
            era: 'Plutarch, Parallelbiographien, um 100 n. Chr.',
            hook: 'Alle Planken wurden eine nach der anderen ersetzt. Ist es noch dasselbe Schiff?',
            body: 'Ein Schiff hat 150 Planken, jedes Jahr wird eine ausgetauscht. Nach 150 Jahren ist keine einzige Planke des alten Schiffs mehr übrig — und doch hätte in all den Jahren niemand gesagt, dass es ausgetauscht wurde.\n\nUnd wenn man aus den alten Planken ein zweites Schiff baut — welches der beiden ist das echte? Eine eindeutige Antwort gibt es nicht — darüber streiten die Menschen seit zweitausend Jahren.',
            probe: 'Von 150 Planken wurden 120 ersetzt. Wie viele alte sind noch übrig? 150 − 120 = ?',
            answer: '30. Und wenn man aus den 120 ausgebauten Planken ein zweites Schiff baut — welches der beiden ist das echte?'
        },
        {
            name: 'Ein Blatt Papier bis zum Mond',
            era: 'Britney Gallivan, Januar 2002',
            hook: 'Falte ein Blatt 42-mal in der Mitte — und der Stapel reicht bis zum Mond.',
            body: 'Jedes Mal, wenn man ein Blatt in der Mitte faltet, verdoppelt sich die Zahl der Lagen: 1, 2, 4, 8 … Probier es aus: Ein normales Blatt lässt sich nicht öfter als sieben- oder achtmal falten. Die Schülerin Britney Gallivan faltete 2002 einen langen Papierstreifen 12-mal und stellte damit einen Rekord auf.\n\nDas Geheimnis liegt darin, wie schnell Verdoppeln wächst. Ein Blatt ist dünner als ein Millimeter, doch nach 42 Faltungen hätte es mehr als vier Billionen Lagen — und so ein Stapel würde bis zum Mond reichen.',
            probe: 'Dreimal gefaltet. Wie viele Lagen? 2 × 2 × 2 = ?',
            answer: '8. Schau dir das Blatt auf dem Bild an: Die Falzlinien teilen es in genau 8 Teile.'
        },
        {
            name: 'Die Neunerreihe an den Fingern',
            era: 'Eine alte Art, mit den Fingern zu rechnen',
            hook: 'Die ganze Neunerreihe steckt in deinen Händen.',
            body: 'Leg deine Hände auf den Tisch und knick den Finger ein, dessen Nummer die Zahl ist, mit der du neun malnimmst. Die Finger links vom eingeknickten sind die Zehner, die rechts davon die Einer. Für 9 × 3 knickst du den dritten Finger ein: links 2, rechts 7 — das ergibt 27.\n\nDas Geheimnis: 9 × 3 ist 30 minus 3. Es gibt einen Zehner weniger als die Zahl, mit der man malnimmt, und so viele Einer, wie ihr bis zehn fehlen. Genau das zeigen die Finger.',
            probe: 'Knick den sechsten Finger ein und zähl die Finger links und rechts. 9 × 6 = ?',
            answer: '54. Links vom eingeknickten Finger sind 5, rechts sind 4.'
        },
        {
            name: 'Wie viele Wände haben Bienenwaben?',
            era: 'Varro, 1. Jh. v. Chr.; Pappos von Alexandria; Thomas Hales, 1999',
            hook: 'Eine Zelle hat 6 Wände. Sieben Zellen haben viel weniger als sieben mal sechs.',
            body: 'Bienen bauen ihre Waben aus Sechsecken, und benachbarte Zellen teilen sich eine Wand. Deshalb gibt es weniger Wände, als man denkt — und es wird weniger Wachs gebraucht.\n\nWarum Waben sechseckig sind, fragte man schon im alten Rom. Doch erst 1999 bewies der Mathematiker Thomas Hales, dass sechseckige Zellen am wenigsten Wachs brauchen.',
            probe: '7 Zellen: eine in der Mitte und sechs drumherum. Hätte jede ihre eigenen Wände, wären es 7 × 6 = ?',
            answer: '42. Aber 12 Wände sind gemeinsam — jede gehört zu zwei Zellen zugleich, also gibt es in Wirklichkeit 42 − 12 = 30 Wände.'
        },
        {
            name: 'Der Affe an der Schreibmaschine',
            era: 'Émile Borel, 1913',
            hook: 'Ein Affe, der wahllos auf die Tasten haut, tippt eines Tages den „Hamlet“.',
            body: 'Die Chance, dass zufällige Tastendrücke ein Wort ergeben, ist winzig, aber nicht null. Und was eine Chance größer als null hat, passiert ganz sicher, wenn man es unendlich lange versucht.\n\nNur dauert das Warten unvorstellbar lange: Jeder neue Buchstabe vervielfacht die Zahl der Versuche. Die Schreibmaschine auf dem Bild hat 10 Tasten, und ein Wort aus drei Buchstaben kommt darauf im Durchschnitt nach 10 × 10 × 10 = 1000 Versuchen heraus. Für eine einzige Zeile aus dem „Hamlet“ aber würde nicht einmal die ganze Zeit reichen, die es das Universum schon gibt.',
            probe: 'Eine echte Schreibmaschine hat etwa 30 Buchstaben. Ein Wort aus zwei Buchstaben kommt im Durchschnitt nach 30 × 30 = ? Versuchen',
            answer: '900. Und ein Wort aus drei Buchstaben braucht schon 27.000 Versuche.'
        },
        {
            name: 'Das Geburtstagsparadoxon',
            era: 'Richard von Mises, 1939',
            hook: 'In einer Gruppe von 23 Menschen ist ein gemeinsamer Geburtstag wahrscheinlicher als nicht.',
            body: 'Man könnte meinen, für einen gemeinsamen Geburtstag braucht man Hunderte von Menschen — das Jahr hat ja 365 Tage. Aber jedes Paar kann übereinstimmen, und es gibt viel mehr Paare als Menschen.\n\nJeder der 23 bildet mit jedem der anderen 22 ein Paar: 23 × 22 = 506, und jedes Paar ist doppelt gezählt — also gibt es 253 Paare. Das reicht schon, damit ein gemeinsamer Geburtstag wahrscheinlicher ist als keiner. Und in einer Klasse mit 30 Kindern passiert es ungefähr in sieben von zehn Fällen.',
            probe: 'In einer Klasse sind 30 Kinder. Jedes bildet mit jedem der anderen 29 ein Paar: 29 × 30 = ?',
            answer: '870. Jedes Paar wurde doppelt gezählt, also gibt es 435 Paare — kein Wunder, dass sich so oft ein gemeinsamer Geburtstag findet.'
        },
        {
            name: 'Ich teile, du wählst',
            era: 'UN-Seerechtsübereinkommen, 1982',
            hook: 'Wie teilt man einen Kuchen zu zweit, ohne dass es Streit gibt?',
            body: 'Eine Person schneidet den Kuchen, die andere sucht sich zuerst ein Stück aus. Wer schneidet, versucht, ihn genau zu halbieren — sonst bleibt das kleinere Stück für die schneidende Person übrig.\n\nSo teilt man nicht nur Kuchen. Nach dem Seerecht der Vereinten Nationen werden Gebiete auf dem Meeresboden genauso geteilt: Ein Unternehmen, das dort Rohstoffe abbauen will, teilt das gefundene Gebiet in zwei gleich wertvolle Teile, und die Internationale Meeresbodenbehörde wählt einen davon für sich.',
            probe: '10 Bonbons gerecht für zwei: 10 ÷ 2 = ?',
            answer: '5. Genau so liegen sie auf dem Bild: zwei Reihen mit je fünf Bonbons auf dem Teller.'
        },
        {
            name: 'Warum darf man nicht durch null teilen?',
            era: 'Bhaskara II, „Bijaganita“, um 1150',
            hook: 'Zwölf Bonbons für null Freunde — wie viele gibt es pro Kopf?',
            body: 'Eine Division prüft man mit der Multiplikation: 15 ÷ 3 = 5, weil 5 × 3 = 15. Versuchen wir 12 ÷ 0: Wir brauchen eine Zahl, die mal 0 genommen 12 ergibt. Aber jede Zahl mal 0 ergibt 0. So eine Zahl gibt es nicht — die Aufgabe hat einfach keine Lösung.\n\nDarüber hat man jahrhundertelang nachgedacht: Schon im 12. Jahrhundert nannte der indische Mathematiker Bhaskara so ein Ergebnis unendlich. Aber 0 ÷ 12 geht: null Bonbons für zwölf Freunde, für alle null.',
            probe: '12 Bonbons für vier Freunde: 12 ÷ 4 = ? Prüfe mit der Multiplikation: Antwort × 4 muss 12 ergeben.',
            answer: '3. 3 × 4 = 12: Jedes der vier Kinder hat drei Bonbons auf dem Teller. Und an die leere Bank kann man keine verteilen — dort sitzen null Freunde.'
        },
        {
            name: 'Das zwölfte Kamel',
            era: 'Ein altes Erbschaftsrätsel',
            hook: 'Ein weiser Mann lieh den Brüdern ein Kamel — und nahm es wieder mit.',
            body: 'Ein Vater hinterließ seinen drei Söhnen 11 Kamele: dem Ältesten die Hälfte, dem Mittleren ein Drittel, dem Jüngsten ein Zwölftel. Aber 11 lässt sich weder durch 2 noch durch 3 noch durch 12 teilen. Ein weiser Mann stellte sein eigenes Kamel dazu — nun waren es 12. Der Älteste bekam 6, der Mittlere 4, der Jüngste 1: zusammen 11. Der Weise stieg wieder auf sein Kamel und ritt davon.\n\nDas Geheimnis: Die Hälfte, ein Drittel und ein Zwölftel ergeben zusammen weniger als das Ganze — es fehlt genau ein Zwölftel. In der bekanntesten Fassung des Rätsels sind es 17 Kamele, und die Anteile sind die Hälfte, ein Drittel und ein Neuntel.',
            probe: 'Derselbe Trick mit 41 Kamelen: die Hälfte, ein Drittel und ein Siebtel. Leih dir eins — wie viele bekommt der Jüngste? 42 ÷ 7 = ?',
            answer: '6. Der Älteste bekommt 21, der Mittlere 14, der Jüngste 6: zusammen 41 — und das geliehene Kamel ist wieder übrig.'
        },
        {
            name: 'Achilles und die Schildkröte',
            era: 'Zenon von Elea, um 450 v. Chr.',
            hook: 'Der schnellste Läufer holt eine Schildkröte niemals ein. Oder doch?',
            body: 'Achilles läuft 5-mal so schnell wie die Schildkröte und gibt ihr 100 Meter Vorsprung. Bis er die Stelle erreicht, an der die Schildkröte war, ist sie schon ein Stück weitergekrochen. Bis er diese neue Stelle erreicht, ist sie wieder ein bisschen voraus. Und so weiter ohne Ende: Es scheint, als könnte er sie nie einholen.\n\nAber die Wegstücke werden immer kürzer: Jedes ist 5-mal kleiner als das vorige. Zusammen ergeben sie nicht unendlich viel, sondern genau 125 Meter. Dort holt Achilles die Schildkröte ein.',
            probe: 'Während Achilles die ersten 100 m läuft, kriecht die Schildkröte 5-mal weniger weit: 100 ÷ 5 = ?',
            answer: '20 Meter. Wie auf dem Bild: hinter Achilles fünf große Fußspuren, hinter der Schildkröte nur eine kleine.'
        },
        {
            name: 'Drei Türen',
            era: 'Steve Selvins Rätsel, 1975',
            hook: 'Drei Türen, hinter einer ein Preis. Die Wahl zu wechseln lohnt sich doppelt.',
            body: 'Du wählst eine von drei Türen. Der Moderator weiß, wo der Preis ist, und öffnet eine der beiden anderen — dahinter steht eine Ziege. Es scheint, als stünden die Chancen jetzt fünfzig zu fünfzig.\n\nAber deine Tür ist nur in einem von drei Fällen die richtige, und in zwei von drei Fällen ist der Preis hinter den anderen Türen — und der Moderator hat von ihnen gerade die leere aussortiert. Wer also oft spielt, sollte wechseln: So gewinnt man doppelt so oft.',
            probe: 'Du hast 45-mal gespielt und nie die Tür gewechselt. Wie viele Gewinne ungefähr? 45 ÷ 3 = ?',
            answer: '15. Ohne Wechsel gewinnt man etwa jedes dritte Spiel. Wer immer wechselt, kommt auf etwa 30 Gewinne — doppelt so viele.'
        }
    ]
};

// Новые карточки к новым картинкам пазлов, которые пока видит только репетитор: так новые
// картинки проверяются в игре до того, как их увидят ученики (см. PUZZLE_PREVIEW_SRCS
// и seesPuzzlePreview в index.html). Ключ — индекс парадокса, тот же, что у картинки
// в PUZZLE_PREVIEW_SRCS: карточка заменяет прежнюю на том же месте. Поля и правила
// формы те же, что выше. Когда новые картинки открываются всем, карточки переезжают в
// PARADOX_CONTENT на свои места, а этот объект пустеет.
//
// Сейчас пусто: 18 октября все двадцать новых карточек открылись всем и стоят выше.
// Языки оставлены, чтобы следующей партии было куда лечь.
window.PARADOX_PREVIEW = {
    ru: {},
    en: {},
    fr: {},
    de: {}
};
