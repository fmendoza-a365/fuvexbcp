// simulatorCalc.ts — Motor de cálculo del Simulador BCP Premium

export const TASA_DESGRAVAMEN_MENSUAL = 0.000767; // 0.0767%
export const TASA_DESGRAVAMEN_CON_RETORNO = 0.000997;
export const AJUSTE_CUOTA_CRONOGRAMA = 4;

export function calcTEM(tea: number): number {
  return Math.pow(1 + tea, 1 / 12) - 1;
}

export function calcFactorInteresMensualExcel(tea: number): number {
  const tna365 = (((1 + tea) ** (1 / 12) - 1) * 12) * 365 / 360;
  return (tna365 / 365) * 31;
}

export function getTasaDesgravamenMensual(tipo: string, modalidad: string): number {
  const normalizedTipo = String(tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const normalizedModalidad = String(modalidad || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (normalizedTipo.includes('ENDOSADO')) return 0;
  if (normalizedModalidad.includes('CON')) return TASA_DESGRAVAMEN_CON_RETORNO;
  return TASA_DESGRAVAMEN_MENSUAL;
}

export function calcCuotaFrancesa(monto: number, tem: number, n: number): number {
  if (tem === 0 || n === 0) return 0;
  return monto * tem / (1 - Math.pow(1 + tem, -n));
}

export function calcIND(
  ingresosFijos: number,
  promedioVariables: number,
  rci: number,
  descuentosLey: number,
  reserva: number,
  facultativos: number
): number {
  const totalIngresos = ingresosFijos + promedioVariables;
  const disponible = totalIngresos * rci;
  return disponible - descuentosLey - reserva - facultativos;
}

export function calcCEM(ind: number, totalCuotasExternas: number): number {
  return ind - totalCuotasExternas;
}

export interface CronogramaRow {
  nro: number | string;
  fecha: string;
  capital: string;
  interes: string;
  desgravamen: string;
  amortizacion: string;
  envioFisico: string;
  cuotaTotal: string;
  saldo: string;
}

export function generarCronograma(
  monto: number,
  factorInteresMensual: number,
  nCuotas: number,
  fechaDesembolso: Date,
  periodoGracia: number,
  envioFisicoCosto: number,
  tasaDesgravamenMensual: number = TASA_DESGRAVAMEN_MENSUAL,
  ajusteCuotaCronograma: number = AJUSTE_CUOTA_CRONOGRAMA
): { cronograma: CronogramaRow[]; totales: { interes: number; desgravamen: number; cuota: number } } {
  const factorDesgravamenMensual = (tasaDesgravamenMensual * 12 / 365) * 31;
  const factorTotalMensual = factorInteresMensual + factorDesgravamenMensual;
  const rows: CronogramaRow[] = [];
  let saldo = monto;
  let totalInteres = 0;
  let totalDesgravamen = 0;
  let totalCuota = 0;

  // Período de gracia (solo intereses + desgravamen)
  for (let g = 0; g < periodoGracia; g++) {
    const fechaCuota = new Date(fechaDesembolso);
    fechaCuota.setMonth(fechaCuota.getMonth() + g + 1);
    const interes = saldo * factorInteresMensual;
    const desgravamen = saldo * factorDesgravamenMensual;
    saldo += interes + desgravamen;
    totalInteres += interes;
    totalDesgravamen += desgravamen;
    rows.push({
      nro: `G${g + 1}`,
      fecha: fechaCuota.toLocaleDateString('es-PE'),
      capital: saldo.toFixed(2),
      interes: interes.toFixed(2),
      desgravamen: desgravamen.toFixed(2),
      amortizacion: '',
      envioFisico: '',
      cuotaTotal: '',
      saldo: saldo.toFixed(2),
    });
  }

  const capitalBaseCuota = saldo + (monto * factorDesgravamenMensual * periodoGracia);
  const cuotaPostGracia = calcCuotaFrancesa(capitalBaseCuota, factorTotalMensual, nCuotas) + ajusteCuotaCronograma;

  for (let i = 1; i <= nCuotas; i++) {
    const fechaCuota = new Date(fechaDesembolso);
    fechaCuota.setMonth(fechaCuota.getMonth() + periodoGracia + i);
    const interes = saldo * factorInteresMensual;
    const desgravamen = saldo * factorDesgravamenMensual;
    const amortizacion = cuotaPostGracia - interes - desgravamen;
    saldo = Math.max(0, saldo - amortizacion);
    const cuotaFinal = cuotaPostGracia + envioFisicoCosto;

    totalInteres += interes;
    totalDesgravamen += desgravamen;
    totalCuota += cuotaFinal;

    rows.push({
      nro: i,
      fecha: fechaCuota.toLocaleDateString('es-PE'),
      capital: (saldo + amortizacion).toFixed(2),
      interes: interes.toFixed(2),
      desgravamen: desgravamen.toFixed(2),
      amortizacion: amortizacion.toFixed(2),
      envioFisico: envioFisicoCosto.toFixed(2),
      cuotaTotal: cuotaFinal.toFixed(2),
      saldo: saldo.toFixed(2),
    });
  }

  return {
    cronograma: rows,
    totales: { interes: totalInteres, desgravamen: totalDesgravamen, cuota: totalCuota }
  };
}

export function calcTCEA(monto: number, cuotaTotal: number, nCuotas: number): number {
  // Aproximación TCEA via TIR simplificada
  if (monto <= 0 || cuotaTotal <= 0 || nCuotas <= 0) return 0;
  let tirMensual = cuotaTotal / monto;
  for (let iter = 0; iter < 100; iter++) {
    let f = -monto;
    let df = 0;
    for (let t = 1; t <= nCuotas; t++) {
      const disc = Math.pow(1 + tirMensual, -t);
      f += cuotaTotal * disc;
      df -= t * cuotaTotal * disc / (1 + tirMensual);
    }
    const adj = f / df;
    tirMensual -= adj;
    if (Math.abs(adj) < 1e-10) break;
  }
  return Math.pow(1 + tirMensual, 12) - 1;
}

export function fmt(n: number): string {
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
