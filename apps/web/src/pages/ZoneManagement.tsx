import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, MapPin, X, Map, Globe, Search, Check } from 'lucide-react';

export default function ZoneManagement() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    departamento: '',
    distrito: ''
  });

  const fetchZones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/zones', { headers: { Authorization: `Bearer ${token}` } });
      setZones(res.data);
    } catch (error) {
      console.error('Error fetching zones', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const openModal = (zone: any = null) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        nombre: zone.nombre,
        departamento: zone.departamento,
        distrito: zone.distrito || ''
      });
    } else {
      setEditingZone(null);
      setFormData({
        nombre: '',
        departamento: '',
        distrito: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (editingZone) {
        await axios.put(`/api/zones/${editingZone.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/zones', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setIsModalOpen(false);
      fetchZones();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al guardar la zona');
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
        <p className="text-text-700 font-bold uppercase tracking-widest text-[10px]">Cargando Territorios...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Sincronizado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Gestión de <span className="text-[var(--color-bcp-blue)]">Zonas</span>
          </h1>
          <p className="text-text-700 text-sm font-medium">Administración de regiones y territorios operativos</p>
        </div>
        <button onClick={() => openModal()} className="action-button-primary">
          <Plus size={18} /> Nueva Zona
        </button>
      </div>

      {/* Tabla Sincronizada */}
      <div className="premium-card !p-0 overflow-hidden border-surface-200">
        <div className="p-6 border-b border-surface-200 flex justify-between items-center bg-surface-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-700" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nombre de zona o departamento..." 
              className="w-full pl-10 pr-4 py-2 bg-surface-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="data-table-header">
                <th className="px-6 py-4">Territorio / Nombre</th>
                <th className="px-6 py-4">Departamento</th>
                <th className="px-6 py-4">Distrito Base</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {zones.map(z => (
                <tr key={z.id} className="data-table-row group/row">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-2xl bg-[rgba(255,120,0,0.1)] flex items-center justify-center text-[var(--color-bcp-orange)] group-hover/row:scale-110 transition-transform">
                          <Map size={20} />
                       </div>
                       <div>
                          <div className="font-bold text-text-900 uppercase tracking-tight">{z.nombre}</div>
                          <div className="text-[10px] text-text-700 font-bold uppercase">ID Operativo: {z.id.substring(0,8)}</div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-text-700">
                       <Globe size={14} className="text-text-700" />
                       {z.departamento}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-text-700">
                       <MapPin size={14} className="text-text-700" />
                       {z.distrito || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openModal(z)}
                        className="p-2 text-text-700 hover:text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] rounded-xl transition-all" title="Editar Zona">
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                       <MapPin size={48} />
                       <p className="font-bold uppercase tracking-widest text-[10px]">Sin territorios registrados</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Sincronizado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-surface-100 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
            <div className="p-8 border-b border-surface-200 flex justify-between items-center bg-surface-50/50">
              <div>
                <h3 className="text-xl font-bold text-text-900 uppercase tracking-tight">{editingZone ? 'Editar' : 'Nueva'} Zona</h3>
                <p className="text-xs font-bold text-text-700 uppercase tracking-widest mt-1">Configuración Territorial BCP</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-surface-100 text-text-700 hover:text-text-700 rounded-2xl shadow-sm transition-all border border-surface-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="stat-label">Nombre de la Zona</label>
                <input 
                  type="text" required
                  placeholder="Ej. Lima Norte / Región Sur"
                  className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="stat-label">Departamento</label>
                  <input 
                    type="text" required
                    placeholder="Ej. Lima / Arequipa"
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    value={formData.departamento}
                    onChange={e => setFormData({...formData, departamento: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="stat-label">Distrito Base</label>
                  <input 
                    type="text"
                    placeholder="Ej. Miraflores"
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    value={formData.distrito}
                    onChange={e => setFormData({...formData, distrito: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="action-button-secondary flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="action-button-primary flex-1 justify-center"
                >
                  <Check size={18} /> Guardar Zona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
