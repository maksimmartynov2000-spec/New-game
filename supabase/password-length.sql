-- =====================================================================
--  МИНИМАЛЬНАЯ ДЛИНА ПАРОЛЯ — ВОСЕМЬ СИМВОЛОВ
-- ---------------------------------------------------------------------
--  Ограничения на попытки входа у нас нет: session_login доступен всем
--  с публичным ключом, счётчика неудач нет, паузы нет. Единственное, что
--  мешает перебору, — медленный bcrypt. Этого достаточно для длинного
--  пароля и совершенно недостаточно для четырёхсимвольного.
--
--  Настоящая защита от перебора (счётчик неудач, пауза, блокировка) — это
--  отдельная и заметно большая работа. Восемь символов вместо четырёх стоят
--  одной правки и убирают самый дешёвый способ подобрать пароль.
--
--  ВАЖНО, чего эта миграция НЕ делает: она не трогает вход. Уже выданные
--  короткие пароли продолжают работать — иначе ученики оказались бы заперты
--  снаружи, а это ровно та беда, от которой мы защищаемся. Длина проверяется
--  только там, где пароль ЗАДАЁТСЯ: при заведении ученика, при сбросе пароля
--  репетитором и при смене своего пароля.
--
--  Старые пароли стоит поменять руками, когда будет удобно, — приложение
--  для этого ничего не требует.
--
--  Запускать можно на работающем приложении и сколько угодно раз подряд.
--  ЗАПУСКАТЬ ПОСЛЕ owner-columns.sql: здесь переиздаётся impl_create_student,
--  и в этой версии уже есть заполнение колонок владельца.
-- =====================================================================

-- 1. Заведение ученика.
create or replace function impl_create_student(
  p_tutor_code text, p_student_code text, p_student_password text, p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tutor_type text;
begin
  select account_type into v_tutor_type from citadel_progress where code = p_tutor_code;
  if v_tutor_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_a_tutor');
  end if;
  if p_student_code is null or length(p_student_code) < 3 then
    return jsonb_build_object('ok', false, 'error', 'code_too_short');
  end if;
  if exists (select 1 from citadel_progress where code = p_student_code) then
    return jsonb_build_object('ok', false, 'error', 'code_taken');
  end if;
  if p_student_password is null or length(p_student_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;

  insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
  values (
    p_student_code,
    crypt(p_student_password, gen_salt('bf')),
    p_tutor_code,
    'linked',
    jsonb_build_object(
      'schema', 2, 'playerCode', p_student_code, 'updatedAt', 0,
      'profileLabel', coalesce(p_label, ''), 'accountType', 'linked', 'ownerCode', p_tutor_code,
      'config', null,
      'puzzle', jsonb_build_object('idx', null, 'filled', 0),
      'collections', jsonb_build_object('paradoxes', '[]'::jsonb),
      'totals', jsonb_build_object('correct', 0, 'wrong', 0, 'puzzlesCompleted', 0),
      'byTopic', '{}'::jsonb, 'unlocks', '[]'::jsonb
    ),
    now()
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function impl_create_student(text, text, text, text) from public;

-- 2. Сброс пароля ученику репетитором.
create or replace function impl_reset_student_password(
  p_tutor_code text, p_student_code text, p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
begin
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;
  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf'))
   where code = p_student_code;
  -- Смена пароля выкидывает ученика со всех устройств: иначе «сменил пароль»
  -- не означало бы «отобрал доступ», а только «выдал ещё один способ войти».
  delete from citadel_session where code = p_student_code;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function impl_reset_student_password(text, text, text) from public;

-- 3. Смена своего пароля.
create or replace function change_own_password(
  p_code text, p_old_password text, p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_type text;
begin
  select password_hash, account_type into v_hash, v_type
  from citadel_progress where code = p_code;
  if v_hash is null or v_hash <> crypt(p_old_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  if v_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;
  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf')) where code = p_code;
  delete from citadel_session where code = p_code;
  return jsonb_build_object('ok', true);
end;
$$;
