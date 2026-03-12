# Marketplace Reviewer Port Design

**Date:** 2026-03-09

## Goal

Traer a `development-1` la funcionalidad de marketplace/reviewer que ya existe en `main`: novelas publicadas con score, browse para reviewers, entrada al manuscrito en modo lectura, comentarios de review y chat/análisis con AI.

## Chosen Approach

Portar el stack existente desde `main` de forma quirúrgica:

- Reusar los modelos y endpoints de marketplace/review ya hechos en `main`.
- Reintroducir `UserProfile.user_type` para distinguir `writer` y `reviewer` a nivel de producto, sin reemplazar el sistema actual de memberships dentro de proyectos.
- Mantener la app principal de writer (`App.jsx`) y sumar la app dedicada de reviewer (`ReviewerApp.jsx`) detrás del auth gate.
- Integrar en la vista writer el publish al marketplace y la bandeja de reviews recibidas.
- Preservar branding `Marvin` y los fixes recientes de permisos/comment-only para reviewers dentro de proyectos compartidos.

## Why This Approach

La funcionalidad ya existe en `main` y es bastante transversal:

- modelos nuevos,
- migraciones,
- endpoints,
- routing por tipo de usuario,
- UI dedicada del reviewer,
- overlays del writer.

Reescribirla encima del sistema actual saldría más caro y con más riesgo que portarla. El punto delicado es no reintroducir branding viejo ni deshacer el reviewer fix de esta rama.

## Scope

### In

- `UserProfile` con migraciones y serialización en auth.
- Endpoints `/api/marketplace/`, `/api/listings/`, `/api/reviews/`, nested comments y AI review endpoints.
- Reviewer app con browse, detail, reader, comments, AI tools, chat y report builder.
- Writer-side publish dialog y received reviews overlay.
- API client y routing frontend necesarios.

### Out

- Cambios no relacionados de `main`.
- Rediseños grandes de UI fuera del marketplace.
- Replantear el sistema actual de permisos de proyecto.

## Integration Notes

- `reviewer@demo.com` deberá tener `UserProfile(user_type="reviewer")`.
- El reviewer app usa sus propios modelos de `Review` y `ReviewComment`; no reemplaza el sistema de comentarios del editor principal.
- El writer sigue entrando a `/app` pero verá botones nuevos para marketplace y reviews recibidas.
- El reviewer entrará al mismo `/app`, pero el router decidirá `ReviewerApp` según `user.user_type`.

## Risk Areas

- Conflictos entre `main` y `development-1` en `App.jsx`, `api.js`, `AuthContext`, auth serializers/views y `models.py`.
- Migraciones nuevas sobre una base que ya tiene datos demo.
- Branding viejo `Mive` que todavía existe en componentes de `main`.
- Endpoint AI del reviewer dependiendo de provider keys configuradas.

## Validation

- Tests backend para modelos, auth serializer/user_type y endpoints de marketplace/review.
- Build frontend.
- Smoke login writer/reviewer.
- Dogfood manual del browse reviewer, open manuscript, inline comments, AI chat y received reviews.
