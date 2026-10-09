-- Проверка миграции password-null.sql. Запускать на ТЕСТОВОЙ копии: скрипт
-- заводит и удаляет аккаунты ZNULTUTOR / ZNULKID. Все строки должны быть «ДА».
--
--   psql -f supabase/password-null.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code in ('ZNULTUTOR', 'ZNULKID');

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('ZNULTUTOR', crypt('tutorpassword', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','ZNULTUTOR','updatedAt',0,
                           'accountType','self','ownerCode',null), now()),
       ('ZNULKID', crypt('kidpassword1', gen_salt('bf')), null, 'solo',
        jsonb_build_object('schema',2,'playerCode','ZNULKID','updatedAt',0,
                           'accountType','solo','ownerCode',null), now());

-- 1. Вход.
select case when (session_login('ZNULTUTOR', null))->>'ok' = 'false'
            then 'ДА  вход с паролем null не пускает'
            else 'НЕТ вход с паролем null пустил' end;
select case when (session_login('ZNULTUTOR', ''))->>'ok' = 'false'
            then 'ДА  вход с пустым паролем не пускает'
            else 'НЕТ вход с пустым паролем пустил' end;
select case when (session_login('ZNULTUTOR', 'wrongpassword'))->>'ok' = 'false'
            then 'ДА  неверный пароль не пускает'
            else 'НЕТ неверный пароль пустил' end;
select case when (session_login('ZNULTUTOR', 'tutorpassword')) ? 'token'
            then 'ДА  верный пароль пускает, как раньше'
            else 'НЕТ верный пароль перестал пускать' end;

-- 2. Смена своего пароля: старый null не годится, верный — как раньше.
select (session_login('ZNULTUTOR', 'tutorpassword'))->>'token' as tok \gset
select case when (session_change_own_password(:'tok', null, 'newpassword1'))->>'error' = 'bad_credentials'
            then 'ДА  смена пароля со старым null отказана'
            else 'НЕТ смена пароля со старым null прошла' end;
select case when (session_login('ZNULTUTOR', 'newpassword1'))->>'ok' = 'false'
            then 'ДА  пароль после отказа не сменился'
            else 'НЕТ пароль сменился без старого' end;
select case when (session_change_own_password(:'tok', 'tutorpassword', 'newpassword1'))->>'ok' = 'true'
            then 'ДА  с верным старым паролем смена проходит'
            else 'НЕТ смена с верным паролем сломалась' end;

-- 3. Удаление своего аккаунта: пароль null не годится, аккаунт на месте.
select (session_login('ZNULKID', 'kidpassword1'))->>'token' as kid \gset
select case when (session_delete_account(:'kid', null))->>'error' = 'bad_credentials'
            then 'ДА  удаление с паролем null отказано'
            else 'НЕТ удаление с паролем null прошло' end;
select case when exists (select 1 from citadel_progress where code = 'ZNULKID')
            then 'ДА  аккаунт после отказа на месте'
            else 'НЕТ аккаунт удалён без пароля' end;
select case when (session_delete_account(:'kid', 'kidpassword1'))->>'ok' = 'true'
            then 'ДА  с верным паролем удаление проходит'
            else 'НЕТ удаление с верным паролем сломалось' end;

delete from citadel_progress where code in ('ZNULTUTOR', 'ZNULKID');
