-- =====================================================================
--  Статистика и отчёты: две новые RPC-функции
-- ---------------------------------------------------------------------
--  Запустить ОДИН РАЗ в Supabase → SQL Editor → New query → Run.
--  Базовую миграцию (migration.sql) при этом повторно запускать НЕ нужно —
--  здесь только то, чего в ней ещё не было.
--
--  Пока этот файл не запущен, приложение продолжает работать: список
--  учеников и просмотр их статистики просто идут по старому пути через
--  list_my_students. После запуска они начнут ходить по лёгкому.
-- =====================================================================

-- 1. Лёгкий список учеников — только то, что нужно нарисовать строку в списке.
--    Отдельно от list_my_students, потому что тот возвращает ПОЛНОЕ состояние
--    каждого ученика, включая журнал занятий по дням. Список открывается при
--    каждом заходе в профиль, и тянуть туда всю историю всех учеников незачем.
create or replace function list_my_students_summary(p_tutor_code text, p_tutor_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tutor_hash text;
  v_result jsonb;
begin
  select password_hash into v_tutor_hash from citadel_progress where code = p_tutor_code;
  if v_tutor_hash is null or v_tutor_hash <> crypt(p_tutor_password, v_tutor_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
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

-- 2. Полное состояние ОДНОГО ученика — тянем только когда открываем его
--    статистику или отчёт. Владение проверяется через ownerCode.
create or replace function get_student_state(p_tutor_code text, p_tutor_password text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tutor_hash text;
  v_owner text;
  v_state jsonb;
  v_updated timestamptz;
begin
  select password_hash into v_tutor_hash from citadel_progress where code = p_tutor_code;
  if v_tutor_hash is null or v_tutor_hash <> crypt(p_tutor_password, v_tutor_hash) then
    return jsonb_build_object('ok', false, 'error', 'tutor_auth_failed');
  end if;
  select state, updated_at, state->>'ownerCode'
  into v_state, v_updated, v_owner
  from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  return jsonb_build_object('ok', true, 'state', v_state, 'updatedAt', v_updated);
end;
$$;

-- 3. Разрешаем анонимному ключу вызывать обе функции.
grant execute on function list_my_students_summary(text, text) to anon;
grant execute on function get_student_state(text, text, text) to anon;
