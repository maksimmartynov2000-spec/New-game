-- =====================================================================
--  ЭКЗАМЕН ПО РАЗДЕЛАМ
-- ---------------------------------------------------------------------
--  Запускать ПОСЛЕ exam.sql и exam-cap.sql. Можно на работающем приложении
--  и сколько угодно раз подряд.
--
--  Что не так было.
--
--  1. Раздел зашит внутри: impl_take_exam писала 'integer+' в любом случае.
--     Экзамена в другом разделе не могло быть физически.
--
--  2. Попытка дня считалась по действию, без раздела. Провалил экзамен по
--     умножению на положительных — по умножению на отрицательных сегодня уже
--     нельзя, хотя это другой экзамен.
--
--  3. Сырое 'all' в доступе ученика экзамен обходил: отвечал «сдал» и выходил,
--     ничего не записав. Приложение пропускает в обход золота только звезду,
--     названную ПОИМЁННО, а 'all' поимённым не считает — и ребёнок видел
--     «открыто до 3★», а звёзды оставались за золотом. На положительных сырого
--     'all' почти не бывает: выдача сама разворачивает его в «все пять звёзд»
--     (expand_positive_grant в student-access.sql). Но строки, выданные раньше
--     этого правила, могли остаться.
--
--  Как теперь.
--
--  * exam_sections() — разделы, где экзамен открывает звёзды. Сейчас там только
--    'integer+'. Отрицательные добавляются сюда в тот день, когда их откроют
--    всем, одной строкой — вместе с EXAM_SECTIONS в index.html. До этого экзамен
--    на отрицательных есть только пробный, у репетитора, и сервер его не видит.
--
--  * Раздел — параметр. Не из списка — отказ 'section_closed': экзамен не должен
--    открывать раздел, который открывает репетитор.
--
--  * Попытка дня — по паре «раздел + действие».
--
--  * Сырое 'all' читается так, как его понимает выдача доступа:
--      - на положительных — «все пять звёзд поимённо», как и разворачивает его
--        expand_positive_grant. Экзамену там дописывать нечего, и он ничего не
--        отнимает;
--      - в разделе, который откроют всем позже (отрицательные), 'all' от
--        репетитора значило «раздел открыт, звёзды за золото». Так и остаётся:
--        поимённо там ничего, и экзамен дописывает сданные звёзды.
--
--  Старые функции с тремя параметрами остались и работают как раньше — для
--  'integer+'. Приложение зовёт их, пока экзамен идёт на положительных, поэтому
--  порядок «сначала база, потом приложение» тут не важен.
-- =====================================================================

-- 1. Где экзамен открывает звёзды. Одно место на всю базу.
create or replace function exam_sections()
returns text[]
language sql
immutable
as $$ select array['integer+']::text[] $$;

-- 2. Можно ли сегодня сдавать — по разделу и действию.
create or replace function impl_exam_allowed(p_student_code text, p_op text, p_section text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select not exists (
    select 1 from citadel_exam
    where student_code = p_student_code
      and section = p_section
      and op = p_op
      and not passed
      and taken_at >= date_trunc('day', now())
  );
$$;

-- Старая проверка — теперь про положительные. В журнале до этой миграции других
-- разделов не было, так что для старых записей ничего не меняется.
create or replace function impl_exam_allowed(p_student_code text, p_op text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$ select impl_exam_allowed(p_student_code, p_op, 'integer+') $$;

-- 3. Запись результата и открытие звёзд.
create or replace function impl_take_exam(
  p_student_code text, p_op text, p_level int, p_section text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_claimed  int  := p_level;
  v_level    int;
  v_passed   boolean;
  v_grant    jsonb;
  v_op       jsonb;
  v_levels   jsonb;
begin
  if p_section is null or not (p_section = any (exam_sections())) then
    return jsonb_build_object('ok', false, 'error', 'section_closed');
  end if;
  if p_op not in ('add', 'sub', 'mul', 'div') then
    return jsonb_build_object('ok', false, 'error', 'bad_op');
  end if;
  if p_level is null or p_level < 0 or p_level > 5 then
    return jsonb_build_object('ok', false, 'error', 'bad_level');
  end if;
  if not exists (select 1 from citadel_progress where code = p_student_code) then
    return jsonb_build_object('ok', false, 'error', 'no_student');
  end if;
  if not impl_exam_allowed(p_student_code, p_op, p_section) then
    return jsonb_build_object('ok', false, 'error', 'already_today');
  end if;

  -- Потолок — тот же, что в exam-cap.sql.
  v_level  := least(v_claimed, exam_max_grant());
  v_passed := v_level >= 1;

  insert into citadel_exam (student_code, section, op, level, passed, claimed_level)
  values (p_student_code, p_section, p_op, v_level, v_passed, v_claimed);

  if not v_passed then
    return jsonb_build_object('ok', true, 'passed', false, 'level', 0, 'claimed', v_claimed);
  end if;

  select grant_json into v_grant
  from citadel_access where student_code = p_student_code and section = p_section;

  -- Сырое 'all' — так, как его понимает выдача доступа (см. шапку). На
  -- положительных — все пять звёзд поимённо, ровно как expand_positive_grant.
  -- В остальных разделах — поимённо ничего: звёзды там за золотом.
  if v_grant is null then
    v_grant := '{}'::jsonb;
  elsif p_section = 'integer+' then
    v_grant := expand_positive_grant(v_grant);
  elsif jsonb_typeof(v_grant) <> 'object' then
    v_grant := '{}'::jsonb;
  end if;
  v_op := v_grant -> p_op;
  if v_op is null or jsonb_typeof(v_op) <> 'array' then
    v_op := '[]'::jsonb;
  end if;

  -- Экзамен только ДОБАВЛЯЕТ: звёзды, названные раньше, остаются, в том числе
  -- четвёртая и пятая от репетитора.
  select jsonb_agg(distinct lvl order by lvl) into v_levels
  from (
    select generate_series(1, v_level) as lvl
    union
    select (jsonb_array_elements_text(v_op))::int
  ) s;

  v_grant := jsonb_set(v_grant, array[p_op], coalesce(v_levels, '[]'::jsonb), true);

  insert into citadel_access (student_code, section, grant_json, granted_by)
  values (p_student_code, p_section, v_grant, 'exam')
  on conflict (student_code, section)
  do update set grant_json = excluded.grant_json, granted_at = now(), granted_by = 'exam';

  return jsonb_build_object('ok', true, 'passed', true, 'level', v_level,
                            'claimed', v_claimed, 'grant', v_grant);
end;
$$;

-- Старая запись — теперь просто положительные через новую.
create or replace function impl_take_exam(p_student_code text, p_op text, p_level int)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$ select impl_take_exam(p_student_code, p_op, p_level, 'integer+') $$;

-- 4. Вход по токену: с разделом. Без раздела по-прежнему работает старая
--    функция с тремя параметрами — её здесь не трогаем.
create or replace function session_take_exam(p_token text, p_op text, p_level int, p_section text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_take_exam(v_code, p_op, p_level, p_section);
end;
$$;

create or replace function session_exam_allowed(p_token text, p_op text, p_section text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return jsonb_build_object('ok', true, 'allowed', impl_exam_allowed(v_code, p_op, p_section));
end;
$$;

-- 5. Список экзаменов ученика — теперь с разделом.
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
           'section', section, 'op', op, 'level', level,
           'claimed', coalesce(claimed_level, level),
           'passed', passed, 'takenAt', taken_at
         ) order by taken_at desc), '[]'::jsonb)
  into v_rows
  from (select * from citadel_exam where student_code = p_student_code
        order by taken_at desc limit 20) e;
  return jsonb_build_object('ok', true, 'exams', v_rows, 'maxGrant', exam_max_grant());
end;
$$;

-- 6. Права. Наружу — только session_*. Отзываем у самих ролей, а не у public:
--    Supabase выдаёт каждой новой функции права напрямую anon и authenticated,
--    и отзыв у public их не трогает (подробно — в шапке lock-internals.sql).
revoke execute on function exam_sections()                       from anon, authenticated, public;
revoke execute on function impl_exam_allowed(text, text, text)   from anon, authenticated, public;
revoke execute on function impl_exam_allowed(text, text)         from anon, authenticated, public;
revoke execute on function impl_take_exam(text, text, int, text) from anon, authenticated, public;
revoke execute on function impl_take_exam(text, text, int)       from anon, authenticated, public;
revoke execute on function impl_student_exams(text, text)        from anon, authenticated, public;
grant execute on function session_take_exam(text, text, int, text) to anon;
grant execute on function session_exam_allowed(text, text, text)   to anon;

-- Проверка: первая строка должна быть «ДА».
select case when count(*) = 0 then 'ДА — снаружи видны только session_*'
            else 'НЕТ — открыто лишнего: ' || string_agg(p.proname, ', ') end as "Внутренности закрыты?"
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname not like 'session\_%'
   and has_function_privilege('anon', p.oid, 'execute')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
