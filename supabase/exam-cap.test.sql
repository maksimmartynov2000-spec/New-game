-- Проверка миграции exam-cap.sql. Запускать на ТЕСТОВОЙ копии:
-- скрипт заводит и удаляет аккаунты TUTOR / PUPIL. Все строки должны быть «ДА».
--
--   psql -f supabase/exam-cap.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code in ('TUTOR', 'PUPIL');

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('TUTOR', crypt('tutorpassword', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','TUTOR','updatedAt',0,
                           'accountType','self','ownerCode',null), now());
select session_create_student((session_login('TUTOR','tutorpassword'))->>'token',
       'PUPIL', 'pupilpassword', 'Ученик') \gset mk_

-- Подделка: клиент заявляет пятую звезду
select case when (impl_take_exam('PUPIL','add',5))->>'level' = '3'
            then 'ДА  заявку на 5★ срезали до 3★'
            else 'НЕТ выдали больше потолка' end;

select case when claimed_level = 5 and level = 3
            then 'ДА  в журнале видно и заявленное (5), и выданное (3)'
            else 'НЕТ журнал не показывает расхождение' end
  from citadel_exam where student_code = 'PUPIL' order by taken_at desc limit 1;

select case when (grant_json->'add') = '[1, 2, 3]'::jsonb
            then 'ДА  открыты ровно три звезды'
            else 'НЕТ открыто: ' || coalesce((grant_json->'add')::text,'ничего') end
  from citadel_access where student_code = 'PUPIL' and section = 'integer+';

-- Честный результат ниже потолка проходит как есть
select case when (impl_take_exam('PUPIL','sub',2))->>'level' = '2'
            then 'ДА  честные 2★ выдаются полностью'
            else 'НЕТ честный результат испортили' end;

-- Не сдал — ничего не открывается
select case when (impl_take_exam('PUPIL','mul',0))->>'passed' = 'false'
            then 'ДА  несданный экзамен ничего не открывает'
            else 'НЕТ несданный что-то открыл' end;

-- Потолок НЕ отнимает то, что открыл репетитор
select impl_set_student_access('TUTOR','PUPIL','integer+',
       jsonb_build_object('div', jsonb_build_array(1,2,3,4,5))) \gset acc_
select case when (impl_take_exam('PUPIL','div',5))->>'level' = '3'
            then 'ДА  заявку по div тоже срезали'
            else 'НЕТ' end;
select case when (grant_json->'div') @> '[4, 5]'::jsonb
            then 'ДА  пятая звезда от репетитора никуда не делась'
            else 'НЕТ экзамен отнял то, что открыл репетитор: ' || (grant_json->'div')::text end
  from citadel_access where student_code = 'PUPIL' and section = 'integer+';

-- Репетитор видит расхождение
select case when (e->>'claimed') = '5' and (e->>'level') = '3'
            then 'ДА  репетитору видно расхождение в списке экзаменов'
            else 'НЕТ репетитор расхождения не видит' end
  from (select jsonb_array_elements((impl_student_exams('TUTOR','PUPIL'))->'exams') as e) x
 where (e->>'op') = 'add';

select case when ((impl_student_exams('TUTOR','PUPIL'))->>'maxGrant') = '3'
            then 'ДА  потолок сообщается наружу'
            else 'НЕТ потолок не сообщается' end;

delete from citadel_progress where code in ('TUTOR', 'PUPIL');
