-- =====================================================================
--  ПУСТОЙ ПАРОЛЬ БОЛЬШЕ НЕ ПУСКАЕТ
-- ---------------------------------------------------------------------
--  Запускать ПОСЛЕ exam-sections.sql. Можно на работающем приложении и сколько
--  угодно раз подряд: здесь только новые версии трёх функций и проверка.
--
--  Что было не так. Пароль сравнивался так:
--
--      if hash <> crypt(p_password, hash) then «неверный пароль»
--
--  crypt(null, …) даёт null, сравнение с null даёт не «ложь», а «неизвестно»,
--  и if «неизвестно» пропускает — как будто пароль верный. То есть вызов
--  session_login(логин, null) напрямую, мимо приложения, отдавал рабочий токен
--  от ЛЮБОГО аккаунта, логин которого известен. Публичный ключ для таких вызовов
--  лежит в самой странице приложения, его видит каждый. Через токен репетитора
--  открываются все его ученики: статистика, сброс паролей, удаление.
--
--  Так же со старым паролем null проходили смена пароля и удаление аккаунта
--  (им нужен токен, но его давал тот же вход).
--
--  Нашлось при подготовке паузы после неверных паролей: проверку пароля пришлось
--  разобрать по буквам. Приложение такой вызов не делает никогда — оно не
--  отправляет пустой пароль, — поэтому для учеников и репетитора ничего не
--  меняется: верный пароль пускает, неверный и пустой — нет.
--
--  Как теперь: «is distinct from» вместо «<>» — у него с null нет третьего
--  ответа, — и пустой пароль отсекается явно, до любых сравнений.
-- =====================================================================

-- 1. Вход.
create or replace function session_login(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row   citadel_progress%rowtype;
  v_token text;
begin
  select * into v_row from citadel_progress where code = p_code;
  if not found or v_row.password_hash is null then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  if p_password is null or p_password = ''
     or v_row.password_hash is distinct from crypt(p_password, v_row.password_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;

  -- Заодно подметаем протухшее: отдельного планировщика ради этого заводить незачем.
  delete from citadel_session where expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into citadel_session (token_hash, code, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_code, now() + interval '90 days');

  return jsonb_build_object('ok', true, 'token', v_token, 'code', p_code, 'state', v_row.state);
end;
$$;

-- 2. Смена своего пароля. Всё остальное — как было.
create or replace function session_change_own_password(p_token text, p_old_password text, p_new_password text)
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

  if v_hash is null or p_old_password is null or p_old_password = ''
     or v_hash is distinct from crypt(p_old_password, v_hash) then
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

-- 3. Удаление своего аккаунта. Всё остальное — как было.
create or replace function session_delete_account(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
  v_hash text;
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  select password_hash into v_hash from citadel_progress where code = v_code;
  if v_hash is null or p_password is null or p_password = ''
     or v_hash is distinct from crypt(p_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  delete from citadel_session where code = v_code;
  delete from citadel_progress where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- Права те же, что и были: наружу эти три функции и смотрели.
grant execute on function session_login(text, text) to anon;
grant execute on function session_change_own_password(text, text, text) to anon;
grant execute on function session_delete_account(text, text) to anon;

-- Проверка: строка должна быть «ДА». Ищем нестрогое сравнение с crypt во всех
-- функциях базы — и в этих трёх, и в любых, что появятся потом.
select case when count(*) = 0 then 'ДА — пароль везде сравнивается строго'
            else 'НЕТ — осталось сравнение «<> crypt»: ' || string_agg(p.proname, ', ') end
       as "Пустой пароль больше не пускает?"
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.prosrc ~ '<>\s*crypt\(';
