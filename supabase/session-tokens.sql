-- =====================================================================
--  Токены сессий вместо пароля в localStorage
-- ---------------------------------------------------------------------
--  Выполнить ОДИН РАЗ в Supabase → SQL Editor → New query → Run,
--  после supabase/migration.sql и supabase/stats-report.sql.
--  Плейсхолдеров нет, править ничего не нужно.
--
--  Что было. Приложению нужно подтверждать личность при каждом запросе,
--  а запросы идут постоянно и в фоне — значит секрет надо где-то держать.
--  Держали сам пароль, в localStorage, открытым текстом. Отсюда три беды:
--   1) один и тот же пароль человек мог использовать и где-то ещё;
--   2) отобрать доступ у чужого устройства можно было только сменой пароля,
--      то есть выкинув заодно и все свои устройства;
--   3) у репетитора там лежал пароль, открывающий всех учеников разом.
--
--  Что становится. При входе база выдаёт токен — длинную случайную строку,
--  которая ничего не значит нигде, кроме этого приложения. Дальше устройство
--  живёт только с ним, пароль стирается и больше не хранится. Токен можно
--  отозвать по одному, он сам протухает через 90 дней бездействия, и по нему
--  нельзя узнать пароль: в базе лежит не он, а его sha256.
--
--  Старые функции (login/save_state/create_student/...) остаются рабочими —
--  устройство, которое ещё не успело обменять пароль на токен, продолжает
--  ходить по-старому и обменяет при первом же запуске.
-- =====================================================================

-- 1. Таблица сессий. Сам токен здесь не хранится — только его sha256,
--    поэтому даже полный дамп таблицы не даёт войти ни в один аккаунт.
create table if not exists citadel_session (
  token_hash   text primary key,
  code         text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists citadel_session_code_idx on citadel_session (code);

-- Удаление аккаунта должно уносить с собой и его сессии. Если внешний ключ
-- почему-то не поставится (например, у citadel_progress.code нет уникального
-- индекса), это не повод останавливать миграцию: функции ниже всё равно чистят
-- сессии явно.
do $$
begin
  alter table citadel_session
    add constraint citadel_session_code_fkey
    foreign key (code) references citadel_progress (code) on delete cascade;
exception
  when others then null;
end $$;

-- Прямой доступ к таблице закрыт всем, как и к citadel_progress:
-- работать с ней могут только SECURITY DEFINER функции ниже.
alter table citadel_session enable row level security;

-- =====================================================================
--  2. Общая часть операций репетитора.
-- ---------------------------------------------------------------------
--  Раньше проверка «это правда мой ученик» была переписана в каждой функции
--  заново. Теперь она живёт в одном месте, а вокруг только два входа: по
--  паролю (старый путь) и по токену (новый). Так эти два пути не могут
--  разойтись в том, что именно они разрешают,  — а именно на таком расхождении
--  обычно и появляется дыра.
--  Эти функции наружу не отдаются (revoke ниже): звать их могут только
--  функции-обёртки, которые работают от имени владельца базы.
-- =====================================================================

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
  select state->>'accountType' into v_tutor_type from citadel_progress where code = p_tutor_code;
  -- Заводить учеников может только сам репетитор, не ученик другого репетитора.
  if v_tutor_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_a_tutor');
  end if;
  if p_student_code is null or length(p_student_code) < 3 then
    return jsonb_build_object('ok', false, 'error', 'code_too_short');
  end if;
  if exists (select 1 from citadel_progress where code = p_student_code) then
    return jsonb_build_object('ok', false, 'error', 'code_taken');
  end if;
  if p_student_password is null or length(p_student_password) < 4 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;

  insert into citadel_progress (code, password_hash, state, updated_at)
  values (
    p_student_code,
    crypt(p_student_password, gen_salt('bf')),
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

create or replace function impl_list_students(p_tutor_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', code,
    'label', state->>'profileLabel',
    'totals', state->'totals',
    'updatedAt', updated_at
  )), '[]'::jsonb)
  into v_result
  from citadel_progress
  where state->>'ownerCode' = p_tutor_code;
  return jsonb_build_object('ok', true, 'students', v_result);
end;
$$;

create or replace function impl_student_state(p_tutor_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_state jsonb;
  v_updated timestamptz;
begin
  select state, updated_at, state->>'ownerCode'
  into v_state, v_updated, v_owner
  from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  return jsonb_build_object('ok', true, 'state', v_state, 'updatedAt', v_updated);
end;
$$;

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
  if p_new_password is null or length(p_new_password) < 4 then
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

create or replace function impl_delete_student(p_tutor_code text, p_student_code text)
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
  delete from citadel_session where code = p_student_code;
  delete from citadel_progress where code = p_student_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
--  3. Токен: выдача и проверка.
-- =====================================================================

-- Кто стоит за токеном. Возвращает код или NULL, если токена нет, он подделан
-- или протух. Наружу не отдаётся — только для функций ниже.
create or replace function session_owner(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_code text;
  v_exp  timestamptz;
begin
  if p_token is null or length(p_token) <> 64 then return null; end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select code, expires_at into v_code, v_exp from citadel_session where token_hash = v_hash;
  if v_code is null or v_exp < now() then return null; end if;
  -- Срок продлеваем, но не чаще раза в месяц. Иначе каждая фоновая
  -- синхронизация (раз в 8 секунд) писала бы в таблицу сессий.
  if v_exp < now() + interval '60 days' then
    update citadel_session
       set expires_at = now() + interval '90 days', last_seen_at = now()
     where token_hash = v_hash;
  end if;
  return v_code;
end;
$$;

-- Вход по коду и паролю. Отдаёт и состояние, и токен: дальше устройство
-- живёт только с токеном, а пароль стирает у себя.
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
  if v_row.password_hash <> crypt(p_password, v_row.password_hash) then
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

-- Чтение состояния по токену — замена login() для тихих фоновых пересинхронизаций.
create or replace function session_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code  text := session_owner(p_token);
  v_state jsonb;
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  select state into v_state from citadel_progress where code = v_code;
  return jsonb_build_object('ok', true, 'code', v_code, 'state', v_state);
end;
$$;

-- Запись состояния по токену — замена save_state().
create or replace function session_save(p_token text, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  update citadel_progress set state = p_state, updated_at = now() where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- Выход на этом устройстве. Гасит ровно один токен, остальные устройства
-- продолжают работать — ради этого всё и затевалось.
create or replace function session_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null or length(p_token) <> 64 then
    return jsonb_build_object('ok', true);
  end if;
  delete from citadel_session where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
--  4. Операции репетитора по токену.
-- =====================================================================

create or replace function session_create_student(
  p_token text, p_student_code text, p_student_password text, p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_create_student(v_code, p_student_code, p_student_password, p_label);
end;
$$;

create or replace function session_list_students(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_list_students(v_code);
end;
$$;

create or replace function session_student_state(p_token text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_student_state(v_code, p_student_code);
end;
$$;

create or replace function session_reset_student_password(
  p_token text, p_student_code text, p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_reset_student_password(v_code, p_student_code, p_new_password);
end;
$$;

create or replace function session_delete_student(p_token text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_delete_student(v_code, p_student_code);
end;
$$;

-- Удаление собственного аккаунта. Пароль спрашиваем ещё раз, несмотря на токен:
-- это единственное действие, которое нельзя отменить, и одного лежащего
-- на устройстве токена для него мало.
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
  if v_hash is null or v_hash <> crypt(p_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  delete from citadel_session where code = v_code;
  delete from citadel_progress where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
--  5. Старые функции переводим на ту же общую часть.
--     Снаружи ничего не меняется — те же имена и те же аргументы, поэтому
--     устройства, ещё не обменявшие пароль на токен, работают как работали.
-- =====================================================================

create or replace function create_student(
  p_tutor_code text, p_tutor_password text,
  p_student_code text, p_student_password text, p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_tutor_code;
  if v_hash is null or v_hash <> crypt(p_tutor_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  return impl_create_student(p_tutor_code, p_student_code, p_student_password, p_label);
end;
$$;

create or replace function list_my_students_summary(p_tutor_code text, p_tutor_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_tutor_code;
  if v_hash is null or v_hash <> crypt(p_tutor_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  return impl_list_students(p_tutor_code);
end;
$$;

create or replace function get_student_state(
  p_tutor_code text, p_tutor_password text, p_student_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_tutor_code;
  if v_hash is null or v_hash <> crypt(p_tutor_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  return impl_student_state(p_tutor_code, p_student_code);
end;
$$;

create or replace function reset_student_password(
  p_tutor_code text, p_tutor_password text, p_student_code text, p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_tutor_code;
  if v_hash is null or v_hash <> crypt(p_tutor_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  return impl_reset_student_password(p_tutor_code, p_student_code, p_new_password);
end;
$$;

create or replace function delete_student(
  p_tutor_code text, p_tutor_password text, p_student_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_tutor_code;
  if v_hash is null or v_hash <> crypt(p_tutor_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  return impl_delete_student(p_tutor_code, p_student_code);
end;
$$;

-- Смена собственного пароля должна гасить все сессии: смысл смены пароля в том,
-- чтобы отобрать доступ, а не выдать ещё один способ войти.
create or replace function change_own_password(p_code text, p_old_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_type text;
begin
  select password_hash, state->>'accountType' into v_hash, v_type
  from citadel_progress where code = p_code;
  if v_hash is null or v_hash <> crypt(p_old_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  if v_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if p_new_password is null or length(p_new_password) < 4 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;
  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf')) where code = p_code;
  delete from citadel_session where code = p_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- Удаление аккаунта по паролю (старый путь) — тоже уносит сессии.
create or replace function delete_own_account(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_code;
  if v_hash is null or v_hash <> crypt(p_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  delete from citadel_session where code = p_code;
  delete from citadel_progress where code = p_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
--  6. Права. Наружу открыты только session_*; общая часть (impl_*) и
--     разбор токена (session_owner) — нет: их зовут функции выше,
--     которые работают от имени владельца базы.
-- =====================================================================

grant execute on function session_login(text, text) to anon;
grant execute on function session_state(text) to anon;
grant execute on function session_save(text, jsonb) to anon;
grant execute on function session_logout(text) to anon;
grant execute on function session_create_student(text, text, text, text) to anon;
grant execute on function session_list_students(text) to anon;
grant execute on function session_student_state(text, text) to anon;
grant execute on function session_reset_student_password(text, text, text) to anon;
grant execute on function session_delete_student(text, text) to anon;
grant execute on function session_delete_account(text, text) to anon;

revoke execute on function session_owner(text) from public;
revoke execute on function impl_create_student(text, text, text, text) from public;
revoke execute on function impl_list_students(text) from public;
revoke execute on function impl_student_state(text, text) from public;
revoke execute on function impl_reset_student_password(text, text, text) from public;
revoke execute on function impl_delete_student(text, text) from public;
