// Подсказки по видам ошибок — содержимое, а не код.
//
// Показываются в двух местах: короткой строкой прямо в игре (время на этот момент
// заморожено) и подробнее — в разборе ошибок в конце миссии.
//
// Ключ — код вида ошибки из classifyMistake, при необходимости с уточнением действия
// через двоеточие: 'ошибка в десятках:add'. Поиск идёт сначала по ключу с действием,
// потом по ключу без него. Коды видов — идентификаторы базы, их НЕЛЬЗЯ переводить и
// переименовывать; переводятся только тексты.
//
// %1, %2… — подстановки из того самого примера, на котором ученик споткнулся. Порядок
// аргументов задан в hintArgs() в index.html и ОДИНАКОВ для всех языков; менять его
// можно только там и здесь одновременно:
//
//   ошибка в десятках:add   game —            review a, b, ед1, ед2, ед1+ед2, последняя цифра суммы
//   ошибка в десятках:sub   game —            review a, b
//   ошибка в десятках:mul   game промах, a, b            review a, b, верный ответ, что выбрал
//   ошибка в десятках:div   game что выбрал, b, их произведение, a
//                           review a, b, верный ответ, что выбрал, что выбрал × b
//   ошибка в единицах:add   game ед1, ед2     review a, b, ед1, ед2, ед1+ед2, последняя цифра суммы
//   ошибка в единицах:sub   game —            review a, b, последняя цифра ответа
//   не занял десяток        game ед1, ед2, ед1+10          review a, b, ед1, ед2, ед1+10, ед1+10−ед2
//   таблица умножения       game взятое1, взятое2, a, b, разница
//                           review взятое1, взятое2, что вышло, a, b, верный ответ
//   сложил вместо умножения game a, b, «21 раз»   review a, b, верный ответ, a+b, «21 раз»
//   перепутал действие:*    game —            review a, b, верный ответ, что посчитал
//   взял одно из чисел      game a, b         review a, b, верный ответ
//   делил на ноль           game —            review a
//   ошибся на единицу       game —            review что выбрал, верный ответ
//   ошибся на единицу:div   game и review одинаково: верный ответ, b, a,
//                           что выбрал, что выбрал × b
//   промахнулся рядом       game —            review что выбрал, верный ответ
//   оба разряда мимо        game —            review что выбрал, верный ответ,
//                                                    единицы ответа, десятки ответа
//   не умножил десятки      game меньший множитель, единицы большего
//                           review меньший, единицы большего, их произведение,
//                                  десятки большего, второе произведение, верный ответ
//   нет решения зря         game делитель     review a, b, верный ответ

window.HINT_CONTENT = {
    ru: {
        'ноль в примере:mul': {
            game: 'Сложи %1 — получится ноль.',
            review: '%1 × %2 = 0. Умножение — это сложение одинаковых чисел: сколько нулей ни сложи, будет ноль. Поэтому ноль в умножении всегда даёт ноль.'
        },
        'ноль в примере:div': {
            game: 'Ноль раздели на что угодно — останется ноль.',
            review: '%1 ÷ %2 = 0: ноль сколько ни дели, в каждой части будет ноль. Делить ноль можно — нельзя делить НА ноль, это разные вещи.'
        },
        'ошибка в десятках:add': {
            game: 'Мимо ровно на десяток. Единицы верные — пересчитай десятки.',
            review: '%1 + %2: единицы дают %3 + %4 = %5 — это %6 и ещё целый десяток сверх того. Промах ровно на десяток почти всегда значит, что про этот десяток забыли.'
        },
        'ошибка в десятках:sub': {
            game: 'Мимо ровно на десяток. Единицы верные — пересчитай десятки.',
            review: '%1 − %2: единицы сошлись, а десяток, который занимали, потерялся по дороге. Промах ровно на десяток почти всегда значит именно это — проверь, сколько десятков осталось.'
        },
        'ошибка в десятках:mul': {
            game: 'Единицы сошлись, а десятки — нет: мимо на %1. Пересчитай %2 × %3.',
            review: '%1 × %2 = %3, а выбрано %4. Последняя цифра сошлась, значит промах ровно на десятки — посчитай ещё раз и прикинь, сколько примерно должно выйти.'
        },
        'ошибка в десятках:div': {
            game: 'Мимо ровно на десяток: %1 × %2 = %3, а не %4.',
            review: '%1 ÷ %2 = %3, ведь %3 × %2 = %1. А %4 × %2 = %5 — мимо. Деление всегда можно проверить умножением.'
        },
        'ошибка в единицах:add': {
            game: 'Десятки сошлись. Посчитай отдельно %1 + %2.',
            review: '%1 + %2: последние цифры дают %3 + %4 = %5 — значит ответ кончается на %6. Последнюю цифру можно найти сразу, не считая всё остальное, и проверить её проще всего.'
        },
        'ошибка в единицах:sub': {
            game: 'Десятки сошлись. Проверь последнюю цифру.',
            review: '%1 − %2: ответ кончается на %3. Последнюю цифру можно найти отдельно от всего остального — это самая быстрая проверка.'
        },
        'не занял десяток': {
            game: 'Из %1 не вычесть %2. Займи десяток: %3 − %2.',
            review: '%1 − %2: из %3 число %4 не вычесть, поэтому берём десяток у соседа — %5 − %4 = %6, а десятков остаётся на один меньше.'
        },
        'таблица умножения': {
            game: 'Это %1 × %2, а в примере %3 × %4. Разница — целых %5.',
            review: '%1 × %2 = %3, а %4 × %5 = %6. Соседние строчки таблицы отличаются сразу на целое число, а не на единицу — потому разница и вышла такой большой.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2 — это %1, взятое %3, а не %1 + %2.',
            review: '%1 × %2 = %3: это %1, взятое %5. Умножение — короткая запись сложения одинаковых чисел, поэтому ответ намного больше суммы %1 + %2 = %4.'
        },
        'перепутал действие:add': {
            game: 'Это вычитание, а в примере сложение.',
            review: 'С теми же числами знак решает всё: %1 + %2 = %3, а %1 − %2 = %4. Сначала посмотри на знак, потом на числа.'
        },
        'перепутал действие:sub': {
            game: 'Это сложение, а в примере вычитание.',
            review: 'С теми же числами знак решает всё: %1 − %2 = %3, а %1 + %2 = %4. Сначала посмотри на знак, потом на числа.'
        },
        'перепутал действие:mul': {
            game: 'Это деление, а в примере умножение.',
            review: 'С теми же числами знак решает всё: %1 × %2 = %3, а %1 ÷ %2 = %4. Сначала посмотри на знак, потом на числа.'
        },
        'перепутал действие:div': {
            game: 'Это умножение, а в примере деление.',
            review: 'С теми же числами знак решает всё: %1 ÷ %2 = %3, а %1 × %2 = %4. Сначала посмотри на знак, потом на числа.'
        },
        'взял одно из чисел': {
            game: '%1 ÷ %2 — сколько раз %2 помещается в %1?',
            review: 'Деление отвечает на вопрос «сколько раз одно помещается в другом». %1 ÷ %2 = %3 — столько раз %2 помещается в %1. Ответ всегда меньше %1, поэтому число из самого примера ответом быть не может.'
        },
        'делил на ноль': {
            game: 'На ноль не делят — верный ответ «нет решения».',
            review: '%1 ÷ 0 просит найти число, которое при умножении на 0 даст %1. Такого нет: ноль на что ни умножь — будет ноль. Поэтому ответа нет, и это правило, а не ловушка.'
        },
        'ошибся на единицу': {
            game: 'Мимо всего на единицу. Досчитай последний шаг ещё раз.',
            review: 'Ответ был рядом: %1 вместо %2. Последний шаг часто делают на автомате и теряют на нём единицу. Досчитать его отдельно — полсекунды.'
        },
        'ошибся на единицу:div': {
            game: 'Проверь умножением: %1 × %2 = %3, а %4 × %2 = %5.',
            review: '%1 × %2 = %3, а %4 × %2 = %5. Деление проверяют умножением — полсекунды, и промах на единицу виден сразу.'
        },
        'промахнулся рядом': {
            game: 'Ответ рядом — значит счёт верный, а последний шаг сбился.',
            review: 'Выбрано %1, верный ответ %2. Промах на два-три — это не незнание, а сбитый счёт: один шаг потерялся или посчитался дважды. Помогает досчитать последний шаг вслух — тогда он не теряется.'
        },
        'оба разряда мимо': {
            game: 'Не сошлась ни одна цифра. Считай разряды по очереди.',
            review: 'Выбрано %1, верный ответ %2: не сошлись ни единицы, ни десятки. Считать надо по одному разряду: сначала единицы — их должно быть %3, потом десятки — их %4. Когда берутся за оба сразу, промахиваются в обоих.'
        },
        'не умножил десятки': {
            game: 'Посчитано только %1 × %2. У второго числа есть ещё десятки.',
            review: '%1 × %2 = %3 — это только единицы. Остаётся %1 × %4 = %5, и вместе получается %6. Двузначное умножают по частям и складывают: пропустишь вторую часть — потеряешь её целиком.'
        },
        'нет решения зря': {
            game: 'Здесь делят не на ноль — на %1 делить можно.',
            review: '%1 ÷ %2 = %3. Правило запрещает только деление НА ноль, то есть когда ноль стоит вторым. Здесь второе число %2, и ответ есть. Ноль в примере сам по себе ничего не запрещает — важно, на каком он месте.'
        }
    },

    en: {
        'ноль в примере:mul': {
            game: 'Add up %1 — you still get zero.',
            review: '%1 × %2 = 0. Multiplication is adding the same number again and again: however many zeros you add, you get zero. That is why a zero in a multiplication always gives zero.'
        },
        'ноль в примере:div': {
            game: 'Divide zero by anything — it stays zero.',
            review: '%1 ÷ %2 = 0: however many parts you split zero into, each part is zero. Dividing zero is allowed — what you cannot do is divide BY zero, and those are two different things.'
        },
        'ошибка в десятках:add': {
            game: 'Off by exactly ten. The units are right — count the tens again.',
            review: '%1 + %2: the units give %3 + %4 = %5 — that is %6 and a whole ten on top. Being off by exactly ten almost always means that ten was forgotten.'
        },
        'ошибка в десятках:sub': {
            game: 'Off by exactly ten. The units are right — count the tens again.',
            review: '%1 − %2: the units came out right, but the ten that was borrowed got lost on the way. Off by exactly ten almost always means just that — check how many tens are left.'
        },
        'ошибка в десятках:mul': {
            game: 'Units match, tens don\'t: off by %1. Redo %2 × %3.',
            review: '%1 × %2 = %3, and %4 was chosen. The last digit matches, so the miss is a whole number of tens — count it again and estimate roughly what it should be.'
        },
        'ошибка в десятках:div': {
            game: 'Off by exactly ten: %1 × %2 = %3, not %4.',
            review: '%1 ÷ %2 = %3, because %3 × %2 = %1. And %4 × %2 = %5 — off. Division can always be checked by multiplying.'
        },
        'ошибка в единицах:add': {
            game: 'The tens are right. Work out %1 + %2 on its own.',
            review: '%1 + %2: the last digits give %3 + %4 = %5, so the answer ends in %6. The last digit can be found straight away, without working out the rest, and it is the easiest thing to check.'
        },
        'ошибка в единицах:sub': {
            game: 'The tens are right. Check the last digit.',
            review: '%1 − %2: the answer ends in %3. The last digit can be found on its own, apart from everything else — that is the quickest check.'
        },
        'не занял десяток': {
            game: 'You cannot take %2 from %1. Borrow a ten: %3 − %2.',
            review: '%1 − %2: %4 will not come out of %3, so you borrow a ten from the neighbour — %5 − %4 = %6, and one ten fewer is left.'
        },
        'таблица умножения': {
            game: 'You worked out %1 × %2. The problem says %3 × %4 — a whole %5 apart.',
            review: '%1 × %2 = %3, while %4 × %5 = %6. Neighbouring rows of the table are a whole number apart, not one — that is why the gap here came out so big.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2 means %1 taken %3, not %1 + %2.',
            review: '%1 × %2 = %3: that is %1 taken %5. Multiplication is shorthand for adding the same number again and again, so the answer is far bigger than the sum %1 + %2 = %4.'
        },
        'перепутал действие:add': {
            game: 'You subtracted, but the problem is addition.',
            review: 'With the same numbers the sign decides everything: %1 + %2 = %3, while %1 − %2 = %4. Look at the sign before you look at the numbers.'
        },
        'перепутал действие:sub': {
            game: 'You added, but the problem is subtraction.',
            review: 'With the same numbers the sign decides everything: %1 − %2 = %3, while %1 + %2 = %4. Look at the sign before you look at the numbers.'
        },
        'перепутал действие:mul': {
            game: 'You divided, but the problem is multiplication.',
            review: 'With the same numbers the sign decides everything: %1 × %2 = %3, while %1 ÷ %2 = %4. Look at the sign before you look at the numbers.'
        },
        'перепутал действие:div': {
            game: 'You multiplied, but the problem is division.',
            review: 'With the same numbers the sign decides everything: %1 ÷ %2 = %3, while %1 × %2 = %4. Look at the sign before you look at the numbers.'
        },
        'взял одно из чисел': {
            game: '%1 ÷ %2 — how many times does %2 fit into %1?',
            review: 'Division answers the question "how many times does one fit into the other". %1 ÷ %2 = %3 — that is how many times %2 fits into %1. The answer is always smaller than %1, so a number from the problem itself cannot be it.'
        },
        'делил на ноль': {
            game: 'You cannot divide by zero — the answer is "no solution".',
            review: '%1 ÷ 0 asks for a number that gives %1 when multiplied by 0. There is none: zero times anything is zero. So there is no answer, and that is a rule, not a trap.'
        },
        'ошибся на единицу': {
            game: 'Off by just one. Count the last step again.',
            review: 'The answer was right there: %1 instead of %2. The last step often goes on autopilot and loses a one. Counting it separately takes half a second.'
        },
        'ошибся на единицу:div': {
            game: 'Check by multiplying: %1 × %2 = %3, but %4 × %2 = %5.',
            review: '%1 × %2 = %3, but %4 × %2 = %5. Division is checked by multiplying — half a second, and an off-by-one shows up at once.'
        },
        'промахнулся рядом': {
            game: 'The answer was close — the method held, the last step slipped.',
            review: 'You picked %1, the answer is %2. Being off by two or three is not missing knowledge, it is a slipped count: one step got lost or counted twice. Counting the last step through to yourself catches it.'
        },
        'оба разряда мимо': {
            game: 'Neither digit matched. Work through one place at a time.',
            review: 'You picked %1, the answer is %2 — neither the ones nor the tens matched. Work one place at a time: the ones come to %3, then the tens come to %4. Taking both at once is how you miss both.'
        },
        'не умножил десятки': {
            game: 'Only %1 × %2 was counted. The second number still has tens.',
            review: '%1 × %2 = %3 — that is the ones only. What is left is %1 × %4 = %5, and together they make %6. A two-digit number is multiplied in parts and then added up: skip the second part and you lose all of it.'
        },
        'нет решения зря': {
            game: 'Nothing here is divided by zero — dividing by %1 is allowed.',
            review: '%1 ÷ %2 = %3. The rule forbids dividing BY zero, that is, when the zero stands second. Here the second number is %2, so there is an answer. A zero in the problem forbids nothing on its own — what matters is where it stands.'
        }
    },

    fr: {
        'ноль в примере:mul': {
            game: 'Additionne %1 — cela fait toujours zéro.',
            review: '%1 × %2 = 0. Multiplier, c’est additionner le même nombre plusieurs fois : autant de zéros que tu veux, cela fait zéro. Voilà pourquoi un zéro dans une multiplication donne toujours zéro.'
        },
        'ноль в примере:div': {
            game: 'Divise zéro par n’importe quoi — il reste zéro.',
            review: '%1 ÷ %2 = 0 : en combien de parts que tu partages zéro, chaque part vaut zéro. Diviser zéro est permis — ce qui est interdit, c’est de diviser PAR zéro, et ce n’est pas la même chose.'
        },
        'ошибка в десятках:add': {
            game: 'Raté de dix pile. Les unités sont bonnes — recompte les dizaines.',
            review: '%1 + %2 : les unités donnent %3 + %4 = %5 — c’est %6 et une dizaine entière en plus. Se tromper de dix pile veut presque toujours dire que cette dizaine a été oubliée.'
        },
        'ошибка в десятках:sub': {
            game: 'Raté de dix pile. Les unités sont bonnes — recompte les dizaines.',
            review: '%1 − %2 : les unités sont justes, mais la dizaine empruntée s’est perdue en route. Se tromper de dix pile veut presque toujours dire cela — vérifie combien de dizaines il reste.'
        },
        'ошибка в десятках:mul': {
            game: 'Les unités collent, pas les dizaines : raté de %1. Refais %2 × %3.',
            review: '%1 × %2 = %3, et %4 a été choisi. Le dernier chiffre correspond, donc l\'écart est un nombre entier de dizaines — refais le calcul et estime l\'ordre de grandeur.'
        },
        'ошибка в десятках:div': {
            game: 'Raté de dix pile : %1 × %2 = %3, et non %4.',
            review: '%1 ÷ %2 = %3, car %3 × %2 = %1. Or %4 × %2 = %5 — raté. La division se vérifie toujours par la multiplication.'
        },
        'ошибка в единицах:add': {
            game: 'Les dizaines sont bonnes. Calcule à part %1 + %2.',
            review: '%1 + %2 : les derniers chiffres donnent %3 + %4 = %5, donc le résultat se termine par %6. Le dernier chiffre se trouve tout de suite, sans calculer le reste, et c’est le plus facile à vérifier.'
        },
        'ошибка в единицах:sub': {
            game: 'Les dizaines sont bonnes. Vérifie le dernier chiffre.',
            review: '%1 − %2 : le résultat se termine par %3. Le dernier chiffre se trouve à part, indépendamment du reste — c’est la vérification la plus rapide.'
        },
        'не занял десяток': {
            game: 'De %1 on ne peut pas ôter %2. Emprunte une dizaine : %3 − %2.',
            review: '%1 − %2 : %4 ne sort pas de %3, alors on emprunte une dizaine au voisin — %5 − %4 = %6, et il reste une dizaine de moins.'
        },
        'таблица умножения': {
            game: 'Tu as fait %1 × %2. Le calcul demande %3 × %4 — %5 d’écart.',
            review: '%1 × %2 = %3, alors que %4 × %5 = %6. Deux lignes voisines de la table sont séparées par un nombre entier, pas par une unité — voilà pourquoi l’écart est si grand.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2, c’est %1 pris %3, pas %1 + %2.',
            review: '%1 × %2 = %3 : c’est %1 pris %5. La multiplication est une écriture courte de l’addition répétée, donc le résultat est bien plus grand que la somme %1 + %2 = %4.'
        },
        'перепутал действие:add': {
            game: 'Tu as soustrait, mais le calcul est une addition.',
            review: 'Avec les mêmes nombres, le signe décide de tout : %1 + %2 = %3, alors que %1 − %2 = %4. Regarde le signe avant les nombres.'
        },
        'перепутал действие:sub': {
            game: 'Tu as additionné, mais le calcul est une soustraction.',
            review: 'Avec les mêmes nombres, le signe décide de tout : %1 − %2 = %3, alors que %1 + %2 = %4. Regarde le signe avant les nombres.'
        },
        'перепутал действие:mul': {
            game: 'Tu as divisé, mais le calcul est une multiplication.',
            review: 'Avec les mêmes nombres, le signe décide de tout : %1 × %2 = %3, alors que %1 ÷ %2 = %4. Regarde le signe avant les nombres.'
        },
        'перепутал действие:div': {
            game: 'Tu as multiplié, mais le calcul est une division.',
            review: 'Avec les mêmes nombres, le signe décide de tout : %1 ÷ %2 = %3, alors que %1 × %2 = %4. Regarde le signe avant les nombres.'
        },
        'взял одно из чисел': {
            game: '%1 ÷ %2 — combien de fois %2 tient dans %1 ?',
            review: 'La division répond à la question « combien de fois l’un tient dans l’autre ». %1 ÷ %2 = %3 — c’est le nombre de fois que %2 tient dans %1. Le résultat est toujours plus petit que %1 : un nombre du calcul lui-même ne peut donc pas être la réponse.'
        },
        'делил на ноль': {
            game: 'On ne divise pas par zéro — la réponse est « pas de solution ».',
            review: '%1 ÷ 0 demande un nombre qui, multiplié par 0, donnerait %1. Il n’existe pas : zéro multiplié par quoi que ce soit fait zéro. Il n’y a donc pas de réponse, et c’est une règle, pas un piège.'
        },
        'ошибся на единицу': {
            game: 'Raté d’une seule unité. Recompte la dernière étape.',
            review: 'La réponse était juste à côté : %1 au lieu de %2. La dernière étape se fait souvent en pilote automatique, et c’est là qu’on perd une unité. La refaire à part prend une demi-seconde.'
        },
        'ошибся на единицу:div': {
            game: 'Vérifie par la multiplication : %1 × %2 = %3, mais %4 × %2 = %5.',
            review: '%1 × %2 = %3, mais %4 × %2 = %5. La division se vérifie par la multiplication — une demi-seconde, et l\'écart d\'une unité saute aux yeux.'
        },
        'промахнулся рядом': {
            game: 'La réponse était tout près — le calcul tenait, la dernière étape a glissé.',
            review: 'Tu as choisi %1, la bonne réponse est %2. Se tromper de deux ou trois, ce n’est pas un manque de savoir, c’est un comptage qui dérape : une étape s’est perdue ou a été comptée deux fois. Recompter la dernière étape dans sa tête suffit.'
        },
        'оба разряда мимо': {
            game: 'Aucun chiffre ne correspond. Prends les rangs un par un.',
            review: 'Tu as choisi %1, la bonne réponse est %2 : ni les unités ni les dizaines ne tombent juste. Il faut prendre un rang à la fois : les unités font %3, puis les dizaines font %4. Compter les deux d’un coup, c’est se tromper dans les deux.'
        },
        'не умножил десятки': {
            game: 'Seul %1 × %2 a été calculé. Le deuxième nombre a encore des dizaines.',
            review: '%1 × %2 = %3 — ce ne sont que les unités. Il reste %1 × %4 = %5, et ensemble cela fait %6. Un nombre à deux chiffres se multiplie par parties, puis on additionne : sauter la deuxième partie, c’est la perdre entièrement.'
        },
        'нет решения зря': {
            game: 'Ici on ne divise pas par zéro — diviser par %1 est permis.',
            review: '%1 ÷ %2 = %3. La règle interdit seulement de diviser PAR zéro, c’est-à-dire quand le zéro est le deuxième nombre. Ici le deuxième nombre est %2, donc il y a une réponse. Un zéro dans le calcul n’interdit rien en soi — ce qui compte, c’est sa place.'
        }
    },

    de: {
        'ноль в примере:mul': {
            game: 'Zähl %1 zusammen — es bleibt null.',
            review: '%1 × %2 = 0. Multiplizieren heißt, dieselbe Zahl mehrmals zu addieren: wie viele Nullen du auch addierst, es bleibt null. Deshalb ergibt eine Null in der Multiplikation immer null.'
        },
        'ноль в примере:div': {
            game: 'Teile null durch was du willst — es bleibt null.',
            review: '%1 ÷ %2 = 0: in wie viele Teile du null auch teilst, jeder Teil ist null. Null teilen darf man — nicht erlaubt ist das Teilen DURCH null, und das sind zwei verschiedene Dinge.'
        },
        'ошибка в десятках:add': {
            game: 'Genau zehn daneben. Die Einer stimmen — zähl die Zehner nach.',
            review: '%1 + %2: die Einer ergeben %3 + %4 = %5 — das sind %6 und ein ganzer Zehner obendrauf. Genau zehn daneben heißt fast immer, dass dieser Zehner vergessen wurde.'
        },
        'ошибка в десятках:sub': {
            game: 'Genau zehn daneben. Die Einer stimmen — zähl die Zehner nach.',
            review: '%1 − %2: die Einer stimmen, aber der geliehene Zehner ist unterwegs verloren gegangen. Genau zehn daneben heißt fast immer genau das — prüfe, wie viele Zehner übrig bleiben.'
        },
        'ошибка в десятках:mul': {
            game: 'Einer stimmen, Zehner nicht: um %1 daneben. Rechne %2 × %3 neu.',
            review: '%1 × %2 = %3, gewählt wurde %4. Die letzte Ziffer stimmt, der Fehler sind also ganze Zehner — rechne noch einmal und schätze, was etwa herauskommen muss.'
        },
        'ошибка в десятках:div': {
            game: 'Genau um zehn daneben: %1 × %2 = %3, nicht %4.',
            review: '%1 ÷ %2 = %3, denn %3 × %2 = %1. Aber %4 × %2 = %5 — daneben. Division lässt sich immer mit Mal prüfen.'
        },
        'ошибка в единицах:add': {
            game: 'Die Zehner stimmen. Rechne %1 + %2 getrennt.',
            review: '%1 + %2: die letzten Ziffern ergeben %3 + %4 = %5, also endet das Ergebnis auf %6. Die letzte Ziffer findet man sofort, ohne den Rest zu rechnen, und sie lässt sich am leichtesten prüfen.'
        },
        'ошибка в единицах:sub': {
            game: 'Die Zehner stimmen. Prüfe die letzte Ziffer.',
            review: '%1 − %2: das Ergebnis endet auf %3. Die letzte Ziffer findet man für sich allein, unabhängig vom Rest — das ist die schnellste Prüfung.'
        },
        'не занял десяток': {
            game: 'Von %1 lässt sich %2 nicht abziehen. Hol dir einen Zehner: %3 − %2.',
            review: '%1 − %2: %4 geht nicht aus %3, also holt man sich einen Zehner vom Nachbarn — %5 − %4 = %6, und es bleibt ein Zehner weniger.'
        },
        'таблица умножения': {
            game: 'Du hast %1 × %2 gerechnet. Gefragt ist %3 × %4 — ganze %5 Unterschied.',
            review: '%1 × %2 = %3, aber %4 × %5 = %6. Benachbarte Zeilen des Einmaleins liegen gleich eine ganze Zahl auseinander, nicht eine Eins — deshalb ist der Abstand hier so groß.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2 heißt die %1 %3 genommen, nicht %1 + %2.',
            review: '%1 × %2 = %3: das ist die %1 %5 genommen. Multiplizieren ist die Kurzschrift für wiederholtes Addieren, deshalb ist das Ergebnis viel größer als die Summe %1 + %2 = %4.'
        },
        'перепутал действие:add': {
            game: 'Du hast subtrahiert, gefragt war eine Addition.',
            review: 'Bei denselben Zahlen entscheidet das Zeichen alles: %1 + %2 = %3, aber %1 − %2 = %4. Erst auf das Zeichen schauen, dann auf die Zahlen.'
        },
        'перепутал действие:sub': {
            game: 'Du hast addiert, gefragt war eine Subtraktion.',
            review: 'Bei denselben Zahlen entscheidet das Zeichen alles: %1 − %2 = %3, aber %1 + %2 = %4. Erst auf das Zeichen schauen, dann auf die Zahlen.'
        },
        'перепутал действие:mul': {
            game: 'Du hast dividiert, gefragt war eine Multiplikation.',
            review: 'Bei denselben Zahlen entscheidet das Zeichen alles: %1 × %2 = %3, aber %1 ÷ %2 = %4. Erst auf das Zeichen schauen, dann auf die Zahlen.'
        },
        'перепутал действие:div': {
            game: 'Du hast multipliziert, gefragt war eine Division.',
            review: 'Bei denselben Zahlen entscheidet das Zeichen alles: %1 ÷ %2 = %3, aber %1 × %2 = %4. Erst auf das Zeichen schauen, dann auf die Zahlen.'
        },
        'взял одно из чисел': {
            game: '%1 ÷ %2 — wie oft passt %2 in %1?',
            review: 'Division beantwortet die Frage „wie oft passt das eine in das andere“. %1 ÷ %2 = %3 — so oft passt %2 in %1. Das Ergebnis ist immer kleiner als %1, eine Zahl aus der Aufgabe selbst kann es also nicht sein.'
        },
        'делил на ноль': {
            game: 'Durch null teilt man nicht — richtig ist „keine Lösung“.',
            review: '%1 ÷ 0 sucht eine Zahl, die mit 0 multipliziert %1 ergibt. Die gibt es nicht: null mal irgendetwas bleibt null. Also gibt es keine Antwort, und das ist eine Regel, keine Falle.'
        },
        'ошибся на единицу': {
            game: 'Nur um eins daneben. Rechne den letzten Schritt noch einmal.',
            review: 'Die Antwort war ganz nah: %1 statt %2. Der letzte Schritt läuft oft automatisch, und genau da geht die Eins verloren. Ihn getrennt nachzurechnen dauert eine halbe Sekunde.'
        },
        'ошибся на единицу:div': {
            game: 'Prüfe mit Mal: %1 × %2 = %3, aber %4 × %2 = %5.',
            review: '%1 × %2 = %3, aber %4 × %2 = %5. Division prüft man mit der Multiplikation — eine halbe Sekunde, und der Fehler um eins fällt sofort auf.'
        },
        'промахнулся рядом': {
            game: 'Ganz nah dran — gerechnet war richtig, der letzte Schritt ist verrutscht.',
            review: 'Gewählt wurde %1, richtig ist %2. Zwei oder drei daneben ist keine Wissenslücke, sondern ein verrutschtes Zählen: ein Schritt ging verloren oder wurde doppelt gezählt. Den letzten Schritt noch einmal nachzurechnen genügt.'
        },
        'оба разряда мимо': {
            game: 'Keine Ziffer stimmt. Nimm die Stellen nacheinander.',
            review: 'Gewählt wurde %1, richtig ist %2 — weder Einer noch Zehner stimmen. Eine Stelle nach der anderen: die Einer ergeben %3, dann die Zehner %4. Wer beide auf einmal rechnet, verfehlt beide.'
        },
        'не умножил десятки': {
            game: 'Gerechnet wurde nur %1 × %2. Die zweite Zahl hat noch Zehner.',
            review: '%1 × %2 = %3 — das sind nur die Einer. Es fehlt noch %1 × %4 = %5, zusammen ergibt das %6. Eine zweistellige Zahl multipliziert man in Teilen und addiert sie: lässt du den zweiten Teil aus, fehlt er ganz.'
        },
        'нет решения зря': {
            game: 'Hier wird nicht durch null geteilt — durch %1 darf man teilen.',
            review: '%1 ÷ %2 = %3. Die Regel verbietet nur das Teilen DURCH null, also wenn die null an zweiter Stelle steht. Hier steht dort %2, es gibt also eine Antwort. Eine null im Beispiel verbietet für sich nichts — es kommt darauf an, wo sie steht.'
        }
    }
};
