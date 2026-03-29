# AGENTE_PROYECTO

Documento maestro para cualquier agente que continúe este proyecto.

Regla global: todo desarrollo, pruebas y ejecucion deben hacerse en Docker.

## 1. Objetivo del producto

Construir una plataforma web neutral para gestion de campanas en Colombia, con:

- Multi-campana simultanea.
- Aislamiento total entre campanas (tenant por campana).
- Gestion de personas y jerarquias:
  - Coordinador -> Lider -> Votante.
- Listados operativos con QR interno y cadena de custodia.
- Carga masiva por Excel/CSV.
- Seguridad fuerte (RBAC, auditoria, trazabilidad, consentimiento).

## 2. Decisiones cerradas (no reabrir sin aprobacion)

- Arquitectura: monolito modular.
- Backend: NestJS.
- Frontend: Next.js (App Router).
- DB: PostgreSQL.
- Multi-tenant: tablas compartidas con `tenant_id` + RLS.
- IDs: UUID v7 (generadas por app).
- Cola: Redis + BullMQ.
- Archivos/evidencias: S3 compatible (MinIO/AWS).
- Autenticacion: usuario/password local + cookies seguras.
- MFA: obligatorio para administradores.
- Autorizacion: rol + tenant + territorio + jerarquia.
- Importacion masiva: preview + validacion + upsert por identificacion.
- Auditoria: eventos centralizados (auth, CRUD, import/export, listados).

## 3. Reglas funcionales clave

1. Un coordinador puede tener muchos lideres.
2. Un lider pertenece a un coordinador (vigente).
3. Un lider puede tener muchos votantes.
4. Un votante pertenece a un lider (vigente).
5. Persona puede tener multiples roles dentro de la misma campana.
6. Listados:
   - Creacion mixta (manual/filtros/importacion).
   - QR con codigo interno, nunca datos sensibles.
   - Versionado obligatorio.
   - Snapshot para impresion.
   - Vista viva para seguimiento.
7. Cadena de custodia:
   - Multiples movimientos.
   - Recepcion por usuario o tercero manual.
   - Evidencia opcional (foto/firma/archivo).
8. Devoluciones parciales habilitadas.
9. Cierre/anulacion con catalogo de motivos + observacion.

## 4. Estructura esperada del repositorio

```
/
|- AGENTE_PROYECTO.md
|- README.md
|- docker-compose.yml
|- docs/
|  |- 01-requisitos-mvp.md
|  |- 02-arquitectura.md
|  |- 03-modelo-datos.sql
|  |- PROMPT_MAESTRO_AGENTE.md
|- apps/
|  |- api/   (NestJS)
|  |- web/   (Next.js)
```

## 5. Estado actual del proyecto

- Base documental MVP completada.
- Esquema SQL base completo en `docs/03-modelo-datos.sql`.
- Infra local definida en `docker-compose.yml`:
  - postgres
  - redis
  - minio
- Monorepo inicial funcional.
- API base operativa (auth/tenants/rbac + healthcheck + smoke tests).
- Frontend base operativo (Next.js con login/dashboard MVP).
- Flujo Docker-first validado extremo a extremo.

## 6. Protocolo de trabajo para el agente

Seguir siempre este orden:

1. Leer `AGENTE_PROYECTO.md` y `docs/01-requisitos-mvp.md`.
2. Revisar estado de git y estructura de archivos.
3. Implementar por fase, no mezclar todo a la vez.
4. Antes de editar, explicar que se va a cambiar.
5. Despues de editar:
   - ejecutar pruebas/lint disponibles
   - reportar resultado real
   - registrar riesgos y faltantes.

Regla tecnica:

- No asumir Node/npm/pnpm instalado en host.
- Ejecutar tareas de app y DB desde contenedores.

## 7. Fases y Definition of Done

### Fase 1: Base tecnica (MVP Core)

- [x] Monorepo funcional (`apps/api`, `apps/web`).
- [x] API NestJS arranca y responde health.
- [x] Frontend Next.js arranca con login base.
- [x] Script de inicializacion DB aplicado.
- [x] Seed de catalogos aplicado.
- [x] Smoke tests de auth + tenant isolation en verde.

DoD Fase 1:
- `docker compose up` estable.
- `api` y `web` levantan localmente.
- Tests base pasan.

### Fase 2: Seguridad y acceso

- [ ] Login real con hash seguro (Argon2/bcrypt).
- [ ] Refresh token rotativo.
- [ ] MFA admin.
- [ ] RBAC por modulo/accion.
- [ ] Scope por tenant.
- [ ] Auditoria auth y permisos.

DoD Fase 2:
- Acceso denegado entre tenants comprobado en pruebas.

### Fase 3: Personas y jerarquias

- [ ] CRUD personas.
- [ ] Identificacion y consentimiento.
- [ ] Roles de persona (coordinador/lider/votante).
- [ ] Asignaciones jerarquicas con vigencia.
- [ ] Reasignaciones con historial.

DoD Fase 3:
- Reglas de jerarquia validadas con pruebas.

### Fase 4: Listados operativos

- [ ] Crear listado (manual/filtro/importado).
- [ ] Versionado + snapshot.
- [ ] Estado y motivos.
- [ ] Cadena de custodia.
- [ ] Evidencias de movimiento.
- [ ] QR interno.

DoD Fase 4:
- Trazabilidad completa desde creacion hasta cierre.

### Fase 5: Importaciones masivas y reportes

- [ ] Subida de archivo.
- [ ] Validacion + preview.
- [ ] Proceso async por lotes.
- [ ] Reporte de errores por fila.
- [ ] Exportaciones con permisos y auditoria.

DoD Fase 5:
- Importacion robusta con rollback/control por lote.

## 8. Seguridad obligatoria (no negociable)

- No exponer datos sensibles en QR ni logs.
- Aplicar RLS para tablas tenant-scoped.
- Enmascarar identificacion en UI/export segun permiso.
- Registrar auditoria para:
  - login/errores login
  - cambios de rol/permiso
  - imports/exports
  - eventos de listados
  - consultas sensibles (si aplica).
- Mantener backups diarios/semanales/mensuales y prueba de restore.

## 9. Pendientes abiertos del negocio

- Integracion oficial para puesto/mesa externa.
- Definir catalogo final de territorios finos por tipo de candidatura.
- Definir si afinidad politica se captura en todos los flujos o solo en ciertos roles.

## 10. Reglas de calidad de codigo

- Escribir codigo simple y modular.
- Evitar logica de negocio en controladores.
- Cubrir casos criticos con pruebas.
- No hardcodear secretos.
- Documentar endpoints con OpenAPI.

## 11. Entregable minimo esperado en cada iteracion

Cada avance del agente debe incluir:

1. Que cambio se hizo.
2. En que archivos.
3. Como se valido.
4. Que quedo pendiente.
5. Riesgos detectados.
