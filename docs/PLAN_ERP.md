# Plan ERP Fuvex BCP

Este documento resume la direccion del sistema y las brechas que faltan cerrar para que Fuvex pueda operar como ERP comercial y operativo.

## Decision Arquitectonica

Mantener el monorepo es conveniente para este proyecto:

- `apps/backend`: API principal, reglas de negocio, integraciones y jobs.
- `apps/web`: central operativa para back office, supervision y gerencia.
- `apps/mobile`: registro de prospectos, calculadora y carga documental desde campo.

Para cientos de usuarios no hace falta empezar con microservicios. La ruta correcta es un monolito modular con PostgreSQL, storage externo, auditoria, permisos, observabilidad y despliegue controlado.

## Flujo De Negocio Objetivo

1. Vendedor registra prospecto con datos basicos.
2. Se valida buro/RCC y calculadora.
3. Si califica y el cliente acepta, el vendedor documenta desde la app.
4. Back office valida documentos desde la central.
5. Back office envia o registra envio al convenio.
6. Convenio aprueba u observa.
7. Back office envia a BCP.
8. BCP aprueba, observa o rechaza.
9. Se registra remesa, liberacion si aplica y desembolso.

## Estado Actual

Avanzado:

- Estados ERP unificados.
- Motivos estructurados de rechazo.
- Simulacion/calculadora asociada a prospecto.
- Flujo documental app/web.
- Dashboard con funnel, riesgo, mapa, tablas y SLA.
- PostgreSQL preparado con migraciones, seed, backup y restore.
- Docker local/productivo preparado.
- Preflight tecnico y CI base.
- Auditoria parcial, permisos por accion y control optimista inicial.

Parcial:

- Auditoria completa de todos los cambios criticos.
- Concurrencia en UI enviando `expected_version`.
- Storage externo definitivo para documentos.
- Observabilidad con metricas y alertas reales.
- Build Android probado de punta a punta.

Pendiente:

- Correo controlado a convenio/BCP.
- Staging real.
- Backup automatico fuera del servidor.
- Prueba completa por roles con datos reales de prueba.

## Fases Recomendadas

### P0 - Base segura

- Rotar secretos expuestos.
- Validar `.env.production`.
- Probar PostgreSQL con migraciones y seed.
- Probar backup y restore.
- Usar storage persistente para documentos.

### P1 - Control operativo

- Completar matriz de permisos por endpoint.
- Normalizar auditoria para cambios criticos.
- Enviar `expected_version` desde web/mobile.
- Mantener SLA y alertas visibles por responsable.
- Validar dashboard con operacion real.

### P2 - Produccion controlada

- Crear staging.
- Probar Docker productivo con `.env.staging`.
- Ejecutar flujo completo por rol.
- Compilar y probar Android.
- Automatizar backups.
- Agregar observabilidad y alertas.

### P3 - ERP ampliado

- Administrar convenios, cargos, documentos y SLAs desde UI.
- Integrar correo controlado a convenio/BCP.
- Agregar colas para integraciones externas.
- Crear reportes y exportaciones operativas definitivas.

## Criterio Para Staging

No subir a staging si falla:

```bash
npm run preflight:production
scripts/smoke-local.sh
```

## Criterio Para Produccion

No pasar a produccion real si falta alguno:

- PostgreSQL productivo.
- Backups automaticos y restore probado.
- Storage documental persistente o externo.
- Secretos rotados.
- CI pasando.
- Staging aprobado.
- Health/readiness OK.
- Permisos por rol verificados.
- Flujo completo probado.
- Rollback documentado.
