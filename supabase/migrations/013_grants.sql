-- =============================================================
-- 013_grants.sql — Restaurar grants estándar de Supabase
--
-- Cuando se hace `drop schema public cascade` para limpiar la DB,
-- se pierden los GRANTs que Supabase otorga por default a los roles
-- anon, authenticated y service_role.
--
-- Esta migración los restaura. Sin estos grants:
-- - El service_role no puede insertar (falla el signup)
-- - Los usuarios autenticados no pueden leer sus propios protocolos
-- - Las funciones SECURITY DEFINER no pueden ejecutarse
-- =============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Asegurar que objetos creados a futuro hereden los grants
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
