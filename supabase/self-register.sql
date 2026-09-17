-- САМОСТОЯТЕЛЬНАЯ РЕГИСТРАЦИЯ
--
-- Зачем. До этой миграции аккаунт мог завести только репетитор, функцией
-- impl_create_student. Человек, который скачал приложение сам, попасть внутрь не мог
-- физически: экран входа спрашивал логин и пароль, а взять их было неоткуда.
--
-- ЗАПУСКАТЬ ПОСЛЕ session-tokens.sql и owner-columns.sql: здесь используются
-- citadel_session и колонки owner_code / account_type.
--
-- Чем отличается от impl_create_student. Тот заводит УЧЕНИКА: ставит owner_code
-- репетитора и account_type 'linked', и потому требует код репетитора. Здесь
-- заводится сам себе хозяин: owner_code пустой, account_type 'solo'.
--
-- Почему 'solo', а не 'self'. 'self' в приложении означает РЕПЕТИТОРА, которому открыто
-- всё. Первая версия этой функции ставила 'self' — и каждый зарегистрировавшийся ребёнок
-- получал права репетитора: ему открывались отрицательные, десятичные и дроби, то есть
-- разделы, которые ещё в разработке. Отдельный тип это чинит: 'solo' видит ровно то же,
-- что ученик репетитора, и ворота по звёздам на него распространяются.
--
-- Что НЕ делается здесь намеренно:
--   * никакой почты. Почта — это персональные данные ребёнка и лишний экран, а
--     восстановление пароля мы решаем иначе;
--   * никакого состояния из браузера. Прогресс гостя приезжает обычной синхронизацией
--     сразу после регистрации: session_save сливает его с пустой заготовкой, и счётчики
--     берутся максимумом. Принимать состояние ПРЯМО ЗДЕСЬ было бы дырой — любой мог бы
--     создать аккаунт с любыми цифрами одним запросом.
--
-- Ограничение по частоте. Функция открыта анониму, то есть её можно звать сколько
-- угодно. Настоящая защита от накрутки — ограничение на стороне Supabase (Rate limits
-- на anon-ключ); здесь стоит только то, что можно сделать в SQL: один аккаунт не
-- создаётся дважды, а слишком короткие логин и пароль отклоняются.

create or replace function session_register(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  -- Пороги те же, что в приложении (REG_CODE_MIN / REG_PW_MIN). Проверяем и здесь:
  -- на проверку в браузере полагаться нельзя, её обходят открытой консолью.
  if p_code is null or length(btrim(p_code)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;
  if p_password is null or length(p_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'bad_password');
  end if;

  -- Служебные знаки в логине запрещены: код уходит в ключи, ссылки и выгрузки, и
  -- пробел или кавычка в нём потом всплывают в самых неожиданных местах.
  if btrim(p_code) !~ '^[A-Za-z0-9А-Яа-яЁё_-]+$' then
    return jsonb_build_object('ok', false, 'error', 'bad_code');
  end if;

  if exists (select 1 from citadel_progress where code = btrim(p_code)) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  insert into citadel_progress (code, password_hash, owner_code, account_type, state)
  values (
    btrim(p_code),
    crypt(p_password, gen_salt('bf')),
    null,
    'solo',
    -- updatedAt: 0 намеренно. Локальная копия гостя окажется новее, и при первом же
    -- слиянии победят её accountType и имя, а счётчики сольются максимумом.
    jsonb_build_object(
      'schema', 2, 'playerCode', btrim(p_code), 'updatedAt', 0,
      'accountType', 'solo', 'ownerCode', null
    )
  );

  -- Сразу отдаём токен: иначе приложению пришлось бы тут же звать session_login и
  -- второй раз гонять пароль по сети.
  delete from citadel_session where expires_at < now();
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into citadel_session (token_hash, code, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), btrim(p_code), now() + interval '90 days');

  return jsonb_build_object('ok', true, 'token', v_token, 'code', btrim(p_code));
end;
$$;

-- Анониму — можно: до регистрации человек и есть аноним.
revoke execute on function session_register(text, text) from public;
grant execute on function session_register(text, text) to anon;
