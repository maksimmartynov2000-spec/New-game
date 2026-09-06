-- =====================================================================
--  ПЕРВЫЙ АККАУНТ РЕПЕТИТОРА
-- ---------------------------------------------------------------------
--  ОДНОРАЗОВЫЙ файл. Нужен ровно один раз — когда база поднимается с нуля
--  и в ней ещё нет ни одного аккаунта. На работающей базе запускать его
--  незачем, и в порядок восстановления из schema.sql он входит отдельной
--  строкой именно поэтому.
--
--  Раньше этот кусок лежал внутри migration.sql, а тот значился файлом,
--  который можно запускать повторно. Вместе с ним повторно запускалось и
--  безусловное удаление аккаунтов по списку старых тестовых кодов — то есть
--  в «безопасном для повтора» файле сидело удаление чужих данных.
--
--  ПЕРЕД ЗАПУСКОМ подставь свои значения вместо ЛОГИН и ПАРОЛЬ.
--  Пароль — не короче восьми символов (см. password-length.sql).
--
--  Повторный запуск безопасен: on conflict do nothing не тронет существующий
--  аккаунт и НЕ поменяет пароль. Если пароль забыт, меняй его отдельно:
--    update citadel_progress
--       set password_hash = crypt('НОВЫЙ_ПАРОЛЬ', gen_salt('bf'))
--     where code = 'ТВОЙ_ЛОГИН';
-- =====================================================================

insert into citadel_progress (code, password_hash, owner_code, account_type, state, updated_at)
values (
  'ЛОГИН',
  crypt('ПАРОЛЬ', gen_salt('bf')),
  null,       -- у репетитора владельца нет
  'self',
  jsonb_build_object(
    'schema', 2, 'playerCode', 'ЛОГИН', 'updatedAt', 0,
    'profileLabel', '', 'accountType', 'self', 'ownerCode', null,
    'config', null,
    'puzzle', jsonb_build_object('idx', null, 'filled', 0),
    'collections', jsonb_build_object('paradoxes', '[]'::jsonb),
    'totals', jsonb_build_object('correct', 0, 'wrong', 0, 'puzzlesCompleted', 0),
    'byTopic', '{}'::jsonb, 'unlocks', '[]'::jsonb
  ),
  now()
)
on conflict (code) do nothing;
