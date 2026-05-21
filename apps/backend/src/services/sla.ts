import { EstadoOperativo, VALID_ESTADOS } from '../middleware/validate';

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

type SlaOwner = 'VENTA' | 'BACK_OFFICE' | 'JEFATURA' | 'OPERACIONES';

export type SlaLevel = 'OK' | 'POR_VENCER' | 'VENCIDO' | 'CRITICO' | 'SIN_SLA';

interface SlaRule {
  dias: number;
  responsable: SlaOwner;
  siguiente_accion: string;
}

export interface SlaInfo {
  estado: string;
  dias_en_estado: number;
  dias_en_estado_decimal: number;
  horas_en_estado: number;
  sla_dias: number | null;
  sla_responsable: SlaOwner | null;
  dias_restantes: number | null;
  progreso_pct: number | null;
  nivel: SlaLevel;
  vencido: boolean;
  siguiente_accion: string | null;
}

export const SLA_RULES: Partial<Record<EstadoOperativo, SlaRule>> = {
  PROSPECTO_NUEVO: {
    dias: 1,
    responsable: 'VENTA',
    siguiente_accion: 'Iniciar verificacion del cliente'
  },
  VERIFICACION_SISTEMA: {
    dias: 1,
    responsable: 'OPERACIONES',
    siguiente_accion: 'Validar deudas del cliente y conyuge si aplica'
  },
  SCORE_BCP: {
    dias: 1,
    responsable: 'OPERACIONES',
    siguiente_accion: 'Registrar resultado de score BCP'
  },
  PENDIENTE_BOLETA: {
    dias: 2,
    responsable: 'VENTA',
    siguiente_accion: 'Solicitar y cargar boleta del cliente'
  },
  EVALUACION_CALCULADORA: {
    dias: 1,
    responsable: 'VENTA',
    siguiente_accion: 'Evaluar boleta en calculadora'
  },
  COTIZACION_ENVIADA: {
    dias: 2,
    responsable: 'VENTA',
    siguiente_accion: 'Dar seguimiento a la cotizacion'
  },
  PENDIENTE_ACEPTACION_CLIENTE: {
    dias: 2,
    responsable: 'VENTA',
    siguiente_accion: 'Confirmar aceptacion del cliente'
  },
  PENDIENTE_DATOS_FILE: {
    dias: 3,
    responsable: 'VENTA',
    siguiente_accion: 'Completar datos, DNI, boleta y documentos del file'
  },
  VALIDACION_BACK_OFFICE: {
    dias: 2,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Validar documentos y datos del expediente'
  },
  OBS_BACK_OFFICE: {
    dias: 2,
    responsable: 'VENTA',
    siguiente_accion: 'Subsanar observacion de back office'
  },
  FILE_VALIDADO: {
    dias: 1,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Enviar file al BCP para remesa'
  },
  ENVIADO_BCP_REMESA: {
    dias: 3,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Dar seguimiento a aprobacion de remesa BCP'
  },
  OBS_BCP: {
    dias: 2,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Subsanar observacion BCP'
  },
  REMESA_APROBADA: {
    dias: 1,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Definir desembolso o compra de deuda'
  },
  REMESA_REDUCIDA: {
    dias: 1,
    responsable: 'VENTA',
    siguiente_accion: 'Confirmar si cliente acepta nuevo monto'
  },
  PENDIENTE_ACEPTACION_REMESA: {
    dias: 1,
    responsable: 'VENTA',
    siguiente_accion: 'Registrar aceptacion o desistimiento por remesa reducida'
  },
  PENDIENTE_DESEMBOLSO: {
    dias: 2,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Confirmar desembolso BCP'
  },
  PENDIENTE_CARTA_PODER: {
    dias: 2,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Esperar carta poder para compra de deuda'
  },
  REENVIADO_BCP_COMPRA_DEUDA: {
    dias: 2,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Dar seguimiento a compra de deuda con BCP'
  },
  PENDIENTE_CARTA_NO_ADEUDO: {
    dias: 3,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Validar carta de no adeudo'
  },
  PENDIENTE_LIBERACION: {
    dias: 3,
    responsable: 'BACK_OFFICE',
    siguiente_accion: 'Confirmar liberacion de compra de deuda'
  },
  PENDIENTE_REASIGNACION: {
    dias: 1,
    responsable: 'JEFATURA',
    siguiente_accion: 'Resolver solicitud de reasignacion'
  }
};

const ACTIVE_STATE_SET = new Set(Object.keys(SLA_RULES));

const roundOne = (value: number) => Math.round(value * 10) / 10;

const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
);

export const getSlaRule = (estado: string) => (
  SLA_RULES[estado as EstadoOperativo] || null
);

export const getSlaInfo = (estado: string, inicioEstado?: Date | string | null, now = new Date()): SlaInfo => {
  const start = inicioEstado ? new Date(inicioEstado) : now;
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const horas = Math.floor(diffMs / HOUR_MS);
  const diasDecimal = roundOne(diffMs / DAY_MS);
  const dias = Math.floor(diffMs / DAY_MS);
  const rule = getSlaRule(estado);

  if (!rule) {
    return {
      estado,
      dias_en_estado: dias,
      dias_en_estado_decimal: diasDecimal,
      horas_en_estado: horas,
      sla_dias: null,
      sla_responsable: null,
      dias_restantes: null,
      progreso_pct: null,
      nivel: 'SIN_SLA',
      vencido: false,
      siguiente_accion: null
    };
  }

  const progreso = (diffMs / DAY_MS / rule.dias) * 100;
  const nivel: SlaLevel = progreso >= 200
    ? 'CRITICO'
    : progreso >= 100
      ? 'VENCIDO'
      : progreso >= 75
        ? 'POR_VENCER'
        : 'OK';

  return {
    estado,
    dias_en_estado: dias,
    dias_en_estado_decimal: diasDecimal,
    horas_en_estado: horas,
    sla_dias: rule.dias,
    sla_responsable: rule.responsable,
    dias_restantes: Math.ceil(rule.dias - (diffMs / DAY_MS)),
    progreso_pct: roundOne(clamp(progreso, 0, 999)),
    nivel,
    vencido: progreso >= 100,
    siguiente_accion: rule.siguiente_accion
  };
};

interface SlaSale {
  id: string;
  estado: string;
  fecha_estado_desde?: Date | string | null;
  created_at?: Date | string | null;
  nombres_cliente?: string | null;
  maf_neto?: number | null;
  asesor?: { nombre?: string | null; username?: string | null } | null;
}

export const buildSlaSnapshot = (sales: SlaSale[], now = new Date()) => {
  const expedientes = sales
    .map((sale) => {
      const sla = getSlaInfo(sale.estado, sale.fecha_estado_desde || sale.created_at || now, now);
      return {
        sale_id: sale.id,
        cliente: sale.nombres_cliente || 'Sin nombre',
        asesor: sale.asesor?.nombre || sale.asesor?.username || 'Sin asesor',
        monto: Number(sale.maf_neto || 0),
        ...sla
      };
    })
    .filter((item) => item.nivel !== 'SIN_SLA')
    .sort((a, b) => {
      const aProgress = a.progreso_pct || 0;
      const bProgress = b.progreso_pct || 0;
      return bProgress - aProgress || b.dias_en_estado_decimal - a.dias_en_estado_decimal;
    });

  const byNivel = expedientes.reduce<Record<SlaLevel, number>>((acc, item) => {
    acc[item.nivel] = (acc[item.nivel] || 0) + 1;
    return acc;
  }, { OK: 0, POR_VENCER: 0, VENCIDO: 0, CRITICO: 0, SIN_SLA: 0 });

  const byResponsable = expedientes.reduce<Record<string, number>>((acc, item) => {
    const key = item.sla_responsable || 'SIN_RESPONSABLE';
    if (item.vencido || item.nivel === 'POR_VENCER') {
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    total_monitoreados: expedientes.length,
    ok: byNivel.OK || 0,
    por_vencer: byNivel.POR_VENCER || 0,
    vencidos: (byNivel.VENCIDO || 0) + (byNivel.CRITICO || 0),
    criticos: byNivel.CRITICO || 0,
    por_responsable: byResponsable,
    expedientes
  };
};

export const assertSlaRulesAreValid = () => {
  const valid = new Set<string>(VALID_ESTADOS);
  for (const estado of ACTIVE_STATE_SET) {
    if (!valid.has(estado)) {
      throw new Error(`SLA contiene estado no valido: ${estado}`);
    }
  }
};
