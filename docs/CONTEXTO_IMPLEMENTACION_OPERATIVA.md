# Contexto de continuidad - Implementacion operativa Fuvex

Este documento existe para retomar la implementacion con seguridad si se pierde el contexto del chat.
Leer completo antes de modificar codigo.

## 1. Objetivo real del sistema

Fuvex debe agilizar una operacion que hoy se hace manualmente por WhatsApp, correo y seguimiento verbal.

Flujo manual entendido en el chat:

1. El vendedor registra un prospecto desde la app movil.
2. El prospecto llega a la central web.
3. Central revisa datos, documentos y score.
4. Si el score aprueba, se aplica/calcula la simulacion.
5. Si el cliente acepta la propuesta, se envia informacion/documentos al convenio o institucion.
6. El convenio responde/aprueba.
7. Luego se arma el expediente para BCP.
8. BCP evalua, aprueba/rechaza.
9. Si BCP aprueba, se registra el desembolso.

Meta: que el sistema guie este flujo, capture datos completos desde el inicio, muestre faltantes, deje trazabilidad y reduzca correos manuales.

## 2. Diagnostico actual

El sistema tiene piezas utiles, pero todavia se siente como pantallas sueltas:

- App movil registra una operacion minima, no un prospecto completo.
- Web central muestra bandeja, detalle, documentos y acciones.
- Digitalizacion registra instituciones/convenio, expediente BCP y checklist.
- Simulador trae reglas desde backend.
- Hay trazabilidad por `AuditLog`, `feedback`, `feedbackNotes`, pero no siempre estuvo visible.

Problema principal: el usuario debe conocer el proceso de memoria. El sistema deberia decir "que falta", "quien debe actuar" y "cual es el siguiente paso".

## 3. Estado funcional conocido

### App movil

Archivo principal: `apps/mobile/App.tsx`.

Formulario actual de nuevo expediente captura principalmente:

- DNI
- nombres
- plaza
- convenio
- MAF/monto
- documentos adjuntos
- feedback/observacion

Esto es insuficiente para un prospecto real. Faltan:

- celular / WhatsApp
- correo
- direccion
- distrito
- provincia
- departamento
- zona comercial
- cargo
- entidad laboral
- monto solicitado
- plazo deseado
- origen del prospecto
- consentimiento de evaluacion crediticia
- tipo documental por archivo

Tambien existe `apps/mobile/src/components/ExpedienteDetail.tsx`, que muestra detalle del expediente, checklist, proximos pasos y observaciones.

### Web central

Archivo de bandeja: `apps/web/src/pages/Dashboard.tsx`.

Cambios recientes ya aplicados:

- Acciones visibles en la tabla.
- Boton `Ver` siempre visible.
- Columna `Trazabilidad` con ultimo evento relevante.
- Backend lista `feedbackNotes` y `audit_logs` recientes en `GET /api/sales`.

Modal de detalle: `apps/web/src/components/DocumentViewer.tsx`.

Cambios recientes ya aplicados:

- Al abrir detalle, carga `GET /api/sales/:id`.
- Seccion `Historial / Trazabilidad` con observacion inicial, notas y cambios de estado.
- Acciones de estado usan `next-steps` / transiciones disponibles.

### Digitalizacion

Archivo: `apps/web/src/pages/Digitalizacion.tsx`.

Uso actual:

- Panel izquierdo: selecciona expediente.
- Bloque instituciones: registra envio/respuesta de entidades como RENIEC, SUNAT, ESSALUD, etc.
- Bloque Expediente BCP: numero expediente, agencia, estado BCP, observaciones.
- Bloque documentos/checklist: compara checklist BCP/documentos requeridos con documentos subidos.

Cambio reciente:

- Se agrego boton `Guia interactiva` para explicar el modulo por pasos.

Diagnostico: Digitalizacion sirve como registro operativo, pero deberia redisenarse como pipeline guiado:

`Score aprobado -> Simulacion aceptada -> Enviar a convenio -> Respuesta convenio -> Preparar BCP -> Enviar a BCP -> Respuesta BCP -> Desembolso`

### Backend

Modelo principal: `Sale` en `apps/backend/prisma/schema.prisma`.

Campos actuales relevantes:

- `dni_cliente`
- `nombres_cliente`
- `plaza`
- `departamento`
- `convenio`
- `maf_neto`
- `estado`
- `feedback`
- `asesor_id`
- `fecha_estado_desde`
- simulacion parcial: `simulacion_cuota`, `simulacion_tea`, `simulacion_plazo`, `simulacion_monto`, `simulacion_id`
- relaciones: `documents`, `audit_logs`, `feedbackNotes`, `expediente_instituciones`, `expediente_bcp`

Rutas relevantes:

- `GET /api/sales`
- `GET /api/sales/:id`
- `POST /api/sales`
- `PUT /api/sales/:id/estado`
- `GET /api/sales/:id/documentos/checklist`
- `GET /api/sales/:id/next-steps`
- `POST /api/sales/:id/feedback`
- `GET/POST/PUT/DELETE /api/sales/:id/instituciones`
- `GET/PUT /api/sales/:id/expediente-bcp`
- `PUT /api/sales/:id/expediente-bcp/checklist/:tipo`
- `GET /api/simulator/config`
- `POST /api/simulator/calculate`

Validaciones: revisar `apps/backend/src/middleware/validate.ts`.

## 4. Cambios recientes importantes del chat

No revertir sin revisar.

- Se elimino `start-fuvex.bat`.
- Se creo/usa `Iniciar Fuvex.bat`.
- `Iniciar Fuvex.bat` fue cambiado para:
  - cerrar puertos al iniciar,
  - ejecutar backend oculto,
  - ejecutar web oculta,
  - dejar Expo en la misma ventana para ver QR,
  - guardar logs en `logs/backend.log`, `logs/web.log`, `logs/ngrok.log`.
- `apps/mobile/src/services/pushService.ts` fue ajustado para no romper Expo Go con SDK 53. Expo Go ya no soporta push remoto de `expo-notifications`; para push real se requiere development build.
- Login movil fue redisenado y usa tokens BCP.
- API movil intenta detectar IP LAN desde Expo/bundler y respeta `EXPO_PUBLIC_API_URL`.
- Simulador movil cachea `/simulator/config` para no mostrar carga cada vez.
- Bandeja movil refresca cada 30s, al volver a primer plano y el detalle tiene pull-to-refresh.
- Observaciones/trazabilidad ya se muestran en app movil y web.

## 5. Plan recomendado para que sea util

### Fase 1 - Completar captura del prospecto

Prioridad maxima. Sin datos completos, central seguira pidiendo informacion manualmente.

#### Backend

Extender `Sale` o crear modelo `Prospecto`.

Recomendacion pragmatica para menor riesgo: extender `Sale` primero. Separar `Prospecto` y `Expediente` puede hacerse despues si el flujo queda claro.

Campos sugeridos en `Sale`:

```prisma
celular           String?
telefono_alt      String?
correo            String?
direccion         String?
distrito          String?
provincia         String?
departamento      String? @default("LIMA")
zona_id           String?
entidad_laboral   String?
cargo_laboral     String?
monto_solicitado  Float?
plazo_deseado     Int?
origen_prospecto  String?
consentimiento    Boolean @default(false)
consentimiento_at DateTime?
```

Si existe modelo `Zone`, relacionar `zona_id` con zona. Si no, usar string temporal y normalizar luego.

Actualizar:

- `apps/backend/prisma/schema.prisma`
- migracion Prisma
- `apps/backend/src/middleware/validate.ts`
- `POST /api/sales`
- `GET /api/sales`
- `GET /api/sales/:id`
- exportaciones si aplican

#### App movil

Rehacer formulario de nuevo prospecto en secciones:

1. Cliente
   - DNI
   - nombres
   - celular / WhatsApp
   - correo

2. Ubicacion
   - direccion
   - distrito
   - provincia
   - departamento
   - zona comercial

3. Operacion
   - convenio
   - entidad laboral
   - cargo
   - monto solicitado
   - plazo deseado
   - observaciones

4. Consentimiento
   - checkbox obligatorio para evaluacion crediticia
   - guardar fecha/hora

5. Documentos
   - permitir subir multiples archivos
   - cada archivo debe tener `tipo_documento`
   - no subir todo como `DOC`

Archivos a revisar:

- `apps/mobile/App.tsx`
- `apps/mobile/src/styles/global.ts`
- `apps/mobile/src/constants/theme.ts`

### Fase 2 - Checklist documental por convenio en app y web

Hoy existe checklist en backend/web, pero el vendedor necesita ver faltantes desde la app.

Implementar:

- App muestra documentos requeridos por convenio.
- App permite subir/subsanar por tipo de documento.
- Web central marca documento observado o aceptado.
- Observacion de documento vuelve a la app.

Backend:

- Revisar `DocumentoRequerido`.
- Mejorar endpoint `GET /api/sales/:id/documentos/checklist`.
- Agregar estado por documento si no existe: `SUBIDO`, `VALIDADO`, `OBSERVADO`, `RECHAZADO`.

Si se cambia modelo `Document`, hacerlo con migracion segura.

### Fase 3 - Separar visualmente Prospecto vs Expediente

No necesariamente crear tablas separadas al inicio, pero si separar en UI.

Estados/etapas sugeridas:

```text
PROSPECTO_NUEVO
PENDIENTE_DATOS
PENDIENTE_DOCUMENTOS
LISTO_SCORE
SCORE_APROBADO
SIMULACION_ACEPTADA
ENVIADO_CONVENIO
CONVENIO_APROBADO
PREPARANDO_BCP
ENVIADO_BCP
APROBADO_BCP
DESEMBOLSADO
OBSERVADO
RECHAZADO
```

No reemplazar la state machine de golpe. Mapear estados actuales a etapas operativas primero.

### Fase 4 - Redisenar Digitalizacion como pipeline guiado

Digitalizacion no debe obligar a entender tres bloques aislados. Debe mostrar:

- etapa actual,
- accion requerida,
- responsable,
- documentos requeridos,
- observaciones,
- fecha de envio/respuesta,
- boton de siguiente accion.

UI sugerida:

```text
Score aprobado
Simulacion aceptada
Enviar a convenio
Respuesta convenio
Preparar BCP
Enviar a BCP
Respuesta BCP
Desembolso
```

Cada paso debe tener:

- estado: pendiente, actual, completado, observado
- fecha
- usuario
- observacion
- documentos relacionados

Mantener los modelos actuales:

- `ExpedienteInstitucion`
- `ExpedienteBCP`
- `Document`
- `AuditLog`

Solo redisenar la experiencia primero.

### Fase 5 - Automatizacion de correos

No empezar por aqui. Automatizar correo antes de ordenar datos/documentos aumenta riesgo.

Cuando las fases 1 a 4 esten listas:

- generar plantilla de correo al convenio,
- seleccionar documentos adjuntos,
- registrar envio,
- guardar evidencia,
- registrar respuesta,
- repetir para BCP.

Esto puede ser semiautomatico primero: boton "Generar correo" o "Copiar plantilla".

## 6. Criterios de aceptacion

El sistema empieza a ser util cuando:

- Un vendedor puede registrar un prospecto completo desde app sin pedir datos extra por WhatsApp.
- Central puede ver datos de contacto, ubicacion, zona, convenio, monto/plazo y documentos.
- El sistema muestra documentos faltantes.
- Si central observa algo, el vendedor lo ve en la app.
- La app permite subsanar.
- Todo cambio relevante queda en trazabilidad.
- Digitalizacion muestra el siguiente paso, no solo bloques de captura.
- El usuario sabe si el expediente esta en score, simulacion, convenio, BCP o desembolso.

## 7. Riesgos y reglas de implementacion segura

- No borrar datos ni carpetas sin confirmar.
- No revertir cambios del usuario.
- No eliminar `node_modules` si se necesita trabajar localmente.
- No tocar `.env` ni credenciales.
- Crear migraciones Prisma pequenas y revisables.
- No hacer refactor grande de app movil y backend en un solo cambio.
- Primero backend + tipos + validacion, luego UI.
- Mantener compatibilidad con expedientes viejos: nuevos campos deben ser opcionales al inicio.
- No automatizar correos hasta que datos/documentos esten ordenados.
- En Expo Go, no depender de push remoto.

## 8. Verificacion recomendada

Comandos ya usados en este repo:

```bash
npx.cmd tsc --noEmit
```

Desde `apps/mobile`.

```bash
npm.cmd exec --workspace web -- tsc --noEmit -p tsconfig.app.json
```

Desde raiz.

```bash
npm.cmd exec --workspace backend -- tsc --noEmit -p tsconfig.json
```

Desde raiz.

Prisma:

```bash
npm.cmd exec --workspace backend -- prisma generate
npm.cmd exec --workspace backend -- prisma migrate dev --name <nombre_migracion>
```

Usar `migrate dev` solo en local. Para entornos compartidos, revisar estrategia antes.

## 9. Archivos clave

Backend:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/routes/sales.ts`
- `apps/backend/src/routes/digitalizacion.ts`
- `apps/backend/src/routes/simulator.ts`
- `apps/backend/src/middleware/validate.ts`
- `apps/backend/src/services/hierarchy.ts`

Web:

- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/components/DocumentViewer.tsx`
- `apps/web/src/pages/Digitalizacion.tsx`
- `apps/web/src/pages/Kanban.tsx`
- `apps/web/src/pages/Funnel.tsx`
- `apps/web/src/index.css`

Mobile:

- `apps/mobile/App.tsx`
- `apps/mobile/src/components/LoginView.tsx`
- `apps/mobile/src/components/ExpedienteDetail.tsx`
- `apps/mobile/src/components/SimulatorView.tsx`
- `apps/mobile/src/constants/theme.ts`
- `apps/mobile/src/styles/global.ts`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/services/pushService.ts`

Scripts:

- `Iniciar Fuvex.bat`

## 10. Siguiente tarea recomendada

Implementar Fase 1:

1. Extender `Sale` con datos completos de prospecto.
2. Actualizar validacion y rutas.
3. Redisenar formulario movil en secciones.
4. Mostrar esos datos en web central.
5. Mantener campos opcionales para no romper expedientes existentes.

No iniciar por Digitalizacion ni correos. Primero capturar bien el prospecto.

