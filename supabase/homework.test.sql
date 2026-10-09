-- Проверка миграции homework.sql. Запускать на ТЕСТОВОЙ копии: скрипт заводит
-- и удаляет аккаунты ZH*. Все строки должны быть «ДА».
--
--   psql -f supabase/homework.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code like 'ZH%';

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values
  ('ZHTUTOR',  crypt('tutorpassword', gen_salt('bf')), null, 'self',
   '{"schema":2,"playerCode":"ZHTUTOR","updatedAt":0,"accountType":"self","ownerCode":null,"profileLabel":"Максим"}', now()),
  ('ZHTUTOR2', crypt('tutorpassword', gen_salt('bf')), null, 'self',
   '{"schema":2,"playerCode":"ZHTUTOR2","updatedAt":0,"accountType":"self","ownerCode":null}', now()),
  ('ZHSOLO',   crypt('solopassword', gen_salt('bf')), null, 'solo',
   '{"schema":2,"playerCode":"ZHSOLO","updatedAt":0,"accountType":"solo","ownerCode":null}', now());

select coalesce((session_login('ZHTUTOR', 'tutorpassword'))->>'token', '∅') as tutor \gset
select coalesce((session_login('ZHTUTOR2', 'tutorpassword'))->>'token', '∅') as tutor2 \gset
select coalesce((session_login('ZHSOLO', 'solopassword'))->>'token', '∅') as solo \gset
select session_create_student(:'tutor', 'ZHKID1', 'kidpassword1', 'Маша') \gset mk_
select session_create_student(:'tutor', 'ZHKID2', 'kidpassword2', 'Петя') \gset mk_
select session_create_student(:'tutor2', 'ZHKID3', 'kidpassword3', 'Чужой') \gset mk_
select coalesce((session_login('ZHKID1', 'kidpassword1'))->>'token', '∅') as kid1 \gset
select coalesce((session_login('ZHKID2', 'kidpassword2'))->>'token', '∅') as kid2 \gset
select coalesce((session_login('ZHKID3', 'kidpassword3'))->>'token', '∅') as kid3 \gset

-- У Маши в клетке уже сорок верных ответов.
update citadel_progress
   set state = state || '{"byTopic":{"integer+:add:3":{"correct":40,"wrong":5}}}'::jsonb
 where code = 'ZHKID1';

-- =====================================================================
--  1. Выдать
-- =====================================================================
select session_assign_homework(:'tutor', '["ZHKID1","ZHKID2","ZHKID3","ZHSOLO","ZHNOBODY","ZHKID1"]',
                               'integer+:add:3', 30, to_char(current_date + 3, 'YYYY-MM-DD')) as r \gset
select case when (:'r'::jsonb)->>'ok' = 'true'
             and (:'r'::jsonb)->'assigned' @> '["ZHKID1","ZHKID2"]'
             and jsonb_array_length((:'r'::jsonb)->'assigned') = 2
            then 'ДА  выдано своим ученикам, каждому один раз'
            else 'НЕТ выдача: ' || :'r' end;
select case when jsonb_array_length((:'r'::jsonb)->'skipped') = 3
             and not exists (select 1 from jsonb_array_elements((:'r'::jsonb)->'skipped') e
                              where e->>'error' <> 'not_your_student')
            then 'ДА  чужой ученик, самостоятельный и несуществующий — пропущены'
            else 'НЕТ пропуски: ' || ((:'r'::jsonb)->'skipped')::text end;
select case when not exists (select 1 from citadel_homework where student_code in ('ZHKID3', 'ZHSOLO'))
            then 'ДА  чужим заданий не появилось'
            else 'НЕТ чужому ученику выдано задание' end;
select case when (select base from citadel_homework where student_code = 'ZHKID1') = 40
             and (select base from citadel_homework where student_code = 'ZHKID2') = 0
            then 'ДА  запомнено, сколько верных было при выдаче'
            else 'НЕТ base: ' || (select string_agg(student_code || '=' || base, ' ') from citadel_homework) end;
select case when (select count(distinct batch) from citadel_homework where tutor_code = 'ZHTUTOR') = 1
             and (select due_on from citadel_homework where student_code = 'ZHKID1') = current_date + 3
            then 'ДА  одна выдача — одна пачка, срок записан'
            else 'НЕТ пачка или срок' end;

-- =====================================================================
--  2. Проверка того, что выдают
-- =====================================================================
select case when count(*) = 8 and bool_and(coalesce(r->>'error', '') = 'bad_topic')
            then 'ДА  несуществующие клетки не принимаются'
            else 'НЕТ клетки: ' || string_agg(r::text, ' ') end
  from (select session_assign_homework(:'tutor', '["ZHKID2"]', t, 10, null) as r
          from unnest(array['integer+:simplify:1', 'integer+:add:6', 'integer+:add:0', 'decimal-:add:1',
                            'integer+:add', 'INTEGER+:add:1', 'integer+:add:1 ', null]) t) s;
select case when (session_assign_homework(:'tutor', '["ZHKID2"]', 'fraction+:toMixed:2', 10, null))->>'ok' = 'true'
             and (session_assign_homework(:'tutor', '["ZHKID2"]', 'integer-:div:5', 10, ''))->>'ok' = 'true'
            then 'ДА  особые режимы дробей и отрицательные принимаются, пустой срок — без срока'
            else 'НЕТ допустимая клетка отвергнута' end;
select case when count(*) = 4 and bool_and(coalesce(r->>'error', '') = 'bad_need')
            then 'ДА  сколько верных — от 1 до 500'
            else 'НЕТ число: ' || string_agg(r::text, ' ') end
  from (select session_assign_homework(:'tutor', '["ZHKID2"]', 'integer+:add:1', n, null) as r
          from unnest(array[0, -5, 501, null]) n) s;
select case when count(*) = 5 and bool_and(coalesce(r->>'error', '') = 'bad_due')
            then 'ДА  срок: только дата, не в прошлом и не дальше четырёх месяцев'
            else 'НЕТ срок: ' || string_agg(r::text, ' ') end
  from (select session_assign_homework(:'tutor', '["ZHKID2"]', 'integer+:add:1', 10, d) as r
          from unnest(array['завтра', '2026-13-40', '17.10.2026',
                            to_char(current_date - 5, 'YYYY-MM-DD'),
                            to_char(current_date + 200, 'YYYY-MM-DD')]) d) s;
select case when (session_assign_homework(:'tutor', '["ZHKID2"]', 'integer+:add:1', 10,
                                          to_char(current_date - 1, 'YYYY-MM-DD')))->>'ok' = 'true'
            then 'ДА  вчерашний срок принимается — у репетитора может быть другой часовой пояс'
            else 'НЕТ вчерашний срок отвергнут' end;
select case when count(*) = 4 and bool_and(coalesce(r->>'error', '') = 'bad_students')
            then 'ДА  кому — непустой список, не больше ста'
            else 'НЕТ список: ' || string_agg(r::text, ' ') end
  from (select session_assign_homework(:'tutor', l, 'integer+:add:1', 10, null) as r
          from unnest(array['[]'::jsonb, '"ZHKID2"'::jsonb, null,
                            (select jsonb_agg('ZHX' || g) from generate_series(1, 101) g)]) l) s;
select case when (session_assign_homework(:'kid1', '["ZHKID2"]', 'integer+:add:1', 10, null))->>'error' = 'not_a_tutor'
             and (session_assign_homework(:'solo', '["ZHKID2"]', 'integer+:add:1', 10, null))->>'error' = 'not_a_tutor'
            then 'ДА  выдаёт только репетитор: ни ученик, ни самостоятельный'
            else 'НЕТ выдал не репетитор' end;
select case when (session_assign_homework('нет-такого', '["ZHKID2"]', 'integer+:add:1', 10, null))->>'error' = 'bad_session'
             and (session_tutor_homework('нет-такого'))->>'error' = 'bad_session'
             and (session_my_homework('нет-такого'))->>'error' = 'bad_session'
             and (session_cancel_homework('нет-такого', '[1]'))->>'error' = 'bad_session'
            then 'ДА  без токена — никуда'
            else 'НЕТ без токена что-то пускает' end;

-- =====================================================================
--  3. Сделанное — по состоянию ученика
-- =====================================================================
-- Задание, оставшееся от прежнего репетитора: ученика потом привязали к другому.
-- Его не должны видеть ни прежний репетитор, ни сам ученик.
insert into citadel_homework (batch, tutor_code, student_code, topic, need, base)
values (998, 'ZHTUTOR', 'ZHKID3', 'integer+:add:1', 5, 0);
update citadel_progress
   set state = state || jsonb_build_object(
         'byTopic', '{"integer+:add:3":{"correct":52,"wrong":6}}'::jsonb,
         'hwDone', jsonb_build_object(
            (select id from citadel_homework where student_code = 'ZHKID1' and topic = 'integer+:add:3')::text,
            '2026-10-10'))
 where code = 'ZHKID1';
select session_tutor_homework(:'tutor') as th \gset
select case when (select (e->>'done')::int from jsonb_array_elements((:'th'::jsonb)->'homework') e
                   where e->>'student' = 'ZHKID1' and e->>'topic' = 'integer+:add:3') = 12
             and (select (e->>'done')::int from jsonb_array_elements((:'th'::jsonb)->'homework') e
                   where e->>'student' = 'ZHKID2' and e->>'topic' = 'integer+:add:3') = 0
            then 'ДА  сделано = сколько стало минус сколько было при выдаче'
            else 'НЕТ сделано: ' || ((:'th'::jsonb)->'homework')::text end;
select case when (select e->>'doneOn' from jsonb_array_elements((:'th'::jsonb)->'homework') e
                   where e->>'student' = 'ZHKID1' and e->>'topic' = 'integer+:add:3') = '2026-10-10'
             and (select e->>'label' from jsonb_array_elements((:'th'::jsonb)->'homework') e
                   where e->>'student' = 'ZHKID1' limit 1) = 'Маша'
            then 'ДА  дата выполнения и имя ученика видны репетитору'
            else 'НЕТ дата или имя' end;
select case when not exists (select 1 from jsonb_array_elements((:'th'::jsonb)->'homework') e
                              where e->>'student' = 'ZHKID3')
             and jsonb_array_length((session_tutor_homework(:'tutor2'))->'homework') = 0
            then 'ДА  репетитор видит только своих, второй — ничего чужого'
            else 'НЕТ видно чужое' end;

-- Битое состояние: счётчик строкой, дата не дата.
update citadel_progress
   set state = state || jsonb_build_object(
         'byTopic', '{"integer+:add:3":{"correct":"много"}}'::jsonb,
         'hwDone', jsonb_build_object(
            (select id from citadel_homework where student_code = 'ZHKID1' and topic = 'integer+:add:3')::text,
            'вчера'))
 where code = 'ZHKID1';
select session_tutor_homework(:'tutor') as th2 \gset
select case when (:'th2'::jsonb)->>'ok' = 'true'
             and (select (e->>'done')::int from jsonb_array_elements((:'th2'::jsonb)->'homework') e
                   where e->>'student' = 'ZHKID1' and e->>'topic' = 'integer+:add:3') = 0
             and (select e->'doneOn' from jsonb_array_elements((:'th2'::jsonb)->'homework') e
                   where e->>'student' = 'ZHKID1' and e->>'topic' = 'integer+:add:3') = 'null'::jsonb
            then 'ДА  битое состояние ученика не роняет список: ноль и без даты'
            else 'НЕТ битое состояние: ' || :'th2' end;

-- =====================================================================
--  4. Ученик видит свои задания
-- =====================================================================
select session_my_homework(:'kid1') as mh \gset
select case when jsonb_array_length((:'mh'::jsonb)->'homework') = 1
             and (:'mh'::jsonb)->'homework'->0->>'topic' = 'integer+:add:3'
             and ((:'mh'::jsonb)->'homework'->0->>'need')::int = 30
             and ((:'mh'::jsonb)->'homework'->0->>'base')::int = 40
             and (:'mh'::jsonb)->'homework'->0->>'dueOn' = to_char(current_date + 3, 'YYYY-MM-DD')
            then 'ДА  ученику приходит клетка, сколько надо, с чего считать и срок'
            else 'НЕТ свои задания: ' || :'mh' end;
select case when jsonb_array_length((session_my_homework(:'kid3'))->'homework') = 0
             and jsonb_array_length((session_my_homework(:'solo'))->'homework') = 0
            then 'ДА  чужому и самостоятельному — пусто'
            else 'НЕТ видны чужие задания' end;

-- =====================================================================
--  5. Звезда задания открывается
-- =====================================================================
delete from citadel_access where student_code in ('ZHKID1', 'ZHKID2');
insert into citadel_access (student_code, section, grant_json) values
  ('ZHKID1', 'integer+',  '{"add":[1,2]}'),
  ('ZHKID1', 'decimal+',  '"all"'),
  ('ZHKID1', 'fraction+', '{"mul":"all","add":[1]}');
select session_assign_homework(:'tutor', '["ZHKID1","ZHKID2"]', 'integer-:mul:2', 10, null) as o1 \gset
select case when (select grant_json from citadel_access where student_code = 'ZHKID2' and section = 'integer-')
                 = '{"mul":[2]}'::jsonb
             and (:'o1'::jsonb)->'opened' @> '["ZHKID2"]'
            then 'ДА  закрытый раздел: открыта ровно одна звезда задания'
            else 'НЕТ закрытый раздел: ' || coalesce((select grant_json::text from citadel_access
                                                       where student_code = 'ZHKID2' and section = 'integer-'), 'нет доступа') end;
select session_assign_homework(:'tutor', '["ZHKID1"]', 'integer+:add:4', 10, null) as o2 \gset
select case when (select grant_json from citadel_access where student_code = 'ZHKID1' and section = 'integer+')
                 = '{"add":[1,2,4]}'::jsonb
            then 'ДА  звезда дописана к уже открытым, по порядку'
            else 'НЕТ дописывание: ' || (select grant_json::text from citadel_access
                                          where student_code = 'ZHKID1' and section = 'integer+') end;
select session_assign_homework(:'tutor', '["ZHKID1"]', 'fraction+:sub:3', 10, null) as o3 \gset
select case when (select grant_json from citadel_access where student_code = 'ZHKID1' and section = 'fraction+')
                 = '{"mul":"all","add":[1],"sub":[3]}'::jsonb
            then 'ДА  новое действие в открытом разделе — добавлено, остальное как было'
            else 'НЕТ новое действие: ' || (select grant_json::text from citadel_access
                                             where student_code = 'ZHKID1' and section = 'fraction+') end;
select session_assign_homework(:'tutor', '["ZHKID1"]', 'fraction+:mul:5', 10, null) as o4 \gset
select session_assign_homework(:'tutor', '["ZHKID1"]', 'decimal+:div:4', 10, null) as o5 \gset
select session_assign_homework(:'tutor', '["ZHKID1"]', 'integer+:add:2', 10, null) as o6 \gset
select case when (select grant_json from citadel_access where student_code = 'ZHKID1' and section = 'fraction+')
                 = '{"mul":"all","add":[1],"sub":[3]}'::jsonb
             and (select grant_json from citadel_access where student_code = 'ZHKID1' and section = 'decimal+')
                 = '"all"'::jsonb
             and jsonb_array_length((:'o4'::jsonb)->'opened') = 0
             and jsonb_array_length((:'o5'::jsonb)->'opened') = 0
             and jsonb_array_length((:'o6'::jsonb)->'opened') = 0
            then 'ДА  открытое целиком и уже открытое не трогается'
            else 'НЕТ тронуто открытое: ' || (select string_agg(section || '=' || grant_json::text, ' ')
                                               from citadel_access where student_code = 'ZHKID1') end;

-- =====================================================================
--  6. Снять задание
-- =====================================================================
select (select jsonb_agg(id) from citadel_homework where tutor_code = 'ZHTUTOR' and student_code = 'ZHKID2') as ids2 \gset
select case when ((session_cancel_homework(:'tutor2', :'ids2'))->>'removed')::int = 0
             and (select count(*) from citadel_homework where student_code = 'ZHKID2') > 0
            then 'ДА  чужие задания не снять'
            else 'НЕТ снял чужое' end;
select session_cancel_homework(:'tutor', :'ids2') as c1 \gset
select case when ((:'c1'::jsonb)->>'removed')::int = jsonb_array_length(:'ids2'::jsonb)
             and not exists (select 1 from citadel_homework where student_code = 'ZHKID2')
             and jsonb_array_length((session_my_homework(:'kid2'))->'homework') = 0
            then 'ДА  своё снимается, ученик его больше не видит'
            else 'НЕТ снятие: ' || :'c1' end;
select case when count(*) = 4 and bool_and(coalesce(r->>'error', '') = 'bad_ids')
            then 'ДА  что снимать — непустой список, не больше двухсот'
            else 'НЕТ список: ' || string_agg(r::text, ' ') end
  from (select session_cancel_homework(:'tutor', l) as r
          from unnest(array['[]'::jsonb, '7'::jsonb, null,
                            (select jsonb_agg(g) from generate_series(1, 201) g)]) l) s;
select case when ((session_cancel_homework(:'tutor', '["x", 1.5, -3, null]'))->>'removed')::int = 0
            then 'ДА  мусор в списке ничего не снимает и не роняет запрос'
            else 'НЕТ мусор в списке' end;

-- =====================================================================
--  7. Потолок и уборка
-- =====================================================================
insert into citadel_homework (batch, tutor_code, student_code, topic, need, base)
select 999, 'ZHTUTOR', 'ZHKID2', 'integer+:add:1', 5, 0 from generate_series(1, 30);
select session_assign_homework(:'tutor', '["ZHKID2"]', 'integer+:add:1', 10, null) as lim \gset
select case when jsonb_array_length((:'lim'::jsonb)->'assigned') = 0
             and (:'lim'::jsonb)->'skipped'->0->>'error' = 'too_many'
            then 'ДА  больше тридцати заданий одному ученику не выдать'
            else 'НЕТ потолок: ' || :'lim' end;
update citadel_homework set created_at = now() - interval '91 days' where student_code = 'ZHKID2';
select session_assign_homework(:'tutor', '["ZHKID2"]', 'integer+:add:1', 10, null) as sw \gset
select case when (:'sw'::jsonb)->'assigned' @> '["ZHKID2"]'
             and (select count(*) from citadel_homework where student_code = 'ZHKID2') = 1
            then 'ДА  задания старше трёх месяцев уходят сами'
            else 'НЕТ старое осталось' end;

-- Отпустили ученика: его задания не видны ни ему, ни репетитору и уходят при следующей выдаче.
select session_release_student(:'tutor', 'ZHKID1') \gset rel_
select case when jsonb_array_length((session_my_homework(:'kid1'))->'homework') = 0
             and not exists (select 1 from jsonb_array_elements((session_tutor_homework(:'tutor'))->'homework') e
                              where e->>'student' = 'ZHKID1')
            then 'ДА  отпущенный ученик: прежние задания не видны никому'
            else 'НЕТ видны задания отпущенного' end;
select session_assign_homework(:'tutor', '["ZHKID2"]', 'integer+:sub:1', 10, null) \gset sw2_
select case when not exists (select 1 from citadel_homework where student_code = 'ZHKID1')
            then 'ДА  и уходят при следующей выдаче'
            else 'НЕТ задания отпущенного остались' end;

-- Удалили ученика — задания ушли вместе с ним.
select session_delete_student(:'tutor', 'ZHKID2') \gset del_
select case when not exists (select 1 from citadel_homework where student_code = 'ZHKID2')
            then 'ДА  удалённый ученик уносит свои задания'
            else 'НЕТ задания удалённого остались' end;

-- =====================================================================
--  8. Права
-- =====================================================================
select case when not has_function_privilege('anon', 'impl_assign_homework(text, jsonb, text, int, text)', 'execute')
             and not has_function_privilege('anon', 'hw_open_cell(text, text, text)', 'execute')
             and not has_table_privilege('anon', 'citadel_homework', 'select')
             and has_function_privilege('anon', 'session_assign_homework(text, jsonb, text, int, text)', 'execute')
            then 'ДА  снаружи — только входы по токену'
            else 'НЕТ права не те' end;

delete from citadel_progress where code like 'ZH%';
