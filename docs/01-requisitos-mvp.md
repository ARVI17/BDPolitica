# Requisitos MVP Cerrados

## 1) Contexto

- Pais: Colombia.
- Despliegue: nube, dockerizado.
- Estrategia: MVP por fases.
- Plataforma neutral.
- Multi-campana simultanea.
- Aislamiento total entre campanas.

## 2) Modelo de negocio

- Cada campana es un tenant independiente.
- Una persona puede tener multiples roles dentro de la misma campana.
- Jerarquia MVP:
  - Coordinador -> Lider -> Votante.
- Visibilidad por:
  - rol
  - tenant
  - territorio
  - jerarquia.

## 3) Datos de persona

- Nombre completo.
- Numero de telefono.
- Direccion.
- Numero de identificacion.
- Afinidad politica basica (dato sensible) con consentimiento.
- Puesto y mesa:
  - temporalmente por carga local CSV/Excel.
  - futura integracion con fuente externa.

## 4) Listados operativos

- Definicion: listado de votantes asignados a un lider.
- Creacion mixta:
  - manual
  - por filtros
  - por importacion.
- QR con solo codigo interno del listado.
- Creacion/asignacion de listados:
  - Administrador
  - Coordinador.

## 5) Flujo de listados

Estados base:

1. Borrador
2. Generado
3. Asignado
4. Entregado
5. Recibido
6. Cerrado
7. Anulado

Reglas:

- Cadena de custodia con movimientos multiples.
- Puede recibir:
  - usuario con login
  - tercero registrado manualmente.
- Evidencias opcionales:
  - observacion
  - foto
  - firma
  - archivo.
- Reimpresion/regeneracion con versionado y auditoria.
- Datos mixtos:
  - snapshot congelado para el documento/version.
  - vista en tiempo real para seguimiento interno.
- Devoluciones parciales habilitadas.
- Cierre/anulacion con catalogo de motivo + observacion.
- Impresion: formato operativo estandar.

## 6) Seguridad y cumplimiento

- Login local usuario/contrasena.
- MFA solo para administradores.
- Password policy intermedia (10+ caracteres, complejidad).
- Sesiones con cookies seguras y rotacion de refresh token.
- Bloqueo por intentos fallidos + rate limiting.
- Enmascarado parcial de datos sensibles.
- Exportaciones controladas por permiso.
- Auditoria:
  - CRUD
  - login/logout
  - cambios de permisos
  - importaciones/exportaciones
  - operaciones de listados.
- Retencion de auditoria/logs: 12 meses.
- Backups:
  - diario
  - semanal
  - mensual
  - prueba de restauracion periodica.

## 7) Decisiones de arquitectura

- Backend: NestJS.
- Frontend: Next.js.
- API: REST + OpenAPI.
- ORM: Prisma.
- DB: PostgreSQL.
- Cola: Redis + BullMQ.
- Evidencias: S3 compatible (MinIO/AWS).
- Multi-tenant: tablas compartidas con `tenant_id` + RLS.
- IDs: UUID v7 generadas en aplicacion.
- Soft delete.
- Importacion: upsert por tipo + numero de identificacion.
- Consentimiento formal con trazabilidad.
