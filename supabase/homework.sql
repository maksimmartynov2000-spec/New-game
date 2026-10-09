-- =====================================================================
--  ДОМАШНИЕ ЗАДАНИЯ
-- ---------------------------------------------------------------------
--  Запускать ПОСЛЕ account-link.sql. Можно на работающем приложении и сколько
--  угодно раз подряд: таблица заводится «if not exists», функции переиздаются.
--
--  Задание — «N верных ответов в клетке», например «Сложение 3★ — 30 верных».
--  Репетитор выдаёт его одному ученику, нескольким или всей папке сразу (папки
--  живут у репетитора на устройстве, сюда приходит просто список логинов), со
--  сроком или без.
--
--  Как считается сделанное. В момент выдачи сервер запоминает, сколько верных
--  ответов в этой клетке у ученика уже было (base). Сделано = сколько стало минус
--  base. Своего счётчика у задания нет, и ученику ничего отдельно отправлять не
--  нужно: верные ответы он и так копит в своём состоянии, а ответы с подсказкой
--  туда не попадают — значит, и в задание не идут. Цена: если ученик решал без
--  связи и его копия ещё не доехала до сервера, ответы, данные ДО выдачи, могут
--  засчитаться. Это в пользу ученика и на считанные примеры.
--
--  Звезда задания у ученика может быть закрыта. Тогда выдача её открывает —
--  поимённо, как кнопка ⭐: задание, которое нельзя начать, хуже, чем никакого.
--  Если раздел или действие открыты целиком («дойдёшь сам»), доступ не трогаем:
--  ворота по звёздам для клетки задания снимает само приложение, пока задание есть.
--
--  Когда выполнено — пишет приложение ученика в его же состояние (hwDone, дата по
--  его часам). Репетитор видит её отсюда, вместе с прогрессом.
-- =====================================================================

create table if not exists citadel_homework (
  id           bigserial primary key,
  batch        bigint not null,                    -- одна выдача сразу нескольким
  tutor_code   text not null references citadel_progress (code) on delete cascade,
  student_code text not null references citadel_progress (code) on delete cascade,
  topic        text not null,                      -- клетка: 'integer+:add:3'
  need         int  not null,                      -- сколько верных ответов задано
  base         int  not null default 0,            -- сколько верных в клетке было при выдаче
  due_on       date,                               -- срок, если задан
  created_at   timestamptz not null default now()
);
create sequence if not exists citadel_homework_batch_seq;
create index if not exists citadel_homework_student_idx on citadel_homework (student_code);
create index if not exists citadel_homework_tutor_idx   on citadel_homework (tutor_code);
alter table citadel_homework enable row level security;
revoke all on table citadel_homework from anon, authenticated, public;
revoke all on sequence citadel_homework_id_seq, citadel_homework_batch_seq from anon, authenticated, public;

-- ---------------------------------------------------------------------
--  Общая часть
-- ---------------------------------------------------------------------

-- Клетка, которую можно задать. У дробей есть свои четыре режима; у остальных
-- разделов — только четыре действия. Звёзд везде пять.
create or replace function hw_valid_topic(p_topic text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_topic, '') ~ '^(integer[+-]|decimal\+):(add|sub|mul|div):[1-5]$'
      or coalesce(p_topic, '') ~ '^fraction\+:(add|sub|mul|div|simplify|toMixed|toImproper|fracOfNumber):[1-5]$'
$$;

-- Сколько верных ответов в клетке записано в состоянии. Состояние пишет клиент,
-- поэтому верить его форме нельзя: не число — значит ноль, а не ошибка запроса.
create or replace function hw_correct(p_state jsonb, p_topic text)
returns int
language sql
immutable
as $$
  select case when (p_state -> 'byTopic' -> p_topic ->> 'correct') ~ '^[0-9]{1,9}$'
              then (p_state -> 'byTopic' -> p_topic ->> 'correct')::int
              else 0 end
$$;

-- Дата выполнения из состояния ученика — только если похожа на дату.
create or replace function hw_done_on(p_state jsonb, p_id bigint)
returns text
language sql
immutable
as $$
  select case when (p_state -> 'hwDone' ->> p_id::text) ~ '^\d{4}-\d{2}-\d{2}$'
              then p_state -> 'hwDone' ->> p_id::text end
$$;

-- Открыть ученику звезду задания, если она закрыта. Ровно одну звезду и только
-- поимённо: так ворота на ней снимаются, а остальное остаётся как было. Раздел
-- или действие, открытые целиком, не трогаем — их не сузить, не потеряв лишнего.
-- Возвращает true, если доступ пришлось поменять.
create or replace function hw_open_cell(p_tutor text, p_student text, p_topic text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_section text := split_part(p_topic, ':', 1);
  v_op      text := split_part(p_topic, ':', 2);
  v_level   int  := split_part(p_topic, ':', 3)::int;
  v_grant   jsonb;
  v_op_lv   jsonb;
begin
  select grant_json into v_grant from citadel_access
   where student_code = p_student and section = v_section
   for update;
  if not found then
    insert into citadel_access (student_code, section, grant_json, granted_by)
    values (p_student, v_section, jsonb_build_object(v_op, jsonb_build_array(v_level)), p_tutor)
    on conflict (student_code, section) do nothing;
    return found;
  end if;
  if jsonb_typeof(v_grant) <> 'object' then return false; end if;      -- 'all' на весь раздел
  v_op_lv := v_grant -> v_op;
  if v_op_lv is null then
    v_grant := v_grant || jsonb_build_object(v_op, jsonb_build_array(v_level));
  elsif jsonb_typeof(v_op_lv) = 'array' then
    if v_op_lv @> to_jsonb(v_level) then return false; end if;         -- уже открыта поимённо
    v_grant := jsonb_set(v_grant, array[v_op],
                         (select jsonb_agg(x order by x)
                            from (select (e #>> '{}')::int as x from jsonb_array_elements(v_op_lv) e
                                  union select v_level) s));
  else
    return false;                                                        -- 'all' на действие
  end if;
  update citadel_access set grant_json = v_grant, granted_at = now(), granted_by = p_tutor
   where student_code = p_student and section = v_section;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
--  Выдать
-- ---------------------------------------------------------------------
create or replace function impl_assign_homework(
  p_tutor_code text, p_students jsonb, p_topic text, p_need int, p_due text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type     text;
  v_due      date;
  v_batch    bigint;
  v_code     text;
  v_owner    text;
  v_stype    text;
  v_state    jsonb;
  v_assigned jsonb := '[]'::jsonb;
  v_skipped  jsonb := '[]'::jsonb;
  v_opened   jsonb := '[]'::jsonb;
begin
  select account_type into v_type from citadel_progress where code = p_tutor_code;
  if not found or coalesce(v_type, 'self') <> 'self' then
    return jsonb_build_object('ok', false, 'error', 'not_a_tutor');
  end if;
  if not hw_valid_topic(p_topic) then
    return jsonb_build_object('ok', false, 'error', 'bad_topic');
  end if;
  if p_need is null or p_need < 1 or p_need > 500 then
    return jsonb_build_object('ok', false, 'error', 'bad_need');
  end if;
  if p_students is null or jsonb_typeof(p_students) <> 'array'
     or jsonb_array_length(p_students) = 0 or jsonb_array_length(p_students) > 100 then
    return jsonb_build_object('ok', false, 'error', 'bad_students');
  end if;
  -- Срок — дата без времени. Вчерашняя тоже принимается: у репетитора на устройстве
  -- может быть уже «завтра», а здесь, по Гринвичу, ещё «сегодня» — и наоборот.
  if nullif(btrim(coalesce(p_due, '')), '') is not null then
    if p_due !~ '^\d{4}-\d{2}-\d{2}$' then
      return jsonb_build_object('ok', false, 'error', 'bad_due');
    end if;
    begin
      v_due := p_due::date;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'bad_due');
    end;
    if v_due < current_date - 1 or v_due > current_date + 120 then
      return jsonb_build_object('ok', false, 'error', 'bad_due');
    end if;
  end if;

  -- Подметаем своё: задания старше трёх месяцев и задания учеников, которых
  -- репетитор отпустил. Видно их всё равно уже не было.
  delete from citadel_homework h
   where h.tutor_code = p_tutor_code
     and (h.created_at < now() - interval '90 days'
          or not exists (select 1 from citadel_progress p
                          where p.code = h.student_code and p.account_type = 'linked'
                            and coalesce(p.owner_code, p.state->>'ownerCode') = p_tutor_code));

  v_batch := nextval('citadel_homework_batch_seq');
  for v_code in select distinct x #>> '{}' from jsonb_array_elements(p_students) x
                 where jsonb_typeof(x) = 'string' loop
    -- Строку ученика держим до конца выдачи: иначе одновременная вторая выдача
    -- обошла бы потолок в тридцать заданий.
    select coalesce(owner_code, state->>'ownerCode'), account_type, state
      into v_owner, v_stype, v_state
      from citadel_progress where code = v_code
      for update;
    if not found or v_owner is distinct from p_tutor_code or v_stype is distinct from 'linked' then
      v_skipped := v_skipped || jsonb_build_object('code', v_code, 'error', 'not_your_student');
      continue;
    end if;
    if (select count(*) from citadel_homework
         where student_code = v_code and tutor_code = p_tutor_code) >= 30 then
      v_skipped := v_skipped || jsonb_build_object('code', v_code, 'error', 'too_many');
      continue;
    end if;
    insert into citadel_homework (batch, tutor_code, student_code, topic, need, base, due_on)
    values (v_batch, p_tutor_code, v_code, p_topic, p_need, hw_correct(v_state, p_topic), v_due);
    v_assigned := v_assigned || to_jsonb(v_code);
    if hw_open_cell(p_tutor_code, v_code, p_topic) then
      v_opened := v_opened || to_jsonb(v_code);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'batch', v_batch,
                            'assigned', v_assigned, 'skipped', v_skipped, 'opened', v_opened);
end;
$$;

-- ---------------------------------------------------------------------
--  Что выдано: для репетитора — с прогрессом по каждому ученику
-- ---------------------------------------------------------------------
create or replace function impl_tutor_homework(p_tutor_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'batch', h.batch, 'student', h.student_code,
           'label', p.state->>'profileLabel',
           'topic', h.topic, 'need', h.need,
           'done', greatest(0, hw_correct(p.state, h.topic) - h.base),
           'dueOn', h.due_on, 'createdAt', h.created_at,
           'doneOn', hw_done_on(p.state, h.id),
           'seenAt', p.updated_at
         ) order by h.created_at desc, h.id), '[]'::jsonb)
    into v_result
    from citadel_homework h
    join citadel_progress p on p.code = h.student_code
   where h.tutor_code = p_tutor_code
     and p.account_type = 'linked'
     and coalesce(p.owner_code, p.state->>'ownerCode') = p_tutor_code;
  return jsonb_build_object('ok', true, 'homework', v_result);
end;
$$;

-- ---------------------------------------------------------------------
--  Что задано мне: для ученика. Только от нынешнего репетитора — задания
--  прежнего после «отпустить» и новой привязки не всплывают.
-- ---------------------------------------------------------------------
create or replace function impl_my_homework(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'topic', h.topic, 'need', h.need, 'base', h.base,
           'dueOn', h.due_on, 'createdAt', h.created_at
         ) order by h.created_at, h.id), '[]'::jsonb)
    into v_result
    from citadel_homework h
    join citadel_progress p on p.code = h.student_code
   where h.student_code = p_code
     and p.account_type = 'linked'
     and h.tutor_code = coalesce(p.owner_code, p.state->>'ownerCode');
  return jsonb_build_object('ok', true, 'homework', v_result);
end;
$$;

-- ---------------------------------------------------------------------
--  Снять задание. Сразу несколько: одну выдачу целиком или одного ученика.
-- ---------------------------------------------------------------------
create or replace function impl_cancel_homework(p_tutor_code text, p_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_n int;
begin
  if p_ids is null or jsonb_typeof(p_ids) <> 'array'
     or jsonb_array_length(p_ids) = 0 or jsonb_array_length(p_ids) > 200 then
    return jsonb_build_object('ok', false, 'error', 'bad_ids');
  end if;
  with gone as (
    delete from citadel_homework
     where tutor_code = p_tutor_code
       and id in (select (x #>> '{}')::bigint from jsonb_array_elements(p_ids) x
                   where jsonb_typeof(x) = 'number' and (x #>> '{}') ~ '^[0-9]{1,18}$')
    returning 1
  )
  select count(*) into v_n from gone;
  return jsonb_build_object('ok', true, 'removed', v_n);
end;
$$;

-- ---------------------------------------------------------------------
--  Входы по токену
-- ---------------------------------------------------------------------
create or replace function session_assign_homework(p_token text, p_students jsonb, p_topic text, p_need int, p_due text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_assign_homework(v_code, p_students, p_topic, p_need, p_due);
end; $$;

create or replace function session_tutor_homework(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_tutor_homework(v_code);
end; $$;

create or replace function session_my_homework(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_my_homework(v_code);
end; $$;

create or replace function session_cancel_homework(p_token text, p_ids jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_cancel_homework(v_code, p_ids);
end; $$;

-- ---------------------------------------------------------------------
--  Права. Наружу — только session_*. Отзываем у самих ролей, а не у public:
--  Supabase выдаёт каждой новой функции права напрямую anon и authenticated
--  (подробно — в шапке lock-internals.sql).
-- ---------------------------------------------------------------------
revoke execute on function hw_valid_topic(text)                       from anon, authenticated, public;
revoke execute on function hw_correct(jsonb, text)                    from anon, authenticated, public;
revoke execute on function hw_done_on(jsonb, bigint)                  from anon, authenticated, public;
revoke execute on function hw_open_cell(text, text, text)             from anon, authenticated, public;
revoke execute on function impl_assign_homework(text, jsonb, text, int, text) from anon, authenticated, public;
revoke execute on function impl_tutor_homework(text)                  from anon, authenticated, public;
revoke execute on function impl_my_homework(text)                     from anon, authenticated, public;
revoke execute on function impl_cancel_homework(text, jsonb)          from anon, authenticated, public;
grant execute on function session_assign_homework(text, jsonb, text, int, text) to anon;
grant execute on function session_tutor_homework(text)                to anon;
grant execute on function session_my_homework(text)                   to anon;
grant execute on function session_cancel_homework(text, jsonb)        to anon;

-- Проверка: обе строки должны начинаться с «ДА». Одним запросом, потому что
-- Supabase показывает результат только последнего.
select 1 as "№",
       case when count(*) = 0 then 'ДА — снаружи видны только session_*'
            else 'НЕТ — открыто лишнего: ' || string_agg(p.proname, ', ') end as "Проверка"
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname not like 'session\_%'
   and has_function_privilege('anon', p.oid, 'execute')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
union all
select 2,
       case when not has_table_privilege('anon', 'citadel_homework', 'select')
             and not has_table_privilege('anon', 'citadel_homework', 'insert')
             and not has_sequence_privilege('anon', 'citadel_homework_batch_seq', 'usage')
            then 'ДА — задания снаружи не читаются и не пишутся'
            else 'НЕТ — таблица заданий открыта наружу' end
order by 1;
