# BDPolitica

Base tecnica del sistema web de gestion de campanas, jerarquias territoriales y listados operativos con trazabilidad.

## Estado actual

Se definieron y documentaron las decisiones de MVP:

- Multi-campana simultanea.
- Aislamiento estricto por campana (`tenant_id`).
- Arquitectura monolito modular.
- Stack recomendado:
  - Backend: NestJS (Node.js)
  - Frontend: Next.js
  - Base de datos: PostgreSQL
  - Cola: Redis + BullMQ
  - Evidencias: S3 compatible (MinIO/AWS)
  - Contenedores: Docker Compose
- Seguridad:
  - Sesion por cookies seguras (`HttpOnly`, `Secure`, `SameSite`)
  - MFA para administradores
  - RBAC por rol + tenant + territorio + jerarquia
  - Auditoria centralizada
  - Carga masiva con trazabilidad

## Documentacion

- Documento maestro para agentes: `AGENTE_PROYECTO.md`
- Requisitos y alcance: `docs/01-requisitos-mvp.md`
- Arquitectura y despliegue: `docs/02-arquitectura.md`
- Modelo de datos SQL base: `docs/03-modelo-datos.sql`
- Prompt maestro reutilizable: `docs/PROMPT_MAESTRO_AGENTE.md`

## Infra base local

Se usa `docker-compose` como unica forma soportada de ejecucion:

- PostgreSQL
- Redis
- MinIO
- API (NestJS)
- Web (Next.js)
- Inicializador de base de datos (`db-init`)

Archivo: `docker-compose.yml`

## Arranque rapido (solo Docker)

1. Crear archivo de entorno local:
   - Linux/macOS: `cp .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
   - Definir `ACCESS_TOKEN_SECRET`, `DEV_ADMIN_PASSWORD` y `DEV_COORDINADOR_PASSWORD`.
   - Si `5432` esta ocupado, cambia `POSTGRES_PORT=5433` en `.env`.
2. Levantar infraestructura y apps:
   - `docker compose up -d --build`
3. Inicializar esquema y seed (solo primera vez):
   - `docker compose run --rm db-init`
4. Verificar API:
   - `http://localhost:3001/api/health`
5. Verificar Web:
   - `http://localhost:3000`

## Comandos utiles (Docker-first)

- Ver logs:
  - `docker compose logs -f --tail=200`
- Arranque completo + init DB:
  - `pnpm docker:init`
- Ejecutar tests API:
  - `docker compose run --rm --no-deps api pnpm --filter @bdpolitica/api test`
- Ejecutar QA completo:
  - `pnpm docker:qa`
- Detener todo:
  - `docker compose down`

## Credenciales demo (seed)

- Tenant `campana-demo-alcaldia`:
  - `admin` / `Admin12345!` + MFA `654321`
  - `admin_nomfa` / `AdminNoMfa123!` (bloqueado en rutas sensibles por falta de MFA)
  - `coordinador` / `Coordi12345!`
  - `digitador` / `Digita12345!`
- Tenant `campana-demo-gobernacion`:
  - `coordinador2` / `CoordiTenant2123!`

## API docs

- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/docs-json`
