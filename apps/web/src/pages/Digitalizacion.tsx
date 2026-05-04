import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileCheck,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  X,
  XCircle
} from 'lucide-react';

interface Sale {
  id: string;
  dni_cliente: string;
  nombres_cliente: string;
  estado: string;
  convenio?: string | null;
  maf_neto?: number | null;
  asesor?: { username?: string; nombre?: string } | null;
}

interface ExpedienteInstitucion {
  id: string;
  sale_id: string;
  institucion: string;
  estado: string;
  fecha_envio?: string | null;
  fecha_respuesta?: string | null;
  observaciones?: string | null;
  usuario?: { nombre?: string; username?: string } | null;
}

interface BcpChecklistItem {
  tipo: string;
  nombre: string;
  obligatorio: boolean;
  completado?: boolean;
  observacion?: string;
}

interface ExpedienteBCP {
  id: string;
  sale_id: string;
  nro_expediente?: string | null;
  agencia?: string | null;
  estado: string;
  observaciones_bcp?: string | null;
  checklist: BcpChecklistItem[];
  resumen?: {
    total_documentos: number;
    obligatorios: number;
    completados: number;
    pendientes: number;
    completitud_pct: number;
    completo: boolean;
  };
}

interface UploadedChecklistItem {
  tipo: string;
  nombre: string;
  obligatorio: boolean;
  subido: boolean;
  cantidad: number;
}

const INSTITUCIONES_SUGERIDAS = ['RENIEC', 'SUNAT', 'ESSALUD', 'SIS', 'SCTR', 'SBS', 'SUNARP', 'MIGRACIONES'];
const ESTADOS_INSTITUCION = ['PENDIENTE', 'ENVIADO', 'RECIBIDO', 'RECHAZADO'];
const ESTADOS_BCP = ['EN_PREPARACION', 'ENVIADO_BCP', 'EN_EVALUACION_BCP', 'APROBADO_BCP', 'RECHAZADO_BCP', 'DESEMBOLSADO_BCP'];

const GUIDE_STEPS = [
  {
    title: '1. Selecciona el expediente',
    icon: Search,
    focus: 'Panel izquierdo',
    summary: 'Aqui eliges el cliente que vas a digitalizar. Puedes buscar por DNI, nombre o estado.',
    actions: [
      'Busca el expediente del cliente.',
      'Haz clic sobre la tarjeta del cliente.',
      'El sistema carga instituciones, expediente BCP y checklist documental.'
    ],
    result: 'Todo lo que registres despues queda asociado a ese expediente.'
  },
  {
    title: '2. Gestiona instituciones',
    icon: Building2,
    focus: 'Instituciones del expediente',
    summary: 'Sirve para controlar consultas externas o validaciones con entidades como ESSALUD, SUNAT o RENIEC.',
    actions: [
      'Selecciona una institucion.',
      'Agrega una observacion si necesitas contexto.',
      'Actualiza el estado: PENDIENTE, ENVIADO, RECIBIDO o RECHAZADO.'
    ],
    result: 'Cuando marcas ENVIADO o RECIBIDO, el sistema guarda fechas de seguimiento.'
  },
  {
    title: '3. Registra expediente BCP',
    icon: Send,
    focus: 'Expediente BCP',
    summary: 'Aqui documentas lo que ocurre cuando el caso ya se prepara o envia hacia BCP.',
    actions: [
      'Completa numero de expediente si BCP lo asigna.',
      'Registra agencia, estado BCP y observaciones.',
      'Guarda cambios para mantener trazabilidad.'
    ],
    result: 'Estados como APROBADO_BCP o RECHAZADO_BCP pueden mover el estado principal del expediente.'
  },
  {
    title: '4. Revisa checklist',
    icon: ClipboardCheck,
    focus: 'Documentos y checklist',
    summary: 'Compara lo que BCP requiere contra lo que ya esta subido o marcado como completo.',
    actions: [
      'Revisa el avance del checklist BCP.',
      'Marca o desmarca documentos BCP cuando se validen.',
      'Contrasta los documentos subidos contra los requeridos.'
    ],
    result: 'El porcentaje indica si el expediente esta listo documentalmente para continuar.'
  },
  {
    title: '5. Flujo recomendado',
    icon: ListChecks,
    focus: 'Uso operativo diario',
    summary: 'Digitalizacion es el tablero de control posterior al registro del expediente.',
    actions: [
      'Primero aseguras documentos cargados desde bandeja o app movil.',
      'Luego das seguimiento a instituciones.',
      'Finalmente completas expediente BCP y checklist.'
    ],
    result: 'La trazabilidad queda disponible para saber que falta, quien actualizo y cual fue el ultimo avance.'
  }
];

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const getEstadoColor = (estado: string) => {
  const colors: Record<string, string> = {
    PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
    ENVIADO: 'bg-blue-50 text-blue-700 border-blue-200',
    RECIBIDO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    RECHAZADO: 'bg-rose-50 text-rose-700 border-rose-200',
    EN_PREPARACION: 'bg-slate-50 text-slate-700 border-slate-200',
    ENVIADO_BCP: 'bg-blue-50 text-blue-700 border-blue-200',
    EN_EVALUACION_BCP: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    APROBADO_BCP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    RECHAZADO_BCP: 'bg-rose-50 text-rose-700 border-rose-200',
    DESEMBOLSADO_BCP: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };
  return colors[estado] || 'bg-slate-50 text-slate-700 border-slate-200';
};

const formatEstado = (estado: string) => (
  estado
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-PE');
};

const DigitalizacionPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [instituciones, setInstituciones] = useState<ExpedienteInstitucion[]>([]);
  const [expedienteBcp, setExpedienteBcp] = useState<ExpedienteBCP | null>(null);
  const [uploadedChecklist, setUploadedChecklist] = useState<UploadedChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<'instituciones' | 'bcp' | 'documentos'>('instituciones');
  const [newInstitution, setNewInstitution] = useState('');
  const [newInstitutionObs, setNewInstitutionObs] = useState('');
  const [bcpForm, setBcpForm] = useState({ nro_expediente: '', agencia: '', estado: 'EN_PREPARACION', observaciones_bcp: '' });
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((sale) => (
      sale.dni_cliente.includes(q) ||
      sale.nombres_cliente.toLowerCase().includes(q) ||
      sale.estado.toLowerCase().includes(q)
    ));
  }, [sales, search]);

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/sales?limit=200', { headers: authHeaders() });
      const rows = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setSales(rows);
      if (!selectedSale && rows.length > 0) {
        setSelectedSale(rows[0]);
      }
    } catch (err: any) {
      console.error('Error fetching sales for digitalizacion:', err);
      setError(err.response?.data?.error || 'No se pudieron cargar expedientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSaleDigitalization = async (sale: Sale | null = selectedSale) => {
    if (!sale) return;
    setDetailLoading(true);
    setError('');
    try {
      const [instRes, bcpRes, checklistRes] = await Promise.all([
        axios.get(`/api/sales/${sale.id}/instituciones`, { headers: authHeaders() }),
        axios.get(`/api/sales/${sale.id}/expediente-bcp`, { headers: authHeaders() }),
        axios.get(`/api/sales/${sale.id}/documentos/checklist`, { headers: authHeaders() })
      ]);

      setInstituciones(instRes.data?.instituciones || []);
      setExpedienteBcp(bcpRes.data);
      setUploadedChecklist(checklistRes.data?.checklist || []);
      setBcpForm({
        nro_expediente: bcpRes.data?.nro_expediente || '',
        agencia: bcpRes.data?.agencia || '',
        estado: bcpRes.data?.estado || 'EN_PREPARACION',
        observaciones_bcp: bcpRes.data?.observaciones_bcp || ''
      });
    } catch (err: any) {
      console.error('Error fetching digitalizacion detail:', err);
      setError(err.response?.data?.error || 'No se pudo cargar la digitalizacion del expediente');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    fetchSaleDigitalization(selectedSale);
  }, [selectedSale?.id]);

  const handleSelectSale = (sale: Sale) => {
    setSelectedSale(sale);
    setExpanded('instituciones');
  };

  const handleAddInstitution = async () => {
    if (!selectedSale || !newInstitution.trim()) return;
    try {
      await axios.post(
        `/api/sales/${selectedSale.id}/instituciones`,
        { institucion: newInstitution.trim().toUpperCase(), observaciones: newInstitutionObs.trim() || undefined },
        { headers: authHeaders() }
      );
      setNewInstitution('');
      setNewInstitutionObs('');
      fetchSaleDigitalization(selectedSale);
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo registrar la institucion');
    }
  };

  const handleUpdateInstitutionStatus = async (inst: ExpedienteInstitucion, estado: string) => {
    if (!selectedSale) return;
    try {
      await axios.put(
        `/api/sales/${selectedSale.id}/instituciones/${inst.id}`,
        { estado },
        { headers: authHeaders() }
      );
      fetchSaleDigitalization(selectedSale);
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo actualizar la institucion');
    }
  };

  const handleDeleteInstitution = async (inst: ExpedienteInstitucion) => {
    if (!selectedSale || !window.confirm('Eliminar esta institucion del expediente?')) return;
    try {
      await axios.delete(`/api/sales/${selectedSale.id}/instituciones/${inst.id}`, { headers: authHeaders() });
      fetchSaleDigitalization(selectedSale);
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo eliminar la institucion');
    }
  };

  const handleSaveBcp = async () => {
    if (!selectedSale) return;
    try {
      await axios.put(`/api/sales/${selectedSale.id}/expediente-bcp`, bcpForm, { headers: authHeaders() });
      fetchSaleDigitalization(selectedSale);
      fetchSales();
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo actualizar expediente BCP');
    }
  };

  const handleToggleBcpChecklist = async (item: BcpChecklistItem) => {
    if (!selectedSale) return;
    try {
      await axios.put(
        `/api/sales/${selectedSale.id}/expediente-bcp/checklist/${item.tipo}`,
        { completado: !item.completado },
        { headers: authHeaders() }
      );
      fetchSaleDigitalization(selectedSale);
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo actualizar checklist BCP');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-bcp-blue)]"></div>
      </div>
    );
  }

  const bcpProgress = expedienteBcp?.resumen?.completitud_pct || 0;
  const activeGuide = GUIDE_STEPS[guideStep];
  const ActiveGuideIcon = activeGuide.icon;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Digitalizacion</h1>
          <p className="page-subtitle">Gestion operativa de instituciones, expediente BCP y checklist documental</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowGuide(true)} className="action-button-secondary">
            <BookOpen size={16} /> Guia interactiva
          </button>
          <button onClick={fetchSales} className="action-button-primary">
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="surface-card p-4 flex items-center gap-3 text-rose-700 bg-rose-50 border-rose-200">
          <AlertCircle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5">
        <div className="surface-card overflow-hidden">
          <div className="p-4 border-b border-surface-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-700" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar DNI, cliente o estado"
                className="field-input !pl-10"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2 space-y-1">
            {filteredSales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => handleSelectSale(sale)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedSale?.id === sale.id
                    ? 'bg-[rgba(0,42,141,0.08)] border-[var(--color-bcp-blue)]'
                    : 'bg-surface-100 border-transparent hover:bg-surface-50 hover:border-surface-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-black text-text-900 uppercase truncate">{sale.nombres_cliente}</div>
                    <div className="text-[10px] font-bold text-text-700 mt-0.5">DNI: {sale.dni_cliente}</div>
                  </div>
                  <span className={`status-pill shrink-0 ${getEstadoColor(sale.estado)}`}>{sale.estado}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-text-700">
                  <span>{sale.convenio || 'Sin convenio'}</span>
                  <span>S/ {(sale.maf_neto || 0).toLocaleString()}</span>
                </div>
              </button>
            ))}

            {filteredSales.length === 0 && (
              <div className="p-10 text-center text-[10px] font-bold uppercase text-text-700">
                No hay expedientes
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {!selectedSale ? (
            <div className="surface-card p-12 text-center">
              <AlertCircle size={32} className="mx-auto text-text-700 mb-3" />
              <p className="text-sm font-bold text-text-700">Selecciona un expediente para gestionar su digitalizacion.</p>
            </div>
          ) : (
            <>
              <div className="surface-card p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-700">Expediente seleccionado</div>
                    <h2 className="text-xl font-bold text-text-900 uppercase tracking-tight mt-1">{selectedSale.nombres_cliente}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="status-pill bg-surface-50 text-text-700 border-surface-200">DNI {selectedSale.dni_cliente}</span>
                      <span className={`status-pill ${getEstadoColor(selectedSale.estado)}`}>{selectedSale.estado}</span>
                      <span className="status-pill bg-blue-50 text-blue-700 border-blue-200">{selectedSale.convenio || 'Sin convenio'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                    <div className="surface-card p-3">
                      <div className="stat-label">Instituciones</div>
                      <div className="stat-value">{instituciones.length}</div>
                    </div>
                    <div className="surface-card p-3">
                      <div className="stat-label">Checklist BCP</div>
                      <div className="stat-value text-[var(--color-bcp-blue)]">{bcpProgress}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {detailLoading ? (
                <div className="surface-card p-12 text-center text-text-700 text-xs font-bold uppercase">
                  Cargando detalle...
                </div>
              ) : (
                <>
                  <section className="surface-card overflow-hidden">
                    <button
                      onClick={() => setExpanded(expanded === 'instituciones' ? 'bcp' : 'instituciones')}
                      className="w-full p-4 flex items-center justify-between border-b border-surface-200 hover:bg-surface-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 size={18} className="text-[var(--color-bcp-blue)]" />
                        <span className="text-sm font-black uppercase text-text-900">Instituciones del expediente</span>
                      </div>
                      {expanded === 'instituciones' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {expanded === 'instituciones' && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_auto] gap-3">
                          <select value={newInstitution} onChange={(event) => setNewInstitution(event.target.value)} className="field-input">
                            <option value="">Seleccionar institucion</option>
                            {INSTITUCIONES_SUGERIDAS.map((inst) => <option key={inst} value={inst}>{inst}</option>)}
                          </select>
                          <input
                            value={newInstitutionObs}
                            onChange={(event) => setNewInstitutionObs(event.target.value)}
                            placeholder="Observaciones opcionales"
                            className="field-input"
                          />
                          <button onClick={handleAddInstitution} disabled={!newInstitution} className="action-button-primary disabled:opacity-50">
                            <Plus size={16} /> Registrar
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="data-table-header">
                                <th className="px-4 py-3 text-left">Institucion</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Envio</th>
                                <th className="px-4 py-3 text-center">Respuesta</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {instituciones.map((inst) => (
                                <tr key={inst.id} className="data-table-row">
                                  <td className="px-4 py-3">
                                    <div className="text-xs font-black text-text-900 uppercase">{inst.institucion}</div>
                                    <div className="text-[10px] font-bold text-text-700">{inst.observaciones || 'Sin observaciones'}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`status-pill ${getEstadoColor(inst.estado)}`}>{inst.estado}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center text-xs font-bold text-text-700">{formatDate(inst.fecha_envio)}</td>
                                  <td className="px-4 py-3 text-center text-xs font-bold text-text-700">{formatDate(inst.fecha_respuesta)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                      <select
                                        value={inst.estado}
                                        onChange={(event) => handleUpdateInstitutionStatus(inst, event.target.value)}
                                        className="px-2 py-1.5 text-[10px] font-bold border border-surface-200 rounded-md bg-surface-50 outline-none"
                                      >
                                        {ESTADOS_INSTITUCION.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                                      </select>
                                      <button onClick={() => handleDeleteInstitution(inst)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {instituciones.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-10 text-center text-[10px] font-bold text-text-700 uppercase">
                                    No hay instituciones registradas para este expediente
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="surface-card overflow-hidden">
                    <button
                      onClick={() => setExpanded(expanded === 'bcp' ? 'documentos' : 'bcp')}
                      className="w-full p-4 flex items-center justify-between border-b border-surface-200 hover:bg-surface-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Send size={18} className="text-[var(--color-bcp-blue)]" />
                        <span className="text-sm font-black uppercase text-text-900">Expediente BCP</span>
                      </div>
                      {expanded === 'bcp' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {expanded === 'bcp' && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                          <div>
                            <label className="field-label">Nro Expediente</label>
                            <input value={bcpForm.nro_expediente} onChange={(event) => setBcpForm({ ...bcpForm, nro_expediente: event.target.value })} className="field-input" />
                          </div>
                          <div>
                            <label className="field-label">Agencia</label>
                            <input value={bcpForm.agencia} onChange={(event) => setBcpForm({ ...bcpForm, agencia: event.target.value })} className="field-input" />
                          </div>
                          <div>
                            <label className="field-label">Estado BCP</label>
                            <select value={bcpForm.estado} onChange={(event) => setBcpForm({ ...bcpForm, estado: event.target.value })} className="field-input">
                              {ESTADOS_BCP.map((estado) => <option key={estado} value={estado}>{formatEstado(estado)}</option>)}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button onClick={handleSaveBcp} className="action-button-primary w-full justify-center">
                              <Save size={16} /> Guardar BCP
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="field-label">Observaciones BCP</label>
                          <textarea
                            value={bcpForm.observaciones_bcp}
                            onChange={(event) => setBcpForm({ ...bcpForm, observaciones_bcp: event.target.value })}
                            className="field-input min-h-20"
                          />
                        </div>

                        <div className="surface-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="stat-label mb-0">Avance checklist BCP</span>
                            <span className="text-xs font-black text-[var(--color-bcp-blue)]">{bcpProgress}%</span>
                          </div>
                          <div className="h-2 bg-surface-50 rounded-full overflow-hidden border border-surface-200">
                            <div className="h-full bg-[var(--color-bcp-blue)] transition-all" style={{ width: `${bcpProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="surface-card overflow-hidden">
                    <button
                      onClick={() => setExpanded(expanded === 'documentos' ? 'instituciones' : 'documentos')}
                      className="w-full p-4 flex items-center justify-between border-b border-surface-200 hover:bg-surface-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ClipboardCheck size={18} className="text-[var(--color-bcp-blue)]" />
                        <span className="text-sm font-black uppercase text-text-900">Documentos y checklist</span>
                      </div>
                      {expanded === 'documentos' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {expanded === 'documentos' && (
                      <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div>
                          <h3 className="stat-label mb-3">Checklist BCP</h3>
                          <div className="space-y-2">
                            {(expedienteBcp?.checklist || []).map((item) => (
                              <button
                                key={item.tipo}
                                onClick={() => handleToggleBcpChecklist(item)}
                                className="w-full p-3 rounded-lg border border-surface-200 bg-surface-100 hover:bg-surface-50 transition-colors flex items-center justify-between gap-3"
                              >
                                <div className="text-left">
                                  <div className="text-xs font-bold text-text-900">{item.nombre}</div>
                                  <div className="text-[10px] font-bold text-text-700">{item.tipo} {item.obligatorio ? 'Obligatorio' : 'Opcional'}</div>
                                </div>
                                {item.completado ? <CheckCircle size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-text-700" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="stat-label mb-3">Documentos subidos</h3>
                          <div className="space-y-2">
                            {uploadedChecklist.map((doc) => (
                              <div key={doc.tipo} className="p-3 rounded-lg border border-surface-200 bg-surface-100 flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs font-bold text-text-900">{doc.nombre}</div>
                                  <div className="text-[10px] font-bold text-text-700">{doc.tipo} {doc.obligatorio ? 'Obligatorio' : 'Opcional'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {doc.subido ? <FileCheck size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-amber-600" />}
                                  <span className={`status-pill ${doc.subido ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {doc.subido ? `${doc.cantidad} subido` : 'Pendiente'}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {uploadedChecklist.length === 0 && (
                              <div className="p-8 text-center text-[10px] font-bold text-text-700 uppercase border border-dashed border-surface-200 rounded-lg">
                                No hay checklist documental configurado
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-panel w-full max-w-4xl max-h-[88vh] flex flex-col">
            <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[rgba(0,42,141,0.08)] text-[var(--color-bcp-blue)] flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-text-900 uppercase tracking-tight">Guia de Digitalizacion</h2>
                  <p className="text-xs font-semibold text-text-700">Recorrido practico por el modulo y sus estados.</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="w-10 h-10 rounded-lg border border-surface-200 bg-surface-50 text-text-700 hover:text-text-900 hover:bg-surface-100 transition-colors flex items-center justify-center"
                aria-label="Cerrar guia"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] min-h-0 overflow-hidden">
              <div className="border-b lg:border-b-0 lg:border-r border-surface-200 bg-surface-50 p-3 overflow-x-auto lg:overflow-y-auto">
                <div className="flex lg:flex-col gap-2 min-w-max lg:min-w-0">
                  {GUIDE_STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    const active = index === guideStep;

                    return (
                      <button
                        key={step.title}
                        onClick={() => setGuideStep(index)}
                        className={`text-left rounded-lg border p-3 transition-all ${
                          active
                            ? 'bg-[rgba(0,42,141,0.08)] border-[var(--color-bcp-blue)] text-[var(--color-bcp-blue)]'
                            : 'bg-surface-100 border-surface-200 text-text-700 hover:border-[rgba(0,42,141,0.25)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <StepIcon size={16} />
                          <span className="text-[11px] font-black uppercase tracking-tight">{step.title}</span>
                        </div>
                        <div className="text-[10px] font-bold mt-1 opacity-80">{step.focus}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 overflow-y-auto">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[rgba(0,42,141,0.08)] text-[var(--color-bcp-blue)] flex items-center justify-center shrink-0">
                    <ActiveGuideIcon size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-text-700">{activeGuide.focus}</div>
                    <h3 className="text-2xl font-black text-text-900 tracking-tight mt-1">{activeGuide.title}</h3>
                    <p className="text-sm font-semibold text-text-700 leading-relaxed mt-2">{activeGuide.summary}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="surface-card p-4">
                    <div className="stat-label">Que haces aqui</div>
                    <div className="space-y-3 mt-3">
                      {activeGuide.actions.map((action, index) => (
                        <div key={action} className="flex gap-3">
                          <div className="w-6 h-6 rounded-md bg-[var(--color-bcp-blue)] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </div>
                          <p className="text-sm font-semibold text-text-700 leading-snug">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="surface-card p-4 bg-[rgba(0,42,141,0.03)]">
                    <div className="stat-label">Resultado esperado</div>
                    <p className="text-sm font-bold text-text-900 leading-relaxed mt-3">{activeGuide.result}</p>
                    <div className="mt-4 p-3 rounded-lg bg-surface-100 border border-surface-200">
                      <div className="text-[10px] font-black uppercase tracking-widest text-text-700">Regla practica</div>
                      <p className="text-xs font-semibold text-text-700 mt-1">
                        Si no sabes que actualizar, primero revisa el estado del expediente y luego abre el bloque que coincide con lo pendiente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-xs font-bold text-text-700">
                    Paso {guideStep + 1} de {GUIDE_STEPS.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGuideStep((step) => Math.max(0, step - 1))}
                      disabled={guideStep === 0}
                      className="action-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowLeft size={16} /> Anterior
                    </button>
                    {guideStep < GUIDE_STEPS.length - 1 ? (
                      <button
                        onClick={() => setGuideStep((step) => Math.min(GUIDE_STEPS.length - 1, step + 1))}
                        className="action-button-primary"
                      >
                        Siguiente <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button onClick={() => setShowGuide(false)} className="action-button-primary">
                        Entendido <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalizacionPage;
