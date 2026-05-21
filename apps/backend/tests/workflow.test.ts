import assert from 'node:assert/strict';
import {
  CATALOGO_MOTIVOS,
  DOCUMENT_REQUIRED_STATES,
  KANBAN_COLUMNS,
  REJECTION_REASONS,
  VALID_ESTADOS,
  validateTransition
} from '../src/middleware/validate';
import { canPerformAction } from '../src/middleware/permissions';
import { assertSlaRulesAreValid, getSlaInfo } from '../src/services/sla';

const estados = new Set<string>(VALID_ESTADOS);

for (const column of KANBAN_COLUMNS) {
  assert.ok(estados.has(column.key), `Kanban contiene estado no valido: ${column.key}`);
}

for (const estado of DOCUMENT_REQUIRED_STATES) {
  assert.ok(estados.has(estado), `Estado documental no valido: ${estado}`);
}

for (const motivo of REJECTION_REASONS) {
  assert.ok(CATALOGO_MOTIVOS.RECHAZADO.includes(motivo), `Motivo de rechazo no catalogado: ${motivo}`);
}

assert.doesNotThrow(assertSlaRulesAreValid, 'Las reglas SLA deben usar estados validos');

const slaBackOffice = getSlaInfo(
  'VALIDACION_BACK_OFFICE',
  new Date('2026-05-01T00:00:00.000Z'),
  new Date('2026-05-04T00:00:00.000Z')
);

assert.equal(slaBackOffice.vencido, true, 'VALIDACION_BACK_OFFICE debe vencer sobre su SLA');
assert.equal(slaBackOffice.sla_responsable, 'BACK_OFFICE', 'SLA de back office debe asignarse a back office');

assert.equal(
  validateTransition('PROSPECTO_NUEVO', 'VERIFICACION_SISTEMA', 'VENDEDOR').valid,
  true,
  'Vendedor debe poder iniciar verificacion del prospecto'
);

assert.equal(
  validateTransition('VERIFICACION_SISTEMA', 'SCORE_BCP', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder registrar verificacion de sistema aprobada'
);

assert.equal(
  validateTransition('SCORE_BCP', 'PENDIENTE_BOLETA', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder aprobar score BCP y solicitar boleta'
);

assert.equal(
  validateTransition('PENDIENTE_BOLETA', 'EVALUACION_CALCULADORA', 'VENDEDOR').valid,
  true,
  'Vendedor debe poder marcar boleta recibida para calculadora'
);

assert.equal(
  validateTransition('EVALUACION_CALCULADORA', 'COTIZACION_ENVIADA', 'VENDEDOR').valid,
  true,
  'Vendedor debe poder emitir cotizacion si calculadora aprueba'
);

assert.equal(
  validateTransition('COTIZACION_ENVIADA', 'PENDIENTE_DATOS_FILE', 'VENDEDOR').valid,
  true,
  'Vendedor debe poder avanzar a datos de file cuando cliente acepta'
);

assert.equal(
  validateTransition('PENDIENTE_DATOS_FILE', 'VALIDACION_BACK_OFFICE', 'VENDEDOR').valid,
  true,
  'Vendedor debe poder enviar file cargado a back office'
);

assert.equal(
  validateTransition('VALIDACION_BACK_OFFICE', 'FILE_VALIDADO', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder validar el file'
);

assert.equal(
  validateTransition('FILE_VALIDADO', 'ENVIADO_BCP_REMESA', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder enviar file al BCP para remesa'
);

assert.equal(
  validateTransition('ENVIADO_BCP_REMESA', 'REMESA_APROBADA', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder registrar remesa aprobada'
);

assert.equal(
  validateTransition('REMESA_APROBADA', 'PENDIENTE_DESEMBOLSO', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder pasar remesa aprobada a pendiente desembolso'
);

assert.equal(
  validateTransition('PENDIENTE_DESEMBOLSO', 'DESEMBOLSADO', 'BACK_OFFICE').valid,
  true,
  'Back office debe poder registrar desembolso'
);

assert.equal(
  validateTransition('PROSPECTO_NUEVO', 'FILE_VALIDADO', 'VENDEDOR').valid,
  false,
  'No se debe permitir saltar de prospecto a file validado'
);

assert.equal(
  validateTransition('PROSPECTO_NUEVO', 'RECHAZADO', 'BACK_OFFICE').valid,
  false,
  'Rechazo debe exigir motivo'
);

assert.equal(
  validateTransition('PROSPECTO_NUEVO', 'RECHAZADO', 'BACK_OFFICE', 'BURO_NO_CALIFICA').valid,
  true,
  'Rechazo con motivo valido debe permitirse para roles de revision'
);

assert.equal(
  validateTransition('VERIFICACION_SISTEMA', 'RECHAZADO', 'BACK_OFFICE', 'CONYUGE_NO_CALIFICA').valid,
  true,
  'Conyuge con problemas debe poder rechazar el expediente con motivo estructurado'
);

assert.equal(
  validateTransition('SCORE_BCP', 'RECHAZADO', 'BACK_OFFICE', 'SCORE_BCP_NO_CALIFICA').valid,
  true,
  'Score BCP no califica debe poder rechazar el expediente'
);

assert.equal(
  validateTransition('EVALUACION_CALCULADORA', 'RECHAZADO', 'BACK_OFFICE', 'CALCULADORA_NO_CALIFICA').valid,
  true,
  'Calculadora no califica debe poder rechazar el expediente'
);

assert.equal(
  validateTransition('REMESA_APROBADA', 'PENDIENTE_CARTA_PODER', 'BACK_OFFICE').valid,
  true,
  'Compra de deuda debe poder esperar carta poder luego de remesa aprobada'
);

assert.equal(
  validateTransition('PENDIENTE_CARTA_PODER', 'REENVIADO_BCP_COMPRA_DEUDA', 'BACK_OFFICE').valid,
  true,
  'Compra de deuda debe poder reenviarse a BCP con carta poder'
);

assert.equal(
  validateTransition('REENVIADO_BCP_COMPRA_DEUDA', 'PENDIENTE_CARTA_NO_ADEUDO', 'BACK_OFFICE').valid,
  true,
  'Compra de deuda debe esperar carta de no adeudo'
);

assert.equal(
  validateTransition('PENDIENTE_CARTA_NO_ADEUDO', 'PENDIENTE_LIBERACION', 'BACK_OFFICE').valid,
  true,
  'Carta de no adeudo validada debe pasar a liberacion'
);

assert.equal(
  validateTransition('PENDIENTE_LIBERACION', 'DESEMBOLSADO', 'BACK_OFFICE').valid,
  true,
  'Liberacion debe poder cerrar con desembolso'
);

assert.equal(
  canPerformAction('VENDEDOR', 'UPLOAD_DOCUMENT'),
  true,
  'Vendedor debe poder cargar documentos del expediente'
);

assert.equal(
  canPerformAction('VENDEDOR', 'MANAGE_BCP'),
  false,
  'Vendedor no debe poder operar expediente BCP'
);

assert.equal(
  canPerformAction('BACK_OFFICE', 'MANAGE_BCP'),
  true,
  'Back office debe poder operar envio y respuesta BCP'
);

console.log('Workflow tests OK');
