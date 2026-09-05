-- Проверка миграции password-length.sql. Запускать на ТЕСТОВОЙ копии:
-- скрипт заводит и удаляет аккаунты TUTOR / SHORTPW / NEWPUPIL.
-- Все строки должны быть «ДА».
--
--   psql -f supabase/password-length.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code in ('TUTOR', 'SHORTPW', 'NEWPUPIL');

-- Репетитор со СТАРЫМ коротким паролем — он заведён до миграции.
insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values ('TUTOR', crypt('abcd', gen_salt('bf')), null, 'self',
        jsonb_build_object('schema',2,'playerCode','TUTOR','updatedAt',0,
                           'accountType','self','ownerCode',null), now());

-- Главное: старый короткий пароль ПРОДОЛЖАЕТ пускать. Иначе запертые снаружи
-- ученики — это ровно та беда, от которой мы защищаемся.
select case when (session_login('TUTOR','abcd'))->>'ok' = 'true'
            then 'ДА  старый короткий пароль по-прежнему пускает'
            else 'НЕТ старый пароль перестал работать — это хуже, чем было' end;

-- Ученика с коротким паролем завести уже нельзя.
select case when (session_create_student((session_login('TUTOR','abcd'))->>'token',
                  'SHORTPW','abcd','Короткий'))->>'error' = 'password_too_short'
            then 'ДА  ученика с коротким паролем не завести'
            else 'НЕТ короткий пароль приняли' end;

-- Ровно семь символов — ещё мало.
select case when (session_create_student((session_login('TUTOR','abcd'))->>'token',
                  'SHORTPW','abcdefg','Семь'))->>'error' = 'password_too_short'
            then 'ДА  семь символов не проходят'
            else 'НЕТ семь символов приняли' end;

-- Восемь — уже можно.
select case when (session_create_student((session_login('TUTOR','abcd'))->>'token',
                  'NEWPUPIL','abcdefgh','Восемь'))->>'ok' = 'true'
            then 'ДА  восемь символов принимаются'
            else 'НЕТ восемь символов не приняли' end;

-- Сброс пароля ученику: то же правило.
select case when (session_reset_student_password((session_login('TUTOR','abcd'))->>'token',
                  'NEWPUPIL','abcd'))->>'error' = 'password_too_short'
            then 'ДА  сбросить на короткий нельзя'
            else 'НЕТ сброс на короткий прошёл' end;

select case when (session_reset_student_password((session_login('TUTOR','abcd'))->>'token',
                  'NEWPUPIL','longenough1'))->>'ok' = 'true'
            then 'ДА  сброс на длинный проходит'
            else 'НЕТ сброс на длинный не прошёл' end;

-- Смена своего пароля: то же правило, и старый пароль при этом короткий.
select case when (change_own_password('TUTOR','abcd','abcd1'))->>'error' = 'password_too_short'
            then 'ДА  свой пароль на короткий не сменить'
            else 'НЕТ приняли короткий новый пароль' end;

select case when (change_own_password('TUTOR','abcd','newlongpass'))->>'ok' = 'true'
            then 'ДА  свой пароль на длинный меняется'
            else 'НЕТ смена на длинный не прошла' end;

select case when (session_login('TUTOR','newlongpass'))->>'ok' = 'true'
            then 'ДА  после смены пускает новый пароль'
            else 'НЕТ новый пароль не пускает' end;

delete from citadel_progress where code in ('TUTOR', 'SHORTPW', 'NEWPUPIL');
