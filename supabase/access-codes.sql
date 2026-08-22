-- =====================================================================
--  Учительские коды доступа
-- ---------------------------------------------------------------------
--  Выполнить ОДИН РАЗ в Supabase → SQL Editor → New query → Run,
--  после migration.sql, stats-report.sql и session-tokens.sql.
--  Плейсхолдеров нет, править ничего не нужно.
--
--  Зачем. Приложение стало одним курсом: целые положительные, четыре
--  действия, пять уровней. Остальное закрыто. Открывает репетитор —
--  кодом, который выдаёт конкретному ученику. Выбор темы это работа
--  репетитора, а не ребёнка, которому проще взять то, что уже выходит.
--
--  Свойства кода, все обсуждены и намеренны:
--    — открывает ОДИН раздел, но с точностью до режимов и уровней;
--    — привязан к одному ученику: переслать однокласснику бесполезно;
--    — навсегда, без срока;
--    — одноразовый: погашен — больше не работает. Так случайно
--      разошедшийся код не открывает доступ полклассу.
--
--  Важное про отзыв. Доступ — не прогресс. Прогресс сливается по правилу
--  «только растёт», и это верно: решённое не отменить. С доступом наоборот,
--  отозванный обязан исчезнуть. Поэтому доступ живёт отдельной таблицей,
--  сервер по нему единственная правда, а на устройстве только слепок,
--  который перезаписывается при каждой синхронизации.
-- =====================================================================

-- 1. Выданные коды. Сам код хранится открытым текстом намеренно: репетитор
--    должен видеть в списке, что именно он выдал, и повторить это ученику,
--    если тот потерял сообщение. Секретности здесь и не требуется — код
--    бесполезен без логина того ученика, которому он выписан.
create table if not exists citadel_access_code (
  code           text primary key,
  tutor_code     text not null,
  student_code   text not null,
  section        text not null,           -- 'fraction+', 'decimal+', 'integer-'
  grant_json     jsonb not null,          -- 'all' либо { "add": [1,2,3], "sub": "all" }
  created_at     timestamptz not null default now(),
  redeemed_at    timestamptz,
  revoked_at     timestamptz
);

create index if not exists citadel_access_code_tutor_idx   on citadel_access_code (tutor_code);
create index if not exists citadel_access_code_student_idx on citadel_access_code (student_code);

-- 2. Действующий доступ. Отдельно от кодов, потому что вопрос «что открыто
--    у этого ученика прямо сейчас» задаётся при каждом запуске приложения,
--    и перебирать ради него историю выданных кодов незачем.
create table if not exists citadel_access (
  student_code text not null,
  section      text not null,
  grant_json   jsonb not null,
  granted_at   timestamptz not null default now(),
  granted_by   text,
  primary key (student_code, section)
);

-- Удаление аккаунта уносит и коды, и доступ.
do $$
begin
  alter table citadel_access_code
    add constraint citadel_access_code_student_fkey
    foreign key (student_code) references citadel_progress (code) on delete cascade;
exception when others then null;
end $$;

do $$
begin
  alter table citadel_access
    add constraint citadel_access_student_fkey
    foreign key (student_code) references citadel_progress (code) on delete cascade;
exception when others then null;
end $$;

-- Прямой доступ закрыт всем, как и к остальным таблицам.
alter table citadel_access_code enable row level security;
alter table citadel_access      enable row level security;

-- =====================================================================
--  3. Общая часть
-- =====================================================================

-- Алфавит без похожих друг на друга символов: ноль и О, единица и И,
-- тройка и З. Код диктуется голосом и набирается ребёнком, поэтому
-- «примерно похоже» здесь недопустимо.
create or replace function make_access_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'АБВГДЕЖКЛМНПРСТУФХЦЧШЭЮЯ23456789';
  v_code text;
  guard  int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from citadel_access_code where code = v_code);
    guard := guard + 1;
    exit when guard > 50;   -- при 32^6 вариантах сюда не попасть, но зависать нельзя
  end loop;
  return v_code;
end;
$$;

-- Проверка формы разрешения. Пускать сюда что попало нельзя: этот jsonb
-- потом читает клиент и по нему открывает разделы.
create or replace function valid_grant(p_grant jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  k text;
  v jsonb;
  e jsonb;
begin
  if p_grant is null then return false; end if;
  if jsonb_typeof(p_grant) = 'string' then return p_grant #>> '{}' = 'all'; end if;
  if jsonb_typeof(p_grant) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_grant)) = 0 then return false; end if;

  for k, v in select * from jsonb_each(p_grant) loop
    if k not in ('add','sub','mul','div','simplify','toMixed','toImproper','fracOfNumber') then
      return false;
    end if;
    if jsonb_typeof(v) = 'string' then
      if v #>> '{}' <> 'all' then return false; end if;
    elsif jsonb_typeof(v) = 'array' then
      if jsonb_array_length(v) = 0 then return false; end if;
      for e in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(e) <> 'number' then return false; end if;
        if (e #>> '{}')::numeric not in (1,2,3,4,5) then return false; end if;
      end loop;
    else
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Общая часть выдачи. Живёт отдельно, чтобы парольный и токенный пути
-- звали одну и ту же проверку и не могли разойтись в том, что разрешают.
create or replace function impl_issue_access_code(
  p_tutor_code text, p_student_code text, p_section text, p_grant jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_code  text;
begin
  if p_section not in ('integer-', 'decimal+', 'fraction+') then
    return jsonb_build_object('ok', false, 'error', 'bad_section');
  end if;
  if not valid_grant(p_grant) then
    return jsonb_build_object('ok', false, 'error', 'bad_grant');
  end if;
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;

  v_code := make_access_code();
  insert into citadel_access_code (code, tutor_code, student_code, section, grant_json)
  values (v_code, p_tutor_code, p_student_code, p_section, p_grant);

  return jsonb_build_object('ok', true, 'code', v_code, 'section', p_section, 'grant', p_grant);
end;
$$;

create or replace function impl_list_access_codes(p_tutor_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', code, 'studentCode', student_code, 'section', section, 'grant', grant_json,
    'createdAt', created_at, 'redeemedAt', redeemed_at, 'revokedAt', revoked_at
  ) order by created_at desc), '[]'::jsonb)
  into v_result
  from citadel_access_code
  where tutor_code = p_tutor_code
    and (p_student_code is null or student_code = p_student_code);
  return jsonb_build_object('ok', true, 'codes', v_result);
end;
$$;

-- Отзыв. Гасит и сам код (если ещё не погашен), и уже выданный по нему доступ.
-- Одно без другого бессмысленно: отозвать код, оставив открытый раздел, —
-- это не отзыв, а видимость отзыва.
create or replace function impl_revoke_access_code(p_tutor_code text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row citadel_access_code%rowtype;
begin
  select * into v_row from citadel_access_code where code = p_code;
  if not found or v_row.tutor_code <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_code');
  end if;
  update citadel_access_code set revoked_at = now() where code = p_code;
  delete from citadel_access where student_code = v_row.student_code and section = v_row.section;
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
--  4. Наружу: репетитор
-- =====================================================================

create or replace function session_issue_access_code(
  p_token text, p_student_code text, p_section text, p_grant jsonb
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
  return impl_issue_access_code(v_code, p_student_code, p_section, p_grant);
end;
$$;

create or replace function session_list_access_codes(p_token text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_list_access_codes(v_code, p_student_code);
end;
$$;

create or replace function session_revoke_access_code(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_revoke_access_code(v_code, p_code);
end;
$$;

-- Парольный путь — на случай устройства, ещё не обменявшего пароль на токен.
create or replace function issue_access_code(
  p_tutor_code text, p_tutor_password text, p_student_code text, p_section text, p_grant jsonb
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
  return impl_issue_access_code(p_tutor_code, p_student_code, p_section, p_grant);
end;
$$;

create or replace function list_access_codes(
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
  return impl_list_access_codes(p_tutor_code, p_student_code);
end;
$$;

create or replace function revoke_access_code(
  p_tutor_code text, p_tutor_password text, p_code text
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
  return impl_revoke_access_code(p_tutor_code, p_code);
end;
$$;

-- =====================================================================
--  5. Наружу: ученик
-- =====================================================================

-- Погашение кода. Проверок три, и каждая закрывает свой обход:
-- код существует, он выписан именно этому ученику, и его ещё не гасили.
create or replace function impl_redeem_access_code(p_student_code text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row citadel_access_code%rowtype;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  select * into v_row from citadel_access_code where code = upper(trim(p_code));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  -- «Не твой код» и «такого кода нет» отвечаем одинаково: иначе перебором
  -- можно было бы выяснить, какие коды вообще существуют.
  if v_row.student_code <> p_student_code then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_row.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  update citadel_access_code set redeemed_at = now() where code = v_row.code;

  -- Если по этому разделу уже что-то было открыто, новый код заменяет старое
  -- целиком. Складывать два разрешения — значит получить набор, которого
  -- репетитор не выдавал ни разу.
  insert into citadel_access (student_code, section, grant_json, granted_by)
  values (p_student_code, v_row.section, v_row.grant_json, v_row.tutor_code)
  on conflict (student_code, section)
  do update set grant_json = excluded.grant_json, granted_at = now(), granted_by = excluded.granted_by;

  return jsonb_build_object('ok', true, 'section', v_row.section, 'grant', v_row.grant_json);
end;
$$;

create or replace function session_redeem_access_code(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_redeem_access_code(v_code, p_code);
end;
$$;

create or replace function redeem_access_code(p_code_owner text, p_password text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_code_owner;
  if v_hash is null or v_hash <> crypt(p_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  return impl_redeem_access_code(p_code_owner, p_code);
end;
$$;

-- Что открыто прямо сейчас. Приложение спрашивает это при каждом запуске
-- и перезаписывает свой слепок ответом сервера — так работает отзыв.
create or replace function impl_my_access(p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_object_agg(section, grant_json), '{}'::jsonb)
  into v_result
  from citadel_access where student_code = p_student_code;
  return jsonb_build_object('ok', true, 'access', v_result);
end;
$$;

create or replace function session_my_access(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_my_access(v_code);
end;
$$;

create or replace function my_access(p_code text, p_password text)
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
  return impl_my_access(p_code);
end;
$$;

-- =====================================================================
--  6. Права
-- =====================================================================

grant execute on function session_issue_access_code(text, text, text, jsonb) to anon;
grant execute on function session_list_access_codes(text, text) to anon;
grant execute on function session_revoke_access_code(text, text) to anon;
grant execute on function session_redeem_access_code(text, text) to anon;
grant execute on function session_my_access(text) to anon;
grant execute on function issue_access_code(text, text, text, text, jsonb) to anon;
grant execute on function list_access_codes(text, text, text) to anon;
grant execute on function revoke_access_code(text, text, text) to anon;
grant execute on function redeem_access_code(text, text, text) to anon;
grant execute on function my_access(text, text) to anon;

revoke execute on function make_access_code() from public;
revoke execute on function impl_issue_access_code(text, text, text, jsonb) from public;
revoke execute on function impl_list_access_codes(text, text) from public;
revoke execute on function impl_revoke_access_code(text, text) from public;
revoke execute on function impl_redeem_access_code(text, text) from public;
revoke execute on function impl_my_access(text) from public;
