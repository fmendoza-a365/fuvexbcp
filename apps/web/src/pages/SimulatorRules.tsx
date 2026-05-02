import { useState, useEffect } from 'react';
import { ShieldCheck, Save, Edit2, X, Check, Plus } from 'lucide-react';
import axios from 'axios';

export default function SimulatorRules() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [globalForm, setGlobalForm] = useState({ tea: 0, costo: 0 });
  const [editingConvenioId, setEditingConvenioId] = useState<string | null>(null);
  const [convenioForm, setConvenioForm] = useState({ rci: 0, gracia: 0, sector: '' });
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newConvenioForm, setNewConvenioForm] = useState({ nombre: '', rci: 50, gracia: 1, sector: 'Otros' });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = ['SUPERADMIN', 'GERENTE'].includes(user.role);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/simulator/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
      setGlobalForm({
        tea: Number((res.data.configuracion?.TEA_DEFAULT * 100).toFixed(2)),
        costo: res.data.configuracion?.COSTO_ENVIO_FISICO
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGlobal = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch('/api/simulator/config', {
        updates: {
          TEA_DEFAULT: globalForm.tea / 100,
          COSTO_ENVIO_FISICO: globalForm.costo
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsEditingGlobal(false);
      fetchData();
    } catch {
      alert('Error actualizando configuración');
    }
  };

  const handleUpdateConvenio = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/simulator/convenios/${id}`, {
        rci_default: convenioForm.rci / 100,
        periodo_gracia: convenioForm.gracia,
        sector: convenioForm.sector
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingConvenioId(null);
      fetchData();
    } catch {
      alert('Error actualizando convenio');
    }
  };

  const handleCreateConvenio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/simulator/convenios', {
        nombre: newConvenioForm.nombre,
        rci_default: newConvenioForm.rci / 100,
        periodo_gracia: newConvenioForm.gracia,
        sector: newConvenioForm.sector
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsNewModalOpen(false);
      setNewConvenioForm({ nombre: '', rci: 50, gracia: 1, sector: 'Otros' });
      fetchData();
    } catch {
      alert('Error creando convenio');
    }
  };

  if (loading) return <div className="text-center py-20 animate-pulse text-[var(--color-bcp-blue)]">Cargando reglas...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Reglas del <span className="text-[var(--color-bcp-blue)]">Simulador</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Configuración global del motor matemático y convenios.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setIsNewModalOpen(true)} className="action-button-primary">
            <Plus size={18} /> Nuevo Convenio
          </button>
        )}
      </div>

      <div className="bg-[rgba(255,120,0,0.05)] border border-[rgba(255,120,0,0.1)] p-5 rounded-[2rem] flex items-center gap-4">
        <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[var(--color-bcp-orange)]">
          <ShieldCheck size={24} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black text-[var(--color-bcp-orange)] uppercase tracking-widest mb-0.5">Acceso {isAdmin ? 'Administrativo' : 'Restringido'}</p>
          <p className="text-text-700 text-xs font-bold leading-relaxed uppercase tracking-tight">
            {isAdmin ? 'Como administrador, puedes modificar las variables críticas que afectan los cálculos del simulador.' : 'Esta pantalla permite verificar las variables matemáticas del sistema. Los cambios afectan inmediatamente los cálculos.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* VARIABLES GLOBALES */}
        <div className="premium-card">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
              Variables Globales
            </h2>
            {isAdmin && !isEditingGlobal && (
              <button onClick={() => setIsEditingGlobal(true)} className="p-2 text-text-700 hover:bg-surface-100 rounded-xl transition-all">
                <Edit2 size={16} />
              </button>
            )}
            {isAdmin && isEditingGlobal && (
              <div className="flex gap-2">
                <button onClick={() => setIsEditingGlobal(false)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <X size={16} />
                </button>
                <button onClick={handleUpdateGlobal} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                  <Save size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-text-700 uppercase tracking-widest mb-2 block px-1">Tasa Efectiva Anual (TEA Default)</label>
              <div className="relative group">
                <input
                  type="number"
                  disabled={!isEditingGlobal}
                  className={`w-full bg-surface-50 border-none rounded-xl py-3 px-4 text-sm font-black text-slate-800 outline-none transition-all ${isEditingGlobal ? 'focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] bg-white shadow-sm' : 'cursor-not-allowed'}`}
                  value={globalForm.tea}
                  onChange={e => setGlobalForm({...globalForm, tea: Number(e.target.value)})}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-text-500">%</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-text-700 uppercase tracking-widest mb-2 block px-1">Costo Envío Estado de Cuenta Físico</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-text-500">S/</span>
                <input
                  type="number"
                  disabled={!isEditingGlobal}
                  className={`w-full bg-surface-50 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-black text-slate-800 outline-none transition-all ${isEditingGlobal ? 'focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] bg-white shadow-sm' : 'cursor-not-allowed'}`}
                  value={globalForm.costo}
                  onChange={e => setGlobalForm({...globalForm, costo: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="p-4 bg-surface-100 rounded-2xl flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-slate-300 animate-pulse"></div>
               <p className="text-[9px] font-bold text-text-500 uppercase leading-relaxed">
                  {isAdmin ? 'Los cambios realizados aquí se aplicarán a todas las nuevas simulaciones.' : 'Para modificar estos valores, contacte al equipo de administración central.'}
               </p>
            </div>
          </div>
        </div>

        {/* CONVENIOS */}
        <div className="premium-card flex flex-col">
          <h2 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
            Convenios Activos ({config?.convenios?.length ?? 0})
          </h2>
          <div className="overflow-y-auto max-h-[450px] pr-2 space-y-3 custom-scrollbar">
            {config?.convenios?.map((c: any) => (
              <div
                key={c.id}
                className={`p-4 border rounded-2xl transition-all duration-300 ${editingConvenioId === c.id ? 'bg-white border-[var(--color-bcp-blue)] shadow-xl' : 'border-surface-100 bg-surface-50 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-[11px] text-slate-800 uppercase tracking-tight">{c.nombre}</h3>
                    {editingConvenioId === c.id ? (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-[8px] font-black text-text-500 uppercase block mb-1">Periodo Gracia</label>
                          <input 
                            type="number" 
                            className="w-24 bg-surface-50 border-none rounded-lg py-1 px-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-[var(--color-bcp-blue)]"
                            value={convenioForm.gracia}
                            onChange={e => setConvenioForm({...convenioForm, gracia: Number(e.target.value)})}
                          />
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-text-500 uppercase block mb-1">Sector</label>
                          <select 
                            className="w-full bg-surface-50 border-none rounded-lg py-1 px-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-[var(--color-bcp-blue)]"
                            value={convenioForm.sector}
                            onChange={e => setConvenioForm({...convenioForm, sector: e.target.value})}
                          >
                            <option value="FF.AA. y Policiales">FF.AA. y Policiales</option>
                            <option value="Sector Salud">Sector Salud</option>
                            <option value="Organismos de Estado">Organismos de Estado</option>
                            <option value="Educación y Otros">Educación y Otros</option>
                            <option value="Otros">Otros</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center mt-0.5">
                        <p className="text-[9px] font-black text-text-500 uppercase tracking-widest">Gracia: {c.periodo_gracia} m</p>
                        <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase">{c.sector || 'Otros'}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isAdmin && (
                      editingConvenioId === c.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => setEditingConvenioId(null)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                            <X size={14} />
                          </button>
                          <button onClick={() => handleUpdateConvenio(c.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingConvenioId(c.id);
                            setConvenioForm({ 
                              rci: Number((c.rci_default * 100).toFixed(0)), 
                              gracia: c.periodo_gracia,
                              sector: c.sector || 'Otros'
                            });
                          }} 
                          className="p-1.5 text-text-500 hover:bg-surface-100 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                      )
                    )}
                    {editingConvenioId !== c.id && (
                      <div className="text-right">
                        <span className="text-[9px] font-black text-text-500 uppercase tracking-widest block mb-0.5 opacity-60">RCI Base</span>
                        <span className="text-sm font-black text-[var(--color-bcp-orange)] bg-[rgba(255,120,0,0.1)] px-3 py-1 rounded-full">
                          {(c.rci_default * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-surface-100 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
            <div className="p-8 border-b border-surface-200 flex justify-between items-center bg-surface-50/50">
              <div>
                <h3 className="text-xl font-bold text-text-900 uppercase tracking-tight">Nuevo Convenio</h3>
                <p className="text-xs font-bold text-text-700 uppercase tracking-widest mt-1">Configuración de Motor BCP</p>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-surface-100 text-text-700 hover:text-text-700 rounded-2xl shadow-sm transition-all border border-surface-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateConvenio} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-700 uppercase tracking-widest">Nombre</label>
                  <input 
                    type="text" required
                    placeholder="Ej. DIRIS LIMA"
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] outline-none"
                    value={newConvenioForm.nombre}
                    onChange={e => setNewConvenioForm({...newConvenioForm, nombre: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-700 uppercase tracking-widest">Sector</label>
                  <select 
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] outline-none"
                    value={newConvenioForm.sector}
                    onChange={e => setNewConvenioForm({...newConvenioForm, sector: e.target.value})}
                  >
                    <option value="FF.AA. y Policiales">FF.AA. y Policiales</option>
                    <option value="Sector Salud">Sector Salud</option>
                    <option value="Organismos de Estado">Organismos de Estado</option>
                    <option value="Educación y Otros">Educación y Otros</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-700 uppercase tracking-widest">RCI Default (%)</label>
                  <input 
                    type="number" required
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    value={newConvenioForm.rci}
                    onChange={e => setNewConvenioForm({...newConvenioForm, rci: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-700 uppercase tracking-widest">Meses Gracia</label>
                  <input 
                    type="number" required
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    value={newConvenioForm.gracia}
                    onChange={e => setNewConvenioForm({...newConvenioForm, gracia: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsNewModalOpen(false)}
                  className="bg-surface-200 text-text-700 font-bold px-6 py-3 rounded-2xl flex-1 justify-center flex items-center gap-2 hover:bg-surface-300 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-[var(--color-bcp-blue)] text-white font-bold px-6 py-3 rounded-2xl flex-1 justify-center flex items-center gap-2 hover:bg-blue-800 transition-all"
                >
                  <Check size={18} /> Crear Convenio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
