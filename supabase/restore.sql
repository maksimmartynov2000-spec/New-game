-- =====================================================================
--  ВОССТАНОВЛЕНИЕ ПРОГРЕССА УЧЕНИКА ИЗ РЕЗЕРВНОЙ КОПИИ
-- ---------------------------------------------------------------------
--  Копия делалась, а положить её обратно было нечем: в приложении не было
--  ни одного места, которое читает файл, и на сервере — ни одной функции,
--  которой репетитор мог бы записать состояние ученика. Дверь работала в одну
--  сторону, и при аварии на сервере от копии не было никакого проку.
--
--  Свой собственный профиль репетитор восстанавливает через session_save() —
--  он и так пишет своё состояние. Здесь только чужое: состояние ученика.
--
--  Три замка, и все обязательны:
--    1. токен репетитора — иначе вообще ничего;
--    2. ученик должен принадлежать ИМЕННО ЭТОМУ репетитору, и проверяется это
--       по колонке owner_code, а не по полю внутри состояния: поле ученик
--       записывает сам, колонку — нет;
--    3. записываемое состояние прогоняется через pin_identity(), которая
--       заново проставляет владельца и тип аккаунта из колонок. Иначе копией
--       можно было бы переписать ученику владельца и увести его у себя же.
--
--  ЗАПУСКАТЬ ОДИН РАЗ.
-- =====================================================================

begin;

create or replace function impl_restore_student(
  p_tutor_code text, p_student_code text, p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad_state');
  end if;

  select owner_code into v_owner
    from citadel_progress where code = p_student_code;

  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;

  update citadel_progress
     set state = pin_identity(p_student_code, p_state), updated_at = now()
   where code = p_student_code;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function impl_restore_student(text, text, jsonb) from public;

create or replace function session_restore_student(
  p_token text, p_student_code text, p_state jsonb
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
  return impl_restore_student(v_code, p_student_code, p_state);
end;
$$;

grant execute on function session_restore_student(text, text, jsonb) to anon;

commit;

-- ---------------------------------------------------------------------
--  ПРОВЕРКА. Должно быть «ДА».
-- ---------------------------------------------------------------------
select case when count(*) = 1 then 'ДА — восстановление доступно'
            else 'НЕТ — функции нет' end as "Восстановление ученика заведено?"
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'session_restore_student';

select case when has_function_privilege('anon', p.oid, 'execute')
            then 'НЕТ — внутренняя функция открыта наружу'
            else 'ДА — внутренняя функция закрыта' end as "impl_restore_student спрятан?"
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'impl_restore_student';
