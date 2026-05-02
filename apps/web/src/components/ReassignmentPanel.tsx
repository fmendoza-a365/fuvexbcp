import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function ReassignmentPanel() {
  const [reasignaciones, setReasignaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<Record<string, string>>({});

  const fetchReasignaciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/sales/reasignaciones', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReasignaciones(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching reasignaciones', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReasignaciones();
  }, []);

  const handleReassignment = async (id: string, accion: 'APROBAR' | 'RECHAZAR') => {
    const m = motivo[id]?.trim();
    if (!m) {
      alert('Debes ingresar un motivo para aprobar o rechazar la reasignación.');
      return;
    }

    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/sales/${id}/reasignacion`, { accion, motivo: m }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchReasignaciones(); // Refresh the list
      
      // Dispatch custom event so the main dashboard can refresh the sales table
      window.dispatchEvent(new Event('refresh-sales'));
    } catch (err) {
      console.error(err);
      alert('Error al procesar la reasignación');
    } finally {
      setProcessingId(null);
      setMotivo(prev => { const n = {...prev}; delete n[id]; return n; });
    }
  };

  if (loading || reasignaciones.length === 0) return null;

  return (
    <div className="mb-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-orange-200 dark:border-orange-500/20 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(255,120,0,0.05)]">
      <div 
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-500/5 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 text-orange-600 p-2 rounded-full">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-orange-800">Reasignaciones Pendientes</h3>
            <p className="text-sm text-orange-700">Tienes {reasignaciones.length} solicitud{reasignaciones.length > 1 ? 'es' : ''} pendiente{reasignaciones.length > 1 ? 's' : ''} de revisión</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="text-orange-600" /> : <ChevronDown className="text-orange-600" />}
      </div>

      {expanded && (
        <div className="p-4 border-t border-orange-200 bg-surface-100">
          <div className="space-y-4">
            {reasignaciones.map((r) => (
              <div key={r.id} className="border border-surface-200 rounded-md p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-slate-100 text-text-700 px-2 py-1 rounded text-xs font-semibold">DNI: {r.dni_cliente}</span>
                    <span className="font-semibold text-slate-800">{r.nombres_cliente}</span>
                  </div>
                  <div className="text-sm text-text-700 flex items-center gap-2">
                    <span className="line-through opacity-70">De: {r.original_vendor?.nombre || r.original_vendor?.username || 'Desconocido'}</span>
                    <span>→</span>
                    <span className="font-semibold text-[var(--color-bcp-blue)]">Para: {r.asesor?.nombre || r.asesor?.username}</span>
                  </div>
                  <div className="text-xs text-text-700 mt-1">
                    Solicitado el {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="w-full sm:w-auto flex flex-col gap-2">
                  <input 
                    type="text" 
                    placeholder="Motivo de la decisión..." 
                    className="border border-slate-300 rounded px-3 py-1.5 text-sm w-full sm:w-64"
                    value={motivo[r.id] || ''}
                    onChange={(e) => setMotivo({...motivo, [r.id]: e.target.value})}
                    disabled={processingId === r.id}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleReassignment(r.id, 'RECHAZAR')}
                      disabled={processingId === r.id}
                      className="flex-1 flex justify-center items-center gap-1 bg-surface-100 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircle size={16} /> Rechazar
                    </button>
                    <button 
                      onClick={() => handleReassignment(r.id, 'APROBAR')}
                      disabled={processingId === r.id}
                      className="flex-1 flex justify-center items-center gap-1 bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={16} /> Aprobar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
