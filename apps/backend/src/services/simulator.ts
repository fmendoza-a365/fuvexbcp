import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DebtInput {
  tipo?: string;
  key?: string;
  bcp?: number | string;
  noBcp?: number | string;
  saldo?: number | string;
  saldoAct?: number | string;
  saldoActualizado?: number | string;
  cuotaAct?: number | string;
  cuotaActualizada?: number | string;
}

export interface SimulationParams {
  convenioId: string;
  cargoId: string;
  edad?: number;
  ingresosFijos: number;
  ingresosVariables: number;
  promedioVariables?: number;
  otrosIngresosFijos?: number;
  ingresosNoConstantes?: number;
  descuentosLey: number;
  otrosDescuentos: number;
  reserva?: number;
  facultativos?: number;
  montoSolicitado: number;
  cuotas: number;
  envioFisico: boolean;
  teaManual?: number;
  periodoGracia?: number;
  fechaDesembolso?: string;
  seguroDesgravamenTipo?: string;
  seguroDesgravamenModalidad?: string;
  cargaCrediticia?: DebtInput[];
  deudaHipotecario?: number;
  deudaEfectivo?: number;
  deudaVehicular?: number;
  deudaPyme?: number;
  deudaComercial?: number;
  deudaIndirecta?: number;
  lineaUtilizadaTC?: number;
  lineaNoUtilizadaTC?: number;
}

const DESGRAVAMEN_SIN_RETORNO = 0.000767;
const DESGRAVAMEN_CON_RETORNO = 0.000997;
const AJUSTE_CUOTA_CRONOGRAMA = 0;
const DIA_VENCIMIENTO_DEFAULT = 15;
const MESES_PRIMER_VENCIMIENTO = 3;

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: any) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .trim();

const getTasaDesgravamenMensual = (tipo?: string, modalidad?: string) => {
  const tipoNormalizado = normalizeText(tipo);
  const modalidadNormalizada = normalizeText(modalidad);

  if (tipoNormalizado.includes('ENDOSADO')) return 0;
  if (modalidadNormalizada.includes('CON')) return DESGRAVAMEN_CON_RETORNO;
  return DESGRAVAMEN_SIN_RETORNO;
};

const pmt = (rate: number, periods: number, principal: number) => {
  if (periods <= 0) return 0;
  if (rate === 0) return principal / periods;
  return principal * (rate * Math.pow(1 + rate, periods)) / (Math.pow(1 + rate, periods) - 1);
};

const irr = (cashflows: number[]) => {
  let rate = 0.02;
  for (let iter = 0; iter < 100; iter += 1) {
    let value = 0;
    let derivative = 0;

    for (let period = 0; period < cashflows.length; period += 1) {
      value += cashflows[period] / Math.pow(1 + rate, period);
      if (period > 0) {
        derivative -= (period * cashflows[period]) / Math.pow(1 + rate, period + 1);
      }
    }

    if (Math.abs(derivative) < 1e-12) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  return rate;
};

const addMonthsFixedDay = (date: Date, months: number, day = DIA_VENCIMIENTO_DEFAULT) => {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDayOfMonth));
  return next;
};

const getPrimerVencimiento = (fechaDesembolso: Date) => (
  addMonthsFixedDay(fechaDesembolso, MESES_PRIMER_VENCIMIENTO, DIA_VENCIMIENTO_DEFAULT)
);

const getDebtKey = (debt: DebtInput) => {
  const raw = normalizeText(debt.key || debt.tipo);
  if (raw.includes('HIPOTEC')) return 'hipotecario';
  if (raw.includes('EFECTIVO') || raw.includes('CEF')) return 'efectivo';
  if (raw.includes('VEHIC')) return 'vehicular';
  if (raw.includes('PYME')) return 'pyme';
  if (raw.includes('COMERCIAL')) return 'comercial';
  if (raw.includes('INDIRECTA')) return 'indirecta';
  if (raw.includes('NO UTILIZADA')) return 'linea_no_utilizada';
  if (raw.includes('UTILIZADA') || raw.includes('TARJETA')) return 'linea_utilizada';
  return raw.toLowerCase();
};

const ratioFactors: Record<string, number> = {
  hipotecario: 0.01,
  efectivo: 0,
  vehicular: 0.035,
  pyme: 0.022,
  comercial: 0,
  indirecta: 0.0006944,
  linea_utilizada: 0.078,
  linea_no_utilizada: 0.003306,
};

const cemFactors: Record<string, number> = {
  hipotecario: 0.011,
  efectivo: 0.044,
  vehicular: 0.024,
  pyme: 0.088,
  comercial: 0.028,
  indirecta: 0.000694,
  linea_utilizada: 0.007417,
  linea_no_utilizada: 0.007417,
};

const legacyDebtRows = (params: SimulationParams): DebtInput[] => [
  { key: 'hipotecario', noBcp: params.deudaHipotecario },
  { key: 'efectivo', noBcp: params.deudaEfectivo },
  { key: 'vehicular', noBcp: params.deudaVehicular },
  { key: 'pyme', noBcp: params.deudaPyme },
  { key: 'comercial', noBcp: params.deudaComercial },
  { key: 'indirecta', noBcp: params.deudaIndirecta },
  { key: 'linea_utilizada', noBcp: params.lineaUtilizadaTC },
  { key: 'linea_no_utilizada', saldoAct: params.lineaNoUtilizadaTC },
];

const calcularCargaCrediticia = (params: SimulationParams) => {
  const rows = params.cargaCrediticia?.length ? params.cargaCrediticia : legacyDebtRows(params);
  let totalParaRatio = 0;
  let totalParaCem = 0;

  for (const row of rows) {
    const key = getDebtKey(row);
    const bcp = toNumber(row.bcp);
    const noBcp = toNumber(row.noBcp);
    const saldoActualizado = toNumber(row.saldoAct ?? row.saldoActualizado);
    const cuotaActualizada = toNumber(row.cuotaAct ?? row.cuotaActualizada);
    const ratioFactor = ratioFactors[key] ?? 0;
    const cemFactor = cemFactors[key] ?? ratioFactor;
    const deudaNoBcpCem = noBcp || cuotaActualizada || (saldoActualizado * cemFactor);

    totalParaRatio += bcp + noBcp + (saldoActualizado * ratioFactor);
    totalParaCem += bcp + deudaNoBcpCem;
  }

  return { totalParaRatio, totalParaCem };
};

export async function calcularSimulacion(params: SimulationParams) {
  const convenio = await prisma.convenio.findUnique({ where: { id: params.convenioId } });
  const cargo = await prisma.cargo.findUnique({ where: { id: params.cargoId } });

  if (!convenio || !cargo) throw new Error('Convenio o cargo invalido');

  const regla = await prisma.convenioCargoRegla.findUnique({
    where: { convenio_id_cargo_id: { convenio_id: convenio.id, cargo_id: cargo.id } }
  });

  let rci = regla ? regla.rci_especifico : convenio.rci_default;
  if (convenio.nombre === 'RENIEC' && cargo.nombre === 'CAS Indeterminado') rci = 0.45;
  if (convenio.nombre.includes('DIRIS') && cargo.nombre === 'CAS Indeterminado') rci = 0.40;
  if (convenio.nombre === 'Policia_Nacional_del_Perú' && cargo.nombre === 'Sub Oficial de Tercera') rci = 0.40;

  const convenios65 = [
    'Marina_de_Guerra',
    'Ejército_del_Perú',
    'Policia_Nacional_del_Perú',
    'DIRIS_Lima_Norte',
    'Hospital_de_apoyo_Iquitos',
    'DIRIS_Lima_Centro',
    'UE403_Morropon',
    'Fuerza_Aerea_del_Perú',
    'Red_Salud_APLAO'
  ];
  const maxEndeudamiento = convenios65.includes(convenio.nombre) ? 0.65 : (convenio.nombre === 'UTES_N6' ? 0.70 : 0.50);

  const confCostoEnvio = await prisma.configuracionGlobal.findUnique({ where: { clave: 'COSTO_ENVIO_FISICO' } });
  const costoEnvio = confCostoEnvio?.valor_numerico || 10;
  const confTea = await prisma.configuracionGlobal.findUnique({ where: { clave: 'TEA_DEFAULT' } });
  const tea = params.teaManual || confTea?.valor_numerico || 0.1099;
  const tasaDesgravamenMensual = getTasaDesgravamenMensual(
    params.seguroDesgravamenTipo,
    params.seguroDesgravamenModalidad
  );

  const ingresoVariableMensual = toNumber(params.ingresosVariables);
  const promedioVariables = toNumber(params.promedioVariables);
  const otrosIngresosFijos = toNumber(params.otrosIngresosFijos);
  const ingresosNoConstantes = toNumber(params.ingresosNoConstantes);
  const descuentosLey = toNumber(params.descuentosLey);
  const reserva = params.reserva !== undefined ? toNumber(params.reserva) : (convenio.variables_reserva || 0);
  const facultativos = params.facultativos !== undefined ? toNumber(params.facultativos) : toNumber(params.otrosDescuentos);

  const disponibleAntesReserva = convenio.nombre === 'U_San_Juan_Bautista'
    ? params.ingresosFijos * rci
    : (
      params.ingresosFijos -
      ingresoVariableMensual +
      (promedioVariables * 0.5) +
      otrosIngresosFijos -
      ingresosNoConstantes -
      descuentosLey
    ) * rci;
  const ingresoNetoDisponible = disponibleAntesReserva - reserva - facultativos;

  const deuda = calcularCargaCrediticia(params);
  const baseEndeudamiento = params.ingresosFijos + otrosIngresosFijos - ingresosNoConstantes - descuentosLey - facultativos;
  const endeudamientoActual = baseEndeudamiento > 0 ? deuda.totalParaRatio / baseEndeudamiento : Infinity;
  const baseCem = (
    params.ingresosFijos -
    ingresoVariableMensual +
    promedioVariables +
    otrosIngresosFijos -
    ingresosNoConstantes -
    descuentosLey -
    facultativos
  );

  const periodoGracia = Math.max(0, toNumber(params.periodoGracia, convenio.periodo_gracia || 0));
  const cuotas = Math.max(0, toNumber(params.cuotas));
  const montoSolicitado = toNumber(params.montoSolicitado);
  if (cuotas <= 0) throw new Error('El plazo debe ser mayor a cero');
  if (montoSolicitado <= 0) throw new Error('El monto solicitado debe ser mayor a cero');

  const tna365 = (((1 + tea) ** (1 / 12) - 1) * 12) * 365 / 360;
  const factorInteresMensual = (tna365 / 365) * 31;
  const factorDesgravamenMensual = ((tasaDesgravamenMensual * 12) / 365) * 31;
  const factorMensualTotal = factorInteresMensual + factorDesgravamenMensual;
  const capitalFinanciado = montoSolicitado * Math.pow(1 + factorMensualTotal, periodoGracia);
  const capitalBaseCuota = capitalFinanciado + (montoSolicitado * factorDesgravamenMensual * periodoGracia);

  let cuotaFija = pmt(factorMensualTotal, cuotas, capitalBaseCuota) + AJUSTE_CUOTA_CRONOGRAMA;
  cuotaFija = Math.round(cuotaFija * 100) / 100;

  const cronograma: any[] = [];
  const startDate = params.fechaDesembolso ? new Date(`${params.fechaDesembolso}T00:00:00`) : new Date();
  const primerVencimiento = getPrimerVencimiento(startDate);
  let saldoRemanente = montoSolicitado;
  let totalInteres = 0;
  let totalDesgravamen = 0;
  let totalEnvio = 0;

  for (let mes = 1; mes <= periodoGracia; mes += 1) {
    const fechaCuota = addMonthsFixedDay(primerVencimiento, mes - periodoGracia - 1);
    const interes = saldoRemanente * factorInteresMensual;
    const desgravamen = saldoRemanente * factorDesgravamenMensual;
    const capital = saldoRemanente;
    saldoRemanente += interes + desgravamen;
    totalInteres += interes;
    totalDesgravamen += desgravamen;

    cronograma.push({
      nro: `G${mes}`,
      fecha: fechaCuota.toLocaleDateString('es-PE'),
      capital: Math.round(capital * 100) / 100,
      interes: Math.round(interes * 100) / 100,
      desgravamen: Math.round(desgravamen * 100) / 100,
      amortizacion: 0,
      envioFisico: 0,
      cuotaBase: 0,
      cuotaTotal: 0,
      saldo: Math.round(saldoRemanente * 100) / 100
    });
  }

  for (let mes = 1; mes <= cuotas; mes += 1) {
    const fechaCuota = addMonthsFixedDay(primerVencimiento, mes - 1);
    const interes = saldoRemanente * factorInteresMensual;
    const desgravamen = saldoRemanente * factorDesgravamenMensual;
    const amortizacion = cuotaFija - interes - desgravamen;
    const costoEnvioMes = params.envioFisico ? costoEnvio : 0;
    const cuotaTotal = cuotaFija + costoEnvioMes;

    totalInteres += interes;
    totalDesgravamen += desgravamen;
    totalEnvio += costoEnvioMes;

    cronograma.push({
      nro: mes,
      fecha: fechaCuota.toLocaleDateString('es-PE'),
      capital: Math.round(saldoRemanente * 100) / 100,
      interes: Math.round(interes * 100) / 100,
      desgravamen: Math.round(desgravamen * 100) / 100,
      amortizacion: Math.round(amortizacion * 100) / 100,
      envioFisico: costoEnvioMes,
      cuotaBase: Math.round(cuotaFija * 100) / 100,
      cuotaTotal: Math.round(cuotaTotal * 100) / 100,
      saldo: Math.max(0, Math.round((saldoRemanente - amortizacion) * 100) / 100)
    });

    saldoRemanente -= amortizacion;
  }

  const cem = (baseCem * maxEndeudamiento) - deuda.totalParaCem;
  const cuotaMensualTotal = cuotaFija + (params.envioFisico ? costoEnvio : 0);
  const endeudamientoConCuota = baseEndeudamiento > 0
    ? (deuda.totalParaRatio + cuotaMensualTotal) / baseEndeudamiento
    : Infinity;
  const dictamen = endeudamientoActual <= maxEndeudamiento
    ? 'CONTINUAR'
    : 'SOBRE-ENDEUDADO';
  const monthlyIrr = irr([-montoSolicitado, ...Array(cuotas).fill(cuotaMensualTotal)]);

  return {
    resumen: {
      monto_solicitado: montoSolicitado,
      cuotas,
      plazo: cuotas,
      tea,
      tcea: Math.pow(1 + monthlyIrr, 12) - 1,
      cuota_mensual: cuotaMensualTotal,
      capacidad_maxima: Math.round(cem * 100) / 100,
      ingreso_neto_disponible: Math.round(ingresoNetoDisponible * 100) / 100,
      endeudamiento_actual: Math.round(endeudamientoActual * 10000) / 100,
      endeudamiento_final: Math.round(endeudamientoConCuota * 10000) / 100,
      rci_aplicado: rci,
      periodo_gracia: periodoGracia,
      primer_vencimiento: primerVencimiento.toLocaleDateString('es-PE'),
      tasa_desgravamen_mensual: tasaDesgravamenMensual,
      tipo_seguro_desgravamen: params.seguroDesgravamenTipo || 'Individual',
      modalidad_seguro_desgravamen: params.seguroDesgravamenModalidad || 'Sin Retorno',
      total_pagar: Math.round((cuotaMensualTotal * cuotas) * 100) / 100,
      totales_tabla: {
        interes: Math.round(totalInteres * 100) / 100,
        desgravamen: Math.round(totalDesgravamen * 100) / 100,
        amortizacion: montoSolicitado,
        envio: Math.round(totalEnvio * 100) / 100
      },
      dictamen
    },
    validaciones: {
      rci_valido: cuotaMensualTotal <= ingresoNetoDisponible,
      cem_valido: cuotaMensualTotal <= cem,
      endeudamiento_valido: endeudamientoActual <= maxEndeudamiento
    },
    cronograma
  };
}
