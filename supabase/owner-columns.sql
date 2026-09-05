-- =====================================================================
--  ВЛАДЕЛЕЦ УЧЕНИКА — В КОЛОНКУ, А НЕ В БЛОБ
-- ---------------------------------------------------------------------
--  Что чинится.
--
--  Право репетитора видеть данные ученика проверялось по полю ownerCode
--  ВНУТРИ состояния — а состояние приходит от клиента и записывается как
--  есть (session_save / save_state). То есть ученик со своего устройства
--  мог одним вызовом переписать ownerCode и исчезнуть из списка репетитора
--  вместе со статистикой, сбросом пароля и выдачей доступов. Заодно —
--  поставить себе accountType 'self' и стать в глазах сервера репетитором.
--
--  Проверено на живой базе до этой миграции: после одного session_save
--  учеников у репетитора стало 0, impl_student_state вернула
--  not_your_student, сброс пароля — тоже.
--
--  Дело не только в злом умысле: ровно то же сделает любая будущая ошибка
--  в клиенте, которая запишет состояние без ownerCode. Ученик отвяжется
--  молча, и заметить это можно будет очень нескоро.
--
--  Как чинится.
--
--  Владелец и тип аккаунта переезжают в колонки таблицы, куда клиент
--  дописаться не может. Все проверки прав по-прежнему читают state->>'ownerCode'
--  и остаются нетронутыми — их два десятка, и переписывать их все значило бы
--  переиздать половину схемы. Вместо этого закрываются четыре места записи:
--  теперь при сохранении состояния оба поля ПРИНУДИТЕЛЬНО заменяются на
--  значения из колонок. Разойтись блоб и колонка больше не могут.
--
--  Запускать можно на работающем приложении и сколько угодно раз подряд.
--  Клиенту эта миграция не нужна: он и до, и после работает без изменений.
-- =====================================================================

-- 1. Колонки. Пока их не заполнили, ничего не меняется.
alter table citadel_progress add column if not exists owner_code   text;
alter table citadel_progress add column if not exists account_type text;

-- 2. Переносим то, что есть сейчас, из состояния. Уже заполненное не трогаем,
--    поэтому повторный запуск безопасен.
update citadel_progress
   set owner_code = state->>'ownerCode'
 where owner_code is null;

update citadel_progress
   set account_type = case when state->>'accountType' = 'linked' then 'linked' else 'self' end
 where account_type is null;

-- Список учеников ходит по владельцу — пусть ходит по индексу.
create index if not exists citadel_progress_owner_idx on citadel_progress (owner_code);

-- 3. Замок. Возвращает состояние, в котором владелец и тип аккаунта заменены
--    на те, что лежат в колонках. Что бы клиент ни прислал — запишется это.
create or replace function pin_identity(p_code text, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner text;
  v_type  text;
  v_state jsonb := coalesce(p_state, '{}'::jsonb);
  v_found boolean := false;
begin
  select owner_code, account_type, true into v_owner, v_type, v_found
    from citadel_progress where code = p_code;
  -- Строки нет — возвращаем как есть. Записывать всё равно некуда: обе
  -- функции ниже обновляют по этому же коду.
  if not v_found then return v_state; end if;

  v_state := jsonb_set(v_state, '{accountType}',
                       to_jsonb(coalesce(v_type, 'self')), true);
  v_state := jsonb_set(v_state, '{ownerCode}',
                       case when v_owner is null then 'null'::jsonb else to_jsonb(v_owner) end,
                       true);
  return v_state;
end;
$$;

-- Наружу не отдаём: это внутренность, звать её должны только функции ниже.
revoke execute on function pin_identity(text, jsonb) from public;

-- 4. Сохранение состояния по токену — основной путь.
create or replace function session_save(p_token text, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := session_owner(p_token);
begin
  if v_code is null then return jsonb_build_object('ok', false, 'error', 'bad_session'); end if;
  update citadel_progress
     set state = pin_identity(v_code, p_state), updated_at = now()
   where code = v_code;
  return jsonb_build_object('ok', true);
end;
$$;

-- 5. Тот же замок на старом пути по паролю — иначе дыра просто переезжает в него.
create or replace function save_state(p_code text, p_password text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from citadel_progress where code = p_code;
  if v_hash is null or v_hash <> crypt(p_password, v_hash) then
    return false;
  end if;
  update citadel_progress
     set state = pin_identity(p_code, p_state), updated_at = now()
   where code = p_code;
  return true;
end;
$$;

-- 6. Заведение ученика: теперь заполняются и колонки. Без этого новый ученик
--    остался бы с пустым owner_code, и первое же сохранение отвязало бы его.
create or replace function impl_create_student(
  p_tutor_code text, p_student_code text, p_student_password text, p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tutor_type text;
begin
  select account_type into v_tutor_type from citadel_progress where code = p_tutor_code;
  -- Заводить учеников может только сам репетитор, не ученик другого репетитора.
  -- Тип берём из колонки: в состоянии его теперь может подделать кто угодно,
  -- а в колонке — нет.
  if v_tutor_type = 'linked' then
    return jsonb_build_object('ok', false, 'error', 'not_a_tutor');
  end if;
  if p_student_code is null or length(p_student_code) < 3 then
    return jsonb_build_object('ok', false, 'error', 'code_too_short');
  end if;
  if exists (select 1 from citadel_progress where code = p_student_code) then
    return jsonb_build_object('ok', false, 'error', 'code_taken');
  end if;
  if p_student_password is null or length(p_student_password) < 4 then
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

revoke execute on function impl_create_student(text, text, text, text) from public;

-- 7. Старая функция заведения ученика по паролю — та же правка, чтобы пути
--    не разошлись в том, что именно они создают.
create or replace function create_student(
  p_tutor_code text, p_tutor_password text,
  p_student_code text, p_student_password text, p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tutor_hash text;
begin
  select password_hash into v_tutor_hash from citadel_progress where code = p_tutor_code;
  if v_tutor_hash is null or v_tutor_hash <> crypt(p_tutor_password, v_tutor_hash) then
    return jsonb_build_object('ok', false, 'error', 'bad_credentials');
  end if;
  return impl_create_student(p_tutor_code, p_student_code, p_student_password, p_label);
end;
$$;
