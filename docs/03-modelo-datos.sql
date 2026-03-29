-- BDPolitica - Esquema base MVP
-- PostgreSQL 15+
-- Nota: IDs UUID v7 deben ser generados por la aplicacion.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

-- ======================================
-- Catalogos base
-- ======================================

CREATE TABLE campaign_types (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_catalog (
  id uuid PRIMARY KEY,
  tenant_id uuid NULL,
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE permission_catalog (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  id uuid PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES role_catalog(id),
  permission_id uuid NOT NULL REFERENCES permission_catalog(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE support_status_catalog (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listado_state_catalog (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listado_reason_catalog (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  applies_to text NOT NULL, -- CERRADO / ANULADO / AMBOS
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ======================================
-- Tenant (campana)
-- ======================================

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  campaign_type_id uuid NOT NULL REFERENCES campaign_types(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NULL,
  starts_on date NULL,
  ends_on date NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_settings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id),
  timezone text NOT NULL DEFAULT 'America/Bogota',
  locale text NOT NULL DEFAULT 'es-CO',
  qr_validation_secret text NOT NULL,
  allow_partial_returns boolean NOT NULL DEFAULT true,
  require_mfa_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ======================================
-- Territorio
-- ======================================

CREATE TABLE territories (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  type text NOT NULL, -- DEPARTAMENTO/MUNICIPIO/CORREGIMIENTO/LOCALIDAD/COMUNA/BARRIO/PUESTO/MESA
  code text NULL,
  name text NOT NULL,
  parent_id uuid NULL REFERENCES territories(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type, code),
  UNIQUE (tenant_id, type, parent_id, name)
);

CREATE INDEX idx_territories_tenant_parent ON territories (tenant_id, parent_id);
CREATE INDEX idx_territories_tenant_type ON territories (tenant_id, type);

-- ======================================
-- Usuarios y seguridad
-- ======================================

CREATE TABLE users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  username text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_secret_enc text NULL,
  failed_login_attempts int NOT NULL DEFAULT 0,
  blocked_until timestamptz NULL,
  last_login_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  UNIQUE (tenant_id, username),
  UNIQUE (tenant_id, email)
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL REFERENCES role_catalog(id),
  territory_id uuid NULL REFERENCES territories(id),
  person_role_scope_id uuid NULL, -- FK diferida por orden de creacion
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role_id, territory_id, valid_from)
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  replaced_by_token_id uuid NULL REFERENCES refresh_tokens(id),
  ip_address inet NULL,
  user_agent text NULL
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (tenant_id, user_id, revoked_at, expires_at);

-- ======================================
-- Personas y roles de persona
-- ======================================

CREATE TABLE persons (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  full_name text NOT NULL,
  phone text NULL,
  address text NULL,
  birth_date date NULL,
  primary_territory_id uuid NULL REFERENCES territories(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX idx_persons_tenant_name ON persons (tenant_id, full_name);

CREATE TABLE person_identifications (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  id_type text NOT NULL DEFAULT 'CC',
  id_number text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id_type, id_number)
);

CREATE TABLE person_consents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  consent_type text NOT NULL, -- DATOS_PERSONALES / CONTACTO / AFINIDAD_POLITICA
  granted boolean NOT NULL,
  granted_at timestamptz NOT NULL,
  channel text NOT NULL, -- VERBAL / ESCRITO / DIGITAL
  evidence_file_id uuid NULL,
  notes text NULL,
  created_by_user_id uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE person_roles (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  role_type text NOT NULL, -- COORDINADOR / LIDER / VOTANTE
  territory_id uuid NULL REFERENCES territories(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, person_id, role_type, valid_from)
);

CREATE INDEX idx_person_roles_tenant_role ON person_roles (tenant_id, role_type, is_active);

CREATE TABLE hierarchy_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  parent_person_role_id uuid NOT NULL REFERENCES person_roles(id),
  child_person_role_id uuid NOT NULL REFERENCES person_roles(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL,
  reason text NULL,
  created_by_user_id uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_person_role_id <> child_person_role_id)
);

CREATE INDEX idx_hierarchy_parent ON hierarchy_assignments (tenant_id, parent_person_role_id, valid_to);
CREATE INDEX idx_hierarchy_child ON hierarchy_assignments (tenant_id, child_person_role_id, valid_to);

CREATE TABLE person_support_status_history (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  support_status_id uuid NOT NULL REFERENCES support_status_catalog(id),
  changed_by_user_id uuid NULL REFERENCES users(id),
  notes text NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_history_person ON person_support_status_history (tenant_id, person_id, changed_at DESC);

-- Completa FK diferida en user_roles
ALTER TABLE user_roles
  ADD CONSTRAINT fk_user_roles_person_scope
  FOREIGN KEY (person_role_scope_id) REFERENCES person_roles(id);

-- ======================================
-- Listados y cadena de custodia
-- ======================================

CREATE TABLE listados (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  internal_code text NOT NULL,
  title text NOT NULL,
  coordinator_person_role_id uuid NULL REFERENCES person_roles(id),
  leader_person_role_id uuid NOT NULL REFERENCES person_roles(id),
  territory_id uuid NULL REFERENCES territories(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  current_state_id uuid NOT NULL REFERENCES listado_state_catalog(id),
  current_version_no int NOT NULL DEFAULT 1,
  total_items int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL,
  deleted_at timestamptz NULL,
  UNIQUE (tenant_id, internal_code)
);

CREATE INDEX idx_listados_tenant_state ON listados (tenant_id, current_state_id);
CREATE INDEX idx_listados_tenant_leader ON listados (tenant_id, leader_person_role_id);

CREATE TABLE listado_versions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  listado_id uuid NOT NULL REFERENCES listados(id),
  version_no int NOT NULL,
  generated_by_user_id uuid NOT NULL REFERENCES users(id),
  generation_reason text NULL,
  item_count int NOT NULL DEFAULT 0,
  snapshot_hash text NULL,
  qr_payload_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, listado_id, version_no),
  UNIQUE (tenant_id, qr_payload_code)
);

CREATE TABLE listado_version_items_snapshot (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  listado_version_id uuid NOT NULL REFERENCES listado_versions(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  row_no int NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, listado_version_id, row_no)
);

CREATE INDEX idx_listado_snapshot_person ON listado_version_items_snapshot (tenant_id, person_id);

CREATE TABLE listado_state_history (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  listado_id uuid NOT NULL REFERENCES listados(id),
  from_state_id uuid NULL REFERENCES listado_state_catalog(id),
  to_state_id uuid NOT NULL REFERENCES listado_state_catalog(id),
  reason_id uuid NULL REFERENCES listado_reason_catalog(id),
  reason_note text NULL,
  changed_by_user_id uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listado_state_history ON listado_state_history (tenant_id, listado_id, changed_at DESC);

CREATE TABLE listado_movements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  listado_id uuid NOT NULL REFERENCES listados(id),
  listado_version_id uuid NOT NULL REFERENCES listado_versions(id),
  movement_type text NOT NULL, -- ENTREGA / RECEPCION / DEVOLUCION_PARCIAL / DEVOLUCION_TOTAL
  from_user_id uuid NULL REFERENCES users(id),
  to_user_id uuid NULL REFERENCES users(id),
  to_third_party_name text NULL,
  to_third_party_id_type text NULL,
  to_third_party_id_number text NULL,
  to_third_party_phone text NULL,
  observation text NULL,
  moved_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listado_movements ON listado_movements (tenant_id, listado_id, moved_at DESC);

CREATE TABLE files (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  object_key text NOT NULL,
  bucket_name text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum_sha256 text NULL,
  uploaded_by_user_id uuid NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, object_key)
);

CREATE TABLE listado_evidences (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  listado_movement_id uuid NOT NULL REFERENCES listado_movements(id),
  evidence_type text NOT NULL, -- FOTO / FIRMA / ARCHIVO
  file_id uuid NOT NULL REFERENCES files(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listado_evidences_movement ON listado_evidences (tenant_id, listado_movement_id);

-- ======================================
-- Importaciones masivas
-- ======================================

CREATE TABLE import_jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_type text NOT NULL, -- PERSONAS / TERRITORIOS / PUESTO_MESA / LISTADOS
  source_file_id uuid NOT NULL REFERENCES files(id),
  status text NOT NULL, -- SUBIDO / VALIDADO / PROCESANDO / COMPLETADO / FALLIDO / CANCELADO
  total_rows int NOT NULL DEFAULT 0,
  processed_rows int NOT NULL DEFAULT 0,
  success_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  requested_by_user_id uuid NOT NULL REFERENCES users(id),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  summary jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_tenant_status ON import_jobs (tenant_id, status, created_at DESC);

CREATE TABLE import_job_rows (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  import_job_id uuid NOT NULL REFERENCES import_jobs(id),
  row_no int NOT NULL,
  row_data jsonb NOT NULL,
  validation_errors jsonb NULL,
  process_status text NOT NULL, -- PENDIENTE / OK / ERROR
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, import_job_id, row_no)
);

-- ======================================
-- Auditoria central
-- ======================================

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  actor_user_id uuid NULL REFERENCES users(id),
  actor_type text NOT NULL DEFAULT 'USER', -- USER / SYSTEM
  event_category text NOT NULL, -- AUTH / RBAC / CRUD / IMPORT / EXPORT / LISTADO / SECURITY
  event_name text NOT NULL,
  target_table text NULL,
  target_id uuid NULL,
  request_id text NULL,
  ip_address inet NULL,
  user_agent text NULL,
  payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_tenant_time ON audit_events (tenant_id, created_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events (tenant_id, actor_user_id, created_at DESC);
CREATE INDEX idx_audit_events_category ON audit_events (tenant_id, event_category, created_at DESC);

-- ======================================
-- Row Level Security (RLS)
-- ======================================

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_identifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hierarchy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_support_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE listados ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_version_items_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_territories ON territories
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_user_roles ON user_roles
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_persons ON persons
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_person_identifications ON person_identifications
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_person_consents ON person_consents
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_person_roles ON person_roles
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_hierarchy_assignments ON hierarchy_assignments
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_person_support_status_history ON person_support_status_history
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_listados ON listados
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_listado_versions ON listado_versions
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_listado_version_items_snapshot ON listado_version_items_snapshot
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_listado_state_history ON listado_state_history
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_listado_movements ON listado_movements
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_files ON files
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_listado_evidences ON listado_evidences
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_import_jobs ON import_jobs
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_import_job_rows ON import_job_rows
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_audit_events ON audit_events
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE POLICY tenant_isolation_tenant_settings ON tenant_settings
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMIT;
