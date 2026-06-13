import { useState, useEffect } from 'react';
import { 
  Settings, ShieldAlert, CheckCircle2, History, 
  Database, Cpu, Activity, Copy, ChevronLeft, 
  ChevronRight, RefreshCw, Clock, Globe,
  User, Building, Check, Search, AlertTriangle
} from 'lucide-react';
import axios from 'axios';

export default function SbiIntegration() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'consulta' | 'masivo' | 'historial' | 'configuracion'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ page: 1, limit: 10, total: 0, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  // Consulta form state
  const [documento, setDocumento] = useState('');
  const [meses, setMeses] = useState('12');
  const [planilla, setPlanilla] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<any>(null);
  const [resultTab, setResultTab] = useState<'generales' | 'financiero' | 'contactos' | 'laboral' | 'activos' | 'raw'>('generales');
  const [modalResultTab, setModalResultTab] = useState<'generales' | 'financiero' | 'contactos' | 'laboral' | 'activos' | 'raw'>('generales');

  // Consulta masiva state
  const [bulkInput, setBulkInput] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkCancelRequested, setBulkCancelRequested] = useState(false);

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchStats();
    fetchConfig();
    fetchHistory(1);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/sbi/stats', { headers });
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching SBI stats:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/sbi/config', { headers });
      setConfig(res.data);
    } catch (err) {
      console.error('Error fetching SBI config:', err);
    }
  };

  const fetchHistory = async (pageNumber: number) => {
    try {
      const res = await axios.get('/api/sbi/history', {
        headers,
        params: { page: pageNumber, limit: 10 }
      });
      setHistory(res.data.data);
      setPagination(res.data.pagination);
      setCurrentPage(pageNumber);
    } catch (err) {
      console.error('Error fetching SBI history:', err);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/sbi/test-connection', {}, { headers });
      alert(res.data.success ? '✓ Conexión establecida con éxito' : `✗ Conexión fallida: ${res.data.message}`);
      fetchStats();
      fetchHistory(1);
    } catch (err: any) {
      alert(`✗ Error en la llamada del servidor: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setQueryResult(null);
    setQueryError(null);

    try {
      const res = await axios.post('/api/sbi/query', {
        documento,
        meses: Number(meses),
        planilla: planilla ? Number(planilla) : undefined
      }, { headers });

      if (res.data.success) {
        setQueryResult(res.data);
        setResultTab('generales');
      } else {
        setQueryError(res.data);
      }
      fetchStats();
      fetchHistory(1);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      setQueryError({
        success: false,
        status_code: err.response?.status || 500,
        error_id: err.response?.data?.error_id || 500,
        message: errorMsg,
        raw_response: err.response?.data || {}
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunBulkQuery = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedDocs = bulkInput
      .split(/[\s,]+/)
      .map(d => d.replace(/\D/g, ''))
      .filter(d => d.length === 8 || d.length === 11);

    const uniqueDocs = Array.from(new Set(parsedDocs));

    if (uniqueDocs.length === 0) {
      alert('Por favor, ingresa al menos un DNI (8 dígitos) o RUC (11 dígitos) válido.');
      return;
    }

    setBulkProcessing(true);
    setBulkProgress(0);
    setBulkTotal(uniqueDocs.length);
    setBulkResults([]);
    setBulkCancelRequested(false);

    const resultsAccumulator: any[] = [];
    const concurrency = 3;

    for (let i = 0; i < uniqueDocs.length; i += concurrency) {
      if (bulkCancelRequested) {
        setBulkProcessing(false);
        setBulkCancelRequested(false);
        break;
      }

      const chunk = uniqueDocs.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (doc) => {
        try {
          const res = await axios.post('/api/sbi/query', {
            documento: doc,
            meses: 12
          }, { headers });

          let status = 'Error';
          let name = 'Desconocido';
          let deuda = 0;
          let calificacion = 0;
          let fullData = null;
          let errorMsg = '';

          if (res.data.success) {
            status = 'Exitoso';
            fullData = res.data.data;
            
            const g = fullData.generales;
            if (g) {
              name = `${g.nombres || ''} ${g.paterno || ''} ${g.materno || ''}`.trim();
            } else if (fullData.ruc) {
              name = fullData.ruc.razon_social || 'Razón Social N/A';
            }
            
            const latestSbs = fullData.sbs?.[0];
            if (latestSbs) {
              deuda = Number(latestSbs.deuda_total || 0);
              calificacion = Number(latestSbs.calificacion_normal || 0);
            }
          } else {
            errorMsg = res.data.message || 'Error en la respuesta del proveedor';
          }

          return {
            documento: doc,
            success: res.data.success,
            status,
            name: name || 'Cliente SBI',
            deuda,
            calificacion,
            error: errorMsg,
            data: fullData
          };
        } catch (err: any) {
          return {
            documento: doc,
            success: false,
            status: 'Error',
            name: 'Error de Red',
            deuda: 0,
            calificacion: 0,
            error: err.response?.data?.error || err.message,
            data: null
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      resultsAccumulator.push(...chunkResults);
      setBulkResults([...resultsAccumulator]);
      setBulkProgress(prev => Math.min(prev + chunk.length, uniqueDocs.length));
    }

    setBulkProcessing(false);
    fetchStats();
    fetchHistory(1);
  };

  const exportBulkResultsCSV = () => {
    if (bulkResults.length === 0) return;

    let csvContent = 'Documento,Tipo,Nombre Completo,Estado,Deuda SBS,Calificacion Normal %,Detalle Error\n';

    bulkResults.forEach(r => {
      const type = r.documento.length === 8 ? 'DNI' : 'RUC';
      const cleanName = r.name.replace(/"/g, '""');
      const cleanErr = (r.error || '').replace(/"/g, '""');
      csvContent += `"${r.documento}","${type}","${cleanName}","${r.status}",${r.deuda},${r.calificacion},"${cleanErr}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_masivo_sbi_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenLogDetail = async (id: string) => {
    try {
      const res = await axios.get(`/api/sbi/history/${id}`, { headers });
      setSelectedLog(res.data);
      setModalResultTab('generales');
    } catch (err) {
      alert('Error cargando el detalle de la consulta');
    }
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const docType = documento.length === 8 ? 'DNI' : documento.length === 11 ? 'RUC' : null;

  const formatPlate = (plate: string) => {
    if (!plate) return '-';
    const cleaned = plate.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length === 6) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`;
    }
    return cleaned;
  };

  return (
    <div className="page-shell text-text-900">
      {/* Title section */}
      <div className="page-header pb-4 border-b border-surface-200">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Integración <span className="text-[var(--color-bcp-blue)] font-black">SBI API</span>
          </h1>
          <p className="page-subtitle text-xs text-text-500 mt-1 uppercase tracking-wider font-semibold">
            Consola de Monitoreo Técnico y Consulta Crediticia Externa.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={loading}
            onClick={handleTestConnection} 
            className="action-button-primary hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Activity size={16} className={loading ? "animate-pulse" : ""} />
            Probar Conexión
          </button>
        </div>
      </div>

      {/* Tabs Menu Segmented Control */}
      <div className="bg-slate-100 dark:bg-neutral-800/60 p-1.5 rounded-2xl flex gap-1.5 w-full sm:w-fit mb-8 border border-surface-200 overflow-x-auto shadow-sm">
        {[
          { id: 'dashboard', label: 'Resumen General', icon: <Activity size={15} /> },
          { id: 'consulta', label: 'Consultar /datos', icon: <Search size={15} /> },
          { id: 'masivo', label: 'Consulta Masiva', icon: <Database size={15} /> },
          { id: 'historial', label: 'Historial', icon: <History size={15} /> },
          { id: 'configuracion', label: 'Configuración', icon: <Settings size={15} /> }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex items-center justify-center gap-2 py-2 px-4 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-neutral-700 text-[var(--color-bcp-blue)] dark:text-white shadow-sm border border-slate-200/50 dark:border-neutral-600' 
                : 'text-text-500 hover:text-text-900 hover:bg-white/40 dark:hover:bg-neutral-800/40'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────
          TAB: DASHBOARD
          ────────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* ESTADO CONEXIÓN */}
            <div className="premium-card flex flex-col justify-between p-6 bg-white border border-surface-200 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-text-500 uppercase tracking-widest mb-1">Estado Conexión</p>
                  <h3 className="text-base font-black uppercase text-slate-800 flex items-center gap-2 mt-1">
                    {stats?.last_request?.success ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-600">Activo</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span className="text-rose-600">Desconectado</span>
                      </>
                    )}
                  </h3>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
                  <Activity size={18} />
                </div>
              </div>
              
              <div className="mt-4 border-t border-slate-100 dark:border-neutral-850 pt-3 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[9px] font-bold text-text-500 uppercase">
                  <span>Código HTTP</span>
                  <span className="text-slate-800 dark:text-neutral-200 font-extrabold">{stats?.last_request?.status_code || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold text-text-500 uppercase">
                  <span>IP Droplet</span>
                  <button 
                    onClick={() => stats?.server_public_ip && handleCopy(stats.server_public_ip, 'ip_droplet')} 
                    className="font-mono text-slate-800 dark:text-neutral-200 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 px-2 py-0.5 rounded border border-slate-200/60 dark:border-neutral-700 transition-all flex items-center gap-1 select-all"
                  >
                    {stats?.server_public_ip || 'N/A'}
                    {copiedField === 'ip_droplet' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                  </button>
                </div>
              </div>
            </div>

            {/* CONSULTAS TOTALES */}
            <div className="premium-card flex flex-col justify-between p-6 bg-white border border-surface-200 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-text-500 uppercase tracking-widest mb-1">Consultas Totales</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{stats?.total || 0}</h3>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
                  <Database size={18} />
                </div>
              </div>

              {(() => {
                const total = stats?.total || 0;
                const success = stats?.success || 0;
                const rate = total > 0 ? Math.round((success / total) * 100) : 0;
                return (
                  <div className="mt-4 border-t border-slate-100 dark:border-neutral-850 pt-3 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-bold text-text-500 uppercase">
                      <span className="text-emerald-600">Éxito: <strong className="font-extrabold">{success}</strong></span>
                      <span className="text-rose-600">Error: <strong className="font-extrabold">{stats?.failed || 0}</strong></span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-neutral-850 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* T. PROMEDIO RESPUESTA */}
            <div className="premium-card flex flex-col justify-between p-6 bg-white border border-surface-200 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-text-500 uppercase tracking-widest mb-1">T. Promedio Respuesta</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {stats?.avg_duration_ms || 0} <span className="text-xs font-bold text-text-500">ms</span>
                  </h3>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
                  <Clock size={18} />
                </div>
              </div>

              {(() => {
                const latency = stats?.avg_duration_ms || 0;
                const latencyColor = latency < 800 ? 'bg-emerald-500' : latency < 2000 ? 'bg-amber-500' : 'bg-rose-500';
                const latencyPercent = Math.min((latency / 3000) * 100, 100);
                return (
                  <div className="mt-4 border-t border-slate-100 dark:border-neutral-850 pt-3 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-bold text-text-500 uppercase">
                      <span>Rendimiento</span>
                      <span className={latency < 800 ? 'text-emerald-600 font-extrabold' : latency < 2000 ? 'text-amber-500 font-extrabold' : 'text-rose-600 font-extrabold'}>
                        {latency < 800 ? 'Rápido' : latency < 2000 ? 'Estable' : 'Lento'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-neutral-850 rounded-full overflow-hidden">
                      <div className={`h-full ${latencyColor} transition-all duration-500`} style={{ width: `${latencyPercent}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* DIRECCIÓN DE ENTRADA */}
            <div className="premium-card flex flex-col justify-between p-6 bg-white border border-surface-200 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-text-500 uppercase tracking-widest mb-1">Dirección de Entrada</p>
                  <h3 className="text-xs font-black truncate max-w-[170px] text-slate-800 mt-2 font-mono" title={config?.base_url}>
                    {config?.base_url || 'Cargando...'}
                  </h3>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
                  <Globe size={18} />
                </div>
              </div>
              
              <div className="mt-4 border-t border-slate-100 dark:border-neutral-850 pt-3 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[9px] font-bold text-text-500 uppercase">
                  <span>Modo Auth</span>
                  <span className="text-slate-800 dark:text-neutral-200 font-extrabold font-mono text-[8px] bg-slate-50 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-neutral-700">
                    {config?.auth_mode || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="premium-card">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                Panel de Acciones del Módulo
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('consulta')}
                  className="flex flex-col items-center justify-center p-6 bg-surface-50 hover:bg-white dark:hover:bg-neutral-800 border border-surface-200 hover:border-[var(--color-bcp-blue)] hover:shadow-md rounded-2xl transition-all duration-200 group"
                >
                  <Database className="text-[var(--color-bcp-blue)] group-hover:scale-110 transition-transform mb-3" size={24} />
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Consultar /datos</span>
                </button>
                <button 
                  onClick={() => setActiveTab('historial')}
                  className="flex flex-col items-center justify-center p-6 bg-surface-50 hover:bg-white dark:hover:bg-neutral-800 border border-surface-200 hover:border-[var(--color-bcp-orange)] hover:shadow-md rounded-2xl transition-all duration-200 group"
                >
                  <History className="text-[var(--color-bcp-orange)] group-hover:scale-110 transition-transform mb-3" size={24} />
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Ver Historial</span>
                </button>
                <button 
                  onClick={() => setActiveTab('configuracion')}
                  className="flex flex-col items-center justify-center p-6 bg-surface-50 hover:bg-white dark:hover:bg-neutral-800 border border-surface-200 hover:border-slate-500 hover:shadow-md rounded-2xl transition-all duration-200 group"
                >
                  <Settings className="text-slate-600 group-hover:scale-110 transition-transform mb-3" size={24} />
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Configuración</span>
                </button>
                <button 
                  disabled={loading}
                  onClick={handleTestConnection}
                  className="flex flex-col items-center justify-center p-6 bg-surface-50 hover:bg-white dark:hover:bg-neutral-800 border border-surface-200 hover:border-emerald-500 hover:shadow-md rounded-2xl transition-all duration-200 group disabled:opacity-50"
                >
                  <Cpu className="text-emerald-600 group-hover:scale-110 transition-transform mb-3" size={24} />
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Test Conexión</span>
                </button>
              </div>
            </div>

            <div className="premium-card flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                  Último Registro Técnico
                </h2>
                {stats?.last_request ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2.5 border-b border-surface-150">
                      <span className="text-[10px] font-bold text-text-500 uppercase">Estado General</span>
                      <span className={`status-pill ${stats.last_request.success ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {stats.last_request.success ? 'ÉXITO' : 'ERROR'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-surface-150">
                      <span className="text-[10px] font-bold text-text-500 uppercase">Código HTTP</span>
                      <span className="text-xs font-black text-slate-800">{stats.last_request.status_code}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-surface-150">
                      <span className="text-[10px] font-bold text-text-500 uppercase">Fecha y Hora</span>
                      <span className="text-xs font-bold text-text-700">{new Date(stats.last_request.executed_at).toLocaleString()}</span>
                    </div>
                    {stats.last_request.error_message && (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl space-y-1.5">
                        <p className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Detalle del Error</p>
                        <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 leading-relaxed uppercase">{stats.last_request.error_message}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-text-500 text-xs italic">No hay registros de consultas en la base de datos</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB: CONSULTA /DATOS
          ────────────────────────────────────────────────────────── */}
      {activeTab === 'consulta' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="premium-card">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
              Búsqueda de Datos Crediticios (/datos)
            </h2>
            <p className="text-[10px] font-bold text-text-500 uppercase tracking-wider mb-6">
              El sistema realiza búsquedas en tiempo real contra los registros estructurados de SBI.
            </p>

            <form onSubmit={handleRunQuery} className="filter-panel grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-700 uppercase tracking-widest block px-1">Documento Identidad (DNI/RUC)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-500">
                    {docType === 'RUC' ? <Building size={16} /> : <User size={16} />}
                  </div>
                  <input 
                    type="text" required
                    placeholder="Ej. 45678901 o 10456789012"
                    className="field-input w-full pl-10 pr-16 font-mono font-bold uppercase tracking-wide focus:border-[var(--color-bcp-blue)]"
                    value={documento}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 11) setDocumento(val);
                    }}
                  />
                  {docType && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider ${
                        docType === 'DNI' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' 
                          : 'bg-blue-50 text-blue-600 border border-blue-200/50'
                      }`}>
                        {docType}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-700 uppercase tracking-widest block px-1">Historial SBS (Meses)</label>
                <select 
                  className="field-input w-full font-bold text-xs"
                  value={meses}
                  onChange={e => setMeses(e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? 'Mes' : 'Meses'}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-700 uppercase tracking-widest block px-1">Planilla (Meses - Opcional)</label>
                <select 
                  className="field-input w-full font-bold text-xs"
                  value={planilla}
                  onChange={e => setPlanilla(e.target.value)}
                >
                  <option value="">Ninguno</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>{m} {m === 1 ? 'Mes' : 'Meses'}</option>
                  ))}
                </select>
              </div>

              <div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="action-button-primary w-full justify-center py-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? 'Consultando API...' : 'Ejecutar Consulta'}
                </button>
              </div>
            </form>

            {/* Quick Demos */}
            <div className="mt-4 flex flex-wrap gap-2 items-center text-[10px] font-bold text-text-500 uppercase px-1">
              <span>Búsqueda rápida de demostración:</span>
              <button 
                type="button"
                onClick={() => { setDocumento('45678901'); setMeses('12'); setPlanilla(''); }}
                className="px-3 py-1 bg-slate-150 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-750 text-slate-800 dark:text-neutral-200 rounded-lg transition-all duration-200 hover:shadow-sm"
              >
                Simular DNI (Ficha Personal)
              </button>
              <button 
                type="button"
                onClick={() => { setDocumento('10456789012'); setMeses('12'); setPlanilla('6'); }}
                className="px-3 py-1 bg-slate-150 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-750 text-slate-800 dark:text-neutral-200 rounded-lg transition-all duration-200 hover:shadow-sm"
              >
                Simular RUC (Completo)
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 premium-card space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-bcp-blue)]"></div>
              <p className="text-[10px] font-black text-[var(--color-bcp-blue)] uppercase tracking-widest animate-pulse">
                Conectando con la API externa de SBI...
              </p>
            </div>
          )}

          {/* Error display */}
          {queryError && (
            <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-150 dark:border-rose-900/30 rounded-3xl p-8 space-y-6 animate-in zoom-in duration-300">
              <div className="flex gap-4">
                <div className="h-12 w-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight">
                    {queryError.error_id === 202 ? 'Usuario No Autorizado (error_id: 202)' : 'Error de Conexión SBI'}
                  </h3>
                  <p className="text-text-700 dark:text-neutral-300 text-xs font-bold leading-relaxed uppercase mt-2">
                    {queryError.error_id === 202 
                      ? 'La API de SBI respondió con código 202. Esto indica que el API Key es inválido, inactivo o la IP de esta droplet no está en la lista blanca de salida autorizada por el proveedor.'
                      : queryError.message
                    }
                  </p>
                </div>
              </div>

              <div className="border-t border-rose-100/65 dark:border-rose-900/30 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">IP Droplet de Salida</span>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-300 font-mono">{stats?.server_public_ip || '134.209.64.146'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Base URL Servidor</span>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-300 truncate block font-mono">{config?.base_url}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Usuario SBI</span>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-300 truncate block font-mono">{config?.usuario || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Método / Endpoint</span>
                  <span className="text-xs font-black text-rose-700 dark:text-rose-300 uppercase font-mono">POST /datos</span>
                </div>
              </div>

              <div className="pt-2 flex justify-start">
                <button 
                  type="button"
                  onClick={() => handleCopy(JSON.stringify(queryError.raw_response, null, 2), 'err_json')}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                >
                  <Copy size={12} /> 
                  {copiedField === 'err_json' ? 'Copiado' : 'Copiar Respuesta de Error Completo (JSON)'}
                </button>
              </div>
            </div>
          )}

          {/* Results Display */}
          {queryResult && (
            <div className="space-y-6 animate-in zoom-in duration-300">
              <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/30 rounded-3xl p-6 flex flex-col xl:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Resultados Obtenidos con Éxito</h3>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase mt-0.5">
                      Duración del query: <strong className="font-mono">{queryResult.duration_ms || 0}ms</strong> • Registro: {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Sub-tabs Navigation */}
                <div className="flex gap-1 overflow-x-auto bg-emerald-100/50 dark:bg-emerald-950/20 p-1.5 rounded-2xl max-w-full border border-emerald-200/50 dark:border-emerald-900/20">
                  {[
                    { id: 'generales', label: 'Ficha Personal' },
                    { id: 'financiero', label: 'Historial SBS' },
                    { id: 'contactos', label: 'Contacto & Ubicación' },
                    { id: 'laboral', label: 'Laboral (EsSalud)' },
                    { id: 'activos', label: 'Vehículos & Empresas' },
                    { id: 'raw', label: 'JSON Completo' }
                  ].map((subtab) => (
                    <button
                      key={subtab.id}
                      type="button"
                      onClick={() => setResultTab(subtab.id as any)}
                      className={`px-3 py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                        resultTab === subtab.id
                          ? 'bg-white dark:bg-neutral-800 text-emerald-800 dark:text-emerald-300 shadow-sm border border-emerald-200/30'
                          : 'text-emerald-700 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      {subtab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab 1: generales (Ficha Personal & Familiares) */}
              {resultTab === 'generales' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="premium-card bg-white">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                        Datos de Identidad
                      </h3>
                      {queryResult.data?.generales ? (
                        <div className="space-y-4">
                          {/* Profile Avatar Card */}
                          <div className="flex items-center gap-4 pb-4 border-b border-surface-150 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[var(--color-bcp-blue)] to-blue-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                              {`${queryResult.data.generales.nombres?.[0] || ''}${queryResult.data.generales.paterno?.[0] || ''}`.toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                {queryResult.data.generales.nombres} {queryResult.data.generales.paterno} {queryResult.data.generales.materno}
                              </h4>
                              <p className="text-[9px] font-bold text-text-500 uppercase mt-0.5 flex items-center gap-1.5">
                                DNI: <strong className="font-mono text-slate-800 select-all">{queryResult.data.generales.documento}</strong>
                                <button 
                                  onClick={() => handleCopy(queryResult.data.generales.documento, 'res_dni')}
                                  className="text-text-500 hover:text-[var(--color-bcp-blue)]"
                                >
                                  {copiedField === 'res_dni' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                </button>
                              </p>
                            </div>
                          </div>

                          {[
                            { label: 'Fecha Nacimiento', value: queryResult.data.generales.nacimiento },
                            { label: 'Sexo', value: queryResult.data.generales.sexo === '1' ? 'MASCULINO' : queryResult.data.generales.sexo === '2' ? 'FEMENINO' : queryResult.data.generales.sexo },
                            { label: 'Estado Civil', value: queryResult.data.generales.estado_civil || 'NO ESPECIFICADO' },
                            { label: 'Lugar Nacimiento', value: queryResult.data.generales.lugar_nacimiento || 'N/A' },
                            { label: 'Ubigeo Nacimiento', value: queryResult.data.generales.ubigeo_nacimiento || 'N/A' },
                            { label: 'Nombre Padre', value: queryResult.data.generales.padre || 'N/A' },
                            { label: 'Nombre Madre', value: queryResult.data.generales.madre || 'N/A' },
                          ].map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2.5 border-b border-surface-100 last:border-0">
                              <span className="text-[9px] font-bold text-text-500 uppercase">{item.label}</span>
                              <span className="text-xs font-black text-slate-800 uppercase">{item.value || '-'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-text-500 text-xs italic">No hay información general disponible</div>
                      )}
                    </div>

                    <div className="premium-card bg-white flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                          <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                          Familiares Relacionados ({queryResult.data?.familiares?.length || 0})
                        </h3>
                        {Array.isArray(queryResult.data?.familiares) && queryResult.data.familiares.length > 0 ? (
                          <div className="overflow-y-auto max-h-[350px] pr-1">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                  <th className="pb-2 font-black">Familiar</th>
                                  <th className="pb-2 font-black">Parentesco</th>
                                  <th className="pb-2 font-black">DNI</th>
                                  <th className="pb-2 font-black text-center">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {queryResult.data.familiares.map((fam: any, idx: number) => (
                                  <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                    <td className="py-2.5 text-xs font-black text-slate-800 uppercase">
                                      {fam.nombres_familiar} {fam.paterno_familiar} {fam.materno_familiar}
                                    </td>
                                    <td className="py-2.5 text-[9px] font-bold text-text-500 uppercase">{fam.tipo_relacion}</td>
                                    <td className="py-2.5 text-xs font-bold text-text-700 font-mono select-all">{fam.documento_familiar}</td>
                                    <td className="py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(fam.documento_familiar, `fam_doc_${idx}`)}
                                        className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                        title="Copiar DNI familiar"
                                      >
                                        {copiedField === `fam_doc_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-24 text-center text-text-500 text-xs italic">No se reportan familiares relacionados</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: financiero (Historial SBS & Deudas) */}
              {resultTab === 'financiero' && (
                <div className="space-y-6">
                  {/* Calificaciones Históricas Semáforo */}
                  {Array.isArray(queryResult.data?.sbs) && queryResult.data.sbs.length > 0 && (() => {
                    const latest = queryResult.data.sbs[0];
                    const norm = parseFloat(latest.calificacion_normal || '0');
                    const cpp = parseFloat(latest.calificacion_cpp || '0');
                    const def = parseFloat(latest.calificacion_deficiente || '0');
                    const dud = parseFloat(latest.calificacion_dudoso || '0');
                    const per = parseFloat(latest.calificacion_perdida || '0');
                    const totalPct = norm + cpp + def + dud + per;

                    return (
                      <div className="premium-card bg-white">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                          Semáforo de Calificaciones Crediticias SBS (Último Periodo)
                        </h3>
                        <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-150 shadow-inner">
                          {norm > 0 && <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(norm / totalPct) * 100}%` }} title={`Normal: ${norm}%`} />}
                          {cpp > 0 && <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${(cpp / totalPct) * 100}%` }} title={`CPP: ${cpp}%`} />}
                          {def > 0 && <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${(def / totalPct) * 100}%` }} title={`Deficiente: ${def}%`} />}
                          {dud > 0 && <div className="h-full bg-rose-400 transition-all duration-300" style={{ width: `${(dud / totalPct) * 100}%` }} title={`Dudoso: ${dud}%`} />}
                          {per > 0 && <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${(per / totalPct) * 100}%` }} title={`Pérdida: ${per}%`} />}
                          {totalPct === 0 && <div className="h-full bg-slate-200 w-full flex items-center justify-center text-[9px] font-black text-slate-500">SIN CALIFICACIONES REPORTADAS</div>}
                        </div>
                        {totalPct > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-[9px] font-black uppercase text-slate-600">
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal: {norm}%</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> CPP: {cpp}%</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Deficiente: {def}%</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> Dudoso: {dud}%</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Pérdida: {per}%</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Tabla SBS */}
                  <div className="premium-card bg-white">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                      Historial Calificaciones SBS ({queryResult.data?.sbs?.length || 0})
                    </h3>
                    {Array.isArray(queryResult.data?.sbs) && queryResult.data.sbs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                              <th className="px-4 py-3 font-black">Periodo</th>
                              <th className="px-4 py-3 font-black text-right">Deuda Total</th>
                              <th className="px-4 py-3 font-black text-right">Disponible</th>
                              <th className="px-4 py-3 font-black text-center">Entidades</th>
                              <th className="px-4 py-3 font-black text-center">Normal</th>
                              <th className="px-4 py-3 font-black text-center">CPP</th>
                              <th className="px-4 py-3 font-black text-center">Deficiente</th>
                              <th className="px-4 py-3 font-black text-center">Dudoso</th>
                              <th className="px-4 py-3 font-black text-center">Pérdida</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.data.sbs.map((s: any, idx: number) => (
                              <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 text-xs">
                                <td className="px-4 py-3 font-black text-slate-800 font-mono">
                                  {s.fecha_reporte_sbs ? `${s.fecha_reporte_sbs.substring(0,4)}-${s.fecha_reporte_sbs.substring(4,6)}-${s.fecha_reporte_sbs.substring(6,8)}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-800">S/ {Number(s.deuda_total || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 text-right font-bold text-text-700">S/ {Number(s.disponible || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 text-center font-bold text-text-700">{s.cant_empresas}</td>
                                <td className="px-4 py-3 text-center text-emerald-600 font-black">{s.calificacion_normal || '0.00'}%</td>
                                <td className="px-4 py-3 text-center text-amber-500 font-black">{s.calificacion_cpp || '0.00'}%</td>
                                <td className="px-4 py-3 text-center text-orange-500 font-black">{s.calificacion_deficiente || '0.00'}%</td>
                                <td className="px-4 py-3 text-center text-rose-400 font-black">{s.calificacion_dudoso || '0.00'}%</td>
                                <td className="px-4 py-3 text-center text-rose-600 font-black">{s.calificacion_perdida || '0.00'}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-text-500 text-xs italic">Sin historial SBS reportado</div>
                    )}
                  </div>

                  {/* Detalle Deudas */}
                  <div className="premium-card bg-white">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                      Detalle de Deudas Vigentes
                    </h3>
                    {Array.isArray(queryResult.data?.sbs?.[0]?.sbs_detalle) && queryResult.data.sbs[0].sbs_detalle.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                              <th className="px-4 py-3 font-black">Entidad Financiera</th>
                              <th className="px-4 py-3 font-black">Tipo Crédito</th>
                              <th className="px-4 py-3 font-black">Detalle</th>
                              <th className="px-4 py-3 font-black text-right">Monto</th>
                              <th className="px-4 py-3 font-black text-center">Días Atraso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.data.sbs[0].sbs_detalle.map((d: any, idx: number) => {
                              const dias = Number(d.dias_atraso || 0);
                              return (
                                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 text-xs">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{d.entidad}</td>
                                  <td className="px-4 py-3 font-bold text-text-700 uppercase">{d.tipo_credito}</td>
                                  <td className="px-4 py-3 text-text-500 max-w-xs truncate" title={d.detalle}>{d.detalle || '-'}</td>
                                  <td className="px-4 py-3 text-right font-black text-slate-800">S/ {Number(d.monto || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                      dias > 30 
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200/50' 
                                        : dias > 0 
                                          ? 'bg-amber-100 text-amber-700 border border-amber-200/50' 
                                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200/50'
                                    }`}>
                                      {dias || '0'} {dias === 1 ? 'día' : 'días'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-text-500 text-xs italic">No se reportan deudas detalladas vigentes</div>
                    )}
                  </div>

                  {/* Resumen Financiero & Utilización */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="premium-card bg-white">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                        Líneas y Créditos por Entidad ({queryResult.data?.resumen_financiero?.length || 0})
                      </h3>
                      {Array.isArray(queryResult.data?.resumen_financiero) && queryResult.data.resumen_financiero.length > 0 ? (
                        <div className="overflow-y-auto max-h-[350px]">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                <th className="pb-2 font-black">Entidad</th>
                                <th className="pb-2 font-black text-right">Línea Aprobada</th>
                                <th className="pb-2 font-black text-right">Disponible</th>
                                <th className="pb-2 font-black text-right">Tarjeta</th>
                                <th className="pb-2 font-black text-right">Préstamos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {queryResult.data.resumen_financiero.map((rf: any, idx: number) => (
                                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                  <td className="py-2.5 font-black text-slate-800 uppercase">{rf.entidad}</td>
                                  <td className="py-2.5 text-right font-bold text-slate-800">S/ {Number(rf.linea_aprobada || 0).toLocaleString()}</td>
                                  <td className="py-2.5 text-right text-emerald-600 font-bold">S/ {Number(rf.linea_disponible || 0).toLocaleString()}</td>
                                  <td className="py-2.5 text-right text-text-500">S/ {Number(rf.tarjeta || 0).toLocaleString()}</td>
                                  <td className="py-2.5 text-right text-text-500">S/ {Number(rf.prestamo || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-text-500 text-xs italic">No hay información del resumen financiero</div>
                      )}
                    </div>

                    <div className="premium-card bg-white">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                        Utilización de Líneas ({queryResult.data?.utilizacion?.length || 0})
                      </h3>
                      {Array.isArray(queryResult.data?.utilizacion) && queryResult.data.utilizacion.length > 0 ? (
                        <div className="overflow-y-auto max-h-[350px]">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                <th className="pb-2 font-black">Empresa</th>
                                <th className="pb-2 font-black text-right">Línea Otorgada</th>
                                <th className="pb-2 font-black text-right">Línea Utilizada</th>
                                <th className="pb-2 font-black text-right">Línea Disponible</th>
                              </tr>
                            </thead>
                            <tbody>
                              {queryResult.data.utilizacion.map((ut: any, idx: number) => (
                                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                  <td className="py-2.5 font-black text-slate-800 uppercase">{ut.empresa}</td>
                                  <td className="py-2.5 text-right font-bold text-slate-800">S/ {Number(ut.linea_otorgada || 0).toLocaleString()}</td>
                                  <td className="py-2.5 text-right text-rose-500 font-bold">S/ {Number(ut.linea_utilizada || 0).toLocaleString()}</td>
                                  <td className="py-2.5 text-right text-emerald-600 font-bold">S/ {Number(ut.linea_no_utilizada || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-text-500 text-xs italic">No hay información de utilización de líneas</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: contactos (Teléfonos, Correos, Direcciones) */}
              {resultTab === 'contactos' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Telefonos */}
                    <div className="premium-card bg-white">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                        Teléfonos Detectados ({queryResult.data?.telefonos?.length || 0})
                      </h3>
                      {Array.isArray(queryResult.data?.telefonos) && queryResult.data.telefonos.length > 0 ? (
                        <div className="overflow-y-auto max-h-[350px] pr-1">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                <th className="pb-2 font-black">Número</th>
                                <th className="pb-2 font-black text-center">Tipo</th>
                                <th className="pb-2 font-black">Origen</th>
                                <th className="pb-2 font-black">Plan / Modelo</th>
                                <th className="pb-2 font-black text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {queryResult.data.telefonos.map((t: any, idx: number) => (
                                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                  <td className="py-2.5 font-black text-slate-800 font-mono select-all">{t.telefono}</td>
                                  <td className="py-2.5 text-center font-bold text-text-500">{t.tipo_telefono === 'C' ? 'Celular' : t.tipo_telefono === 'F' ? 'Fijo' : t.tipo_telefono || '-'}</td>
                                  <td className="py-2.5 text-text-700 uppercase font-bold text-[9px]">{t.origen_data}</td>
                                  <td className="py-2.5 text-text-500 font-medium">
                                    {t.plan || t.modelo_celular ? `${t.plan || ''} ${t.modelo_celular || ''}`.trim() : '-'}
                                  </td>
                                  <td className="py-2.5 text-center">
                                    <button 
                                      type="button"
                                      onClick={() => handleCopy(t.telefono, `res_tel_${idx}`)}
                                      className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                      title="Copiar teléfono"
                                    >
                                      {copiedField === `res_tel_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-text-500 text-xs italic">No se encontraron teléfonos</div>
                      )}
                    </div>

                    {/* Correos */}
                    <div className="premium-card bg-white">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                        Correos Electrónicos ({queryResult.data?.correos?.length || 0})
                      </h3>
                      {Array.isArray(queryResult.data?.correos) && queryResult.data.correos.length > 0 ? (
                        <div className="overflow-y-auto max-h-[350px] pr-1">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                <th className="pb-2 font-black">Email</th>
                                <th className="pb-2 font-black">Origen</th>
                                <th className="pb-2 font-black text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {queryResult.data.correos.map((c: any, idx: number) => (
                                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                  <td className="py-2.5 font-black text-slate-800 font-mono select-all">{c.correo}</td>
                                  <td className="py-2.5 text-text-700 uppercase font-bold text-[9px]">{c.origen_data || '-'}</td>
                                  <td className="py-2.5 text-center">
                                    <button 
                                      type="button"
                                      onClick={() => handleCopy(c.correo, `res_email_${idx}`)}
                                      className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                      title="Copiar email"
                                    >
                                      {copiedField === `res_email_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-text-500 text-xs italic">No se encontraron correos electrónicos</div>
                      )}
                    </div>
                  </div>

                  {/* Direcciones */}
                  <div className="premium-card bg-white">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                      Direcciones Registradas ({queryResult.data?.direcciones?.length || 0})
                    </h3>
                    {Array.isArray(queryResult.data?.direcciones) && queryResult.data.direcciones.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                              <th className="px-4 py-3 font-black">Dirección</th>
                              <th className="px-4 py-3 font-black">Ubicación (Dpto - Prov - Dist)</th>
                              <th className="px-4 py-3 font-black">Ubigeo</th>
                              <th className="px-4 py-3 font-black">Origen</th>
                              <th className="px-4 py-3 text-center font-black">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.data.direcciones.map((d: any, idx: number) => (
                              <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                <td className="px-4 py-3 font-black text-slate-800 uppercase select-all">{d.direccion}</td>
                                <td className="px-4 py-3 font-bold text-text-700 uppercase">{d.descripcion_ubigeo || '-'}</td>
                                <td className="px-4 py-3 text-text-500 font-mono">{d.ubigeo || '-'}</td>
                                <td className="px-4 py-3 text-text-700 font-bold uppercase text-[9px]">{d.origen_data || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                  <button 
                                    type="button"
                                    onClick={() => handleCopy(d.direccion, `res_dir_${idx}`)}
                                    className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                    title="Copiar dirección"
                                  >
                                    {copiedField === `res_dir_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-text-500 text-xs italic">No se registran direcciones</div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 4: laboral (EsSalud / Planilla) */}
              {resultTab === 'laboral' && (
                <div className="space-y-6">
                  <div className="premium-card bg-white">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                      Historial de Aportes Laborales (EsSalud / Planilla)
                    </h3>
                    {(() => {
                      const essaludAportes = Array.isArray(queryResult.data?.essalud?.mes1) 
                        ? queryResult.data.essalud.mes1 
                        : [];
                      return essaludAportes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                <th className="px-4 py-3 font-black">Periodo</th>
                                <th className="px-4 py-3 font-black">RUC Empleador</th>
                                <th className="px-4 py-3 font-black">Razón Social Empleador</th>
                                <th className="px-4 py-3 font-black text-right">Sueldo Reportado</th>
                                <th className="px-4 py-3 font-black text-center">Situación</th>
                                <th className="px-4 py-3 font-black">Ubicación / Dirección</th>
                                <th className="px-4 py-3 text-center font-black">Copiar RUC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {essaludAportes.map((e: any, idx: number) => (
                                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                  <td className="px-4 py-3 font-black text-slate-800 font-mono">
                                    {e.fecha ? `${e.fecha.substring(0,4)}-${e.fecha.substring(4,6)}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-text-700 font-mono select-all">{e.ruc}</td>
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{e.nombre_empresa}</td>
                                  <td className="px-4 py-3 text-right font-black text-slate-800">
                                    S/ {Number(e.sueldo || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                      e.situacion === 'A' || e.situacion?.toUpperCase() === 'ACTIVO' 
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-250/30' 
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                      {e.situacion === 'A' || e.situacion?.toUpperCase() === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-text-500 uppercase leading-normal">
                                    <div className="font-bold text-text-700">
                                      {e.distrito || e.provincia || e.departamento 
                                        ? `${e.departamento || ''} - ${e.provincia || ''} - ${e.distrito || ''}`.trim() 
                                        : 'N/A'}
                                    </div>
                                    <div className="text-[9px] lowercase max-w-xs truncate" title={e.direccion}>{e.direccion || '-'}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button 
                                      type="button"
                                      onClick={() => handleCopy(e.ruc, `res_ruc_${idx}`)}
                                      className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                      title="Copiar RUC empleador"
                                    >
                                      {copiedField === `res_ruc_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-24 text-center text-text-500 text-xs italic">No se registran aportes de EsSalud o Planilla para este documento</div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Sub-tab 5: activos (Vehículos & Empresas) */}
              {resultTab === 'activos' && (
                <div className="space-y-6">
                  {/* Vehículos */}
                  <div className="premium-card bg-white">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                      Vehículos Registrados ({queryResult.data?.vehiculos?.length || 0})
                    </h3>
                    {Array.isArray(queryResult.data?.vehiculos) && queryResult.data.vehiculos.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                              <th className="px-4 py-3 font-black">Placa Visual</th>
                              <th className="px-4 py-3 font-black">Marca / Modelo</th>
                              <th className="px-4 py-3 font-black">Clase / Tipo</th>
                              <th className="px-4 py-3 font-black text-center">Fabricación</th>
                              <th className="px-4 py-3 font-black text-center">Compra</th>
                              <th className="px-4 py-3 font-black text-center">Transferencias</th>
                              <th className="px-4 py-3 font-black">Tipo Propiedad</th>
                              <th className="px-4 py-3 font-black">Segundo Propietario</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.data.vehiculos.map((v: any, idx: number) => (
                              <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                <td className="px-4 py-3 font-bold">
                                  <div className="inline-flex flex-col items-center bg-white border-2 border-slate-850 rounded-md shadow-sm overflow-hidden select-all w-24">
                                    <div className="bg-amber-400 text-[8px] font-black text-slate-850 px-3 w-full text-center tracking-widest border-b border-slate-855">
                                      PERÚ
                                    </div>
                                    <div className="text-xs font-black text-slate-855 py-0.5 font-mono tracking-wider">
                                      {formatPlate(v.placa)}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-black text-slate-800 uppercase">{v.marca || '-'} / {v.modelo || '-'}</td>
                                <td className="px-4 py-3 text-text-700 uppercase">{v.clase || v.tipo || '-'}</td>
                                <td className="px-4 py-3 text-center text-text-700 font-semibold">{v.fabricacion || '-'}</td>
                                <td className="px-4 py-3 text-center text-text-700 font-semibold">{v.compra || '-'}</td>
                                <td className="px-4 py-3 text-center font-bold text-text-700">{v.nrotransferencia || '0'}</td>
                                <td className="px-4 py-3 text-text-500 uppercase">{v.tipodepropiedad || '-'}</td>
                                <td className="px-4 py-3 text-text-500 uppercase text-[10px]">
                                  {v.nombrecompleto2 && v.nombrecompleto2 !== '-' 
                                    ? `${v.nombrecompleto2} (${v.documento2 || ''})` 
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-text-500 text-xs italic">No se registran vehículos de propiedad del cliente</div>
                    )}
                  </div>

                  {/* Empresas */}
                  <div className="premium-card bg-white">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                      Vínculos Comerciales y Empresas ({queryResult.data?.empresas?.length || 0})
                    </h3>
                    {Array.isArray(queryResult.data?.empresas) && queryResult.data.empresas.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                              <th className="px-4 py-3 font-black">RUC</th>
                              <th className="px-4 py-3 font-black">Razón Social / Nombre Comercial</th>
                              <th className="px-4 py-3 font-black">Cargo / Vínculo</th>
                              <th className="px-4 py-3 font-black text-center">Estado SUNAT</th>
                              <th className="px-4 py-3 font-black text-center">Condición</th>
                              <th className="px-4 py-3 font-black">Giro Económico</th>
                              <th className="px-4 py-3 font-black">Ubicación / Dirección Fiscal</th>
                              <th className="px-4 py-3 text-center font-black">Copiar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.data.empresas.map((em: any, idx: number) => (
                              <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                <td className="px-4 py-3 font-bold text-text-700 font-mono select-all">{em.ruc}</td>
                                <td className="px-4 py-3">
                                  <div className="font-black text-slate-800 uppercase leading-snug">{em.razonsocial}</div>
                                  {em.nombrecomercial && em.nombrecomercial !== '-' && (
                                    <div className="text-[9px] font-bold text-text-500 uppercase mt-0.5">{em.nombrecomercial}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-bold text-[var(--color-bcp-blue)] uppercase">{em.cargo || em.tipo || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    em.estado?.toUpperCase() === 'ACTIVO' 
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/55' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-200/55'
                                  }`}>
                                    {em.estado || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    em.condicion?.toUpperCase() === 'HABIDO' 
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/55' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-200/55'
                                  }`}>
                                    {em.condicion || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-text-500 max-w-xs truncate" title={em.giro}>{em.giro || '-'}</td>
                                <td className="px-4 py-3">
                                  <div className="text-text-700 uppercase font-bold leading-normal">{em.direccion}</div>
                                  <div className="text-[9px] text-text-500 uppercase mt-0.5">{em.distrito} - {em.provincia} - {em.departamento}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button 
                                    type="button"
                                    onClick={() => handleCopy(em.ruc, `res_emp_ruc_${idx}`)}
                                    className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                    title="Copiar RUC"
                                  >
                                    {copiedField === `res_emp_ruc_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-text-500 text-xs italic">No se registran vínculos comerciales en SUNAT</div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 6: raw (JSON Completo) */}
              {resultTab === 'raw' && (
                <div className="premium-card bg-white">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                      Respuesta Completa de la API SBI (JSON Crudo)
                    </h3>
                    <button 
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(queryResult, null, 2), 'raw_json_copy')}
                      className="action-button-primary py-1.5 px-3 text-[10px] hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Copy size={12} /> 
                      {copiedField === 'raw_json_copy' ? 'Copiado' : 'Copiar JSON'}
                    </button>
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-6 text-emerald-455 font-mono text-[10px] overflow-x-auto max-h-[500px] shadow-inner">
                    <pre>{JSON.stringify(queryResult.data, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB: CONSULTA MASIVA
          ────────────────────────────────────────────────────────── */}
      {activeTab === 'masivo' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="premium-card">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
              Consulta Masiva de Documentos (Lotes Paralelos)
            </h2>
            <p className="text-[10px] font-bold text-text-500 uppercase tracking-wider mb-6">
              Ingresa múltiples documentos (DNI/RUC) para procesar consultas por lotes concurrentes de forma automática.
            </p>

            <form onSubmit={handleRunBulkQuery} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-700 uppercase tracking-widest block px-1">
                  Lista de Documentos (DNI de 8 dígitos o RUC de 11 dígitos, separados por comas, espacios o saltos de línea)
                </label>
                <textarea
                  disabled={bulkProcessing}
                  placeholder="Escribe o pega los documentos aquí.&#10;Ejemplo:&#10;45678901, 10456789012&#10;76543210"
                  className="w-full h-40 p-4 border border-surface-200 rounded-2xl outline-none transition-all focus:border-[var(--color-bcp-blue)] text-xs font-mono font-bold uppercase leading-relaxed resize-y bg-white text-slate-800 focus:ring-2 focus:ring-[var(--color-bcp-blue-light)]"
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="text-[9px] font-bold text-text-500 uppercase px-1">
                  * Máximo recomendado: 50 documentos por lote. Concurrencia de procesamiento: 3 en paralelo.
                </div>
                
                <div className="flex gap-3">
                  {bulkProcessing ? (
                    <button 
                      type="button"
                      onClick={() => setBulkCancelRequested(true)}
                      className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                      <AlertTriangle size={14} className="animate-pulse" /> Cancelar Proceso
                    </button>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={() => {
                          setBulkInput("45678901\n10456789012\n76543210\n20123456789\n88888888");
                        }}
                        className="action-button-secondary font-black text-[10px] uppercase py-2.5 px-4"
                      >
                        Cargar Demo Lote
                      </button>
                      <button 
                        type="submit" 
                        className="action-button-primary font-black text-[10px] uppercase py-2.5 px-5"
                      >
                        Iniciar Consulta Masiva
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Progress Section */}
          {(bulkProcessing || bulkResults.length > 0) && (
            <div className="space-y-6">
              {/* Progress Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="premium-card p-4.5 flex flex-col justify-between min-h-[90px]">
                  <span className="text-[9px] font-black text-text-500 uppercase tracking-widest block">Total Lote</span>
                  <span className="text-xl font-black text-slate-800 mt-1">{bulkTotal}</span>
                </div>
                <div className="premium-card p-4.5 flex flex-col justify-between min-h-[90px]">
                  <span className="text-[9px] font-black text-text-500 uppercase tracking-widest block">Procesados</span>
                  <span className="text-xl font-black text-slate-800 mt-1">{bulkProgress}</span>
                </div>
                <div className="premium-card p-4.5 flex flex-col justify-between min-h-[90px]">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Exitosos</span>
                  <span className="text-xl font-black text-emerald-600 mt-1">{bulkResults.filter(r => r.success).length}</span>
                </div>
                <div className="premium-card p-4.5 flex flex-col justify-between min-h-[90px]">
                  <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Errores</span>
                  <span className="text-xl font-black text-rose-600 mt-1">{bulkResults.filter(r => !r.success).length}</span>
                </div>
              </div>

              {/* Progress Bar */}
              {bulkProcessing && (
                <div className="premium-card space-y-2.5 bg-white">
                  <div className="flex justify-between items-center text-[10px] font-black text-[var(--color-bcp-blue)] uppercase tracking-wider">
                    <span className="animate-pulse">Ejecutando consultas masivas...</span>
                    <span>{Math.round((bulkProgress / bulkTotal) * 100)}% ({bulkProgress} de {bulkTotal})</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-[var(--color-bcp-blue)] to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkProgress / bulkTotal) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action bar */}
              {!bulkProcessing && bulkResults.length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/35 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Procesamiento Masivo Completado</h4>
                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase">Se procesaron {bulkProgress} documentos exitosamente.</p>
                    </div>
                  </div>
                  <button 
                    onClick={exportBulkResultsCSV}
                    className="action-button-primary font-black text-[10px] py-2 px-4 uppercase tracking-wider flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Copy size={14} /> Exportar Consolidado (CSV)
                  </button>
                </div>
              )}

              {/* Results Table */}
              <div className="premium-card bg-white">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                  Resultados del Lote
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-surface-250 text-[9px] uppercase tracking-wider text-text-500">
                        <th className="px-4 py-3 font-black">Documento</th>
                        <th className="px-4 py-3 font-black">Tipo</th>
                        <th className="px-4 py-3 font-black">Nombres del Cliente</th>
                        <th className="px-4 py-3 font-black text-right">Deuda SBS</th>
                        <th className="px-4 py-3 font-black text-center">Calificación Normal</th>
                        <th className="px-4 py-3 font-black text-center">Estado</th>
                        <th className="px-4 py-3 font-black">Detalle / Error</th>
                        <th className="px-4 py-3 font-black text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, idx) => {
                        const rType = r.documento.length === 8 ? 'DNI' : 'RUC';
                        return (
                          <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 transition-colors">
                            <td className="px-4 py-3 font-black text-slate-800 font-mono select-all">{r.documento}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                rType === 'DNI' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-250/20' 
                                  : 'bg-blue-50 text-blue-600 border border-blue-250/20'
                              }`}>
                                {rType}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-black text-slate-800 uppercase">{r.name}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-800">
                              {r.success ? `S/ ${Number(r.deuda || 0).toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-600 font-black">
                              {r.success ? `${r.calificacion}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                r.success 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-200/50'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-text-500 max-w-xs truncate font-bold uppercase text-[9px]" title={r.error}>
                              {r.error || '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.success ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLog({
                                      id: `Lote: ${r.documento}`,
                                      success: true,
                                      created_at: new Date().toISOString(),
                                      user: { nombre: 'Consulta Masiva' },
                                      results: [{ payload: JSON.stringify(r.data) }]
                                    });
                                    setModalResultTab('generales');
                                  }}
                                  className="bg-slate-100 hover:bg-[var(--accent-blue-soft)] hover:text-[var(--accent-blue)] text-slate-700 font-black text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all border border-slate-200/60"
                                >
                                  Ver Ficha
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB: HISTORIAL
          ────────────────────────────────────────────────────────── */}
      {activeTab === 'historial' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="premium-card bg-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                Historial de Consultas Realizadas
              </h2>
              <button 
                type="button"
                onClick={() => fetchHistory(currentPage)}
                className="action-button-secondary py-1.5 px-3 text-[10px] flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Actualizar
              </button>
            </div>

            {history.length > 0 ? (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-surface-250 text-[9px] uppercase tracking-wider text-text-500">
                        <th className="px-4 py-3 font-black">Fecha y Hora</th>
                        <th className="px-4 py-3 font-black">Documento</th>
                        <th className="px-4 py-3 font-black">Tipo</th>
                        <th className="px-4 py-3 font-black">Usuario Asesor</th>
                        <th className="px-4 py-3 font-black text-center">Estado</th>
                        <th className="px-4 py-3 font-black text-center">Código HTTP</th>
                        <th className="px-4 py-3 font-black text-right">Duración</th>
                        <th className="px-4 py-3 font-black text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((log: any) => {
                        let doc = 'N/A';
                        try {
                          if (log.request_params) {
                            const p = JSON.parse(log.request_params);
                            doc = p.documento || 'N/A';
                          }
                        } catch (e) {}
                        const logDocType = doc.length === 8 ? 'DNI' : doc.length === 11 ? 'RUC' : '-';
                        return (
                          <tr key={log.id} className="border-b border-surface-100 hover:bg-surface-50 transition-colors">
                            <td className="px-4 py-3 font-bold text-text-700">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-black text-slate-800 font-mono select-all">
                              {doc}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                logDocType === 'DNI' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-250/20' 
                                  : logDocType === 'RUC' 
                                    ? 'bg-blue-50 text-blue-600 border border-blue-250/20' 
                                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                              }`}>
                                {logDocType}
                              </span>
                            </td>
                            <td className="px-4 py-3 uppercase text-[10px] font-bold text-text-500">
                              {log.user?.nombre || log.user?.username || 'Sistema'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                log.success 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-200/50'
                              }`}>
                                {log.success ? 'ÉXITO' : 'ERROR'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-text-700">
                              {log.status_code || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-text-700 font-mono">
                              {log.duration_ms ? `${log.duration_ms} ms` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                type="button"
                                onClick={() => handleOpenLogDetail(log.id)}
                                className="bg-slate-100 hover:bg-[var(--accent-blue-soft)] hover:text-[var(--accent-blue)] text-slate-700 font-black text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all border border-slate-200/60"
                              >
                                Ver Detalle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex justify-between items-center pt-4 border-t border-surface-150">
                    <span className="text-[9px] font-bold text-text-500 uppercase tracking-wider">
                      Página {currentPage} de {pagination.pages} ({pagination.total} registros totales)
                    </span>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => fetchHistory(currentPage - 1)}
                        className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        type="button"
                        disabled={currentPage === pagination.pages}
                        onClick={() => fetchHistory(currentPage + 1)}
                        className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-text-500 text-xs italic">
                No hay consultas registradas en el historial.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB: CONFIGURACION
          ────────────────────────────────────────────────────────── */}
      {activeTab === 'configuracion' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="premium-card bg-white">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-6 bg-slate-650 rounded-full"></div>
              Parámetros de Conexión de la API SBI
            </h2>
            <p className="text-[10px] font-bold text-text-500 uppercase tracking-wider mb-6">
              Estas variables técnicas determinan los servidores y el modo de autenticación del API de SBI.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: 'Servidor Principal (SBI_API_BASE_URL)', value: config?.base_url },
                { label: 'Servidor Legado (SBI_API_LEGACY_URL)', value: config?.legacy_url },
                { label: 'Servidor App (SBI_API_APP_URL)', value: config?.app_url },
                { label: 'Modo de Autenticación (SBI_AUTH_MODE)', value: config?.auth_mode },
                { label: 'Usuario API (SBI_API_USER)', value: config?.usuario || 'No configurado' },
                { label: 'API Key (Enmascarada)', value: config?.has_key ? '••••••••••••••••••••' : 'No configurado' },
                { label: 'Timeout en Peticiones', value: config?.timeout_seconds ? `${config.timeout_seconds} segundos` : '30 segundos' },
                { label: 'Verificación SSL', value: config?.verify_ssl ? 'Activado (Recomendado)' : 'Desactivado' },
                { label: 'IP de Droplet (Salida pública)', value: config?.server_public_ip || '134.209.64.146' }
              ].map((item, idx) => (
                <div key={idx} className="p-4.5 bg-surface-50 border border-surface-150 rounded-2xl flex flex-col justify-between min-h-[95px] transition-all duration-300 hover:bg-slate-50/80">
                  <span className="text-[9px] font-black text-text-500 uppercase tracking-widest block mb-1">
                    {item.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 break-all select-all block max-h-[80px] overflow-y-auto font-mono scrollbar-thin">
                    {item.value || '-'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-200/50 rounded-2xl flex gap-3">
              <ShieldAlert className="text-amber-600 shrink-0" size={20} />
              <div>
                <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">Nota Importante sobre Configuración</p>
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-500 leading-relaxed uppercase mt-1">
                  Las credenciales y rutas de conexión se leen directamente desde las variables de entorno del servidor (.env.production). Si necesita modificar estos parámetros, póngase en contacto con el administrador del sistema para actualizar el archivo de configuración y recrear los contenedores de Docker.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: DETALLE DE CONSULTA HISTORICA
          ────────────────────────────────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden border border-surface-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    Detalle de Consulta Histórica
                  </h3>
                  <span className={`status-pill ${selectedLog.success ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {selectedLog.success ? 'ÉXITO' : 'ERROR'}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-text-500 uppercase mt-1">
                  ID: {selectedLog.id} • Realizado el {new Date(selectedLog.created_at).toLocaleString()} por {selectedLog.user?.nombre || selectedLog.user?.username || 'Sistema'}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedLog(null)}
                className="h-8 w-8 rounded-full border border-surface-200 flex items-center justify-center text-text-500 hover:text-text-900 hover:bg-surface-50 transition-all font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-surface-50/50">
              {!selectedLog.success ? (
                <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-150 rounded-3xl p-8 space-y-4">
                  <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={18} /> Error Reportado en la Consulta
                  </h4>
                  <div className="space-y-2 text-text-700 text-xs font-bold uppercase leading-normal">
                    <p>Código HTTP: <strong className="text-slate-800">{selectedLog.status_code}</strong></p>
                    <p>Error ID: <strong className="text-slate-800">{selectedLog.error_id || 'Ninguno'}</strong></p>
                  </div>
                  <div className="p-4 bg-rose-100/30 dark:bg-rose-950/20 border border-rose-200/50 rounded-xl">
                    <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest">Mensaje de Error:</p>
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed uppercase mt-1">
                      {selectedLog.error_message || 'No se reportó mensaje detallado.'}
                    </p>
                  </div>
                </div>
              ) : (
                (() => {
                  let modalData: any = null;
                  try {
                    if (selectedLog.results && selectedLog.results.length > 0) {
                      modalData = JSON.parse(selectedLog.results[0].payload);
                    }
                  } catch (e) {
                    console.error('Error parsing historical payload:', e);
                  }

                  if (!modalData) {
                    return (
                      <div className="py-12 text-center text-text-500 text-xs italic">
                        No se encontró el payload de datos en este registro.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Sub-tabs inside modal */}
                      <div className="flex gap-1 overflow-x-auto bg-slate-105 p-1.5 rounded-2xl max-w-full border border-slate-200/40">
                        {[
                          { id: 'generales', label: 'Ficha Personal' },
                          { id: 'financiero', label: 'Historial SBS' },
                          { id: 'contactos', label: 'Contacto & Ubicación' },
                          { id: 'laboral', label: 'Laboral (EsSalud)' },
                          { id: 'activos', label: 'Vehículos & Empresas' },
                          { id: 'raw', label: 'JSON Completo' }
                        ].map((subtab) => (
                          <button
                            key={subtab.id}
                            type="button"
                            onClick={() => setModalResultTab(subtab.id as any)}
                            className={`px-3 py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                              modalResultTab === subtab.id
                                ? 'bg-white text-slate-800 shadow-sm border border-surface-250'
                                : 'text-text-600 hover:bg-surface-200/50'
                            }`}
                          >
                            {subtab.label}
                          </button>
                        ))}
                      </div>

                      {/* Modal Sub-tab Contents */}
                      {modalResultTab === 'generales' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Ficha Personal */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                              Datos de Identidad
                            </h3>
                            {modalData.generales ? (
                              <div className="space-y-4">
                                <div className="flex items-center gap-4 pb-4 border-b border-surface-150 mb-4">
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[var(--color-bcp-blue)] to-blue-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                                    {`${modalData.generales.nombres?.[0] || ''}${modalData.generales.paterno?.[0] || ''}`.toUpperCase()}
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                      {modalData.generales.nombres} {modalData.generales.paterno} {modalData.generales.materno}
                                    </h4>
                                    <p className="text-[9px] font-bold text-text-500 uppercase mt-0.5 flex items-center gap-1.5">
                                      DNI: <strong className="font-mono text-slate-800 select-all">{modalData.generales.documento}</strong>
                                      <button 
                                        onClick={() => handleCopy(modalData.generales.documento, 'mod_dni')}
                                        className="text-text-500 hover:text-[var(--color-bcp-blue)]"
                                      >
                                        {copiedField === 'mod_dni' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                      </button>
                                    </p>
                                  </div>
                                </div>

                                {[
                                  { label: 'Fecha Nacimiento', value: modalData.generales.nacimiento },
                                  { label: 'Sexo', value: modalData.generales.sexo === '1' ? 'MASCULINO' : modalData.generales.sexo === '2' ? 'FEMENINO' : modalData.generales.sexo },
                                  { label: 'Estado Civil', value: modalData.generales.estado_civil || 'NO ESPECIFICADO' },
                                  { label: 'Lugar Nacimiento', value: modalData.generales.lugar_nacimiento || 'N/A' },
                                  { label: 'Ubigeo Nacimiento', value: modalData.generales.ubigeo_nacimiento || 'N/A' },
                                  { label: 'Nombre Padre', value: modalData.generales.padre || 'N/A' },
                                  { label: 'Nombre Madre', value: modalData.generales.madre || 'N/A' },
                                ].map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-2.5 border-b border-surface-100 last:border-0">
                                    <span className="text-[9px] font-bold text-text-500 uppercase">{item.label}</span>
                                    <span className="text-xs font-black text-slate-800 uppercase">{item.value || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="py-12 text-center text-text-500 text-xs italic">No hay información disponible</div>
                            )}
                          </div>

                          {/* Familiares */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                              Familiares Relacionados ({modalData.familiares?.length || 0})
                            </h3>
                            {Array.isArray(modalData.familiares) && modalData.familiares.length > 0 ? (
                              <div className="overflow-y-auto max-h-[350px]">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                      <th className="pb-2 font-black">Familiar</th>
                                      <th className="pb-2 font-black">Parentesco</th>
                                      <th className="pb-2 font-black">DNI</th>
                                      <th className="pb-2 font-black text-center">Copiar</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {modalData.familiares.map((fam: any, idx: number) => (
                                      <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                        <td className="py-2.5 text-xs font-black text-slate-800 uppercase">
                                          {fam.nombres_familiar} {fam.paterno_familiar} {fam.materno_familiar}
                                        </td>
                                        <td className="py-2.5 text-[9px] font-bold text-text-500 uppercase">{fam.tipo_relacion}</td>
                                        <td className="py-2.5 text-xs font-bold text-text-700 font-mono">{fam.documento_familiar}</td>
                                        <td className="py-2.5 text-center">
                                          <button 
                                            type="button"
                                            onClick={() => handleCopy(fam.documento_familiar, `mod_fam_doc_${idx}`)}
                                            className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                            title="Copiar DNI familiar"
                                          >
                                            {copiedField === `mod_fam_doc_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-24 text-center text-text-500 text-xs italic">No se reportan familiares</div>
                            )}
                          </div>
                        </div>
                      )}

                      {modalResultTab === 'financiero' && (
                        <div className="space-y-6">
                          {/* Semáforo SBS */}
                          {Array.isArray(modalData.sbs) && modalData.sbs.length > 0 && (() => {
                            const latest = modalData.sbs[0];
                            const norm = parseFloat(latest.calificacion_normal || '0');
                            const cpp = parseFloat(latest.calificacion_cpp || '0');
                            const def = parseFloat(latest.calificacion_deficiente || '0');
                            const dud = parseFloat(latest.calificacion_dudoso || '0');
                            const per = parseFloat(latest.calificacion_perdida || '0');
                            const totalPct = norm + cpp + def + dud + per;

                            return (
                              <div className="premium-card bg-white">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                                  <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                                  Semáforo de Calificaciones Crediticias SBS (Histórico)
                                </h3>
                                <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-150">
                                  {norm > 0 && <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(norm / totalPct) * 100}%` }} />}
                                  {cpp > 0 && <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${(cpp / totalPct) * 100}%` }} />}
                                  {def > 0 && <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${(def / totalPct) * 100}%` }} />}
                                  {dud > 0 && <div className="h-full bg-rose-400 transition-all duration-300" style={{ width: `${(dud / totalPct) * 100}%` }} />}
                                  {per > 0 && <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${(per / totalPct) * 100}%` }} />}
                                  {totalPct === 0 && <div className="h-full bg-slate-200 w-full flex items-center justify-center text-[9px] font-black text-slate-500">SIN CALIFICACIONES REPORTADAS</div>}
                                </div>
                                {totalPct > 0 && (
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-[9px] font-black uppercase text-slate-650">
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal: {norm}%</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> CPP: {cpp}%</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Deficiente: {def}%</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> Dudoso: {dud}%</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Pérdida: {per}%</div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Calificaciones SBS */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                              Calificaciones SBS e Historial SBS ({modalData.sbs?.length || 0})
                            </h3>
                            {Array.isArray(modalData.sbs) && modalData.sbs.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                      <th className="px-4 py-3 font-black">Periodo</th>
                                      <th className="px-4 py-3 font-black text-right">Deuda Total</th>
                                      <th className="px-4 py-3 font-black text-right">Disponible</th>
                                      <th className="px-4 py-3 font-black text-center">Entidades</th>
                                      <th className="px-4 py-3 font-black text-center">Normal</th>
                                      <th className="px-4 py-3 font-black text-center">CPP</th>
                                      <th className="px-4 py-3 font-black text-center">Deficiente</th>
                                      <th className="px-4 py-3 font-black text-center">Dudoso</th>
                                      <th className="px-4 py-3 font-black text-center">Pérdida</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {modalData.sbs.map((s: any, idx: number) => (
                                      <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 text-xs">
                                        <td className="px-4 py-3 font-black text-slate-800 font-mono">
                                          {s.fecha_reporte_sbs ? `${s.fecha_reporte_sbs.substring(0,4)}-${s.fecha_reporte_sbs.substring(4,6)}-${s.fecha_reporte_sbs.substring(6,8)}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-slate-800">S/ {Number(s.deuda_total || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td className="px-4 py-3 text-right font-bold text-text-700">S/ {Number(s.disponible || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td className="px-4 py-3 text-center font-bold text-text-700">{s.cant_empresas}</td>
                                        <td className="px-4 py-3 text-center text-emerald-600 font-bold">{s.calificacion_normal || '0.00'}%</td>
                                        <td className="px-4 py-3 text-center text-amber-500 font-bold">{s.calificacion_cpp || '0.00'}%</td>
                                        <td className="px-4 py-3 text-center text-orange-500 font-bold">{s.calificacion_deficiente || '0.00'}%</td>
                                        <td className="px-4 py-3 text-center text-rose-400 font-bold">{s.calificacion_dudoso || '0.00'}%</td>
                                        <td className="px-4 py-3 text-center text-rose-600 font-bold">{s.calificacion_perdida || '0.00'}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-12 text-center text-text-500 text-xs italic">Sin historial SBS</div>
                            )}
                          </div>

                          {/* Detalle Deudas */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                              Detalle de Deudas Vigentes
                            </h3>
                            {Array.isArray(modalData.sbs?.[0]?.sbs_detalle) && modalData.sbs[0].sbs_detalle.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                      <th className="px-4 py-3 font-black">Entidad Financiera</th>
                                      <th className="px-4 py-3 font-black">Tipo Crédito</th>
                                      <th className="px-4 py-3 font-black">Detalle</th>
                                      <th className="px-4 py-3 font-black text-right">Monto</th>
                                      <th className="px-4 py-3 font-black text-center">Días Atraso</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {modalData.sbs[0].sbs_detalle.map((d: any, idx: number) => {
                                      const dias = Number(d.dias_atraso || 0);
                                      return (
                                        <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 text-xs">
                                          <td className="px-4 py-3 font-black text-slate-800 uppercase">{d.entidad}</td>
                                          <td className="px-4 py-3 font-bold text-text-700 uppercase">{d.tipo_credito}</td>
                                          <td className="px-4 py-3 text-text-500 max-w-xs truncate" title={d.detalle}>{d.detalle || '-'}</td>
                                          <td className="px-4 py-3 text-right font-black text-slate-800">S/ {Number(d.monto || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                              dias > 30 
                                                ? 'bg-rose-100 text-rose-700' 
                                                : dias > 0 
                                                  ? 'bg-amber-100 text-amber-700' 
                                                  : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                              {dias || '0'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-12 text-center text-text-500 text-xs italic">No se reportan deudas detalladas</div>
                            )}
                          </div>

                          {/* Resumen Financiero y Utilización */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="premium-card bg-white">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                                Líneas y Créditos por Entidad ({modalData.resumen_financiero?.length || 0})
                              </h3>
                              {Array.isArray(modalData.resumen_financiero) && modalData.resumen_financiero.length > 0 ? (
                                <div className="overflow-y-auto max-h-[350px]">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-250 text-[9px] uppercase tracking-wider text-text-500">
                                        <th className="pb-2 font-black">Entidad</th>
                                        <th className="pb-2 font-black text-right">Línea Aprobada</th>
                                        <th className="pb-2 font-black text-right">Disponible</th>
                                        <th className="pb-2 font-black text-right">Tarjeta</th>
                                        <th className="pb-2 font-black text-right">Préstamos</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {modalData.resumen_financiero.map((rf: any, idx: number) => (
                                        <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                          <td className="py-2.5 font-black text-slate-800 uppercase">{rf.entidad}</td>
                                          <td className="py-2.5 text-right font-bold text-slate-800">S/ {Number(rf.linea_aprobada || 0).toLocaleString()}</td>
                                          <td className="py-2.5 text-right text-emerald-600 font-bold">S/ {Number(rf.linea_disponible || 0).toLocaleString()}</td>
                                          <td className="py-2.5 text-right text-text-500">S/ {Number(rf.tarjeta || 0).toLocaleString()}</td>
                                          <td className="py-2.5 text-right text-text-500">S/ {Number(rf.prestamo || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-text-500 text-xs italic">No hay información</div>
                              )}
                            </div>

                            <div className="premium-card bg-white">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                                Utilización de Líneas ({modalData.utilizacion?.length || 0})
                              </h3>
                              {Array.isArray(modalData.utilizacion) && modalData.utilizacion.length > 0 ? (
                                <div className="overflow-y-auto max-h-[350px]">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-250 text-[9px] uppercase tracking-wider text-text-500">
                                        <th className="pb-2 font-black">Empresa</th>
                                        <th className="pb-2 font-black text-right">Línea Otorgada</th>
                                        <th className="pb-2 font-black text-right">Línea Utilizada</th>
                                        <th className="pb-2 font-black text-right">Línea Disponible</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {modalData.utilizacion.map((ut: any, idx: number) => (
                                        <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                          <td className="py-2.5 font-black text-slate-800 uppercase">{ut.empresa}</td>
                                          <td className="py-2.5 text-right font-bold text-slate-800">S/ {Number(ut.linea_otorgada || 0).toLocaleString()}</td>
                                          <td className="py-2.5 text-right text-rose-500 font-bold">S/ {Number(ut.linea_utilizada || 0).toLocaleString()}</td>
                                          <td className="py-2.5 text-right text-emerald-600 font-bold">S/ {Number(ut.linea_no_utilizada || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-text-500 text-xs italic">No hay utilización de líneas</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {modalResultTab === 'contactos' && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Telefonos */}
                            <div className="premium-card bg-white">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                                Teléfonos Detectados ({modalData.telefonos?.length || 0})
                              </h3>
                              {Array.isArray(modalData.telefonos) && modalData.telefonos.length > 0 ? (
                                <div className="overflow-y-auto max-h-[350px] pr-1">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-250 text-[9px] uppercase tracking-wider text-text-500">
                                        <th className="pb-2 font-black">Número</th>
                                        <th className="pb-2 font-black text-center">Tipo</th>
                                        <th className="pb-2 font-black">Origen</th>
                                        <th className="pb-2 font-black">Plan / Modelo</th>
                                        <th className="pb-2 font-black text-center">Copiar</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {modalData.telefonos.map((t: any, idx: number) => (
                                        <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                          <td className="py-2.5 font-black text-slate-800 font-mono select-all">{t.telefono}</td>
                                          <td className="py-2.5 text-center font-bold text-text-500">{t.tipo_telefono === 'C' ? 'Celular' : t.tipo_telefono === 'F' ? 'Fijo' : t.tipo_telefono || '-'}</td>
                                          <td className="py-2.5 text-text-700 uppercase font-bold text-[9px]">{t.origen_data}</td>
                                          <td className="py-2.5 text-text-500 font-medium">
                                            {t.plan || t.modelo_celular ? `${t.plan || ''} ${t.modelo_celular || ''}`.trim() : '-'}
                                          </td>
                                          <td className="py-2.5 text-center">
                                            <button 
                                              type="button"
                                              onClick={() => handleCopy(t.telefono, `mod_tel_${idx}`)}
                                              className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                              title="Copiar teléfono"
                                            >
                                              {copiedField === `mod_tel_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-text-500 text-xs italic">No se encontraron teléfonos</div>
                              )}
                            </div>

                            {/* Correos */}
                            <div className="premium-card bg-white">
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                                Correos Electrónicos ({modalData.correos?.length || 0})
                              </h3>
                              {Array.isArray(modalData.correos) && modalData.correos.length > 0 ? (
                                <div className="overflow-y-auto max-h-[350px] pr-1">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-250 text-[9px] uppercase tracking-wider text-text-500">
                                        <th className="pb-2 font-black">Email</th>
                                        <th className="pb-2 font-black">Origen</th>
                                        <th className="pb-2 font-black text-center">Copiar</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {modalData.correos.map((c: any, idx: number) => (
                                        <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                          <td className="py-2.5 font-black text-slate-800 font-mono select-all">{c.correo}</td>
                                          <td className="py-2.5 text-text-700 uppercase font-bold text-[9px]">{c.origen_data || '-'}</td>
                                          <td className="py-2.5 text-center">
                                            <button 
                                              type="button"
                                              onClick={() => handleCopy(c.correo, `mod_email_${idx}`)}
                                              className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                              title="Copiar email"
                                            >
                                              {copiedField === `mod_email_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-text-500 text-xs italic">No se encontraron correos</div>
                              )}
                            </div>
                          </div>

                          {/* Direcciones */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                              Direcciones Registradas ({modalData.direcciones?.length || 0})
                            </h3>
                            {Array.isArray(modalData.direcciones) && modalData.direcciones.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                      <th className="px-4 py-3 font-black">Dirección</th>
                                      <th className="px-4 py-3 font-black">Ubicación (Dpto - Prov - Dist)</th>
                                      <th className="px-4 py-3 font-black">Ubigeo</th>
                                      <th className="px-4 py-3 font-black">Origen</th>
                                      <th className="px-4 py-3 text-center font-black">Copiar</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {modalData.direcciones.map((d: any, idx: number) => (
                                      <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                        <td className="px-4 py-3 font-black text-slate-800 uppercase select-all">{d.direccion}</td>
                                        <td className="px-4 py-3 font-bold text-text-700 uppercase">{d.descripcion_ubigeo || '-'}</td>
                                        <td className="px-4 py-3 text-text-500 font-mono">{d.ubigeo || '-'}</td>
                                        <td className="px-4 py-3 text-text-700 font-bold uppercase text-[9px]">{d.origen_data || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                          <button 
                                            type="button"
                                            onClick={() => handleCopy(d.direccion, `mod_dir_${idx}`)}
                                            className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                            title="Copiar dirección"
                                          >
                                            {copiedField === `mod_dir_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-12 text-center text-text-500 text-xs italic">No se registran direcciones</div>
                            )}
                          </div>
                        </div>
                      )}

                      {modalResultTab === 'laboral' && (
                        <div className="space-y-6">
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                              Historial de Aportes Laborales (EsSalud / Planilla)
                            </h3>
                            {(() => {
                              const essaludAportes = Array.isArray(modalData.essalud?.mes1) 
                                ? modalData.essalud.mes1 
                                : [];
                              return essaludAportes.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                        <th className="px-4 py-3 font-black">Periodo</th>
                                        <th className="px-4 py-3 font-black">RUC Empleador</th>
                                        <th className="px-4 py-3 font-black">Razón Social Empleador</th>
                                        <th className="px-4 py-3 font-black text-right">Sueldo Reportado</th>
                                        <th className="px-4 py-3 font-black text-center">Situación</th>
                                        <th className="px-4 py-3 font-black">Ubicación / Dirección</th>
                                        <th className="px-4 py-3 text-center font-black">Copiar</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {essaludAportes.map((e: any, idx: number) => (
                                        <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                          <td className="px-4 py-3 font-black text-slate-800 font-mono">
                                            {e.fecha ? `${e.fecha.substring(0,4)}-${e.fecha.substring(4,6)}` : '-'}
                                          </td>
                                          <td className="px-4 py-3 font-bold text-text-700 font-mono select-all">{e.ruc}</td>
                                          <td className="px-4 py-3 font-black text-slate-800 uppercase">{e.nombre_empresa}</td>
                                          <td className="px-4 py-3 text-right font-black text-slate-800">
                                            S/ {Number(e.sueldo || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                              e.situacion === 'A' || e.situacion?.toUpperCase() === 'ACTIVO' 
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-250/20' 
                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                              {e.situacion === 'A' || e.situacion?.toUpperCase() === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-text-500 uppercase leading-normal">
                                            <div className="font-bold text-text-700">
                                              {e.distrito || e.provincia || e.departamento 
                                                ? `${e.departamento || ''} - ${e.provincia || ''} - ${e.distrito || ''}`.trim() 
                                                : 'N/A'}
                                            </div>
                                            <div className="text-[9px] lowercase max-w-xs truncate" title={e.direccion}>{e.direccion || '-'}</div>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <button 
                                              type="button"
                                              onClick={() => handleCopy(e.ruc, `mod_ruc_${idx}`)}
                                              className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                              title="Copiar RUC empleador"
                                            >
                                              {copiedField === `mod_ruc_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-24 text-center text-text-500 text-xs italic">No se registran aportes de EsSalud o Planilla</div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {modalResultTab === 'activos' && (
                        <div className="space-y-6">
                          {/* Vehículos */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                              Vehículos Registrados ({modalData.vehiculos?.length || 0})
                            </h3>
                            {Array.isArray(modalData.vehiculos) && modalData.vehiculos.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                      <th className="px-4 py-3 font-black">Placa Visual</th>
                                      <th className="px-4 py-3 font-black">Marca / Modelo</th>
                                      <th className="px-4 py-3 font-black">Clase / Tipo</th>
                                      <th className="px-4 py-3 font-black text-center">Fabricación</th>
                                      <th className="px-4 py-3 font-black text-center">Compra</th>
                                      <th className="px-4 py-3 font-black text-center">Transferencias</th>
                                      <th className="px-4 py-3 font-black">Tipo Propiedad</th>
                                      <th className="px-4 py-3 font-black">Segundo Propietario</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {modalData.vehiculos.map((v: any, idx: number) => (
                                      <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                        <td className="px-4 py-3 font-bold">
                                          <div className="inline-flex flex-col items-center bg-white border-2 border-slate-850 rounded-md shadow-sm overflow-hidden select-all w-24">
                                            <div className="bg-amber-400 text-[8px] font-black text-slate-855 px-3 w-full text-center tracking-widest border-b border-slate-855">
                                              PERÚ
                                            </div>
                                            <div className="text-xs font-black text-slate-855 py-0.5 font-mono tracking-wider">
                                              {formatPlate(v.placa)}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 font-black text-slate-800 uppercase">{v.marca || '-'} / {v.modelo || '-'}</td>
                                        <td className="px-4 py-3 text-text-700 uppercase">{v.clase || v.tipo || '-'}</td>
                                        <td className="px-4 py-3 text-center text-text-700 font-semibold">{v.fabricacion || '-'}</td>
                                        <td className="px-4 py-3 text-center text-text-700 font-semibold">{v.compra || '-'}</td>
                                        <td className="px-4 py-3 text-center font-bold text-text-700">{v.nrotransferencia || '0'}</td>
                                        <td className="px-4 py-3 text-text-500 uppercase">{v.tipodepropiedad || '-'}</td>
                                        <td className="px-4 py-3 text-text-500 uppercase text-[10px]">
                                          {v.nombrecompleto2 && v.nombrecompleto2 !== '-' 
                                            ? `${v.nombrecompleto2} (${v.documento2 || ''})` 
                                            : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-12 text-center text-text-500 text-xs italic">No se registran vehículos</div>
                            )}
                          </div>

                          {/* Empresas */}
                          <div className="premium-card bg-white">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                              <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                              Vínculos Comerciales y Empresas ({modalData.empresas?.length || 0})
                            </h3>
                            {Array.isArray(modalData.empresas) && modalData.empresas.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-surface-200 text-[9px] uppercase tracking-wider text-text-500">
                                      <th className="px-4 py-3 font-black">RUC</th>
                                      <th className="px-4 py-3 font-black">Razón Social / Nombre Comercial</th>
                                      <th className="px-4 py-3 font-black">Cargo / Vínculo</th>
                                      <th className="px-4 py-3 font-black text-center">Estado SUNAT</th>
                                      <th className="px-4 py-3 font-black text-center">Condición</th>
                                      <th className="px-4 py-3 font-black">Giro Económico</th>
                                      <th className="px-4 py-3 font-black">Ubicación / Dirección Fiscal</th>
                                      <th className="px-4 py-3 text-center font-black">Copiar</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {modalData.empresas.map((em: any, idx: number) => (
                                      <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                                        <td className="px-4 py-3 font-bold text-text-700 font-mono select-all">{em.ruc}</td>
                                        <td className="px-4 py-3">
                                          <div className="font-black text-slate-800 uppercase leading-snug">{em.razonsocial}</div>
                                          {em.nombrecomercial && em.nombrecomercial !== '-' && (
                                            <div className="text-[9px] font-bold text-text-500 uppercase mt-0.5">{em.nombrecomercial}</div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-[var(--color-bcp-blue)] uppercase">{em.cargo || em.tipo || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            em.estado?.toUpperCase() === 'ACTIVO' 
                                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-250/20' 
                                              : 'bg-rose-50 text-rose-600 border border-rose-200/20'
                                          }`}>
                                            {em.estado || '-'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            em.condicion?.toUpperCase() === 'HABIDO' 
                                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-250/20' 
                                              : 'bg-rose-50 text-rose-600 border border-rose-200/20'
                                          }`}>
                                            {em.condicion || '-'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-text-500 max-w-xs truncate" title={em.giro}>{em.giro || '-'}</td>
                                        <td className="px-4 py-3">
                                          <div className="text-text-700 uppercase font-bold leading-normal">{em.direccion}</div>
                                          <div className="text-[9px] text-text-500 uppercase mt-0.5">{em.distrito} - {em.provincia} - {em.departamento}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <button 
                                            type="button"
                                            onClick={() => handleCopy(em.ruc, `mod_emp_ruc_${idx}`)}
                                            className="p-1 rounded text-text-500 hover:bg-slate-100 hover:text-[var(--color-bcp-blue)] transition-all"
                                            title="Copiar RUC"
                                          >
                                            {copiedField === `mod_emp_ruc_${idx}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="py-12 text-center text-text-500 text-xs italic">No se registran vínculos comerciales</div>
                            )}
                          </div>
                        </div>
                      )}

                      {modalResultTab === 'raw' && (
                        <div className="premium-card bg-white">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                              <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                              Respuesta Completa de la API SBI (JSON Crudo)
                            </h3>
                            <button 
                              type="button"
                              onClick={() => handleCopy(JSON.stringify(modalData, null, 2), 'mod_raw_json_copy')}
                              className="action-button-primary py-1.5 px-3 text-[10px]"
                            >
                              <Copy size={12} /> 
                              {copiedField === 'mod_raw_json_copy' ? 'Copiado' : 'Copiar JSON'}
                            </button>
                          </div>
                          <div className="bg-slate-900 rounded-2xl p-6 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-[400px] shadow-inner">
                            <pre>{JSON.stringify(modalData, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-surface-200 bg-surface-50 flex justify-end">
              <button 
                type="button"
                onClick={() => setSelectedLog(null)}
                className="action-button-secondary font-black text-xs uppercase"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
