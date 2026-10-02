-- Проверка миграции exam-sections.sql. Запускать на ТЕСТОВОЙ копии:
-- скрипт заводит и удаляет аккаунты TUTOR / PUPIL / PUPIL2 и на время
-- расширяет exam_sections(). Все строки должны быть «ДА».
--
--   psql -f supabase/exam-sections.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code in ('TUTOR', 'PUPIL', 'PUPIL2');

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('TUTOR', crypt('tutorpassword', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','TUTOR','updatedAt',0,
                           'accountType','self','ownerCode',null), now());
select session_create_student((session_login('TUTOR','tutorpassword'))->>'token',
       'PUPIL', 'pupilpassword', 'Ученик') \gset mk_
select session_create_student((session_login('TUTOR','tutorpassword'))->>'token',
       'PUPIL2', 'pupilpassword', 'Ученик 2') \gset mk2_

-- 1. Сырое 'all' на положительных (выдано до того, как выдача стала его
--    разворачивать). Раньше экзамен отвечал «сдал» и ничего не называл, а
--    приложение сырое 'all' поимённым не считает — звёзды оставались за золотом.
insert into citadel_access (student_code, section, grant_json, granted_by)
values ('PUPIL', 'integer+', '"all"'::jsonb, 'TUTOR')
on conflict (student_code, section) do update set grant_json = excluded.grant_json;
select case when (impl_take_exam('PUPIL','add',3))->>'passed' = 'true'
            then 'ДА  при сыром «всё» экзамен сдан'
            else 'НЕТ экзамен не сдан' end;
select case when grant_json = '{"add": [1,2,3,4,5], "sub": [1,2,3,4,5], "mul": [1,2,3,4,5], "div": [1,2,3,4,5]}'::jsonb
            then 'ДА  сырое «всё» стало «все пять звёзд поимённо», как при выдаче'
            else 'НЕТ осталось: ' || grant_json::text end
  from citadel_access where student_code = 'PUPIL' and section = 'integer+';

-- 2. Выдача «всё» через приложение уже разворачивает её. Экзамен ничего не отнимает.
select impl_set_student_access('TUTOR','PUPIL2','integer+',
       jsonb_build_object('sub', 'all')) \gset a2_
select impl_take_exam('PUPIL2','sub',2) \gset t2_
select case when (grant_json->'sub') = '[1, 2, 3, 4, 5]'::jsonb
            then 'ДА  выданное репетитором «всё» на действии экзамен не урезал'
            else 'НЕТ на действии осталось: ' || (grant_json->'sub')::text end
  from citadel_access where student_code = 'PUPIL2' and section = 'integer+';

-- 3. Раздел не из списка — отказ, и в журнал ничего не пишется.
select case when (session_take_exam((session_login('PUPIL','pupilpassword'))->>'token',
                                    'mul', 2, 'integer-'))->>'error' = 'section_closed'
            then 'ДА  экзамен в закрытом разделе не принимается'
            else 'НЕТ закрытый раздел принят' end;
select case when not exists (select 1 from citadel_exam
                             where student_code = 'PUPIL' and section = 'integer-')
            then 'ДА  в журнал закрытого раздела ничего не записано'
            else 'НЕТ попытка записана' end;
select case when not exists (select 1 from citadel_access
                             where student_code = 'PUPIL' and section = 'integer-')
            then 'ДА  закрытый раздел экзамен не открыл'
            else 'НЕТ раздел открылся' end;

-- 4. Старая дверь с тремя параметрами работает как раньше — для положительных.
select case when (session_take_exam((session_login('PUPIL','pupilpassword'))->>'token',
                                    'div', 2))->>'level' = '2'
            then 'ДА  старый вызов без раздела работает'
            else 'НЕТ старый вызов сломался' end;
select case when section = 'integer+'
            then 'ДА  старый вызов записан в положительные'
            else 'НЕТ записан в ' || section end
  from citadel_exam where student_code = 'PUPIL' and op = 'div' order by taken_at desc limit 1;

-- 5. Попытка дня — по разделу. На время открываем экзамену отрицательные.
create or replace function exam_sections() returns text[] language sql immutable
as $$ select array['integer+', 'integer-']::text[] $$;

select impl_take_exam('PUPIL','mul',0) \gset f_
select case when (impl_take_exam('PUPIL','mul',2))->>'error' = 'already_today'
            then 'ДА  провал на положительных тратит попытку на положительных'
            else 'НЕТ вторая попытка в тот же день прошла' end;
select case when (impl_take_exam('PUPIL','mul',2,'integer-'))->>'passed' = 'true'
            then 'ДА  а на отрицательных по тому же действию сдать можно'
            else 'НЕТ попытку на отрицательных съел чужой экзамен' end;
select case when (grant_json->'mul') = '[1, 2]'::jsonb
            then 'ДА  звёзды названы в своём разделе'
            else 'НЕТ в отрицательных: ' || coalesce(grant_json::text, 'ничего') end
  from citadel_access where student_code = 'PUPIL' and section = 'integer-';

-- 6. Отрицательные, выданные репетитором целиком: 'all' там значило «раздел
--    открыт, звёзды за золото». Поимённо ничего — экзамен дописывает сданные.
select impl_set_student_access('TUTOR','PUPIL2','integer-', '"all"'::jsonb) \gset a6_
select impl_take_exam('PUPIL2','add',3,'integer-') \gset t6_
select case when (grant_json->'add') = '[1, 2, 3]'::jsonb
            then 'ДА  на отрицательных при «всё» звёзды названы'
            else 'НЕТ на отрицательных: ' || grant_json::text end
  from citadel_access where student_code = 'PUPIL2' and section = 'integer-';

-- 7. Потолок и «только добавляет» — как прежде.
select impl_set_student_access('TUTOR','PUPIL2','integer+',
       jsonb_build_object('div', jsonb_build_array(4, 5))) \gset a7_
select case when (impl_take_exam('PUPIL2','div',5))->>'level' = '3'
            then 'ДА  потолок три звезды на месте'
            else 'НЕТ потолок не сработал' end;
select case when (grant_json->'div') = '[1, 2, 3, 4, 5]'::jsonb
            then 'ДА  четвёртая и пятая от репетитора остались'
            else 'НЕТ отнято: ' || (grant_json->'div')::text end
  from citadel_access where student_code = 'PUPIL2' and section = 'integer+';

-- 8. Репетитор видит раздел в списке экзаменов.
select case when exists (select 1 from jsonb_array_elements((impl_student_exams('TUTOR','PUPIL'))->'exams') e
                         where e->>'section' = 'integer-' and e->>'op' = 'mul')
            then 'ДА  в списке экзаменов виден раздел'
            else 'НЕТ раздела в списке нет' end;

-- Возвращаем список как был и убираем за собой.
create or replace function exam_sections() returns text[] language sql immutable
as $$ select array['integer+']::text[] $$;
select case when exam_sections() = array['integer+']::text[]
            then 'ДА  список разделов вернулся к одним положительным'
            else 'НЕТ список не вернулся' end;
delete from citadel_progress where code in ('TUTOR', 'PUPIL', 'PUPIL2');
