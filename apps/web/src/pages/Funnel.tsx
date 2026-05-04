import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, Filter, TrendingDown, Users, DollarSign, Percent } from 'lucide-react';

interface FunnelStage {
  etapa: string;
  label: string;
  cantidad: number;
  monto_total: number;
  porcentaje_del_total: number;
  tasa_conversion_desde_anterior: number;
  sub_estados: { estado: string; cantidad: number; monto: number }[];
}

interface FunnelData {
  total_expedientes: number;
  funnel: FunnelStage[];
  conversion_global: number;
}

interface ApiFunnelStage {
  etapa?: string;
  cantidad?: number;
  monto_total?: number;
  tasa_entrada_pct?: number;
  tasa_conversion_pct?: number;
  estados_detalle?: Record<string, { cantidad?: number; monto?: number }>;
}

interface ApiFunnelResponse {
  funnel?: ApiFunnelStage[];
  resumen?: {
    total_expedientes?: number;
    conversion_global_pct?: number;
  };
}

const STAGE_COLORS = [
  { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  { bg: 'from-indigo-500 to-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  { bg: 'from-purple-500 to-purple-600', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  { bg: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
  { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
];

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeFunnelData = (payload: ApiFunnelResponse): FunnelData => ({
  total_expedientes: toNumber(payload.resumen?.total_expedientes),
  conversion_global: toNumber(payload.resumen?.conversion_global_pct),
  funnel: (payload.funnel ?? []).map((stage) => ({
    etapa: stage.etapa ?? 'Sin etapa',
    label: stage.etapa ?? 'Sin etapa',
    cantidad: toNumber(stage.cantidad),
    monto_total: toNumber(stage.monto_total),
    porcentaje_del_total: toNumber(stage.tasa_entrada_pct),
    tasa_conversion_desde_anterior: toNumber(stage.tasa_conversion_pct),
    sub_estados: Object.entries(stage.estados_detalle ?? {}).map(([estado, detalle]) => ({
      estado,
      cantidad: toNumber(detalle?.cantidad),
      monto: toNumber(detalle?.monto)
    }))
  }))
});

const FunnelPage = () => {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fecha_inicio: '', fecha_fin: '', convenio: '' });
  const [showFilters, setShowFilters] = useState(false);

  const fetchFunnel = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
      if (filters.convenio) params.append('convenio', filters.convenio);

      const res = await axios.get(`/api/analytics/funnel?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(normalizeFunnelData(res.data));
    } catch (error) {
      console.error('Error fetching funnel:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFunnel(); }, []);

  const maxCantidad = data ? Math.max(...data.funnel.map(s => s.cantidad), 1) : 1;

  const exportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
      if (filters.convenio) params.append('convenio', filters.convenio);

      const res = await axios.get(`/api/analytics/export/excel?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `funnel_fuvex_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exportando:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-bcp-blue)]"></div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800">Funnel de Conversión</h1>
          <p className="text-xs font-bold text-text-700 uppercase tracking-widest mt-1">Pirámide de etapas del pipeline</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowFilters(!showFilters)} className="action-button-secondary">
            <Filter size={16} /> Filtros
          </button>
          <button onClick={exportExcel} className="action-button-secondary text-emerald-700">
            <Download size={16} /> Excel
          </button>
          <button onClick={fetchFunnel} className="action-button-primary">
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filter-panel grid-cols-1 sm:grid-cols-3">
          <div>
            <label className="field-label">Fecha Inicio</label>
            <input type="date" value={filters.fecha_inicio} onChange={e => setFilters({ ...filters, fecha_inicio: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">Fecha Fin</label>
            <input type="date" value={filters.fecha_fin} onChange={e => setFilters({ ...filters, fecha_fin: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">Convenio</label>
            <input value={filters.convenio} onChange={e => setFilters({ ...filters, convenio: e.target.value })} placeholder="Ej: INTERBANK" className="field-input" />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button onClick={fetchFunnel} className="action-button-primary">
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Global Conversion KPI */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="metric-card">
            <div className="icon-badge bg-blue-50">
              <Users size={24} className="text-blue-500" />
            </div>
            <div>
              <div className="stat-label">Total Expedientes</div>
              <div className="stat-value">{data.total_expedientes}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="icon-badge bg-emerald-50">
              <DollarSign size={24} className="text-emerald-500" />
            </div>
            <div>
              <div className="stat-label">Monto Total</div>
              <div className="stat-value">S/ {data.funnel.reduce((acc, s) => acc + s.monto_total, 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="icon-badge bg-[rgba(255,120,0,0.1)]">
              <Percent size={24} className="text-[var(--color-bcp-orange)]" />
            </div>
            <div>
              <div className="text-[10px] font-black text-text-700 uppercase tracking-widest">Conversión Global</div>
              <div className="stat-value text-[var(--color-bcp-orange)]">{data.conversion_global.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Funnel Visualization */}
      {data && (
        <div className="premium-card">
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 mb-6">Embudo de Conversión</h2>
          <div className="space-y-3">
            {data.funnel.map((stage, idx) => {
              const colors = STAGE_COLORS[idx % STAGE_COLORS.length];
              const widthPercent = maxCantidad > 0 ? Math.max((stage.cantidad / maxCantidad) * 100, 15) : 15;
              
              return (
                <div key={stage.etapa} className="flex items-center gap-4">
                  {/* Label */}
                  <div className="w-48 flex-shrink-0 text-right">
                    <div className="text-xs font-black text-slate-800 uppercase">{stage.label}</div>
                    <div className="text-[10px] font-bold text-text-700">{stage.cantidad} expedientes</div>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative">
                    <div 
                      className={`h-12 rounded-xl bg-gradient-to-r ${colors.bg} flex items-center px-4 transition-all duration-1000 ease-out`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className="text-white text-xs font-black">{stage.porcentaje_del_total.toFixed(1)}%</span>
                      <span className="text-white/80 text-[10px] font-bold ml-2">S/ {stage.monto_total.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Conversion arrow */}
                  {idx < data.funnel.length - 1 && (
                    <div className="w-20 flex-shrink-0 text-center">
                      {stage.tasa_conversion_desde_anterior > 0 ? (
                        <div className="flex flex-col items-center">
                          <TrendingDown size={14} className="text-text-700 rotate-180" />
                          <span className="text-[10px] font-black text-text-700">{stage.tasa_conversion_desde_anterior.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-text-700">-</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Table */}
      {data && (
        <div className="table-shell">
          <div className="p-4 border-b border-surface-200">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-800">Detalle por Etapa</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="data-table-header">
                  <th className="text-left px-4 py-3">Etapa</th>
                  <th className="text-center px-4 py-3">Cantidad</th>
                  <th className="text-right px-4 py-3">Monto</th>
                  <th className="text-center px-4 py-3">% Total</th>
                  <th className="text-center px-4 py-3">Conv. Anterior</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((stage, idx) => (
                  <tr key={stage.etapa} className="data-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${STAGE_COLORS[idx % STAGE_COLORS.length].bg}`}></div>
                        <span className="text-xs font-bold text-slate-800 uppercase">{stage.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-black text-slate-800">{stage.cantidad}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">S/ {stage.monto_total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${STAGE_COLORS[idx % STAGE_COLORS.length].light} ${STAGE_COLORS[idx % STAGE_COLORS.length].text}`}>
                        {stage.porcentaje_del_total.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-text-700">
                      {idx === 0 ? '-' : `${stage.tasa_conversion_desde_anterior.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunnelPage;
