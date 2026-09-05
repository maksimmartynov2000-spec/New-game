-- Проверка session_logout_others. Запускать на ТЕСТОВОЙ копии: скрипт заводит
-- и удаляет аккаунт TUTOR. Все строки должны быть «ДА».
--
--   psql -f supabase/logout-others.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code = 'TUTOR';
insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('TUTOR', crypt('tutorpassword', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','TUTOR','accountType','self','ownerCode',null), now());

-- Четыре входа, как с четырёх устройств. Последний считаем «текущим».
select (session_login('TUTOR','tutorpassword'))->>'token' as t1 \gset
select (session_login('TUTOR','tutorpassword'))->>'token' as t2 \gset
select (session_login('TUTOR','tutorpassword'))->>'token' as t3 \gset
select (session_login('TUTOR','tutorpassword'))->>'token' as t4 \gset

select case when count(*) = 4 then 'ДА  четыре входа заведены' else 'НЕТ входов: ' || count(*) end
  from citadel_session where code = 'TUTOR';

select case when (session_logout_others(:'t4'))->>'closed' = '3'
            then 'ДА  закрыто ровно три чужих входа'
            else 'НЕТ закрыто не столько' end;

select case when count(*) = 1 then 'ДА  остался ровно один вход'
            else 'НЕТ осталось: ' || count(*) end
  from citadel_session where code = 'TUTOR';

select case when session_owner(:'t4') = 'TUTOR'
            then 'ДА  текущее устройство осталось в игре'
            else 'НЕТ запёрли сами себя' end;

select case when session_owner(:'t1') is null
            then 'ДА  чужой токен больше не действует'
            else 'НЕТ старый токен всё ещё пускает' end;

select case when (session_logout_others(:'t4'))->>'closed' = '0'
            then 'ДА  повторный вызов ничего не ломает'
            else 'НЕТ повторный вызов что-то закрыл' end;

select case when (session_logout_others('не токен'))->>'error' = 'bad_session'
            then 'ДА  с чужим токеном не работает'
            else 'НЕТ приняли негодный токен' end;

delete from citadel_progress where code = 'TUTOR';
