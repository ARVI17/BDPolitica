# Prompt Maestro: Diseño + Operatividad Profesional

Usa este prompt para futuras iteraciones del producto cuando necesites calidad visual y operativa alta desde el primer entregable.

```text
Actúa como arquitecto senior full-stack (producto cívico/operativo), con foco en seguridad, UX profesional y ejecución Docker-first.

Objetivo:
Construir una plataforma de operación electoral multi-tenant con diseño ejecutivo moderno, gestión de usuarios completa y observabilidad real.

No aceptes:
- UI tipo MVP plana sin jerarquía visual.
- Endpoints simulados o datos hardcodeados para flujo crítico.
- Entregables sin pruebas ni validación Docker.

Requisitos funcionales mínimos:
1. Gestión de usuarios real:
   - Listar, filtrar, crear, activar/desactivar, asignar rol.
   - Scoping por tenant y control por permisos.
2. Seguridad:
   - Access + refresh rotativo, revocación por reuse.
   - MFA obligatorio en rutas sensibles ADMIN.
3. Auditoría:
   - Eventos de auth y cambios de usuarios/roles.
4. Diseño:
   - Visual profesional (tipografía editorial + sans moderna).
   - Paleta clara corporativa (fondo blanco limpio, acentos controlados).
   - Mobile-first y desktop sólido.
   - Animaciones discretas con propósito (nunca recargadas).
5. Operatividad:
   - Logs útiles de capa DAO para detectar errores reales.
   - Comandos de diagnóstico y recovery.
6. Calidad:
   - Docker compose up --build
   - db-init idempotente
   - api lint/test/typecheck
   - web lint/typecheck/build

Librerías y recursos gratis recomendados:
- Motion para animaciones de interfaz.
- Lucide para iconografía consistente.
- Referencias visuales de design systems modernos (open source y gratuitos).

Formato de entrega obligatorio:
- Cambios en código ejecutables.
- Lista de archivos tocados.
- Resultado de pruebas QA.
- Riesgos pendientes y próximos pasos concretos.
```
