-- =====================================================================
--  УБИРАЕМ СТАРЫЙ ПУТЬ ПО ПАРОЛЮ
-- ---------------------------------------------------------------------
--  Приложение давно ходит только через сессионные токены: логин обменивается
--  на токен один раз, дальше пароль на устройстве не хранится и в запросах не
--  участвует. А функции старой схемы остались в базе и остались открытыми для
--  роли anon — то есть рядом с новой дверью всё это время стояла старая.
--
--  Чем она плоха:
--    · «Выйти со всех устройств» её не закрывает. Кнопка гасит токены, а эти
--      функции токенов не знают и пускают по паролю.
--    · Попытки входа ничем не ограничены: login() можно дёргать сколько угодно.
--    · Через неё доступен полный набор действий в обход новой модели — записать
--      прогресс, завести ученика, сбросить пароль, удалить аккаунт.
--
--  Всего таких функций двадцать. Ничего из этого клиент не вызывает: он знает
--  пятнадцать функций, все с префиксом session_. Проверить можно поиском
--  по index.html.
--
--  ЗАПУСКАТЬ ОДИН РАЗ. Повторный запуск безопасен: drop ... if exists молчит,
--  если функции уже нет.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  СНАЧАЛА ПЕРЕНОСИМ ТО, ЧЕМУ НУЖНА ЗАМЕНА
-- ---------------------------------------------------------------------
--  Одна из старых функций — единственная. Смена СВОЕГО пароля жила только в
--  парольном пути, и, выбросив её, репетитор остался бы вообще без способа
--  сменить пароль: у учеников есть session_reset_student_password, у него —
--  ничего. Поэтому не выбрасываем, а переносим на токен.
--
--  Старый пароль всё равно спрашиваем: токен мог остаться на забытом
--  устройстве, и одного токена для смены пароля мало. Все сессии после смены
--  гасятся — включая ту, из которой её и делали.
create or replace function session_change_own_password(
  p_token text, p_old_password text, p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
  v_hash text;
  v_type text;
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;

  select password_hash, account_type into v_hash, v_type
  from citadel_progress where code = v_code;

  if v_hash is null or v_hash <> crypt(p_old_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  -- Ученику свой пароль менять нельзя: его выдаёт репетитор, и смена вслепую
  -- отрезала бы ученика от собственного аккаунта.
  if v_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;

  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf'))
   where code = v_code;
  delete from citadel_session where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function session_change_own_password(text, text, text) to anon;

-- ---------------------------------------------------------------------
--  ТЕПЕРЬ УБИРАЕМ СТАРОЕ
-- ---------------------------------------------------------------------

-- Вход и запись прогресса по паролю.
drop function if exists login(text, text);
drop function if exists save_state(text, text, jsonb);

-- Работа со своими учениками по паролю репетитора.
drop function if exists create_student(text, text, text, text, text);
drop function if exists list_my_students(text, text);
drop function if exists list_my_students_summary(text, text);
drop function if exists get_student_state(text, text, text);
drop function if exists reset_student_password(text, text, text, text);
drop function if exists delete_student(text, text, text);

-- Свой пароль и свой аккаунт.
drop function if exists change_own_password(text, text, text);
drop function if exists delete_own_account(text, text);

-- Доступ к разделам и экзамен — по паролю. Новые пути (session_my_access,
-- session_exam_allowed) те же самые, только через токен.
drop function if exists my_access(text, text);
drop function if exists exam_allowed(text, text, text);

-- Выдача доступа, экзамен и просмотр чужих данных — тоже по паролю.
-- Потолок экзамена старый путь, к счастью, соблюдает: он живёт в общей
-- внутренней функции. Но пароль в запросе — это и есть то, от чего уходили.
drop function if exists set_student_access(text, text, text, text, jsonb);
drop function if exists student_access(text, text, text);
drop function if exists student_exams(text, text, text);
drop function if exists take_exam(text, text, text, integer);

-- Слой кодов доступа целиком: приложение выдаёт доступ напрямую, кодами оно не
-- пользуется — клиент не вызывает ни одной из этих функций. Парные им
-- session_*_access_code остаются: они на токенах и вреда не делают.
drop function if exists issue_access_code(text, text, text, text, jsonb);
drop function if exists list_access_codes(text, text, text);
drop function if exists redeem_access_code(text, text, text);
drop function if exists revoke_access_code(text, text, text);

-- Две внутренние функции стояли открытыми для anon по недосмотру. Удалять их
-- нельзя — их зовут session_take_exam и потолок экзамена, — но снаружи они
-- быть видны не должны: правило для всех остальных impl_* ровно такое же.
revoke execute on function impl_exam_allowed(text, text) from public;
revoke execute on function exam_max_grant() from public;
revoke execute on function valid_grant(jsonb) from public;

commit;

-- ---------------------------------------------------------------------
--  ПРОВЕРКА. Должно быть «ДА» и пустой список.
-- ---------------------------------------------------------------------
select case when count(*) = 0 then 'ДА — старый путь закрыт'
            else 'НЕТ — осталось функций: ' || count(*) end as "Старый путь по паролю убран?"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('login', 'save_state', 'create_student', 'list_my_students',
                    'list_my_students_summary', 'get_student_state',
                    'reset_student_password', 'delete_student',
                    'change_own_password', 'delete_own_account',
                    'my_access', 'exam_allowed', 'issue_access_code',
                    'list_access_codes', 'redeem_access_code', 'revoke_access_code',
                    'set_student_access', 'student_access', 'student_exams', 'take_exam');

-- Что осталось открытым для anon: должны быть только session_* и ничего больше.
select p.proname as "Открыто для anon"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not like 'pg\_%'
order by 1;
