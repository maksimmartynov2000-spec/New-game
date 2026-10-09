-- Проверка миграции account-link.sql. Запускать на ТЕСТОВОЙ копии: скрипт
-- заводит и удаляет аккаунты ZL*. Все строки должны быть «ДА».
--
--   psql -f supabase/account-link.test.sql

\pset tuples_only on
\pset format unaligned

delete from citadel_progress where code like 'ZL%';
delete from citadel_throttle where key like '%:ZL%';

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values
  ('ZLTUTOR',  crypt('tutorpassword', gen_salt('bf')), null, 'self',
   '{"schema":2,"playerCode":"ZLTUTOR","updatedAt":0,"accountType":"self","ownerCode":null,"profileLabel":"Максим"}', now()),
  ('ZLTUTOR2', crypt('tutorpassword', gen_salt('bf')), null, 'self',
   '{"schema":2,"playerCode":"ZLTUTOR2","updatedAt":0,"accountType":"self","ownerCode":null,"profileLabel":""}', now()),
  -- Самостоятельный с прогрессом в двух закрытых для учеников разделах (как у
  -- аккаунтов, задетых старой ошибкой с типом) и в положительных.
  ('ZLKID',    crypt('kidpassword1', gen_salt('bf')), null, 'solo',
   '{"schema":2,"playerCode":"ZLKID","updatedAt":5,"accountType":"solo","ownerCode":null,
     "byTopic":{"integer+:add:1":{"correct":40,"wrong":2},"integer-:add:2":{"correct":12,"wrong":3},
                "fraction+:simplify:1":{"correct":5,"wrong":1}}}', now()),
  ('ZLKID2',   crypt('kidpassword2', gen_salt('bf')), null, 'solo',
   '{"schema":2,"playerCode":"ZLKID2","updatedAt":0,"accountType":"solo","ownerCode":null}', now());

select coalesce((session_login('ZLTUTOR', 'tutorpassword'))->>'token', '∅') as tutor \gset
select coalesce((session_login('ZLTUTOR2', 'tutorpassword'))->>'token', '∅') as tutor2 \gset
select coalesce((session_login('ZLKID', 'kidpassword1'))->>'token', '∅') as kid \gset
select coalesce((session_login('ZLKID2', 'kidpassword2'))->>'token', '∅') as kid2 \gset
select session_create_student(:'tutor', 'ZLPUPIL', 'pupilpassword', 'Ученик') \gset mk_
select coalesce((session_login('ZLPUPIL', 'pupilpassword'))->>'token', '∅') as pupil \gset

-- =====================================================================
--  1. Пауза после неверных паролей
-- =====================================================================
select case when count(*) = 5 and bool_and(coalesce(r->>'error', '') = 'bad_credentials' and coalesce((r->>'wait')::int, -1) = 0)
            then 'ДА  первые пять ошибок — без паузы'
            else 'НЕТ уже на первых ошибках пауза: ' || string_agg(r::text, ' ') end
  from (select session_login('ZLKID2', 'wrong' || g) as r from generate_series(1, 5) g) s;
select case when (r->>'error') = 'bad_credentials' and (r->>'wait')::int = 60
            then 'ДА  шестая ошибка — пауза минута'
            else 'НЕТ после шестой: ' || r::text end
  from (select session_login('ZLKID2', 'wrong6') as r) s;
select case when (r->>'error') = 'too_many' and (r->>'wait')::int between 1 and 60
            then 'ДА  во время паузы не пускает даже верный пароль'
            else 'НЕТ во время паузы: ' || r::text end
  from (select session_login('ZLKID2', 'kidpassword2') as r) s;
select case when (r->>'error') = 'too_many'
            then 'ДА  во время паузы пустой пароль тоже отказ, а не проверка'
            else 'НЕТ во время паузы: ' || r::text end
  from (select session_login('ZLKID2', null) as r) s;

-- Пауза прошла.
update citadel_throttle set locked_until = now() - interval '1 second' where key = 'login:ZLKID2';
select case when (session_login('ZLKID2', 'wrong7'))->>'wait' = '120'
            then 'ДА  седьмая ошибка — две минуты (пауза растёт)'
            else 'НЕТ пауза не растёт' end;
update citadel_throttle set locked_until = now() - interval '1 second' where key = 'login:ZLKID2';
select case when (session_login('ZLKID2', null))->>'wait' = '240'
            then 'ДА  пустой пароль — тоже ошибка, и пауза растёт дальше'
            else 'НЕТ пустой пароль не считается' end;
update citadel_throttle set failures = 40, locked_until = now() - interval '1 second' where key = 'login:ZLKID2';
select case when (session_login('ZLKID2', 'wrong'))->>'wait' = '3600'
            then 'ДА  пауза не больше часа'
            else 'НЕТ пауза больше часа' end;
update citadel_throttle set locked_until = now() - interval '1 second' where key = 'login:ZLKID2';
-- Вызов и проверку состояния — разными запросами: подзапрос в том же запросе
-- видит базу такой, какой она была ДО вызова.
select coalesce((session_login('ZLKID2', 'kidpassword2'))->>'ok', '∅') as after_ok \gset
select case when :'after_ok' = 'true'
             and not exists (select 1 from citadel_throttle where key = 'login:ZLKID2')
            then 'ДА  после паузы верный пароль пускает и счёт обнуляется'
            else 'НЕТ после паузы не пускает или счёт остался' end;

-- Сутки без ошибок — счёт заново.
select session_login('ZLKID2', 'wrong') \gset x_
update citadel_throttle set failures = 9, last_failure_at = now() - interval '25 hours', locked_until = null
 where key = 'login:ZLKID2';
select coalesce((session_login('ZLKID2', 'wrong'))->>'wait', '∅') as day_wait \gset
select case when :'day_wait' = '0'
             and (select failures from citadel_throttle where key = 'login:ZLKID2') = 1
            then 'ДА  через сутки без ошибок счёт начинается заново'
            else 'НЕТ старые ошибки не забываются' end;
delete from citadel_throttle where key = 'login:ZLKID2';

select coalesce((session_login('ZLNOBODY', 'whatever'))->>'error', '∅') as nobody \gset
select case when :'nobody' = 'bad_credentials'
             and not exists (select 1 from citadel_throttle where key = 'login:ZLNOBODY')
            then 'ДА  несуществующий логин: тот же ответ, мусора в таблице нет'
            else 'НЕТ несуществующий логин отличим или засоряет таблицу' end;

-- Сброс пароля репетитором снимает паузу.
select count(*) as tries from (select session_login('ZLPUPIL', 'w' || g) from generate_series(1, 6) g) s \gset
select case when exists (select 1 from citadel_throttle where key = 'login:ZLPUPIL' and locked_until > now())
            then 'ДА  ученика заперли чужими попытками'
            else 'НЕТ паузы у ученика нет' end;
select session_reset_student_password(:'tutor', 'ZLPUPIL', 'newpupilpass') \gset rs_
select case when (session_login('ZLPUPIL', 'newpupilpass'))->>'ok' = 'true'
            then 'ДА  сброс пароля репетитором снимает паузу'
            else 'НЕТ после сброса ученик всё ещё заперт' end;
select coalesce((session_login('ZLPUPIL', 'newpupilpass'))->>'token', '∅') as pupil \gset

-- Смена пароля и удаление — с той же паузой.
insert into citadel_throttle (key, failures, last_failure_at, locked_until)
values ('login:ZLKID2', 6, now(), now() + interval '1 minute')
on conflict (key) do update set locked_until = excluded.locked_until;
select case when (session_change_own_password(:'kid2', 'kidpassword2', 'newpassword2'))->>'error' = 'too_many'
            then 'ДА  смена пароля во время паузы не проверяет старый'
            else 'НЕТ смена пароля мимо паузы' end;
select coalesce((session_delete_account(:'kid2', 'kidpassword2'))->>'error', '∅') as del_err \gset
select case when :'del_err' = 'too_many'
             and exists (select 1 from citadel_progress where code = 'ZLKID2')
            then 'ДА  удаление во время паузы не проходит'
            else 'НЕТ удаление мимо паузы' end;
delete from citadel_throttle where key = 'login:ZLKID2';

-- =====================================================================
--  4. Ученик репетитора свой аккаунт не удалит
-- =====================================================================
select coalesce((session_delete_account(:'pupil', 'newpupilpass'))->>'error', '∅') as pupil_del \gset
select case when :'pupil_del' = 'linked_account'
            then 'ДА  ученик репетитора свой аккаунт не удаляет'
            else 'НЕТ ученик удалил себя сам' end;
select case when exists (select 1 from citadel_progress where code = 'ZLPUPIL')
            then 'ДА  аккаунт ученика на месте'
            else 'НЕТ аккаунт ученика пропал' end;

-- =====================================================================
--  5. Учеников заводит только репетитор
-- =====================================================================
select coalesce((session_create_student(:'kid2', 'ZLFAKE', 'fakepassword', ''))->>'error', '∅') as fake_err \gset
select case when :'fake_err' = 'not_a_tutor'
             and not exists (select 1 from citadel_progress where code = 'ZLFAKE')
            then 'ДА  самостоятельный аккаунт учеников не заводит'
            else 'НЕТ самостоятельный завёл себе ученика' end;
select case when (session_create_student(:'tutor', 'ZLPUPIL2', 'pupilpassword', ''))->>'ok' = 'true'
            then 'ДА  репетитор учеников заводит, как раньше'
            else 'НЕТ репетитор больше не может завести ученика' end;

-- =====================================================================
--  2. Приглашения
-- =====================================================================
select coalesce((session_create_invite(:'tutor'))->>'code', '∅') as inv \gset
select case when :'inv' ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
            then 'ДА  код приглашения — восемь знаков без похожих букв'
            else 'НЕТ код: ' || :'inv' end;
select case when (session_create_invite(:'kid2'))->>'error' = 'not_a_tutor'
             and (session_create_invite(:'pupil'))->>'error' = 'not_a_tutor'
            then 'ДА  приглашать может только репетитор'
            else 'НЕТ пригласил не репетитор' end;

-- Посмотреть: как бы ни набрали — строчными, с дефисом.
select case when (r->>'ok') = 'true' and (r->>'tutorName') = 'Максим'
            then 'ДА  ученик видит имя репетитора, а не логин'
            else 'НЕТ при просмотре: ' || r::text end
  from (select session_peek_invite(:'kid', lower(substr(:'inv', 1, 4) || '-' || substr(:'inv', 5))) as r) s;
select case when (select used_at from citadel_invite where code = :'inv') is null
             and (select account_type from citadel_progress where code = 'ZLKID') = 'solo'
            then 'ДА  просмотр ничего не меняет'
            else 'НЕТ просмотр уже привязал или потратил код' end;
select case when (session_peek_invite(:'pupil', :'inv'))->>'error' = 'not_solo'
            then 'ДА  ученика другого репетитора так не привязать'
            else 'НЕТ ученик чужого репетитора прошёл' end;
select case when (session_peek_invite(:'tutor2', :'inv'))->>'error' = 'not_solo'
            then 'ДА  репетитора к репетитору не привязать'
            else 'НЕТ репетитор привязался к репетитору' end;

-- Подбор кода: те же пять ошибок, потом пауза — и верный код ждёт.
select case when count(*) = 5 and bool_and(coalesce(r->>'error', '') = 'bad_invite' and coalesce((r->>'wait')::int, -1) = 0)
            then 'ДА  неверный код — отказ, первые пять без паузы'
            else 'НЕТ на неверных кодах: ' || string_agg(r::text, ' ') end
  from (select session_peek_invite(:'kid2', 'ZZZZZZZ' || g) as r from generate_series(1, 5) g) s;
select case when (session_peek_invite(:'kid2', 'WRONG666'))->>'wait' = '60'
             and (session_peek_invite(:'kid2', :'inv'))->>'error' = 'too_many'
            then 'ДА  подбор кода упирается в паузу'
            else 'НЕТ код можно подбирать без паузы' end;
delete from citadel_throttle where key = 'invite:ZLKID2';

-- Чужое уже выданное не трогается: у второго ребёнка есть свои звёзды на отрицательных.
insert into citadel_access (student_code, section, grant_json, granted_by)
values ('ZLKID', 'integer-', '{"add":[1]}'::jsonb, 'exam')
on conflict (student_code, section) do update set grant_json = excluded.grant_json;

-- Принять.
select session_accept_invite(:'kid', :'inv') as acc \gset
select case when (:'acc'::jsonb->>'ok') = 'true' and (:'acc'::jsonb->>'ownerCode') = 'ZLTUTOR'
             and (:'acc'::jsonb->>'tutorName') = 'Максим'
            then 'ДА  привязка прошла'
            else 'НЕТ привязка: ' || :'acc' end;
select case when account_type = 'linked' and owner_code = 'ZLTUTOR'
             and state->>'accountType' = 'linked' and state->>'ownerCode' = 'ZLTUTOR'
            then 'ДА  хозяин записан и в колонках, и в прогрессе'
            else 'НЕТ хозяин записан не везде: ' || coalesce(account_type, '∅') || ' / ' || coalesce(owner_code, '∅')
                 || ' / ' || coalesce(state->>'accountType', '∅') || ' / ' || coalesce(state->>'ownerCode', '∅') end
  from citadel_progress where code = 'ZLKID';
select case when (state->'byTopic'->'integer-:add:2'->>'correct') = '12'
             and (state->'totals') is not distinct from (state->'totals')
            then 'ДА  прогресс при привязке не тронут'
            else 'НЕТ прогресс изменился' end
  from citadel_progress where code = 'ZLKID';
select case when (select grant_json from citadel_access where student_code = 'ZLKID' and section = 'fraction+') = '"all"'::jsonb
            then 'ДА  раздел с прогрессом открыт — прогресс не сотрётся'
            else 'НЕТ раздел с прогрессом остался закрыт' end;
select case when (select grant_json from citadel_access where student_code = 'ZLKID' and section = 'integer-') = '{"add":[1]}'::jsonb
            then 'ДА  уже выданное в разделе не перезаписано'
            else 'НЕТ выданное перезаписано' end;
select case when not exists (select 1 from citadel_access where student_code = 'ZLKID' and section = 'decimal+')
            then 'ДА  раздел без прогресса не открыт'
            else 'НЕТ открыт лишний раздел' end;
select case when (:'acc'::jsonb->'access') ? 'fraction+'
            then 'ДА  приложение сразу получает новый доступ'
            else 'НЕТ в ответе нет доступа' end;
select case when exists (select 1 from jsonb_array_elements((session_list_students(:'tutor'))->'students') e
                         where e->>'code' = 'ZLKID')
            then 'ДА  ученик появился в списке репетитора'
            else 'НЕТ в списке репетитора его нет' end;
select case when (session_accept_invite(:'kid2', :'inv'))->>'error' = 'bad_invite'
            then 'ДА  код одноразовый'
            else 'НЕТ код сработал второй раз' end;
delete from citadel_throttle where key = 'invite:ZLKID2';

-- Сохранение старой копией «самостоятельного» привязку не снимает (pin_identity).
-- Как пришло бы со старого устройства: весь прогресс на месте, но тип прежний.
select session_save(:'kid', (select state from citadel_progress where code = 'ZLKID')
                            || '{"updatedAt":999999999999,"accountType":"solo","ownerCode":null}'::jsonb) \gset sv_
select case when state->>'accountType' = 'linked' and state->>'ownerCode' = 'ZLTUTOR'
            then 'ДА  старая копия с устройства привязку не снимает'
            else 'НЕТ сохранение отвязало ученика' end
  from citadel_progress where code = 'ZLKID';

-- Просроченный код.
select coalesce((session_create_invite(:'tutor'))->>'code', '∅') as old \gset
update citadel_invite set expires_at = now() - interval '1 minute' where code = :'old';
select case when (session_peek_invite(:'kid2', :'old'))->>'error' = 'bad_invite'
            then 'ДА  просроченный код не работает'
            else 'НЕТ просроченный код сработал' end;
delete from citadel_throttle where key = 'invite:ZLKID2';

-- =====================================================================
--  6. Имя репетитора у ученика
-- =====================================================================
select case when (session_my_tutor(:'kid'))->>'name' = 'Максим'
            then 'ДА  ученик видит имя репетитора'
            else 'НЕТ имени нет' end;
select case when (session_my_tutor(:'kid2'))->'name' = 'null'::jsonb
            then 'ДА  у самостоятельного репетитора нет'
            else 'НЕТ самостоятельному показан репетитор' end;
select case when not ((session_my_tutor(:'kid'))::text like '%ZLTUTOR%')
            then 'ДА  логин репетитора ученику не отдаётся'
            else 'НЕТ в ответе логин репетитора' end;

-- =====================================================================
--  3. Отпустить
-- =====================================================================
select case when (session_release_student(:'tutor2', 'ZLKID'))->>'error' = 'not_your_student'
            then 'ДА  чужой репетитор отпустить не может'
            else 'НЕТ чужой репетитор отпустил' end;
select case when (session_release_student(:'kid', 'ZLKID'))->>'error' = 'not_your_student'
            then 'ДА  ученик сам себя не отпускает'
            else 'НЕТ ученик отвязался сам' end;
select case when (session_release_student(:'tutor', 'ZLKID'))->>'ok' = 'true'
            then 'ДА  репетитор отпустил'
            else 'НЕТ отпустить не вышло' end;
select case when account_type = 'solo' and owner_code is null
             and state->>'accountType' = 'solo' and state->'ownerCode' = 'null'::jsonb
            then 'ДА  отпущенный — снова самостоятельный, везде'
            else 'НЕТ отпущенный записан не везде' end
  from citadel_progress where code = 'ZLKID';
select case when (state->'byTopic'->'integer-:add:2'->>'correct') = '12'
             and exists (select 1 from citadel_access where student_code = 'ZLKID' and section = 'fraction+')
            then 'ДА  прогресс и открытые разделы остались у ребёнка'
            else 'НЕТ отпущенный что-то потерял' end
  from citadel_progress where code = 'ZLKID';
select case when not exists (select 1 from jsonb_array_elements((session_list_students(:'tutor'))->'students') e
                             where e->>'code' = 'ZLKID')
            then 'ДА  из списка репетитора пропал'
            else 'НЕТ всё ещё в списке репетитора' end;
select coalesce((session_create_invite(:'tutor2'))->>'code', '∅') as again \gset
select case when (session_accept_invite(:'kid', :'again'))->>'ok' = 'true'
            then 'ДА  отпущенного можно пригласить снова'
            else 'НЕТ отпущенного не пригласить' end;

-- =====================================================================
--  Права
-- =====================================================================
select case when count(*) = 0 then 'ДА  снаружи видны только session_*'
            else 'НЕТ открыто лишнего: ' || string_agg(p.proname, ', ') end
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.proname not like 'session\_%'
   and has_function_privilege('anon', p.oid, 'execute')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

delete from citadel_progress where code like 'ZL%';
delete from citadel_throttle where key like '%:ZL%';
