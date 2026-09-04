-- =====================================================================
--  Вводный экзамен
-- ---------------------------------------------------------------------
--  Выполнить ОДИН РАЗ в Supabase → SQL Editor → New query → Run,
--  после student-access.sql. Плейсхолдеров нет, править ничего не нужно.
--
--  Зачем. Ученик, который уже умеет считать, не должен набивать золото
--  на первой звезде, чтобы добраться до четвёртой. Он проходит короткий
--  экзамен по одному действию и получает звёзды сразу.
--
--  Только 'integer+'. В остальных разделах доступ ограничивает не только
--  калитка, но и само разрешение раздела, и там разворачивать 'all' в
--  перечисление звёзд означало бы СУЗИТЬ выданное репетитором. На
--  положительных доступ есть у всех, ограничивают только ворота, и
--  дописать туда звёзды можно лишь в плюс — отнять нечего.
--
--  Экзамен считается на устройстве ученика, и сервер не может это
--  проверить. Это принято сознательно: худшее последствие — ребёнок
--  откроет себе примеры посложнее и упрётся в них сам. Зато каждая
--  попытка записывается, и репетитор видит, что происходило.
-- =====================================================================

-- =====================================================================
--  1. Журнал попыток
-- =====================================================================

create table if not exists citadel_exam (
  id          bigserial primary key,
  student_code text not null references citadel_progress(code) on delete cascade,
  section     text not null,
  op          text not null,
  level       int  not null,          -- какую звезду показал экзамен (0 — не сдал)
  passed      boolean not null,
  taken_at    timestamptz not null default now()
);

create index if not exists citadel_exam_student_idx
  on citadel_exam (student_code, taken_at desc);

alter table citadel_exam enable row level security;
-- Прямого доступа к таблице ни у кого нет: только через функции ниже.

-- =====================================================================
--  2. Можно ли сегодня сдавать
-- ---------------------------------------------------------------------
--  Одна попытка в день на действие. СДАННЫЙ экзамен попытку не тратит:
--  сдал — пробуй выше. День кончился — приходи снова. Так угадывание
--  перестаёт быть стратегией: вариантов четыре, и наугад экзамен
--  сдаётся примерно в одном случае из двухсот.
-- =====================================================================

create or replace function impl_exam_allowed(p_student_code text, p_op text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select not exists (
    select 1 from citadel_exam
    where student_code = p_student_code
      and op = p_op
      and not passed
      and taken_at >= date_trunc('day', now())
  );
$$;

-- =====================================================================
--  3. Запись результата и открытие звёзд
-- =====================================================================

create or replace function impl_take_exam(
  p_student_code text, p_op text, p_level int
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_section  text := 'integer+';
  v_passed   boolean := p_level >= 1;
  v_grant    jsonb;
  v_op       jsonb;
  v_levels   jsonb;
begin
  if p_op not in ('add', 'sub', 'mul', 'div') then
    return jsonb_build_object('ok', false, 'error', 'bad_op');
  end if;
  if p_level is null or p_level < 0 or p_level > 5 then
    return jsonb_build_object('ok', false, 'error', 'bad_level');
  end if;
  if not exists (select 1 from citadel_progress where code = p_student_code) then
    return jsonb_build_object('ok', false, 'error', 'no_student');
  end if;
  if not impl_exam_allowed(p_student_code, p_op) then
    return jsonb_build_object('ok', false, 'error', 'already_today');
  end if;

  insert into citadel_exam (student_code, section, op, level, passed)
  values (p_student_code, v_section, p_op, p_level, v_passed);

  if not v_passed then
    return jsonb_build_object('ok', true, 'passed', false, 'level', 0);
  end if;

  select grant_json into v_grant
  from citadel_access where student_code = p_student_code and section = v_section;

  -- 'all' на положительных сервер и так разворачивает в перечисление,
  -- но подстрахуемся: если раздел уже открыт целиком, дописывать нечего.
  if v_grant = '"all"'::jsonb then
    return jsonb_build_object('ok', true, 'passed', true, 'level', p_level, 'grant', v_grant);
  end if;
  if v_grant is null or jsonb_typeof(v_grant) <> 'object' then
    v_grant := '{}'::jsonb;
  end if;
  v_op := v_grant -> p_op;
  if v_op = '"all"'::jsonb then
    return jsonb_build_object('ok', true, 'passed', true, 'level', p_level, 'grant', v_grant);
  end if;

  -- Объединяем со звёздами, которые уже были названы: экзамен только
  -- ДОБАВЛЯЕТ. Отнять что-то у ученика он не должен ни при каком результате.
  select jsonb_agg(distinct lvl order by lvl) into v_levels
  from (
    select generate_series(1, p_level) as lvl
    union
    select (jsonb_array_elements_text(coalesce(
      case when jsonb_typeof(v_op) = 'array' then v_op else '[]'::jsonb end,
      '[]'::jsonb)))::int
  ) s;

  v_grant := jsonb_set(v_grant, array[p_op], coalesce(v_levels, '[]'::jsonb), true);

  insert into citadel_access (student_code, section, grant_json, granted_by)
  values (p_student_code, v_section, v_grant, 'exam')
  on conflict (student_code, section)
  do update set grant_json = excluded.grant_json, granted_at = now(), granted_by = 'exam';

  return jsonb_build_object('ok', true, 'passed', true, 'level', p_level, 'grant', v_grant);
end;
$$;

create or replace function session_take_exam(p_token text, p_op text, p_level int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_take_exam(v_code, p_op, p_level);
end;
$$;

create or replace function take_exam(p_code text, p_password text, p_op text, p_level int)
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
  return impl_take_exam(p_code, p_op, p_level);
end;
$$;

-- Можно ли сдавать прямо сейчас — чтобы приложение не звало экзамен впустую.
create or replace function session_exam_allowed(p_token text, p_op text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return jsonb_build_object('ok', true, 'allowed', impl_exam_allowed(v_code, p_op));
end;
$$;

create or replace function exam_allowed(p_code text, p_password text, p_op text)
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
  return jsonb_build_object('ok', true, 'allowed', impl_exam_allowed(p_code, p_op));
end;
$$;

-- =====================================================================
--  4. Что видит репетитор
-- ---------------------------------------------------------------------
--  Экзамен открывает доступ сам и сразу, но за спиной у репетитора
--  этого происходить не должно: он видит каждую попытку своего ученика.
-- =====================================================================

create or replace function impl_student_exams(p_tutor_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_rows  jsonb;
begin
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'op', op, 'level', level, 'passed', passed, 'takenAt', taken_at
         ) order by taken_at desc), '[]'::jsonb)
  into v_rows
  from (select * from citadel_exam where student_code = p_student_code
        order by taken_at desc limit 20) e;
  return jsonb_build_object('ok', true, 'exams', v_rows);
end;
$$;

create or replace function session_student_exams(p_token text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_student_exams(v_code, p_student_code);
end;
$$;

create or replace function student_exams(p_tutor_code text, p_tutor_password text, p_student_code text)
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
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  return impl_student_exams(p_tutor_code, p_student_code);
end;
$$;

grant execute on function session_take_exam(text, text, int)        to anon;
grant execute on function take_exam(text, text, text, int)          to anon;
grant execute on function session_exam_allowed(text, text)          to anon;
grant execute on function exam_allowed(text, text, text)            to anon;
grant execute on function session_student_exams(text, text)         to anon;
grant execute on function student_exams(text, text, text)           to anon;
