import { consultarRCC, cerrarSesionInfoburo } from './src/services/infoburo';

async function test() {
  console.log('=== Test Completo Infoburo ===\n');
  try {
    const r = await consultarRCC('47594477');
    console.log('Nombres:      ', r.nombres);
    console.log('Semáforo:     ', r.semaforo, '| Previo:', r.semaforoPrevio);
    console.log('Deuda Total:  ', `S/ ${r.deudaTotal}`);
    console.log('Documento:    ', r.documento);
    console.log('No Contactar: ', r.flagNoContactar);
    console.log('Info General: ', JSON.stringify(r.infoGeneral));
    console.log('RUC:          ', JSON.stringify(r.ruc));
    console.log(`Histórico:     ${r.historico.length} períodos`);
    if (r.historico.length > 0) console.log('  Último:', JSON.stringify(r.historico[0]));
    console.log(`Líneas Crédito: ${r.lineasCredito.length}`);
    if (r.lineasCredito.length > 0) console.log('  Primera:', JSON.stringify(r.lineasCredito[0]));
    console.log(`Detalle Deuda: ${r.detalleDeuda.length} entidades`);
    if (r.detalleDeuda.length > 0) console.log('  Primera:', JSON.stringify(r.detalleDeuda[0]));
    console.log(`Otros:         ${r.otros.length} registros`);
  } catch (e) { console.error('FALLO:', e); }
  finally { await cerrarSesionInfoburo(); }
}
test();
