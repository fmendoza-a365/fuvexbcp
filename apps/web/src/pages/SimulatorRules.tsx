import { useState, useEffect, useMemo } from 'react';
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
  const [newCargoForm, setNewCargoForm] = useState({ nombre: '' });
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [cargoForm, setCargoForm] = useState({ nombre: '' });
  const [selectedConvenioId, setSelectedConvenioId] = useState('');
  const [newRuleForm, setNewRuleForm] = useState({ cargo_id: '', rci: 50, edad: '' });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({ rci: 50, edad: '' });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = ['SUPERADMIN', 'GERENTE'].includes(user.role);

  const selectedConvenio = useMemo(() => (
    config?.convenios?.find((item: any) => item.id === selectedConvenioId) || null
  ), [config, selectedConvenioId]);

  const cargosById = useMemo(() => {
    const map = new Map<string, any>();
    (config?.cargos || []).forEach((cargo: any) => map.set(cargo.id, cargo));
    return map;
  }, [config]);

  const reglasForSelectedConvenio = useMemo(() => (
    (config?.reglas || []).filter((regla: any) => regla.convenio_id === selectedConvenioId)
  ), [config, selectedConvenioId]);

  const assignedCargoIds = useMemo(() => new Set(reglasForSelectedConvenio.map((regla: any) => regla.cargo_id)), [reglasForSelectedConvenio]);

  const availableCargosForRule = useMemo(() => (
    (config?.cargos || []).filter((cargo: any) => !assignedCargoIds.has(cargo.id))
  ), [config, assignedCargoIds]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedConvenio) return;
    setNewRuleForm(prev => ({
      ...prev,
      rci: Number((selectedConvenio.rci_default * 100).toFixed(0))
    }));
  }, [selectedConvenioId]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/simulator/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
      if (!selectedConvenioId && res.data.convenios?.[0]?.id) {
        setSelectedConvenioId(res.data.convenios[0].id);
      }
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

  const handleCreateCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/simulator/cargos', {
        nombre: newCargoForm.nombre
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewCargoForm({ nombre: '' });
      fetchData();
    } catch {
      alert('Error creando cargo');
    }
  };

  const handleUpdateCargo = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/simulator/cargos/${id}`, {
        nombre: cargoForm.nombre
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingCargoId(null);
      fetchData();
    } catch {
      alert('Error actualizando cargo');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvenioId || !newRuleForm.cargo_id) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/simulator/reglas', {
        convenio_id: selectedConvenioId,
        cargo_id: newRuleForm.cargo_id,
        rci_especifico: newRuleForm.rci / 100,
        edad_maxima: newRuleForm.edad || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewRuleForm({ cargo_id: '', rci: selectedConvenio ? Number((selectedConvenio.rci_default * 100).toFixed(0)) : 50, edad: '' });
      fetchData();
    } catch {
      alert('Error guardando regla de RCI');
    }
  };

  const handleUpdateRule = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/simulator/reglas/${id}`, {
        rci_especifico: ruleForm.rci / 100,
        edad_maxima: ruleForm.edad || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingRuleId(null);
      fetchData();
    } catch {
      alert('Error actualizando regla de RCI');
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
                          <label className="text-[8px] font-black text-text-500 uppercase block mb-1">RCI Base (%)</label>
                          <input
                            type="number"
                            className="w-24 bg-surface-50 border-none rounded-lg py-1 px-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-[var(--color-bcp-blue)]"
                            value={convenioForm.rci}
                            onChange={e => setConvenioForm({...convenioForm, rci: Number(e.target.value)})}
                          />
                        </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-8">
        <div className="premium-card">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[var(--color-bcp-blue)] rounded-full"></div>
                Cargos ({config?.cargos?.length ?? 0})
              </h2>
              <p className="text-xs font-bold text-text-700 mt-2">Catalogo editable usado por la calculadora.</p>
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={handleCreateCargo} className="flex gap-3 mb-5">
              <input
                type="text"
                required
                placeholder="Nuevo cargo"
                className="field-input flex-1"
                value={newCargoForm.nombre}
                onChange={e => setNewCargoForm({ nombre: e.target.value })}
              />
              <button type="submit" className="action-button-primary">
                <Plus size={16} /> Agregar
              </button>
            </form>
          )}

          <div className="max-h-[380px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {(config?.cargos || []).map((cargo: any) => (
              <div key={cargo.id} className="surface-card p-3 flex items-center justify-between gap-3">
                {editingCargoId === cargo.id ? (
                  <>
                    <input
                      className="field-input flex-1"
                      value={cargoForm.nombre}
                      onChange={e => setCargoForm({ nombre: e.target.value })}
                    />
                    <button onClick={() => setEditingCargoId(null)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" type="button">
                      <X size={15} />
                    </button>
                    <button onClick={() => handleUpdateCargo(cargo.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" type="button">
                      <Check size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-black uppercase text-text-900">{cargo.nombre}</div>
                      <div className="text-[9px] font-bold uppercase text-text-500">{cargo.activo ? 'Activo' : 'Inactivo'}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingCargoId(cargo.id);
                          setCargoForm({ nombre: cargo.nombre });
                        }}
                        className="p-2 text-text-500 hover:bg-surface-100 rounded-lg"
                        type="button"
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[var(--color-bcp-orange)] rounded-full"></div>
                RCI por Convenio y Cargo
              </h2>
              <p className="text-xs font-bold text-text-700 mt-2">Estas reglas tienen prioridad sobre el RCI base del convenio.</p>
            </div>
            <select
              className="field-input lg:w-72"
              value={selectedConvenioId}
              onChange={e => setSelectedConvenioId(e.target.value)}
            >
              {(config?.convenios || []).map((convenio: any) => (
                <option key={convenio.id} value={convenio.id}>{convenio.nombre}</option>
              ))}
            </select>
          </div>

          {isAdmin && selectedConvenioId && (
            <form onSubmit={handleCreateRule} className="filter-panel grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] mb-5">
              <select
                required
                className="field-input"
                value={newRuleForm.cargo_id}
                onChange={e => setNewRuleForm({ ...newRuleForm, cargo_id: e.target.value })}
              >
                <option value="">Agregar cargo al convenio</option>
                {availableCargosForRule.map((cargo: any) => (
                  <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="0.1"
                className="field-input"
                value={newRuleForm.rci}
                onChange={e => setNewRuleForm({ ...newRuleForm, rci: Number(e.target.value) })}
                placeholder="RCI %"
              />
              <input
                type="number"
                min="18"
                className="field-input"
                value={newRuleForm.edad}
                onChange={e => setNewRuleForm({ ...newRuleForm, edad: e.target.value })}
                placeholder="Edad max."
              />
              <button type="submit" className="action-button-primary justify-center">
                <Plus size={16} /> Vincular
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="data-table-header">
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">RCI</th>
                  <th className="px-4 py-3">Edad Max.</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reglasForSelectedConvenio.map((regla: any) => {
                  const cargo = cargosById.get(regla.cargo_id);
                  const isEditing = editingRuleId === regla.id;
                  return (
                    <tr key={regla.id} className="data-table-row">
                      <td className="px-4 py-3 text-xs font-black uppercase text-text-900">{cargo?.nombre || 'Cargo no encontrado'}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input className="field-input w-24" type="number" value={ruleForm.rci} onChange={e => setRuleForm({ ...ruleForm, rci: Number(e.target.value) })} />
                        ) : (
                          <span className="status-pill bg-orange-50 border-orange-100 text-[var(--color-bcp-orange)]">{(regla.rci_especifico * 100).toFixed(1)}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input className="field-input w-24" type="number" value={ruleForm.edad} onChange={e => setRuleForm({ ...ruleForm, edad: e.target.value })} />
                        ) : (
                          <span className="text-xs font-bold text-text-700">{regla.edad_maxima || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isAdmin && (
                            isEditing ? (
                              <>
                                <button onClick={() => setEditingRuleId(null)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" type="button">
                                  <X size={15} />
                                </button>
                                <button onClick={() => handleUpdateRule(regla.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" type="button">
                                  <Check size={15} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRuleId(regla.id);
                                  setRuleForm({
                                    rci: Number((regla.rci_especifico * 100).toFixed(1)),
                                    edad: regla.edad_maxima ? String(regla.edad_maxima) : ''
                                  });
                                }}
                                className="p-2 text-text-500 hover:bg-surface-100 rounded-lg"
                                type="button"
                              >
                                <Edit2 size={15} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reglasForSelectedConvenio.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-xs font-bold uppercase text-text-700">
                      Este convenio todavia no tiene cargos vinculados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
