# Preproduccion

Este documento sirve para comprobar que el proyecto esta listo para probarse en staging o servidor, sin publicarlo todavia.

## Estado Actual

Revision local al 2026-05-19:

- `npm audit`: OK, 0 vulnerabilidades.
- Build backend: OK.
- Tests backend: OK.
- Build web: OK.
- Typecheck mobile: OK.
- Prisma SQLite y PostgreSQL validate: OK.
- Docker Compose PostgreSQL local config: OK.
- Smoke local: OK.

## Preflight Tecnico

Ejecutar:

```bash
npm run preflight:production
```

Valida:

- Auditoria npm.
- Build backend.
- Tests backend.
- Build web.
- Typecheck mobile.
- Prisma local y PostgreSQL.
- Docker Compose PostgreSQL local.
- `.env.production` y compose productivo si el archivo existe.

## Smoke Local

Con backend y web activos:

```bash
scripts/smoke-local.sh
```

Valida:

- `/api/health`
- `/api/ready`
- Login admin.
- Kanban.
- Dashboard.
- Web local.

## Checklist Funcional

Probar manualmente:

- Login web.
- Crear prospecto desde app.
- Registrar calculadora asociada al prospecto.
- Rechazo por buro.
- Rechazo por calculadora.
- Cliente acepta y pasa a documentar.
- Vendedor sube documentos desde app.
- Back office valida documentos desde web.
- Back office observa y vendedor subsana.
- File completo.
- Envio/registro a convenio.
- Observacion/aprobacion convenio.
- Envio a BCP.
- Observacion/aprobacion BCP.
- Remesa.
- Liberacion si hay compra de deuda.
- Desembolso.

## Checklist De Seguridad

- `.env.production` no versionado.
- `JWT_SECRET` nuevo y fuerte.
- `POSTGRES_PASSWORD` nuevo y fuerte.
- `SEED_ADMIN_PASSWORD` temporal y fuerte.
- `CORS_ORIGINS` con dominios reales, sin `localhost` en produccion.
- Credenciales Infoburo separadas por ambiente.
- Rate limit activo.
- Headers de seguridad activos.
- `X-Request-Id` presente en respuestas.

## App Movil

Antes de staging:

- Backend accesible desde el dispositivo.
- Build Android probado o Expo probado contra API real local/staging.
- Carga documental validada desde celular.
- Calculadora asociada al prospecto sin bloquear el formulario inicial.

## Limpieza Realizada

Artefactos generados eliminados:

- `apps/web/dist`
- `apps/backend/dist`
- `apps/web/node_modules/.vite`
- `apps/mobile/.expo`

Assets viejos eliminados y no requeridos por la UI actual:

- `Recursos/A366BCP.png`
- `Recursos/LogoAPK.png`
- `Recursos/isotipobcp.png`
- Capturas antiguas en `screenshots/WhatsApp Image 2026-05-02...jpeg`

La web usa `apps/web/public/logo.png` y `apps/web/public/isotipobcp.png`.

## Siguiente Paquete Recomendado

1. Crear `.env.staging` o `.env.production` temporal con secretos de prueba.
2. Levantar `docker-compose.prod.yml` local o en una Droplet staging.
3. Probar flujo completo por roles con PostgreSQL.
4. Probar Android contra esa API.
5. Automatizar backup diario.
6. Implementar correo controlado a convenio/BCP.
7. Enviar `expected_version` desde web/mobile en ediciones criticas.
