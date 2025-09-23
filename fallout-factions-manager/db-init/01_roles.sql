-- 01_roles.sql
-- Tworzy role i nadaje minimalne uprawnienia

-- Rola „aplikacyjna” tylko do jednej bazy/schematu
CREATE ROLE app_user LOGIN PASSWORD 'app_password_strong' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Rola „czytająca” (np. do odczytu przez BI/readonly)
CREATE ROLE readonly_user LOGIN PASSWORD 'readonly_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Upewnij się, że schema public istnieje (domyślnie jest)
GRANT CONNECT ON DATABASE fallout TO app_user, readonly_user;

-- Daj kontrolę nad schematem app_user (po migracjach Prisma przerzucimy GRANTy)
GRANT USAGE ON SCHEMA public TO app_user, readonly_user;

-- domyślne uprawnienia do przyszłych tabel (po migracjach)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
