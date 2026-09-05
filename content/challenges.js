// Задачи за мастерство — содержимое, а не код.
//
// Даются, когда клетка берёт алмаз (минимум из трёх лесенок дошёл до четвёртой
// ступени) и отдельно — легенду. До сих пор мастерство не давало ничего, кроме
// значка, хотя это самая дорогая вещь в игре.
//
// Задача должна решаться в уме примерно за минуту и заканчиваться «ага»: не
// многоходовка и не олимпиада, а один неожиданный поворот. Действие — то же, что
// в клетке, но применённое вбок, а не так же, как в примерах.
//
// Ключ — клетка: 'integer+:add:3'. Внутри две ступени: diamond и legend.
// task — условие, answer — короткий ответ («30», «На два»), why — объяснение.
// Разделены намеренно: ответ ученик ищет глазами, и он не должен тонуть в разборе.
//
// Языки добавляются ключом верхнего уровня, как в остальных файлах содержимого.

window.CHALLENGE_CONTENT = {
    ru: {
        // ===================== СЛОЖЕНИЕ =====================
        'integer+:add:1': {
            diamond: {
                task: 'Из одной корзины во вторую переложили одно яблоко — и яблок стало поровну. На сколько яблок в первой корзине было больше?',
                answer: 'На два',
                why: 'Яблоко ушло из первой и пришло во вторую, поэтому разница сократилась сразу на два: было 5 и 3, стало 4 и 4.'
            },
            legend: {
                task: 'Задумай любое число. Прибавь 5, потом ещё 5, потом отними 10. Что получится?',
                answer: 'Задуманное число',
                why: 'Прибавили 10 и отняли 10 — сложение и вычитание отменили друг друга, и число вернулось на место.'
            }
        },
        'integer+:add:2': {
            diamond: {
                task: 'Сумма двух чисел равна 20, и одно больше другого на 4. Что это за числа?',
                answer: '12 и 8',
                why: 'Убери разницу — останется 16, это две равные половины по 8. Разницу верни большему: 8 + 4 = 12.'
            },
            legend: {
                task: 'Сколько будет 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10?',
                answer: '55',
                why: 'Складывай не подряд, а парами с концов: 1 + 10 = 11, 2 + 9 = 11, и так пять пар. Пять раз по 11 — это 55.'
            }
        },
        'integer+:add:3': {
            diamond: {
                task: 'В доме пять этажей, между соседними этажами один пролёт лестницы. Сколько пролётов от первого этажа до пятого?',
                answer: 'Четыре',
                why: 'Пролётов всегда на один меньше, чем этажей: считать надо промежутки, а не сами этажи.'
            },
            legend: {
                task: 'Три числа идут подряд, их сумма равна 33. Что это за числа?',
                answer: '10, 11 и 12',
                why: 'Среднее число — это треть суммы: 33 ÷ 3 = 11. Соседи стоят по бокам, и их излишек с недостачей гасят друг друга.'
            }
        },
        'integer+:add:4': {
            diamond: {
                task: 'Как быстро сложить 99 + 99 + 99, не считая столбиком?',
                answer: '297',
                why: 'Каждое 99 — это 100 без одного. Три сотни это 300, и вычитаем три единицы: 300 − 3 = 297.'
            },
            legend: {
                task: 'Сколько будет 1 + 2 + 4 + 8 + 16 + 32 + 64?',
                answer: '127',
                why: 'Каждое следующее число равно сумме всех предыдущих плюс один, поэтому вся сумма — это 128 без единицы.'
            }
        },
        'integer+:add:5': {
            diamond: {
                task: 'Сложи все числа от 1 до 100. Сколько получится?',
                answer: '5050',
                why: 'Пары с концов дают одно и то же: 1 + 100 = 101, 2 + 99 = 101. Таких пар пятьдесят, значит 50 × 101 = 5050.'
            },
            legend: {
                task: 'В комнате 4 человека, и каждый поздоровался с каждым ровно один раз. Сколько было рукопожатий?',
                answer: 'Шесть',
                why: 'Первый жмёт руку троим, второй — оставшимся двоим, третий — последнему: 3 + 2 + 1 = 6. Считать надо пары, а не людей.'
            }
        },

        // ===================== ВЫЧИТАНИЕ =====================
        'integer+:sub:1': {
            diamond: {
                task: 'У тебя было 10 конфет. Ты съел несколько, осталось 4. Потом тебе дали ещё, и снова стало 10. Сколько конфет тебе дали?',
                answer: 'Шесть',
                why: 'Ровно столько, сколько ты съел: чтобы вернуться к прежнему числу, надо добавить то же, что убавили.'
            },
            legend: {
                task: 'Из числа вычли 3, потом ещё 3 — получилось 4. Какое число было вначале?',
                answer: '10',
                why: 'Иди назад: было 4, вернём обе тройки — 4 + 3 + 3 = 10. Обратный ход всегда меняет вычитание на сложение.'
            }
        },
        'integer+:sub:2': {
            diamond: {
                task: 'Верёвку длиной 20 метров разрезали на две части, и одна оказалась на 4 метра длиннее. Какие получились части?',
                answer: '12 и 8 метров',
                why: 'Отложи разницу в сторону: останется 16 на две равные части, по 8. Разницу верни длинной: 8 + 4 = 12.'
            },
            legend: {
                task: 'Сколько целых чисел стоит между 7 и 15?',
                answer: 'Семь: от 8 до 14',
                why: 'Разность 15 − 7 = 8 считает промежутки, а сами числа между концами — это на одно меньше.'
            }
        },
        'integer+:sub:3': {
            diamond: {
                task: 'Число уменьшили на 10, потом ещё на 20 — получилось 30. Каким оно было?',
                answer: '60',
                why: 'Всего убавили 30, значит было 30 + 30 = 60. Два вычитания подряд можно сложить в одно.'
            },
            legend: {
                task: 'Сколько лет человеку сейчас, если через 10 лет ему будет столько же, сколько было 10 лет назад плюс 20?',
                answer: 'Любое: условие верно всегда',
                why: 'Через десять лет человек старше на двадцать, чем был десять лет назад, — это просто повтор одного и того же.'
            }
        },
        'integer+:sub:4': {
            diamond: {
                task: 'Из 100 вычли 1, из результата 2, потом 3, потом 4. Что осталось?',
                answer: '90',
                why: 'Вычитать по очереди то же самое, что вычесть сумму: 1 + 2 + 3 + 4 = 10, и 100 − 10 = 90.'
            },
            legend: {
                task: 'Разность двух чисел равна 15, а их сумма 45. Что это за числа?',
                answer: '30 и 15',
                why: 'Сумма без разницы — это два меньших числа: 45 − 15 = 30, значит меньшее 15, а большее 15 + 15 = 30.'
            }
        },
        'integer+:sub:5': {
            diamond: {
                task: 'Как быстро посчитать 1000 − 387 в уме?',
                answer: '613',
                why: 'Вычитай по частям: 1000 − 300 = 700, потом − 80 = 620, потом − 7 = 613. Разряды по очереди легче, чем всё сразу.'
            },
            legend: {
                task: 'Сколько будет 100 − 99 + 98 − 97 + 96 − 95 + … + 2 − 1?',
                answer: '50',
                why: 'Разбей на пары: 100 − 99 = 1, 98 − 97 = 1, и так далее. Пар ровно пятьдесят, каждая даёт единицу.'
            }
        },

        // ===================== УМНОЖЕНИЕ =====================
        'integer+:mul:1': {
            diamond: {
                task: 'Сколько всего ног у трёх кошек и двух птиц?',
                answer: '16',
                why: 'У кошек по четыре: 3 × 4 = 12. У птиц по две: 2 × 2 = 4. Вместе 16 — считать надо отдельно, у разных зверей ноги разные.'
            },
            legend: {
                task: 'Лист бумаги сложили пополам три раза. Сколько получилось слоёв?',
                answer: 'Восемь',
                why: 'Каждое сложение удваивает: 2, 4, 8. Не 3 и не 6 — удвоение растёт быстрее, чем сложение.'
            }
        },
        'integer+:mul:2': {
            diamond: {
                task: 'Лист бумаги сложили пополам пять раз. Сколько получилось слоёв?',
                answer: '32',
                why: 'Удвоение пять раз подряд: 2, 4, 8, 16, 32. Кажется, что должно выйти около десяти, — но удвоение обгоняет ожидания очень быстро.'
            },
            legend: {
                task: 'Сколько будет 5 × 4 × 2 × 0 × 3?',
                answer: 'Ноль',
                why: 'Один-единственный ноль в цепочке обнуляет всё произведение, сколько бы больших чисел рядом ни стояло.'
            }
        },
        'integer+:mul:3': {
            diamond: {
                task: 'У пяти человек по два кармана, и в каждом кармане по три монеты. Сколько всего монет?',
                answer: '30',
                why: 'Карманов 5 × 2 = 10, в каждом по три: 10 × 3 = 30. Три множителя можно перемножать в любом порядке.'
            },
            legend: {
                task: 'Что больше: 12 × 8 или 16 × 6?',
                answer: 'Поровну, оба равны 96',
                why: 'Во втором один множитель вырос, зато другой уменьшился ровно так же — произведение не изменилось.'
            }
        },
        'integer+:mul:4': {
            diamond: {
                task: 'Сколько будет 25 × 4? А 25 × 8?',
                answer: '100 и 200',
                why: 'Четыре четвертака — это ровно сотня, а восемь — вдвое больше. Числа 25 и 4 стоит запомнить как пару: они дают круглое.'
            },
            legend: {
                task: 'Как быстро умножить 18 на 5, не считая столбиком?',
                answer: '90',
                why: 'Умножь на 10 и раздели пополам: 18 × 10 = 180, половина — 90. Умножать на 5 всегда проще через десяток.'
            }
        },
        'integer+:mul:5': {
            diamond: {
                task: 'Как умножить 99 на 7 в уме?',
                answer: '693',
                why: 'Считай 99 как сотню без единицы: 100 × 7 = 700, потом вычти семь лишних — 700 − 7 = 693.'
            },
            legend: {
                task: 'Сколько нулей будет в конце произведения 2 × 5 × 4 × 5 × 6?',
                answer: 'Два: получается 1200',
                why: 'Каждый ноль в конце рождается парой «два и пять», а таких пар здесь ровно две.'
            }
        },

        // ===================== ДЕЛЕНИЕ =====================
        'integer+:div:1': {
            diamond: {
                task: 'Верёвку разрезали на четыре части. Сколько сделали разрезов?',
                answer: 'Три',
                why: 'Разрезов всегда на один меньше, чем частей: последний кусок отделяется тем же разрезом, что и предпоследний.'
            },
            legend: {
                task: 'Шесть котов съедают шесть рыбок за шесть минут. За сколько минут шесть котов съедят двенадцать рыбок?',
                answer: 'За двенадцать',
                why: 'Каждый кот ест свою рыбку шесть минут, значит вторую съест ещё за шесть. Число котов здесь вообще ни при чём.'
            }
        },
        'integer+:div:2': {
            diamond: {
                task: 'Двенадцать конфет раздали детям поровну, каждому досталось по три. Сколько было детей?',
                answer: 'Четверо',
                why: 'Деление отвечает и на вопрос «сколько раз по три помещается в двенадцати» — а это и есть число детей.'
            },
            legend: {
                task: 'Половина числа равна 8. Чему равна его четверть?',
                answer: 'Четырём',
                why: 'Само число 16, но считать его необязательно: четверть — это половина от половины, значит 8 ÷ 2 = 4.'
            }
        },
        'integer+:div:3': {
            diamond: {
                task: 'В корзине 20 яблок. Половину отдали, потом отдали половину остатка. Сколько яблок осталось?',
                answer: 'Пять',
                why: 'После первой отдачи осталось 10, после второй — половина от десяти. Половину берут каждый раз от того, что есть сейчас.'
            },
            legend: {
                task: 'Что больше: 100 ÷ 4 или 100 ÷ 5?',
                answer: '100 ÷ 4 = 25, это больше, чем 20',
                why: 'Чем на большее число делят, тем меньше достаётся каждому — с делителем результат идёт в обратную сторону.'
            }
        },
        'integer+:div:4': {
            diamond: {
                task: 'Сколько раз число 8 помещается в 100 и что останется?',
                answer: '12 раз, остаток 4',
                why: 'Двенадцать восьмёрок — это 96, до сотни не хватает четырёх, а тринадцатая восьмёрка уже не влезает.'
            },
            legend: {
                task: 'Число разделили на 5 и получили 5. Что получится, если это же число разделить на 25?',
                answer: 'Единица',
                why: 'Само число 25, но можно и не считать: делитель вырос в пять раз, значит результат во столько же раз уменьшился.'
            }
        },
        'integer+:div:5': {
            diamond: {
                task: 'Как быстро разделить 300 на 25?',
                answer: 'Двенадцать',
                why: 'В сотне четыре четвертака, значит в трёх сотнях их 4 × 3 = 12. Делить на 25 удобно через сотни.'
            },
            legend: {
                task: 'При делении получилось частное 8. Каким станет частное, если делимое удвоить, а делитель оставить прежним?',
                answer: 'Шестнадцать',
                why: 'Делимое выросло вдвое, делитель не менялся — значит и результат вырос ровно вдвое, какие бы числа там ни стояли.'
            }
        }
    },
    en: {
        // ===================== СЛОЖЕНИЕ =====================
        'integer+:add:1': {
            diamond: {
                task: 'One apple was moved from the first basket to the second — and now both have the same number. How many more apples did the first basket have?',
                answer: 'Two',
                why: 'The apple left one basket and joined the other, so the gap closed by two at once: 5 and 3 became 4 and 4.'
            },
            legend: {
                task: 'Think of any number. Add 5, then another 5, then subtract 10. What do you get?',
                answer: 'The number you thought of',
                why: 'You added 10 and took 10 away — adding and subtracting cancelled each other out, and the number came back.'
            }
        },
        'integer+:add:2': {
            diamond: {
                task: 'Two numbers add up to 20, and one is 4 bigger than the other. What are they?',
                answer: '12 and 8',
                why: 'Take the gap away and 16 is left — two equal halves of 8. Give the gap back to the bigger one: 8 + 4 = 12.'
            },
            legend: {
                task: 'How much is 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10?',
                answer: '55',
                why: 'Don’t add in order — pair the ends: 1 + 10 = 11, 2 + 9 = 11, and so on for five pairs. Five times 11 is 55.'
            }
        },
        'integer+:add:3': {
            diamond: {
                task: 'A house has five floors, with one flight of stairs between neighbouring floors. How many flights from the first floor to the fifth?',
                answer: 'Four',
                why: 'There is always one flight fewer than floors: what you count are the gaps, not the floors themselves.'
            },
            legend: {
                task: 'Three numbers in a row add up to 33. What are they?',
                answer: '10, 11 and 12',
                why: 'The middle number is a third of the sum: 33 ÷ 3 = 11. The neighbours sit on either side, and their extra and their shortfall cancel out.'
            }
        },
        'integer+:add:4': {
            diamond: {
                task: 'How do you add 99 + 99 + 99 quickly, without working it out on paper?',
                answer: '297',
                why: 'Each 99 is a hundred minus one. Three hundreds make 300, then take away the three ones: 300 − 3 = 297.'
            },
            legend: {
                task: 'How much is 1 + 2 + 4 + 8 + 16 + 32 + 64?',
                answer: '127',
                why: 'Each next number equals all the previous ones plus one, so the whole sum is 128 minus a single unit.'
            }
        },
        'integer+:add:5': {
            diamond: {
                task: 'Add up every number from 1 to 100. What do you get?',
                answer: '5050',
                why: 'Pairs from the ends always give the same: 1 + 100 = 101, 2 + 99 = 101. There are fifty such pairs, so 50 × 101 = 5050.'
            },
            legend: {
                task: 'Four people are in a room, and each shook hands with each other exactly once. How many handshakes were there?',
                answer: 'Six',
                why: 'The first shakes three hands, the second the remaining two, the third the last one: 3 + 2 + 1 = 6. Count pairs, not people.'
            }
        },
        // ===================== ВЫЧИТАНИЕ =====================
        'integer+:sub:1': {
            diamond: {
                task: 'You had 10 sweets. You ate some and 4 were left. Then you were given more and it was 10 again. How many were you given?',
                answer: 'Six',
                why: 'Exactly as many as you ate: to get back to the old number you have to add back what was taken away.'
            },
            legend: {
                task: '3 was subtracted from a number, then 3 again — and 4 came out. What was the number at the start?',
                answer: '10',
                why: 'Go backwards: 4 is left, put both threes back — 4 + 3 + 3 = 10. Running back always turns subtraction into addition.'
            }
        },
        'integer+:sub:2': {
            diamond: {
                task: 'A 20-metre rope was cut into two pieces, and one turned out 4 metres longer. How long is each piece?',
                answer: '12 and 8 metres',
                why: 'Set the difference aside: 16 is left for two equal pieces of 8. Give the difference back to the long one: 8 + 4 = 12.'
            },
            legend: {
                task: 'How many whole numbers lie between 7 and 15?',
                answer: 'Seven: from 8 to 14',
                why: 'The difference 15 − 7 = 8 counts the gaps, and the numbers in between are one fewer than that.'
            }
        },
        'integer+:sub:3': {
            diamond: {
                task: 'A number was made 10 smaller, then 20 smaller — and 30 came out. What was it?',
                answer: '60',
                why: 'Altogether 30 was taken away, so it was 30 + 30 = 60. Two subtractions in a row can be added into one.'
            },
            legend: {
                task: 'How old is a person now, if in 10 years they will be as old as they were 10 years ago plus 20?',
                answer: 'Any age: it is always true',
                why: 'In ten years a person is twenty years older than ten years ago — that is simply the same statement said twice.'
            }
        },
        'integer+:sub:4': {
            diamond: {
                task: '1 was subtracted from 100, then 2 from the result, then 3, then 4. What is left?',
                answer: '90',
                why: 'Subtracting one after another is the same as subtracting the total: 1 + 2 + 3 + 4 = 10, and 100 − 10 = 90.'
            },
            legend: {
                task: 'The difference of two numbers is 15 and their sum is 45. What are they?',
                answer: '30 and 15',
                why: 'The sum without the difference is two of the smaller number: 45 − 15 = 30, so the smaller is 15 and the bigger 15 + 15 = 30.'
            }
        },
        'integer+:sub:5': {
            diamond: {
                task: 'How do you work out 1000 − 387 quickly in your head?',
                answer: '613',
                why: 'Subtract in parts: 1000 − 300 = 700, then − 80 = 620, then − 7 = 613. One place at a time is easier than all at once.'
            },
            legend: {
                task: 'How much is 100 − 99 + 98 − 97 + 96 − 95 + … + 2 − 1?',
                answer: '50',
                why: 'Break it into pairs: 100 − 99 = 1, 98 − 97 = 1, and so on. There are exactly fifty pairs, each giving one.'
            }
        },
        // ===================== УМНОЖЕНИЕ =====================
        'integer+:mul:1': {
            diamond: {
                task: 'How many legs do three cats and two birds have altogether?',
                answer: '16',
                why: 'Cats have four each: 3 × 4 = 12. Birds have two each: 2 × 2 = 4. Together 16 — count them apart, different animals have different legs.'
            },
            legend: {
                task: 'A sheet of paper was folded in half three times. How many layers are there?',
                answer: 'Eight',
                why: 'Every fold doubles it: 2, 4, 8. Not 3 and not 6 — doubling grows faster than adding.'
            }
        },
        'integer+:mul:2': {
            diamond: {
                task: 'A sheet of paper was folded in half five times. How many layers are there?',
                answer: '32',
                why: 'Doubling five times over: 2, 4, 8, 16, 32. It feels like it should be about ten — but doubling overtakes expectations very fast.'
            },
            legend: {
                task: 'How much is 5 × 4 × 2 × 0 × 3?',
                answer: 'Zero',
                why: 'A single zero in the chain wipes out the whole product, no matter how big the other numbers are.'
            }
        },
        'integer+:mul:3': {
            diamond: {
                task: 'Five people each have two pockets, and each pocket holds three coins. How many coins are there in all?',
                answer: '30',
                why: 'Pockets: 5 × 2 = 10, three coins in each: 10 × 3 = 30. Three factors can be multiplied in any order.'
            },
            legend: {
                task: 'Which is bigger: 12 × 8 or 16 × 6?',
                answer: 'Equal, both make 96',
                why: 'In the second one factor grew, but the other shrank by exactly as much — the product did not change.'
            }
        },
        'integer+:mul:4': {
            diamond: {
                task: 'How much is 25 × 4? And 25 × 8?',
                answer: '100 and 200',
                why: 'Four quarters make exactly a hundred, and eight make twice that. 25 and 4 are worth remembering as a pair: they give a round number.'
            },
            legend: {
                task: 'How do you multiply 18 by 5 quickly, without doing it on paper?',
                answer: '90',
                why: 'Multiply by 10 and halve: 18 × 10 = 180, half of that is 90. Multiplying by 5 is always easier through ten.'
            }
        },
        'integer+:mul:5': {
            diamond: {
                task: 'How do you multiply 99 by 7 in your head?',
                answer: '693',
                why: 'Treat 99 as a hundred minus one: 100 × 7 = 700, then take off the seven extra — 700 − 7 = 693.'
            },
            legend: {
                task: 'How many zeros will there be at the end of 2 × 5 × 4 × 5 × 6?',
                answer: 'Two: it makes 1200',
                why: 'Every zero at the end is born from a pair of two and five, and there are exactly two such pairs here.'
            }
        },
        // ===================== ДЕЛЕНИЕ =====================
        'integer+:div:1': {
            diamond: {
                task: 'A rope was cut into four pieces. How many cuts were made?',
                answer: 'Three',
                why: 'There is always one cut fewer than pieces: the last piece falls away with the same cut as the one before it.'
            },
            legend: {
                task: 'Six cats eat six fish in six minutes. How many minutes will six cats need to eat twelve fish?',
                answer: 'Twelve',
                why: 'Each cat eats its own fish in six minutes, so it needs six more for a second one. The number of cats does not matter at all.'
            }
        },
        'integer+:div:2': {
            diamond: {
                task: 'Twelve sweets were shared equally among children, and each got three. How many children were there?',
                answer: 'Four',
                why: 'Division also answers “how many times three fits into twelve” — and that is the number of children.'
            },
            legend: {
                task: 'Half of a number is 8. What is a quarter of it?',
                answer: 'Four',
                why: 'The number itself is 16, but you do not need it: a quarter is half of a half, so 8 ÷ 2 = 4.'
            }
        },
        'integer+:div:3': {
            diamond: {
                task: 'There are 20 apples in a basket. Half were given away, then half of what was left. How many apples remain?',
                answer: 'Five',
                why: 'After the first giving 10 were left, after the second half of ten. Each time the half is taken from what is there now.'
            },
            legend: {
                task: 'Which is bigger: 100 ÷ 4 or 100 ÷ 5?',
                answer: '100 ÷ 4 = 25, more than 20',
                why: 'The bigger the number you divide by, the less each one gets — with the divisor the result goes the other way.'
            }
        },
        'integer+:div:4': {
            diamond: {
                task: 'How many times does 8 fit into 100, and what is left over?',
                answer: '12 times, remainder 4',
                why: 'Twelve eights make 96, four short of a hundred, and a thirteenth eight no longer fits.'
            },
            legend: {
                task: 'A number was divided by 5 and gave 5. What comes out if the same number is divided by 25?',
                answer: 'One',
                why: 'The number itself is 25, but you need not work it out: the divisor grew five times, so the result shrank by the same five.'
            }
        },
        'integer+:div:5': {
            diamond: {
                task: 'How do you divide 300 by 25 quickly?',
                answer: 'Twelve',
                why: 'There are four quarters in a hundred, so in three hundreds there are 4 × 3 = 12. Dividing by 25 is easiest through hundreds.'
            },
            legend: {
                task: 'A division gave a quotient of 8. What will the quotient be if the dividend is doubled and the divisor left as it was?',
                answer: 'Sixteen',
                why: 'The dividend grew twice, the divisor did not change — so the result grew exactly twice as well, whatever the numbers were.'
            }
        }
    },
    fr: {
        // ===================== СЛОЖЕНИЕ =====================
        'integer+:add:1': {
            diamond: {
                task: 'On a déplacé une pomme du premier panier vers le second — et maintenant les deux en ont autant. Combien le premier en avait-il de plus ?',
                answer: 'Deux',
                why: 'La pomme a quitté un panier et rejoint l’autre, donc l’écart s’est refermé de deux d’un coup : 5 et 3 sont devenus 4 et 4.'
            },
            legend: {
                task: 'Pense à un nombre. Ajoute 5, puis encore 5, puis retire 10. Qu’obtiens-tu ?',
                answer: 'Le nombre choisi',
                why: 'Tu as ajouté 10 et retiré 10 — l’addition et la soustraction se sont annulées, et le nombre est revenu.'
            }
        },
        'integer+:add:2': {
            diamond: {
                task: 'La somme de deux nombres est 20, et l’un dépasse l’autre de 4. Quels sont ces nombres ?',
                answer: '12 et 8',
                why: 'Retire l’écart : il reste 16, soit deux moitiés égales de 8. Rends l’écart au plus grand : 8 + 4 = 12.'
            },
            legend: {
                task: 'Combien font 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 ?',
                answer: '55',
                why: 'N’additionne pas dans l’ordre : associe les extrémités. 1 + 10 = 11, 2 + 9 = 11, et ainsi cinq paires. Cinq fois 11 font 55.'
            }
        },
        'integer+:add:3': {
            diamond: {
                task: 'Un immeuble a cinq étages, avec une volée d’escalier entre deux étages voisins. Combien de volées du premier au cinquième ?',
                answer: 'Quatre',
                why: 'Il y a toujours une volée de moins que d’étages : ce qu’on compte, ce sont les intervalles, pas les étages.'
            },
            legend: {
                task: 'Trois nombres qui se suivent ont pour somme 33. Lesquels sont-ils ?',
                answer: '10, 11 et 12',
                why: 'Le nombre du milieu vaut le tiers de la somme : 33 ÷ 3 = 11. Les voisins l’encadrent, et leur surplus compense leur manque.'
            }
        },
        'integer+:add:4': {
            diamond: {
                task: 'Comment calculer vite 99 + 99 + 99, sans poser l’opération ?',
                answer: '297',
                why: 'Chaque 99 est une centaine moins un. Trois centaines font 300, puis on retire les trois unités : 300 − 3 = 297.'
            },
            legend: {
                task: 'Combien font 1 + 2 + 4 + 8 + 16 + 32 + 64 ?',
                answer: '127',
                why: 'Chaque nombre suivant vaut la somme de tous les précédents plus un, donc le total, c’est 128 moins une unité.'
            }
        },
        'integer+:add:5': {
            diamond: {
                task: 'Additionne tous les nombres de 1 à 100. Combien cela fait-il ?',
                answer: '5050',
                why: 'Les paires prises aux extrémités donnent toujours la même chose : 1 + 100 = 101, 2 + 99 = 101. Cinquante paires, donc 50 × 101 = 5050.'
            },
            legend: {
                task: 'Quatre personnes sont dans une pièce et chacune a serré la main de chacune, une seule fois. Combien de poignées de main ?',
                answer: 'Six',
                why: 'La première en serre trois, la deuxième les deux qui restent, la troisième la dernière : 3 + 2 + 1 = 6. On compte des paires, pas des personnes.'
            }
        },
        // ===================== ВЫЧИТАНИЕ =====================
        'integer+:sub:1': {
            diamond: {
                task: 'Tu avais 10 bonbons. Tu en as mangé quelques-uns, il en restait 4. Puis on t’en a donné, et tu en as de nouveau 10. Combien t’en a-t-on donné ?',
                answer: 'Six',
                why: 'Exactement autant que tu en as mangé : pour revenir au nombre de départ, il faut rendre ce qu’on a enlevé.'
            },
            legend: {
                task: 'On a retiré 3 à un nombre, puis encore 3 — il reste 4. Quel était ce nombre au départ ?',
                answer: '10',
                why: 'Remonte en arrière : il reste 4, rends les deux 3 — 4 + 3 + 3 = 10. En marche arrière, la soustraction devient une addition.'
            }
        },
        'integer+:sub:2': {
            diamond: {
                task: 'Une corde de 20 mètres a été coupée en deux, et un morceau fait 4 mètres de plus. Combien mesure chaque morceau ?',
                answer: '12 et 8 mètres',
                why: 'Mets l’écart de côté : il reste 16 pour deux morceaux égaux de 8. Rends l’écart au plus long : 8 + 4 = 12.'
            },
            legend: {
                task: 'Combien de nombres entiers se trouvent entre 7 et 15 ?',
                answer: 'Sept : de 8 à 14',
                why: 'La différence 15 − 7 = 8 compte les intervalles, et les nombres entre les bornes sont un de moins.'
            }
        },
        'integer+:sub:3': {
            diamond: {
                task: 'On a diminué un nombre de 10, puis encore de 20 — il reste 30. Quel était-il ?',
                answer: '60',
                why: 'En tout on a retiré 30, donc c’était 30 + 30 = 60. Deux soustractions de suite se regroupent en une seule.'
            },
            legend: {
                task: 'Quel âge a une personne si, dans 10 ans, elle aura l’âge qu’elle avait il y a 10 ans plus 20 ?',
                answer: 'N’importe lequel : toujours vrai',
                why: 'Dans dix ans, on a vingt ans de plus qu’il y a dix ans — c’est la même chose dite deux fois.'
            }
        },
        'integer+:sub:4': {
            diamond: {
                task: 'On a retiré 1 à 100, puis 2 au résultat, puis 3, puis 4. Que reste-t-il ?',
                answer: '90',
                why: 'Retirer l’un après l’autre revient à retirer la somme : 1 + 2 + 3 + 4 = 10, et 100 − 10 = 90.'
            },
            legend: {
                task: 'La différence de deux nombres est 15, et leur somme 45. Quels sont-ils ?',
                answer: '30 et 15',
                why: 'La somme sans l’écart, ce sont deux fois le plus petit : 45 − 15 = 30, donc le petit vaut 15 et le grand 15 + 15 = 30.'
            }
        },
        'integer+:sub:5': {
            diamond: {
                task: 'Comment calculer vite 1000 − 387 de tête ?',
                answer: '613',
                why: 'Soustrais par morceaux : 1000 − 300 = 700, puis − 80 = 620, puis − 7 = 613. Un rang à la fois, c’est plus simple que tout d’un coup.'
            },
            legend: {
                task: 'Combien font 100 − 99 + 98 − 97 + 96 − 95 + … + 2 − 1 ?',
                answer: '50',
                why: 'Découpe en paires : 100 − 99 = 1, 98 − 97 = 1, et ainsi de suite. Il y a exactement cinquante paires, chacune donnant un.'
            }
        },
        // ===================== УМНОЖЕНИЕ =====================
        'integer+:mul:1': {
            diamond: {
                task: 'Combien de pattes ont en tout trois chats et deux oiseaux ?',
                answer: '16',
                why: 'Les chats en ont quatre : 3 × 4 = 12. Les oiseaux en ont deux : 2 × 2 = 4. En tout 16 — il faut compter à part, les animaux n’ont pas le même nombre de pattes.'
            },
            legend: {
                task: 'On a plié une feuille en deux, trois fois de suite. Combien de couches obtient-on ?',
                answer: 'Huit',
                why: 'Chaque pli double : 2, 4, 8. Ni 3 ni 6 — doubler grandit plus vite qu’ajouter.'
            }
        },
        'integer+:mul:2': {
            diamond: {
                task: 'On a plié une feuille en deux, cinq fois de suite. Combien de couches obtient-on ?',
                answer: '32',
                why: 'Cinq doublements d’affilée : 2, 4, 8, 16, 32. On croirait arriver à une dizaine — mais doubler dépasse très vite ce qu’on imagine.'
            },
            legend: {
                task: 'Combien font 5 × 4 × 2 × 0 × 3 ?',
                answer: 'Zéro',
                why: 'Un seul zéro dans la chaîne annule tout le produit, quels que soient les grands nombres à côté.'
            }
        },
        'integer+:mul:3': {
            diamond: {
                task: 'Cinq personnes ont chacune deux poches, et chaque poche contient trois pièces. Combien de pièces en tout ?',
                answer: '30',
                why: 'Les poches font 5 × 2 = 10, avec trois pièces chacune : 10 × 3 = 30. Trois facteurs se multiplient dans l’ordre qu’on veut.'
            },
            legend: {
                task: 'Qu’est-ce qui est plus grand : 12 × 8 ou 16 × 6 ?',
                answer: 'Égaux, tous deux font 96',
                why: 'Dans le second, un facteur a grandi, mais l’autre a diminué d’autant — le produit n’a pas bougé.'
            }
        },
        'integer+:mul:4': {
            diamond: {
                task: 'Combien font 25 × 4 ? Et 25 × 8 ?',
                answer: '100 et 200',
                why: 'Quatre quarts font exactement cent, et huit en font le double. 25 et 4 méritent d’être retenus ensemble : ils donnent un compte rond.'
            },
            legend: {
                task: 'Comment multiplier vite 18 par 5, sans poser l’opération ?',
                answer: '90',
                why: 'Multiplie par 10 puis coupe en deux : 18 × 10 = 180, la moitié fait 90. Multiplier par 5 passe toujours mieux par la dizaine.'
            }
        },
        'integer+:mul:5': {
            diamond: {
                task: 'Comment multiplier 99 par 7 de tête ?',
                answer: '693',
                why: 'Prends 99 comme cent moins un : 100 × 7 = 700, puis retire les sept en trop — 700 − 7 = 693.'
            },
            legend: {
                task: 'Combien de zéros y aura-t-il à la fin de 2 × 5 × 4 × 5 × 6 ?',
                answer: 'Deux : cela fait 1200',
                why: 'Chaque zéro final naît d’une paire deux-et-cinq, et il y a ici exactement deux paires de ce genre.'
            }
        },
        // ===================== ДЕЛЕНИЕ =====================
        'integer+:div:1': {
            diamond: {
                task: 'On a coupé une corde en quatre morceaux. Combien de coupes a-t-on faites ?',
                answer: 'Trois',
                why: 'Il y a toujours une coupe de moins que de morceaux : le dernier morceau se détache avec la même coupe que l’avant-dernier.'
            },
            legend: {
                task: 'Six chats mangent six poissons en six minutes. En combien de minutes six chats mangeront-ils douze poissons ?',
                answer: 'En douze',
                why: 'Chaque chat mange son poisson en six minutes, il lui en faut donc six de plus pour un second. Le nombre de chats n’y change rien.'
            }
        },
        'integer+:div:2': {
            diamond: {
                task: 'Douze bonbons ont été partagés également entre des enfants, chacun en a reçu trois. Combien y avait-il d’enfants ?',
                answer: 'Quatre',
                why: 'La division répond aussi à « combien de fois trois tient dans douze » — et c’est justement le nombre d’enfants.'
            },
            legend: {
                task: 'La moitié d’un nombre vaut 8. Combien vaut son quart ?',
                answer: 'Quatre',
                why: 'Le nombre lui-même est 16, mais inutile de le chercher : un quart, c’est la moitié de la moitié, donc 8 ÷ 2 = 4.'
            }
        },
        'integer+:div:3': {
            diamond: {
                task: 'Il y a 20 pommes dans un panier. On en donne la moitié, puis la moitié du reste. Combien de pommes reste-t-il ?',
                answer: 'Cinq',
                why: 'Après le premier don il en restait 10, après le second la moitié de dix. Chaque fois, la moitié se prend sur ce qui reste.'
            },
            legend: {
                task: 'Qu’est-ce qui est plus grand : 100 ÷ 4 ou 100 ÷ 5 ?',
                answer: '100 ÷ 4 = 25, plus que 20',
                why: 'Plus le diviseur est grand, moins chacun reçoit — avec le diviseur, le résultat va dans l’autre sens.'
            }
        },
        'integer+:div:4': {
            diamond: {
                task: 'Combien de fois 8 tient-il dans 100, et que reste-t-il ?',
                answer: '12 fois, reste 4',
                why: 'Douze fois huit font 96, il manque quatre pour cent, et un treizième huit ne rentre plus.'
            },
            legend: {
                task: 'On a divisé un nombre par 5 et obtenu 5. Que donne le même nombre divisé par 25 ?',
                answer: 'Un',
                why: 'Le nombre est 25, mais inutile de le calculer : le diviseur a été multiplié par cinq, donc le résultat a été divisé par cinq.'
            }
        },
        'integer+:div:5': {
            diamond: {
                task: 'Comment diviser vite 300 par 25 ?',
                answer: 'Douze',
                why: 'Il y a quatre quarts dans une centaine, donc dans trois centaines il y en a 4 × 3 = 12. Diviser par 25 passe bien par les centaines.'
            },
            legend: {
                task: 'Une division a donné 8. Que devient le résultat si on double le dividende sans toucher au diviseur ?',
                answer: 'Seize',
                why: 'Le dividende a doublé, le diviseur n’a pas bougé — le résultat a donc doublé aussi, quels que soient les nombres.'
            }
        }
    },
    de: {
        // ===================== СЛОЖЕНИЕ =====================
        'integer+:add:1': {
            diamond: {
                task: 'Aus dem ersten Korb wurde ein Apfel in den zweiten gelegt — und jetzt sind es gleich viele. Wie viele Äpfel hatte der erste Korb mehr?',
                answer: 'Zwei',
                why: 'Der Apfel ging aus dem einen Korb in den anderen, deshalb schrumpfte der Abstand gleich um zwei: aus 5 und 3 wurden 4 und 4.'
            },
            legend: {
                task: 'Denk dir eine Zahl. Addiere 5, dann noch einmal 5, dann ziehe 10 ab. Was kommt heraus?',
                answer: 'Die gedachte Zahl',
                why: 'Du hast 10 addiert und 10 abgezogen — Plus und Minus haben sich aufgehoben, und die Zahl ist wieder da.'
            }
        },
        'integer+:add:2': {
            diamond: {
                task: 'Zwei Zahlen ergeben zusammen 20, und eine ist um 4 größer. Welche sind es?',
                answer: '12 und 8',
                why: 'Nimm den Abstand weg, dann bleiben 16 — zwei gleiche Hälften zu 8. Gib den Abstand der größeren zurück: 8 + 4 = 12.'
            },
            legend: {
                task: 'Wie viel ist 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10?',
                answer: '55',
                why: 'Addiere nicht der Reihe nach, sondern paarweise von außen: 1 + 10 = 11, 2 + 9 = 11, so fünf Paare. Fünfmal 11 sind 55.'
            }
        },
        'integer+:add:3': {
            diamond: {
                task: 'Ein Haus hat fünf Stockwerke, zwischen benachbarten liegt je eine Treppe. Wie viele Treppen vom ersten zum fünften?',
                answer: 'Vier',
                why: 'Es sind immer eine Treppe weniger als Stockwerke: gezählt werden die Zwischenräume, nicht die Stockwerke selbst.'
            },
            legend: {
                task: 'Drei aufeinanderfolgende Zahlen ergeben zusammen 33. Welche sind es?',
                answer: '10, 11 und 12',
                why: 'Die mittlere Zahl ist ein Drittel der Summe: 33 ÷ 3 = 11. Die Nachbarn stehen daneben, ihr Mehr und ihr Weniger gleichen sich aus.'
            }
        },
        'integer+:add:4': {
            diamond: {
                task: 'Wie rechnest du 99 + 99 + 99 schnell im Kopf, ohne schriftlich zu addieren?',
                answer: '297',
                why: 'Jede 99 ist hundert weniger eins. Drei Hunderter sind 300, davon die drei Einer weg: 300 − 3 = 297.'
            },
            legend: {
                task: 'Wie viel ist 1 + 2 + 4 + 8 + 16 + 32 + 64?',
                answer: '127',
                why: 'Jede nächste Zahl ist so groß wie alle vorherigen zusammen plus eins, also ist die ganze Summe 128 weniger eins.'
            }
        },
        'integer+:add:5': {
            diamond: {
                task: 'Addiere alle Zahlen von 1 bis 100. Was kommt heraus?',
                answer: '5050',
                why: 'Paare von außen ergeben immer dasselbe: 1 + 100 = 101, 2 + 99 = 101. Solcher Paare gibt es fünfzig, also 50 × 101 = 5050.'
            },
            legend: {
                task: 'Vier Leute sind im Raum, und jeder hat jedem genau einmal die Hand gegeben. Wie viele Händedrücke waren das?',
                answer: 'Sechs',
                why: 'Der Erste gibt dreien die Hand, der Zweite den zwei übrigen, der Dritte dem Letzten: 3 + 2 + 1 = 6. Gezählt werden Paare, nicht Personen.'
            }
        },
        // ===================== ВЫЧИТАНИЕ =====================
        'integer+:sub:1': {
            diamond: {
                task: 'Du hattest 10 Bonbons. Du hast einige gegessen, 4 blieben übrig. Dann bekamst du welche dazu, und es waren wieder 10. Wie viele hast du bekommen?',
                answer: 'Sechs',
                why: 'Genau so viele, wie du gegessen hast: um zur alten Zahl zurückzukommen, muss man dasselbe wieder dazugeben.'
            },
            legend: {
                task: 'Von einer Zahl wurde 3 abgezogen, dann noch einmal 3 — heraus kam 4. Wie hieß die Zahl am Anfang?',
                answer: '10',
                why: 'Geh rückwärts: 4 ist übrig, gib beide Dreien zurück — 4 + 3 + 3 = 10. Rückwärts wird aus Minus immer Plus.'
            }
        },
        'integer+:sub:2': {
            diamond: {
                task: 'Ein 20 Meter langes Seil wurde in zwei Stücke geschnitten, eines ist 4 Meter länger. Wie lang sind die Stücke?',
                answer: '12 und 8 Meter',
                why: 'Leg den Unterschied beiseite: es bleiben 16 für zwei gleiche Stücke zu 8. Gib den Unterschied dem längeren zurück: 8 + 4 = 12.'
            },
            legend: {
                task: 'Wie viele ganze Zahlen liegen zwischen 7 und 15?',
                answer: 'Sieben: von 8 bis 14',
                why: 'Die Differenz 15 − 7 = 8 zählt die Zwischenräume, und die Zahlen dazwischen sind eine weniger.'
            }
        },
        'integer+:sub:3': {
            diamond: {
                task: 'Eine Zahl wurde um 10 verkleinert, dann noch um 20 — heraus kam 30. Wie hieß sie?',
                answer: '60',
                why: 'Insgesamt wurden 30 abgezogen, also war es 30 + 30 = 60. Zwei Abzüge hintereinander lassen sich zu einem zusammenfassen.'
            },
            legend: {
                task: 'Wie alt ist jemand jetzt, wenn er in 10 Jahren so alt ist wie vor 10 Jahren plus 20?',
                answer: 'Jedes Alter: es stimmt immer',
                why: 'In zehn Jahren ist man zwanzig Jahre älter als vor zehn Jahren — das ist einfach zweimal dasselbe gesagt.'
            }
        },
        'integer+:sub:4': {
            diamond: {
                task: 'Von 100 wurde 1 abgezogen, vom Ergebnis 2, dann 3, dann 4. Was bleibt übrig?',
                answer: '90',
                why: 'Nacheinander abziehen ist dasselbe wie die Summe abziehen: 1 + 2 + 3 + 4 = 10, und 100 − 10 = 90.'
            },
            legend: {
                task: 'Die Differenz zweier Zahlen ist 15, ihre Summe 45. Welche sind es?',
                answer: '30 und 15',
                why: 'Die Summe ohne den Unterschied sind zweimal die kleinere Zahl: 45 − 15 = 30, also ist die kleinere 15 und die größere 15 + 15 = 30.'
            }
        },
        'integer+:sub:5': {
            diamond: {
                task: 'Wie rechnest du 1000 − 387 schnell im Kopf?',
                answer: '613',
                why: 'Zieh in Schritten ab: 1000 − 300 = 700, dann − 80 = 620, dann − 7 = 613. Stelle für Stelle ist leichter als alles auf einmal.'
            },
            legend: {
                task: 'Wie viel ist 100 − 99 + 98 − 97 + 96 − 95 + … + 2 − 1?',
                answer: '50',
                why: 'Teile es in Paare: 100 − 99 = 1, 98 − 97 = 1, und so weiter. Es sind genau fünfzig Paare, jedes ergibt eins.'
            }
        },
        // ===================== УМНОЖЕНИЕ =====================
        'integer+:mul:1': {
            diamond: {
                task: 'Wie viele Beine haben drei Katzen und zwei Vögel zusammen?',
                answer: '16',
                why: 'Katzen haben je vier: 3 × 4 = 12. Vögel je zwei: 2 × 2 = 4. Zusammen 16 — getrennt zählen, verschiedene Tiere haben verschiedene Beine.'
            },
            legend: {
                task: 'Ein Blatt Papier wurde dreimal in der Mitte gefaltet. Wie viele Lagen sind es?',
                answer: 'Acht',
                why: 'Jede Faltung verdoppelt: 2, 4, 8. Nicht 3 und nicht 6 — Verdoppeln wächst schneller als Addieren.'
            }
        },
        'integer+:mul:2': {
            diamond: {
                task: 'Ein Blatt Papier wurde fünfmal in der Mitte gefaltet. Wie viele Lagen sind es?',
                answer: '32',
                why: 'Fünfmal verdoppelt: 2, 4, 8, 16, 32. Man tippt auf etwa zehn — aber Verdoppeln überholt die Erwartung sehr schnell.'
            },
            legend: {
                task: 'Wie viel ist 5 × 4 × 2 × 0 × 3?',
                answer: 'Null',
                why: 'Eine einzige Null in der Kette macht das ganze Produkt zunichte, egal wie groß die anderen Zahlen sind.'
            }
        },
        'integer+:mul:3': {
            diamond: {
                task: 'Fünf Leute haben je zwei Taschen, und in jeder Tasche sind drei Münzen. Wie viele Münzen sind es insgesamt?',
                answer: '30',
                why: 'Taschen: 5 × 2 = 10, in jeder drei: 10 × 3 = 30. Drei Faktoren darf man in beliebiger Reihenfolge multiplizieren.'
            },
            legend: {
                task: 'Was ist größer: 12 × 8 oder 16 × 6?',
                answer: 'Gleich, beide ergeben 96',
                why: 'Beim zweiten ist ein Faktor gewachsen, dafür der andere genauso geschrumpft — das Produkt blieb gleich.'
            }
        },
        'integer+:mul:4': {
            diamond: {
                task: 'Wie viel ist 25 × 4? Und 25 × 8?',
                answer: '100 und 200',
                why: 'Vier Viertel ergeben genau hundert, acht das Doppelte. 25 und 4 merkt man sich am besten als Paar: sie geben eine runde Zahl.'
            },
            legend: {
                task: 'Wie multiplizierst du 18 mit 5 schnell im Kopf?',
                answer: '90',
                why: 'Mal 10 und dann halbieren: 18 × 10 = 180, die Hälfte ist 90. Mal 5 geht immer leichter über die Zehn.'
            }
        },
        'integer+:mul:5': {
            diamond: {
                task: 'Wie multiplizierst du 99 mit 7 im Kopf?',
                answer: '693',
                why: 'Nimm 99 als hundert weniger eins: 100 × 7 = 700, dann die sieben zu viel weg — 700 − 7 = 693.'
            },
            legend: {
                task: 'Wie viele Nullen stehen am Ende von 2 × 5 × 4 × 5 × 6?',
                answer: 'Zwei: es ergibt 1200',
                why: 'Jede Null am Ende entsteht aus einem Paar aus Zwei und Fünf, und davon gibt es hier genau zwei.'
            }
        },
        // ===================== ДЕЛЕНИЕ =====================
        'integer+:div:1': {
            diamond: {
                task: 'Ein Seil wurde in vier Stücke geschnitten. Wie viele Schnitte waren nötig?',
                answer: 'Drei',
                why: 'Es sind immer ein Schnitt weniger als Stücke: das letzte Stück trennt sich mit demselben Schnitt wie das vorletzte.'
            },
            legend: {
                task: 'Sechs Katzen fressen sechs Fische in sechs Minuten. In wie vielen Minuten fressen sechs Katzen zwölf Fische?',
                answer: 'In zwölf',
                why: 'Jede Katze frisst ihren Fisch in sechs Minuten, für den zweiten braucht sie noch einmal sechs. Die Anzahl der Katzen spielt gar keine Rolle.'
            }
        },
        'integer+:div:2': {
            diamond: {
                task: 'Zwölf Bonbons wurden gleichmäßig unter Kindern verteilt, jedes bekam drei. Wie viele Kinder waren es?',
                answer: 'Vier',
                why: 'Das Teilen beantwortet auch die Frage, wie oft drei in zwölf passt — und genau das ist die Anzahl der Kinder.'
            },
            legend: {
                task: 'Die Hälfte einer Zahl ist 8. Wie groß ist ihr Viertel?',
                answer: 'Vier',
                why: 'Die Zahl selbst ist 16, aber die braucht man gar nicht: ein Viertel ist die Hälfte der Hälfte, also 8 ÷ 2 = 4.'
            }
        },
        'integer+:div:3': {
            diamond: {
                task: 'Im Korb liegen 20 Äpfel. Die Hälfte wurde verschenkt, dann die Hälfte vom Rest. Wie viele Äpfel bleiben?',
                answer: 'Fünf',
                why: 'Nach dem ersten Mal blieben 10, nach dem zweiten die Hälfte von zehn. Die Hälfte nimmt man jedes Mal von dem, was gerade da ist.'
            },
            legend: {
                task: 'Was ist größer: 100 ÷ 4 oder 100 ÷ 5?',
                answer: '100 ÷ 4 = 25, mehr als 20',
                why: 'Je größer die Zahl, durch die man teilt, desto weniger bekommt jeder — beim Teiler läuft das Ergebnis andersherum.'
            }
        },
        'integer+:div:4': {
            diamond: {
                task: 'Wie oft passt die 8 in 100, und was bleibt übrig?',
                answer: '12-mal, Rest 4',
                why: 'Zwölf Achten sind 96, bis hundert fehlen vier, und eine dreizehnte Acht passt nicht mehr hinein.'
            },
            legend: {
                task: 'Eine Zahl wurde durch 5 geteilt und ergab 5. Was kommt heraus, wenn man dieselbe Zahl durch 25 teilt?',
                answer: 'Eins',
                why: 'Die Zahl ist 25, aber rechnen muss man das nicht: der Teiler wurde fünfmal so groß, also wurde das Ergebnis fünfmal so klein.'
            }
        },
        'integer+:div:5': {
            diamond: {
                task: 'Wie teilst du 300 schnell durch 25?',
                answer: 'Zwölf',
                why: 'In hundert stecken vier Viertel, in dreihundert also 4 × 3 = 12. Durch 25 teilt man am leichtesten über die Hunderter.'
            },
            legend: {
                task: 'Eine Division ergab 8. Was wird daraus, wenn man den Dividenden verdoppelt und den Divisor lässt?',
                answer: 'Sechzehn',
                why: 'Der Dividend wurde doppelt so groß, der Divisor blieb gleich — also wurde auch das Ergebnis genau doppelt so groß, egal welche Zahlen dastanden.'
            }
        }
    }
};
