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
  Zap
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

const PERU_GEO_URL = "https://raw.githubusercontent.com/clucas8/peru-geojson/master/peru_departamentos.geojson";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('asesores');

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

      const [dash, ts, geo, rank, ops] = await Promise.all([
        axios.get('/api/analytics/dashboard', { headers }),
        axios.get('/api/analytics/timeseries', { headers }),
        axios.get('/api/analytics/geography', { headers }),
        axios.get('/api/analytics/rankings', { headers }),
        axios.get('/api/analytics/operations', { headers })
      ]);

      setDashboardData(dash.data);
      setTimeSeriesData(Array.isArray(ts.data) ? ts.data : []);
      setGeoData(Array.isArray(geo.data) ? geo.data : []);
      setRankings(rank.data);
      setOpsData(ops.data);
      
      // Save to cache
      localStorage.setItem('analytics_cache', JSON.stringify({
        dash: dash.data,
        ts: ts.data,
        geo: geo.data,
        rank: rank.data,
        ops: ops.data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
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
        <div className="premium-card flex flex-col items-center">
          <h3 className="stat-label self-start flex items-center gap-2 mb-8">
            <MapIcon size={16} className="text-[var(--accent-blue)]" /> Market Intelligence: Calor por Región
          </h3>
          <div className="h-96 w-full flex items-center justify-center">
            <ComposableMapAny projectionConfig={{ scale: 1300, center: [-75, -9] }} className="w-full h-full">
              <GeographiesAny geography={PERU_GEO_URL}>
                {({ geographies }: { geographies: any[] }) =>
                  (geographies || []).map((geo: any) => {
                    const departmentName = geo.properties.NOMBDEP;
                    const data = (geoData || []).find(d => d.region?.toUpperCase() === departmentName?.toUpperCase());
                    const intensity = data ? Math.min(data.value / 100000, 1) : 0;
                    return (
                      <GeographyAny
                        key={geo.rsmKey}
                        geography={geo}
                        fill={data ? `rgba(59, 130, 246, ${0.1 + intensity * 0.9})` : "var(--bg-card)"}
                        stroke="var(--border-main)"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "var(--color-bcp-orange)", outline: "none", cursor: 'pointer' },
                        }}
                      />
                    );
                  })
                }
              </GeographiesAny>
            </ComposableMapAny>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
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
