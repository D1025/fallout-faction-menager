-- 01_roles.sql
-- Creates roles and grants minimal privileges

-- Application role for a single database/schema
CREATE ROLE app_user LOGIN PASSWORD 'app_password_strong' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Read-only role (e.g. BI/readonly access)
CREATE ROLE readonly_user LOGIN PASSWORD 'readonly_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Ensure the public schema is available (default setup)
GRANT CONNECT ON DATABASE fallout TO app_user, readonly_user;

-- Grant schema usage (Prisma migrations will handle table grants later)
GRANT USAGE ON SCHEMA public TO app_user, readonly_user;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
