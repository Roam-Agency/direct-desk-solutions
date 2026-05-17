-- 0004_upload_tokens_grants.sql
-- Grant service_role full access to public.upload_tokens.
--
-- 0003 created the table and explicitly revoked anon + authenticated, but the
-- Supabase project has "Auto-expose new tables" disabled, so the table also
-- had no grants for service_role. Our admin Supabase client (which identifies
-- as service_role via the SUPABASE_SECRET_KEY) was therefore hitting
-- "42501 permission denied" on every query and resolveUploadToken was always
-- returning not_found.
--
-- service_role is the trusted server-side identity and bypasses RLS by
-- design. We grant SELECT/INSERT/UPDATE/DELETE so the createUploadToken,
-- resolveUploadToken, consumeUploadToken actions can all do their jobs.
grant select, insert, update, delete on public.upload_tokens to service_role;


-- Grant service_role full access to products and product_images.
--
-- Same root cause: the project has "Auto-expose new tables" disabled, so
-- service_role had no grants on these either. resolveUploadToken's product
-- lookup and mobileAttachImage's product_images insert both failed silently
-- with 42501, surfacing to the mobile UI as a generic "not found" — not
-- helpful for diagnosis when the actual upload_tokens row WAS being read
-- successfully.
--
-- Granting all four CRUD verbs because the service-role identity is the
-- trusted server-side caller — it owns the migration story and any RLS
-- restriction we want for it would belong in policies, not in the absence
-- of grants.
grant select, insert, update, delete on public.products to service_role;
grant select, insert, update, delete on public.product_images to service_role;
