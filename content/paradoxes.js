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
            name: 'Ахиллес и черепаха',
            era: 'Зенон Элейский, ~450 до н.э.',
            hook: 'Самый быстрый бегун никогда не догонит черепаху.',
            body: 'Ахиллес бежит в десять раз быстрее черепахи и даёт ей фору в 100 метров. Пробежал эти 100 — черепаха уже на 10 метров впереди. Пробежал 10 — она впереди на метр. И так без конца: догоняющему всегда остаётся кусочек.\n\nПодвох в словах «без конца». Шагов правда бесконечно много, но они всё короче: 100, 10, 1, 0,1… Сложи их все — выйдет 111,1 метра, а не бесконечность. Ровно на этом месте Ахиллес обгоняет черепаху и спокойно бежит дальше.',
            probe: 'Сколько получится, если складывать 100 + 10 + 1 + 0,1 + 0,01 и продолжать вечно?',
            answer: '111,111… то есть ровно 111 и 1/9. Бесконечное сложение может дать конечное число — если слагаемые убывают достаточно быстро.'
        },
        {
            name: 'Гранд-отель Гильберта',
            era: 'Давид Гильберт, 1924',
            hook: 'В отеле бесконечно много номеров, и все заняты. Мест — сколько угодно.',
            body: 'Приезжает гость, свободных номеров нет. Портье просит каждого жильца переехать в номер на единицу больше: из первого во второй, из второго в третий, и так далее. Все при номерах, а первый освободился.\n\nПриедет автобус на сто гостей — просим всех переехать на сто номеров вперёд. Приедет бесконечный автобус — просим переехать в номер вдвое больше своего, и освободятся все нечётные. У бесконечности «всё занято» и «есть места» уживаются спокойно, потому что она не заканчивается.',
            probe: 'Чего больше: всех чисел 1, 2, 3, 4, 5… или только чётных 2, 4, 6, 8…?',
            answer: 'Поровну. Каждому числу можно дать своё чётное: 1→2, 2→4, 3→6. Никто не остался без пары — значит, их одинаково много.'
        },
        {
            name: 'Парадокс Монти Холла',
            era: 'Телешоу, 1975',
            hook: 'Три двери, за одной приз. Поменять выбор — выгоднее ровно вдвое.',
            body: 'Ты выбираешь одну из трёх дверей — шанс угадать 1 из 3. Ведущий, который знает, где приз, открывает одну из двух оставшихся дверей, и там коза. Он всегда так делает. Менять выбор или нет?\n\nКажется, что дверей осталось две и шансы 50 на 50. Но твоя дверь как была одной из трёх, так и осталась: 1/3. А все остальные 2/3 никуда не делись — они целиком перешли на ту единственную дверь, которую ведущий не тронул. Менять надо всегда: выигрываешь вдвое чаще.',
            probe: 'А если дверей сто, выбрана одна, и ведущий открыл 98 дверей с козами?',
            answer: 'Меняй не раздумывая. У твоей двери шанс 1 из 100, у оставшейся — 99 из 100. С сотней дверей это чувствуется сразу.'
        },
        {
            name: 'Парадокс дней рождения',
            era: 'Рихард фон Мизес, 1939',
            hook: 'В компании из 23 человек шанс совпадения дней рождения — больше половины.',
            body: 'В году 365 дней, людей всего 23 — кажется, шанс должен быть крошечным. Но вопрос не в том, совпадёт ли чей-то день рождения с твоим. Вопрос в том, совпадёт ли он хоть у кого-то с кем-то.\n\nСчитать надо не людей, а пары. Из 23 человек пар получается 253 — и каждая пара это отдельная попытка совпасть. Отсюда и больше половины. В классе из 30 шанс уже около 70%, а в компании из 70 человек совпадение почти наверняка.',
            probe: 'Сколько пар можно составить из 23 человек?',
            answer: '253. Каждый из 23 может встать в пару с 22 другими, это 23 × 22 = 506, но каждая пара посчитана дважды — делим пополам.'
        },
        {
            name: 'Корабль Тесея',
            era: 'Плутарх, I век',
            hook: 'Заменили все доски по одной. Это тот же корабль или уже другой?',
            body: 'Корабль стоит в порту, доски понемногу гниют, их меняют — одну в год. Через сто лет в корабле нет ни одной исходной доски. Все эти годы никто не сказал бы, что корабль подменили. А теперь он весь другой.\n\nИ вдобавок: если все снятые доски сложили в сарае и собрали из них второй корабль — какой из двух настоящий? Строгого ответа нет, и в этом суть. «Тот же самый» — не свойство предмета, а наше соглашение о том, что считать одним и тем же.',
            probe: 'Ты — тот же человек, что пять лет назад? Почти все клетки твоего тела с тех пор сменились.',
            answer: 'Ответа нет и здесь — но заметь, что ты почему-то уверен в ответе. Вот эта уверенность и есть соглашение, о котором говорит парадокс.'
        },
        {
            name: 'Верёвка вокруг Земли',
            era: 'Уильям Уистон, 1702',
            hook: 'Верёвка обвязана вокруг всей планеты. Добавь метр — и под неё пролезет кошка.',
            body: 'Представь верёвку, натянутую по экватору вплотную к земле, — сорок тысяч километров. Теперь добавь к ней ровно один метр и приподними верёвку так, чтобы она отошла от земли везде одинаково. На сколько она поднимется? Кажется, что на неразличимую малость: метр на сорок тысяч километров — это же ничто.\n\nОна поднимется на шестнадцать сантиметров. По всей планете, от Африки до Тихого океана. Под неё свободно пролезет кошка. И самое неожиданное впереди: ответ не зависит от того, что обвязывать. Апельсин, Землю, Солнце — добавь метр, и зазор получится тот же самый.',
            probe: 'Почему у апельсина и у Земли выходит один и тот же зазор?',
            answer: 'Длина круга — это его радиус, умноженный на 6,28. Прибавили к длине метр — радиус вырос на метр, делённый на 6,28, то есть на 16 сантиметров. Размер самого круга в этот расчёт не входит вообще.'
        },
        {
            name: 'Бесконечная шоколадка',
            era: 'Уильям Хупер, 1774',
            hook: 'Отрезали дольку, съели — а шоколадка снова целая.',
            body: 'Шоколадку разрезают тремя разрезами на четыре куска и перекладывают их местами. Куски снова складываются в прямоугольник — и при этом одна долька оказывается лишней. Её съедают, а шоколадка на вид такая же, как была. Так можно продолжать сколько угодно.\n\nПодвох в том, что новый прямоугольник чуть-чуть не такой. Разрез идёт не точно по краям долек, и после перекладывания шоколадка становится на волосок ниже — ровно на съеденную дольку, размазанную по всей длине. Глаз такую разницу не ловит. Весы поймают сразу.',
            probe: 'Что будет с шоколадкой, если повторить фокус десять раз подряд?',
            answer: 'Она заметно похудеет. Каждый раз недостача размазывается по длине и становится невидимой, но никуда не девается и копится. После десяти долек разницу видно уже без всяких весов.'
        },
        {
            name: 'Парадокс брадобрея',
            era: 'Бертран Рассел, 1901',
            hook: 'Брадобрей бреет всех, кто не бреется сам. А себя?',
            body: 'В деревне один брадобрей, и правило простое: он бреет ровно тех, кто не бреется сам. Теперь спроси про него самого. Если он бреется сам — значит, брадобрей его брить не должен, а он и есть брадобрей. Если не бреется сам — значит, брадобрей обязан его побрить, то есть он должен побрить себя.\n\nОба ответа противоречат себе. Это народный пересказ парадокса Рассела: он показал, что нельзя как попало собирать «множество всех, кто…». Из-за этой находки математикам пришлось переписать самые основания своей науки.',
            probe: 'Как разрешить парадокс, не меняя правило?',
            answer: 'Признать, что такого брадобрея просто не бывает. Правило непротиворечиво ровно до тех пор, пока брадобрей не житель этой деревни.'
        },
        {
            name: 'Парадокс дедушки',
            era: 'Рене Баржавель, 1943',
            hook: 'Отправился в прошлое и помешал своему рождению. Кто тогда отправился?',
            body: 'Представь машину времени: сто лет назад, и случайная встреча дедушки с бабушкой не состоялась. Значит, твой родитель не родится. Значит, не родишься ты. Значит, некому построить машину и отправиться в прошлое. Значит, дедушка с бабушкой познакомились — и ты всё-таки родился.\n\nЭто не про машины, а про то, может ли время быть логически непротиворечивым. Выходов придумали три: в прошлое попасть нельзя вовсе; попасть можно, но помешать не выйдет — всё, что ты сделаешь, окажется частью уже случившейся истории; либо возникает отдельная ветка мира, где ты просто гость.',
            probe: 'В каком из трёх вариантов ты остаёшься собой и при этом ничего не ломаешь?',
            answer: 'Во втором. Там ты действуешь свободно, но всё сделанное уже вписано в историю — ты не меняешь прошлое, ты всегда был его частью.'
        },
        {
            name: 'Кот Шрёдингера',
            era: 'Эрвин Шрёдингер, 1935',
            hook: 'Кот в ящике жив и мёртв одновременно — пока не заглянешь.',
            body: 'В закрытом ящике кот, счётчик и ампула с ядом. Распадётся атом — счётчик щёлкнет, ампула разобьётся. А теперь главное: пока на атом никто не смотрит, он ведёт себя так, будто распался и не распался сразу. С мельчайшими частицами это правда так: пустишь одну частицу на две щели — она пройдёт через обе разом и сама с собой сложится, как две волны на воде, и след на экране это покажет. Выходит, и кот сразу живой и мёртвый.\n\nШрёдингер придумал это как насмешку: переносить странности мельчайших частиц на кота — значит зайти слишком далеко. Насмешка прижилась и стала главной картинкой квантовой физики. Кот, впрочем, всегда был против.',
            probe: 'Почему в жизни мы не видим предметов в двух состояниях сразу?',
            answer: 'Большой предмет всё время касается окружающего мира — воздуха, света, тепла. Каждое такое касание работает как взгляд, и выбор происходит мгновенно, ещё до того, как посмотрим мы. Спрятать кота от мира целиком невозможно.'
        },
        {
            name: 'Парадокс береговой линии',
            era: 'Льюис Ричардсон, 1951',
            hook: 'У береговой линии нет длины. Совсем.',
            body: 'Померь берег Британии линейкой длиной в километр — получишь одно число. Померь метровой — число вырастет: проявились изгибы, которые километровая линейка перешагивала. Померь сантиметровой — вырастет ещё, теперь считаются каждый камень и каждая трещина.\n\nЧисло не приближается ни к какому пределу, а растёт без конца. То есть у береговой линии нет длины — есть только длина при выбранной линейке. Из этого наблюдения выросли фракталы: фигуры, у которых частичка похожа на целое, а размерность получается дробной.',
            probe: 'А периметр футбольного поля тоже растёт, если мерить всё мельче?',
            answer: 'Нет. У прямой линии измерения быстро сходятся к одному числу. Растёт длина только у изрезанных линий, где мелкие изгибы повторяют крупные.'
        },
        {
            name: 'Парадокс Симпсона',
            era: 'Эдвард Симпсон, 1951',
            hook: 'Лекарство помогает мужчинам, помогает женщинам — и не помогает людям.',
            body: 'Новое лекарство дали десяти лёгким больным — выздоровели девять. Старое дали сотне лёгких — выздоровели восемьдесят. Новое лучше. Потом новое дали сотне тяжёлых — выздоровели пятьдесят; старое дали десяти тяжёлым — выздоровели четверо. Новое снова лучше.\n\nА теперь сложим всех вместе. Новое: 59 выздоровевших из 110. Старое: 84 из 110. Старое лучше — и ошибки в подсчётах нет. Просто новое лекарство почти всегда давали тяжёлым, а старое — лёгким. В общей сумме сравниваются уже не лекарства, а больные.',
            probe: 'Как надо было проверять, чтобы сравнение вышло честным?',
            answer: 'Давать оба лекарства поровну и лёгким, и тяжёлым. Тогда единственным отличием между группами останется само лекарство — а сейчас их отличает ещё и то, кто в них попал.'
        },
        {
            name: 'Парадокс кучи',
            era: 'Евбулид, IV век до н.э.',
            hook: 'Убери из кучи песчинку — куча останется. Повторяй. Где она кончилась?',
            body: 'Тысяча песчинок — это куча. Убери одну: 999 песчинок, всё ещё куча — одна песчинка ничего не решает. Убери ещё. И ещё. Рассуждение безупречно на каждом шаге, а в конце остаётся одна песчинка, и назвать её кучей нельзя.\n\nБезупречный шаг, повторённый много раз, привёл к неверному выводу. Значит, дело в самом слове: у «кучи» нет чёткой границы. Такие слова называют размытыми, и их вокруг полно — «высокий», «взрослый», «богатый». Логике с ними приходится обращаться осторожно.',
            probe: 'Сколько волос надо потерять, чтобы стать лысым?',
            answer: 'Числа не существует — и это не отговорка, а точный ответ. У размытых понятий нет границы, есть только середина, в которой все согласны.'
        },
        {
            name: 'Броня для самолётов',
            era: 'Абрахам Вальд, 1943',
            hook: 'Самолёты возвращались с пробоинами в крыльях. Броню поставили в другом месте.',
            body: 'На войне считали пробоины у вернувшихся самолётов. Больше всего их было в крыльях и хвосте, а возле моторов и кабины — почти не было. Решение напрашивалось само: укреплять крылья, туда ведь попадают чаще всего.\n\nВальд сказал наоборот: броню надо ставить туда, где пробоин нет. Считали-то только тех, кто вернулся. Попадание в крыло самолёт переживал — потому и прилетел с дырками. А те, кому попали в мотор, не вернулись и в подсчёт не попали вовсе. Пустые места на схеме означали не «сюда не попадают», а «отсюда не возвращаются».',
            probe: 'Тренер говорит: «Все мои чемпионы тренировались по шесть часов в день — значит, метод работает». Кого он забыл посчитать?',
            answer: 'Тех, кто тренировался по шесть часов и чемпионом не стал. Их никто не спросил: до интервью они не дошли. Считать только дошедших — это и есть смотреть на вернувшиеся самолёты.'
        },
        {
            name: 'Кубики по кругу',
            era: 'Брэдли Эфрон, 1970',
            hook: 'Синий бьёт жёлтый, жёлтый бьёт красный, красный бьёт синий.',
            body: 'Три игральных кубика с необычными числами на гранях. Бросаем два, выигрывает тот, у кого выпало больше. Синий выигрывает у жёлтого гораздо чаще, чем проигрывает. Жёлтый так же уверенно обыгрывает красный. Значит, синий должен обыгрывать красный и подавно — но красный бьёт синий.\n\nСамого сильного кубика просто нет. Мы привыкли: если Аня выше Бори, а Боря выше Веры, то Аня выше Веры. С ростом так и работает, потому что у каждого одно число. А у кубика чисел шесть, и «выигрывает чаще» зависит от того, какие грани встают против каких. По кругу это вполне может замкнуться.',
            probe: 'Тебе предлагают выбрать кубик первым. Это выгодно?',
            answer: 'Нет, это ловушка. На любой кубик найдётся тот, который его бьёт, и соперник возьмёт именно его. Здесь выгоднее выбирать вторым — редкий случай, когда право первого хода мешает.'
        },
        {
            name: 'Треугольник Пенроуза',
            era: 'Оскар Рутерсвард, 1934',
            hook: 'Фигура, безупречная в каждом углу и невозможная целиком.',
            body: 'Три бруска, соединённые в треугольник. Закрой ладонью любой угол — оставшееся выглядит совершенно нормально, так можно собрать из дерева. Убери ладонь — и фигура становится невозможной: бруски уходят и вперёд, и назад одновременно.\n\nГлаз собирает картинку по кусочкам и каждый кусочек считает правильным, а свести их в одно целое не может. Такие фигуры любил рисовать Эшер, а Пенроуз назвал их «невозможностью в чистейшем виде»: ошибки нет нигде, ошибка только в сумме.',
            probe: 'Можно ли построить такой треугольник из настоящих брусков?',
            answer: 'Можно — но только чтобы он выглядел правильно из одной-единственной точки. Стоит сдвинуться, и станет видно, что бруски не соединены.'
        },
        {
            name: 'Лента Мёбиуса',
            era: 'Мёбиус и Листинг, 1858',
            hook: 'У поверхности одна сторона и один край: муравей обойдёт всё, не переползая грань.',
            body: 'Возьми полоску бумаги, перекрути один конец на пол-оборота и склей в кольцо. Проведи по ней карандашом, не отрывая руки, — линия вернётся в начало, пройдя по «обеим» сторонам. Сторона у ленты одна.\n\nИ край один: веди пальцем по кромке, и палец обойдёт всю ленту и вернётся. А если разрезать ленту вдоль посередине, она не распадётся на две — получится одно длинное кольцо с двумя перекрутами. С этой полоски бумаги начинается целый раздел математики о том, как устроены поверхности.',
            probe: 'Что получится, если разрезать ленту Мёбиуса вдоль на расстоянии трети от края?',
            answer: 'Два сцепленных кольца разной длины: короткое — снова лента Мёбиуса, длинное — обычное перекрученное кольцо. Проще один раз проверить ножницами.'
        },
        {
            name: 'Теорема о бесконечных обезьянах',
            era: 'Эмиль Борель, 1913',
            hook: 'Обезьяна за печатной машинкой рано или поздно напечатает Шекспира.',
            body: 'Обезьяна бьёт по клавишам наугад. Шанс, что первые же буквы сложатся в строчку из «Гамлета», исчезающе мал — но он не равен нулю. А событие с ненулевым шансом, если пробовать бесконечно долго, случится обязательно. Значит, когда-нибудь будет напечатан весь «Гамлет».\n\nМатематика здесь безупречна, а вот жизнь — нет. Чтобы случайно набрать даже одну строку, потребуется времени больше, чем существует Вселенная. Теорема говорит не «это произойдёт», а «этому ничто не мешает» — и разница между этими фразами огромна.',
            probe: 'Сколько попыток нужно, чтобы случайно набрать слово «кот» на клавиатуре из 33 букв?',
            answer: 'В среднем 33 × 33 × 33 ≈ 36 тысяч. А в слове «Гамлет» уже шесть букв — и нулей в ответе становится вдвое больше.'
        },
        {
            name: 'Парадокс дружбы',
            era: 'Скотт Фелд, 1991',
            hook: 'У твоих друзей друзей больше, чем у тебя. Почти у каждого.',
            body: 'Возьми свой класс. Выпиши, у кого сколько друзей, а потом для каждого посчитай, сколько друзей в среднем у его друзей. Почти у всех второе число окажется больше первого. Дело не в тебе и не в них: так выходит почти в любой компании.\n\nПричина в том, кого мы вообще считаем. Общительный попадает в списки друзей ко многим, и когда ты перебираешь своих друзей, он встречается тебе снова и снова. Замкнутый попадёт в два списка и почти никому не встретится. Получается, ты сравниваешь себя не с обычным человеком, а с тем, кого чаще встречают.',
            probe: 'Почему в спортзале почти все кажутся спортивнее тебя?',
            answer: 'Потому что те, кто ходит каждый день, попадаются тебе на глаза каждый раз, а те, кто ходит раз в месяц, — почти никогда. Зал набит теми, кто ходит много, хотя среди всех записавшихся таких меньшинство.'
        },
        {
            name: 'Парадокс лжеца',
            era: 'Евбулид, IV век до н.э.',
            hook: '«Это утверждение ложно». Ну и как оно вам?',
            body: 'Всего три слова. Если утверждение истинно, то оно, как само и говорит, ложно. Если ложно — значит, сказанное в нём верно, и оно истинно. Ни один из двух ответов не выдерживает проверки.\n\nПодвох в том, что фраза говорит о самой себе. Такие самоссылки — не забава: именно на них Гёдель построил доказательство того, что в любой достаточно богатой математике найдутся верные утверждения, которые нельзя доказать. Три слова про лжеца оказались краем возможностей логики.',
            probe: 'А что не так с фразой «Это утверждение истинно»?',
            answer: 'Противоречия нет, но и толку тоже: истинной её считать можно, ложной — тоже, и ничто не помогает выбрать. Самоссылка ломает не только истину, но и саму возможность решить.'
        }
    ],
    en: [
        {
            name: 'Achilles and the Tortoise',
            era: 'Zeno of Elea, ~450 BC',
            hook: 'The fastest runner alive will never catch a tortoise.',
            body: 'Achilles runs ten times faster than the tortoise and gives it a 100-metre head start. He covers those 100 metres — the tortoise is already 10 metres ahead. He covers the 10 — it is a metre ahead. And so on without end: the chaser always has a little gap left.\n\nThe trick is in the words "without end". There really are infinitely many steps, but they keep shrinking: 100, 10, 1, 0.1… Add them all up and you get 111.1 metres, not infinity. That is exactly where Achilles passes the tortoise and calmly runs on.',
            probe: 'What do you get if you add 100 + 10 + 1 + 0.1 + 0.01 and keep going forever?',
            answer: '111.111… — exactly 111 and 1/9. An endless sum can land on a finite number, as long as the pieces shrink fast enough.'
        },
        {
            name: 'Hilbert\'s Grand Hotel',
            era: 'David Hilbert, 1924',
            hook: 'A hotel with infinitely many rooms, all occupied. There is room for anyone.',
            body: 'A guest arrives and there are no free rooms. The clerk asks every resident to move one room up: room 1 into room 2, room 2 into room 3, and so on. Everybody still has a room, and room 1 is now empty.\n\nA bus with a hundred guests? Ask everyone to move a hundred rooms up. An infinite bus? Ask everyone to move into double their room number, and every odd room falls free. In infinity, "completely full" and "plenty of space" get along just fine, because it never ends.',
            probe: 'Which is there more of: all the numbers 1, 2, 3, 4, 5… or only the even ones 2, 4, 6, 8…?',
            answer: 'Exactly the same amount. Give each number its own even one: 1→2, 2→4, 3→6. Nobody is left without a partner, so there are just as many.'
        },
        {
            name: 'The Monty Hall Problem',
            era: 'TV game show, 1975',
            hook: 'Three doors, one prize. Switching doubles your chances.',
            body: 'You pick one of three doors — a 1 in 3 chance of being right. The host, who knows where the prize is, opens one of the other two doors and shows a goat. He always does this. Do you switch or stay?\n\nIt looks as though two doors are left and the odds are 50-50. But your door is still one out of three: 1/3. And the other 2/3 did not vanish — they moved wholesale onto the single door the host left alone. Always switch: you win twice as often.',
            probe: 'What if there were a hundred doors, you picked one, and the host opened 98 of them with goats behind?',
            answer: 'Switch without thinking twice. Your door had a 1 in 100 chance; the one left standing has 99 in 100. With a hundred doors you feel it immediately.'
        },
        {
            name: 'The Birthday Paradox',
            era: 'Richard von Mises, 1939',
            hook: 'In a group of 23 people the odds of a shared birthday are better than even.',
            body: 'There are 365 days in a year and only 23 people, so the chance ought to be tiny. But the question is not whether somebody shares a birthday with you. It is whether anybody shares one with anybody.\n\nSo count pairs, not people. Twenty-three people make 253 pairs, and every pair is its own chance to match. That is where "better than even" comes from. In a class of 30 it is already about 70%, and in a group of 70 a match is all but certain.',
            probe: 'How many pairs can you make out of 23 people?',
            answer: '253. Each of the 23 can pair with 22 others, which is 23 × 22 = 506, but every pair got counted twice — so halve it.'
        },
        {
            name: 'The Ship of Theseus',
            era: 'Plutarch, 1st century',
            hook: 'Every plank was replaced, one at a time. Same ship, or a different one?',
            body: 'A ship sits in the harbour. Its planks slowly rot and get replaced — one per year. After a century not a single original plank is left. On no single day would anyone have said the ship had been swapped. And yet now all of it is different.\n\nWorse: if the old planks were stacked in a shed and built into a second ship, which one is the real one? There is no strict answer, and that is the point. "The same one" is not a property of the object — it is our agreement about what counts as the same.',
            probe: 'Are you the same person you were five years ago? Almost every cell in your body has been replaced since.',
            answer: 'There is no answer here either — but notice that you feel certain anyway. That certainty is exactly the agreement the paradox is talking about.'
        },
        {
            name: 'The rope around the Earth',
            era: 'William Whiston, 1702',
            hook: 'A rope is tied around the whole planet. Add one metre and a cat fits underneath.',
            body: 'Picture a rope stretched around the equator, lying flat on the ground — forty thousand kilometres of it. Now add exactly one metre and lift the rope so that it stands the same height above the ground everywhere. How high does it rise? It feels as if it must be nothing at all: one metre against forty thousand kilometres.\n\nIt rises by sixteen centimetres. All the way round, from Africa to the Pacific. A cat squeezes under it easily. And the strangest part is still ahead: the answer does not depend on what you tie the rope around. An orange, the Earth, the Sun — add a metre and the gap comes out the same.',
            probe: 'Why do an orange and the Earth give exactly the same gap?',
            answer: 'The length of a circle is its radius multiplied by 6.28. Add a metre to the length and the radius grows by one metre divided by 6.28 — that is sixteen centimetres. The size of the circle never enters the sum at all.'
        },
        {
            name: 'The endless chocolate bar',
            era: 'William Hooper, 1774',
            hook: 'A square was cut off and eaten — and the bar is whole again.',
            body: 'A chocolate bar is cut three times into four pieces, and the pieces are swapped around. They fit back together into a rectangle — and one square is left over. You eat it, and the bar looks exactly as it did. You can keep going as long as you like.\n\nThe catch is that the new rectangle is not quite the same. The cut does not run exactly along the edges of the squares, and after the swap the bar is a hair shorter — shorter by exactly the square you ate, spread out along its whole length. The eye cannot catch a difference like that. Scales catch it at once.',
            probe: 'What happens to the bar if you repeat the trick ten times in a row?',
            answer: 'It gets noticeably thinner. Each time the loss is spread along the length and becomes invisible, but it does not go anywhere and it adds up. After ten squares you can see the difference without any scales.'
        },
        {
            name: 'The Barber Paradox',
            era: 'Bertrand Russell, 1901',
            hook: 'The barber shaves everyone who does not shave himself. What about him?',
            body: 'One village, one barber, one simple rule: he shaves exactly those people who do not shave themselves. Now ask about the barber. If he shaves himself, then by the rule the barber must not shave him — but he is the barber. If he does not shave himself, then the barber has to shave him — meaning he must shave himself.\n\nBoth answers contradict themselves. This is the folk version of Russell\'s paradox, which showed that you cannot casually gather up "the set of everything that…". Because of it, mathematicians had to rewrite the very foundations of their subject.',
            probe: 'How can you resolve the paradox without changing the rule?',
            answer: 'Admit that such a barber simply does not exist. The rule is perfectly consistent as long as the barber is not one of the villagers.'
        },
        {
            name: 'The Grandfather Paradox',
            era: 'René Barjavel, 1943',
            hook: 'You go back in time and prevent your own birth. Then who went back?',
            body: 'You build a time machine, travel a hundred years back and accidentally keep your grandparents from ever meeting. So your parent is never born. So you are never born. So there is nobody to build the machine and travel back. So your grandparents did meet after all — and you were born.\n\nThis is not about machines; it is about whether time can be logically consistent. Three ways out have been proposed: you cannot reach the past at all; you can, but you cannot change anything — whatever you do turns out to have always been part of history; or a separate branch of the world appears, where you are simply a visitor.',
            probe: 'In which of the three do you stay yourself and still break nothing?',
            answer: 'The second. There you act freely, but everything you do is already written into history — you do not change the past, you were always part of it.'
        },
        {
            name: 'Schrödinger’s cat',
            era: 'Erwin Schrödinger, 1935',
            hook: 'The cat in the box is alive and dead at once — until you look.',
            body: 'Inside a closed box there is a cat, a counter and a vial of poison. If an atom decays, the counter clicks and the vial breaks. And here is the point: as long as nobody looks at the atom, it behaves as though it had both decayed and not decayed at once. With the smallest particles this really is so: send one particle at two slits and it goes through both at once and adds up with itself, like two waves on water, and the trace on the screen shows it. So the cat comes out alive and dead at once.\n\nSchrödinger meant it as mockery: carrying the oddities of the tiniest particles over to a cat goes too far. The mockery caught on and became the main picture of quantum physics. The cat, for its part, was always against it.',
            probe: 'Why do we never see everyday things in two states at once?',
            answer: 'A large object is touching the world around it all the time — air, light, warmth. Every one of those touches works like a look, and the choice happens instantly, long before we get there. There is no way to hide a cat from the world completely.'
        },
        {
            name: 'The Coastline Paradox',
            era: 'Lewis Richardson, 1951',
            hook: 'A coastline has no length. None at all.',
            body: 'Measure the coast of Britain with a ruler a kilometre long and you get one number. Measure with a one-metre ruler and the number grows: the bends the long ruler stepped over now count. Measure with a centimetre ruler and it grows again — now every rock and crack is included.\n\nThe number does not settle down anywhere; it keeps climbing. So a coastline has no length — it only has a length for a chosen ruler. Fractals grew out of this observation: shapes where a small piece looks like the whole, and the dimension comes out fractional.',
            probe: 'Does the perimeter of a football pitch also grow if you measure it more and more finely?',
            answer: 'No. For straight lines the measurements quickly settle on one number. Length keeps growing only for ragged lines, where the small bends repeat the big ones.'
        },
        {
            name: 'Simpson’s paradox',
            era: 'Edward Simpson, 1951',
            hook: 'The medicine helps men, it helps women — and it does not help people.',
            body: 'The new medicine was given to ten mild cases: nine recovered. The old one was given to a hundred mild cases: eighty recovered. The new one is better. Then the new one went to a hundred severe cases: fifty recovered; the old one went to ten severe cases and four recovered. The new one is better again.\n\nNow add everyone up. New medicine: 59 recovered out of 110. Old medicine: 84 out of 110. The old one wins — and there is no mistake in the arithmetic. The new medicine simply went to the severe cases almost every time, and the old one to the mild ones. In the grand total you are no longer comparing medicines, you are comparing patients.',
            probe: 'How should the test have been run for the comparison to be fair?',
            answer: 'Give both medicines to equal numbers of mild and severe cases. Then the only difference between the groups is the medicine itself — while right now they also differ in who ended up in them.'
        },
        {
            name: 'The Sorites Paradox',
            era: 'Eubulides, 4th century BC',
            hook: 'Take one grain from a heap and it is still a heap. Repeat. Where did it stop?',
            body: 'A thousand grains of sand is a heap. Remove one: 999 grains, still a heap — a single grain decides nothing. Remove another. And another. Every step is flawless, and at the end one grain is left, which nobody would call a heap.\n\nA flawless step, repeated often enough, led to a wrong conclusion. So the trouble is in the word itself: "heap" has no sharp edge. Words like that are called vague, and they are everywhere — "tall", "grown-up", "rich". Logic has to handle them with care.',
            probe: 'How many hairs do you have to lose to be bald?',
            answer: 'There is no such number — and that is not a dodge, it is the exact answer. Vague words have no boundary, only a middle everyone agrees on.'
        },
        {
            name: 'Armour for the bombers',
            era: 'Abraham Wald, 1943',
            hook: 'The planes came home with holes in the wings. The armour went somewhere else.',
            body: 'During the war they counted the bullet holes on the planes that came back. Most of them were in the wings and the tail; around the engines and the cockpit there were almost none. The answer looked obvious: armour the wings, that is where they get hit.\n\nWald said the opposite: put the armour where there are no holes. They had only counted the planes that returned. A hit in the wing was something a plane could survive — that is why it landed full of holes. The ones hit in the engine never came back and were never counted at all. The empty spots on the diagram did not mean «nobody gets hit here», they meant «nobody comes back from here».',
            probe: 'A coach says: «Every one of my champions trained six hours a day, so the method works.» Who did he forget to count?',
            answer: 'Everyone who trained six hours a day and never became a champion. Nobody asked them — they never made it to the interview. Counting only those who arrived is exactly the same as looking at the planes that came home.'
        },
        {
            name: 'Dice that beat each other in a circle',
            era: 'Bradley Efron, 1970',
            hook: 'Blue beats yellow, yellow beats red, red beats blue.',
            body: 'Three dice with unusual numbers on their faces. Roll two of them and the higher number wins. Blue beats yellow far more often than it loses. Yellow beats red just as confidently. So blue ought to beat red by an even wider margin — and this is where it all breaks: red beats blue.\n\nThere is simply no strongest die. We are used to this: if Anna is taller than Boris and Boris is taller than Vera, then Anna is taller than Vera. Height works that way because everyone has one number. A die has six, and which one wins more often depends on how the faces line up against each other. That can close into a circle.',
            probe: 'You are offered the first pick of a die. Is that a good deal?',
            answer: 'No, it is a trap. For every die there is another one that beats it, and your opponent will pick that one. Here it pays to choose second — a rare case where going first gets in your way.'
        },
        {
            name: 'The Penrose Triangle',
            era: 'Oscar Reutersvärd, 1934',
            hook: 'A shape that is flawless at every corner and impossible as a whole.',
            body: 'Three beams joined into a triangle. Cover any corner with your hand and what is left looks perfectly ordinary — you could build it out of wood. Take your hand away and the shape becomes impossible: the beams run away from you and towards you at the same time.\n\nYour eye assembles the picture piece by piece and finds every piece correct, but it cannot put them together into a whole. Escher loved drawing such figures, and Penrose called them "impossibility in its purest form": nothing is wrong anywhere, the mistake exists only in the sum.',
            probe: 'Could you build such a triangle out of real beams?',
            answer: 'You could — but only so that it looks right from one single spot. Step aside and you will see that the beams are not joined at all.'
        },
        {
            name: 'The Möbius Strip',
            era: 'Möbius and Listing, 1858',
            hook: 'One surface with one side and one edge: an ant crosses all of it without going over a rim.',
            body: 'Take a strip of paper, give one end a half-twist and glue it into a loop. Draw a line along it without lifting your pencil — the line comes back to the start having covered "both" sides. The strip has only one side.\n\nAnd only one edge: run a finger along the rim and it travels the whole strip and returns. And if you cut the strip lengthways down the middle it does not fall into two — you get one long loop with two twists. A whole branch of mathematics about how surfaces work starts with this scrap of paper.',
            probe: 'What do you get if you cut a Möbius strip lengthways a third of the way from the edge?',
            answer: 'Two linked loops of different lengths: the short one is another Möbius strip, the long one is an ordinary twisted loop. Easier to check once with scissors.'
        },
        {
            name: 'The Infinite Monkey Theorem',
            era: 'Émile Borel, 1913',
            hook: 'A monkey at a typewriter will sooner or later type out Shakespeare.',
            body: 'The monkey hits keys at random. The chance that the very first letters spell a line of Hamlet is vanishingly small — but it is not zero. And an event with a non-zero chance, given infinitely many tries, is bound to happen. So one day the whole of Hamlet gets typed.\n\nThe mathematics is flawless; life is not. Typing even a single line by chance would take longer than the universe has existed. The theorem does not say "this will happen" — it says "nothing stands in the way", and the difference between those two sentences is enormous.',
            probe: 'How many tries does it take to type the word "cat" at random on a 26-letter keyboard?',
            answer: 'About 26 × 26 × 26 ≈ 17,600 on average. "Hamlet" already has six letters — and the answer gains twice as many zeros.'
        },
        {
            name: 'The friendship paradox',
            era: 'Scott Feld, 1991',
            hook: 'Your friends have more friends than you do. Almost everyone does.',
            body: 'Take your class. Write down how many friends each person has, and then work out, for each one, the average number of friends their friends have. For almost everyone the second number comes out larger. It is not about you and not about them: it happens in almost any group.\n\nThe reason is who gets counted. A sociable person turns up on many friend lists, so when you go through your own friends you meet them again and again. A quiet person is on two lists and hardly ever turns up. So you are not comparing yourself with an ordinary person — you are comparing yourself with the one people meet most often.',
            probe: 'Why does almost everyone at the gym look fitter than you?',
            answer: 'Because the people who come every day are in front of you every single time, and the ones who come once a month almost never are. The gym is full of people who train a lot, even though among everyone who signed up they are the minority.'
        },
        {
            name: 'The Liar Paradox',
            era: 'Eubulides, 4th century BC',
            hook: '"This statement is false." Well then?',
            body: 'Four words. If the statement is true, then — just as it says — it is false. If it is false, then what it says is right, so it is true. Neither answer survives.\n\nThe catch is that the sentence talks about itself. Such self-reference is no joke: it is exactly what Gödel built his proof on, showing that in any sufficiently rich mathematics there are true statements that cannot be proved. Four words about a liar turned out to mark the edge of what logic can do.',
            probe: 'And what is wrong with the sentence "This statement is true"?',
            answer: 'Nothing contradicts — but nothing helps either: you may call it true, you may call it false, and nothing lets you decide. Self-reference breaks not only truth but the very possibility of settling it.'
        }
    ],
    fr: [
        {
            name: 'Achille et la tortue',
            era: 'Zénon d’Élée, vers 450 av. J.-C.',
            hook: 'Le coureur le plus rapide ne rattrapera jamais une tortue.',
            body: 'Achille court dix fois plus vite que la tortue et lui laisse 100 mètres d’avance. Il parcourt ces 100 mètres — la tortue est déjà 10 mètres devant. Il parcourt les 10 — elle est devant d’un mètre. Et ainsi sans fin : il reste toujours un petit écart.\n\nLe piège est dans les mots « sans fin ». Les étapes sont bel et bien infiniment nombreuses, mais elles rétrécissent : 100, 10, 1, 0,1… Additionne-les toutes et tu obtiens 111,1 mètres, pas l’infini. C’est exactement là qu’Achille double la tortue et continue tranquillement sa route.',
            probe: 'Combien fait 100 + 10 + 1 + 0,1 + 0,01 si l’on continue éternellement ?',
            answer: '111,111… c’est-à-dire exactement 111 et 1/9. Une somme infinie peut tomber sur un nombre fini, à condition que les termes rétrécissent assez vite.'
        },
        {
            name: 'L’hôtel infini de Hilbert',
            era: 'David Hilbert, 1924',
            hook: 'Un hôtel avec une infinité de chambres, toutes occupées. Il y a de la place pour tout le monde.',
            body: 'Un client arrive, aucune chambre n’est libre. Le réceptionniste demande à chacun de se décaler d’une chambre : le 1 va au 2, le 2 va au 3, et ainsi de suite. Tout le monde a encore une chambre, et la première est libre.\n\nUn car de cent voyageurs ? On décale tout le monde de cent chambres. Un car infini ? On demande à chacun d’aller dans la chambre au numéro doublé, et toutes les chambres impaires se libèrent. Dans l’infini, « complet » et « il reste de la place » cohabitent très bien, parce que cela ne s’arrête jamais.',
            probe: 'Y a-t-il plus de nombres 1, 2, 3, 4, 5… ou seulement de nombres pairs 2, 4, 6, 8… ?',
            answer: 'Exactement autant. Donne à chaque nombre son pair : 1→2, 2→4, 3→6. Personne ne reste sans partenaire, donc il y en a autant.'
        },
        {
            name: 'Le problème de Monty Hall',
            era: 'Jeu télévisé, 1975',
            hook: 'Trois portes, un prix. Changer de porte double tes chances.',
            body: 'Tu choisis une porte parmi trois — une chance sur trois de tomber juste. L’animateur, qui sait où est le prix, ouvre l’une des deux autres portes et montre une chèvre. Il le fait toujours. Tu changes ou tu gardes ?\n\nOn croit qu’il reste deux portes et que c’est du 50-50. Mais ta porte est restée une porte sur trois : 1/3. Et les 2/3 restants ne se sont pas évaporés — ils sont passés en bloc sur l’unique porte que l’animateur n’a pas touchée. Change toujours : tu gagnes deux fois plus souvent.',
            probe: 'Et s’il y avait cent portes, que tu en choisisses une et que l’animateur en ouvre 98 avec des chèvres ?',
            answer: 'Change sans hésiter. Ta porte avait une chance sur cent, celle qui reste en a 99 sur 100. Avec cent portes, cela se sent tout de suite.'
        },
        {
            name: 'Le paradoxe des anniversaires',
            era: 'Richard von Mises, 1939',
            hook: 'Dans un groupe de 23 personnes, il y a plus d’une chance sur deux que deux anniversaires coïncident.',
            body: 'Il y a 365 jours dans l’année et seulement 23 personnes : la chance devrait être minuscule. Mais la question n’est pas de savoir si quelqu’un est né le même jour que toi. Elle est de savoir si deux personnes, n’importe lesquelles, partagent une date.\n\nIl faut donc compter les paires, pas les gens. Vingt-trois personnes forment 253 paires, et chaque paire est une occasion de coïncider. D’où le « plus d’une chance sur deux ». Dans une classe de 30, on est déjà autour de 70 %, et dans un groupe de 70 la coïncidence est quasi certaine.',
            probe: 'Combien de paires peut-on former avec 23 personnes ?',
            answer: '253. Chacun des 23 peut former une paire avec 22 autres, soit 23 × 22 = 506, mais chaque paire a été comptée deux fois — on divise par deux.'
        },
        {
            name: 'Le bateau de Thésée',
            era: 'Plutarque, Ier siècle',
            hook: 'On a remplacé toutes les planches, une par une. Est-ce le même bateau ?',
            body: 'Un bateau est à quai. Ses planches pourrissent peu à peu et on les remplace — une par an. Au bout d’un siècle, il ne reste plus une seule planche d’origine. Aucun jour précis n’a pourtant donné l’impression qu’on avait changé de bateau. Et pourtant tout est différent.\n\nPire : si l’on a gardé les vieilles planches dans un hangar et qu’on en a construit un second bateau, lequel est le vrai ? Il n’y a pas de réponse stricte, et c’est tout le propos. « Le même » n’est pas une propriété de l’objet : c’est notre accord sur ce qu’on décide d’appeler identique.',
            probe: 'Es-tu la même personne qu’il y a cinq ans ? Presque toutes tes cellules ont été remplacées depuis.',
            answer: 'Là non plus il n’y a pas de réponse — mais remarque que tu te sens sûr de toi malgré tout. Cette certitude est précisément l’accord dont parle le paradoxe.'
        },
        {
            name: 'La corde autour de la Terre',
            era: 'William Whiston, 1702',
            hook: 'Une corde fait le tour de la planète. Ajoute un mètre et un chat passe dessous.',
            body: 'Imagine une corde tendue le long de l’équateur, posée à même le sol — quarante mille kilomètres. Ajoute maintenant exactement un mètre et soulève la corde pour qu’elle s’écarte du sol partout de la même hauteur. De combien monte-t-elle ? On dirait que ce doit être imperceptible : un mètre contre quarante mille kilomètres, ce n’est rien.\n\nElle monte de seize centimètres. Sur toute la planète, de l’Afrique au Pacifique. Un chat se faufile dessous sans peine. Et le plus étonnant reste à venir : la réponse ne dépend pas de ce qu’on entoure. Une orange, la Terre, le Soleil — ajoute un mètre et l’écart est le même.',
            probe: 'Pourquoi une orange et la Terre donnent-elles exactement le même écart ?',
            answer: 'La longueur d’un cercle, c’est son rayon multiplié par 6,28. On ajoute un mètre à la longueur, et le rayon grandit d’un mètre divisé par 6,28 — soit seize centimètres. La taille du cercle n’entre jamais dans ce calcul.'
        },
        {
            name: 'La tablette de chocolat sans fin',
            era: 'William Hooper, 1774',
            hook: 'On a coupé un carré, on l’a mangé — et la tablette est de nouveau entière.',
            body: 'On coupe une tablette de chocolat en quatre morceaux par trois traits, puis on échange les morceaux de place. Ils se remettent en rectangle — et il reste un carré en trop. On le mange, et la tablette a l’air exactement pareille. On peut recommencer autant qu’on veut.\n\nLe piège, c’est que le nouveau rectangle n’est pas tout à fait le même. La coupe ne suit pas exactement le bord des carrés, et après l’échange la tablette est plus basse d’un cheveu — d’exactement le carré mangé, étalé sur toute la longueur. L’œil ne voit pas une différence pareille. La balance la voit tout de suite.',
            probe: 'Que devient la tablette si on répète le tour dix fois de suite ?',
            answer: 'Elle maigrit nettement. Chaque fois le manque s’étale sur la longueur et devient invisible, mais il ne disparaît pas et il s’accumule. Après dix carrés, la différence se voit sans balance.'
        },
        {
            name: 'Le paradoxe du barbier',
            era: 'Bertrand Russell, 1901',
            hook: 'Le barbier rase tous ceux qui ne se rasent pas eux-mêmes. Et lui ?',
            body: 'Un village, un barbier, une règle simple : il rase exactement les gens qui ne se rasent pas eux-mêmes. Pose maintenant la question pour lui. S’il se rase lui-même, alors le barbier ne doit pas le raser — or c’est lui, le barbier. S’il ne se rase pas lui-même, alors le barbier doit le raser — donc il doit se raser lui-même.\n\nLes deux réponses se contredisent. C’est la version populaire du paradoxe de Russell, qui a montré qu’on ne peut pas rassembler n’importe comment « l’ensemble de tout ce qui… ». À cause de lui, les mathématiciens ont dû réécrire les fondements mêmes de leur discipline.',
            probe: 'Comment résoudre le paradoxe sans changer la règle ?',
            answer: 'En admettant qu’un tel barbier n’existe tout simplement pas. La règle reste cohérente tant que le barbier n’habite pas le village.'
        },
        {
            name: 'Le paradoxe du grand-père',
            era: 'René Barjavel, 1943',
            hook: 'Tu pars dans le passé et empêches ta propre naissance. Qui est parti, alors ?',
            body: 'Tu construis une machine à remonter le temps, tu recules de cent ans et tu empêches par mégarde tes grands-parents de se rencontrer. Donc ton parent ne naît pas. Donc tu ne nais pas. Donc personne ne construit la machine et ne part dans le passé. Donc tes grands-parents se sont bien rencontrés — et tu es né.\n\nCe n’est pas une histoire de machines, mais de cohérence logique du temps. On a proposé trois issues : on ne peut pas atteindre le passé ; on le peut, mais rien ne peut être changé — tout ce que tu fais faisait déjà partie de l’histoire ; ou bien une branche séparée du monde apparaît, où tu n’es qu’un visiteur.',
            probe: 'Dans laquelle des trois issues restes-tu toi-même sans rien casser ?',
            answer: 'La deuxième. Tu y agis librement, mais tout ce que tu fais est déjà inscrit dans l’histoire — tu ne changes pas le passé, tu en as toujours fait partie.'
        },
        {
            name: 'Le chat de Schrödinger',
            era: 'Erwin Schrödinger, 1935',
            hook: 'Le chat dans la boîte est vivant et mort à la fois — tant qu’on ne regarde pas.',
            body: 'Dans une boîte fermée : un chat, un compteur et une ampoule de poison. Si un atome se désintègre, le compteur claque et l’ampoule se brise. Or tant que personne ne regarde l’atome, il se comporte comme s’il s’était désintégré et pas désintégré à la fois. Avec les particules minuscules c’est vraiment le cas : lance-en une sur deux fentes, elle passe par les deux et s’additionne avec elle-même comme deux vagues, et la trace sur l’écran le montre. Le chat est donc vivant et mort à la fois.\n\nSchrödinger avait imaginé ça par moquerie : transporter ces bizarreries sur un chat, c’est aller trop loin. La moquerie a pris et est devenue l’image principale de la physique quantique. Le chat, lui, a toujours été contre.',
            probe: 'Pourquoi ne voit-on jamais les objets de tous les jours dans deux états à la fois ?',
            answer: 'Un grand objet touche le monde autour de lui en permanence — l’air, la lumière, la chaleur. Chacun de ces contacts agit comme un regard, et le choix se fait instantanément, bien avant nous. Impossible de cacher complètement un chat au monde.'
        },
        {
            name: 'Le paradoxe du littoral',
            era: 'Lewis Richardson, 1951',
            hook: 'Un littoral n’a pas de longueur. Pas du tout.',
            body: 'Mesure la côte britannique avec une règle d’un kilomètre : tu obtiens un nombre. Avec une règle d’un mètre : le nombre grandit, car les courbes que la grande règle enjambait comptent désormais. Avec une règle d’un centimètre : il grandit encore, chaque rocher et chaque fissure entrent dans le compte.\n\nLe nombre ne se stabilise jamais, il grimpe sans fin. Un littoral n’a donc pas de longueur : il n’a qu’une longueur pour une règle donnée. De cette observation sont nées les fractales, ces figures dont un petit morceau ressemble au tout et dont la dimension est fractionnaire.',
            probe: 'Le périmètre d’un terrain de football grandit-il aussi si on le mesure de plus en plus finement ?',
            answer: 'Non. Pour des lignes droites, les mesures convergent vite vers un seul nombre. La longueur ne grandit sans fin que pour les lignes déchiquetées, où les petites courbes répètent les grandes.'
        },
        {
            name: 'Le paradoxe de Simpson',
            era: 'Edward Simpson, 1951',
            hook: 'Le médicament aide les hommes, il aide les femmes — et il n’aide pas les gens.',
            body: 'On a donné le nouveau médicament à dix malades légers : neuf ont guéri. L’ancien à cent malades légers : quatre-vingts ont guéri. Le nouveau est meilleur. Puis le nouveau à cent malades graves : cinquante ont guéri ; l’ancien à dix malades graves, quatre ont guéri. Le nouveau est encore meilleur.\n\nMaintenant additionnons tout le monde. Nouveau : 59 guéris sur 110. Ancien : 84 sur 110. L’ancien gagne — et il n’y a aucune erreur de calcul. C’est simplement que le nouveau est allé presque toujours aux malades graves, et l’ancien aux malades légers. Dans le total, on ne compare plus des médicaments, on compare des malades.',
            probe: 'Comment fallait-il mener l’essai pour que la comparaison soit honnête ?',
            answer: 'Donner les deux médicaments à autant de malades légers que de malades graves. Alors la seule différence entre les groupes serait le médicament lui-même — alors qu’aujourd’hui ils diffèrent aussi par qui s’y trouve.'
        },
        {
            name: 'Le paradoxe du tas',
            era: 'Eubulide, IVe siècle av. J.-C.',
            hook: 'Enlève un grain d’un tas, cela reste un tas. Recommence. Où s’est-il arrêté ?',
            body: 'Mille grains de sable, c’est un tas. Enlèves-en un : 999 grains, toujours un tas — un seul grain ne décide de rien. Enlèves-en encore un. Et encore. Chaque étape est irréprochable, et à la fin il reste un grain, qu’on ne peut pas appeler un tas.\n\nUne étape irréprochable, répétée assez souvent, a mené à une conclusion fausse. Le problème est donc dans le mot lui-même : « tas » n’a pas de frontière nette. On appelle ces mots des mots vagues, et il y en a partout — « grand », « adulte », « riche ». La logique doit les manier avec précaution.',
            probe: 'Combien de cheveux faut-il perdre pour être chauve ?',
            answer: 'Ce nombre n’existe pas — et ce n’est pas une esquive, c’est la réponse exacte. Les mots vagues n’ont pas de frontière, seulement un milieu sur lequel tout le monde s’accorde.'
        },
        {
            name: 'Le blindage des bombardiers',
            era: 'Abraham Wald, 1943',
            hook: 'Les avions rentraient troués aux ailes. Le blindage est allé ailleurs.',
            body: 'Pendant la guerre, on comptait les impacts sur les avions rentrés. Il y en avait surtout dans les ailes et la queue ; autour des moteurs et de la cabine, presque aucun. La solution semblait évidente : blinder les ailes, c’est là qu’on est touché.\n\nWald a dit l’inverse : il faut blinder là où il n’y a pas d’impacts. On ne comptait que les avions revenus. Un coup dans l’aile, un avion y survit — c’est pour ça qu’il s’est posé troué. Ceux qui prenaient un coup dans le moteur ne rentraient pas et n’étaient comptés nulle part. Les zones vides du schéma ne voulaient pas dire « on n’est pas touché ici », mais « d’ici on ne revient pas ».',
            probe: 'Un entraîneur dit : « Tous mes champions s’entraînaient six heures par jour, donc la méthode marche. » Qui a-t-il oublié de compter ?',
            answer: 'Tous ceux qui se sont entraînés six heures par jour sans devenir champions. Personne ne les a interrogés : ils ne sont pas arrivés jusqu’à l’interview. Ne compter que ceux qui sont arrivés, c’est exactement regarder les avions rentrés.'
        },
        {
            name: 'Les dés qui se battent en rond',
            era: 'Bradley Efron, 1970',
            hook: 'Le bleu bat le jaune, le jaune bat le rouge, le rouge bat le bleu.',
            body: 'Trois dés avec des nombres inhabituels sur les faces. On en lance deux, le plus grand nombre gagne. Le bleu bat le jaune bien plus souvent qu’il ne perd. Le jaune bat le rouge tout aussi sûrement. Donc le bleu devrait écraser le rouge — et c’est là que tout casse : le rouge bat le bleu.\n\nIl n’y a tout simplement pas de dé le plus fort. On a l’habitude : si Anna est plus grande que Boris et Boris plus grand que Vera, alors Anna est plus grande que Vera. Avec la taille ça marche parce que chacun n’a qu’un seul nombre. Un dé en a six, et « gagne plus souvent » dépend de la façon dont les faces se retrouvent l’une en face de l’autre. Ça peut très bien boucler.',
            probe: 'On te propose de choisir ton dé en premier. C’est avantageux ?',
            answer: 'Non, c’est un piège. Pour chaque dé il en existe un qui le bat, et l’adversaire prendra celui-là. Ici il vaut mieux choisir en second — un cas rare où le droit de jouer en premier dérange.'
        },
        {
            name: 'Le triangle de Penrose',
            era: 'Oscar Reutersvärd, 1934',
            hook: 'Une figure irréprochable à chaque coin et impossible dans son ensemble.',
            body: 'Trois poutres assemblées en triangle. Cache un coin avec la main : ce qui reste paraît tout à fait normal, on pourrait le construire en bois. Retire la main et la figure devient impossible : les poutres s’éloignent et se rapprochent en même temps.\n\nL’œil assemble l’image morceau par morceau et trouve chaque morceau correct, mais il n’arrive pas à les réunir en un tout. Escher adorait dessiner ces figures, et Penrose les appelait « l’impossibilité à l’état pur » : il n’y a d’erreur nulle part, l’erreur n’est que dans la somme.',
            probe: 'Peut-on construire un tel triangle avec de vraies poutres ?',
            answer: 'Oui — mais seulement pour qu’il paraisse correct depuis un unique point de vue. Déplace-toi d’un pas et tu verras que les poutres ne se touchent pas.'
        },
        {
            name: 'Le ruban de Möbius',
            era: 'Möbius et Listing, 1858',
            hook: 'Une surface avec une seule face et un seul bord : une fourmi la parcourt tout entière sans franchir d’arête.',
            body: 'Prends une bande de papier, fais faire un demi-tour à une extrémité et colle le tout en anneau. Trace un trait dessus sans lever le crayon : le trait revient à son point de départ après avoir couvert « les deux » faces. Le ruban n’a qu’une face.\n\nEt qu’un seul bord : suis la tranche avec le doigt, il fera tout le tour et reviendra. Et si tu coupes le ruban en deux dans le sens de la longueur, il ne se sépare pas — tu obtiens un seul long anneau avec deux torsions. Tout un pan des mathématiques sur la forme des surfaces commence avec ce bout de papier.',
            probe: 'Que se passe-t-il si tu coupes un ruban de Möbius dans la longueur, au tiers du bord ?',
            answer: 'Deux anneaux entrelacés de longueurs différentes : le court est encore un ruban de Möbius, le long est un anneau torsadé ordinaire. Plus simple à vérifier une fois avec des ciseaux.'
        },
        {
            name: 'Le théorème du singe savant',
            era: 'Émile Borel, 1913',
            hook: 'Un singe devant une machine à écrire finira par taper Shakespeare.',
            body: 'Le singe frappe les touches au hasard. La chance que les premières lettres forment une réplique de Hamlet est infime — mais elle n’est pas nulle. Or un événement de chance non nulle, si l’on essaie une infinité de fois, finit forcément par arriver. Un jour, tout Hamlet sera donc tapé.\n\nLes mathématiques sont irréprochables ; la vie, non. Taper au hasard ne serait-ce qu’une seule réplique demanderait plus de temps que l’âge de l’Univers. Le théorème ne dit pas « cela arrivera », il dit « rien ne s’y oppose » — et l’écart entre ces deux phrases est immense.',
            probe: 'Combien d’essais faut-il pour taper au hasard le mot « chat » sur un clavier de 26 lettres ?',
            answer: 'Environ 26 × 26 × 26 × 26 ≈ 457 000 en moyenne. « Hamlet » a six lettres — et la réponse gagne encore des zéros.'
        },
        {
            name: 'Le paradoxe de l’amitié',
            era: 'Scott Feld, 1991',
            hook: 'Tes amis ont plus d’amis que toi. Presque tout le monde est dans ce cas.',
            body: 'Prends ta classe. Note combien d’amis a chacun, puis calcule pour chacun combien d’amis ont ses amis en moyenne. Chez presque tout le monde le second nombre sera plus grand. Ce n’est ni ta faute ni la leur : ça sort comme ça dans presque n’importe quel groupe.\n\nLa raison, c’est qui on compte. Une personne sociable figure sur beaucoup de listes d’amis, alors quand tu passes tes amis en revue, elle revient encore et encore. Une personne discrète figure sur deux listes et n’apparaît presque jamais. Tu ne te compares donc pas à quelqu’un d’ordinaire, mais à celui qu’on croise le plus souvent.',
            probe: 'Pourquoi presque tout le monde a-t-il l’air plus sportif que toi à la salle ?',
            answer: 'Parce que ceux qui viennent tous les jours sont devant toi à chaque fois, et ceux qui viennent une fois par mois presque jamais. La salle est pleine de gens qui s’entraînent beaucoup, alors que parmi tous les inscrits ils sont une minorité.'
        },
        {
            name: 'Le paradoxe du menteur',
            era: 'Eubulide, IVe siècle av. J.-C.',
            hook: '« Cette phrase est fausse. » Alors, qu’en dis-tu ?',
            body: 'Quatre mots. Si la phrase est vraie, alors — comme elle le dit elle-même — elle est fausse. Si elle est fausse, alors ce qu’elle affirme est juste, donc elle est vraie. Aucune des deux réponses ne tient.\n\nLe piège est que la phrase parle d’elle-même. Ces autoréférences ne sont pas un jeu : c’est exactement là-dessus que Gödel a bâti sa démonstration, montrant que dans toute mathématique assez riche il existe des énoncés vrais qu’on ne peut pas démontrer. Quatre mots sur un menteur marquent la limite de ce que la logique peut faire.',
            probe: 'Et qu’est-ce qui cloche avec la phrase « Cette phrase est vraie » ?',
            answer: 'Rien ne se contredit — mais rien n’aide non plus : on peut la dire vraie, on peut la dire fausse, et rien ne permet de trancher. L’autoréférence casse non seulement la vérité, mais la possibilité même de décider.'
        }
    ],
    de: [
        {
            name: 'Achilles und die Schildkröte',
            era: 'Zenon von Elea, ~450 v. Chr.',
            hook: 'Der schnellste Läufer der Welt holt eine Schildkröte nie ein.',
            body: 'Achilles läuft zehnmal schneller als die Schildkröte und gibt ihr 100 Meter Vorsprung. Er legt diese 100 Meter zurück — die Schildkröte ist schon 10 Meter voraus. Er legt die 10 zurück — sie ist einen Meter voraus. Und so ohne Ende: dem Verfolger bleibt immer ein Stückchen.\n\nDer Haken steckt in „ohne Ende“. Es sind tatsächlich unendlich viele Schritte, aber sie werden immer kürzer: 100, 10, 1, 0,1… Zähl sie alle zusammen und du bekommst 111,1 Meter, nicht unendlich. Genau dort überholt Achilles die Schildkröte und läuft in Ruhe weiter.',
            probe: 'Was kommt heraus, wenn man 100 + 10 + 1 + 0,1 + 0,01 rechnet und ewig weitermacht?',
            answer: '111,111… also genau 111 und 1/9. Eine unendliche Summe kann bei einer endlichen Zahl landen — wenn die Summanden schnell genug kleiner werden.'
        },
        {
            name: 'Hilberts Hotel',
            era: 'David Hilbert, 1924',
            hook: 'Ein Hotel mit unendlich vielen Zimmern, alle belegt. Platz ist für jeden.',
            body: 'Ein Gast kommt an, kein Zimmer ist frei. Der Portier bittet jeden Bewohner, ein Zimmer weiterzuziehen: von 1 nach 2, von 2 nach 3 und so fort. Alle haben weiterhin ein Zimmer, und Zimmer 1 ist frei.\n\nEin Bus mit hundert Gästen? Alle ziehen hundert Zimmer weiter. Ein unendlicher Bus? Jeder zieht in das Zimmer mit der doppelten Nummer, und alle ungeraden werden frei. In der Unendlichkeit vertragen sich „alles belegt“ und „Platz genug“ bestens, denn sie hört nie auf.',
            probe: 'Wovon gibt es mehr: von allen Zahlen 1, 2, 3, 4, 5… oder nur von den geraden 2, 4, 6, 8…?',
            answer: 'Genau gleich viele. Gib jeder Zahl ihre gerade: 1→2, 2→4, 3→6. Niemand bleibt ohne Partner, also sind es gleich viele.'
        },
        {
            name: 'Das Monty-Hall-Problem',
            era: 'Fernsehshow, 1975',
            hook: 'Drei Türen, ein Preis. Wechseln verdoppelt die Chance.',
            body: 'Du wählst eine von drei Türen — eine Chance von 1 zu 3. Der Moderator, der weiß, wo der Preis steht, öffnet eine der beiden anderen Türen und zeigt eine Ziege. Das macht er immer. Wechselst du oder bleibst du?\n\nEs sieht aus, als blieben zwei Türen und es stünde 50 zu 50. Aber deine Tür ist eine von dreien geblieben: 1/3. Und die übrigen 2/3 sind nicht verschwunden — sie sind komplett auf die eine Tür gewandert, die der Moderator nicht angerührt hat. Wechsle immer: du gewinnst doppelt so oft.',
            probe: 'Und wenn es hundert Türen gäbe, du eine wählst und der Moderator 98 mit Ziegen öffnet?',
            answer: 'Wechsle ohne nachzudenken. Deine Tür hatte 1 von 100, die übrig gebliebene hat 99 von 100. Bei hundert Türen spürt man es sofort.'
        },
        {
            name: 'Das Geburtstagsparadoxon',
            era: 'Richard von Mises, 1939',
            hook: 'In einer Gruppe von 23 Menschen ist ein gemeinsamer Geburtstag wahrscheinlicher als nicht.',
            body: 'Das Jahr hat 365 Tage und die Gruppe nur 23 Menschen — die Chance müsste winzig sein. Aber die Frage ist nicht, ob jemand am selben Tag Geburtstag hat wie du. Sie lautet, ob irgendwer mit irgendwem zusammenfällt.\n\nAlso zähl Paare, nicht Personen. 23 Menschen ergeben 253 Paare, und jedes Paar ist ein eigener Versuch zu treffen. Daher „wahrscheinlicher als nicht“. In einer Klasse von 30 sind es schon rund 70 %, und in einer Gruppe von 70 ist ein Treffer so gut wie sicher.',
            probe: 'Wie viele Paare lassen sich aus 23 Menschen bilden?',
            answer: '253. Jeder der 23 kann mit 22 anderen ein Paar bilden, das sind 23 × 22 = 506 — aber jedes Paar wurde doppelt gezählt, also halbieren.'
        },
        {
            name: 'Das Schiff des Theseus',
            era: 'Plutarch, 1. Jahrhundert',
            hook: 'Alle Planken wurden nacheinander ersetzt. Dasselbe Schiff oder schon ein anderes?',
            body: 'Ein Schiff liegt im Hafen. Seine Planken verrotten langsam und werden ersetzt — eine pro Jahr. Nach hundert Jahren ist keine einzige ursprüngliche Planke mehr da. An keinem einzelnen Tag hätte jemand gesagt, das Schiff sei ausgetauscht worden. Und doch ist jetzt alles anders.\n\nUnd schlimmer: wenn die alten Planken im Schuppen lagen und daraus ein zweites Schiff gebaut wurde — welches ist das echte? Eine strenge Antwort gibt es nicht, und genau darum geht es. „Dasselbe“ ist keine Eigenschaft des Dings, sondern unsere Übereinkunft darüber, was als dasselbe gilt.',
            probe: 'Bist du derselbe Mensch wie vor fünf Jahren? Fast alle Zellen deines Körpers sind seitdem ausgetauscht.',
            answer: 'Auch hier gibt es keine Antwort — aber achte darauf, dass du dir trotzdem sicher bist. Diese Sicherheit ist genau die Übereinkunft, von der das Paradoxon spricht.'
        },
        {
            name: 'Das Seil um die Erde',
            era: 'William Whiston, 1702',
            hook: 'Ein Seil liegt um die ganze Erde. Gib einen Meter dazu, und eine Katze passt darunter.',
            body: 'Stell dir ein Seil vor, das entlang des Äquators gespannt ist und überall auf dem Boden aufliegt — vierzigtausend Kilometer. Jetzt kommt genau ein Meter dazu, und das Seil wird so angehoben, dass es überall gleich weit über dem Boden schwebt. Wie hoch steigt es? Es fühlt sich an, als müsste es fast nichts sein: ein Meter gegen vierzigtausend Kilometer.\n\nEs steigt um sechzehn Zentimeter. Rund um die ganze Erde, von Afrika bis zum Pazifik. Eine Katze schlüpft mühelos darunter durch. Und das Seltsamste kommt noch: die Antwort hängt gar nicht davon ab, worum man das Seil legt. Eine Orange, die Erde, die Sonne — gib einen Meter dazu, und der Abstand ist derselbe.',
            probe: 'Warum ergeben eine Orange und die Erde genau denselben Abstand?',
            answer: 'Der Umfang eines Kreises ist sein Radius mal 6,28. Kommt ein Meter zum Umfang dazu, wächst der Radius um einen Meter geteilt durch 6,28 — das sind sechzehn Zentimeter. Die Größe des Kreises kommt in dieser Rechnung überhaupt nicht vor.'
        },
        {
            name: 'Die unendliche Tafel Schokolade',
            era: 'William Hooper, 1774',
            hook: 'Ein Stück abgeschnitten, aufgegessen — und die Tafel ist wieder ganz.',
            body: 'Eine Tafel Schokolade wird mit drei Schnitten in vier Teile zerlegt, und die Teile werden getauscht. Sie fügen sich wieder zu einem Rechteck — und ein Stück bleibt übrig. Man isst es, und die Tafel sieht genauso aus wie vorher. So lässt sich beliebig weitermachen.\n\nDer Haken ist, dass das neue Rechteck nicht ganz dasselbe ist. Der Schnitt läuft nicht genau an den Kanten der Stücke entlang, und nach dem Tausch ist die Tafel um ein Haar niedriger — genau um das gegessene Stück, verteilt über die ganze Länge. So einen Unterschied sieht das Auge nicht. Die Waage sieht ihn sofort.',
            probe: 'Was wird aus der Tafel, wenn man den Trick zehnmal hintereinander wiederholt?',
            answer: 'Sie wird deutlich dünner. Jedes Mal verteilt sich der Verlust über die Länge und wird unsichtbar, aber er verschwindet nicht und summiert sich. Nach zehn Stücken sieht man den Unterschied auch ohne Waage.'
        },
        {
            name: 'Das Barbier-Paradoxon',
            era: 'Bertrand Russell, 1901',
            hook: 'Der Barbier rasiert alle, die sich nicht selbst rasieren. Und sich selbst?',
            body: 'Ein Dorf, ein Barbier, eine einfache Regel: er rasiert genau die Leute, die sich nicht selbst rasieren. Frag nun nach ihm selbst. Rasiert er sich selbst, dann darf der Barbier ihn nicht rasieren — aber er ist der Barbier. Rasiert er sich nicht selbst, dann muss der Barbier ihn rasieren — also muss er sich selbst rasieren.\n\nBeide Antworten widersprechen sich. Das ist die volkstümliche Fassung von Russells Paradoxon, das zeigte: man kann nicht einfach „die Menge aller Dinge, die…“ zusammenfassen. Wegen dieses Fundes mussten Mathematiker die Grundlagen ihres Fachs neu schreiben.',
            probe: 'Wie löst man das Paradoxon auf, ohne die Regel zu ändern?',
            answer: 'Indem man zugibt, dass es einen solchen Barbier gar nicht gibt. Die Regel bleibt widerspruchsfrei, solange der Barbier kein Bewohner dieses Dorfes ist.'
        },
        {
            name: 'Das Großvaterparadoxon',
            era: 'René Barjavel, 1943',
            hook: 'Du reist in die Vergangenheit und verhinderst deine eigene Geburt. Wer ist dann gereist?',
            body: 'Du baust eine Zeitmaschine, reist hundert Jahre zurück und verhinderst versehentlich, dass sich deine Großeltern kennenlernen. Also wird dein Elternteil nie geboren. Also wirst du nie geboren. Also baut niemand die Maschine und reist zurück. Also haben sich deine Großeltern doch kennengelernt — und du wurdest geboren.\n\nEs geht nicht um Maschinen, sondern darum, ob Zeit logisch widerspruchsfrei sein kann. Drei Auswege wurden vorgeschlagen: man kommt gar nicht in die Vergangenheit; man kommt hin, kann aber nichts ändern — alles, was du tust, war schon immer Teil der Geschichte; oder es entsteht ein eigener Zweig der Welt, in dem du nur zu Gast bist.',
            probe: 'In welchem der drei bleibst du du selbst und zerstörst trotzdem nichts?',
            answer: 'Im zweiten. Dort handelst du frei, aber alles Getane steht bereits in der Geschichte — du änderst die Vergangenheit nicht, du warst immer ein Teil von ihr.'
        },
        {
            name: 'Schrödingers Katze',
            era: 'Erwin Schrödinger, 1935',
            hook: 'Die Katze in der Kiste ist lebendig und tot zugleich — solange niemand hineinsieht.',
            body: 'In einer geschlossenen Kiste sitzen eine Katze, ein Zählrohr und eine Ampulle mit Gift. Zerfällt ein Atom, klickt das Zählrohr und die Ampulle zerbricht. Solange aber niemand das Atom ansieht, verhält es sich, als wäre es zerfallen und nicht zerfallen zugleich. Bei winzigen Teilchen ist das wirklich so: schickt man eines auf zwei Spalte, geht es durch beide und überlagert sich mit sich selbst wie zwei Wellen — die Spur auf dem Schirm zeigt es. Also ist auch die Katze lebendig und tot zugleich.\n\nSchrödinger meinte es als Spott: das auf eine Katze zu übertragen, geht zu weit. Der Spott setzte sich durch und wurde zum Hauptbild der Quantenphysik. Die Katze war allerdings immer dagegen.',
            probe: 'Warum sehen wir Alltagsdinge nie in zwei Zuständen auf einmal?',
            answer: 'Ein großer Gegenstand berührt die Welt um sich herum ununterbrochen — Luft, Licht, Wärme. Jede dieser Berührungen wirkt wie ein Blick, und die Entscheidung fällt sofort, lange bevor wir hinsehen. Eine Katze völlig vor der Welt zu verbergen, geht nicht.'
        },
        {
            name: 'Das Küstenlinienparadoxon',
            era: 'Lewis Richardson, 1951',
            hook: 'Eine Küstenlinie hat keine Länge. Überhaupt keine.',
            body: 'Miss die Küste Britanniens mit einem Lineal von einem Kilometer: du bekommst eine Zahl. Miss mit einem Meterlineal: die Zahl wächst, denn nun zählen die Buchten, die das große Lineal übersprungen hat. Miss mit einem Zentimeterlineal: sie wächst weiter, jetzt zählen jeder Stein und jeder Riss.\n\nDie Zahl nähert sich keinem Grenzwert, sie wächst ohne Ende. Eine Küstenlinie hat also keine Länge — sie hat nur eine Länge zum gewählten Lineal. Aus dieser Beobachtung sind die Fraktale entstanden: Figuren, bei denen ein kleines Stück dem Ganzen gleicht und die Dimension gebrochen ausfällt.',
            probe: 'Wächst der Umfang eines Fußballfeldes auch, wenn man immer feiner misst?',
            answer: 'Nein. Bei geraden Linien nähern sich die Messungen rasch einer Zahl. Ohne Ende wächst nur die Länge zerklüfteter Linien, bei denen die kleinen Bögen die großen wiederholen.'
        },
        {
            name: 'Das Simpson-Paradoxon',
            era: 'Edward Simpson, 1951',
            hook: 'Das Medikament hilft Männern, es hilft Frauen — und es hilft Menschen nicht.',
            body: 'Das neue Medikament bekamen zehn leichte Fälle: neun wurden gesund. Das alte bekamen hundert leichte Fälle: achtzig wurden gesund. Das neue ist besser. Dann bekamen hundert schwere Fälle das neue: fünfzig wurden gesund; das alte ging an zehn schwere Fälle, vier wurden gesund. Das neue ist wieder besser.\n\nJetzt zählen wir alle zusammen. Neu: 59 Genesene von 110. Alt: 84 von 110. Das alte gewinnt — und in der Rechnung steckt kein Fehler. Das neue Medikament ging nämlich fast immer an die schweren Fälle und das alte an die leichten. In der Gesamtsumme vergleicht man keine Medikamente mehr, sondern Kranke.',
            probe: 'Wie hätte man prüfen müssen, damit der Vergleich ehrlich ist?',
            answer: 'Beide Medikamente an gleich viele leichte und schwere Fälle geben. Dann wäre der einzige Unterschied zwischen den Gruppen das Medikament selbst — jetzt unterscheiden sie sich auch darin, wer hineingeraten ist.'
        },
        {
            name: 'Das Sorites-Paradoxon',
            era: 'Eubulides, 4. Jh. v. Chr.',
            hook: 'Nimm ein Korn vom Haufen — es bleibt ein Haufen. Wiederhole. Wo hörte er auf?',
            body: 'Tausend Sandkörner sind ein Haufen. Nimm eins weg: 999 Körner, immer noch ein Haufen — ein einzelnes Korn entscheidet nichts. Nimm noch eins. Und noch eins. Jeder Schritt ist einwandfrei, und am Ende bleibt ein Korn, das niemand einen Haufen nennen würde.\n\nEin einwandfreier Schritt, oft genug wiederholt, führte zu einem falschen Schluss. Das Problem liegt also im Wort selbst: „Haufen“ hat keine scharfe Grenze. Solche Wörter nennt man vage, und sie sind überall — „groß“, „erwachsen“, „reich“. Die Logik muss vorsichtig mit ihnen umgehen.',
            probe: 'Wie viele Haare muss man verlieren, um kahl zu sein?',
            answer: 'Diese Zahl gibt es nicht — und das ist keine Ausrede, sondern die genaue Antwort. Vage Wörter haben keine Grenze, nur eine Mitte, über die sich alle einig sind.'
        },
        {
            name: 'Panzerung für die Bomber',
            era: 'Abraham Wald, 1943',
            hook: 'Die Flugzeuge kamen mit Löchern in den Flügeln zurück. Die Panzerung kam woandershin.',
            body: 'Im Krieg zählte man die Einschüsse an den zurückgekehrten Flugzeugen. Die meisten saßen in den Flügeln und im Leitwerk; um die Motoren und die Kanzel herum fast keine. Die Lösung schien auf der Hand zu liegen: die Flügel panzern, dort wird ja am häufigsten getroffen.\n\nWald sagte das Gegenteil: panzern muss man dort, wo keine Löcher sind. Gezählt wurden nur die Flugzeuge, die zurückkamen. Einen Treffer im Flügel überstand eine Maschine — deshalb landete sie voller Löcher. Wer einen Treffer im Motor abbekam, kam nicht zurück und tauchte in keiner Zählung auf. Die leeren Stellen auf der Skizze hießen nicht «hier wird nicht getroffen», sondern «von hier kommt keiner zurück».',
            probe: 'Ein Trainer sagt: «Alle meine Champions haben sechs Stunden am Tag trainiert, also funktioniert die Methode.» Wen hat er zu zählen vergessen?',
            answer: 'Alle, die sechs Stunden am Tag trainiert haben und keine Champions geworden sind. Die hat niemand gefragt — sie sind nie beim Interview angekommen. Nur die Angekommenen zu zählen heißt genau, auf die zurückgekehrten Flugzeuge zu schauen.'
        },
        {
            name: 'Würfel, die sich im Kreis schlagen',
            era: 'Bradley Efron, 1970',
            hook: 'Blau schlägt Gelb, Gelb schlägt Rot, Rot schlägt Blau.',
            body: 'Drei Würfel mit ungewöhnlichen Zahlen auf den Seiten. Man wirft zwei davon, die größere Zahl gewinnt. Blau gewinnt gegen Gelb viel öfter, als es verliert. Gelb schlägt Rot genauso sicher. Also müsste Blau Rot erst recht schlagen — und genau hier bricht alles zusammen: Rot schlägt Blau.\n\nEinen stärksten Würfel gibt es schlicht nicht. Wir sind es gewohnt: Ist Anna größer als Boris und Boris größer als Vera, dann ist Anna größer als Vera. Bei der Größe klappt das, weil jeder nur eine Zahl hat. Ein Würfel hat sechs, und «gewinnt öfter» hängt davon ab, welche Seiten einander gegenüberstehen. Das kann sich durchaus im Kreis schließen.',
            probe: 'Du darfst deinen Würfel zuerst wählen. Ist das ein Vorteil?',
            answer: 'Nein, das ist eine Falle. Zu jedem Würfel gibt es einen, der ihn schlägt, und den nimmt der Gegner. Hier lohnt es sich, als Zweiter zu wählen — ein seltener Fall, in dem das erste Zugrecht stört.'
        },
        {
            name: 'Das Penrose-Dreieck',
            era: 'Oscar Reutersvärd, 1934',
            hook: 'Eine Figur, an jeder Ecke einwandfrei und als Ganzes unmöglich.',
            body: 'Drei Balken, zu einem Dreieck verbunden. Deck eine Ecke mit der Hand ab — der Rest sieht völlig normal aus, man könnte ihn aus Holz bauen. Nimm die Hand weg, und die Figur wird unmöglich: die Balken laufen zugleich nach vorn und nach hinten.\n\nDas Auge setzt das Bild Stück für Stück zusammen und hält jedes Stück für richtig, kann sie aber nicht zu einem Ganzen fügen. Escher zeichnete solche Figuren mit Vorliebe, und Penrose nannte sie „Unmöglichkeit in reinster Form“: nirgends steckt ein Fehler, der Fehler liegt nur in der Summe.',
            probe: 'Kann man ein solches Dreieck aus echten Balken bauen?',
            answer: 'Man kann — aber nur so, dass es von einem einzigen Punkt aus richtig aussieht. Geh einen Schritt zur Seite und du siehst, dass die Balken gar nicht verbunden sind.'
        },
        {
            name: 'Das Möbiusband',
            era: 'Möbius und Listing, 1858',
            hook: 'Eine Fläche mit einer Seite und einer Kante: eine Ameise läuft alles ab, ohne über den Rand zu klettern.',
            body: 'Nimm einen Papierstreifen, verdrehe ein Ende um eine halbe Drehung und klebe ihn zum Ring. Zieh einen Strich, ohne den Stift abzusetzen — der Strich kehrt zum Anfang zurück und ist dabei über „beide“ Seiten gelaufen. Das Band hat nur eine Seite.\n\nUnd nur eine Kante: fahr mit dem Finger am Rand entlang, er umrundet das ganze Band und kommt zurück. Und schneidest du das Band der Länge nach in der Mitte durch, zerfällt es nicht in zwei — es entsteht ein langer Ring mit zwei Verdrehungen. Mit diesem Stück Papier beginnt ein ganzer Zweig der Mathematik über den Bau von Flächen.',
            probe: 'Was entsteht, wenn du ein Möbiusband der Länge nach im Abstand eines Drittels vom Rand aufschneidest?',
            answer: 'Zwei ineinanderhängende Ringe verschiedener Länge: der kurze ist wieder ein Möbiusband, der lange ein gewöhnlicher verdrehter Ring. Einfacher, es einmal mit der Schere zu prüfen.'
        },
        {
            name: 'Das Infinite-Monkey-Theorem',
            era: 'Émile Borel, 1913',
            hook: 'Ein Affe an der Schreibmaschine tippt früher oder später Shakespeare.',
            body: 'Der Affe haut zufällig auf die Tasten. Die Chance, dass die allerersten Buchstaben eine Zeile aus Hamlet ergeben, ist verschwindend klein — aber sie ist nicht null. Und ein Ereignis mit einer Chance über null tritt bei unendlich vielen Versuchen zwangsläufig ein. Irgendwann wird also ganz Hamlet getippt.\n\nDie Mathematik ist einwandfrei, das Leben nicht. Schon eine einzige Zeile zufällig zu tippen würde länger dauern, als das Universum existiert. Das Theorem sagt nicht „das wird passieren“, sondern „nichts steht dem entgegen“ — und zwischen diesen Sätzen liegt ein Abgrund.',
            probe: 'Wie viele Versuche braucht man, um auf einer Tastatur mit 26 Buchstaben zufällig das Wort „Katze“ zu tippen?',
            answer: 'Im Mittel etwa 26 hoch 5, also rund 12 Millionen. „Hamlet“ hat sechs Buchstaben — und die Antwort bekommt gleich weitere Nullen.'
        },
        {
            name: 'Das Freundschaftsparadoxon',
            era: 'Scott Feld, 1991',
            hook: 'Deine Freunde haben mehr Freunde als du. Fast jeder hat das.',
            body: 'Nimm deine Klasse. Schreib auf, wie viele Freunde jeder hat, und rechne dann für jeden aus, wie viele Freunde seine Freunde im Schnitt haben. Bei fast allen ist die zweite Zahl größer. Es liegt nicht an dir und nicht an ihnen: so kommt es in fast jeder Gruppe heraus.\n\nDer Grund liegt darin, wen man zählt. Ein geselliger Mensch steht auf vielen Freundeslisten, und wenn du deine Freunde durchgehst, begegnet er dir immer wieder. Ein stiller Mensch steht auf zwei Listen und taucht fast nie auf. Du vergleichst dich also nicht mit einem gewöhnlichen Menschen, sondern mit dem, den man am häufigsten trifft.',
            probe: 'Warum wirken im Fitnessstudio fast alle sportlicher als du?',
            answer: 'Weil die, die jeden Tag kommen, dir jedes Mal vor Augen sind, und die, die einmal im Monat kommen, fast nie. Das Studio ist voll von Leuten, die viel trainieren — obwohl sie unter allen Angemeldeten die Minderheit sind.'
        },
        {
            name: 'Das Lügner-Paradoxon',
            era: 'Eubulides, 4. Jh. v. Chr.',
            hook: '„Dieser Satz ist falsch.“ Und nun?',
            body: 'Drei Wörter. Ist der Satz wahr, dann ist er — wie er selbst sagt — falsch. Ist er falsch, dann stimmt, was er behauptet, also ist er wahr. Keine der beiden Antworten hält stand.\n\nDer Haken ist, dass der Satz über sich selbst spricht. Solche Selbstbezüge sind kein Spaß: genau darauf baute Gödel seinen Beweis, dass es in jeder hinreichend reichen Mathematik wahre Aussagen gibt, die sich nicht beweisen lassen. Drei Wörter über einen Lügner markieren die Grenze dessen, was Logik kann.',
            probe: 'Und was stimmt nicht mit dem Satz „Dieser Satz ist wahr“?',
            answer: 'Nichts widerspricht sich — aber es hilft auch nichts: man darf ihn wahr nennen, man darf ihn falsch nennen, und nichts erlaubt eine Entscheidung. Der Selbstbezug zerstört nicht nur die Wahrheit, sondern die Möglichkeit zu entscheiden.'
        }
    ]
};
