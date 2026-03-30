-- Seed base MVP (catalogos + auth fase 2)
-- Idempotente: puede correrse multiples veces.

BEGIN;

INSERT INTO campaign_types (id, code, name)
VALUES
  ('0f5c3074-56e9-45de-b8fc-1032d4bb5c11', 'PRESIDENCIAL', 'Presidencial'),
  ('b0f8d3d2-8ef0-4ac2-b44f-884d84ff89ea', 'GOBERNACION', 'Gobernacion'),
  ('57ce9f37-c5e5-4a1d-8872-bbf6f4abdb0f', 'ALCALDIA', 'Alcaldia'),
  ('3f8a234e-e9eb-4aa4-877a-b554aafde028', 'ASAMBLEA', 'Asamblea'),
  ('86b2ff7f-b2ee-4564-9964-4f862afb7f0c', 'CONCEJO', 'Concejo'),
  ('c7a5729a-bf90-4900-9bc0-e6381326f012', 'JAL_EDIL', 'JAL / Edil')
ON CONFLICT (code) DO NOTHING;

INSERT INTO support_status_catalog (id, code, name)
VALUES
  ('7837f774-f7c0-4ec9-9b20-d2f53374cb83', 'NO_CONTACTADO', 'No contactado'),
  ('0f2b63fc-e6e1-44c0-8de1-3cf2f9d2d04a', 'POR_CONFIRMAR', 'Por confirmar'),
  ('ef4950bc-6eb6-4f6a-bcb4-91487b0e6d3c', 'APOYA', 'Apoya'),
  ('5c132ef8-882f-4503-9d74-3c0c6f95fa27', 'NO_APOYA', 'No apoya')
ON CONFLICT (code) DO NOTHING;

INSERT INTO listado_state_catalog (id, code, name, sort_order)
VALUES
  ('acef5c4d-0b0b-401a-a8b8-ab1f41fd343b', 'BORRADOR', 'Borrador', 1),
  ('8d7186ba-5f7b-4134-8403-cdf1f4af5f42', 'GENERADO', 'Generado', 2),
  ('df4b5e8f-b6ba-4200-b510-fc9fc8b47f0d', 'ASIGNADO', 'Asignado', 3),
  ('f6737cae-3d95-4776-b04d-840f0d9bd7fc', 'ENTREGADO', 'Entregado', 4),
  ('8fef90cb-d15f-40f7-ac52-1f3504f6609b', 'RECIBIDO', 'Recibido', 5),
  ('db1374e8-154d-44c9-a9f8-934ec3628e8b', 'CERRADO', 'Cerrado', 6),
  ('cc2983bf-65a3-4704-b89b-c1908f4863f8', 'ANULADO', 'Anulado', 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO listado_reason_catalog (id, code, name, applies_to)
VALUES
  ('33333714-2a9f-4e55-b4f1-3545a6ce580e', 'ERROR_GENERACION', 'Error de generacion', 'ANULADO'),
  ('f99d0ed9-b6d1-4c2a-8f7c-9581c246e8ff', 'DUPLICADO', 'Duplicado', 'ANULADO'),
  ('f8a15f60-2e58-4fc1-ab74-f4f3769f4f84', 'CAMBIO_RESPONSABLE', 'Cambio de responsable', 'AMBOS'),
  ('f24f61df-47a1-4474-8f9a-d5524aa0468e', 'DATOS_INVALIDOS', 'Datos invalidos', 'AMBOS'),
  ('3f3a8769-3014-4f4d-b29b-87900f2bdce5', 'GESTION_COMPLETA', 'Gestion completa', 'CERRADO')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permission_catalog (id, code, module, action, description)
VALUES
  ('ea14f2c8-e130-4b9c-a7eb-35c0f88cdb35', 'usuarios.manage', 'usuarios', 'manage', 'Gestion de usuarios'),
  ('4cb0c3b7-2f95-4ff6-a8fd-9bf9a2da009e', 'personas.read', 'personas', 'read', 'Ver personas'),
  ('ed6a3c48-b73f-4199-90aa-d6518d7f26c0', 'personas.write', 'personas', 'write', 'Crear/editar personas'),
  ('1bc90f89-fe0f-4c5a-9f53-869f8db6df90', 'listados.read', 'listados', 'read', 'Ver listados'),
  ('0577d2ef-827b-43ef-acac-39f6dbc25590', 'listados.create', 'listados', 'create', 'Crear listados'),
  ('fe1770bc-5774-41f4-bb42-71529b0fe53f', 'listados.assign', 'listados', 'assign', 'Asignar listados'),
  ('71dd5600-8919-43be-b6bc-869ef4dbfcee', 'importaciones.run', 'importaciones', 'run', 'Ejecutar importaciones'),
  ('66bf5564-acf6-4788-a3f2-6de9733db8ef', 'auditoria.read', 'auditoria', 'read', 'Ver auditoria')
ON CONFLICT (code) DO NOTHING;

-- Evita duplicados de roles globales (tenant_id NULL) por comportamiento de UNIQUE con NULL
INSERT INTO role_catalog (id, tenant_id, code, name, is_system)
SELECT 'f1586f7d-6c88-4920-821a-74f8f0a44bf4', NULL, 'ADMIN', 'Administrador', true
WHERE NOT EXISTS (
  SELECT 1 FROM role_catalog WHERE tenant_id IS NULL AND code = 'ADMIN'
);

INSERT INTO role_catalog (id, tenant_id, code, name, is_system)
SELECT 'f266d9c3-a6f9-4986-b1af-700bd6b9c6ef', NULL, 'DIGITADOR', 'Digitador', true
WHERE NOT EXISTS (
  SELECT 1 FROM role_catalog WHERE tenant_id IS NULL AND code = 'DIGITADOR'
);

INSERT INTO role_catalog (id, tenant_id, code, name, is_system)
SELECT '8d390f84-f6cc-41fb-84f8-5b38f969657f', NULL, 'COORDINADOR', 'Coordinador', true
WHERE NOT EXISTS (
  SELECT 1 FROM role_catalog WHERE tenant_id IS NULL AND code = 'COORDINADOR'
);

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), role_admin.id, permission.id
FROM role_catalog role_admin
CROSS JOIN permission_catalog permission
WHERE role_admin.code = 'ADMIN' AND role_admin.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), role_coord.id, permission.id
FROM role_catalog role_coord
JOIN permission_catalog permission
  ON permission.code IN ('personas.read', 'listados.read', 'listados.create', 'listados.assign')
WHERE role_coord.code = 'COORDINADOR' AND role_coord.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), role_digit.id, permission.id
FROM role_catalog role_digit
JOIN permission_catalog permission
  ON permission.code IN ('personas.read', 'listados.read')
WHERE role_digit.code = 'DIGITADOR' AND role_digit.tenant_id IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO tenants (id, campaign_type_id, code, name, description, is_active)
VALUES
  (
    '11111111-1111-7111-8111-111111111111',
    '57ce9f37-c5e5-4a1d-8872-bbf6f4abdb0f',
    'campana-demo-alcaldia',
    'Campana Demo Alcaldia',
    'Tenant de prueba para smoke tests',
    true
  ),
  (
    '22222222-2222-7222-8222-222222222222',
    'b0f8d3d2-8ef0-4ac2-b44f-884d84ff89ea',
    'campana-demo-gobernacion',
    'Campana Demo Gobernacion',
    'Tenant secundario para pruebas de aislamiento',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  campaign_type_id = EXCLUDED.campaign_type_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

INSERT INTO tenant_settings (
  id,
  tenant_id,
  timezone,
  locale,
  qr_validation_secret,
  allow_partial_returns,
  require_mfa_admin
)
VALUES
  (
    '0ca4998f-fd8a-47d6-a7ac-93d615a31cb4',
    '11111111-1111-7111-8111-111111111111',
    'America/Bogota',
    'es-CO',
    'replace-in-prod',
    true,
    true
  ),
  (
    '1ca4998f-fd8a-47d6-a7ac-93d615a31cb4',
    '22222222-2222-7222-8222-222222222222',
    'America/Bogota',
    'es-CO',
    'replace-in-prod-tenant-2',
    true,
    true
  )
ON CONFLICT (tenant_id) DO UPDATE SET
  timezone = EXCLUDED.timezone,
  locale = EXCLUDED.locale,
  qr_validation_secret = EXCLUDED.qr_validation_secret,
  allow_partial_returns = EXCLUDED.allow_partial_returns,
  require_mfa_admin = EXCLUDED.require_mfa_admin;

INSERT INTO users (
  id,
  tenant_id,
  username,
  email,
  password_hash,
  mfa_enabled,
  mfa_secret_enc,
  failed_login_attempts,
  blocked_until,
  last_login_at,
  is_active
)
VALUES
  (
    'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-7111-8111-111111111111',
    'admin',
    'admin@bdpolitica.local',
    '$2a$12$3GdGKhMg6erNC7R8BTG5P.HQtYx9Rojne18zuCjE9Cd1aFSzmR7Gu',
    true,
    '654321',
    0,
    NULL,
    NULL,
    true
  ),
  (
    'cccccccc-cccc-7ccc-8ccc-cccccccccccc',
    '11111111-1111-7111-8111-111111111111',
    'admin_nomfa',
    'admin.nomfa@bdpolitica.local',
    '$2a$12$BpybJ65AOwf8Bmi9DYgyVu/ttBoOtscYIt5v.EzeSXm0M40K9bMBS',
    false,
    NULL,
    0,
    NULL,
    NULL,
    true
  ),
  (
    'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb',
    '11111111-1111-7111-8111-111111111111',
    'coordinador',
    'coordinador@bdpolitica.local',
    '$2a$12$tBC5Roli7xtecZzNo.L6T.9h3HafRf1fS4oVqY8/xTwlgHAHitizy',
    false,
    NULL,
    0,
    NULL,
    NULL,
    true
  ),
  (
    'dddddddd-dddd-7ddd-8ddd-dddddddddddd',
    '11111111-1111-7111-8111-111111111111',
    'digitador',
    'digitador@bdpolitica.local',
    '$2a$12$Oe0YlefgyIiltgqDcvqHdeIIkWiyi2V//kuEueRs0rc3hY1mZsDsi',
    false,
    NULL,
    0,
    NULL,
    NULL,
    true
  ),
  (
    'eeeeeeee-eeee-7eee-8eee-eeeeeeeeeeee',
    '22222222-2222-7222-8222-222222222222',
    'coordinador2',
    'coordinador2@bdpolitica.local',
    '$2a$12$zIULvHg210eygxSQRMmhxumrRgTLLG2lHPad6hzSKbp5.eqjs6z2m',
    false,
    NULL,
    0,
    NULL,
    NULL,
    true
  )
ON CONFLICT (tenant_id, username) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  mfa_enabled = EXCLUDED.mfa_enabled,
  mfa_secret_enc = EXCLUDED.mfa_secret_enc,
  failed_login_attempts = EXCLUDED.failed_login_attempts,
  blocked_until = EXCLUDED.blocked_until,
  is_active = EXCLUDED.is_active;

INSERT INTO user_roles (
  id,
  tenant_id,
  user_id,
  role_id,
  territory_id,
  person_role_scope_id,
  valid_from,
  valid_to,
  is_active
)
VALUES
  (
    gen_random_uuid(),
    '11111111-1111-7111-8111-111111111111',
    'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa',
    'f1586f7d-6c88-4920-821a-74f8f0a44bf4',
    NULL,
    NULL,
    '2026-01-01T00:00:00Z',
    NULL,
    true
  ),
  (
    gen_random_uuid(),
    '11111111-1111-7111-8111-111111111111',
    'cccccccc-cccc-7ccc-8ccc-cccccccccccc',
    'f1586f7d-6c88-4920-821a-74f8f0a44bf4',
    NULL,
    NULL,
    '2026-01-01T00:00:00Z',
    NULL,
    true
  ),
  (
    gen_random_uuid(),
    '11111111-1111-7111-8111-111111111111',
    'bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb',
    '8d390f84-f6cc-41fb-84f8-5b38f969657f',
    NULL,
    NULL,
    '2026-01-01T00:00:00Z',
    NULL,
    true
  ),
  (
    gen_random_uuid(),
    '11111111-1111-7111-8111-111111111111',
    'dddddddd-dddd-7ddd-8ddd-dddddddddddd',
    'f266d9c3-a6f9-4986-b1af-700bd6b9c6ef',
    NULL,
    NULL,
    '2026-01-01T00:00:00Z',
    NULL,
    true
  ),
  (
    gen_random_uuid(),
    '22222222-2222-7222-8222-222222222222',
    'eeeeeeee-eeee-7eee-8eee-eeeeeeeeeeee',
    '8d390f84-f6cc-41fb-84f8-5b38f969657f',
    NULL,
    NULL,
    '2026-01-01T00:00:00Z',
    NULL,
    true
  )
ON CONFLICT (tenant_id, user_id, role_id, territory_id, valid_from) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  valid_to = EXCLUDED.valid_to;

COMMIT;
