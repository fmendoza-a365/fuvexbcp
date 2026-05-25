import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Target, 
  Map as MapIcon, 
  Clock,
  Trophy,
  ShieldAlert,
  BarChart3,
  Wallet,
  Users,
  ChevronRight,
  AlertCircle,
  Timer,
  TrendingUp,
  Zap,
  RefreshCw,
  Download,
  Filter,
  TrendingDown,
  Users as UsersIcon,
  DollarSign,
  Percent
} from 'lucide-react';
import { geoMercator, geoPath } from 'd3-geo';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const PERU_GEO_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson";

interface FunnelStage {
  etapa: string;
  label: string;
  descripcion: string;
  cantidad: number;
  monto_total: number;
  porcentaje_del_total: number;
  tasa_conversion_desde_anterior: number;
}

interface FunnelData {
  total_expedientes: number;
  monto_total_pipeline: number;
  funnel: FunnelStage[];
  conversion_global: number;
}

interface ApiFunnelStage {
  etapa?: string;
  descripcion?: string;
  cantidad?: number;
  monto_total?: number;
  tasa_entrada_pct?: number;
  tasa_conversion_pct?: number;
}

interface ApiFunnelResponse {
  funnel?: ApiFunnelStage[];
  resumen?: {
    total_expedientes?: number;
    monto_total_pipeline?: number;
    conversion_global_pct?: number;
  };
}

const FUNNEL_COLORS = ['#002A8D', '#3159B8', '#64748B', '#FF7800', '#10B981', '#0EA5E9', '#6366F1', '#0F172A'];

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultDateFilters = () => {
  const now = new Date();
  return {
    fecha_inicio: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    fecha_fin: toDateInput(now)
  };
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeFunnelData = (payload: ApiFunnelResponse): FunnelData => ({
  total_expedientes: toNumber(payload.resumen?.total_expedientes),
  monto_total_pipeline: payload.resumen?.monto_total_pipeline !== undefined
    ? toNumber(payload.resumen.monto_total_pipeline)
    : (payload.funnel ?? []).reduce((acc, stage) => acc + toNumber(stage.monto_total), 0),
  conversion_global: toNumber(payload.resumen?.conversion_global_pct),
  funnel: (payload.funnel ?? []).map((stage) => ({
    etapa: stage.etapa ?? 'Sin etapa',
    label: stage.etapa ?? 'Sin etapa',
    descripcion: stage.descripcion ?? '',
    cantidad: toNumber(stage.cantidad),
    monto_total: toNumber(stage.monto_total),
    porcentaje_del_total: toNumber(stage.tasa_entrada_pct),
    tasa_conversion_desde_anterior: toNumber(stage.tasa_conversion_pct),
  }))
});

const normalizeGeoName = (value?: string) => (
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
);

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('asesores');
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [dateFilters, setDateFilters] = useState(getDefaultDateFilters);
  const [funnelFilters, setFunnelFilters] = useState({ ...getDefaultDateFilters(), convenio: '' });
  const [showFunnelFilters, setShowFunnelFilters] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<any | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<any | null>(null);

  useEffect(() => {
    // Try to load from cache first for instant UI
    const cacheKey = `analytics_cache_${dateFilters.fecha_inicio}_${dateFilters.fecha_fin}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      setDashboardData(data.dash);
      setTimeSeriesData(data.ts);
      setGeoData(data.geo);
      setRankings(data.rank);
      setOpsData(data.ops);
      setFunnelData(data.funnel || null);
      setLoading(false);
    }
    
    fetchData();
    const handleRefresh = () => fetchData(true);
    window.addEventListener('refresh-sales', handleRefresh);
    return () => window.removeEventListener('refresh-sales', handleRefresh);
  }, [dateFilters.fecha_inicio, dateFilters.fecha_fin]);

  useEffect(() => {
    setFunnelFilters(prev => ({
      ...prev,
      fecha_inicio: dateFilters.fecha_inicio,
      fecha_fin: dateFilters.fecha_fin
    }));
  }, [dateFilters.fecha_inicio, dateFilters.fecha_fin]);

  const buildDashboardParams = () => ({
    fecha_inicio: dateFilters.fecha_inicio,
    fecha_fin: dateFilters.fecha_fin
  });

  const fetchData = async (silent = false) => {
    // Only show loader if we don't have cached data
    const cacheKey = `analytics_cache_${dateFilters.fecha_inicio}_${dateFilters.fecha_fin}`;
    if (!silent && !localStorage.getItem(cacheKey)) {
      setLoading(true);
    }
    
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const params = buildDashboardParams();

      const [dash, ts, geo, rank, ops, funnel] = await Promise.all([
        axios.get('/api/analytics/dashboard', { headers, params }),
        axios.get('/api/analytics/timeseries', { headers, params }),
        axios.get('/api/analytics/geography', { headers, params }),
        axios.get('/api/analytics/rankings', { headers, params }),
        axios.get('/api/analytics/operations', { headers, params }),
        axios.get('/api/analytics/funnel', { headers, params })
      ]);

      setDashboardData(dash.data);
      setTimeSeriesData(Array.isArray(ts.data) ? ts.data : []);
      setGeoData(Array.isArray(geo.data) ? geo.data : []);
      setRankings(rank.data);
      setOpsData(ops.data);
      setFunnelData(normalizeFunnelData(funnel.data));
      
      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify({
        dash: dash.data,
        ts: ts.data,
        geo: geo.data,
        rank: rank.data,
        ops: ops.data,
        funnel: normalizeFunnelData(funnel.data),
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const buildFunnelParams = () => {
    const params = new URLSearchParams();
    if (funnelFilters.fecha_inicio) params.append('fecha_inicio', funnelFilters.fecha_inicio);
    if (funnelFilters.fecha_fin) params.append('fecha_fin', funnelFilters.fecha_fin);
    if (funnelFilters.convenio) params.append('convenio', funnelFilters.convenio);
    return params;
  };

  const fetchFunnel = async () => {
    setFunnelLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/analytics/funnel?${buildFunnelParams()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFunnelData(normalizeFunnelData(res.data));
    } catch (error) {
      console.error('Error fetching funnel:', error);
    } finally {
      setFunnelLoading(false);
    }
  };

  const exportFunnelExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/analytics/export/excel?${buildFunnelParams()}`, {
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
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando funnel:', err);
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `S/ ${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `S/ ${(val / 1000).toFixed(1)}K`;
    return `S/ ${val.toFixed(0)}`;
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
        <p className="text-text-700 font-bold animate-pulse uppercase tracking-widest text-[10px]">Sincronizando Inteligencia...</p>
      </div>
    </div>
  );

  const maxRegionValue = Math.max(...(geoData || []).map((item) => Number(item.value) || 0), 1);
  const totalRegionValue = (geoData || []).reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  const totalRegionCount = (geoData || []).reduce((acc, item) => acc + (Number(item.count) || 0), 0);
  const topRegions = [...(geoData || [])]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 5);
  const activeRegion = hoveredRegion || selectedRegion || topRegions[0] || null;
  const maxFunnelCantidad = funnelData ? Math.max(...funnelData.funnel.map(s => s.cantidad), 1) : 1;
  const ticketAverage = dashboardData?.disbursedCount ? (Number(dashboardData.totalDisbursed || 0) / Number(dashboardData.disbursedCount || 1)) : 0;
  const bottleneckStage = Array.isArray(opsData?.responseTimes) && opsData.responseTimes.length > 0
    ? [...opsData.responseTimes].sort((a: any, b: any) => Number(b.hours || 0) - Number(a.hours || 0))[0]
    : null;
  const riskTotal = Array.isArray(opsData?.risk)
    ? opsData.risk.reduce((acc: number, item: any) => acc + Number(item._count || 0), 0)
    : 0;
  const riskObserved = Array.isArray(opsData?.risk)
    ? opsData.risk
        .filter((item: any) => !['VERDE', 'GREEN'].includes(String(item.rcc_semaforo || '').toUpperCase()))
        .reduce((acc: number, item: any) => acc + Number(item._count || 0), 0)
    : 0;

  return (
    <div className="page-shell animate-in fade-in duration-700">
      {/* 1. CABINA DE DECISION */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Analítica <span className="text-[var(--accent-blue)]">Gerencial</span>
          </h1>
          <p className="page-subtitle">Control comercial, riesgo y operación para decidir dónde empujar hoy.</p>
        </div>
        <div className="page-actions">
           <div className="bg-surface-100 border border-surface-200 p-2 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-end gap-2">
             <div>
               <label className="field-label !mb-1">Desde</label>
               <input
                 type="date"
                 value={dateFilters.fecha_inicio}
                 onChange={(event) => setDateFilters(prev => ({ ...prev, fecha_inicio: event.target.value }))}
                 className="field-input !py-2 !text-[11px]"
               />
             </div>
             <div>
               <label className="field-label !mb-1">Hasta</label>
               <input
                 type="date"
                 value={dateFilters.fecha_fin}
                 onChange={(event) => setDateFilters(prev => ({ ...prev, fecha_fin: event.target.value }))}
                 className="field-input !py-2 !text-[11px]"
               />
             </div>
             <button
               type="button"
               onClick={() => setDateFilters(getDefaultDateFilters())}
               className="action-button-secondary h-10 whitespace-nowrap"
             >
               Mes actual
             </button>
           </div>
           <div className="bg-surface-100 border border-surface-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse"></div>
              <span className="text-[10px] font-black text-text-700 uppercase tracking-widest">Datos operativos</span>
           </div>
           <button onClick={() => fetchData()} className="action-button-primary p-3" title="Actualizar dashboard">
             <RefreshCw size={18} />
           </button>
        </div>
      </div>

      <DecisionStrip
        items={[
          {
            label: 'Pipeline vivo',
            value: formatCurrency(dashboardData?.pipelineValue || 0),
            detail: `${dashboardData?.pipelineCount || 0} expedientes activos`,
            icon: <BarChart3 size={20} />,
            color: 'blue'
          },
          {
            label: 'Conversion a desembolso',
            value: `${dashboardData?.conversionRate?.toFixed(1) || '0.0'}%`,
            detail: `${dashboardData?.disbursedCount || 0} desembolsos del periodo`,
            icon: <Percent size={20} />,
            color: 'emerald'
          },
          {
            label: 'Riesgo observado',
            value: `${riskObserved}`,
            detail: riskTotal > 0 ? `${((riskObserved / riskTotal) * 100).toFixed(1)}% fuera de verde` : 'Sin evaluaciones RCC',
            icon: <ShieldAlert size={20} />,
            color: riskObserved > 0 ? 'amber' : 'emerald'
          },
          {
            label: 'Mayor demora',
            value: bottleneckStage?.stage || 'Sin datos',
            detail: bottleneckStage ? `${Number(bottleneckStage.hours || 0).toFixed(1)}h promedio` : 'Sin historial suficiente',
            icon: <Timer size={20} />,
            color: bottleneckStage ? 'amber' : 'slate'
          }
        ]}
      />

      {/* 2. PANEL DE CONTROL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard 
          title="DESEMBOLSO TOTAL" 
          value={formatCurrency(dashboardData?.totalDisbursed || 0)}
          icon={<Trophy size={20} />}
          color="blue"
          footer={`Avance de Meta: ${dashboardData?.completionRate?.toFixed(1)}%`}
          progress={dashboardData?.completionRate}
        />
        <KpiCard 
          title="Proyección de Cierre"
          value={formatCurrency(dashboardData?.forecasting || 0)}
          icon={<TrendingUp size={20} />}
          color={dashboardData?.momGrowth >= 0 ? 'emerald' : 'amber'}
          footer={`Meta: ${formatCurrency(dashboardData?.goalAmount || 0)}`}
        />
        <KpiCard 
          title="Ticket Promedio"
          value={formatCurrency(ticketAverage)}
          icon={<Target size={20} />}
          color="slate"
          footer={`${dashboardData?.disbursedCount || 0} operaciones desembolsadas`}
        />
        <KpiCard 
          title="Por Cobrar / Liberar"
          value={formatCurrency(dashboardData?.pendingValue || 0)}
          icon={<Wallet size={20} />}
          color="blue"
          footer="Monto pendiente de remesa o liberación"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] gap-8">
        <FunnelAnalyticsSection
          data={funnelData}
          loading={funnelLoading}
          filters={funnelFilters}
          setFilters={setFunnelFilters}
          showFilters={showFunnelFilters}
          setShowFilters={setShowFunnelFilters}
          onRefresh={fetchFunnel}
          onExport={exportFunnelExcel}
          maxCantidad={maxFunnelCantidad}
          formatCurrency={formatCurrency}
        />
        <OperationalHealthPanel opsData={opsData} />
      </div>

      {/* 3. LÍNEA DE TIEMPO VS META */}
      <div className="premium-card">
        <div className="flex justify-between items-center mb-8">
           <h3 className="chart-title">
             <Clock size={16} className="text-[var(--accent-blue)]" /> Rendimiento Diario vs Objetivos
           </h3>
           <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
             <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Ingreso</div>
             <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]"></div> Desembolso</div>
           </div>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#002A8D" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#002A8D" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} tickFormatter={(v) => `S/${v/1000}K`} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                formatter={(value: any) => formatCurrency(Number(value))}
              />
              <Area type="monotone" dataKey="ingresado" stroke="#cbd5e1" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              <Area type="monotone" dataKey="desembolsado" stroke="#002A8D" fillOpacity={1} fill="url(#colorDes)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. TERRITORIO, CONVENIOS Y RIESGO */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] gap-8">
        <RegionalDecisionPanel
          geoData={geoData}
          topRegions={topRegions}
          activeRegion={activeRegion}
          maxRegionValue={maxRegionValue}
          totalRegionValue={totalRegionValue}
          totalRegionCount={totalRegionCount}
          setHoveredRegion={setHoveredRegion}
          setSelectedRegion={setSelectedRegion}
          formatCurrency={formatCurrency}
        />
        <div className="space-y-6">
          <CommercialMixPanel agreements={opsData?.agreements || []} formatCurrency={formatCurrency} />
          <RiskQualityPanel risk={opsData?.risk || []} />
        </div>
      </div>

      <ManagementTablesSection summaries={opsData?.summaries} formatCurrency={formatCurrency} />

      {/* 5. GESTIÓN DE TALENTO: RANKINGS Y ALERTAS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 premium-card !p-0 overflow-hidden">
          <div className="flex border-b border-surface-200 p-2 bg-surface-50/30">
             <TabButton active={activeTab === 'asesores'} onClick={() => setActiveTab('asesores')} icon={<Users size={16}/>} label="Top Asesores" />
             <TabButton active={activeTab === 'equipos'} onClick={() => setActiveTab('equipos')} icon={<Target size={16}/>} label="Top Equipos" />
             <TabButton active={activeTab === 'eficiencia'} onClick={() => setActiveTab('eficiencia')} icon={<Zap size={16}/>} label="Eficiencia" />
          </div>
          
          <div className="p-8">
            {activeTab === 'asesores' && (
              <div className="space-y-4">
                {(rankings?.vendedores && Array.isArray(rankings.vendedores)) ? rankings.vendedores.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-surface-50 rounded-2xl transition-all border border-transparent hover:border-surface-200 group">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-lg bg-surface-50 flex items-center justify-center text-xl">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-text-900 uppercase text-sm tracking-tight">{item.name}</div>
                      <div className="text-[10px] font-bold text-text-700 uppercase tracking-widest">Productividad Elite</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[var(--color-bcp-orange)]">{formatCurrency(item.value)}</div>
                      <div className="text-[10px] font-bold text-emerald-500 uppercase flex items-center justify-end gap-1">
                        <TrendingUp size={10} /> +12% MoM
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 opacity-30 uppercase text-[10px] font-bold">Sin datos de ranking</div>
                )}
              </div>
            )}

            {activeTab === 'equipos' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(rankings?.supervisores && Array.isArray(rankings.supervisores)) ? rankings.supervisores.map((item: any, i: number) => (
                  <div key={`supervisor-${i}`} className="flex items-center justify-between gap-4 p-4 hover:bg-surface-50 rounded-2xl transition-all border border-surface-200">
                    <div className="min-w-0">
                      <div className="font-bold text-text-900 uppercase text-sm tracking-tight truncate">{item.name}</div>
                      <div className="text-[10px] font-bold text-text-700 uppercase tracking-widest">Supervisor</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-[var(--color-bcp-orange)]">{formatCurrency(item.value || 0)}</div>
                      <div className="text-[10px] font-bold text-text-700 uppercase">Desembolso</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 opacity-30 uppercase text-[10px] font-bold">Sin datos de supervisores</div>
                )}
              </div>
            )}
            
            {activeTab === 'eficiencia' && (
              <div className="space-y-5">
                 {opsData?.efficiency.map((item: any, i: number) => (
                   <div key={i} className="space-y-2">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-900 uppercase">{item.name}</span>
                        <span className="text-xs font-bold text-[var(--accent-emerald)]">{item.efficiency.toFixed(1)}% OK</span>
                     </div>
                     <div className="h-2 w-full bg-surface-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--accent-emerald)] transition-all duration-1000" style={{ width: `${item.efficiency}%` }}></div>
                     </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>

        <div className="premium-card">
           <h3 className="chart-title chart-title-danger mb-8">
             <ShieldAlert size={16} /> Radar de Inactividad ({opsData?.radar.length})
           </h3>
           <div className="space-y-4">
              {opsData?.radar.map((r: any, i: number) => (
                <div key={i} className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center gap-4 group hover:bg-rose-50 transition-all">
                   <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-rose-500 shadow-sm">
                     <AlertCircle size={20} />
                   </div>
                   <div className="flex-1">
                      <div className="text-xs font-bold text-text-900 uppercase mb-0.5">{r.name}</div>
                      <div className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">Sin producción: {r.daysInactive} días</div>
                   </div>
                   <ChevronRight size={16} className="text-rose-300" />
                </div>
              ))}
              {opsData?.radar.length === 0 && (
                <div className="py-12 text-center text-text-700 font-medium italic text-xs">
                  Todo el equipo está produciendo ✨
                </div>
              )}
           </div>
        </div>
      </div>

      {/* 6. SALUD OPERATIVA: SLAs Y PARETO */}
      <div className="hidden">
        <div className="premium-card">
           <h3 className="chart-title mb-8">
             <Timer size={16} className="text-[var(--accent-blue)]" /> Tiempos de Respuesta (SLA)
           </h3>
           <div className="space-y-6">
              {opsData?.responseTimes.map((t: any, i: number) => (
                <div key={i} className="relative pl-6 border-l-2 border-surface-200 last:border-l-0 pb-6 last:pb-0">
                   <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface-100 border-4 border-[var(--color-bcp-blue)] shadow-sm"></div>
                   <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-text-900 uppercase tracking-tight">{t.stage}</div>
                        <div className="text-[9px] font-bold text-text-700 uppercase">Ciclo Promedio</div>
                      </div>
                      <div className="text-sm font-bold text-[var(--accent-blue)] bg-[var(--accent-blue-soft)] px-2 py-1 rounded-lg">{t.hours}h</div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="lg:col-span-2 premium-card">
          <h3 className="chart-title mb-8">
            <BarChart3 size={16} className="text-[var(--accent-blue)]" /> Pareto de Observaciones Críticas
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opsData?.observations || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#475569'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: 'rgba(0,42,141,0.02)'}} />
                <Bar dataKey="value" fill="#002A8D" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon, color, footer, progress }: any) => {
  const accentClass = color === 'blue'
    ? 'bg-[rgba(0,42,141,0.1)] text-[var(--accent-blue)]'
    : color === 'emerald'
      ? 'bg-emerald-50 text-[var(--accent-emerald)]'
      : color === 'amber'
        ? 'bg-amber-50 text-[var(--accent-amber)]'
        : 'bg-surface-50 text-text-700';
  const barClass = color === 'amber'
    ? 'bg-[var(--accent-amber)]'
    : color === 'emerald'
      ? 'bg-[var(--accent-emerald)]'
      : 'bg-[var(--accent-blue)]';

  return (
  <div className="premium-card relative group cursor-default h-full min-h-[126px] flex flex-col">
    <div className="flex justify-between items-start gap-4 mb-5">
      <div className="min-w-0">
        <h4 className="stat-label">{title}</h4>
        <div className="stat-value truncate">{value}</div>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${accentClass}`}>
        {icon}
      </div>
    </div>
    {progress !== undefined && (
      <div className="h-1.5 w-full bg-surface-200 rounded-full overflow-hidden mb-3">
        <div className={`h-full transition-all duration-1000 ${barClass}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
      </div>
    )}
    <div className="flex items-center gap-2 mt-auto min-w-0">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${barClass}`}></div>
      <p className="text-[9px] font-bold text-text-700 uppercase tracking-[0.1em] truncate">{footer}</p>
    </div>
  </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="py-10 text-center text-xs font-bold uppercase tracking-widest text-text-700 bg-surface-50 border border-dashed border-surface-200 rounded-lg">
    {label}
  </div>
);

const DecisionStrip = ({ items }: { items: Array<{ label: string; value: string; detail: string; icon: any; color: string }> }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
    {items.map((item) => (
      <KpiCard
        key={item.label}
        title={item.label}
        value={item.value}
        icon={item.icon}
        color={item.color}
        footer={item.detail}
      />
    ))}
  </div>
);

const RegionalDecisionPanel = ({
  geoData,
  topRegions,
  activeRegion,
  maxRegionValue,
  totalRegionValue,
  totalRegionCount,
  setHoveredRegion,
  setSelectedRegion,
  formatCurrency
}: {
  geoData: any[];
  topRegions: any[];
  activeRegion: any | null;
  maxRegionValue: number;
  totalRegionValue: number;
  totalRegionCount: number;
  setHoveredRegion: (region: any | null) => void;
  setSelectedRegion: (region: any | null) => void;
  formatCurrency: (value: number) => string;
}) => {
  const activeShare = totalRegionValue > 0 ? ((Number(activeRegion?.value) || 0) / totalRegionValue) * 100 : 0;
  const [mapFeatures, setMapFeatures] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch(PERU_GEO_URL)
      .then(response => response.json())
      .then(data => {
        if (mounted) setMapFeatures(Array.isArray(data?.features) ? data.features : []);
      })
      .catch(() => {
        if (mounted) setMapFeatures([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const projection = geoMercator()
    .center([-75.2, -9.15])
    .scale(1360)
    .translate([400, 210]);
  const pathGenerator = geoPath(projection);

  return (
    <div className="premium-card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h3 className="chart-title">
            <MapIcon size={16} className="text-[var(--accent-blue)]" /> Mapa de Desembolso por Región
          </h3>
          <p className="text-xs font-semibold text-text-700 mt-2">Identifica dónde se concentra el volumen y qué regiones necesitan empuje comercial.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-700">
          <span>Bajo</span>
          <div className="w-28 h-2 rounded-full bg-gradient-to-r from-[#EAF1FB] via-[#7EA6E8] to-[var(--color-bcp-orange)] border border-surface-200" />
          <span>Alto</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="relative min-h-[420px] rounded-lg border border-surface-200 bg-gradient-to-b from-[#F8FAFC] to-[#EFF6FF] overflow-hidden">
          <svg viewBox="0 0 800 420" className="w-full h-[420px]" role="img" aria-label="Mapa de desembolso por region">
            {mapFeatures.map((feature, index) => {
              const departmentName = feature.properties?.NOMBDEP || feature.properties?.name || 'Sin region';
              const data = (geoData || []).find(d => normalizeGeoName(d.region) === normalizeGeoName(departmentName));
              const selected = activeRegion && normalizeGeoName(activeRegion.region) === normalizeGeoName(departmentName);
              const ratio = data ? Math.min((Number(data.value) || 0) / maxRegionValue, 1) : 0;
              const fill = data
                ? ratio > 0.72
                  ? '#FF7800'
                  : ratio > 0.42
                    ? '#1D4ED8'
                    : ratio > 0.12
                      ? '#7EA6E8'
                      : '#D9E7FF'
                : '#EEF2F7';

              return (
                <path
                  key={`${departmentName}-${index}`}
                  d={pathGenerator(feature) || ''}
                  onMouseEnter={() => setHoveredRegion(data || { region: departmentName, value: 0, count: 0 })}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onClick={() => setSelectedRegion(data || { region: departmentName, value: 0, count: 0 })}
                  fill={selected ? '#FF7800' : fill}
                  stroke={selected ? '#111827' : '#94A3B8'}
                  strokeWidth={selected ? 1.25 : 0.55}
                  className="transition-colors duration-150 hover:fill-[#FF7800] focus:outline-none cursor-pointer"
                  tabIndex={0}
                />
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border border-surface-200 rounded-lg p-4 bg-surface-50">
            <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Región seleccionada</div>
            <div className="text-lg font-black text-text-900 uppercase mt-1">{activeRegion?.region || 'Sin región'}</div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <div className="text-[9px] font-bold uppercase text-text-700">Monto</div>
                <div className="text-sm font-black text-[var(--color-bcp-blue)]">{formatCurrency(Number(activeRegion?.value) || 0)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-text-700">Casos</div>
                <div className="text-sm font-black text-[var(--color-bcp-orange)]">{Number(activeRegion?.count) || 0}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[9px] font-bold uppercase text-text-700 mb-1">
                <span>Participación</span>
                <span>{activeShare.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--color-bcp-orange)] rounded-full" style={{ width: `${Math.min(activeShare, 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-surface-200 rounded-lg p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Total regional</div>
              <div className="text-base font-black text-text-900 mt-1">{formatCurrency(totalRegionValue)}</div>
            </div>
            <div className="border border-surface-200 rounded-lg p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Casos</div>
              <div className="text-base font-black text-text-900 mt-1">{totalRegionCount}</div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-text-700 mb-3">Top regiones</div>
            <div className="space-y-2">
              {topRegions.map((region, index) => {
                const pct = maxRegionValue > 0 ? Math.max(((Number(region.value) || 0) / maxRegionValue) * 100, 4) : 4;
                const selected = activeRegion && normalizeGeoName(activeRegion.region) === normalizeGeoName(region.region);
                return (
                  <button
                    key={region.region}
                    type="button"
                    onMouseEnter={() => setHoveredRegion(region)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onClick={() => setSelectedRegion(region)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${selected ? 'border-[var(--color-bcp-orange)] bg-orange-50' : 'border-surface-200 hover:border-blue-200 hover:bg-surface-50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase text-text-900 truncate">{index + 1}. {region.region}</div>
                        <div className="text-[10px] font-bold text-text-700 mt-0.5">{region.count} casos</div>
                      </div>
                      <div className="text-xs font-black text-[var(--color-bcp-blue)] shrink-0">{formatCurrency(Number(region.value) || 0)}</div>
                    </div>
                    <div className="h-1.5 w-full bg-surface-200 rounded-full overflow-hidden mt-3">
                      <div className="h-full bg-[var(--color-bcp-blue)] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
              {topRegions.length === 0 && <EmptyState label="Sin datos regionales" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CommercialMixPanel = ({ agreements, formatCurrency }: { agreements: any[]; formatCurrency: (value: number) => string }) => {
  const data = [...(agreements || [])]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 6);

  return (
    <div className="premium-card">
      <h3 className="chart-title mb-6">
        <BarChart3 size={16} className="text-[var(--accent-blue)]" /> Desembolso por Convenio
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 6, right: 18, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={88} axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#475569'}} />
            <Tooltip cursor={{fill: 'rgba(0,42,141,0.02)'}} formatter={(v: any) => formatCurrency(Number(v))} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
              {data.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#FF7800' : '#002A8D'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.length === 0 && <EmptyState label="Sin datos de convenios" />}
    </div>
  );
};

const normalizeRisk = (value: string) => {
  const normalized = String(value || 'SIN DATO').toUpperCase();
  if (normalized.includes('VERDE') || normalized === 'GREEN') return 'VERDE';
  if (normalized.includes('AMARILLO') || normalized === 'YELLOW') return 'AMARILLO';
  if (normalized.includes('ROJO') || normalized === 'RED') return 'ROJO';
  return normalized || 'SIN DATO';
};

const riskColor = (label: string) => {
  if (label === 'VERDE') return '#10B981';
  if (label === 'AMARILLO') return '#F59E0B';
  if (label === 'ROJO') return '#EF4444';
  return '#64748B';
};

const RiskQualityPanel = ({ risk }: { risk: any[] }) => {
  const rows = (risk || []).map((item) => ({
    label: normalizeRisk(item.rcc_semaforo),
    count: Number(item._count) || 0
  }));
  const total = rows.reduce((acc, item) => acc + item.count, 0);
  const green = rows.filter((item) => item.label === 'VERDE').reduce((acc, item) => acc + item.count, 0);
  const healthyPct = total > 0 ? (green / total) * 100 : 0;

  return (
    <div className="premium-card">
      <h3 className="chart-title mb-5">
        <ShieldAlert size={16} className="text-[var(--accent-blue)]" /> Calidad de Riesgo
      </h3>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Cartera sana</div>
          <div className="text-3xl font-black text-text-900 mt-1">{healthyPct.toFixed(1)}%</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Evaluados</div>
          <div className="text-lg font-black text-[var(--color-bcp-blue)]">{total}</div>
        </div>
      </div>

      <div className="h-3 w-full rounded-full overflow-hidden bg-surface-200 flex mb-4">
        {rows.map((item) => (
          <div
            key={item.label}
            className="h-full"
            style={{
              width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
              backgroundColor: riskColor(item.label)
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {rows.map((item) => {
          const pct = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 border border-surface-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: riskColor(item.label) }} />
                <span className="text-[10px] font-black uppercase text-text-900 truncate">{item.label}</span>
              </div>
              <div className="text-[10px] font-black text-text-700">{item.count} | {pct.toFixed(1)}%</div>
            </div>
          );
        })}
        {rows.length === 0 && <EmptyState label="Sin evaluaciones de riesgo" />}
      </div>
    </div>
  );
};

const ManagementTablesSection = ({ summaries, formatCurrency }: { summaries: any; formatCurrency: (value: number) => string }) => {
  const [active, setActive] = useState<'supervisors' | 'zones' | 'agreements'>('supervisors');
  const tabs = [
    { key: 'supervisors' as const, label: 'Por Supervisor' },
    { key: 'zones' as const, label: 'Por Zona' },
    { key: 'agreements' as const, label: 'Por Convenio' }
  ];
  const rows = Array.isArray(summaries?.[active]) ? summaries[active] : [];

  const exportCsv = () => {
    const headers = ['Nombre', 'Zona', 'Total desembolso', 'Q desembolso', 'Prospectos', 'Pipeline', 'Eval BCP', 'Pend Back', 'Pend Remesa', 'Rechazados', 'Meta', 'Avance', 'Ticket promedio'];
    const body = rows.map((row: any) => [
      row.name,
      row.zone,
      row.total_desembolso,
      row.q_desembolso,
      row.prospectos,
      row.pipeline,
      row.evaluacion_bcp,
      row.pendiente_back,
      row.pendiente_remesa,
      row.rechazados,
      row.meta,
      row.avance,
      row.ticket_promedio
    ]);
    const csv = [headers, ...body]
      .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumen_${active}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="premium-card !p-0 overflow-hidden">
      <div className="p-5 border-b border-surface-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="chart-title">
            <BarChart3 size={16} className="text-[var(--accent-blue)]" /> Tablas de Gestión
          </h3>
          <p className="text-xs font-semibold text-text-700 mt-2">Resumen operativo del periodo seleccionado para decidir metas, seguimiento y prioridades de back office.</p>
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0} className="action-button-secondary text-[var(--color-bcp-blue)] disabled:opacity-50">
          <Download size={15} /> Exportar
        </button>
      </div>

      <div className="flex border-b border-surface-200 bg-surface-50/60 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
              active === tab.key
                ? 'border-[var(--color-bcp-orange)] text-[var(--color-bcp-orange)] bg-surface-100'
                : 'border-transparent text-text-700 hover:text-text-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SummaryTable rows={rows} formatCurrency={formatCurrency} />
    </div>
  );
};

const SummaryTable = ({ rows, formatCurrency }: { rows: any[]; formatCurrency: (value: number) => string }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[1120px] text-left">
      <thead>
        <tr className="data-table-header">
          <th className="px-4 py-3">Responsable</th>
          <th className="px-4 py-3">Zona</th>
          <th className="px-4 py-3 text-right">Desembolso</th>
          <th className="px-4 py-3 text-right">Q Des.</th>
          <th className="px-4 py-3 text-right">Prospectos</th>
          <th className="px-4 py-3 text-right">Pipeline</th>
          <th className="px-4 py-3 text-right">Eval. BCP</th>
          <th className="px-4 py-3 text-right">Pend. Back</th>
          <th className="px-4 py-3 text-right">Pend. Remesa</th>
          <th className="px-4 py-3 text-right">Rech.</th>
          <th className="px-4 py-3 text-right">Meta</th>
          <th className="px-4 py-3">Avance</th>
          <th className="px-4 py-3 text-right">Ticket</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key || row.name} className="data-table-row">
            <td className="px-4 py-3 text-xs font-black uppercase text-text-900">{row.name}</td>
            <td className="px-4 py-3 text-[10px] font-bold uppercase text-text-700">{row.zone}</td>
            <td className="px-4 py-3 text-xs font-black text-right text-[var(--color-bcp-blue)]">{formatCurrency(Number(row.total_desembolso) || 0)}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{row.q_desembolso || 0}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{row.prospectos || 0}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{formatCurrency(Number(row.pipeline) || 0)}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{formatCurrency(Number(row.evaluacion_bcp) || 0)}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{formatCurrency(Number(row.pendiente_back) || 0)}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{formatCurrency(Number(row.pendiente_remesa) || 0)}</td>
            <td className="px-4 py-3 text-xs font-bold text-right text-rose-600">{row.rechazados || 0}</td>
            <td className="px-4 py-3 text-xs font-bold text-right">{formatCurrency(Number(row.meta) || 0)}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 bg-surface-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-bcp-orange)] rounded-full" style={{ width: `${Math.min(Number(row.avance) || 0, 100)}%` }} />
                </div>
                <span className="text-[10px] font-black text-text-900">{Number(row.avance || 0).toFixed(1)}%</span>
              </div>
            </td>
            <td className="px-4 py-3 text-xs font-bold text-right">{formatCurrency(Number(row.ticket_promedio) || 0)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={13} className="px-4 py-10">
              <EmptyState label="Sin datos de gestión para el periodo" />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const OperationalHealthPanel = ({ opsData }: { opsData: any }) => {
  const stateDistribution = Array.isArray(opsData?.funnel)
    ? [...opsData.funnel].sort((a: any, b: any) => Number(b._count || 0) - Number(a._count || 0)).slice(0, 7)
    : [];
  const responseTimes = Array.isArray(opsData?.responseTimes) ? opsData.responseTimes.slice(0, 5) : [];
  const observations = Array.isArray(opsData?.observations) ? opsData.observations.slice(0, 6) : [];
  const sla = opsData?.sla || {};
  const slaExpedientes = Array.isArray(sla.expedientes) ? sla.expedientes : [];
  const slaAlerts = slaExpedientes
    .filter((item: any) => ['POR_VENCER', 'VENCIDO', 'CRITICO'].includes(String(item.nivel)))
    .slice(0, 5);
  const maxStateCount = Math.max(...stateDistribution.map((item: any) => Number(item._count) || 0), 1);
  const maxObservation = Math.max(...observations.map((item: any) => Number(item.value) || 0), 1);

  return (
    <div className="space-y-6">
      <div className="premium-card">
        <h3 className="chart-title mb-6">
          <Timer size={16} className="text-[var(--accent-blue)]" /> Control SLA Operativo
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Monitoreados', value: Number(sla.total_monitoreados || 0), className: 'text-text-900' },
            { label: 'Por vencer', value: Number(sla.por_vencer || 0), className: 'text-amber-600' },
            { label: 'Vencidos', value: Number(sla.vencidos || 0), className: 'text-rose-600' },
            { label: 'Criticos', value: Number(sla.criticos || 0), className: 'text-rose-700' }
          ].map((item) => (
            <div key={item.label} className="surface-card p-3">
              <div className="text-[9px] font-black uppercase text-text-700 tracking-widest">{item.label}</div>
              <div className={`text-xl font-black ${item.className}`}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {slaAlerts.map((item: any) => {
            const tone = item.nivel === 'POR_VENCER'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-rose-50 text-rose-600';
            return (
              <div key={item.sale_id} className="surface-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase text-text-900 truncate">{item.cliente}</div>
                    <div className="text-[9px] font-bold uppercase text-text-700 truncate">
                      {item.estado} · {item.siguiente_accion || 'Revisar expediente'}
                    </div>
                  </div>
                  <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${tone}`}>
                    {item.dias_en_estado}d / SLA {item.sla_dias}d
                  </div>
                </div>
              </div>
            );
          })}
          {slaAlerts.length === 0 && (
            <EmptyState label="Sin alertas SLA activas" />
          )}
        </div>
      </div>

      <div className="premium-card">
        <h3 className="chart-title mb-6">
          <BarChart3 size={16} className="text-[var(--accent-blue)]" /> Estado Actual de Expedientes
        </h3>
        <div className="space-y-3">
          {stateDistribution.map((item: any, index: number) => {
            const count = Number(item._count) || 0;
            const width = Math.max((count / maxStateCount) * 100, 6);
            return (
              <div key={`${item.estado}-${index}`}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[10px] font-black uppercase text-text-900 truncate">{item.estado}</span>
                  <span className="text-[10px] font-black text-[var(--color-bcp-orange)]">{count}</span>
                </div>
                <div className="h-2.5 bg-surface-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-bcp-blue)] rounded-full" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
          {stateDistribution.length === 0 && (
            <EmptyState label="Sin expedientes para distribuir" />
          )}
        </div>
      </div>

      <div className="premium-card">
        <h3 className="chart-title mb-6">
          <Timer size={16} className="text-[var(--accent-blue)]" /> Tiempos de Respuesta (SLA)
        </h3>
        <div className="space-y-4">
          {responseTimes.map((item: any, index: number) => (
            <div key={`${item.stage}-${index}`} className="surface-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase text-text-900 truncate">{item.stage}</div>
                  <div className="text-[9px] font-bold uppercase text-text-700">{item.samples || 0} muestras</div>
                </div>
                <div className="text-sm font-black text-[var(--accent-blue)] bg-[var(--accent-blue-soft)] px-3 py-1 rounded-lg">
                  {Number(item.hours || 0).toFixed(1)}h
                </div>
              </div>
            </div>
          ))}
          {responseTimes.length === 0 && (
            <EmptyState label="Sin cambios de estado suficientes para calcular SLA" />
          )}
        </div>
      </div>

      <div className="premium-card">
        <h3 className="chart-title mb-6">
          <BarChart3 size={16} className="text-[var(--accent-blue)]" /> Pareto de Observaciones
        </h3>
        <div className="space-y-3">
          {observations.map((item: any, index: number) => {
            const value = Number(item.value) || 0;
            const width = Math.max((value / maxObservation) * 100, 6);
            return (
              <div key={`${item.name}-${index}`}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[10px] font-black uppercase text-text-900 truncate">{item.name}</span>
                  <span className="text-[10px] font-black text-[var(--color-bcp-orange)]">{value}</span>
                </div>
                <div className="h-2.5 bg-surface-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-bcp-blue)] rounded-full" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
          {observations.length === 0 && (
            <EmptyState label="Sin observaciones registradas en expedientes" />
          )}
        </div>
      </div>
    </div>
  );
};

const FunnelAnalyticsSection = ({
  data,
  loading,
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  onRefresh,
  onExport,
  maxCantidad,
  formatCurrency
}: {
  data: FunnelData | null;
  loading: boolean;
  filters: { fecha_inicio: string; fecha_fin: string; convenio: string };
  setFilters: (filters: { fecha_inicio: string; fecha_fin: string; convenio: string }) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  onRefresh: () => void;
  onExport: () => void;
  maxCantidad: number;
  formatCurrency: (value: number) => string;
}) => {
  const totalAmount = data?.monto_total_pipeline || 0;

  return (
    <div className="premium-card">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <h3 className="chart-title">
            <TrendingDown size={16} className="text-[var(--accent-blue)]" /> Funnel Comercial
          </h3>
          <p className="text-xs font-semibold text-text-700 mt-2">Prospectos que llegaron a cada hito del flujo comercial.</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowFilters(!showFilters)} className="action-button-secondary">
            <Filter size={15} /> Filtros
          </button>
          <button onClick={onExport} className="action-button-secondary text-emerald-700">
            <Download size={15} /> Excel
          </button>
          <button onClick={onRefresh} className="action-button-primary">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel grid-cols-1 sm:grid-cols-3 mb-5">
          <div>
            <label className="field-label">Fecha inicio</label>
            <input type="date" value={filters.fecha_inicio} onChange={e => setFilters({ ...filters, fecha_inicio: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">Fecha fin</label>
            <input type="date" value={filters.fecha_fin} onChange={e => setFilters({ ...filters, fecha_fin: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">Convenio</label>
            <input value={filters.convenio} onChange={e => setFilters({ ...filters, convenio: e.target.value })} placeholder="Ej: PNP" className="field-input" />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button onClick={onRefresh} className="action-button-primary">Aplicar filtros</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="metric-card">
          <div className="icon-badge bg-blue-50">
            <UsersIcon size={22} className="text-[var(--color-bcp-blue)]" />
          </div>
          <div>
            <div className="stat-label">Prospectos</div>
            <div className="stat-value">{data?.total_expedientes || 0}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="icon-badge bg-emerald-50">
            <DollarSign size={22} className="text-emerald-600" />
          </div>
          <div>
            <div className="stat-label">Monto pipeline</div>
            <div className="stat-value">{formatCurrency(totalAmount)}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="icon-badge bg-orange-50">
            <Percent size={22} className="text-[var(--color-bcp-orange)]" />
          </div>
          <div>
            <div className="stat-label">Conversion global</div>
            <div className="stat-value text-[var(--color-bcp-orange)]">{(data?.conversion_global || 0).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(data?.funnel || []).map((stage, idx) => {
          const widthPercent = maxCantidad > 0 ? Math.max((stage.cantidad / maxCantidad) * 100, 10) : 10;
          const color = FUNNEL_COLORS[idx % FUNNEL_COLORS.length];
          return (
            <div key={`${stage.etapa}-${idx}`} className="grid grid-cols-1 lg:grid-cols-[145px_minmax(0,1fr)_74px] gap-3 lg:items-center">
              <div className="lg:text-right">
                <div className="text-xs font-black text-text-900 uppercase">{stage.label}</div>
                <div className="text-[10px] font-bold text-text-700">{stage.cantidad} prospectos</div>
                {stage.descripcion && (
                  <div className="text-[9px] font-semibold text-text-700 mt-0.5 leading-snug normal-case">{stage.descripcion}</div>
                )}
              </div>
              <div className="relative h-10 bg-surface-50 border border-surface-200 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-r-lg flex items-center px-3 transition-all duration-500"
                  style={{ width: `${widthPercent}%`, backgroundColor: color }}
                >
                  <span className="text-white text-xs font-black">{stage.porcentaje_del_total.toFixed(1)}%</span>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-text-900">
                  {formatCurrency(stage.monto_total)}
                </div>
              </div>
              <div className="flex lg:justify-center">
                <span className="status-pill bg-surface-50 border-surface-200 text-text-700">
                  {idx === 0 ? 'Base' : `${stage.tasa_conversion_desde_anterior.toFixed(1)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && (!data || data.funnel.length === 0) && (
        <div className="py-12 text-center text-xs font-bold uppercase text-text-700">Sin datos de funnel para el filtro actual</div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-8 py-4 text-[10px] font-bold transition-all border-b-4 uppercase tracking-[0.2em] ${
      active ? 'border-[var(--color-bcp-blue)] text-[var(--accent-blue)] bg-surface-100 shadow-[0_-8px_20px_-10px_rgba(0,42,141,0.1)]' : 'border-transparent text-text-700 hover:text-text-700 hover:bg-surface-100/50'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default Analytics;
