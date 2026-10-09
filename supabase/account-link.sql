-- =====================================================================
--  ПРИВЯЗКА К РЕПЕТИТОРУ И ПАУЗА ПОСЛЕ НЕВЕРНЫХ ПАРОЛЕЙ
-- ---------------------------------------------------------------------
--  Запускать ПОСЛЕ password-null.sql. Можно на работающем приложении и сколько
--  угодно раз подряд: таблицы заводятся «if not exists», функции переиздаются.
--
--  1. Пауза после неверных паролей.
--     Попыток входа было сколько угодно: зная логин, пароль можно было перебирать
--     запросами напрямую, мимо приложения. Теперь первые пять ошибок подряд — без
--     паузы (опечатки бывают у всех), дальше пауза удваивается: 1, 2, 4, 8, 16,
--     32 минуты, потом час — и больше не растёт. Сутки без ошибок — счёт заново.
--     Полной блокировки нет намеренно: иначе одноклассник мог бы нарочно запереть
--     чужой аккаунт. Пауза мешает только новому входу: на устройствах, где ученик
--     уже вошёл, всё работает как работало. Сброс пароля репетитором паузу снимает.
--     Пауза стоит на всех трёх проверках пароля: вход, смена пароля, удаление.
--
--  2. Приглашение. Репетитор получает код из восьми знаков, он действует семь
--     дней и один раз. Ученик с самостоятельным аккаунтом вводит его у себя и
--     становится учеником этого репетитора — со всем прогрессом. Сперва он видит,
--     к кому привязывается (имя из профиля репетитора, не логин). Неверные коды —
--     с той же паузой: подбирать код незачем и не получится.
--
--     При привязке сервер открывает ученику разделы, где у него уже есть прогресс.
--     У учеников репетитора приложение стирает прогресс в разделах, которые не
--     открыты, — без этого привязка его и стёрла бы.
--
--  3. Отпустить. Только репетитор: ученик снова самостоятельный, прогресс и
--     открытые разделы остаются у него.
--
--  4. Ученик репетитора свой аккаунт больше не удалит. Кнопки в приложении у него
--     нет и не было, но запросом напрямую, зная свой пароль, удалить было можно.
--     Удаляет ученика репетитор.
--
--  5. Учеников заводит только репетитор. Проверка была «кроме ученика» — и
--     самостоятельный аккаунт мог завести себе учеников запросом напрямую.
--
--  6. Имя репетитора у ученика. В профиле ученика стоял логин репетитора — то есть
--     половина ключа от аккаунта, через который открываются все ученики. Теперь
--     там имя из профиля репетитора, а логин ученик не видит нигде.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Пауза после неверных попыток
-- ---------------------------------------------------------------------
create table if not exists citadel_throttle (
  key             text primary key,                 -- 'login:<логин>' или 'invite:<логин>'
  failures        int not null default 0,           -- ошибок подряд
  last_failure_at timestamptz not null default now(),
  locked_until    timestamptz                       -- до этого момента попытки не проверяются
);
alter table citadel_throttle enable row level security;
revoke all on table citadel_throttle from anon, authenticated, public;

-- Сколько ждать после n-й ошибки подряд.
create or replace function throttle_pause(p_failures int)
returns interval
language sql
immutable
as $$
  select case when p_failures <= 5 then interval '0'
              else least(interval '60 minutes', interval '1 minute' * power(2, p_failures - 6)) end
$$;

-- Сколько секунд ещё ждать; null — пробовать можно.
create or replace function throttle_wait(p_key text)
returns int
language sql
stable
security definer
set search_path = public, extensions
as $$
  select ceil(extract(epoch from locked_until - now()))::int
    from citadel_throttle
   where key = p_key and locked_until > now()
$$;

-- Ошибка: счёт растёт, пауза — по счёту. Возвращает секунды до следующей попытки.
create or replace function throttle_fail(p_key text)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_failures int;
  v_pause    interval;
begin
  insert into citadel_throttle as t (key, failures, last_failure_at, locked_until)
  values (p_key, 1, now(), null)
  on conflict (key) do update
     set failures = case when t.last_failure_at < now() - interval '24 hours' then 1
                         else t.failures + 1 end,
         last_failure_at = now()
  returning failures into v_failures;
  v_pause := throttle_pause(v_failures);
  update citadel_throttle
     set locked_until = case when v_pause > interval '0' then now() + v_pause end
   where key = p_key;
  return ceil(extract(epoch from v_pause))::int;
end;
$$;

create or replace function throttle_clear(p_key text)
returns void
language sql
security definer
set search_path = public, extensions
as $$ delete from citadel_throttle where key = p_key $$;

-- Проверка пароля — одна на всю базу.
--   {ok:true}
--   {ok:false, error:'bad_credentials', wait:N} — неверный; N секунд до следующей
--                                                 попытки (0 — можно сразу)
--   {ok:false, error:'too_many', wait:N}        — идёт пауза, пароль не проверялся
create or replace function impl_check_password(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_key  text := 'login:' || coalesce(p_code, '');
  v_wait int;
begin
  select password_hash into v_hash from citadel_progress where code = p_code;
  -- Логина нет — ответ тот же, что на неверный пароль. Паузу ему не заводим:
  -- беречь нечего, а таблицу так забили бы мусорными ключами.
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials', 'wait', 0);
  end if;
  -- Попытки по одному логину — строго по очереди: иначе сотня одновременных
  -- запросов проскочила бы проверку паузы разом.
  perform pg_advisory_xact_lock(hashtext(v_key));
  v_wait := throttle_wait(v_key);
  if v_wait is not null then
    -- Во время паузы пароль не проверяется вовсе, даже верный: иначе пауза ничего
    -- бы не стоила — перебор просто шёл бы дальше.
    return jsonb_build_object('ok', false, 'error', 'too_many', 'wait', v_wait);
  end if;
  -- Пустой пароль отсекаем явно, а сравниваем через «is distinct from»: у него с
  -- null нет третьего ответа (см. password-null.sql).
  if p_password is null or p_password = ''
     or v_hash is distinct from crypt(p_password, v_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials', 'wait', throttle_fail(v_key));
  end if;
  perform throttle_clear(v_key);
  return jsonb_build_object('ok', true);
end;
$$;

-- Вход.
create or replace function session_login(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_check jsonb;
  v_state jsonb;
  v_token text;
begin
  v_check := impl_check_password(p_code, p_password);
  if not (v_check->>'ok')::boolean then return v_check; end if;

  select state into v_state from citadel_progress where code = p_code;

  -- Заодно подметаем протухшее: отдельного планировщика ради этого заводить незачем.
  delete from citadel_session where expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into citadel_session (token_hash, code, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_code, now() + interval '90 days');

  return jsonb_build_object('ok', true, 'token', v_token, 'code', p_code, 'state', v_state);
end;
$$;

-- Смена своего пароля. Тип аккаунта проверяется до пароля: ученику менять нельзя
-- в любом случае, и проверять его пароль незачем.
create or replace function session_change_own_password(p_token text, p_old_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code  text := session_owner(p_token);
  v_type  text;
  v_check jsonb;
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;

  select account_type into v_type from citadel_progress where code = v_code;
  -- Ученику свой пароль менять нельзя: его выдаёт репетитор, и смена вслепую
  -- отрезала бы ученика от собственного аккаунта.
  if v_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  v_check := impl_check_password(v_code, p_old_password);
  if not (v_check->>'ok')::boolean then return v_check; end if;
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;

  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf'))
   where code = v_code;
  delete from citadel_session where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- Удаление своего аккаунта. Ученика репетитора удаляет репетитор.
create or replace function session_delete_account(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code  text := session_owner(p_token);
  v_type  text;
  v_check jsonb;
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  select account_type into v_type from citadel_progress where code = v_code;
  if v_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'linked_account');
  end if;
  v_check := impl_check_password(v_code, p_password);
  if not (v_check->>'ok')::boolean then return v_check; end if;
  delete from citadel_session where code = v_code;
  delete from citadel_progress where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- Сброс пароля репетитором снимает и паузу: ребёнка, которого заперли чужими
-- попытками, новый пароль должен пускать сразу. Остальное — как было.
create or replace function impl_reset_student_password(p_tutor_code text, p_student_code text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
begin
  select state->>'ownerCode' into v_owner from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  if p_new_password is null or length(p_new_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;
  update citadel_progress set password_hash = crypt(p_new_password, gen_salt('bf'))
   where code = p_student_code;
  -- Смена пароля выкидывает ученика со всех устройств: иначе «сменил пароль»
  -- не означало бы «отобрал доступ», а только «выдал ещё один способ войти».
  delete from citadel_session where code = p_student_code;
  perform throttle_clear('login:' || p_student_code);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
--  5. Учеников заводит только репетитор. Остальное — как было.
-- ---------------------------------------------------------------------
create or replace function impl_create_student(p_tutor_code text, p_student_code text, p_student_password text, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tutor_type text;
begin
  select account_type into v_tutor_type from citadel_progress where code = p_tutor_code;
  -- Пустой тип читается как репетитор — так же, как в pin_identity.
  if coalesce(v_tutor_type, 'self') <> 'self' then
    return jsonb_build_object('ok', false, 'error', 'not_a_tutor');
  end if;
  if p_student_code is null or length(p_student_code) < 3 then
    return jsonb_build_object('ok', false, 'error', 'code_too_short');
  end if;
  if exists (select 1 from citadel_progress where code = p_student_code) then
    return jsonb_build_object('ok', false, 'error', 'code_taken');
  end if;
  if p_student_password is null or length(p_student_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'password_too_short');
  end if;
  insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
  values (
    p_student_code,
    crypt(p_student_password, gen_salt('bf')),
    p_tutor_code,
    'linked',
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

-- ---------------------------------------------------------------------
--  2. Приглашения
-- ---------------------------------------------------------------------
create table if not exists citadel_invite (
  code       text primary key,                       -- восемь знаков, без дефиса
  tutor_code text not null references citadel_progress (code) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by    text,                                    -- кто привязался
  used_at    timestamptz
);
create index if not exists citadel_invite_tutor_idx on citadel_invite (tutor_code);
alter table citadel_invite enable row level security;
revoke all on table citadel_invite from anon, authenticated, public;

-- Восемь знаков без похожих друг на друга: нет ни O и 0, ни I и 1. 32 знака на
-- восемь мест — больше триллиона вариантов: угадать нельзя и без паузы.
create or replace function make_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_abc   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code  text;
begin
  loop
    v_bytes := gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_abc, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from citadel_invite where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Как код набрали — неважно: с дефисом, пробелами, строчными буквами.
create or replace function normalize_invite(p text)
returns text
language sql
immutable
as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Имя из профиля, а не логин. Пусто — значит null: показывать нечего.
create or replace function tutor_display_name(p_tutor_code text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select nullif(btrim(left(coalesce(state->>'profileLabel', ''), 40)), '')
    from citadel_progress where code = p_tutor_code
$$;

create or replace function impl_create_invite(p_tutor_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type text;
  v_code text;
  v_exp  timestamptz := now() + interval '7 days';
begin
  select account_type into v_type from citadel_progress where code = p_tutor_code;
  if not found or coalesce(v_type, 'self') <> 'self' then
    return jsonb_build_object('ok', false, 'error', 'not_a_tutor');
  end if;
  -- Старые приглашения подметаем: через месяц после срока они не нужны никому.
  delete from citadel_invite where tutor_code = p_tutor_code and expires_at < now() - interval '30 days';
  if (select count(*) from citadel_invite
       where tutor_code = p_tutor_code and used_at is null and expires_at > now()) >= 30 then
    return jsonb_build_object('ok', false, 'error', 'too_many_invites');
  end if;
  v_code := make_invite_code();
  insert into citadel_invite (code, tutor_code, expires_at) values (v_code, p_tutor_code, v_exp);
  return jsonb_build_object('ok', true, 'code', v_code, 'expiresAt', v_exp);
end;
$$;

-- Общая проверка приглашения для «посмотреть» и «принять». Возвращает код
-- репетитора или ошибку. Неверный код тратит попытку — с той же паузой, что и
-- пароль, но своим счётом.
create or replace function invite_check(p_student_code text, p_invite text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key   text := 'invite:' || coalesce(p_student_code, '');
  v_type  text;
  v_wait  int;
  v_inv   citadel_invite%rowtype;
  v_ttype text;
begin
  select account_type into v_type from citadel_progress where code = p_student_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_account');
  end if;
  -- Привязать можно только самостоятельный аккаунт: у ученика уже есть репетитор,
  -- а репетитора к другому репетитору не привязывают.
  if v_type is distinct from 'solo' then
    return jsonb_build_object('ok', false, 'error', 'not_solo');
  end if;
  perform pg_advisory_xact_lock(hashtext(v_key));
  v_wait := throttle_wait(v_key);
  if v_wait is not null then
    return jsonb_build_object('ok', false, 'error', 'too_many', 'wait', v_wait);
  end if;
  select * into v_inv from citadel_invite where code = normalize_invite(p_invite) for update;
  if not found or v_inv.used_at is not null or v_inv.expires_at <= now()
     or v_inv.tutor_code = p_student_code then
    return jsonb_build_object('ok', false, 'error', 'bad_invite', 'wait', throttle_fail(v_key));
  end if;
  select account_type into v_ttype from citadel_progress where code = v_inv.tutor_code;
  if coalesce(v_ttype, 'self') <> 'self' then
    return jsonb_build_object('ok', false, 'error', 'bad_invite', 'wait', throttle_fail(v_key));
  end if;
  perform throttle_clear(v_key);
  return jsonb_build_object('ok', true, 'tutor', v_inv.tutor_code, 'invite', v_inv.code);
end;
$$;

-- Посмотреть, к кому привязка, ничего не меняя.
create or replace function impl_peek_invite(p_student_code text, p_invite text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_check jsonb := invite_check(p_student_code, p_invite);
begin
  if not (v_check->>'ok')::boolean then return v_check; end if;
  return jsonb_build_object('ok', true, 'tutorName', tutor_display_name(v_check->>'tutor'));
end;
$$;

-- Привязать.
create or replace function impl_accept_invite(p_student_code text, p_invite text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_check jsonb;
  v_tutor text;
  v_state jsonb;
  v_sec   text;
begin
  -- Строку ученика держим с самого начала: два приглашения разом не должны
  -- привязать его к двум репетиторам по очереди. Проверка ниже видит уже то,
  -- что записал тот, кто успел первым.
  select state into v_state from citadel_progress where code = p_student_code for update;
  v_check := invite_check(p_student_code, p_invite);
  if not (v_check->>'ok')::boolean then return v_check; end if;
  v_tutor := v_check->>'tutor';

  -- Хозяин — в колонке и в самом прогрессе сразу: права проверяются по прогрессу,
  -- а при каждом сохранении он переписывается из колонки (pin_identity).
  update citadel_progress
     set owner_code   = v_tutor,
         account_type = 'linked',
         state        = coalesce(state, '{}'::jsonb)
                        || jsonb_build_object('accountType', 'linked', 'ownerCode', v_tutor)
   where code = p_student_code;

  -- Разделы, где у ученика уже есть прогресс, открываем целиком. Иначе приложение
  -- стёрло бы этот прогресс как прогресс в закрытом разделе. Уже выданное не трогаем.
  if jsonb_typeof(v_state->'byTopic') = 'object' then
    for v_sec in
      select distinct split_part(k, ':', 1)
        from jsonb_object_keys(v_state->'byTopic') as k
       where split_part(k, ':', 1) in ('integer-', 'decimal+', 'fraction+')
    loop
      insert into citadel_access (student_code, section, grant_json, granted_by)
      values (p_student_code, v_sec, '"all"'::jsonb, 'invite')
      on conflict (student_code, section) do nothing;
    end loop;
  end if;

  update citadel_invite set used_by = p_student_code, used_at = now()
   where code = v_check->>'invite';

  return jsonb_build_object('ok', true,
                            'tutorName', tutor_display_name(v_tutor),
                            'ownerCode', v_tutor,
                            'access', (impl_my_access(p_student_code))->'access');
end;
$$;

-- ---------------------------------------------------------------------
--  3. Отпустить
-- ---------------------------------------------------------------------
create or replace function impl_release_student(p_tutor_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_type  text;
begin
  select coalesce(owner_code, state->>'ownerCode'), account_type into v_owner, v_type
    from citadel_progress where code = p_student_code;
  if v_owner is null or v_owner <> p_tutor_code or v_type is distinct from 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  -- Разделы и выданные звёзды остаются: ребёнок не теряет то, чем занимался.
  update citadel_progress
     set owner_code   = null,
         account_type = 'solo',
         state        = coalesce(state, '{}'::jsonb)
                        || jsonb_build_object('accountType', 'solo', 'ownerCode', null)
   where code = p_student_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
--  6. Имя репетитора у ученика
-- ---------------------------------------------------------------------
create or replace function impl_my_tutor(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_type  text;
begin
  select owner_code, account_type into v_owner, v_type from citadel_progress where code = p_code;
  if v_type is distinct from 'linked' or v_owner is null then
    return jsonb_build_object('ok', true, 'name', null);
  end if;
  return jsonb_build_object('ok', true, 'name', tutor_display_name(v_owner));
end;
$$;

-- ---------------------------------------------------------------------
--  Входы по токену
-- ---------------------------------------------------------------------
create or replace function session_create_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_create_invite(v_code);
end; $$;

create or replace function session_peek_invite(p_token text, p_invite text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_peek_invite(v_code, p_invite);
end; $$;

create or replace function session_accept_invite(p_token text, p_invite text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_accept_invite(v_code, p_invite);
end; $$;

create or replace function session_release_student(p_token text, p_student_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_release_student(v_code, p_student_code);
end; $$;

create or replace function session_my_tutor(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_my_tutor(v_code);
end; $$;

-- ---------------------------------------------------------------------
--  Права. Наружу — только session_*. Отзываем у самих ролей, а не у public:
--  Supabase выдаёт каждой новой функции права напрямую anon и authenticated
--  (подробно — в шапке lock-internals.sql).
-- ---------------------------------------------------------------------
revoke execute on function throttle_pause(int)                       from anon, authenticated, public;
revoke execute on function throttle_wait(text)                       from anon, authenticated, public;
revoke execute on function throttle_fail(text)                       from anon, authenticated, public;
revoke execute on function throttle_clear(text)                      from anon, authenticated, public;
revoke execute on function impl_check_password(text, text)           from anon, authenticated, public;
revoke execute on function impl_reset_student_password(text, text, text) from anon, authenticated, public;
revoke execute on function impl_create_student(text, text, text, text) from anon, authenticated, public;
revoke execute on function make_invite_code()                        from anon, authenticated, public;
revoke execute on function normalize_invite(text)                    from anon, authenticated, public;
revoke execute on function tutor_display_name(text)                  from anon, authenticated, public;
revoke execute on function impl_create_invite(text)                  from anon, authenticated, public;
revoke execute on function invite_check(text, text)                  from anon, authenticated, public;
revoke execute on function impl_peek_invite(text, text)              from anon, authenticated, public;
revoke execute on function impl_accept_invite(text, text)            from anon, authenticated, public;
revoke execute on function impl_release_student(text, text)          from anon, authenticated, public;
revoke execute on function impl_my_tutor(text)                       from anon, authenticated, public;
grant execute on function session_login(text, text)                  to anon;
grant execute on function session_change_own_password(text, text, text) to anon;
grant execute on function session_delete_account(text, text)         to anon;
grant execute on function session_create_invite(text)                to anon;
grant execute on function session_peek_invite(text, text)            to anon;
grant execute on function session_accept_invite(text, text)          to anon;
grant execute on function session_release_student(text, text)        to anon;
grant execute on function session_my_tutor(text)                     to anon;

-- Проверки: все три строки должны быть «ДА».
select case when count(*) = 0 then 'ДА — снаружи видны только session_*'
            else 'НЕТ — открыто лишнего: ' || string_agg(p.proname, ', ') end as "Внутренности закрыты?"
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname not like 'session\_%'
   and has_function_privilege('anon', p.oid, 'execute')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

select case when not has_table_privilege('anon', 'citadel_throttle', 'select')
             and not has_table_privilege('anon', 'citadel_invite', 'select')
            then 'ДА — новые таблицы снаружи не читаются'
            else 'НЕТ — новые таблицы открыты наружу' end as "Таблицы закрыты?";

select case when count(*) = 0 then 'ДА — пароль везде сравнивается строго'
            else 'НЕТ — осталось сравнение «<> crypt»: ' || string_agg(p.proname, ', ') end
       as "Пустой пароль не пускает?"
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.prosrc ~ '<>\s*crypt\(';
