-- Проверка миграции owner-columns.sql на настоящей базе.
--
-- Пароли здесь длиннее восьми символов не случайно: password-length.sql поднял
-- минимум, и короткие пароли перестали приниматься при заведении ученика.
--
-- Запускать на ТЕСТОВОЙ копии, не на рабочей: скрипт заводит и удаляет
-- аккаунты TUTOR / PUPIL / PUPIL2. Каждая строка выводит «ДА» или «НЕТ» —
-- все должны быть «ДА».
--
--   psql -f supabase/owner-columns.test.sql
--
-- Что проверяется: ученик не может отвязаться от репетитора ни новым путём
-- (по токену), ни старым (по паролю), не может назначить себя репетитором,
-- при этом обычный прогресс пишется как обычно, а сам репетитор остаётся собой.

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code in ('TUTOR', 'PUPIL', 'PUPIL2');

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('TUTOR', crypt('tutorpassword', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema', 2, 'playerCode', 'TUTOR', 'updatedAt', 0,
                           'accountType', 'self', 'ownerCode', null), now());

select case when (session_create_student((session_login('TUTOR','tutorpassword'))->>'token',
                  'PUPIL', 'pupilpassword', 'Ученик'))->>'ok' = 'true'
            then 'ДА  ученик заводится' else 'НЕТ ученик не завёлся' end;

select case when owner_code = 'TUTOR' and account_type = 'linked'
            then 'ДА  у нового ученика заполнены колонки'
            else 'НЕТ колонки пустые: ' || coalesce(owner_code,'null') || '/' || coalesce(account_type,'null') end
  from citadel_progress where code = 'PUPIL';

-- Атака по токену
select session_save((session_login('PUPIL','pupilpassword'))->>'token',
       jsonb_build_object('playerCode','PUPIL','updatedAt',999,
                          'accountType','self','ownerCode',null)) \gset attack1_
select case when account_type = 'linked' and owner_code = 'TUTOR'
                 and state->>'accountType' = 'linked' and state->>'ownerCode' = 'TUTOR'
            then 'ДА  отвязаться по токену не вышло'
            else 'НЕТ отвязался: ' || coalesce(owner_code,'null') || '/' || account_type end
  from citadel_progress where code = 'PUPIL';

-- Атака по старому паролю
select save_state('PUPIL','pupilpassword',
       jsonb_build_object('playerCode','PUPIL','accountType','self','ownerCode',null)) \gset attack2_
select case when account_type = 'linked' and owner_code = 'TUTOR'
            then 'ДА  отвязаться по паролю тоже не вышло'
            else 'НЕТ отвязался по старому пути' end
  from citadel_progress where code = 'PUPIL';

-- Репетитор остаётся репетитором, что бы ни прислал
select session_save((session_login('TUTOR','tutorpassword'))->>'token',
       jsonb_build_object('playerCode','TUTOR','accountType','linked','ownerCode','ЧУЖОЙ')) \gset attack3_
select case when account_type = 'self' and owner_code is null
                 and state->>'accountType' = 'self'
            then 'ДА  репетитор остался репетитором'
            else 'НЕТ репетитор испортился' end
  from citadel_progress where code = 'TUTOR';

-- Репетитор по-прежнему видит ученика
select case when jsonb_array_length((impl_list_students('TUTOR'))->'students') = 1
                 and (impl_student_state('TUTOR','PUPIL'))->>'ok' = 'true'
            then 'ДА  репетитор видит ученика и его состояние'
            else 'НЕТ репетитор потерял ученика' end;

-- Обычный прогресс пишется как раньше
select session_save((session_login('PUPIL','pupilpassword'))->>'token',
       jsonb_build_object('playerCode','PUPIL',
                          'totals', jsonb_build_object('correct',42,'wrong',3))) \gset save_
select case when state->'totals'->>'correct' = '42' and state->>'accountType' = 'linked'
            then 'ДА  прогресс пишется, тип не портится'
            else 'НЕТ прогресс не записался' end
  from citadel_progress where code = 'PUPIL';

-- Ученик не заводит своих учеников
select case when (session_create_student((session_login('PUPIL','pupilpassword'))->>'token',
                  'PUPIL2','pw12345678','x'))->>'error' = 'not_a_tutor'
            then 'ДА  ученик не может завести ученика'
            else 'НЕТ ученику дали завести ученика' end;

delete from citadel_progress where code in ('TUTOR', 'PUPIL', 'PUPIL2');
