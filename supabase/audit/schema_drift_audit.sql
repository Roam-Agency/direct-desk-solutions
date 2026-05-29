-- ============================================================================
-- SCHEMA DRIFT AUDIT  (read-only — safe to run against any environment)
--
-- Compares the live schema against what migrations 0001–0013 expect: tables,
-- RLS, enums, the product_available_stock view, and table grants per role.
-- Pure SELECTs against the catalog — nothing is modified.
--
-- Read the result:
--   * sections 1–4: any status MISSING / RLS OFF = that migration has not been
--     fully applied to this environment.
--   * section 5 (grants): compare the `value` column against what each role
--     needs. In particular the `authenticated` role (the admin UI) must have
--     SELECT/INSERT/UPDATE/DELETE on the tables its pages write. A table with
--     an RLS policy but no grant still fails with `permission denied`.
-- ============================================================================
with
expected_tables(t) as (values
  ('products'),('product_images'),('upload_tokens'),('categories'),
  ('product_categories'),('condition_reports'),('condition_report_items'),
  ('customers'),('orders'),('order_items'),('stock_reservations'),('app_settings')
),
expected_enums(e) as (values
  ('product_condition'),('product_grade'),('product_status'),
  ('condition_severity'),('category_kind'),('order_status'),('reservation_status')
)
select * from (
  -- 1. Tables exist
  select '1. table' as section, e.t as object, '' as role,
         coalesce(c.relkind::text,'-') as value,
         case when c.oid is not null then 'OK' else 'MISSING' end as status
  from expected_tables e
  left join pg_class c
    on c.relname = e.t and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'

  union all
  -- 2. RLS enabled on each table
  select '2. rls', e.t, '',
         case when c.oid is null then '-' when c.relrowsecurity then 'on' else 'off' end,
         case when c.oid is null then 'TABLE MISSING'
              when c.relrowsecurity then 'OK' else 'RLS OFF' end
  from expected_tables e
  left join pg_class c
    on c.relname = e.t and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'

  union all
  -- 3. Enums exist (value lists the labels)
  select '3. enum', e.e, '',
         coalesce((select string_agg(enumlabel, ',' order by enumsortorder)
                   from pg_enum where enumtypid = t.oid), '-'),
         case when t.oid is not null then 'OK' else 'MISSING' end
  from expected_enums e
  left join pg_type t on t.typname = e.e and t.typnamespace = 'public'::regnamespace

  union all
  -- 3b. order_status must include 'backorder' (migration 0009)
  select '3. enum', 'order_status::backorder', '', '',
         case when exists (
           select 1 from pg_enum en join pg_type ty on ty.oid = en.enumtypid
           where ty.typname = 'order_status' and en.enumlabel = 'backorder'
         ) then 'OK' else 'MISSING' end

  union all
  -- 4. product_available_stock view (migration 0010)
  select '4. view', 'product_available_stock', '', '',
         case when exists (
           select 1 from pg_class
           where relname = 'product_available_stock'
             and relnamespace = 'public'::regnamespace and relkind in ('v','m')
         ) then 'OK' else 'MISSING' end

  union all
  -- 5. Table grants per role (informational matrix — compare against migrations)
  select '5. grant', g.table_name, g.grantee,
         string_agg(g.privilege_type, ',' order by g.privilege_type), 'info'
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon','authenticated','service_role')
    and g.table_name in (
      'products','product_images','upload_tokens','categories','product_categories',
      'condition_reports','condition_report_items','customers','orders','order_items',
      'stock_reservations','app_settings','product_available_stock'
    )
  group by g.table_name, g.grantee
) x
order by section, object, role;
