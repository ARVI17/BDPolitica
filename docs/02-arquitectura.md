# Arquitectura Tecnica (MVP)

## 1) Estilo de arquitectura

Monolito modular con separacion por dominios:

- `auth`
- `usuarios`
- `rbac`
- `tenants`
- `territorios`
- `personas`
- `jerarquias`
- `listados`
- `importaciones`
- `auditoria`
- `archivos`

## 2) Componentes

- `web` (Next.js): interfaz de usuario, panel admin, flujo de listados, importaciones.
- `api` (NestJS): reglas de negocio, seguridad, integracion DB, colas, auditoria.
- `postgres`: persistencia transaccional y politicas RLS.
- `redis`: cola y cache de corto plazo.
- `object storage` (MinIO/S3): evidencias y adjuntos.

## 3) Multi-tenant y aislamiento

### Reglas

- Cada campana es un tenant.
- Todas las tablas de negocio incluyen `tenant_id`.
- Todo query debe filtrar por tenant.
- RLS activa en tablas sensibles.
- Contexto tenant resuelto por sesion de usuario.

### Contexto de seguridad

Header/cookie de sesion -> usuario autenticado -> tenant activo -> politicas de acceso.

## 4) Autenticacion y sesion

- Login local (email/username + password hash Argon2/bcrypt).
- MFA para administradores.
- Cookies seguras:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Lax/Strict`.
- Refresh token rotativo con invalidacion por reuse.
- Bloqueo temporal por intentos fallidos.

## 5) Autorizacion

RBAC por capas:

1. Permiso funcional (accion/modulo).
2. Tenant.
3. Territorio.
4. Jerarquia (scope operacional).

Ejemplo:

- Un coordinador solo puede ver y operar lideres/votantes bajo su linea y territorio.

## 6) Datos y modelo territorial

MVP hibrido:

- Modelo soporta:
  - departamento
  - municipio
  - corregimiento/localidad/comuna
  - barrio
  - puesto
  - mesa.
- UI MVP prioriza niveles clave y deja niveles finos opcionales.

## 7) Listados y trazabilidad

- Listado tiene versionado.
- Cada version tiene snapshot de items.
- Cadena de custodia en eventos de movimiento.
- Evidencias asociables a movimiento.
- Estado y motivo auditables.

## 8) Importaciones masivas

Pipeline recomendado:

1. Subida archivo.
2. Validacion de estructura.
3. Preview de errores.
4. Confirmacion.
5. Proceso async por lotes.
6. Upsert.
7. Reporte final.

## 9) Observabilidad

- Logs estructurados JSON.
- Correlation ID por request.
- Eventos de seguridad y auditoria.
- Metricas operativas (login, imports, listados).
- Alertas minimas:
  - errores 5xx
  - intentos fallidos anormales
  - fallos de jobs.

## 10) Despliegue

Regla de ejecucion:

- Todo se ejecuta en contenedores Docker (dev, pruebas y procesos de datos).
- No depender de Node/npm/pnpm instalados en host.

### MVP

- Docker Compose por entorno (dev/staging/prod small).
- Servicios:
  - api
  - web
  - postgres
  - redis
  - minio.

### Endurecimiento minimo prod

- HTTPS obligatorio.
- Secret manager (no secretos en repo).
- Backups automáticos y prueba de restore.
- Politica de actualizacion de imagenes base.
