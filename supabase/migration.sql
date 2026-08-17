-- =====================================================================
--  Миграция на код+пароль вместо "код = единственный секрет"
-- ---------------------------------------------------------------------
--  Выполнить ОДИН РАЗ в Supabase → SQL Editor → New query → Run.
--  Перед запуском замени плейсхолдеры (см. пункт 4) на свои настоящие
--  код и пароль репетитора.
-- =====================================================================

-- 1. Хеширование паролей (bcrypt через pgcrypto)
create extension if not exists pgcrypto;

-- 2. Поле для хеша пароля. Сам пароль в базе никогда не хранится как текст.
alter table citadel_progress add column if not exists password_hash text;

-- 3. Удаляем старые неактивные тестовые аккаунты
delete from citadel_progress
where code in ('27Q995', 'GGARQH', 'MXCY2J', 'AV9ZGW', 'ЦИТ-S47V');

-- 4. Заводим твой собственный аккаунт репетитора.
--    ЗАМЕНИ 'MaksimMartynov' и 'ПРИДУМАЙ_ПАРОЛЬ' на свои значения перед запуском.
insert into citadel_progress (code, password_hash, state, updated_at)
values (
  'MaksimMartynov',
  crypt('ПРИДУМАЙ_ПАРОЛЬ', gen_salt('bf')),
  jsonb_build_object(
    'schema', 2, 'playerCode', 'MaksimMartynov', 'updatedAt', 0,
    'profileLabel', '', 'accountType', 'self', 'ownerCode', null,
    'config', null,
    'puzzle', jsonb_build_object('idx', null, 'filled', 0),
    'collections', jsonb_build_object('paradoxes', '[]'::jsonb),
    'totals', jsonb_build_object('correct', 0, 'wrong', 0, 'puzzlesCompleted', 0),
    'byTopic', '{}'::jsonb, 'unlocks', '[]'::jsonb
  ),
  now()
)
on conflict (code) do nothing;

-- =====================================================================
--  RPC-функции. Всё общение с таблицей идёт только через них — пароль
--  проверяется внутри базы, наружу утекает только hex-хеш, если вообще.
-- =====================================================================

-- 5. Вход / тихая пересинхронизация: отдаёт state только при верном пароле.
create or replace function login(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row citadel_progress%rowtype;
begin
  select * into v_row from citadel_progress where code = p_code;
  if not found or v_row.password_hash is null then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  if v_row.password_hash = crypt(p_password, v_row.password_hash) then
    return jsonb_build_object('ok', true, 'state', v_row.state);
  else
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
end;
$$;

-- 6. Запись прогресса — тоже требует пароль при каждом вызове.
create or replace function save_state(p_code text, p_password text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_code;
  if v_hash is null or v_hash <> crypt(p_password, v_hash) then
    return false;
  end if;
  update citadel_progress set state = p_state, updated_at = now() where code = p_code;
  return true;
end;
$$;

-- 7. Репетитор создаёт ученика: код и пароль выбирает сам репетитор (не случайные).
create or replace function create_student(
  p_tutor_code text, p_tutor_password text,
  p_student_code text, p_student_password text, p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_hash text;
begin
  select password_hash into v_tutor_hash from citadel_progress where code = p_tutor_code;
  if v_tutor_hash is null or v_tutor_hash <> crypt(p_tutor_password, v_tutor_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
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

-- 8. Список учеников репетитора (замена прямому select по state->>ownerCode).
create or replace function list_my_students(p_tutor_code text, p_tutor_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_hash text;
  v_result jsonb;
begin
  select password_hash into v_tutor_hash from citadel_progress where code = p_tutor_code;
  if v_tutor_hash is null or v_tutor_hash <> crypt(p_tutor_password, v_tutor_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'state', state)), '[]'::jsonb)
  into v_result
  from citadel_progress
  where state->>'ownerCode' = p_tutor_code;
  return jsonb_build_object('ok', true, 'students', v_result);
end;
$$;

-- 9. Репетитор сбрасывает пароль СВОЕГО ученика (проверяет владение через ownerCode).
create or replace function reset_student_password(
  p_tutor_code text, p_tutor_password text, p_student_code text, p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_hash text;
  v_owner text;
begin
  select password_hash into v_tutor_hash from citadel_progress where code = p_tutor_code;
  if v_tutor_hash is null or v_tutor_hash <> crypt(p_tutor_password, v_tutor_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  if p_new_password is null or length(p_new_password) < 4 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;
  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf')) where code = p_student_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- 10. Смена собственного пароля — только для self-аккаунтов (не для ученика).
create or replace function change_own_password(p_code text, p_old_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_type text;
begin
  select password_hash, state->>'accountType' into v_hash, v_type from citadel_progress where code = p_code;
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
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
--  Закрываем прямой доступ к таблице — всё общение только через функции
--  выше (они помечены SECURITY DEFINER и поэтому продолжают работать).
--  Без этого шага пароль будет просто "для вида": таблицу по-прежнему
--  можно читать и писать напрямую, в обход всех проверок.
-- =====================================================================

-- 11. Снимаем все существующие политики на таблице, какими бы они ни были.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'citadel_progress'
  loop
    execute format('drop policy %I on citadel_progress', pol.policyname);
  end loop;
end $$;

-- 12. Включаем RLS без единой политики = прямой доступ запрещён всем,
--     кроме владельца таблицы (которым функции выше и притворяются).
alter table citadel_progress enable row level security;

-- 13. Явно разрешаем анонимному ключу вызывать сами функции.
grant execute on function login(text, text) to anon;
grant execute on function save_state(text, text, jsonb) to anon;
grant execute on function create_student(text, text, text, text, text) to anon;
grant execute on function list_my_students(text, text) to anon;
grant execute on function reset_student_password(text, text, text, text) to anon;
grant execute on function change_own_password(text, text, text) to anon;
