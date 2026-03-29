# Informe Operativo Fase 2 (Uso, Arranque y Soporte)

## 1) Estado funcional actual

La plataforma ya opera con:

- Auth real `access + refresh` con rotacion de refresh token.
- Deteccion de `refresh` reutilizado y revocacion global de sesiones.
- RBAC real por BD (`users`, `user_roles`, `role_catalog`, `permission_catalog`).
- MFA obligatorio para usuarios `ADMIN` en rutas sensibles.
- Auditoria en `audit_events` para eventos criticos.
- OpenAPI disponible en `/api/docs` y `/api/docs-json`.
- CI Docker-first con workflow `Docker QA` y check requerido `Docker QA / qa`.

## 2) Requisitos para ponerlo a funcionar

- Docker Desktop activo.
- Puerto `5432` libre (o cambiar `POSTGRES_PORT` en `.env`).
- Puerto `3001` para API y `3000` para web.
- Archivo `.env` creado desde `.env.example`.

Variables clave:

- `ACCESS_TOKEN_SECRET` (obligatoria, minimo 32 caracteres).
- `DEV_ADMIN_PASSWORD`, `DEV_COORDINADOR_PASSWORD` (compatibilidad local).
- `DAO_LOG_QUERIES`, `DAO_SLOW_QUERY_MS`, `DAO_LOG_QUERY_PARAMS` (observabilidad DB).

## 3) Arranque oficial (solo Docker)

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose run --rm db-init
docker compose ps
```

Verificacion minima:

- API health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api/docs`
- Web: `http://localhost:3000`

## 4) Uso rapido de autenticacion (smoke manual)

### 4.1 Login coordinador

```powershell
$base = "http://localhost:3001/api"
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body (@{
  tenantCode = "campana-demo-alcaldia"
  username = "coordinador"
  password = "Coordi12345!"
} | ConvertTo-Json)
$login
```

### 4.2 Refresh valido

```powershell
Invoke-RestMethod -Method Post -Uri "$base/auth/refresh" -ContentType "application/json" -Body (@{
  refreshToken = $login.refreshToken
} | ConvertTo-Json)
```

### 4.3 Logout global

```powershell
$tenantId = "11111111-1111-7111-8111-111111111111"
Invoke-RestMethod -Method Post -Uri "$base/auth/logout-all" -Headers @{
  Authorization = "Bearer $($login.accessToken)"
  "x-tenant-id" = $tenantId
}
```

### 4.4 MFA admin (ruta sensible)

```powershell
$admin = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body (@{
  tenantCode = "campana-demo-alcaldia"
  username = "admin"
  password = "Admin12345!"
  mfaCode = "654321"
} | ConvertTo-Json)

Invoke-RestMethod -Method Get -Uri "$base/rbac/admin-security-status" -Headers @{
  Authorization = "Bearer $($admin.accessToken)"
  "x-tenant-id" = "11111111-1111-7111-8111-111111111111"
}
```

## 5) Logging de DAO (errores y consultas)

Se agrego logging centralizado en `PrismaService` que cubre todos los accesos a BD (DAO):

- Log por operacion DAO: `[DAO] modelo.accion (ms)`
- Log de error DAO: `[DAO-ERROR] modelo.accion ...`
- Log de advertencias Prisma.
- Deteccion de query lenta por umbral (`DAO_SLOW_QUERY_MS`).

Configuracion:

- `DAO_LOG_QUERIES=true`: habilita logs DAO.
- `DAO_SLOW_QUERY_MS=300`: umbral de lentitud.
- `DAO_LOG_QUERY_PARAMS=false`: no exponer args sensibles (recomendado mantener en `false`).

Comandos de monitoreo:

```powershell
docker compose logs -f api
docker compose logs -f api | Select-String "DAO|DAO-ERROR|Prisma warn|Prisma error"
```

## 6) Auditoria funcional (eventos criticos)

Consulta directa:

```powershell
docker compose exec -T postgres psql -U bdpolitica -d bdpolitica -c "select event_name, tenant_id, actor_user_id, created_at from audit_events order by created_at desc limit 30;"
```

Eventos esperados:

- `auth.login.success`
- `auth.refresh.success`
- `auth.refresh.reuse_detected`
- `auth.logout_all.success`
- `rbac.user_role.updated`

## 7) QA y calidad (bloqueo de merge)

Workflow: `.github/workflows/docker-ci.yml`

Pipeline:

1. `docker compose up -d --build`
2. `db-init`
3. API: `lint`, `test`, `typecheck`
4. Web: `lint`, `typecheck`, `build`

La rama `main` exige el check:

- `Docker QA / qa`

Si falla, GitHub bloquea merge.

## 8) Comandos de soporte diario

```powershell
# Reiniciar stack
docker compose down
docker compose up -d --build

# Reinicializar DB (seed idempotente)
docker compose run --rm db-init

# QA completo local (mismo criterio CI)
docker compose run --rm --no-deps api pnpm --filter @bdpolitica/api lint
docker compose run --rm --no-deps api pnpm --filter @bdpolitica/api test
docker compose run --rm --no-deps api pnpm --filter @bdpolitica/api typecheck
docker compose run --rm --no-deps web pnpm --filter @bdpolitica/web lint
docker compose run --rm --no-deps web pnpm --filter @bdpolitica/web typecheck
docker compose run --rm --no-deps web pnpm --filter @bdpolitica/web build
```

## 9) Fallas comunes y accion inmediata

- `ACCESS_TOKEN_SECRET debe existir...`
  - Definir `ACCESS_TOKEN_SECRET` en `.env` con 32+ caracteres.
- `Header x-tenant-id requerido` / `tenant no coincide`
  - Enviar siempre `x-tenant-id` del tenant del token.
- `Refresh token revocado o reutilizado`
  - Forzar nuevo login (comportamiento esperado de seguridad).
- `Usuario temporalmente bloqueado`
  - Esperar `LOGIN_BLOCK_MINUTES` o desbloquear en BD.
