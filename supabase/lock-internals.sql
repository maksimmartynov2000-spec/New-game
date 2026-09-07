-- =====================================================================
--  ЗАКРЫТЬ ВНУТРЕННИЕ ФУНКЦИИ ОТ АНОНИМНЫХ ЗАПРОСОВ
-- ---------------------------------------------------------------------
--  Наружу приложение должно видеть ровно один слой — функции session_*.
--  Всё остальное (impl_*, pin_identity, session_owner, exam_max_grant,
--  make_access_code и прочее) — внутренности: их зовут сами session_*,
--  и снаружи они видны быть не должны.
--
--  ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ. В drop-legacy.sql стояло «revoke execute ... from
--  public» — и на живой базе это не сработало. Supabase настраивает права по
--  умолчанию так:
--
--      alter default privileges in schema public
--        grant all on functions to anon, authenticated;
--
--  то есть каждая новая функция получает разрешение НЕ через public, а прямой
--  выдачей роли anon. Отзыв у public такую выдачу не трогает — она остаётся.
--  Проверка после чистки честно показала «impl_restore_student открыт наружу»
--  и список из 43 имён, где кроме session_* были все impl_*.
--
--  Мою локальную проверку это не поймало: там роль anon была, а вот прав по
--  умолчанию не было — то есть проверочная база отличалась от настоящей ровно
--  тем местом, которое и решало. Теперь отзываем у самих ролей.
--
--  Правило записано перебором, а не списком имён: список пришлось бы дополнять
--  при каждой новой внутренней функции, и однажды его забыли бы.
--
--  ЗАПУСКАТЬ МОЖНО СКОЛЬКО УГОДНО РАЗ.
-- =====================================================================

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.proname not like 'session\_%'
       -- Функции расширений (pgcrypto и подобные) не трогаем: их права
       -- расставляет само расширение, и лезть туда не наше дело.
       and not exists (
             select 1 from pg_depend d
              where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from anon, authenticated, public', r.sig);
    n := n + 1;
  end loop;
  raise notice 'Закрыто внутренних функций: %', n;
end $$;

-- ---------------------------------------------------------------------
--  ПРОВЕРКА. Первая строка — «ДА», вторая таблица — только session_*.
-- ---------------------------------------------------------------------
select case when count(*) = 0 then 'ДА — снаружи видны только session_*'
            else 'НЕТ — открыто лишнего: ' || count(*) end as "Внутренности закрыты?"
from pg_proc p
join pg_namespace ns on ns.oid = p.pronamespace
where ns.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not like 'session\_%'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

select p.proname as "Открыто для anon"
from pg_proc p
join pg_namespace ns on ns.oid = p.pronamespace
where ns.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
