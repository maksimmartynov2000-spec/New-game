-- =====================================================================
--  ЭКЗАМЕН: ПОТОЛОК ВЫДАЧИ И ВИДИМОСТЬ ЗАЯВЛЕННОГО РЕЗУЛЬТАТА
-- ---------------------------------------------------------------------
--  Что не так было.
--
--  session_take_exam принимает УРОВЕНЬ числом от браузера: экзамен считается
--  в JavaScript, а серверу сообщается готовый результат. Значит, вызвав функцию
--  из отладчика с p_level = 5, ученик выдавал себе пятую звезду. Раз в день на
--  действие — но выдавал.
--
--  Почему не чиним по-настоящему.
--
--  По-настоящему это чинится только так: примеры для экзамена выдаёт сервер,
--  он же сверяет ответы. Проверять присланный ход экзамена бесполезно — сервер
--  не может отличить честный лёгкий пример пятой звезды от подсунутого примера
--  первой. Это измерено: у генератора есть верхняя граница сложности по уровням
--  и нет нижней, «1 + 1» — законный пример и на 1★, и на 5★.
--
--  А выдавать примеры с сервера значит завести в SQL второй, упрощённый генератор
--  рядом с настоящим — то есть вторую копию правил сложности, которую придётся
--  держать в согласии с первой при каждой правке уровней. Для дыры, цена которой
--  «звёздочка в математической игре», такой размен не окупается.
--
--  Что делаем вместо этого. Две вещи, обе дешёвые:
--
--   1. ПОТОЛОК. Экзамен открывает не больше трёх звёзд, что бы ни прислал клиент.
--      Четвёртую и пятую по-прежнему открывает только репетитор. Так подделка
--      перестаёт давать то, ради чего её стоило бы делать.
--
--   2. ВИДИМОСТЬ. В журнал попыток пишется и заявленный уровень тоже. Если клиент
--      прислал 5, а выдано 3 — это видно репетитору в списке экзаменов ученика.
--      Честный экзамен таких строк не даёт никогда: сам он выше трёх не заявляет.
--
--  Запускать можно на работающем приложении и сколько угодно раз подряд.
-- =====================================================================

-- 1. Заявленный уровень. Для старых записей он равен выданному — тогда потолка
--    не было, и заявленное с выданным совпадало по определению.
alter table citadel_exam add column if not exists claimed_level int;
update citadel_exam set claimed_level = level where claimed_level is null;

-- 2. Сам потолок. Одно число в одном месте: и функция выдачи, и список
--    экзаменов должны понимать его одинаково.
create or replace function exam_max_grant()
returns int
language sql
immutable
as $$ select 3 $$;

-- 3. Запись результата и открытие звёзд — с потолком.
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
  v_claimed  int  := p_level;
  v_level    int;
  v_passed   boolean;
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

  -- Вот он, потолок. Всё, что выше, срезается — но заявленное запоминается.
  v_level  := least(v_claimed, exam_max_grant());
  v_passed := v_level >= 1;

  insert into citadel_exam (student_code, section, op, level, passed, claimed_level)
  values (p_student_code, v_section, p_op, v_level, v_passed, v_claimed);

  if not v_passed then
    return jsonb_build_object('ok', true, 'passed', false, 'level', 0, 'claimed', v_claimed);
  end if;

  select grant_json into v_grant
  from citadel_access where student_code = p_student_code and section = v_section;

  if v_grant = '"all"'::jsonb then
    return jsonb_build_object('ok', true, 'passed', true, 'level', v_level,
                              'claimed', v_claimed, 'grant', v_grant);
  end if;
  if v_grant is null or jsonb_typeof(v_grant) <> 'object' then
    v_grant := '{}'::jsonb;
  end if;
  v_op := v_grant -> p_op;
  if v_op = '"all"'::jsonb then
    return jsonb_build_object('ok', true, 'passed', true, 'level', v_level,
                              'claimed', v_claimed, 'grant', v_grant);
  end if;

  -- Объединяем со звёздами, которые уже были названы: экзамен только ДОБАВЛЯЕТ.
  -- Отнять что-то у ученика он не должен ни при каком результате — в том числе
  -- и потолок не должен закрывать четвёртую звезду, если её открыл репетитор.
  select jsonb_agg(distinct lvl order by lvl) into v_levels
  from (
    select generate_series(1, v_level) as lvl
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

  return jsonb_build_object('ok', true, 'passed', true, 'level', v_level,
                            'claimed', v_claimed, 'grant', v_grant);
end;
$$;

revoke execute on function impl_take_exam(text, text, int) from public;

-- 4. Список экзаменов ученика теперь отдаёт и заявленный уровень, и потолок.
--    Репетитору важно не само число, а расхождение: честный экзамен выше
--    потолка не заявляет никогда.
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
           'op', op, 'level', level, 'claimed', coalesce(claimed_level, level),
           'passed', passed, 'takenAt', taken_at
         ) order by taken_at desc), '[]'::jsonb)
  into v_rows
  from (select * from citadel_exam where student_code = p_student_code
        order by taken_at desc limit 20) e;
  return jsonb_build_object('ok', true, 'exams', v_rows, 'maxGrant', exam_max_grant());
end;
$$;

revoke execute on function impl_student_exams(text, text) from public;
