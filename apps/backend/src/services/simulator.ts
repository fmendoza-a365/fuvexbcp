import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SimulationParams {
  convenioId: string;
  cargoId: string;
  edad?: number;
  ingresosFijos: number;
  ingresosVariables: number;
  descuentosLey: number;
  otrosDescuentos: number;
  montoSolicitado: number;
  cuotas: number;
  envioFisico: boolean;
  teaManual?: number;
  periodoGracia?: number;
  // Nuevos campos de Deuda (Carátula)
  deudaHipotecario?: number;
  deudaEfectivo?: number;
  deudaVehicular?: number;
  deudaPyme?: number;
  deudaComercial?: number;
  deudaIndirecta?: number;
  lineaUtilizadaTC?: number;
  lineaNoUtilizadaTC?: number;
}

export async function calcularSimulacion(params: SimulationParams) {
  const convenio = await prisma.convenio.findUnique({ where: { id: params.convenioId } });
  const cargo = await prisma.cargo.findUnique({ where: { id: params.cargoId } });
  
  if (!convenio || !cargo) throw new Error('Convenio o cargo inválido');

  const regla = await prisma.convenioCargoRegla.findUnique({
    where: { convenio_id_cargo_id: { convenio_id: convenio.id, cargo_id: cargo.id } }
  });

  // 1. RCI Dinámico (Excel L11-L14)
  let rci = regla ? regla.rci_especifico : convenio.rci_default;
  if (convenio.nombre === 'RENIEC' && cargo.nombre === 'CAS Indeterminado') rci = 0.45;
  if (convenio.nombre.includes('DIRIS') && cargo.nombre === 'CAS Indeterminado') rci = 0.40;
  if (convenio.nombre === 'Policia_Nacional_del_Perú' && cargo.nombre === 'Sub Oficial de Tercera') rci = 0.40;

  // 2. Límites de Endeudamiento (Excel J60/K60)
  const convenios65 = ['Marina_de_Guerra', 'Ejército_del_Perú', 'Policia_Nacional_del_Perú', 'DIRIS_Lima_Norte', 'Hospital_de_apoyo_Iquitos', 'DIRIS_Lima_Centro', 'UE403_Morropon', 'Fuerza_Aerea_del_Perú', 'Red_Salud_APLAO'];
  const maxEndeudamiento = convenios65.includes(convenio.nombre) ? 0.65 : (convenio.nombre === 'UTES_N6' ? 0.70 : 0.50);

  // 3. Variables Globales
  const confCostoEnvio = await prisma.configuracionGlobal.findUnique({ where: { clave: 'COSTO_ENVIO_FISICO' } });
  const costoEnvio = confCostoEnvio?.valor_numerico || 10.0;
  const confTea = await prisma.configuracionGlobal.findUnique({ where: { clave: 'TEA_DEFAULT' } });
  const tea = params.teaManual || confTea?.valor_numerico || 0.1099;
  const tasaDesgravamenMensual = 0.000767; // 0.0767% del Excel

  // 4. Capacidad Base (CEM)
  const ingresosTotales = params.ingresosFijos + (params.ingresosVariables * 0.5); // Excel aplica 0.5 a variables en algunas celdas
  const descuentosFijos = params.descuentosLey + params.otrosDescuentos;
  const ingresoNeto = ingresosTotales - descuentosFijos;
  
  // Disponible Base = (Ingreso Neto * RCI) - Reserva
  const reserva = convenio.variables_reserva || 0;
  const disponibleBase = (ingresoNeto * rci) - reserva;

  // 5. Carga Crediticia (Deudas Externas)
  const dHipo = params.deudaHipotecario || 0;
  const dEfec = params.deudaEfectivo || 0;
  const dVeh = params.deudaVehicular || 0;
  const dPyme = params.deudaPyme || 0;
  const dCom = params.deudaComercial || 0;
  const dInd = params.deudaIndirecta || 0;
  const lineUtil = params.lineaUtilizadaTC || 0;
  const lineNoUtil = params.lineaNoUtilizadaTC || 0;

  // Cálculo de Carga Mensual (Excel K57 simplified)
  const cargaMensualActual = dHipo + dEfec + dVeh + dPyme + dCom + dInd + lineUtil + (lineNoUtil * 0.028);

  // 6. Cronograma
  const pg = params.periodoGracia || 0;
  const saldo = params.montoSolicitado;
  const i = (((1 + tea) ** (1 / 12) - 1) * 12) * 365 / 360 / 12;
  const n = params.cuotas;
  if (n <= pg) {
    throw new Error('El plazo debe ser mayor que el periodo de gracia');
  }
  const iTotal = i + tasaDesgravamenMensual;
  
  // Ajuste de cuota para amortización posterior a la gracia
  const nAmortizacion = n - pg;
  let cuotaFija = saldo * (iTotal * Math.pow(1 + iTotal, nAmortizacion)) / (Math.pow(1 + iTotal, nAmortizacion) - 1);
  cuotaFija = Math.round(cuotaFija * 100) / 100;

  // 7. Generar Cronograma detallado
  const cronograma: any[] = [];
  let saldoRemanente = saldo;
  const startDate = new Date();
  
  let totalInteres = 0;
  let totalDesgravamen = 0;
  let totalEnvio = 0;

  for (let mes = 1; mes <= n; mes++) {
    const fechaCuota = new Date(startDate);
    fechaCuota.setMonth(startDate.getMonth() + mes);
    
    const interes = saldoRemanente * i;
    const desgravamen = saldoRemanente * tasaDesgravamenMensual;
    const costoEnvioMes = params.envioFisico ? costoEnvio : 0;
    
    let amortizacion = 0;
    let cuotaBase = cuotaFija;

    if (mes <= pg) {
      cuotaBase = interes + desgravamen;
      amortizacion = 0;
    } else {
      amortizacion = cuotaFija - interes - desgravamen;
    }
    
    const cuotaTotal = cuotaBase + costoEnvioMes;
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
      cuotaBase: Math.round(cuotaBase * 100) / 100,
      cuotaTotal: Math.round(cuotaTotal * 100) / 100,
      saldo: Math.max(0, Math.round((saldoRemanente - amortizacion) * 100) / 100)
    });

    saldoRemanente -= amortizacion;
  }

  // 8. Resultados Finales (CEM y Dictamen)
  const cem = (ingresoNeto * maxEndeudamiento) - cargaMensualActual;
  const endeudamientoFinal = ingresoNeto > 0 ? (cargaMensualActual + cuotaFija) / ingresoNeto : Infinity;
  const dictamen = endeudamientoFinal <= maxEndeudamiento ? 'CONTINUAR' : 'SOBRE-ENDEUDADO';
  const cuotaMensualTotal = cuotaFija + (params.envioFisico ? costoEnvio : 0);

  return {
    resumen: {
      monto_solicitado: params.montoSolicitado,
      cuotas: params.cuotas,
      plazo: params.cuotas,
      tea: tea,
      tcea: tea + 0.02, // Simplificado: TEA + Seguros aprox
      cuota_mensual: cuotaMensualTotal,
      capacidad_maxima: Math.round(cem * 100) / 100,
      ingreso_neto_disponible: Math.round(ingresoNeto * 100) / 100,
      endeudamiento_final: Math.round(endeudamientoFinal * 10000) / 100,
      total_pagar: Math.round((params.montoSolicitado + totalInteres + totalDesgravamen + totalEnvio) * 100) / 100,
      totales_tabla: {
        interes: Math.round(totalInteres * 100) / 100,
        desgravamen: Math.round(totalDesgravamen * 100) / 100,
        amortizacion: params.montoSolicitado,
        envio: Math.round(totalEnvio * 100) / 100
      },
      dictamen
    },
    validaciones: {
      rci_valido: cuotaMensualTotal <= disponibleBase,
      cem_valido: cuotaMensualTotal <= cem,
      endeudamiento_valido: endeudamientoFinal <= maxEndeudamiento
    },
    cronograma
  };
}
