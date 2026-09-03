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
//   ошибка в единицах:add   game ед1, ед2     review a, b, ед1, ед2, ед1+ед2, последняя цифра суммы
//   ошибка в единицах:sub   game —            review a, b, последняя цифра ответа
//   не занял десяток        game ед1, ед2, ед1+10          review a, b, ед1, ед2, ед1+10, ед1+10−ед2
//   таблица умножения       game взятое1, взятое2, a, b, разница
//                           review взятое1, взятое2, что вышло, a, b, верный ответ
//   сложил вместо умножения game a, b         review a, b, верный ответ, a+b
//   перепутал действие:*    game —            review a, b, верный ответ, что посчитал
//   взял одно из чисел      game a, b         review a, b, верный ответ
//   делил на ноль           game —            review a
//   ошибся на единицу       game —            review что выбрал, верный ответ

window.HINT_CONTENT = {
    ru: {
        'ноль в примере:mul': {
            game: 'Сложи %1 нулей — получится ноль.',
            review: '%1 × %2 = 0. Умножение — это сложение одинаковых чисел: сколько нулей ни сложи, будет ноль. Поэтому ноль в умножении всегда даёт ноль.'
        },
        'ноль в примере:div': {
            game: 'Ноль раздели на что угодно — останется ноль.',
            review: '%1 ÷ %2 = 0: ноль сколько ни дели, в каждой части будет ноль. Делить ноль можно — нельзя делить НА ноль, это разные вещи.'
        },
        'ошибка в десятках:add': {
            game: 'Мимо ровно на десяток. Единицы верные — пересчитай десятки.',
            review: '%1 + %2: единицы %3 + %4 = %5 — пишем %6, десяток уходит наверх. Промах ровно на десяток почти всегда значит, что этот десяток потеряли.'
        },
        'ошибка в десятках:sub': {
            game: 'Мимо ровно на десяток. Единицы верные — пересчитай десятки.',
            review: '%1 − %2: единицы сошлись, а десяток при заёме потерялся. Промах ровно на десяток почти всегда значит именно это — проверь, сколько десятков осталось.'
        },
        'ошибка в единицах:add': {
            game: 'Десятки сошлись. Посчитай отдельно %1 + %2.',
            review: '%1 + %2: последние цифры дают %3 + %4 = %5 — значит ответ кончается на %6. Столбик считают справа налево, и первая цифра ответа появляется последней.'
        },
        'ошибка в единицах:sub': {
            game: 'Десятки сошлись. Проверь последнюю цифру.',
            review: '%1 − %2: ответ кончается на %3. Столбик считают справа налево — последняя цифра готова первой, и её стоит проверить отдельно.'
        },
        'не занял десяток': {
            game: 'Из %1 не вычесть %2. Займи десяток: %3 − %2.',
            review: '%1 − %2: из %3 число %4 не вычесть, поэтому берём десяток у соседа — %5 − %4 = %6, а десятков остаётся на один меньше.'
        },
        'таблица умножения': {
            game: 'Ты посчитал %1 × %2. В примере %3 × %4 — разница целых %5.',
            review: '%1 × %2 = %3, а %4 × %5 = %6. Соседние клетки таблицы отличаются на целый множитель, а не на единицу — поэтому промах здесь всегда крупный.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2 — это %2 раза по %1, а не %1 + %2.',
            review: '%1 × %2 = %3: это %2 раза по %1. Умножение — короткая запись сложения одинаковых чисел, поэтому ответ намного больше суммы %1 + %2 = %4.'
        },
        'перепутал действие:add': {
            game: 'Ты вычел, а в примере сложение.',
            review: 'С теми же числами знак решает всё: %1 + %2 = %3, а %1 − %2 = %4. Смотреть на знак стоит раньше, чем на числа.'
        },
        'перепутал действие:sub': {
            game: 'Ты сложил, а в примере вычитание.',
            review: 'С теми же числами знак решает всё: %1 − %2 = %3, а %1 + %2 = %4. Смотреть на знак стоит раньше, чем на числа.'
        },
        'перепутал действие:mul': {
            game: 'Ты разделил, а в примере умножение.',
            review: 'С теми же числами знак решает всё: %1 × %2 = %3, а %1 ÷ %2 = %4. Смотреть на знак стоит раньше, чем на числа.'
        },
        'перепутал действие:div': {
            game: 'Ты умножил, а в примере деление.',
            review: 'С теми же числами знак решает всё: %1 ÷ %2 = %3, а %1 × %2 = %4. Смотреть на знак стоит раньше, чем на числа.'
        },
        'взял одно из чисел': {
            game: '%1 ÷ %2 — сколько раз %2 помещается в %1?',
            review: 'Деление отвечает на вопрос «сколько раз одно помещается в другом». %1 ÷ %2 = %3 — столько раз %2 помещается в %1. Ответ всегда меньше делимого, поэтому само число примера ответом быть не может.'
        },
        'делил на ноль': {
            game: 'На ноль не делят — верный ответ «нет решения».',
            review: '%1 ÷ 0 просит найти число, которое при умножении на 0 даст %1. Такого нет: ноль на что ни умножь — будет ноль. Поэтому ответа нет, и это правило, а не ловушка.'
        },
        'ошибся на единицу': {
            game: 'Мимо на единицу — это спешка, а не незнание.',
            review: 'Ответ был рядом: %1 вместо %2. Так почти всегда выходит, когда последний шаг делают на автомате — досчитывай его про себя, это полсекунды.'
        }
    },

    en: {
        'ноль в примере:mul': {
            game: 'Add up %1 zeros — you still get zero.',
            review: '%1 × %2 = 0. Multiplication is adding the same number again and again: however many zeros you add, you get zero. That is why a zero in a multiplication always gives zero.'
        },
        'ноль в примере:div': {
            game: 'Divide zero by anything — it stays zero.',
            review: '%1 ÷ %2 = 0: however many parts you split zero into, each part is zero. Dividing zero is allowed — what you cannot do is divide BY zero, and those are two different things.'
        },
        'ошибка в десятках:add': {
            game: 'Off by exactly ten. The units are right — count the tens again.',
            review: '%1 + %2: the units give %3 + %4 = %5 — write %6 and carry the ten upstairs. Being off by exactly ten almost always means that ten got lost.'
        },
        'ошибка в десятках:sub': {
            game: 'Off by exactly ten. The units are right — count the tens again.',
            review: '%1 − %2: the units came out right, but a ten went missing in the borrow. Off by exactly ten almost always means just that — check how many tens are left.'
        },
        'ошибка в единицах:add': {
            game: 'The tens are right. Work out %1 + %2 on its own.',
            review: '%1 + %2: the last digits give %3 + %4 = %5, so the answer ends in %6. A column is added right to left, and the first digit of the answer is the last one you get.'
        },
        'ошибка в единицах:sub': {
            game: 'The tens are right. Check the last digit.',
            review: '%1 − %2: the answer ends in %3. A column is worked right to left — the last digit is ready first, and it is worth checking on its own.'
        },
        'не занял десяток': {
            game: 'You cannot take %2 from %1. Borrow a ten: %3 − %2.',
            review: '%1 − %2: %4 will not come out of %3, so you borrow a ten from the neighbour — %5 − %4 = %6, and one ten fewer is left.'
        },
        'таблица умножения': {
            game: 'You worked out %1 × %2. The problem says %3 × %4 — a whole %5 apart.',
            review: '%1 × %2 = %3, while %4 × %5 = %6. Neighbouring cells of the table differ by a whole factor, not by one — that is why a slip here is always a big one.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2 means %2 lots of %1, not %1 + %2.',
            review: '%1 × %2 = %3: that is %2 lots of %1. Multiplication is shorthand for adding the same number again and again, so the answer is far bigger than the sum %1 + %2 = %4.'
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
            review: 'Division answers the question "how many times does one fit into the other". %1 ÷ %2 = %3 — that is how many times %2 fits into %1. The answer is always smaller than the dividend, so a number from the problem cannot be it.'
        },
        'делил на ноль': {
            game: 'You cannot divide by zero — the answer is "no solution".',
            review: '%1 ÷ 0 asks for a number that gives %1 when multiplied by 0. There is none: zero times anything is zero. So there is no answer, and that is a rule, not a trap.'
        },
        'ошибся на единицу': {
            game: 'Off by one — that is hurry, not lack of knowledge.',
            review: 'The answer was right there: %1 instead of %2. That is what happens when the last step is done on autopilot — count it through to yourself, it takes half a second.'
        }
    },

    fr: {
        'ноль в примере:mul': {
            game: 'Additionne %1 zéros — cela fait toujours zéro.',
            review: '%1 × %2 = 0. Multiplier, c’est additionner le même nombre plusieurs fois : autant de zéros que tu veux, cela fait zéro. Voilà pourquoi un zéro dans une multiplication donne toujours zéro.'
        },
        'ноль в примере:div': {
            game: 'Divise zéro par n’importe quoi — il reste zéro.',
            review: '%1 ÷ %2 = 0 : en combien de parts que tu partages zéro, chaque part vaut zéro. Diviser zéro est permis — ce qui est interdit, c’est de diviser PAR zéro, et ce n’est pas la même chose.'
        },
        'ошибка в десятках:add': {
            game: 'Raté de dix pile. Les unités sont bonnes — recompte les dizaines.',
            review: '%1 + %2 : les unités donnent %3 + %4 = %5 — on écrit %6 et la dizaine monte. Se tromper de dix pile veut presque toujours dire que cette dizaine a été oubliée.'
        },
        'ошибка в десятках:sub': {
            game: 'Raté de dix pile. Les unités sont bonnes — recompte les dizaines.',
            review: '%1 − %2 : les unités sont justes, mais une dizaine s’est perdue dans l’emprunt. Se tromper de dix pile veut presque toujours dire cela — vérifie combien de dizaines il reste.'
        },
        'ошибка в единицах:add': {
            game: 'Les dizaines sont bonnes. Calcule à part %1 + %2.',
            review: '%1 + %2 : les derniers chiffres donnent %3 + %4 = %5, donc le résultat se termine par %6. On pose l’addition de droite à gauche, et le premier chiffre du résultat sort en dernier.'
        },
        'ошибка в единицах:sub': {
            game: 'Les dizaines sont bonnes. Vérifie le dernier chiffre.',
            review: '%1 − %2 : le résultat se termine par %3. On pose l’opération de droite à gauche — le dernier chiffre est prêt en premier, et il mérite une vérification à part.'
        },
        'не занял десяток': {
            game: 'De %1 on ne peut pas ôter %2. Emprunte une dizaine : %3 − %2.',
            review: '%1 − %2 : %4 ne sort pas de %3, alors on emprunte une dizaine au voisin — %5 − %4 = %6, et il reste une dizaine de moins.'
        },
        'таблица умножения': {
            game: 'Tu as fait %1 × %2. Le calcul demande %3 × %4 — %5 d’écart.',
            review: '%1 × %2 = %3, alors que %4 × %5 = %6. Deux cases voisines de la table diffèrent d’un facteur entier, pas d’une unité — c’est pourquoi l’écart est toujours grand ici.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2, c’est %2 fois %1, pas %1 + %2.',
            review: '%1 × %2 = %3 : c’est %2 fois %1. La multiplication est une écriture courte de l’addition répétée, donc le résultat est bien plus grand que la somme %1 + %2 = %4.'
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
            review: 'La division répond à la question « combien de fois l’un tient dans l’autre ». %1 ÷ %2 = %3 — c’est le nombre de fois que %2 tient dans %1. Le résultat est toujours plus petit que le dividende : un nombre du calcul ne peut donc pas être la réponse.'
        },
        'делил на ноль': {
            game: 'On ne divise pas par zéro — la réponse est « pas de solution ».',
            review: '%1 ÷ 0 demande un nombre qui, multiplié par 0, donnerait %1. Il n’existe pas : zéro multiplié par quoi que ce soit fait zéro. Il n’y a donc pas de réponse, et c’est une règle, pas un piège.'
        },
        'ошибся на единицу': {
            game: 'Raté d’une unité — c’est la précipitation, pas l’ignorance.',
            review: 'La réponse était juste à côté : %1 au lieu de %2. Cela arrive presque toujours quand la dernière étape se fait en pilote automatique — refais-la dans ta tête, c’est une demi-seconde.'
        }
    },

    de: {
        'ноль в примере:mul': {
            game: 'Zähl %1 Nullen zusammen — es bleibt null.',
            review: '%1 × %2 = 0. Multiplizieren heißt, dieselbe Zahl mehrmals zu addieren: wie viele Nullen du auch addierst, es bleibt null. Deshalb ergibt eine Null in der Multiplikation immer null.'
        },
        'ноль в примере:div': {
            game: 'Teile null durch was du willst — es bleibt null.',
            review: '%1 ÷ %2 = 0: in wie viele Teile du null auch teilst, jeder Teil ist null. Null teilen darf man — nicht erlaubt ist das Teilen DURCH null, und das sind zwei verschiedene Dinge.'
        },
        'ошибка в десятках:add': {
            game: 'Genau zehn daneben. Die Einer stimmen — zähl die Zehner nach.',
            review: '%1 + %2: die Einer ergeben %3 + %4 = %5 — %6 hinschreiben, der Zehner wandert nach oben. Genau zehn daneben heißt fast immer, dass dieser Zehner verloren ging.'
        },
        'ошибка в десятках:sub': {
            game: 'Genau zehn daneben. Die Einer stimmen — zähl die Zehner nach.',
            review: '%1 − %2: die Einer stimmen, aber beim Entbündeln ist ein Zehner verloren gegangen. Genau zehn daneben heißt fast immer genau das — prüfe, wie viele Zehner übrig bleiben.'
        },
        'ошибка в единицах:add': {
            game: 'Die Zehner stimmen. Rechne %1 + %2 getrennt.',
            review: '%1 + %2: die letzten Ziffern ergeben %3 + %4 = %5, also endet das Ergebnis auf %6. Man rechnet von rechts nach links, und die erste Ziffer des Ergebnisses kommt zuletzt.'
        },
        'ошибка в единицах:sub': {
            game: 'Die Zehner stimmen. Prüfe die letzte Ziffer.',
            review: '%1 − %2: das Ergebnis endet auf %3. Man rechnet von rechts nach links — die letzte Ziffer ist zuerst fertig, und sie lohnt eine eigene Prüfung.'
        },
        'не занял десяток': {
            game: 'Von %1 lässt sich %2 nicht abziehen. Hol dir einen Zehner: %3 − %2.',
            review: '%1 − %2: %4 geht nicht aus %3, also holt man sich einen Zehner vom Nachbarn — %5 − %4 = %6, und es bleibt ein Zehner weniger.'
        },
        'таблица умножения': {
            game: 'Du hast %1 × %2 gerechnet. Gefragt ist %3 × %4 — ganze %5 Unterschied.',
            review: '%1 × %2 = %3, aber %4 × %5 = %6. Benachbarte Felder des Einmaleins unterscheiden sich um einen ganzen Faktor, nicht um eins — deshalb ist der Fehler hier immer groß.'
        },
        'сложил вместо умножения': {
            game: '%1 × %2 heißt %2 mal die %1, nicht %1 + %2.',
            review: '%1 × %2 = %3: das sind %2 mal die %1. Multiplizieren ist die Kurzschrift für wiederholtes Addieren, deshalb ist das Ergebnis viel größer als die Summe %1 + %2 = %4.'
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
            review: 'Division beantwortet die Frage „wie oft passt das eine in das andere“. %1 ÷ %2 = %3 — so oft passt %2 in %1. Das Ergebnis ist immer kleiner als der Dividend, eine Zahl aus der Aufgabe kann es also nicht sein.'
        },
        'делил на ноль': {
            game: 'Durch null teilt man nicht — richtig ist „keine Lösung“.',
            review: '%1 ÷ 0 sucht eine Zahl, die mit 0 multipliziert %1 ergibt. Die gibt es nicht: null mal irgendetwas bleibt null. Also gibt es keine Antwort, und das ist eine Regel, keine Falle.'
        },
        'ошибся на единицу': {
            game: 'Um eins daneben — das ist Eile, nicht Unwissen.',
            review: 'Die Antwort war ganz nah: %1 statt %2. So etwas passiert fast immer, wenn der letzte Schritt automatisch läuft — rechne ihn dir noch einmal vor, das dauert eine halbe Sekunde.'
        }
    }
};
