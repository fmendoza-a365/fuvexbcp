import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, Filter, AlertCircle, Clock, User } from 'lucide-react';

interface KanbanCard {
  id: string;
  dni_cliente: string;
  nombres_cliente: string;
  maf_neto: number;
  convenio: string;
  estado: string;
  dias_en_estado: number;
  alerta: boolean;
  asesor: { id: string; username: string };
  updated_at: string;
}

interface KanbanColumn {
  estado: string;
  label: string;
  color: string;
  count: number;
  monto_total: number;
  ventas: KanbanCard[];
}

interface ApiKanbanCard {
  id?: string;
  cliente?: string;
  dni?: string;
  convenio?: string | null;
  monto?: number | null;
  estado?: string;
  asesor?: { id?: string; nombre?: string; username?: string; avatar_url?: string | null } | null;
  dias_en_estado?: number;
  alerta?: boolean;
  fecha_ingreso?: string | null;
}

interface ApiKanbanColumn {
  key?: string;
  estado?: string;
  label?: string;
  color?: string;
  cantidad?: number;
  count?: number;
  monto_total?: number;
  ventas?: ApiKanbanCard[];
}

interface ApiKanbanResponse {
  columnas?: ApiKanbanColumn[];
  datos?: Record<string, ApiKanbanCard[]>;
}

const COLUMN_COLORS: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  // Flujo original
  'POR INGRESAR': { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  'EN PROCESO': { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' },
  'OBSERVADA': { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-600', dot: 'bg-amber-400' },
  'SUBSANADA': { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-600', dot: 'bg-violet-400' },
  // Flujo BCP extendido
  'PENDIENTE_DOCUMENTAR': { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  'PENDIENTE_INSTITUCIONES': { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-600', dot: 'bg-purple-400' },
  'PENDIENTE_REMESA': { bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-600', dot: 'bg-cyan-400' },
  'PENDIENTE_BACK_OFFICE': { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-400' },
  'OBSERVADO_BACK': { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-600', dot: 'bg-orange-400' },
  'EN_EVALUACION_BCP': { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-600', dot: 'bg-sky-400' },
  // Finales
  'APROBADA': { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400' },
  'DESEMBOLSADO': { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-600', dot: 'bg-green-400' },
  'RECHAZADO': { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-400' },
  'RECHAZADA_POR_SCORE': { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  'BOLETA_NO_CALIFICA': { bg: 'bg-red-50', border: 'border-red-300', badge: 'bg-red-100 text-red-700', dot: 'bg-red-600' },
  'CONFORMIDAD': { bg: 'bg-teal-50', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-600', dot: 'bg-teal-400' },
  'REASIGNADO': { bg: 'bg-gray-50', border: 'border-gray-300', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  'PENDIENTE_REASIGNACION': { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'REGISTRADO': { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeKanbanCard = (card: ApiKanbanCard, fallbackEstado: string, index: number): KanbanCard => ({
  id: card.id ?? `${fallbackEstado}-${card.dni ?? card.cliente ?? index}`,
  dni_cliente: card.dni ?? '',
  nombres_cliente: card.cliente ?? 'Sin nombre',
  maf_neto: toNumber(card.monto),
  convenio: card.convenio ?? '-',
  estado: card.estado ?? fallbackEstado,
  dias_en_estado: toNumber(card.dias_en_estado),
  alerta: Boolean(card.alerta),
  asesor: {
    id: card.asesor?.id ?? '',
    username: card.asesor?.username ?? card.asesor?.nombre ?? 'Sin asignar'
  },
  updated_at: card.fecha_ingreso ?? ''
});

const normalizeKanbanColumns = (payload: ApiKanbanResponse): KanbanColumn[] => (
  (payload.columnas ?? []).map((column) => {
    const estado = column.estado ?? column.key ?? 'REGISTRADO';
    const ventas = column.ventas ?? payload.datos?.[estado] ?? [];

    return {
      estado,
      label: column.label ?? estado,
      color: column.color ?? '',
      count: toNumber(column.count ?? column.cantidad ?? ventas.length),
      monto_total: toNumber(column.monto_total),
      ventas: ventas.map((card, index) => normalizeKanbanCard(card, estado, index))
    };
  })
);

const KanbanPage = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ convenio: '', asesor_id: '', fecha_inicio: '', fecha_fin: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);

  const fetchKanban = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.convenio) params.append('convenio', filters.convenio);
      if (filters.asesor_id) params.append('asesor_id', filters.asesor_id);
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);

      const res = await axios.get(`/api/analytics/kanban?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setColumns(normalizeKanbanColumns(res.data));
    } catch (error) {
      console.error('Error fetching kanban:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKanban(); }, []);

  const handleDragStart = (card: KanbanCard) => setDraggedCard(card);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (targetEstado: string) => {
    if (!draggedCard || draggedCard.estado === targetEstado) {
      setDraggedCard(null);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/sales/${draggedCard.id}/estado`, {
        nuevo_estado: targetEstado,
        detalles: `Movido a ${targetEstado} desde Kanban`
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchKanban();
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo mover el expediente');
    } finally {
      setDraggedCard(null);
    }
  };

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
      link.setAttribute('download', `reporte_fuvex_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800">Pipeline Visual</h1>
          <p className="text-xs font-bold text-text-700 uppercase tracking-widest mt-1">Vista Kanban de expedientes</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowFilters(!showFilters)} className="action-button-secondary">
            <Filter size={16} /> Filtros
          </button>
          <button onClick={exportExcel} className="action-button-secondary text-emerald-700">
            <Download size={16} /> Excel
          </button>
          <button onClick={fetchKanban} className="action-button-primary">
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filter-panel grid-cols-1 sm:grid-cols-4">
          <div>
            <label className="field-label">Convenio</label>
            <input value={filters.convenio} onChange={e => setFilters({ ...filters, convenio: e.target.value })} placeholder="Ej: INTERBANK" className="field-input" />
          </div>
          <div>
            <label className="field-label">Asesor ID</label>
            <input value={filters.asesor_id} onChange={e => setFilters({ ...filters, asesor_id: e.target.value })} placeholder="UUID del asesor" className="field-input" />
          </div>
          <div>
            <label className="field-label">Fecha Inicio</label>
            <input type="date" value={filters.fecha_inicio} onChange={e => setFilters({ ...filters, fecha_inicio: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">Fecha Fin</label>
            <input type="date" value={filters.fecha_fin} onChange={e => setFilters({ ...filters, fecha_fin: e.target.value })} className="field-input" />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button onClick={fetchKanban} className="action-button-primary">
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colors = COLUMN_COLORS[col.estado] || COLUMN_COLORS['REGISTRADO'];
          return (
            <div
              key={col.estado}
              className={`min-w-[280px] max-w-[320px] flex-shrink-0 rounded-lg border ${colors.border} ${colors.bg} p-3 shadow-sm`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.estado)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`}></div>
                  <span className="text-xs font-black uppercase tracking-tight text-slate-800">{col.label}</span>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {col.count}
                </span>
              </div>

              {/* Column Summary */}
              <div className="bg-white/80 rounded-lg px-3 py-2 mb-3 border border-surface-200">
                <div className="text-[9px] font-bold text-text-700 uppercase">Monto Total</div>
                <div className="text-sm font-black text-slate-800">S/ {col.monto_total.toLocaleString()}</div>
              </div>

              {/* Cards */}
              <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto">
                {col.ventas.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(card)}
                    className={`bg-white rounded-lg p-3 border shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${card.alerta ? 'border-rose-300 ring-1 ring-rose-200' : 'border-surface-200'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-slate-800 uppercase truncate">{card.nombres_cliente}</div>
                        <div className="text-[10px] font-bold text-text-700 mt-0.5">DNI: {card.dni_cliente}</div>
                      </div>
                      {card.alerta && (
                        <AlertCircle size={14} className="text-rose-500 flex-shrink-0 ml-2" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-[var(--color-bcp-blue)]">S/ {card.maf_neto.toLocaleString()}</span>
                      <span className="text-[9px] font-bold text-text-700 bg-surface-50 px-1.5 py-0.5 rounded">{card.convenio}</span>
                    </div>

                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <User size={10} className="text-text-700" />
                        <span className="text-[9px] font-bold text-text-700 uppercase truncate max-w-[100px]">{card.asesor?.username || 'Sin asignar'}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${card.dias_en_estado > 10 ? 'text-rose-500' : card.dias_en_estado > 5 ? 'text-amber-500' : 'text-text-700'}`}>
                        <Clock size={10} />
                        <span className="text-[9px] font-black">{card.dias_en_estado}d</span>
                      </div>
                    </div>
                    {/* Priority Badge */}
                    {card.dias_en_estado > 10 && (
                      <div className="mt-2 flex items-center gap-1 bg-rose-50 text-rose-600 rounded-lg px-2 py-0.5">
                        <AlertCircle size={10} />
                        <span className="text-[8px] font-black uppercase">Prioridad Alta</span>
                      </div>
                    )}
                    {card.dias_en_estado > 5 && card.dias_en_estado <= 10 && (
                      <div className="mt-2 flex items-center gap-1 bg-amber-50 text-amber-600 rounded-lg px-2 py-0.5">
                        <Clock size={10} />
                        <span className="text-[8px] font-black uppercase">Seguimiento</span>
                      </div>
                    )}
                  </div>
                ))}
                {col.ventas.length === 0 && (
                  <div className="text-center py-8 text-[10px] font-bold text-text-700 uppercase italic">
                    Sin expedientes
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanPage;
