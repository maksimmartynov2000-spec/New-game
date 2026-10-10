-- Проверка миграции friends.sql. Запускать на ТЕСТОВОЙ копии: скрипт заводит
-- и удаляет аккаунты ZF*. Все строки должны быть «ДА».
--
--   psql -f supabase/friends.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_throttle where key like 'friend:ZF%';
delete from citadel_progress where code like 'ZF%';

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values
  ('ZFTUTOR',  crypt('tutorpassword', gen_salt('bf')), null, 'self',
   '{"schema":2,"playerCode":"ZFTUTOR","updatedAt":0,"accountType":"self","ownerCode":null,"profileLabel":"Максим"}', now()),
  ('ZFTUTOR2', crypt('tutorpassword', gen_salt('bf')), null, 'self',
   '{"schema":2,"playerCode":"ZFTUTOR2","updatedAt":0,"accountType":"self","ownerCode":null}', now()),
  ('ZFSOLO',   crypt('solopassword', gen_salt('bf')), null, 'solo',
   '{"schema":2,"playerCode":"ZFSOLO","updatedAt":0,"accountType":"solo","ownerCode":null}', now()),
  ('ZFSOLO2',  crypt('solopassword', gen_salt('bf')), null, 'solo',
   '{"schema":2,"playerCode":"ZFSOLO2","updatedAt":0,"accountType":"solo","ownerCode":null}', now());

select coalesce((session_login('ZFTUTOR', 'tutorpassword'))->>'token', '∅') as tutor \gset
select coalesce((session_login('ZFTUTOR2', 'tutorpassword'))->>'token', '∅') as tutor2 \gset
select coalesce((session_login('ZFSOLO', 'solopassword'))->>'token', '∅') as solo \gset
select coalesce((session_login('ZFSOLO2', 'solopassword'))->>'token', '∅') as solo2 \gset
select session_create_student(:'tutor', 'ZFKID1', 'kidpassword1', 'Маша') \gset mk_
select session_create_student(:'tutor', 'ZFKID2', 'kidpassword2', 'Петя') \gset mk_
select session_create_student(:'tutor2', 'ZFKID3', 'kidpassword3', 'Чужой') \gset mk_
select coalesce((session_login('ZFKID1', 'kidpassword1'))->>'token', '∅') as kid1 \gset
select coalesce((session_login('ZFKID2', 'kidpassword2'))->>'token', '∅') as kid2 \gset
select coalesce((session_login('ZFKID3', 'kidpassword3'))->>'token', '∅') as kid3 \gset
select to_char(current_date, 'YYYY-MM-DD') as today \gset

-- =====================================================================
--  1. Кому можно
-- =====================================================================
select case when (session_friends(:'tutor', :'today'))->>'error' = 'not_for_tutor'
             and (session_friend_setup(:'tutor', 'Максим'))->>'error' = 'not_for_tutor'
             and (session_friend_add(:'tutor', 'ABCDEF'))->>'error' = 'not_for_tutor'
             and not exists (select 1 from citadel_friend_card where code = 'ZFTUTOR')
            then 'ДА  у репетитора друзей нет'
            else 'НЕТ репетитор завёл друзей' end;
select case when (session_friends('нет такого токена', :'today'))->>'error' = 'bad_session'
             and (session_friend_add(null, 'ABCDEF'))->>'error' = 'bad_session'
            then 'ДА  без входа — нельзя'
            else 'НЕТ пускает без входа' end;
select session_friends(:'kid1', :'today') as r \gset
select case when (:'r'::jsonb)->>'ok' = 'true' and (:'r'::jsonb)->'me' = 'null'::jsonb
             and (:'r'::jsonb)->'friends' = '[]'::jsonb and (:'r'::jsonb)->'incoming' = '[]'::jsonb
            then 'ДА  пока друзья не включены — пусто'
            else 'НЕТ до включения: ' || :'r' end;
select case when (session_friend_add(:'kid1', 'ABCDEF'))->>'error' = 'no_card'
            then 'ДА  звать, не включив друзей, нельзя'
            else 'НЕТ позвал без своей карточки' end;

-- =====================================================================
--  2. Имя для друзей
-- =====================================================================
select case when count(*) = 11 and bool_and(coalesce(r->>'error', '') = 'bad_name')
            then 'ДА  телефон, ссылка, почта, лишние цифры и чужие буквы в имя не попадают'
            else 'НЕТ имена: ' || string_agg(coalesce(r::text, '∅'), ' ') end
  from (select session_friend_setup(:'kid1', n) as r
          from unnest(array['', 'М', '   ', 'Мария-Анна Петровна-Ивановна', '89161234567', 'Маша 12345',
                            'masha@mail.ru', 'http://x.ru', 'Маша:)', '日本語', '1234']) n) s;
select case when not exists (select 1 from citadel_friend_card where code = 'ZFKID1')
            then 'ДА  после отказа карточки нет'
            else 'НЕТ карточка заведена с плохим именем' end;
select session_friend_setup(:'kid1', '  Маша   К. ') as r \gset
select (:'r'::jsonb)->>'code' as kid1code \gset
select case when (:'r'::jsonb)->>'ok' = 'true' and (:'r'::jsonb)->>'name' = 'Маша К.'
             and (:'r'::jsonb)->>'code' ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
             and (:'r'::jsonb)->>'compare' = 'false'
            then 'ДА  имя без лишних пробелов, код — шесть знаков без похожих'
            else 'НЕТ включение: ' || :'r' end;
-- Вызов и проверка — отдельными запросами: запрос не видит того, что поменяла
-- вызванная из него же функция.
select session_friend_setup(:'kid1', 'Маша') as r \gset
select case when (:'r'::jsonb)->>'code' = :'kid1code'
             and (select name from citadel_friend_card where code = 'ZFKID1') = 'Маша'
            then 'ДА  смена имени код не меняет'
            else 'НЕТ имя или код' end;
select case when (session_friend_setup(:'solo', 'Zoë O''Neil'))->>'name' = 'Zoë O''Neil'
             and (session_friend_setup(:'solo2', 'Миша-2009'))->>'name' = 'Миша-2009'
             and (session_friend_setup(:'kid2', 'Петя'))->>'ok' = 'true'
             and (session_friend_setup(:'kid3', 'Ваня'))->>'ok' = 'true'
            then 'ДА  французские буквы, апостроф, дефис и год рождения — можно'
            else 'НЕТ хорошее имя отвергнуто' end;
select (session_friends(:'solo', :'today'))->'me'->>'code' as solocode \gset
select (session_friends(:'solo2', :'today'))->'me'->>'code' as solo2code \gset
select (session_friends(:'kid2', :'today'))->'me'->>'code' as kid2code \gset
select (session_friends(:'kid3', :'today'))->'me'->>'code' as kid3code \gset
select case when count(distinct fcode) = 5
             and bool_and(fcode ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$')
            then 'ДА  у каждого свой код, и ни в одном нет похожих знаков'
            else 'НЕТ коды: ' || string_agg(fcode, ' ') end
  from citadel_friend_card where code like 'ZF%';

-- =====================================================================
--  3. Позвать по коду
-- =====================================================================
select case when (session_friend_add(:'kid1', :'kid1code'))->>'error' = 'self'
            then 'ДА  свой код — не друг'
            else 'НЕТ позвал сам себя' end;
select session_friend_add(:'kid1', lower(substr(:'solocode', 1, 3)) || ' - ' || lower(substr(:'solocode', 4))) as r \gset
select case when (:'r'::jsonb)->>'status' = 'sent' and (:'r'::jsonb)->>'name' = 'Zoë O''Neil'
            then 'ДА  код со строчными, пробелами и дефисом находится; запрос ушёл'
            else 'НЕТ запрос: ' || :'r' end;
select case when (session_friend_add(:'kid1', :'solocode'))->>'status' = 'already_sent'
             and (select count(*) from citadel_friend where a = 'ZFKID1') = 1
            then 'ДА  второй раз тот же запрос не плодится'
            else 'НЕТ запрос задвоился' end;
select session_friends(:'solo', :'today') as r \gset
select case when jsonb_array_length((:'r'::jsonb)->'incoming') = 1
             and (:'r'::jsonb)->'incoming'->0->>'name' = 'Маша'
             and (:'r'::jsonb)->'friends' = '[]'::jsonb
            then 'ДА  у второго — запрос с именем, но не дружба'
            else 'НЕТ входящие: ' || :'r' end;
select case when (session_friends(:'kid1', :'today'))->'outgoing'->0->>'name' = 'Zoë O''Neil'
            then 'ДА  у первого — запрос в ожидающих'
            else 'НЕТ исходящие' end;
select session_friend_add(:'solo', :'kid1code') as r \gset
select case when (:'r'::jsonb)->>'status' = 'friends'
             and (select count(*) from citadel_friend
                   where least(a, b) = 'ZFKID1' and greatest(a, b) = 'ZFSOLO' and accepted_at is not null) = 1
            then 'ДА  позвали друг друга — друзья сразу, строка одна'
            else 'НЕТ встречный запрос' end;
select case when (session_friend_add(:'kid1', :'solocode'))->>'status' = 'already_friends'
            then 'ДА  уже друзья — так и сказано'
            else 'НЕТ повтор после дружбы' end;

-- Неверные коды: пять без паузы, дальше пауза. Верный код паузу не сбрасывает.
select case when count(*) = 5 and bool_and(r->>'error' = 'bad_code' and (r->>'wait')::int = 0)
            then 'ДА  первые пять ошибок — без паузы'
            else 'НЕТ пять ошибок: ' || string_agg(r::text, ' ') end
  from (select session_friend_add(:'kid2', 'ZZZZ' || n) as r from generate_series(22, 26) n) s;
select session_friend_add(:'kid2', :'kid3code') as r \gset
select case when (:'r'::jsonb)->>'status' = 'sent'
            then 'ДА  верный код между ошибками проходит'
            else 'НЕТ верный код: ' || :'r' end;
select case when ((session_friend_add(:'kid2', 'ZZZZ27'))->>'wait')::int > 0
            then 'ДА  верный код паузу не сбросил — шестая ошибка уже с паузой'
            else 'НЕТ верный код сбросил счёт' end;
select case when (session_friend_add(:'kid2', :'kid1code'))->>'error' = 'too_many'
             and not exists (select 1 from citadel_friend where a = 'ZFKID2' and b = 'ZFKID1')
            then 'ДА  во время паузы не проверяется даже верный код'
            else 'НЕТ пауза не держит' end;

-- =====================================================================
--  4. Принять, отклонить, отозвать — только своё
-- =====================================================================
select id as req from citadel_friend where a = 'ZFKID2' and b = 'ZFKID3' \gset
select case when (session_friend_accept(:'kid1', :req))->>'error' = 'not_found'
             and (session_friend_accept(:'kid2', :req))->>'error' = 'not_found'
             and (select accepted_at from citadel_friend where id = :req) is null
            then 'ДА  чужой запрос и свой собственный принять нельзя'
            else 'НЕТ принят не тем' end;
select case when (session_friend_remove(:'kid1', :req))->>'removed' = '0'
             and exists (select 1 from citadel_friend where id = :req)
            then 'ДА  чужую строку не удалить'
            else 'НЕТ удалил чужое' end;
select session_friend_accept(:'kid3', :req) as r \gset
select case when (:'r'::jsonb)->>'name' = 'Петя'
             and (select accepted_at from citadel_friend where id = :req) is not null
            then 'ДА  принимает тот, кого позвали'
            else 'НЕТ принятие' end;
select case when (session_friend_remove(:'kid3', :req))->>'removed' = '1'
             and (session_friends(:'kid2', :'today'))->'friends' = '[]'::jsonb
            then 'ДА  удалённый друг пропадает у обоих'
            else 'НЕТ удаление друга' end;
select (session_friend_add(:'solo2', :'kid1code'))->>'status' as st \gset
select id as req2 from citadel_friend where a = 'ZFSOLO2' and b = 'ZFKID1' \gset
select case when :'st' = 'sent' and (session_friend_remove(:'kid1', :req2))->>'removed' = '1'
             and (session_friends(:'solo2', :'today'))->'outgoing' = '[]'::jsonb
            then 'ДА  отклонённый запрос пропадает и у того, кто звал'
            else 'НЕТ отклонение' end;
select (session_friend_add(:'solo2', :'kid1code'))->>'status' as st \gset
select id as req3 from citadel_friend where a = 'ZFSOLO2' and b = 'ZFKID1' \gset
select case when :'st' = 'sent' and (session_friend_remove(:'solo2', :req3))->>'removed' = '1'
             and (session_friends(:'kid1', :'today'))->'incoming' = '[]'::jsonb
            then 'ДА  свой запрос можно отозвать'
            else 'НЕТ отзыв' end;

-- =====================================================================
--  5. Что видно другу
-- =====================================================================
-- У Zoë (ZFSOLO) — полный прогресс со всем личным. Дни: шесть подряд с целью
-- (на пятом — заморозка), пропуск, ещё три. Серия — девять: пропуск закрыт
-- заморозкой, а сам замороженный день серию не удлиняет.
update citadel_progress set state = state || jsonb_build_object(
    'profileLabel', 'СЕКРЕТНАЯ МЕТКА',
    'daily', (select jsonb_object_agg(to_char(current_date + d, 'YYYY-MM-DD'),
                                      jsonb_build_object('c', 25, 'w', 3, 'tr', 0, 's', 600,
                                                         'e', jsonb_build_object('перепутал действие', 3)))
                from generate_series(-9, 0) d where d <> -3),
    'unlocks', '{"integer+:add:1:a3":"2026-01-01","integer+:add:1:c3":"2026-01-02","integer+:add:1:s1":"2026-01-02",
                 "fraction+:toMixed:2:c1":"2026-01-03","streak7":"2026-01-01","master:fraction:add":"x",
                 "integer+:add:3:x3":"2026-01-01","integer+:add:2:a1":null,"integer+:add:2:a2":""}'::jsonb,
    'byTopic', '{"integer+:add:1":{"correct":150,"wrong":9},"integer+:sub:2":{"correct":99,"wrong":1}}'::jsonb,
    'collections', jsonb_build_object('paradoxes', '[false,false,false,false,false,false,false,true]'::jsonb),
    'errorKinds', '{"integer+:add:1":{"ошибся в знаке":4}}'::jsonb,
    'mistakeBank', '{"items":{"integer+:add:1|3 + 4":{"k":"integer+:add:1","p":{"text":"3 + 4"},"w":8,"e":"не тот знак","t":1,"ok":[]}},"done":{}}'::jsonb,
    'hwDone', '{"5":"2026-01-01"}'::jsonb,
    'totals', '{"correct":4242,"wrong":77}'::jsonb)
 where code = 'ZFSOLO';
select session_friends(:'kid1', :'today') as r \gset
select (:'r'::jsonb)->'friends'->0 as f \gset
select case when jsonb_array_length((:'r'::jsonb)->'friends') = 1
             and (select array_agg(k order by k) from jsonb_object_keys(:'f'::jsonb) k)
                 = array['id', 'ladders', 'name', 'pics', 'streak']
            then 'ДА  у друга ровно пять полей: номер, имя, серия, медали, картинки'
            else 'НЕТ поля друга: ' || :'f' end;
select case when (:'f'::jsonb)->'ladders' = '["fraction+:toMixed:2:c1","integer+:add:1:a3","integer+:add:1:c3","integer+:add:1:s1"]'::jsonb
            then 'ДА  медали — только ступени лесенок, без дат и без пустых'
            else 'НЕТ медали: ' || ((:'f'::jsonb)->'ladders')::text end;
select case when (:'f'::jsonb)->'pics' = '[0, 7]'::jsonb
            then 'ДА  картинки: сотня в клетке и отметка в коллекции, 99 ответов — ещё нет'
            else 'НЕТ картинки: ' || ((:'f'::jsonb)->'pics')::text end;
select case when ((:'f'::jsonb)->>'streak')::int = 9
            then 'ДА  серия считается с заморозкой, как в приложении'
            else 'НЕТ серия: ' || ((:'f'::jsonb)->>'streak') end;
select case when position('ZFSOLO' in :'r') = 0 and position('СЕКРЕТ' in :'r') = 0
             and position('ошиб' in :'r') = 0 and position('знак' in :'r') = 0
             and position('перепутал' in :'r') = 0 and position('4242' in :'r') = 0
             and position('2026-01' in :'r') = 0
            then 'ДА  ни логина, ни метки, ни ошибок, ни счёта, ни дат наружу не ушло'
            else 'НЕТ утечка в ответе: ' || :'r' end;
select case when (session_friends(:'solo', :'today'))->'friends'->0->>'name' = 'Маша'
            then 'ДА  дружба видна с обеих сторон'
            else 'НЕТ у второго нет друга' end;

-- Серия рвётся, если пропуск длиннее заморозок, и хвост до сегодня тоже считается.
select case when fr_streak((select jsonb_object_agg(to_char(current_date + d, 'YYYY-MM-DD'), '{"c":25}'::jsonb)
                              from generate_series(-6, -3) d), current_date) = 0
             and fr_streak((select jsonb_object_agg(to_char(current_date + d, 'YYYY-MM-DD'), '{"c":25}'::jsonb)
                              from generate_series(-4, -1) d), current_date) = 4
             and fr_streak('{"2026-02-30":{"c":5},"кот":{"c":5}}'::jsonb, current_date) = 0
             and fr_streak((select jsonb_object_agg(to_char(current_date + d, 'YYYY-MM-DD'), '{"tr":3}'::jsonb)
                              from generate_series(-2, 0) d), current_date) = 3
             and fr_streak((select jsonb_object_agg(to_char(current_date + d, 'YYYY-MM-DD'), '{"s":5}'::jsonb)
                              from generate_series(0, 1) d), current_date) = 1
            then 'ДА  серия: обрыв, вчерашняя, обучение и время считаются, будущее и не-даты — нет'
            else 'НЕТ серия в особых случаях' end;

-- =====================================================================
--  6. Сравнение — только когда включили оба
-- =====================================================================
select case when (session_friend_compare(:'kid1', true))->>'compare' = 'true'
             and not ((session_friends(:'kid1', :'today'))->'friends'->0 ? 'week')
            then 'ДА  включил один — счёта за неделю нет'
            else 'НЕТ неделя видна без согласия друга' end;
select session_friend_compare(:'solo', true) \gset x_
select session_friends(:'kid1', :'today') as r \gset
select case when ((:'r'::jsonb)->'friends'->0->>'week')::int
                 = (select 25 * count(*) from generate_series(-9, 0) d
                     where d <> -3 and current_date + d >= current_date - (extract(isodow from current_date)::int - 1))
             and (:'r'::jsonb)->'me'->>'compare' = 'true'
            then 'ДА  включили оба — верные с понедельника по сегодня'
            else 'НЕТ неделя: ' || coalesce((:'r'::jsonb)->'friends'->0->>'week', '∅') end;
select case when not ((session_friends(:'kid1', '2020-01-06'))->'friends'->0->>'week')::int is distinct from
                 ((session_friends(:'kid1', :'today'))->'friends'->0->>'week')::int
            then 'ДА  чужое «сегодня» не принимается — берётся серверное'
            else 'НЕТ неделя по выдуманной дате' end;
select case when fr_week('{"2026-10-05":{"c":10},"2026-10-11":{"c":7},"2026-10-12":{"c":100},"2026-10-04":{"c":1000}}'::jsonb,
                         '2026-10-11'::date) = 17
             and fr_week('{"2026-10-12":{"c":3}}'::jsonb, '2026-10-12'::date) = 3
             and fr_week('{"2026-10-12":{"c":1e30},"2026-10-13":{"c":"много"}}'::jsonb, '2026-10-13'::date) = 1000000
            then 'ДА  неделя — с понедельника; воскресенье ещё в ней; огромные числа не роняют запрос'
            else 'НЕТ границы недели' end;
select case when (session_friend_compare(:'solo', false))->>'compare' = 'false'
             and not ((session_friends(:'kid1', :'today'))->'friends'->0 ? 'week')
            then 'ДА  выключил — счёт пропал'
            else 'НЕТ выключение сравнения' end;

-- =====================================================================
--  7. Новый код
-- =====================================================================
select session_friend_new_code(:'kid1') as r \gset
select case when (:'r'::jsonb)->>'code' <> :'kid1code'
             and (session_friend_add(:'kid3', :'kid1code'))->>'error' = 'bad_code'
             and (session_friend_add(:'kid3', (:'r'::jsonb)->>'code'))->>'status' = 'sent'
             and jsonb_array_length((session_friends(:'kid1', :'today'))->'friends') = 1
            then 'ДА  старый код больше не работает, новый работает, друзья остались'
            else 'НЕТ смена кода' end;
select case when (session_friend_new_code(:'tutor'))->>'error' = 'not_for_tutor'
            then 'ДА  у репетитора и кода нет'
            else 'НЕТ код репетитору' end;

-- =====================================================================
--  8. Пределы и срок запроса
-- =====================================================================
insert into citadel_progress (code, password_hash, owner_code, account_type, state)
select 'ZFP' || lpad(n::text, 2, '0'), null, null, 'solo', '{}'::jsonb from generate_series(1, 55) n;
insert into citadel_friend_card (code, fcode, name)
select 'ZFP' || lpad(n::text, 2, '0'), 'Q' || lpad(n::text, 5, '0'), 'Друг ' || n from generate_series(1, 55) n;
-- ZFSOLO2 зовёт двадцать — двадцать первый уже нельзя.
select case when count(*) = 20 and bool_and(r->>'status' = 'sent')
            then 'ДА  двадцать запросов уходят'
            else 'НЕТ двадцать запросов: ' || string_agg(r::text, ' ') end
  from (select session_friend_add(:'solo2', 'Q' || lpad(n::text, 5, '0')) as r from generate_series(1, 20) n) s;
select case when (session_friend_add(:'solo2', 'Q00021'))->>'error' = 'too_many_requests'
            then 'ДА  больше двадцати ждущих ответа — нельзя'
            else 'НЕТ предел запросов' end;
-- Запрос старше тридцати дней не принимается и подметается.
update citadel_friend set created_at = now() - interval '31 days' where a = 'ZFSOLO2' and b = 'ZFP01';
select id as old from citadel_friend where a = 'ZFSOLO2' and b = 'ZFP01' \gset
select impl_friend_accept('ZFP01', :old) as r \gset
select case when (:'r'::jsonb)->>'error' = 'not_found'
             and not exists (select 1 from citadel_friend where id = :old)
            then 'ДА  запрос старше месяца не принять — он подметён'
            else 'НЕТ старый запрос живёт' end;
-- У ZFP50 — пятьдесят друзей: к нему не позвать, сам он не позовёт и не примет.
delete from citadel_friend where a = 'ZFSOLO2';
insert into citadel_friend (a, b, accepted_at)
select 'ZFP50', 'ZFP' || lpad(n::text, 2, '0'), now() from generate_series(1, 49) n;
insert into citadel_friend (a, b, accepted_at) values ('ZFP50', 'ZFP51', now());
select case when (session_friend_add(:'solo2', 'Q00050'))->>'error' = 'target_full'
             and (impl_friend_add('ZFP50', :'solo2code'))->>'error' = 'too_many_friends'
            then 'ДА  больше пятидесяти друзей — нельзя ни звать, ни быть позванным'
            else 'НЕТ предел друзей' end;
insert into citadel_friend (a, b) values ('ZFP52', 'ZFP50');
select id as full_req from citadel_friend where a = 'ZFP52' and b = 'ZFP50' \gset
select case when (impl_friend_accept('ZFP50', :full_req))->>'error' = 'too_many_friends'
             and (select accepted_at from citadel_friend where id = :full_req) is null
            then 'ДА  и принять пятьдесят первого нельзя'
            else 'НЕТ принят сверх предела' end;
-- Пара одна, в какую сторону ни зови.
do $$
begin
  insert into citadel_friend (a, b) values ('ZFP51', 'ZFP50');
  raise notice 'НЕТ';
exception when unique_violation then
  null;
end $$;
select case when (select count(*) from citadel_friend where least(a, b) = 'ZFP50' and greatest(a, b) = 'ZFP51') = 1
            then 'ДА  встречная строка для той же пары не заводится'
            else 'НЕТ пара задвоилась' end;

-- =====================================================================
--  9. Сломанное состояние друга не ломает список
-- =====================================================================
update citadel_progress set state = '{"daily":"мусор","unlocks":[1,2],"collections":5,
                                      "byTopic":{"integer+:add:1":{"correct":"много"}}}'::jsonb
 where code = 'ZFP02';
insert into citadel_friend (a, b, accepted_at) values ('ZFP02', 'ZFP03', now());
select impl_friends('ZFP03', :'today') as r \gset
select case when (:'r'::jsonb)->>'ok' = 'true'
             and (:'r'::jsonb)->'friends'->0->>'streak' = '0'
             and (:'r'::jsonb)->'friends'->0->'ladders' = '[]'::jsonb
             and (:'r'::jsonb)->'friends'->0->'pics' = '[]'::jsonb
            then 'ДА  испорченный прогресс друга читается как пустой'
            else 'НЕТ сломанный друг: ' || :'r' end;

-- =====================================================================
--  10. Репетитору — имена друзей ученика
-- =====================================================================
select session_student_friends(:'tutor', 'ZFKID1') as r \gset
select case when (:'r'::jsonb)->'names' = '["Zoë O''Neil"]'::jsonb
             and (select array_agg(k) from jsonb_object_keys(:'r'::jsonb) k) <@ array['ok', 'names']
            then 'ДА  репетитор видит имена друзей своего ученика — и только имена'
            else 'НЕТ имена друзей: ' || :'r' end;
select case when (session_student_friends(:'tutor2', 'ZFKID1'))->>'error' = 'not_your_student'
             and (session_student_friends(:'tutor', 'ZFSOLO'))->>'error' = 'not_your_student'
             and (session_student_friends(:'kid2', 'ZFKID1'))->>'error' = 'not_your_student'
            then 'ДА  чужой репетитор, самостоятельный и ученик чужих друзей не видят'
            else 'НЕТ имена друзей видны не тому' end;

-- =====================================================================
--  11. Удалили аккаунт — дружбы и карточка уходят с ним
-- =====================================================================
delete from citadel_progress where code = 'ZFSOLO';
select case when not exists (select 1 from citadel_friend where a = 'ZFSOLO' or b = 'ZFSOLO')
             and not exists (select 1 from citadel_friend_card where code = 'ZFSOLO')
             and (session_friends(:'kid1', :'today'))->'friends' = '[]'::jsonb
            then 'ДА  удалённый аккаунт пропал из друзей'
            else 'НЕТ хвосты удалённого аккаунта' end;

-- =====================================================================
--  12. Снаружи
-- =====================================================================
select case when not has_table_privilege('anon', 'citadel_friend', 'select')
             and not has_table_privilege('anon', 'citadel_friend_card', 'select')
             and not has_function_privilege('anon', 'impl_friends(text, text)', 'execute')
             and not has_function_privilege('anon', 'fr_streak(jsonb, date)', 'execute')
             and has_function_privilege('anon', 'session_friends(text, text)', 'execute')
            then 'ДА  снаружи — только входы по токену'
            else 'НЕТ права' end;

delete from citadel_throttle where key like 'friend:ZF%';
delete from citadel_progress where code like 'ZF%';
