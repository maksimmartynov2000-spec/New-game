-- Проверки восстановления. Запускать ПОСЛЕ restore.sql на чистой базе.
-- Каждая строка должна ответить «ДА».

\pset tuples_only on
\pset format unaligned

-- Два репетитора и по ученику у каждого. Заводим прямо в таблице: своей функции
-- «создать репетитора» у приложения нет, репетитор один и заведён вручную.
delete from citadel_progress where code in ('TUTOR1','TUTOR2','PUPIL1','PUPIL2');
insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('TUTOR1', crypt('tutorpassword', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','TUTOR1','accountType','self','ownerCode',null), now()),
       ('TUTOR2', crypt('tutorpassword2', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','TUTOR2','accountType','self','ownerCode',null), now());

select session_create_student((session_login('TUTOR1','tutorpassword'))->>'token',
                              'PUPIL1', 'pupilpassword', 'Ученик 1');
select session_create_student((session_login('TUTOR2','tutorpassword2'))->>'token',
                              'PUPIL2', 'pupilpassword2', 'Ученик 2');

select (session_login('TUTOR1','tutorpassword'))->>'token'  as t1 \gset
select (session_login('TUTOR2','tutorpassword2'))->>'token' as t2 \gset

-- 1. Свой ученик восстанавливается.
select case when (session_restore_student(:'t1', 'PUPIL1',
         '{"totals":{"correct":777}}'::jsonb))->>'ok' = 'true'
       then 'ДА' else 'НЕТ' end as "Свой ученик восстанавливается";

select case when (impl_student_state('TUTOR1','PUPIL1'))->'state'->'totals'->>'correct' = '777'
       then 'ДА' else 'НЕТ' end as "Состояние записалось";

-- 2. Чужого восстановить нельзя.
select case when (session_restore_student(:'t2', 'PUPIL1',
         '{"totals":{"correct":1}}'::jsonb))->>'error' = 'not_your_student'
       then 'ДА' else 'НЕТ' end as "Чужого нельзя";

select case when (impl_student_state('TUTOR1','PUPIL1'))->'state'->'totals'->>'correct' = '777'
       then 'ДА' else 'НЕТ' end as "Чужая попытка ничего не изменила";

-- 3. Без токена нельзя.
select case when (session_restore_student('поддельный', 'PUPIL1',
         '{"totals":{"correct":2}}'::jsonb))->>'error' = 'bad_session'
       then 'ДА' else 'НЕТ' end as "Без настоящего токена нельзя";

-- 4. Владельца копией не переписать: это и есть увод ученика.
select session_restore_student(:'t1', 'PUPIL1',
       '{"ownerCode":"TUTOR2","accountType":"self","totals":{"correct":5}}'::jsonb);

select case when (impl_student_state('TUTOR1','PUPIL1'))->'state'->>'ownerCode' = 'TUTOR1'
       then 'ДА' else 'НЕТ' end as "Владелец не подменён";

select case when (impl_student_state('TUTOR1','PUPIL1'))->'state'->>'accountType' = 'linked'
       then 'ДА' else 'НЕТ' end as "Тип не подменён";

-- 5. Мусор вместо состояния отвергается.
select case when (session_restore_student(:'t1', 'PUPIL1', '"строка"'::jsonb))->>'error' = 'bad_state'
       then 'ДА' else 'НЕТ' end as "Не объект — отказ";

select case when (session_restore_student(:'t1', 'PUPIL1', null))->>'error' = 'bad_state'
       then 'ДА' else 'НЕТ' end as "Пустое состояние — отказ";

-- 6. Несуществующий ученик — тоже отказ, а не тихое создание.
select case when (session_restore_student(:'t1', 'НЕТТАКОГО',
         '{"totals":{"correct":1}}'::jsonb))->>'error' = 'not_your_student'
       then 'ДА' else 'НЕТ' end as "Несуществующего не заводим";
