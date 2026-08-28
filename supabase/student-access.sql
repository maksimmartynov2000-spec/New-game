-- =====================================================================
--  Прямое открытие звёзд ученику (без кода)
-- ---------------------------------------------------------------------
--  Выполнить ОДИН РАЗ в Supabase → SQL Editor → New query → Run,
--  после access-codes.sql. Плейсхолдеров нет, править ничего не нужно.
--
--  Зачем. Код работает, когда репетитора нет рядом: продиктовал —
--  ученик ввёл. На занятии это лишние три шага и пауза. Здесь то же
--  разрешение выдаётся напрямую из списка учеников.
--
--  Что чинится заодно. Раздел 'integer+' сервер до сих пор отвергал
--  (impl_issue_access_code разрешал только 'integer-', 'decimal+',
--  'fraction+'). Логика приложения к нему готова: клетка, названная
--  поимённо, открывается в обход ворот. А выписать её было нельзя —
--  сервер отвечал bad_section. Теперь можно и кодом, и напрямую.
--
--  Про 'all' на положительных. В остальных разделах 'all' значит
--  «раздел открыт, дойдёшь до всего сам» — ворота внутри остаются.
--  На положительных доступ и так есть у всех, там ограничивают только
--  ворота, поэтому 'all' не открыл бы ни одной звезды: приложение
--  пропускает ворота лишь для клетки, названной ПОИМЁННО. Чтобы это
--  не превращалось в молчаливую ловушку, для 'integer+' сервер сам
--  разворачивает 'all' в перечисление звёзд.
-- =====================================================================

-- =====================================================================
--  1. Разворачивание 'all' для положительных
-- =====================================================================

create or replace function expand_positive_grant(p_grant jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_out jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  -- 'all' целиком — это все четыре действия по пять звёзд.
  if jsonb_typeof(p_grant) = 'string' then
    return jsonb_build_object(
      'add', '[1,2,3,4,5]'::jsonb, 'sub', '[1,2,3,4,5]'::jsonb,
      'mul', '[1,2,3,4,5]'::jsonb, 'div', '[1,2,3,4,5]'::jsonb);
  end if;

  for k, v in select * from jsonb_each(p_grant) loop
    if jsonb_typeof(v) = 'string' then
      v_out := v_out || jsonb_build_object(k, '[1,2,3,4,5]'::jsonb);
    else
      v_out := v_out || jsonb_build_object(k, v);
    end if;
  end loop;
  return v_out;
end;
$$;

-- =====================================================================
--  2. Коды теперь можно выписывать и на положительные
-- =====================================================================

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
  v_grant jsonb;
begin
  if p_section not in ('integer+', 'integer-', 'decimal+', 'fraction+') then
    return jsonb_build_object('ok', false, 'error', 'bad_section');
  end if;
  if not valid_grant(p_grant) then
    return jsonb_build_object('ok', false, 'error', 'bad_grant');
  end if;
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;

  v_grant := case when p_section = 'integer+' then expand_positive_grant(p_grant) else p_grant end;

  v_code := make_access_code();
  insert into citadel_access_code (code, tutor_code, student_code, section, grant_json)
  values (v_code, p_tutor_code, p_student_code, p_section, v_grant);

  return jsonb_build_object('ok', true, 'code', v_code, 'section', p_section, 'grant', v_grant);
end;
$$;

-- =====================================================================
--  3. Репетитор смотрит, что у ученика открыто сейчас
-- ---------------------------------------------------------------------
--  Нужно затем, что сетка выдачи должна открываться уже отмеченной.
--  Иначе «Применить» стирало бы всё, что было открыто раньше: запись
--  по разделу заменяется целиком, а не складывается (см. п. 4).
-- =====================================================================

create or replace function impl_student_access(p_tutor_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner  text;
  v_result jsonb;
begin
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;

  select coalesce(jsonb_object_agg(section, grant_json), '{}'::jsonb)
  into v_result
  from citadel_access where student_code = p_student_code;

  return jsonb_build_object('ok', true, 'access', v_result);
end;
$$;

create or replace function session_student_access(p_token text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_student_access(v_code, p_student_code);
end;
$$;

create or replace function student_access(p_tutor_code text, p_tutor_password text, p_student_code text)
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
  return impl_student_access(p_tutor_code, p_student_code);
end;
$$;

-- =====================================================================
--  4. Прямая запись доступа
-- ---------------------------------------------------------------------
--  Запись по разделу заменяется ЦЕЛИКОМ, как и при погашении кода:
--  складывать два разрешения — значит получить набор, которого
--  репетитор не выдавал ни разу.
--
--  Пустой p_grant (null или {}) — снять доступ по разделу. Это первое
--  место, где выданное можно забрать обратно: раньше открытое кодом
--  оставалось навсегда, и ошибочная галочка была необратима.
-- =====================================================================

create or replace function impl_set_student_access(
  p_tutor_code text, p_student_code text, p_section text, p_grant jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_grant jsonb;
  v_empty boolean;
begin
  if p_section not in ('integer+', 'integer-', 'decimal+', 'fraction+') then
    return jsonb_build_object('ok', false, 'error', 'bad_section');
  end if;
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;

  v_empty := p_grant is null
          or jsonb_typeof(p_grant) = 'null'
          or (jsonb_typeof(p_grant) = 'object'
              and (select count(*) from jsonb_object_keys(p_grant)) = 0);

  if v_empty then
    delete from citadel_access where student_code = p_student_code and section = p_section;
    return jsonb_build_object('ok', true, 'section', p_section, 'grant', null);
  end if;

  if not valid_grant(p_grant) then
    return jsonb_build_object('ok', false, 'error', 'bad_grant');
  end if;

  v_grant := case when p_section = 'integer+' then expand_positive_grant(p_grant) else p_grant end;

  insert into citadel_access (student_code, section, grant_json, granted_by)
  values (p_student_code, p_section, v_grant, p_tutor_code)
  on conflict (student_code, section)
  do update set grant_json = excluded.grant_json, granted_at = now(), granted_by = excluded.granted_by;

  return jsonb_build_object('ok', true, 'section', p_section, 'grant', v_grant);
end;
$$;

create or replace function session_set_student_access(
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
  return impl_set_student_access(v_code, p_student_code, p_section, p_grant);
end;
$$;

create or replace function set_student_access(
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
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  return impl_set_student_access(p_tutor_code, p_student_code, p_section, p_grant);
end;
$$;

-- =====================================================================
--  5. Права
-- =====================================================================

grant execute on function session_student_access(text, text) to anon;
grant execute on function session_set_student_access(text, text, text, jsonb) to anon;
grant execute on function student_access(text, text, text) to anon;
grant execute on function set_student_access(text, text, text, text, jsonb) to anon;

revoke execute on function expand_positive_grant(jsonb) from public;
revoke execute on function impl_student_access(text, text) from public;
revoke execute on function impl_set_student_access(text, text, text, jsonb) from public;
