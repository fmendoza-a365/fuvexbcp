import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Target, 
  Map as MapIcon, 
  Clock,
  Trophy,
  Activity,
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
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const ComposableMapAny = ComposableMap as any;
const GeographiesAny = Geographies as any;
const GeographyAny = Geography as any;
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
  Cell,
  PieChart,
  Pie
} from 'recharts';

const PERU_GEO_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson";

interface FunnelStage {
  etapa: string;
  label: string;
  cantidad: number;
  monto_total: number;
  porcentaje_del_total: number;
  tasa_conversion_desde_anterior: number;
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
}

interface ApiFunnelResponse {
  funnel?: ApiFunnelStage[];
  resumen?: {
    total_expedientes?: number;
    conversion_global_pct?: number;
  };
}

const FUNNEL_COLORS = ['#002A8D', '#3159B8', '#64748B', '#FF7800', '#10B981', '#0EA5E9', '#EF4444'];

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
  const [funnelFilters, setFunnelFilters] = useState({ fecha_inicio: '', fecha_fin: '', convenio: '' });
  const [showFunnelFilters, setShowFunnelFilters] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<any | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<any | null>(null);

  useEffect(() => {
    // Try to load from cache first for instant UI
    const cached = localStorage.getItem('analytics_cache');
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
  }, []);

  const fetchData = async () => {
    // Only show loader if we don't have cached data
    if (!localStorage.getItem('analytics_cache')) {
      setLoading(true);
    }
    
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [dash, ts, geo, rank, ops, funnel] = await Promise.all([
        axios.get('/api/analytics/dashboard', { headers }),
        axios.get('/api/analytics/timeseries', { headers }),
        axios.get('/api/analytics/geography', { headers }),
        axios.get('/api/analytics/rankings', { headers }),
        axios.get('/api/analytics/operations', { headers }),
        axios.get('/api/analytics/funnel', { headers })
      ]);

      setDashboardData(dash.data);
      setTimeSeriesData(Array.isArray(ts.data) ? ts.data : []);
      setGeoData(Array.isArray(geo.data) ? geo.data : []);
      setRankings(rank.data);
      setOpsData(ops.data);
      setFunnelData(normalizeFunnelData(funnel.data));
      
      // Save to cache
      localStorage.setItem('analytics_cache', JSON.stringify({
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
      setLoading(false);
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

  const COLORS = ['#002A8D', '#FF7800', '#10b981', '#64748b', '#3b82f6'];
  const maxRegionValue = Math.max(...(geoData || []).map((item) => Number(item.value) || 0), 1);
  const totalRegionValue = (geoData || []).reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  const totalRegionCount = (geoData || []).reduce((acc, item) => acc + (Number(item.count) || 0), 0);
  const topRegions = [...(geoData || [])]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 5);
  const activeRegion = hoveredRegion || selectedRegion || topRegions[0] || null;
  const maxFunnelCantidad = funnelData ? Math.max(...funnelData.funnel.map(s => s.cantidad), 1) : 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* 1. HEADER ESTRATÉGICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight flex items-center gap-3 uppercase">
            Inteligencia <span className="text-[var(--accent-blue)]">Comercial</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Panel Ejecutivo de Desempeño y Control Estratégico</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-surface-100 border border-surface-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Sistema Activo</span>
           </div>
           <button onClick={fetchData} className="action-button-primary p-3">
             <Activity size={18} />
           </button>
        </div>
      </div>

      {/* 2. PANEL DE CONTROL (EXECUTIVE SUMMARY) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard 
          title="DESEMBOLSO TOTAL" 
          value={formatCurrency(dashboardData?.totalDisbursed || 0)}
          icon={<Trophy size={20} />}
          color="blue"
          footer={`Avance de Meta: ${dashboardData?.completionRate?.toFixed(1)}%`}
          progress={dashboardData?.completionRate}
        />
        <div className="md:col-span-2 premium-card relative group overflow-hidden">
          <div className="relative z-10">
            <h4 className="stat-label">Proyección de Cierre (Forecasting)</h4>
            <div className="flex justify-between items-end mb-4">
               <div className="text-4xl font-bold text-slate-800 tracking-tight">{formatCurrency(dashboardData?.forecasting || 0)}</div>
               <div className="text-[10px] font-black text-[var(--color-bcp-orange)] bg-[rgba(255,120,0,0.1)] px-3 py-1.5 rounded-xl uppercase tracking-wider border border-orange-100">Cierre Estimado Mes</div>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
               <div className="h-full bg-[var(--color-bcp-orange)] transition-all duration-1000" style={{ width: `${Math.min(dashboardData?.completionRate || 0, 100)}%` }}></div>
               <div className="h-full bg-orange-200 opacity-30" style={{ width: `${Math.max(0, Math.min(100 - (dashboardData?.completionRate || 0), (dashboardData?.forecasting / (dashboardData?.goalAmount || 1) * 100) - (dashboardData?.completionRate || 0)))}%` }}></div>
            </div>
            <div className="flex justify-between mt-3 text-[10px] font-bold text-text-700 uppercase tracking-widest">
               <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"></div> Actual: {formatCurrency(dashboardData?.totalDisbursed || 0)}</span>
               <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div> Meta: {formatCurrency(dashboardData?.goalAmount || 0)}</span>
            </div>
          </div>
          <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
            <TrendingUp size={200} />
          </div>
        </div>
      </div>

      {/* 2.1 KPI GRID SECUNDARIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Tasa de Aprobación" 
          value={`${dashboardData?.conversionRate?.toFixed(1)}%`}
          icon={<ShieldAlert size={20} />}
          color="emerald"
          footer="Efectividad de cierre"
        />
        <KpiCard 
          title="Productividad Avg" 
          value={`${dashboardData?.productivity?.toFixed(1)} exp`}
          icon={<Users size={20} />}
          color="slate"
          footer="Expedientes por asesor"
        />
        <KpiCard 
          title="Crecimiento MoM" 
          value={`${dashboardData?.momGrowth >= 0 ? '+' : ''}${dashboardData?.momGrowth?.toFixed(1)}%`}
          icon={<TrendingUp size={20} />}
          color={dashboardData?.momGrowth >= 0 ? 'emerald' : 'amber'}
          footer="Vs mes anterior"
        />
        <KpiCard 
          title="Listos para Cobro" 
          value={formatCurrency(dashboardData?.pendingValue || 0)}
          icon={<Wallet size={20} />}
          color="blue"
          footer="Monto en estado APROBADA"
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
           <h3 className="stat-label flex items-center gap-2">
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

      {/* 4. MAPA ESTRATÉGICO Y PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="premium-card">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="stat-label flex items-center gap-2">
                <MapIcon size={16} className="text-[var(--accent-blue)]" /> Market Intelligence: Calor por Región
              </h3>
              <p className="text-xs font-semibold text-text-700 mt-2">Desembolso y volumen por departamento.</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-700">
              <span>Bajo</span>
              <div className="w-24 h-2 rounded-full bg-gradient-to-r from-slate-100 via-[#7EA6E8] to-[var(--color-bcp-orange)] border border-surface-200" />
              <span>Alto</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5 items-stretch">
            <div className="relative min-h-[360px] rounded-lg border border-surface-200 bg-[#F8FAFC] overflow-hidden">
              <ComposableMapAny projectionConfig={{ scale: 1320, center: [-75, -9.1] }} className="w-full h-[360px]">
                <GeographiesAny geography={PERU_GEO_URL}>
                  {({ geographies }: { geographies: any[] }) =>
                    (geographies || []).map((geo: any) => {
                      const departmentName = geo.properties.NOMBDEP;
                      const data = (geoData || []).find(d => normalizeGeoName(d.region) === normalizeGeoName(departmentName));
                      const selected = activeRegion && normalizeGeoName(activeRegion.region) === normalizeGeoName(departmentName);
                      const ratio = data ? Math.min((Number(data.value) || 0) / maxRegionValue, 1) : 0;
                      const fill = data
                        ? ratio > 0.72
                          ? '#FF7800'
                          : ratio > 0.42
                            ? '#2563EB'
                            : ratio > 0.12
                              ? '#7EA6E8'
                              : '#D9E7FF'
                        : '#EEF2F7';

                      return (
                        <GeographyAny
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={() => setHoveredRegion(data || { region: departmentName, value: 0, count: 0 })}
                          onMouseLeave={() => setHoveredRegion(null)}
                          onClick={() => setSelectedRegion(data || { region: departmentName, value: 0, count: 0 })}
                          fill={selected ? '#FF7800' : fill}
                          stroke={selected ? '#111827' : '#94A3B8'}
                          strokeWidth={selected ? 1.2 : 0.65}
                          style={{
                            default: { outline: "none", transition: "all 180ms ease" },
                            hover: { fill: "#FF7800", outline: "none", cursor: 'pointer' },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    })
                  }
                </GeographiesAny>
              </ComposableMapAny>

              {activeRegion && (
                <div className="absolute left-4 bottom-4 bg-surface-100 border border-surface-200 rounded-lg shadow-xl p-4 min-w-[210px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-700">Región activa</div>
                  <div className="text-sm font-black text-text-900 uppercase mt-1">{activeRegion.region}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] font-bold uppercase text-text-700">Monto</div>
                      <div className="text-sm font-black text-[var(--color-bcp-blue)]">{formatCurrency(Number(activeRegion.value) || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase text-text-700">Casos</div>
                      <div className="text-sm font-black text-[var(--color-bcp-orange)]">{Number(activeRegion.count) || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="surface-card p-4 flex flex-col">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-50 border border-surface-200 rounded-lg p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Desembolso regional</div>
                  <div className="text-lg font-black text-text-900 mt-1">{formatCurrency(totalRegionValue)}</div>
                </div>
                <div className="bg-surface-50 border border-surface-200 rounded-lg p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-text-700">Expedientes</div>
                  <div className="text-lg font-black text-text-900 mt-1">{totalRegionCount}</div>
                </div>
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-text-700 mb-3">Top regiones</div>
              <div className="space-y-3">
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
                          <div className="text-[10px] font-bold text-text-700 mt-0.5">{region.count} expedientes</div>
                        </div>
                        <div className="text-xs font-black text-[var(--color-bcp-blue)] shrink-0">{formatCurrency(Number(region.value) || 0)}</div>
                      </div>
                      <div className="h-1.5 w-full bg-surface-200 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-[var(--color-bcp-blue)] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
                {topRegions.length === 0 && (
                  <div className="py-12 text-center text-text-700 text-xs font-bold uppercase">Sin datos regionales</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="premium-card">
              <h3 className="stat-label flex items-center gap-2 mb-6">
                <BarChart3 size={16} className="text-[var(--accent-blue)]" /> Mix de Convenios (MAF)
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opsData?.agreements || []} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#475569'}} />
                    <Tooltip cursor={{fill: 'rgba(0,42,141,0.02)'}} formatter={(v: any) => formatCurrency(Number(v))} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                      {(opsData?.agreements || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#FF7800' : '#002A8D'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
           
           <div className="premium-card">
              <h3 className="stat-label flex items-center gap-2 mb-6">
                <ShieldAlert size={16} className="text-[var(--accent-blue)]" /> Calidad de Riesgo (Semaforización)
              </h3>
              <div className="flex items-center gap-8">
                 <div className="h-40 w-40">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={opsData?.risk.map((r: any) => ({ name: r.rcc_semaforo, value: r._count })) || []}
                         innerRadius={50}
                         outerRadius={70}
                         paddingAngle={8}
                         dataKey="value"
                       >
                         {opsData?.risk.map((_: any, index: number) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="flex-1 space-y-2">
                    {opsData?.risk.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-surface-50 p-2.5 rounded-xl border border-transparent hover:border-surface-200 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                           <span className="text-[10px] font-bold text-text-700 uppercase">{r.rcc_semaforo}</span>
                        </div>
                        <span className="text-xs font-bold text-text-900">{r._count}</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

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
                      <div className={`w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 uppercase text-sm tracking-tight">{item.name}</div>
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
            
            {activeTab === 'eficiencia' && (
              <div className="space-y-5">
                 {opsData?.efficiency.map((item: any, i: number) => (
                   <div key={i} className="space-y-2">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800 uppercase">{item.name}</span>
                        <span className="text-xs font-bold text-[var(--accent-emerald)]">{item.efficiency.toFixed(1)}% OK</span>
                     </div>
                     <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--accent-emerald)] transition-all duration-1000" style={{ width: `${item.efficiency}%` }}></div>
                     </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>

        <div className="premium-card">
           <h3 className="stat-label text-rose-600 flex items-center gap-2 mb-8">
             <ShieldAlert size={16} /> Radar de Inactividad ({opsData?.radar.length})
           </h3>
           <div className="space-y-4">
              {opsData?.radar.map((r: any, i: number) => (
                <div key={i} className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center gap-4 group hover:bg-rose-50 transition-all">
                   <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center text-rose-500 shadow-sm">
                     <AlertCircle size={20} />
                   </div>
                   <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800 uppercase mb-0.5">{r.name}</div>
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
           <h3 className="stat-label flex items-center gap-2 mb-8">
             <Timer size={16} className="text-[var(--accent-blue)]" /> Tiempos de Respuesta (SLA)
           </h3>
           <div className="space-y-6">
              {opsData?.responseTimes.map((t: any, i: number) => (
                <div key={i} className="relative pl-6 border-l-2 border-surface-200 last:border-l-0 pb-6 last:pb-0">
                   <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface-100 border-4 border-[var(--color-bcp-blue)] shadow-sm"></div>
                   <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-tight">{t.stage}</div>
                        <div className="text-[9px] font-bold text-text-700 uppercase">Ciclo Promedio</div>
                      </div>
                      <div className="text-sm font-bold text-[var(--accent-blue)] bg-[rgba(0,42,141,0.1)] px-2 py-1 rounded-lg">{t.hours}h</div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="lg:col-span-2 premium-card">
          <h3 className="stat-label flex items-center gap-2 mb-8">
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

const KpiCard = ({ title, value, icon, color, footer, progress }: any) => (
  <div className="premium-card relative group cursor-default">
    <div className="flex justify-between items-start mb-6">
      <div>
        <h4 className="stat-label">{title}</h4>
        <div className="stat-value">{value}</div>
      </div>
      <div className={`p-3 rounded-2xl group-hover:scale-110 transition-transform ${
        color === 'blue' ? 'bg-[rgba(0,42,141,0.1)] text-[var(--accent-blue)]' : 
        color === 'emerald' ? 'bg-emerald-50 text-[var(--accent-emerald)]' : 
        color === 'amber' ? 'bg-amber-50 text-[var(--accent-amber)]' : 'bg-surface-50 text-text-700'
      }`}>
        {icon}
      </div>
    </div>
    {progress !== undefined && (
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full transition-all duration-1000 ${color === 'blue' ? 'bg-[var(--accent-blue)]' : 'bg-[var(--accent-emerald)]'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
      </div>
    )}
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color === 'blue' ? 'bg-[var(--accent-blue)]' : 'bg-[var(--accent-emerald)]'}`}></div>
      <p className="text-[9px] font-bold text-text-700 uppercase tracking-[0.1em]">{footer}</p>
    </div>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="py-10 text-center text-xs font-bold uppercase tracking-widest text-text-700 bg-surface-50 border border-dashed border-surface-200 rounded-lg">
    {label}
  </div>
);

const OperationalHealthPanel = ({ opsData }: { opsData: any }) => {
  const responseTimes = Array.isArray(opsData?.responseTimes) ? opsData.responseTimes.slice(0, 5) : [];
  const observations = Array.isArray(opsData?.observations) ? opsData.observations.slice(0, 6) : [];
  const maxObservation = Math.max(...observations.map((item: any) => Number(item.value) || 0), 1);

  return (
    <div className="space-y-6">
      <div className="premium-card">
        <h3 className="stat-label flex items-center gap-2 mb-6">
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
                <div className="text-sm font-black text-[var(--accent-blue)] bg-[rgba(0,42,141,0.1)] px-3 py-1 rounded-lg">
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
        <h3 className="stat-label flex items-center gap-2 mb-6">
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
  const totalAmount = data?.funnel.reduce((acc, stage) => acc + stage.monto_total, 0) || 0;

  return (
    <div className="premium-card">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <h3 className="stat-label flex items-center gap-2">
            <TrendingDown size={16} className="text-[var(--accent-blue)]" /> Funnel de Conversion
          </h3>
          <p className="text-xs font-semibold text-text-700 mt-2">Vista compacta de prioridad comercial.</p>
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
            <div className="stat-label">Expedientes</div>
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
                <div className="text-[10px] font-bold text-text-700">{stage.cantidad} expedientes</div>
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
