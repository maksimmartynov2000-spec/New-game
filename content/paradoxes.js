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
            probe: 'А если дверей сто, ты выбрал одну, и ведущий открыл 98 дверей с козами?',
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
            name: 'Парадокс Банаха — Тарского',
            era: 'Банах и Тарский, 1924',
            hook: 'Шар можно разрезать на 5 частей и собрать из них два таких же шара.',
            body: 'Не растягивая и не раздувая: части только поворачивают и передвигают, как детали пазла. Из одного шара получаются два, каждый ровно такого же размера, как исходный.\n\nПодвох в слове «части». Это не ломтики и не куски — это бесконечно рваная пыль из точек, у которой попросту нет объёма. Ножа, который так режет, не существует; такие части можно только описать словами. Поэтому апельсин так не удвоить, а математический шар — да.',
            probe: 'Почему то же самое нельзя проделать с настоящим апельсином?',
            answer: 'У апельсина конечное число атомов, а у частей есть вес и объём. Фокус работает только там, где точек бесконечно много и их можно рассыпать как угодно мелко.'
        },
        {
            name: 'Рог Гавриила',
            era: 'Эванджелиста Торричелли, 1641',
            hook: 'Фигура с бесконечной поверхностью и конечным объёмом.',
            body: 'Представь бесконечно длинную воронку, которая сужается, но никогда не сходит на нет. Посчитали объём — получилось конечное число, влезает в ведро. Посчитали площадь поверхности — бесконечность.\n\nВыходит забавное: залить воронку краской изнутри можно одним ведром, и вся внутренняя поверхность окажется покрашена. А покрасить её снаружи кистью невозможно — краски не хватит никогда. Разгадка в том, что у настоящего слоя краски есть толщина, а у математической поверхности её нет.',
            probe: 'Что будет с длинной узкой полоской бумаги, если каждый раз отрезать половину оставшегося?',
            answer: 'Бумага не кончится никогда, а суммарная длина отрезанного не превысит исходной. Бесконечное число кусочков помещается в конечную полоску.'
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
            body: 'Ты построил машину времени, вернулся на сто лет назад и случайно помешал своим дедушке с бабушкой познакомиться. Значит, твой родитель не родится. Значит, не родишься ты. Значит, некому построить машину и отправиться в прошлое. Значит, дедушка с бабушкой познакомились — и ты всё-таки родился.\n\nЭто не про машины, а про то, может ли время быть логически непротиворечивым. Выходов придумали три: в прошлое попасть нельзя вовсе; попасть можно, но помешать не выйдет — всё, что ты сделаешь, окажется частью уже случившейся истории; либо возникает отдельная ветка мира, где ты просто гость.',
            probe: 'В каком из трёх вариантов ты остаёшься собой и при этом ничего не ломаешь?',
            answer: 'Во втором. Там ты действуешь свободно, но всё сделанное уже вписано в историю — ты не меняешь прошлое, ты всегда был его частью.'
        },
        {
            name: 'Кот Шрёдингера',
            era: 'Эрвин Шрёдингер, 1935',
            hook: 'Кот в ящике жив и мёртв одновременно — пока не заглянешь.',
            body: 'В закрытом ящике кот, счётчик и ампула с ядом. Распадётся атом — ампула разобьётся. Атом по законам квантовой физики находится в двух состояниях сразу: и распался, и нет. Значит, и кот получается сразу и живой, и мёртвый.\n\nШрёдингер придумал это как насмешку: он показывал, что странности мельчайших частиц нельзя без оглядки переносить на большие предметы. Насмешка прижилась и стала главной картинкой квантовой физики. Кот, впрочем, всегда был против.',
            probe: 'Почему в жизни мы не видим предметов в двух состояниях сразу?',
            answer: 'Большой предмет непрерывно «трогает» окружающий мир — воздух, свет, тепло. Каждое такое касание и есть измерение, поэтому выбор происходит мгновенно и без нас.'
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
            body: 'Лекарство проверили на мужчинах — помогло чаще, чем старое. Проверили на женщинах — тоже помогло чаще. Сложили всех вместе — и оказалось, что старое лекарство лучше. Ошибки в подсчётах нет.\n\nВсё дело в том, что группы разного размера. Новое лекарство давали в основном тяжёлым больным, старое — в основном лёгким. При сложении перевешивает не эффект лекарства, а то, кого чем лечили. Поэтому сложенные числа иногда врут ровно наоборот, и разбивать данные на группы приходится всегда.',
            probe: 'Где ещё встречается такая ловушка?',
            answer: 'Везде, где считают средние по разным по составу группам: средние зарплаты, средние оценки классов, средний чек. Целое может двигаться не туда, куда движутся все его части.'
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
            name: 'Парадокс неожиданной контрольной',
            era: 'обсуждается с 1940-х',
            hook: 'Учитель обещал внезапную контрольную на неделе. Логика доказала: её не будет.',
            body: 'Учитель говорит: на этой неделе будет контрольная, и в тот день вы этого не будете знать заранее. Ученик рассуждает: в пятницу нельзя — если до четверга её не было, к пятнице все всё поймут. Значит, пятница отпадает. Тогда и в четверг нельзя — по той же причине, ведь пятница уже вычеркнута. Так вычёркивается вся неделя.\n\nУченик спокоен, а в среду приходит контрольная — и она действительно неожиданная. Рассуждение выглядит железным, но где-то ломается: похоже, ученик не имел права опираться на обещание, которое сам же и опроверг.',
            probe: 'На каком шаге рассуждение перестаёт работать?',
            answer: 'Единого ответа нет до сих пор. Чаще всего указывают на первый: «пятница отпадает» верно только для того, кто верит обещанию, — а поверив выводу, ученик перестаёт ему верить.'
        },
        {
            name: 'Санкт-Петербургский парадокс',
            era: 'Даниил Бернулли, 1738',
            hook: 'Игра с бесконечным средним выигрышем. Никто не отдаст за неё и сотни.',
            body: 'Бросаем монету, пока не выпадет орёл. Выпал с первого раза — платим 2 рубля, со второго — 4, с третьего — 8, и так далее, удваивая. Посчитай средний выигрыш: половина случаев даёт 2, четверть даёт 4, восьмая часть даёт 8 — каждый кусочек добавляет по рублю, и кусочков бесконечно много. Средний выигрыш бесконечен.\n\nЗначит, за вход стоило бы отдать любые деньги. Но никто в здравом уме не отдаст и ста рублей — и правильно сделает: огромные выигрыши требуют невероятного везения, а почти всегда получаешь 2 или 4. Отсюда родилась мысль, что важен не сам выигрыш, а насколько он меняет твою жизнь.',
            probe: 'Какой выигрыш ты получишь чаще всего?',
            answer: 'Двойку — в половине случаев. В трёх случаях из четырёх выигрыш не больше четырёх рублей. «Бесконечное среднее» держится на исчезающе редких огромных выплатах.'
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
            name: 'Парадокс близнецов',
            era: 'Поль Ланжевен, 1911',
            hook: 'Один брат слетал к звёздам и вернулся моложе второго.',
            body: 'Два брата-близнеца. Один остаётся на Земле, второй улетает на ракете почти со скоростью света, разворачивается у далёкой звезды и возвращается. При встрече он оказывается заметно моложе брата — не выглядит моложе, а прожил меньше.\n\nСтранность в том, что движение относительно: с точки зрения летевшего это Земля улетала и вернулась. Почему же не наоборот? Потому что братья не равноправны: разворачивался и испытывал перегрузки только один. Этот разворот и разрывает симметрию. И это не выдумка — часы на спутниках приходится подводить именно из-за таких эффектов.',
            probe: 'Почему нельзя сказать, что это Земля улетела и вернулась?',
            answer: 'Потому что Земля не тормозила и не разворачивалась. Тот, кто менял скорость, и есть путешественник, — а такое изменение чувствуется без всяких сравнений.'
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
            name: "Hilbert's Grand Hotel",
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
            name: 'The Banach–Tarski Paradox',
            era: 'Banach and Tarski, 1924',
            hook: 'A ball can be cut into 5 pieces and reassembled into two identical balls.',
            body: 'Nothing gets stretched or added: the pieces are only rotated and shifted, like jigsaw parts. One ball goes in, two come out, each exactly the size of the original.\n\nThe catch is the word "pieces". These are not slices or chunks — they are infinitely shredded dust of points, with no volume at all. No knife cuts like that; such pieces can only be described in words. That is why you cannot double an orange, but you can double a mathematical ball.',
            probe: 'Why does the same trick fail on a real orange?',
            answer: 'An orange has a finite number of atoms, and its pieces have weight and volume. The trick only works where there are infinitely many points that can be scattered as finely as you like.'
        },
        {
            name: "Gabriel's Horn",
            era: 'Evangelista Torricelli, 1641',
            hook: 'A shape with infinite surface and finite volume.',
            body: 'Picture an infinitely long funnel that narrows forever but never quite closes. Work out its volume and you get a finite number — it fits in a bucket. Work out its surface area and you get infinity.\n\nWhich leads somewhere funny: you can fill the funnel from the inside with a single bucket of paint, and its whole inner surface ends up painted. But painting it from the outside with a brush is impossible — no amount of paint would ever do. The answer is that real paint has thickness, and a mathematical surface has none.',
            probe: 'What happens to a long strip of paper if you keep cutting off half of what is left?',
            answer: 'The paper never runs out, and everything you cut off never adds up to more than the original strip. Infinitely many pieces fit inside a finite one.'
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
            name: "Schrödinger's Cat",
            era: 'Erwin Schrödinger, 1935',
            hook: 'The cat in the box is alive and dead at once — until you look.',
            body: 'Inside a sealed box: a cat, a detector and a vial of poison. If an atom decays, the vial breaks. By the laws of quantum physics the atom is in both states at once — decayed and not. So the cat comes out both alive and dead.\n\nSchrödinger meant it as mockery: he was showing that the strangeness of tiny particles cannot simply be carried over to large objects. The mockery stuck and became the signature image of quantum physics. The cat, for its part, always objected.',
            probe: 'Why do we never see everyday objects in two states at once?',
            answer: 'A large object is constantly touched by the world around it — air, light, heat. Every such touch is a measurement, so the choice is made instantly and without us.'
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
            name: "Simpson's Paradox",
            era: 'Edward Simpson, 1951',
            hook: 'A drug helps men, helps women — and does not help people.',
            body: 'A drug was tested on men: it worked more often than the old one. Tested on women: again more often. Put everyone together and the old drug comes out better. Nobody miscounted.\n\nIt happens because the groups are different sizes. The new drug went mostly to seriously ill patients, the old one mostly to mild cases. When you add everything up, what wins is not the effect of the drug but who was given which. That is why combined numbers sometimes lie in exactly the opposite direction, and why data has to be split into groups.',
            probe: 'Where else does this trap show up?',
            answer: 'Anywhere averages are taken over groups of different make-up: average salaries, average class grades, average spend. The whole can move the opposite way from every one of its parts.'
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
            name: 'The Unexpected Exam Paradox',
            era: 'debated since the 1940s',
            hook: 'The teacher promised a surprise test this week. Logic proved it cannot happen.',
            body: 'The teacher says: there will be a test this week, and on the day it happens you will not have known it in advance. A student reasons: it cannot be Friday — if nothing has happened by Thursday evening, everyone will know. So Friday is out. Then Thursday is out too, for the same reason, since Friday has already been crossed off. The whole week gets crossed off this way.\n\nThe student relaxes — and on Wednesday the test arrives, genuinely unexpected. The reasoning looks airtight but breaks somewhere. The usual suspect: the student had no right to lean on a promise he had just proved impossible.',
            probe: 'At which step does the reasoning stop working?',
            answer: 'There is still no agreed answer. Most often the very first step is blamed: "Friday is out" only holds for someone who believes the promise — and by believing his own conclusion, the student stops believing it.'
        },
        {
            name: 'The St. Petersburg Paradox',
            era: 'Daniel Bernoulli, 1738',
            hook: 'A game with an infinite average payout. Nobody would pay a hundred for it.',
            body: 'Flip a coin until heads comes up. Heads on the first flip pays 2 coins, on the second 4, on the third 8, doubling each time. Work out the average payout: half the time you get 2, a quarter of the time 4, an eighth of the time 8 — every slice adds one coin, and there are infinitely many slices. The average payout is infinite.\n\nSo you ought to pay any price to play. But nobody sane would hand over even a hundred coins — and they are right: the huge payouts need unbelievable luck, while you almost always walk away with 2 or 4. This is where the idea came from that what matters is not the size of a win but how much it changes your life.',
            probe: 'Which payout will you get most often?',
            answer: 'Two — half the time. In three cases out of four the payout is no more than four. The "infinite average" rests on vanishingly rare huge payouts.'
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
            name: 'The Twin Paradox',
            era: 'Paul Langevin, 1911',
            hook: 'One brother flew to the stars and came back younger than the other.',
            body: 'Two twin brothers. One stays on Earth, the other flies off in a rocket at nearly the speed of light, turns around at a distant star and comes home. At the reunion he is noticeably younger — not younger-looking, but genuinely fewer years lived.\n\nThe odd part is that motion is relative: from the traveller\'s point of view it was Earth that flew away and came back. So why not the other way round? Because the brothers are not equals: only one of them turned around and felt the forces of it. That turn is what breaks the symmetry. And this is no fantasy — clocks on satellites have to be adjusted for exactly these effects.',
            probe: 'Why can we not say that it was Earth that flew away and returned?',
            answer: 'Because Earth never braked or turned around. The one who changed speed is the traveller — and such a change is felt directly, without comparing anything.'
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
            name: 'Le paradoxe de Banach-Tarski',
            era: 'Banach et Tarski, 1924',
            hook: 'On peut découper une boule en 5 morceaux et en reconstituer deux boules identiques.',
            body: 'Rien n’est étiré ni ajouté : les morceaux sont seulement tournés et déplacés, comme des pièces de puzzle. Une boule entre, deux sortent, chacune exactement de la taille de la première.\n\nLe piège est dans le mot « morceaux ». Ce ne sont ni des tranches ni des blocs, mais une poussière de points infiniment déchiquetée, qui n’a tout simplement pas de volume. Aucun couteau ne coupe ainsi ; ces morceaux ne peuvent qu’être décrits par des mots. Voilà pourquoi on ne double pas une orange, mais bien une boule mathématique.',
            probe: 'Pourquoi la même astuce échoue-t-elle sur une vraie orange ?',
            answer: 'Une orange a un nombre fini d’atomes, et ses morceaux ont un poids et un volume. L’astuce ne marche que là où les points sont infiniment nombreux et peuvent être éparpillés aussi finement qu’on veut.'
        },
        {
            name: 'La trompette de Gabriel',
            era: 'Evangelista Torricelli, 1641',
            hook: 'Une figure à surface infinie et à volume fini.',
            body: 'Imagine un entonnoir infiniment long qui se rétrécit sans jamais se refermer. Calcule son volume : tu obtiens un nombre fini, il tient dans un seau. Calcule sa surface : tu obtiens l’infini.\n\nD’où une drôle de conséquence : on peut remplir l’entonnoir de peinture avec un seul seau, et toute sa surface intérieure se retrouve peinte. Mais le peindre au pinceau par l’extérieur est impossible — aucune quantité de peinture ne suffira jamais. L’explication : une vraie couche de peinture a une épaisseur, une surface mathématique n’en a aucune.',
            probe: 'Qu’arrive-t-il à une longue bande de papier si tu coupes chaque fois la moitié de ce qui reste ?',
            answer: 'Le papier ne s’épuise jamais, et tout ce que tu as coupé ne dépasse jamais la bande de départ. Une infinité de morceaux tient dans une longueur finie.'
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
            body: 'Dans une boîte fermée : un chat, un détecteur et une fiole de poison. Si un atome se désintègre, la fiole se brise. Or, selon la physique quantique, l’atome est dans les deux états à la fois — désintégré et non désintégré. Le chat serait donc à la fois vivant et mort.\n\nSchrödinger avait imaginé cela comme une moquerie : il montrait qu’on ne peut pas transposer sans réfléchir l’étrangeté des particules aux gros objets. La moquerie est restée et est devenue l’image emblématique de la physique quantique. Le chat, lui, a toujours protesté.',
            probe: 'Pourquoi ne voit-on jamais un objet ordinaire dans deux états à la fois ?',
            answer: 'Un gros objet est sans cesse touché par le monde autour de lui : air, lumière, chaleur. Chacun de ces contacts est une mesure, donc le choix se fait instantanément et sans nous.'
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
            hook: 'Un médicament aide les hommes, aide les femmes — et n’aide pas les gens.',
            body: 'On teste un médicament sur des hommes : il marche plus souvent que l’ancien. Sur des femmes : plus souvent aussi. On additionne tout le monde et c’est l’ancien qui l’emporte. Personne ne s’est trompé dans les calculs.\n\nTout vient de la taille des groupes. Le nouveau médicament a surtout été donné aux malades graves, l’ancien surtout aux cas légers. En additionnant, ce qui l’emporte n’est pas l’effet du médicament mais le choix de qui a reçu quoi. Voilà pourquoi les chiffres agrégés mentent parfois dans le sens exactement inverse, et pourquoi il faut toujours découper les données par groupes.',
            probe: 'Où retrouve-t-on ce piège ?',
            answer: 'Partout où l’on fait des moyennes sur des groupes de composition différente : salaires moyens, notes moyennes des classes, panier moyen. Le tout peut aller dans le sens opposé à chacune de ses parties.'
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
            name: 'Le paradoxe de l’examen surprise',
            era: 'débattu depuis les années 1940',
            hook: 'Le professeur a promis un contrôle surprise cette semaine. La logique a prouvé qu’il n’aura pas lieu.',
            body: 'Le professeur annonce : il y aura un contrôle cette semaine, et le jour venu vous ne l’aurez pas su à l’avance. Un élève raisonne : ce ne peut pas être vendredi — si rien n’a eu lieu jeudi soir, tout le monde le saura. Vendredi est donc éliminé. Alors jeudi l’est aussi, pour la même raison, puisque vendredi est déjà barré. Toute la semaine y passe.\n\nL’élève est tranquille — et le mercredi le contrôle tombe, réellement inattendu. Le raisonnement semble en acier mais casse quelque part. Le suspect habituel : l’élève n’avait pas le droit de s’appuyer sur une promesse qu’il venait lui-même de déclarer impossible.',
            probe: 'À quelle étape le raisonnement cesse-t-il de fonctionner ?',
            answer: 'Il n’y a toujours pas de réponse admise par tous. On accuse le plus souvent la première étape : « vendredi est éliminé » ne vaut que pour qui croit la promesse — et en croyant sa propre conclusion, l’élève cesse d’y croire.'
        },
        {
            name: 'Le paradoxe de Saint-Pétersbourg',
            era: 'Daniel Bernoulli, 1738',
            hook: 'Un jeu au gain moyen infini. Personne n’en donnerait cent pièces.',
            body: 'On lance une pièce jusqu’à obtenir face. Face au premier lancer rapporte 2 pièces, au deuxième 4, au troisième 8, en doublant à chaque fois. Calcule le gain moyen : une fois sur deux tu gagnes 2, une fois sur quatre 4, une fois sur huit 8 — chaque tranche ajoute une pièce, et les tranches sont infiniment nombreuses. Le gain moyen est infini.\n\nIl faudrait donc payer n’importe quel prix pour jouer. Mais personne de sensé ne donnerait cent pièces — et il a raison : les gros gains exigent une chance invraisemblable, alors qu’on repart presque toujours avec 2 ou 4. C’est de là qu’est née l’idée que ce qui compte n’est pas la taille du gain, mais ce qu’il change dans ta vie.',
            probe: 'Quel gain obtiendras-tu le plus souvent ?',
            answer: 'Deux — une fois sur deux. Dans trois cas sur quatre, le gain ne dépasse pas quatre. La « moyenne infinie » repose sur des gains énormes et infiniment rares.'
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
            name: 'Le paradoxe des jumeaux',
            era: 'Paul Langevin, 1911',
            hook: 'Un frère est parti vers les étoiles et revient plus jeune que l’autre.',
            body: 'Deux frères jumeaux. L’un reste sur Terre, l’autre part en fusée presque à la vitesse de la lumière, fait demi-tour près d’une étoile lointaine et revient. Aux retrouvailles, il est nettement plus jeune — pas d’apparence : il a réellement vécu moins d’années.\n\nL’étrangeté vient de ce que le mouvement est relatif : du point de vue du voyageur, c’est la Terre qui est partie et revenue. Pourquoi pas l’inverse, alors ? Parce que les frères ne sont pas à égalité : un seul a fait demi-tour et en a subi les forces. Ce demi-tour brise la symétrie. Et ce n’est pas une fable : les horloges des satellites doivent être corrigées pour exactement ces effets.',
            probe: 'Pourquoi ne peut-on pas dire que c’est la Terre qui est partie et revenue ?',
            answer: 'Parce que la Terre n’a ni freiné ni fait demi-tour. Celui qui a changé de vitesse est le voyageur — et un tel changement se ressent directement, sans rien comparer.'
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
            name: 'Das Banach-Tarski-Paradoxon',
            era: 'Banach und Tarski, 1924',
            hook: 'Eine Kugel lässt sich in 5 Teile zerlegen und zu zwei gleich großen Kugeln zusammensetzen.',
            body: 'Nichts wird gedehnt oder hinzugefügt: die Teile werden nur gedreht und verschoben, wie Puzzlestücke. Eine Kugel hinein, zwei heraus, jede genau so groß wie die ursprüngliche.\n\nDer Haken steckt im Wort „Teile“. Das sind keine Scheiben und keine Brocken, sondern unendlich zerfetzter Staub aus Punkten, der schlicht kein Volumen hat. So schneidet kein Messer; solche Teile lassen sich nur in Worten beschreiben. Deshalb verdoppelt man keine Orange, eine mathematische Kugel aber schon.',
            probe: 'Warum funktioniert derselbe Trick bei einer echten Orange nicht?',
            answer: 'Eine Orange hat endlich viele Atome, und ihre Teile haben Gewicht und Volumen. Der Trick geht nur dort, wo unendlich viele Punkte beliebig fein verstreut werden können.'
        },
        {
            name: 'Gabriels Horn',
            era: 'Evangelista Torricelli, 1641',
            hook: 'Eine Figur mit unendlicher Oberfläche und endlichem Volumen.',
            body: 'Stell dir einen unendlich langen Trichter vor, der immer enger wird, sich aber nie ganz schließt. Rechne sein Volumen aus: eine endliche Zahl, es passt in einen Eimer. Rechne seine Oberfläche aus: unendlich.\n\nDaraus folgt etwas Komisches: Man kann den Trichter mit einem einzigen Eimer Farbe von innen füllen, und die gesamte Innenfläche ist gestrichen. Ihn von außen mit dem Pinsel zu streichen ist dagegen unmöglich — keine Menge Farbe reicht je aus. Die Auflösung: echte Farbe hat eine Dicke, eine mathematische Fläche hat keine.',
            probe: 'Was passiert mit einem langen Papierstreifen, wenn du jedes Mal die Hälfte des Rests abschneidest?',
            answer: 'Das Papier geht nie aus, und alles Abgeschnittene wird zusammen nie länger als der Streifen am Anfang. Unendlich viele Stücke passen in eine endliche Länge.'
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
            hook: 'Die Katze in der Kiste ist zugleich lebendig und tot — solange niemand hineinsieht.',
            body: 'In einer verschlossenen Kiste: eine Katze, ein Zähler und ein Fläschchen Gift. Zerfällt ein Atom, zerbricht das Fläschchen. Nach den Gesetzen der Quantenphysik ist das Atom in beiden Zuständen zugleich — zerfallen und nicht zerfallen. Also ist auch die Katze zugleich lebendig und tot.\n\nSchrödinger meinte das als Spott: Er zeigte, dass man die Seltsamkeit winziger Teilchen nicht bedenkenlos auf große Dinge übertragen darf. Der Spott blieb und wurde zum Wahrzeichen der Quantenphysik. Die Katze war stets dagegen.',
            probe: 'Warum sehen wir Alltagsdinge nie in zwei Zuständen zugleich?',
            answer: 'Ein großes Ding wird ununterbrochen von der Welt berührt — Luft, Licht, Wärme. Jede dieser Berührungen ist eine Messung, deshalb fällt die Entscheidung sofort und ohne uns.'
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
            name: 'Simpsons Paradoxon',
            era: 'Edward Simpson, 1951',
            hook: 'Ein Medikament hilft Männern, hilft Frauen — und hilft Menschen nicht.',
            body: 'Ein Medikament wurde an Männern geprüft: es half öfter als das alte. An Frauen geprüft: ebenfalls öfter. Zählt man alle zusammen, ist plötzlich das alte besser. Verrechnet hat sich niemand.\n\nDas liegt an den unterschiedlich großen Gruppen. Das neue Mittel bekamen vor allem Schwerkranke, das alte vor allem leichte Fälle. Beim Zusammenzählen gewinnt nicht die Wirkung des Medikaments, sondern die Frage, wer womit behandelt wurde. Deshalb lügen zusammengefasste Zahlen manchmal genau andersherum, und deshalb muss man Daten immer nach Gruppen aufteilen.',
            probe: 'Wo begegnet einem diese Falle sonst noch?',
            answer: 'Überall, wo über unterschiedlich zusammengesetzte Gruppen gemittelt wird: Durchschnittslöhne, Klassendurchschnitte, durchschnittlicher Einkauf. Das Ganze kann sich in die Gegenrichtung bewegen wie jeder seiner Teile.'
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
            name: 'Das Paradoxon der unerwarteten Prüfung',
            era: 'diskutiert seit den 1940er-Jahren',
            hook: 'Der Lehrer versprach eine überraschende Prüfung in dieser Woche. Die Logik bewies: sie kommt nicht.',
            body: 'Der Lehrer sagt: In dieser Woche gibt es eine Prüfung, und an dem Tag werdet ihr es vorher nicht gewusst haben. Ein Schüler überlegt: Freitag geht nicht — wenn bis Donnerstagabend nichts war, wissen es alle. Freitag fällt also weg. Dann fällt auch Donnerstag weg, aus demselben Grund, denn Freitag ist schon gestrichen. So wird die ganze Woche gestrichen.\n\nDer Schüler ist beruhigt — und am Mittwoch kommt die Prüfung, tatsächlich unerwartet. Die Überlegung wirkt wasserdicht, bricht aber irgendwo. Der übliche Verdacht: Der Schüler durfte sich nicht auf ein Versprechen stützen, das er selbst gerade widerlegt hatte.',
            probe: 'An welchem Schritt hört die Überlegung auf zu funktionieren?',
            answer: 'Eine allgemein anerkannte Antwort gibt es bis heute nicht. Meist wird der erste Schritt beschuldigt: „Freitag fällt weg“ gilt nur für den, der dem Versprechen glaubt — und indem der Schüler seinem eigenen Schluss glaubt, glaubt er ihm nicht mehr.'
        },
        {
            name: 'Das Sankt-Petersburg-Paradoxon',
            era: 'Daniel Bernoulli, 1738',
            hook: 'Ein Spiel mit unendlichem durchschnittlichem Gewinn. Niemand gibt hundert dafür.',
            body: 'Wirf eine Münze, bis Kopf fällt. Kopf beim ersten Wurf zahlt 2 Münzen, beim zweiten 4, beim dritten 8, jedes Mal doppelt so viel. Rechne den durchschnittlichen Gewinn aus: in der Hälfte der Fälle 2, in einem Viertel 4, in einem Achtel 8 — jedes Stück steuert eine Münze bei, und es sind unendlich viele Stücke. Der Durchschnitt ist unendlich.\n\nMan müsste also jeden Preis für den Einsatz zahlen. Aber niemand bei Verstand gibt auch nur hundert Münzen — und das zu Recht: die riesigen Gewinne brauchen unglaubliches Glück, während man fast immer mit 2 oder 4 nach Hause geht. Daraus entstand der Gedanke, dass nicht die Höhe des Gewinns zählt, sondern wie sehr er dein Leben verändert.',
            probe: 'Welchen Gewinn bekommst du am häufigsten?',
            answer: 'Zwei — in der Hälfte der Fälle. In drei von vier Fällen ist der Gewinn höchstens vier. Der „unendliche Durchschnitt“ hängt an verschwindend seltenen Riesenauszahlungen.'
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
            name: 'Das Zwillingsparadoxon',
            era: 'Paul Langevin, 1911',
            hook: 'Ein Bruder flog zu den Sternen und kam jünger zurück als der andere.',
            body: 'Zwei Zwillingsbrüder. Einer bleibt auf der Erde, der andere fliegt mit fast Lichtgeschwindigkeit los, dreht bei einem fernen Stern um und kehrt zurück. Beim Wiedersehen ist er deutlich jünger — nicht dem Aussehen nach, sondern er hat wirklich weniger Jahre gelebt.\n\nDas Seltsame: Bewegung ist relativ, aus Sicht des Reisenden ist die Erde weggeflogen und zurückgekommen. Warum also nicht umgekehrt? Weil die Brüder nicht gleichberechtigt sind: nur einer hat gewendet und die Kräfte dabei gespürt. Dieses Wenden bricht die Symmetrie. Und das ist keine Erfindung — die Uhren auf Satelliten müssen genau wegen solcher Effekte nachgestellt werden.',
            probe: 'Warum kann man nicht sagen, die Erde sei weggeflogen und zurückgekommen?',
            answer: 'Weil die Erde weder gebremst noch gewendet hat. Wer seine Geschwindigkeit geändert hat, ist der Reisende — und so eine Änderung spürt man unmittelbar, ganz ohne Vergleich.'
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
