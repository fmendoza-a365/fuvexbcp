import { useEffect, useState } from 'react';
import { X, Check, XCircle, FileText, Download, ExternalLink, Eye, AlertCircle, RefreshCw, Loader2, Search, CheckCircle, AlertOctagon, HelpCircle, ShieldCheck, History, MessageSquare, GitBranch } from 'lucide-react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DocumentViewerProps {
  sale: any;
  onClose: () => void;
  onUpdate: () => void;
}

interface TransitionAction {
  destino: string;
  destino_label?: string;
  descripcion: string;
  requiere_motivo: boolean;
  motivos_disponibles?: string[];
}

interface TraceItem {
  id: string;
  type: 'note' | 'state';
  title: string;
  text: string;
  date?: string;
  author?: string;
}

export default function DocumentViewer({ sale, onClose, onUpdate }: DocumentViewerProps) {
  const [detailSale, setDetailSale] = useState<any>(sale);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showRccDetail, setShowRccDetail] = useState(false);
  const [activeRccTab, setActiveRccTab] = useState<'general' | 'historico' | 'deudas' | 'otros'>('general');
  const [loading, setLoading] = useState(false);
  const [transitionsLoading, setTransitionsLoading] = useState(true);
  const [availableTransitions, setAvailableTransitions] = useState<TransitionAction[]>([]);
  const [rccLoading, setRccLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const traceSource = detailSale || sale;
  const docs = sale.documents || [];
  const rccData = sale.rcc_raw_data ? JSON.parse(sale.rcc_raw_data) : null;

  const traceItems: TraceItem[] = [
    ...(traceSource.feedback ? [{
      id: 'feedback-inicial',
      type: 'note' as const,
      title: 'Observacion inicial',
      text: traceSource.feedback,
      date: traceSource.created_at || traceSource.fecha_ingreso,
      author: traceSource.asesor?.nombre || traceSource.asesor?.username
    }] : []),
    ...((traceSource.feedbackNotes || []).map((note: any) => ({
      id: note.id,
      type: 'note' as const,
      title: 'Nota del expediente',
      text: note.nota,
      date: note.created_at,
      author: note.user?.nombre || note.user?.username
    }))),
    ...((traceSource.audit_logs || [])
      .filter((log: any) => Boolean(log.detalles))
      .map((log: any) => ({
        id: log.id,
        type: 'state' as const,
        title: log.estado_nuevo ? `Cambio a ${log.estado_nuevo}` : (log.accion || 'Actualizacion'),
        text: log.detalles,
        date: log.created_at,
        author: log.user?.nombre || log.user?.username
      })))
  ]
    .filter(item => Boolean(item.text))
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;

    const fetchDetailSale = async () => {
      setDetailSale(sale);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/sales/${sale.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) {
          setDetailSale(res.data);
        }
      } catch (err) {
        console.error('Error fetching sale detail timeline', err);
      }
    };

    fetchDetailSale();

    return () => {
      cancelled = true;
    };
  }, [sale]);

  useEffect(() => {
    let cancelled = false;

    const fetchAvailableTransitions = async () => {
      setTransitionsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/api/sales/${sale.id}/next-steps`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) {
          setAvailableTransitions(res.data?.transiciones_disponibles || []);
        }
      } catch (err) {
        console.error('Error fetching transitions', err);
        if (!cancelled) {
          setAvailableTransitions([]);
        }
      } finally {
        if (!cancelled) {
          setTransitionsLoading(false);
        }
      }
    };

    fetchAvailableTransitions();

    return () => {
      cancelled = true;
    };
  }, [sale.id]);

  const fetchDocumentBlob = async (doc: any, download = false) => {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${doc.url}${download ? '?download=1' : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });
    const contentType = response.headers['content-type'];
    return new Blob([response.data], {
      type: typeof contentType === 'string' ? contentType : 'application/octet-stream'
    });
  };

  const handlePreviewDocument = async (doc: any) => {
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const blob = await fetchDocumentBlob(doc);
      const objectUrl = URL.createObjectURL(blob);
      setPreviewDoc({ ...doc, mimeType: blob.type });
      setPreviewUrl(objectUrl);
    } catch (err) {
      console.error('Error loading document preview', err);
      setError('No se pudo cargar el documento');
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      const blob = await fetchDocumentBlob(doc, true);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = doc.file_path?.split(/[\\/]/).pop() || 'documento';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Error downloading document', err);
      setError('No se pudo descargar el documento');
    }
  };

  const calificacion: Record<string, any> = {
    VERDE: {
      label: 'CALIFICA',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: CheckCircle,
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]'
    },
    AMARILLO: {
      label: 'REVISAR',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: AlertOctagon,
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]'
    },
    ROJO: {
      label: 'NO CALIFICA',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      icon: XCircle,
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]'
    },
    GRIS: {
      label: 'SIN DATOS',
      color: 'text-text-700',
      bg: 'bg-surface-50',
      border: 'border-surface-200',
      icon: HelpCircle,
      glow: ''
    }
  };

  const handleConsultarRCC = async () => {
    setRccLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/sales/${sale.id}/rcc`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate(); // Refrescar datos de la venta
    } catch (err: any) {
      console.error('Error RCC:', err);
      setError('Error al consultar Infoburo');
    } finally {
      setRccLoading(false);
    }
  };

  const [showMotivoModal, setShowMotivoModal] = useState<string | null>(null);
  const [motivoInput, setMotivoInput] = useState('');

  const handleStateChange = async (newState: string, motivo?: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/sales/${sale.id}/estado`, 
        { nuevo_estado: newState, motivo: motivo || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error changing state', err);
      const backendError = err.response?.data?.error || 'Error al actualizar el estado del expediente';
      const faltantes = err.response?.data?.documentos_faltantes;
      if (faltantes && faltantes.length > 0) {
        const lista = faltantes.map((d: any) => d.nombre || d.tipo).join(', ');
        setError(`${backendError}: ${lista}`);
      } else {
        setError(backendError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMotivo = () => {
    if (!motivoInput.trim()) return;
    handleStateChange(showMotivoModal!, motivoInput.trim());
    setShowMotivoModal(null);
    setMotivoInput('');
  };

  const handleTransitionClick = (transition: TransitionAction) => {
    if (transition.requiere_motivo) {
      setShowMotivoModal(transition.destino);
      return;
    }
    handleStateChange(transition.destino);
  };

  const formatEstadoLabel = (estado: string) => (
    estado
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );

  const getTransitionButtonClass = (destino: string) => {
    if (['RECHAZADO', 'RECHAZADA_POR_SCORE', 'BOLETA_NO_CALIFICA'].includes(destino)) {
      return 'bg-surface-100 hover:bg-rose-50 text-rose-600 border border-rose-200';
    }
    if (['OBSERVADA', 'OBSERVADO_BACK', 'PENDIENTE_DOCUMENTAR'].includes(destino)) {
      return 'bg-surface-100 hover:bg-amber-50 text-amber-700 border border-amber-200';
    }
    if (['APROBADA', 'DESEMBOLSADO', 'EN PROCESO', 'SUBSANADA'].includes(destino)) {
      return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
    return 'bg-surface-100 hover:bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] border border-blue-200';
  };

  const getTransitionIcon = (destino: string) => {
    if (['RECHAZADO', 'RECHAZADA_POR_SCORE', 'BOLETA_NO_CALIFICA', 'OBSERVADA', 'OBSERVADO_BACK'].includes(destino)) {
      return <XCircle size={18} />;
    }
    return <Check size={18} />;
  };

  const selectedTransition = availableTransitions.find(t => t.destino === showMotivoModal);

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'APROBADA': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'OBSERVADA': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'PENDIENTE_REASIGNACION': return 'text-amber-700 bg-amber-50 border-amber-200';
      default: return 'text-blue-700 bg-[rgba(0,42,141,0.1)] border-blue-200';
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-2 sm:p-6 transition-opacity"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="bg-surface-100 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-surface-200 animate-in zoom-in-95 duration-200">
          
          {/* Header Superior - Estilo Institucional */}
          <div className="px-6 py-4 border-b border-surface-200 flex justify-between items-center bg-surface-100 shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-surface-50 text-blue-600 rounded-lg border border-surface-200">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 id="modal-title" className="text-xl font-bold text-slate-800">Expediente {sale.dni_cliente}</h2>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getStatusColor(sale.estado)}`}>
                    {sale.estado}
                  </span>
                </div>
                <p className="text-sm text-text-700 mt-0.5">Asesor: <span className="font-medium text-slate-700">{sale.asesor?.nombre || 'Desconocido'}</span> • Cliente: <span className="font-medium text-slate-700">{sale.nombres_cliente}</span></p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-text-700 hover:text-text-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Cerrar modal"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-surface-50/50">
            
            {/* Left Panel: Document List */}
            <div className="flex-1 p-6 overflow-y-auto">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                Documentos Adjuntos
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">{docs.length}</span>
              </h3>
              
              <div className="space-y-3">
                {docs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-surface-100 rounded-lg border border-surface-200 shadow-sm hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{doc.tipo_documento}</p>
                        <p className="text-xs text-text-700">{doc.file_path?.split(/[\\/]/).pop() || 'Documento adjunto'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handlePreviewDocument(doc)} 
                        className="p-2 text-text-700 hover:text-blue-600 hover:bg-[rgba(0,42,141,0.1)] rounded-md transition-colors"
                        title="Ver Documento"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc)}
                        className="p-2 text-text-700 hover:text-blue-600 hover:bg-[rgba(0,42,141,0.1)] rounded-md transition-colors"
                        title="Descargar"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {docs.length === 0 && (
                  <div className="text-center py-12 bg-surface-100 rounded-lg border border-dashed border-slate-300">
                    <AlertCircle size={32} className="text-text-700 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700">Sin documentación</p>
                    <p className="text-xs text-text-700 mt-1">No hay archivos adjuntos en este expediente.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-surface-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <History size={18} className="text-[var(--color-bcp-blue)]" />
                  Historial / Trazabilidad
                  <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">{traceItems.length}</span>
                </h3>

                {traceItems.length > 0 ? (
                  <div className="space-y-3">
                    {traceItems.map((item) => {
                      const Icon = item.type === 'state' ? GitBranch : MessageSquare;
                      return (
                        <div key={item.id} className="flex gap-3 p-4 bg-surface-100 rounded-lg border border-surface-200 shadow-sm">
                          <div className="w-9 h-9 rounded-lg bg-[rgba(0,42,141,0.08)] text-[var(--color-bcp-blue)] flex items-center justify-center shrink-0">
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <p className="text-xs font-black uppercase tracking-wider text-text-900">{item.title}</p>
                              {item.date && (
                                <span className="text-[10px] font-bold uppercase text-text-700">
                                  {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: es })}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-text-700 leading-relaxed mt-1">{item.text}</p>
                            {item.author && (
                              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-bcp-blue)] mt-2">
                                {item.author}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-surface-100 rounded-lg border border-dashed border-surface-200">
                    <History size={28} className="text-text-700 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider text-text-700">
                      Sin trazabilidad registrada
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel (Información y Acciones) */}
            <div className="w-full md:w-[300px] lg:w-[320px] bg-surface-100 border-l border-surface-200 flex flex-col p-6 gap-6">
              
              {/* Detalles Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-text-700 uppercase tracking-wider">
                  Detalles del Crédito
                </h3>
                
                <div className="space-y-3">
                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                    <p className="text-xs text-text-700 mb-0.5">Monto Solicitado</p>
                    <p className="text-xl font-bold text-slate-800">S/ {sale.maf_neto?.toLocaleString() || '0'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                      <p className="text-xs text-text-700 mb-0.5">Plaza</p>
                      <p className="font-semibold text-slate-700 truncate">{sale.plaza || 'General'}</p>
                    </div>
                    <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                      <p className="text-xs text-text-700 mb-0.5">Remesa</p>
                      <p className="font-semibold text-slate-700">S/ {sale.monto_remesa || '0'}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                    <p className="text-xs text-text-700 mb-0.5">Convenio</p>
                    <p className="font-semibold text-slate-700">{sale.convenio || 'Sin convenio'}</p>
                  </div>
                </div>
              </div>

              {/* Validación RCC Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-700 uppercase tracking-wider">
                    Riesgo Crediticio
                  </h3>
                  {sale.rcc_semaforo && (
                    <button 
                      onClick={handleConsultarRCC}
                      disabled={rccLoading}
                      className="p-1 text-text-700 hover:text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] rounded transition-all disabled:opacity-30"
                      title="Actualizar Score"
                    >
                      <RefreshCw size={14} className={rccLoading ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>

                {!sale.rcc_semaforo ? (
                  <button
                    onClick={handleConsultarRCC}
                    disabled={rccLoading}
                    className="w-full group relative flex items-center justify-center gap-3 py-4 bg-surface-100 border-2 border-dashed border-surface-200 rounded-xl hover:border-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)]/30 transition-all overflow-hidden disabled:opacity-50"
                  >
                    {rccLoading ? (
                      <Loader2 size={24} className="animate-spin text-[var(--color-bcp-blue)]" />
                    ) : (
                      <>
                        <div className="p-2 bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] rounded-lg group-hover:scale-110 transition-transform">
                          <Search size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">Consultar Infoburo</p>
                          <p className="text-[10px] text-text-700 uppercase font-semibold">Validación inmediata</p>
                        </div>
                      </>
                    )}
                  </button>
                ) : (
                  <div className={`p-4 rounded-xl border ${calificacion[sale.rcc_semaforo]?.border} ${calificacion[sale.rcc_semaforo]?.bg} ${calificacion[sale.rcc_semaforo]?.glow} transition-all duration-500`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 bg-surface-100 rounded-lg shadow-sm ${calificacion[sale.rcc_semaforo]?.color}`}>
                        {(() => {
                          const Icon = calificacion[sale.rcc_semaforo]?.icon;
                          return <Icon size={24} />;
                        })()}
                      </div>
                      <div>
                        <p className={`text-sm font-black leading-tight ${calificacion[sale.rcc_semaforo]?.color}`}>
                          {calificacion[sale.rcc_semaforo]?.label}
                        </p>
                        {sale.rcc_ultima_act && (
                          <p className="text-[10px] text-text-700 font-medium">
                            {formatDistanceToNow(new Date(sale.rcc_ultima_act), { addSuffix: true, locale: es })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-text-700 font-medium uppercase">Deuda Total</span>
                        <span className="text-slate-800 font-black">S/ {sale.rcc_monto_deuda?.toLocaleString() || '0'}</span>
                      </div>
                      {rccData?.score && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-text-700 font-medium uppercase">Score Buro</span>
                          <span className="text-slate-800 font-black">{rccData.score}</span>
                        </div>
                      )}
                      <div className="h-1 w-full bg-black/5 rounded-full overflow-hidden mt-2">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            sale.rcc_semaforo === 'VERDE' ? 'w-full bg-emerald-500' : 
                            sale.rcc_semaforo === 'AMARILLO' ? 'w-2/3 bg-amber-500' : 
                            'w-1/3 bg-rose-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {sale.rcc_semaforo && (
                  <button 
                    onClick={() => setShowRccDetail(true)}
                    className="w-full py-2 text-[10px] font-bold text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] border border-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"
                  >
                    Ver Reporte Detallado <ExternalLink size={12} />
                  </button>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-auto space-y-3 pt-4 border-t border-surface-200">
                <h3 className="text-xs font-semibold text-text-700 uppercase tracking-wider mb-2">Acciones disponibles</h3>

                {transitionsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs font-bold text-text-700 uppercase">
                    <Loader2 size={16} className="animate-spin" /> Cargando acciones
                  </div>
                ) : availableTransitions.length > 0 ? (
                  availableTransitions.map((transition) => (
                    <button
                      key={transition.destino}
                      onClick={() => handleTransitionClick(transition)}
                      disabled={loading}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getTransitionButtonClass(transition.destino)}`}
                      title={transition.descripcion}
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        <>
                          {getTransitionIcon(transition.destino)}
                          {transition.destino_label || formatEstadoLabel(transition.destino)}
                        </>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-center text-text-700 font-medium">
                    No hay transiciones disponibles para tu rol desde este estado.
                  </p>
                )}

                {error && (
                  <p className="text-xs text-center text-rose-600 font-medium mt-2">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal Overlay */}
      {previewDoc && (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-100/10 text-white rounded-lg">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{previewDoc.tipo_documento}</h3>
                <p className="text-xs text-text-700">{previewDoc.file_path?.split(/[\\/]/).pop()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a 
                href={previewUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-100/10 hover:bg-surface-100/20 text-white rounded-lg text-sm font-medium transition-colors"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink size={16} />
                <span className="hidden sm:inline">Abrir en pestaña nueva</span>
              </a>
              <button 
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setPreviewDoc(null);
                }} 
                className="p-2 bg-surface-100/10 hover:bg-surface-100/20 text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-surface-100 rounded-xl overflow-hidden relative shadow-2xl">
            {previewDoc.mimeType?.includes('pdf') || previewDoc.file_path?.toLowerCase().endsWith('.pdf') ? (
              <iframe 
                src={`${previewUrl}#toolbar=0&navpanes=0`} 
                className="w-full h-full border-none" 
                title={previewDoc.tipo_documento} 
              />
            ) : (
              <img 
                src={previewUrl || ''} 
                alt={previewDoc.tipo_documento} 
                className="w-full h-full object-contain" 
              />
            )}
          </div>
        </div>
      )}
      {/* Modal Reporte RCC Detallado */}
      {showRccDetail && rccData && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
          <div className="bg-surface-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-surface-200">
            <div className="px-6 py-4 border-b border-surface-200 flex justify-between items-center bg-surface-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${calificacion[sale.rcc_semaforo]?.bg} ${calificacion[sale.rcc_semaforo]?.color}`}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Reporte Crediticio Completo</h3>
                  <p className="text-xs text-text-700 font-medium">{rccData.nombres} • DNI: {rccData.dni}</p>
                </div>
              </div>
              <button onClick={() => setShowRccDetail(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-text-700" />
              </button>
            </div>

            {/* Pestañas del Reporte */}
            <div className="flex bg-surface-50 border-b border-surface-200 overflow-x-auto no-scrollbar shrink-0" role="tablist" aria-label="Secciones del reporte crediticio">
              {[
                { id: 'general', label: 'Información General' },
                { id: 'historico', label: 'Histórico SBS' },
                { id: 'deudas', label: 'Deudas por Entidad' },
                { id: 'otros', label: 'Otros Datos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeRccTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveRccTab(tab.id as any)}
                  className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap outline-none focus-visible:bg-[rgba(0,42,141,0.1)] ${
                    activeRccTab === tab.id 
                      ? 'text-[var(--color-bcp-blue)] border-[var(--color-bcp-blue)] bg-surface-100' 
                      : 'text-text-700 border-transparent hover:text-text-700 hover:bg-slate-100/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="h-[500px] overflow-y-auto p-6 sm:p-8 scrollbar-thin scrollbar-thumb-slate-200 bg-surface-100">
              <div 
                key={activeRccTab}
                role="tabpanel" 
                id={`tabpanel-${activeRccTab}`} 
                aria-labelledby={`tab-${activeRccTab}`}
                className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out h-full"
              >
                {activeRccTab === 'general' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-text-700 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,42,141,0.1)]0"></div> Datos Personales
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'DNI', value: rccData.dni },
                            { label: 'Estado Civil', value: rccData.infoGeneral?.estadoCivil },
                            { label: 'Sexo', value: rccData.infoGeneral?.sexo },
                            { label: 'Nacimiento', value: rccData.infoGeneral?.nacimiento },
                          ].map((f, i) => (
                            <div key={i} className="p-4 bg-surface-50 rounded-xl border border-surface-200 hover:bg-surface-100 hover:shadow-sm transition-all group">
                              <p className="text-[9px] text-text-700 font-bold uppercase mb-1 group-hover:text-blue-500 transition-colors">{f.label}</p>
                              <p className="text-xs font-black text-slate-800">{f.value || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {rccData.ruc && (
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-text-700 uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,42,141,0.1)]0"></div> Información RUC
                          </h4>
                          <div className="p-5 bg-[rgba(0,42,141,0.1)]/50 rounded-2xl border border-blue-100 hover:bg-[rgba(0,42,141,0.1)] transition-all">
                            <p className="text-[9px] text-blue-400 font-bold uppercase mb-1">Razón Social</p>
                            <p className="text-sm font-black text-slate-800 mb-4">{rccData.ruc.razonSocial || 'No registra'}</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[9px] text-blue-400 font-bold uppercase">RUC</p>
                                <p className="text-xs font-black text-slate-700">{rccData.ruc.ruc || '-'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-blue-400 font-bold uppercase">Estado</p>
                                <p className="text-xs font-black text-slate-700">{rccData.ruc.estado || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeRccTab === 'historico' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      {rccData.historico?.map((h: any, i: number) => (
                        <div key={i} className="p-4 bg-surface-100 rounded-xl border border-surface-200 shadow-sm text-center group hover:border-blue-300 hover:shadow-md transition-all">
                          <p className="text-[10px] font-bold text-text-700 mb-2">{h.mes} {h.fecha}</p>
                          <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-3 bg-slate-100">
                            {parseFloat(h.porNOR) > 0 && <div style={{ width: `${h.porNOR}%` }} className="bg-emerald-500 h-full"></div>}
                            {parseFloat(h.porCPP) > 0 && <div style={{ width: `${h.porCPP}%` }} className="bg-amber-400 h-full"></div>}
                            {parseFloat(h.porDEF) > 0 && <div style={{ width: `${h.porDEF}%` }} className="bg-[rgba(255,120,0,0.1)]0 h-full"></div>}
                            {parseFloat(h.porDUD) > 0 && <div style={{ width: `${h.porDUD}%` }} className="bg-rose-500 h-full"></div>}
                            {parseFloat(h.porPER) > 0 && <div style={{ width: `${h.porPER}%` }} className="bg-slate-800 h-full"></div>}
                          </div>
                          <p className="text-sm font-black text-slate-800">S/ {h.deudaTotal}</p>
                          <p className="text-[9px] font-bold text-text-700 mt-1 uppercase tracking-tighter">{h.numEntidades} Entidades</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeRccTab === 'deudas' && (
                  <div className="space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-surface-200 shadow-sm bg-surface-100">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-surface-50/80 text-[10px] text-text-700 font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-5">Entidad Financiera</th>
                            <th className="px-6 py-5">Línea Aprobada</th>
                            <th className="px-6 py-5">Línea Utilizada</th>
                            <th className="px-6 py-5">No Utilizada</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
                          {rccData.lineasCredito?.map((l: any, i: number) => (
                            <tr key={i} className="hover:bg-[rgba(0,42,141,0.1)]/50 transition-all group">
                              <td className="px-6 py-4 font-bold text-slate-800 group-hover:text-[var(--color-bcp-blue)]">{l.entidad}</td>
                              <td className="px-6 py-4 font-medium text-text-700">S/ {l.lineaAprobada}</td>
                              <td className="px-6 py-4 font-black text-rose-600">S/ {l.lineaUtilizada}</td>
                              <td className="px-6 py-4 text-emerald-600 font-bold">S/ {l.lineaNoUtilizada}</td>
                            </tr>
                          ))}
                          {(!rccData.lineasCredito || rccData.lineasCredito.length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-text-700 font-bold uppercase tracking-widest text-[10px]">No se registran líneas activas</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeRccTab === 'otros' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      <div className="lg:col-span-4 p-6 bg-surface-50 rounded-2xl border border-surface-200 h-fit">
                        <h4 className="text-[10px] font-black text-text-700 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,42,141,0.1)]0"></div> Información de Filtro
                        </h4>
                        <div className="space-y-4">
                          {[
                            { label: 'Score Buró', value: rccData.score },
                            { label: 'Producto', value: rccData.producto },
                            { label: 'Color DxP', value: rccData.colorDxP },
                            { label: 'Filtro Vehicular', value: rccData.filtroVehicular },
                            { label: 'Motivo Caída DxP', value: rccData.motivoCaida },
                          ].map((f, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-surface-200/50 pb-3">
                              <span className="text-[9px] text-text-700 font-bold uppercase">{f.label}</span>
                              <span className="text-xs font-black text-slate-800">{f.value || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="lg:col-span-8 space-y-6">
                        {rccData.otros && rccData.otros.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-text-700 uppercase tracking-widest flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,42,141,0.1)]0"></div> Resumen Financiero Detallado
                            </h4>
                            <div className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-100 shadow-sm">
                              <table className="w-full text-[10px]">
                                <thead className="bg-surface-50 text-text-700 font-black uppercase border-b border-surface-200">
                                  <tr>
                                    {Object.keys(rccData.otros[0] || {}).map(k => <th key={k} className="px-4 py-4 text-left">{k}</th>)}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-slate-700">
                                  {rccData.otros.map((row: any, i: number) => (
                                    <tr key={i} className="hover:bg-[rgba(0,42,141,0.1)]/30 transition-colors">
                                      {Object.values(row).map((v: any, j: number) => (
                                        <td key={j} className={`px-4 py-4 font-bold ${j > 0 ? 'text-text-900' : 'text-blue-700'}`}>
                                          {v === '0.00' ? <span className="text-text-700 font-medium">0.00</span> : v}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                          <p className="text-[10px] text-amber-700 font-bold uppercase mb-1 flex items-center gap-1">
                            <AlertCircle size={12} /> Nota Importante
                          </p>
                          <p className="text-[10px] text-amber-600 leading-relaxed font-medium">
                            La información mostrada en esta pestaña corresponde a filtros adicionales y deudas castigadas/provisionales capturadas durante la última consulta.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-200 bg-surface-50 flex justify-end">
               <button onClick={() => setShowRccDetail(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-all">
                 Entendido
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Motivo para Observación */}
      {showMotivoModal && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface-100 rounded-xl shadow-2xl w-full max-w-md border border-surface-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-200 bg-rose-50">
              <h3 className="text-base font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={18} /> Motivo de Observación
              </h3>
              <p className="text-xs text-rose-600 mt-1">Debe especificar el motivo para observar el expediente.</p>
            </div>
            <div className="p-6">
              {selectedTransition?.motivos_disponibles && selectedTransition.motivos_disponibles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedTransition.motivos_disponibles.slice(0, 4).map((motivo) => (
                    <button
                      key={motivo}
                      type="button"
                      onClick={() => setMotivoInput(motivo)}
                      className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-full hover:bg-rose-100 transition-colors"
                    >
                      {motivo}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                placeholder="Describa el motivo de la observación..."
                className="w-full p-3 border border-surface-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent resize-none h-28 bg-surface-50"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-surface-200 bg-surface-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowMotivoModal(null); setMotivoInput(''); }}
                className="px-4 py-2 text-sm font-medium text-text-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitMotivo}
                disabled={!motivoInput.trim() || loading}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <XCircle size={16} />
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
