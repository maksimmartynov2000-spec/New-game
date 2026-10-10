-- =====================================================================
--  ДРУЗЬЯ
-- ---------------------------------------------------------------------
--  Запускать ПОСЛЕ homework.sql. Можно на работающем приложении и сколько
--  угодно раз подряд: таблицы заводятся «if not exists», функции переиздаются.
--
--  Приложением пользуются дети, поэтому главное здесь не «как показать прогресс
--  друга», а «как не дать незнакомому человеку подобраться к ребёнку». Отсюда
--  правила, на которых держится всё остальное:
--
--  1. Только по коду дружбы, не по логину. Логин — половина ключа от аккаунта, а
--     код дружбы — отдельные шесть знаков. Его можно сменить в любой момент, и
--     старый перестаёт работать сразу. Неверные коды — с той же паузой, что
--     пароли и приглашения, но своим счётом. Верный код счёт НЕ сбрасывает (в
--     отличие от приглашения): приглашение одноразовое, а код друга можно вводить
--     сколько угодно — и знающий один верный код сбрасывал бы им паузу перебора.
--
--  2. Дружба только взаимная: один позвал, второй принял. Позвали друг друга —
--     друзья сразу. Пока не приняли, ни один ничего не видит.
--
--  3. Никакой переписки. Единственный свободный текст — имя для друзей: до
--     двадцати знаков, только буквы, цифры, пробел, дефис, апостроф и точка, и не
--     больше четырёх цифр — чтобы в имя не поместился ни телефон, ни ссылка.
--
--  4. Страница друга собирается ЗДЕСЬ, и наружу уходит только разрешённое: имя,
--     серия дней, медали (без дат), какие картинки коллекции собраны. Ни логина,
--     ни ошибок, ни точности, ни времени занятий, ни экзаменов, ни домашних. Если
--     отдавать прогресс целиком и прятать лишнее в приложении, любой школьник с
--     отладчиком прочитал бы чужие ошибки.
--
--  5. Сравнение — только по желанию: верные ответы за неделю видят друг у друга
--     лишь те, кто оба включил «Участвовать в сравнении». Неделя начинается с
--     понедельника по часам того, кто смотрит.
--
--  6. Репетитор видит имена друзей своих учеников. Только имена.
--
--  Друзья есть у учеников — самостоятельных и учеников репетитора. У репетитора
--  их нет: взрослому в дружбах детей делать нечего, а своих учеников он и так
--  видит. У гостя аккаунта нет — нечем подтвердить, кто он.
--
--  Удалить друга можно в любой момент; он об этом не узнает, просто пропадёт из
--  списка. Запрос без ответа живёт тридцать дней.
-- =====================================================================

-- Карточка для друзей: код дружбы, имя, участие в сравнении. Заводится, когда
-- ученик сам включает друзей; до этого его не найти никаким кодом.
create table if not exists citadel_friend_card (
  code       text primary key references citadel_progress (code) on delete cascade,
  fcode      text not null unique,                 -- код дружбы, шесть знаков без дефиса
  name       text not null,                        -- имя, которое видят друзья
  compare    boolean not null default false,       -- участвует в сравнении за неделю
  created_at timestamptz not null default now()
);
alter table citadel_friend_card enable row level security;
revoke all on table citadel_friend_card from anon, authenticated, public;

-- Дружбы и запросы — одной строкой на пару. a позвал b; пока accepted_at пусто,
-- это запрос, а не дружба.
create table if not exists citadel_friend (
  id          bigserial primary key,
  a           text not null references citadel_progress (code) on delete cascade,
  b           text not null references citadel_progress (code) on delete cascade,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  check (a <> b)
);
-- Пара одна, в какую сторону ни зови: иначе два встречных запроса стали бы двумя
-- строками, и дружба посчиталась бы дважды.
create unique index if not exists citadel_friend_pair_idx on citadel_friend (least(a, b), greatest(a, b));
create index if not exists citadel_friend_a_idx on citadel_friend (a);
create index if not exists citadel_friend_b_idx on citadel_friend (b);
alter table citadel_friend enable row level security;
revoke all on table citadel_friend from anon, authenticated, public;
revoke all on sequence citadel_friend_id_seq from anon, authenticated, public;

-- ---------------------------------------------------------------------
--  Код и имя
-- ---------------------------------------------------------------------

-- Шесть знаков без похожих друг на друга: нет ни O и 0, ни I и 1. 32 знака на шесть
-- мест — миллиард вариантов; угадать чужой код при паузе после пяти ошибок нельзя.
create or replace function make_friend_code()
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
    v_bytes := gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_abc, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from citadel_friend_card where fcode = v_code);
  end loop;
  return v_code;
end;
$$;

-- Как код набрали — неважно: с дефисом, пробелами, строчными буквами.
create or replace function fr_norm_code(p text)
returns text
language sql
immutable
as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Имя для друзей или null, если такое не годится. Буквы перечислены диапазонами,
-- а не классом [[:alpha:]]: класс зависит от настроек базы, и на одной базе он
-- пропускает кириллицу, а на другой — нет. Здесь латиница с французскими и
-- немецкими буквами и кириллица — языки приложения.
create or replace function fr_clean_name(p text)
returns text
language sql
immutable
as $$
  select case when char_length(v) between 2 and 20
               and v ~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-џҐґ0-9 .''’-]+$'
               and v ~ '[A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-џҐґ]'
               and char_length(regexp_replace(v, '[^0-9]', '', 'g')) <= 4
              then v end
    from (select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) as v) s
$$;

-- ---------------------------------------------------------------------
--  Что видно другу. Состояние пишет приложение, поэтому верить его форме нельзя:
--  не число — значит ноль, не дата — значит такого дня нет. И ни одно значение
--  не должно уронить запрос: один сломанный друг не должен ломать список всем.
-- ---------------------------------------------------------------------

-- Число из состояния: только настоящее число, не меньше нуля и не больше миллиона.
create or replace function fr_num(p jsonb)
returns numeric
language sql
immutable
as $$
  select case when jsonb_typeof(p) = 'number' then least(greatest((p #>> '{}')::numeric, 0), 1000000) else 0 end
$$;

-- День журнала 'ГГГГ-ММ-ДД' — только настоящая дата. Без исключений: 30 февраля
-- проверяется переносом через начало месяца, а не попыткой разобрать и упасть.
create or replace function fr_day(p text)
returns date
language sql
immutable
as $$
  select case when p ~ '^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
               and extract(day from make_date(substr(p, 1, 4)::int, substr(p, 6, 2)::int, 1)
                                    + (substr(p, 9, 2)::int - 1)) = substr(p, 9, 2)::int
              then make_date(substr(p, 1, 4)::int, substr(p, 6, 2)::int, substr(p, 9, 2)::int) end
$$;

-- «Сегодня» по часам того, кто смотрит. Принимаем только соседние с серверными
-- сутки: у ребёнка в Москве уже понедельник, а здесь, по Гринвичу, ещё воскресенье.
create or replace function fr_today(p text)
returns date
language sql
stable
as $$
  select case when fr_day(p) between current_date - 1 and current_date + 1 then fr_day(p) else current_date end
$$;

-- Занимался ли в этот день — как isActiveDay в js/topics.js.
create or replace function fr_active(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'object'
     and (fr_num(p -> 'c') + fr_num(p -> 'w') + fr_num(p -> 'tr') > 0 or fr_num(p -> 's') > 0)
$$;

-- Серия дней подряд — построчный перенос streakState из index.html, вместе с
-- заморозками: иначе у друга стояло бы одно число, а у самого ребёнка другое.
-- Числа те же, что там: цель дня DAILY_GOAL = 20, заморозка за каждые
-- FREEZE_EVERY = 5 дней с выполненной целью, в запасе не больше FREEZE_MAX = 2.
-- Совпадение чисел стережёт test/friends.test.js.
--
-- Берём последние двести дней журнала: столько приложение и хранит, а состояние
-- с сотнями тысяч выдуманных дней не должно тормозить чужой список.
create or replace function fr_streak(p_daily jsonb, p_today date)
returns int
language plpgsql
immutable
as $$
declare
  v_streak    int := 0;
  v_freezes   int := 0;
  v_goal_days int := 0;
  v_prev      date;
  v_day       date;
  v_val       jsonb;
  v_gap       int;
begin
  if jsonb_typeof(p_daily) is distinct from 'object' or p_today is null then return 0; end if;
  for v_day, v_val in
    select d, v from (
      select fr_day(e.key) as d, e.value as v
        from jsonb_each(p_daily) e
       where fr_day(e.key) <= p_today and fr_active(e.value)
       order by 1 desc limit 200
    ) s order by d
  loop
    -- Пропуск между днями гасится заморозками; не хватило — серия рвётся.
    if v_prev is not null and v_day - v_prev > 1 then
      v_gap := v_day - v_prev - 1;
      if v_gap > v_freezes then v_freezes := 0; v_streak := 0;
      else v_freezes := v_freezes - v_gap; end if;
    end if;
    v_streak := v_streak + 1;
    if fr_num(v_val -> 'c') + fr_num(v_val -> 'tr') >= 20 then
      v_goal_days := v_goal_days + 1;
      if v_goal_days % 5 = 0 and v_freezes < 2 then v_freezes := v_freezes + 1; end if;
    end if;
    v_prev := v_day;
  end loop;
  if v_prev is null then return 0; end if;
  -- Хвост до сегодня. Сам сегодняшний день пропуском не считается: он ещё идёт.
  if p_today - v_prev > 1 and p_today - v_prev - 1 > v_freezes then return 0; end if;
  return v_streak;
end;
$$;

-- Верных ответов за неделю: с понедельника по сегодня включительно.
create or replace function fr_week(p_daily jsonb, p_today date)
returns int
language sql
immutable
as $$
  select coalesce(sum(fr_num(e.value -> 'c')), 0)::int
    from jsonb_each(case when jsonb_typeof(p_daily) = 'object' then p_daily else '{}'::jsonb end) e
   where jsonb_typeof(e.value) = 'object'
     and fr_day(e.key) between p_today - (extract(isodow from p_today)::int - 1) and p_today
$$;

-- Медали — только сами ступени лесенок, без дат: 'integer+:add:3:a3'.
create or replace function fr_ladders(p_unlocks jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
    from jsonb_each(case when jsonb_typeof(p_unlocks) = 'object' then p_unlocks else '{}'::jsonb end) e
   where e.key ~ '^(integer[+-]|decimal\+|fraction\+):(add|sub|mul|div|simplify|toMixed|toImproper|fracOfNumber):[1-5]:[sac][1-5]$'
     and e.value not in ('null'::jsonb, 'false'::jsonb, '""'::jsonb, '0'::jsonb)
$$;

-- Какие картинки коллекции собраны — номерами. Как collectionTimes в index.html:
-- отметка в коллекции или сотня верных ответов в клетке картинки. Клетки идут
-- так же: сложение, вычитание, умножение, деление, по пять звёзд, и сотня — это
-- PUZZLE_TOTAL. Совпадение стережёт test/friends.test.js.
create or replace function fr_collected(p_state jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(i order by i), '[]'::jsonb) from (
    select (e.ord - 1)::int as i
      from jsonb_array_elements(case when jsonb_typeof(p_state -> 'collections' -> 'paradoxes') = 'array'
                                     then p_state -> 'collections' -> 'paradoxes' else '[]'::jsonb end)
           with ordinality as e(v, ord)
     where e.ord <= 64
       and e.v not in ('null'::jsonb, 'false'::jsonb, '""'::jsonb, '0'::jsonb)
    union
    select ((o.k - 1) * 5 + (l.lvl - 1))::int
      from unnest(array['add', 'sub', 'mul', 'div']) with ordinality as o(op, k)
     cross join generate_series(1, 5) as l(lvl)
     where hw_correct(p_state, 'integer+:' || o.op || ':' || l.lvl) >= 100
  ) s
$$;

-- ---------------------------------------------------------------------
--  Общая часть
-- ---------------------------------------------------------------------

-- Друзья — только у учеников: самостоятельных и учеников репетитора.
create or replace function fr_student(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((select account_type in ('solo', 'linked') from citadel_progress where code = p_code), false)
$$;

-- Запрос без ответа живёт тридцать дней. Подметаем при каждом обращении — отдельного
-- планировщика ради этого заводить незачем.
create or replace function fr_sweep(p_code text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from citadel_friend
   where accepted_at is null and created_at < now() - interval '30 days'
     and (a = p_code or b = p_code)
$$;

create or replace function fr_friend_count(p_code text)
returns int
language sql
stable
security definer
set search_path = public, extensions
as $$
  select count(*)::int from citadel_friend
   where accepted_at is not null and (a = p_code or b = p_code)
$$;

-- Имя второго в паре, если он есть.
create or replace function fr_name(p_code text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$ select name from citadel_friend_card where code = p_code $$;

-- ---------------------------------------------------------------------
--  Всё о друзьях одним запросом: своя карточка, друзья, запросы
--
--    me       — свой код, имя и участие в сравнении; null, пока друзья не включены
--    friends  — [{id, name, streak, ladders, pics, week?}]; week — только когда
--               сравнение включили оба
--    incoming — [{id, name}] — кто зовёт меня
--    outgoing — [{id, name}] — кого позвал я
-- ---------------------------------------------------------------------
create or replace function impl_friends(p_code text, p_today text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_card  citadel_friend_card%rowtype;
  v_today date := fr_today(p_today);
  v_friends  jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  perform fr_sweep(p_code);
  select * into v_card from citadel_friend_card where code = p_code;
  if not found then
    return jsonb_build_object('ok', true, 'me', null,
                              'friends', '[]'::jsonb, 'incoming', '[]'::jsonb, 'outgoing', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', s.id, 'name', s.name,
                              'streak', fr_streak(s.state -> 'daily', v_today),
                              'ladders', fr_ladders(s.state -> 'unlocks'),
                              'pics', fr_collected(s.state))
           || case when v_card.compare and s.compare
                   then jsonb_build_object('week', fr_week(s.state -> 'daily', v_today))
                   else '{}'::jsonb end
           order by lower(s.name), s.id), '[]'::jsonb)
    into v_friends
    from (select f.id, c.name, c.compare, p.state
            from citadel_friend f
            join citadel_friend_card c on c.code = case when f.a = p_code then f.b else f.a end
            join citadel_progress p on p.code = c.code
           where (f.a = p_code or f.b = p_code) and f.accepted_at is not null) s;

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', c.name) order by f.created_at, f.id), '[]'::jsonb)
    into v_incoming
    from citadel_friend f join citadel_friend_card c on c.code = f.a
   where f.b = p_code and f.accepted_at is null;

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', c.name) order by f.created_at, f.id), '[]'::jsonb)
    into v_outgoing
    from citadel_friend f join citadel_friend_card c on c.code = f.b
   where f.a = p_code and f.accepted_at is null;

  return jsonb_build_object('ok', true,
                            'me', jsonb_build_object('code', v_card.fcode, 'name', v_card.name,
                                                     'compare', v_card.compare),
                            'friends', v_friends, 'incoming', v_incoming, 'outgoing', v_outgoing);
end;
$$;

-- ---------------------------------------------------------------------
--  Включить друзей или сменить имя. Код выдаётся один раз и остаётся прежним,
--  пока его не сменят отдельно.
-- ---------------------------------------------------------------------
create or replace function impl_friend_setup(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := fr_clean_name(p_name);
  v_card citadel_friend_card%rowtype;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  insert into citadel_friend_card (code, fcode, name) values (p_code, make_friend_code(), v_name)
  on conflict (code) do update set name = excluded.name
  returning * into v_card;
  return jsonb_build_object('ok', true, 'code', v_card.fcode, 'name', v_card.name, 'compare', v_card.compare);
end;
$$;

-- Новый код. Старый перестаёт работать сразу; друзья и запросы остаются.
create or replace function impl_friend_new_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_fcode text;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  update citadel_friend_card set fcode = make_friend_code() where code = p_code returning fcode into v_fcode;
  if v_fcode is null then
    return jsonb_build_object('ok', false, 'error', 'no_card');
  end if;
  return jsonb_build_object('ok', true, 'code', v_fcode);
end;
$$;

-- ---------------------------------------------------------------------
--  Позвать по коду.
--    {ok:true, status:'sent'|'friends'|'already_sent'|'already_friends', name}
--    'friends' — тот уже звал меня, и теперь мы друзья
--    ошибки: bad_code (с паузой), too_many (идёт пауза), self, no_card,
--            too_many_friends, too_many_requests, target_full, not_for_tutor
-- ---------------------------------------------------------------------
create or replace function impl_friend_add(p_code text, p_fcode text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key    text := 'friend:' || coalesce(p_code, '');
  v_wait   int;
  v_target citadel_friend_card%rowtype;
  v_row    citadel_friend%rowtype;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  if not exists (select 1 from citadel_friend_card where code = p_code) then
    return jsonb_build_object('ok', false, 'error', 'no_card');
  end if;
  -- Попытки одного ученика — строго по очереди: иначе сотня одновременных
  -- запросов проскочила бы проверку паузы разом.
  perform pg_advisory_xact_lock(hashtext(v_key));
  v_wait := throttle_wait(v_key);
  if v_wait is not null then
    return jsonb_build_object('ok', false, 'error', 'too_many', 'wait', v_wait);
  end if;
  select * into v_target from citadel_friend_card where fcode = fr_norm_code(p_fcode);
  -- Карточка не ученика (репетитор её завести не может, но проверяем всё равно)
  -- отвечает так же, как несуществующий код.
  if not found or not fr_student(v_target.code) then
    return jsonb_build_object('ok', false, 'error', 'bad_code', 'wait', throttle_fail(v_key));
  end if;
  if v_target.code = p_code then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;

  perform fr_sweep(p_code);
  perform fr_sweep(v_target.code);
  -- Пару держим до конца: два встречных запроса разом должны стать одной дружбой.
  perform pg_advisory_xact_lock(hashtext('friend-pair:' || least(p_code, v_target.code)
                                         || '|' || greatest(p_code, v_target.code)));
  select * into v_row from citadel_friend
   where least(a, b) = least(p_code, v_target.code) and greatest(a, b) = greatest(p_code, v_target.code);
  if found then
    if v_row.accepted_at is not null then
      return jsonb_build_object('ok', true, 'status', 'already_friends', 'name', v_target.name);
    end if;
    if v_row.a = p_code then
      return jsonb_build_object('ok', true, 'status', 'already_sent', 'name', v_target.name);
    end if;
    -- Он уже звал меня — значит, оба хотят: дружба сразу.
    if fr_friend_count(p_code) >= 50 then
      return jsonb_build_object('ok', false, 'error', 'too_many_friends');
    end if;
    if fr_friend_count(v_target.code) >= 50 then
      return jsonb_build_object('ok', false, 'error', 'target_full');
    end if;
    update citadel_friend set accepted_at = now() where id = v_row.id;
    return jsonb_build_object('ok', true, 'status', 'friends', 'name', v_target.name);
  end if;

  if fr_friend_count(p_code) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'too_many_friends');
  end if;
  if (select count(*) from citadel_friend where a = p_code and accepted_at is null) >= 20 then
    return jsonb_build_object('ok', false, 'error', 'too_many_requests');
  end if;
  if fr_friend_count(v_target.code) >= 50
     or (select count(*) from citadel_friend where b = v_target.code and accepted_at is null) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'target_full');
  end if;
  insert into citadel_friend (a, b) values (p_code, v_target.code);
  return jsonb_build_object('ok', true, 'status', 'sent', 'name', v_target.name);
end;
$$;

-- Принять запрос. Принять можно только тот, что пришёл мне.
create or replace function impl_friend_accept(p_code text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row citadel_friend%rowtype;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  perform fr_sweep(p_code);
  select * into v_row from citadel_friend
   where id = p_id and b = p_code and accepted_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if fr_friend_count(p_code) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'too_many_friends');
  end if;
  if fr_friend_count(v_row.a) >= 50 then
    return jsonb_build_object('ok', false, 'error', 'target_full');
  end if;
  update citadel_friend set accepted_at = now() where id = v_row.id;
  return jsonb_build_object('ok', true, 'name', fr_name(v_row.a));
end;
$$;

-- Убрать строку пары: удалить друга, отклонить запрос мне или отозвать свой.
-- Второй об этом не узнаёт — строка просто пропадает у обоих.
create or replace function impl_friend_remove(p_code text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_n int;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  with gone as (
    delete from citadel_friend where id = p_id and (a = p_code or b = p_code) returning 1
  )
  select count(*) into v_n from gone;
  return jsonb_build_object('ok', true, 'removed', v_n);
end;
$$;

-- Участвовать в сравнении или нет.
create or replace function impl_friend_compare(p_code text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_on boolean;
begin
  if not fr_student(p_code) then
    return jsonb_build_object('ok', false, 'error', 'not_for_tutor');
  end if;
  update citadel_friend_card set compare = coalesce(p_on, false) where code = p_code returning compare into v_on;
  if v_on is null then
    return jsonb_build_object('ok', false, 'error', 'no_card');
  end if;
  return jsonb_build_object('ok', true, 'compare', v_on);
end;
$$;

-- ---------------------------------------------------------------------
--  Репетитору — имена друзей его ученика. Только имена и только своего.
-- ---------------------------------------------------------------------
create or replace function impl_student_friends(p_tutor_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_type  text;
  v_names jsonb;
begin
  select coalesce(owner_code, state->>'ownerCode'), account_type into v_owner, v_type
    from citadel_progress where code = p_student_code;
  if v_owner is distinct from p_tutor_code or v_type is distinct from 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_your_student');
  end if;
  select coalesce(jsonb_agg(c.name order by lower(c.name)), '[]'::jsonb) into v_names
    from citadel_friend f
    join citadel_friend_card c on c.code = case when f.a = p_student_code then f.b else f.a end
   where (f.a = p_student_code or f.b = p_student_code) and f.accepted_at is not null;
  return jsonb_build_object('ok', true, 'names', v_names);
end;
$$;

-- ---------------------------------------------------------------------
--  Входы по токену
-- ---------------------------------------------------------------------
create or replace function session_friends(p_token text, p_today text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friends(v_code, p_today);
end; $$;

create or replace function session_friend_setup(p_token text, p_name text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friend_setup(v_code, p_name);
end; $$;

create or replace function session_friend_new_code(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friend_new_code(v_code);
end; $$;

create or replace function session_friend_add(p_token text, p_fcode text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friend_add(v_code, p_fcode);
end; $$;

create or replace function session_friend_accept(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friend_accept(v_code, p_id);
end; $$;

create or replace function session_friend_remove(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friend_remove(v_code, p_id);
end; $$;

create or replace function session_friend_compare(p_token text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_friend_compare(v_code, p_on);
end; $$;

create or replace function session_student_friends(p_token text, p_student_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  return impl_student_friends(v_code, p_student_code);
end; $$;

-- ---------------------------------------------------------------------
--  Права. Наружу — только session_*. Отзываем у самих ролей, а не у public:
--  Supabase выдаёт каждой новой функции права напрямую anon и authenticated
--  (подробно — в шапке lock-internals.sql).
-- ---------------------------------------------------------------------
revoke execute on function make_friend_code()                        from anon, authenticated, public;
revoke execute on function fr_norm_code(text)                        from anon, authenticated, public;
revoke execute on function fr_clean_name(text)                       from anon, authenticated, public;
revoke execute on function fr_num(jsonb)                             from anon, authenticated, public;
revoke execute on function fr_day(text)                              from anon, authenticated, public;
revoke execute on function fr_today(text)                            from anon, authenticated, public;
revoke execute on function fr_active(jsonb)                          from anon, authenticated, public;
revoke execute on function fr_streak(jsonb, date)                    from anon, authenticated, public;
revoke execute on function fr_week(jsonb, date)                      from anon, authenticated, public;
revoke execute on function fr_ladders(jsonb)                         from anon, authenticated, public;
revoke execute on function fr_collected(jsonb)                       from anon, authenticated, public;
revoke execute on function fr_student(text)                          from anon, authenticated, public;
revoke execute on function fr_sweep(text)                            from anon, authenticated, public;
revoke execute on function fr_friend_count(text)                     from anon, authenticated, public;
revoke execute on function fr_name(text)                             from anon, authenticated, public;
revoke execute on function impl_friends(text, text)                  from anon, authenticated, public;
revoke execute on function impl_friend_setup(text, text)             from anon, authenticated, public;
revoke execute on function impl_friend_new_code(text)                from anon, authenticated, public;
revoke execute on function impl_friend_add(text, text)               from anon, authenticated, public;
revoke execute on function impl_friend_accept(text, bigint)          from anon, authenticated, public;
revoke execute on function impl_friend_remove(text, bigint)          from anon, authenticated, public;
revoke execute on function impl_friend_compare(text, boolean)        from anon, authenticated, public;
revoke execute on function impl_student_friends(text, text)          from anon, authenticated, public;
grant execute on function session_friends(text, text)                to anon;
grant execute on function session_friend_setup(text, text)           to anon;
grant execute on function session_friend_new_code(text)              to anon;
grant execute on function session_friend_add(text, text)             to anon;
grant execute on function session_friend_accept(text, bigint)        to anon;
grant execute on function session_friend_remove(text, bigint)        to anon;
grant execute on function session_friend_compare(text, boolean)      to anon;
grant execute on function session_student_friends(text, text)        to anon;

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
       case when not has_table_privilege('anon', 'citadel_friend', 'select')
             and not has_table_privilege('anon', 'citadel_friend', 'insert')
             and not has_table_privilege('anon', 'citadel_friend_card', 'select')
             and not has_table_privilege('anon', 'citadel_friend_card', 'update')
             and not has_sequence_privilege('anon', 'citadel_friend_id_seq', 'usage')
            then 'ДА — дружбы снаружи не читаются и не пишутся'
            else 'НЕТ — таблицы дружб открыты наружу' end
order by 1;
