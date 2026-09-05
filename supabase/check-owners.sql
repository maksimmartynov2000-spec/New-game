-- Кто сейчас числится чьим учеником. Запусти это ПЕРЕД миграцией owner-columns.sql.
--
-- Зачем: миграция переносит владельца из состояния в колонку — то есть закрепляет
-- то, что записано СЕЙЧАС. Если какой-то ученик уже отвязался (сам или из-за ошибки),
-- миграция закрепит именно отвязанное состояние: угадать правильного владельца она
-- не может. Поэтому сначала смотрим, всё ли на месте.
--
-- Ожидаемое: одна строка на тебя (accountType self, владелец пусто) и по строке
-- на каждого ученика с твоим кодом в графе «владелец».

select code                                   as "логин",
       coalesce(state->>'profileLabel', '')   as "имя",
       coalesce(state->>'accountType', '?')   as "тип",
       coalesce(state->>'ownerCode', '—')     as "владелец",
       updated_at                             as "последняя запись"
  from citadel_progress
 order by coalesce(state->>'ownerCode', ''), code;

-- Если ученик потерял владельца, вернуть его можно так (подставь логины):
--   update citadel_progress
--      set state = jsonb_set(jsonb_set(state, '{ownerCode}', to_jsonb('ТВОЙ_ЛОГИН'::text), true),
--                            '{accountType}', to_jsonb('linked'::text), true)
--    where code = 'ЛОГИН_УЧЕНИКА';
-- И только после этого запускать owner-columns.sql.
