import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Edit2, Check, X, Shield, MapPin, UserCheck, UserMinus, Search, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loggedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isJefeZonal = loggedUser.role === 'JEFE_ZONAL';

  const [formData, setFormData] = useState({
    username: '',
    nombre: '',
    password: '',
    role: 'VENDEDOR',
    zone_id: '',
    supervisor_id: '',
    activo: true
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [usersRes, zonesRes] = await Promise.all([
        axios.get('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/zones', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUsers(usersRes.data);
      setZones(zonesRes.data);
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        nombre: user.nombre,
        password: '',
        role: user.role,
        zone_id: user.zone_id || '',
        supervisor_id: user.supervisor_id || '',
        activo: user.activo
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        nombre: '',
        password: '',
        role: 'VENDEDOR',
        zone_id: isJefeZonal ? loggedUser.zone_id : '',
        supervisor_id: '',
        activo: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      const payload: any = { ...formData };
      if (!payload.password) delete payload.password;
      if (!payload.zone_id) payload.zone_id = null;
      if (!payload.supervisor_id) payload.supervisor_id = null;

      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/users', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al guardar el usuario');
    }
  };

  // ---- BULK UPLOAD HANDLERS ----
  const downloadTemplate = () => {
    const header = 'username,nombre,password,role,zone_name,supervisor_username';
    const example = 'jdoe,Juan Doe,Password123,VENDEDOR,,';
    const csv = header + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_usuarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      // Map zone_name to zone_id
      if (obj.zone_name) {
        const zone = zones.find(z => z.nombre.toLowerCase() === obj.zone_name.toLowerCase());
        obj.zone_id = zone ? zone.id : '';
        delete obj.zone_name;
      } else {
        delete obj.zone_name;
      }
      // Map supervisor_username to supervisor_id
      if (obj.supervisor_username) {
        const sup = users.find(u => u.username.toLowerCase() === obj.supervisor_username.toLowerCase());
        obj.supervisor_id = sup ? sup.id : '';
        delete obj.supervisor_username;
      } else {
        delete obj.supervisor_username;
      }
      return obj;
    });
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkError('');
    setBulkResults(null);
    setBulkLoading(true);

    try {
      const text = await file.text();
      const parsedUsers = parseCSV(text);
      if (parsedUsers.length === 0) {
        setBulkError('El archivo CSV está vacío o no tiene el formato correcto.');
        setBulkLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const res = await axios.post('/api/users/bulk', { users: parsedUsers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBulkResults(res.data);
      fetchData();
    } catch (err: any) {
      setBulkError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const roles = isJefeZonal 
    ? ['VENDEDOR', 'SUPERVISOR'] 
    : ['VENDEDOR', 'SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN', 'BACK_OFFICE', 'ANALISTA'];

  const potentialSupervisors = users.filter(u => 
    ['SUPERVISOR', 'JEFE_ZONAL', 'GERENTE'].includes(u.role) &&
    (!formData.zone_id || u.zone_id === formData.zone_id || u.role === 'GERENTE') &&
    u.id !== editingUser?.id
  );

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
        <p className="text-text-700 font-bold uppercase tracking-widest text-[10px]">Cargando Usuarios...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Sincronizado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Gestión de <span className="text-[var(--color-bcp-blue)]">Usuarios</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Control de accesos y jerarquías operativas</p>
        </div>
        <div className="flex gap-3">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
          <button onClick={() => { setBulkResults(null); setBulkError(''); setIsBulkModalOpen(true); }} className="action-button-secondary">
            <Upload size={18} /> Carga Masiva
          </button>
          <button onClick={() => openModal()} className="action-button-primary">
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Tabla Sincronizada */}
      <div className="premium-card !p-0 overflow-hidden border-surface-200">
        <div className="p-6 border-b border-surface-200 flex justify-between items-center bg-surface-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-700" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o usuario..." 
              className="w-full pl-10 pr-4 py-2 bg-surface-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="data-table-header">
                <th className="px-6 py-4">Usuario / Nombre</th>
                <th className="px-6 py-4">Rol Institucional</th>
                <th className="px-6 py-4">Zona / Territorio</th>
                <th className="px-6 py-4">Superior Directo</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {users.map(u => (
                <tr key={u.id} className="data-table-row group/row">
                  <td className="px-6 py-4">
                    <div className="font-bold text-text-900">{u.nombre}</div>
                    <div className="text-[10px] text-text-700 font-bold uppercase tracking-tight">{u.username}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <Shield size={14} className="text-blue-600" />
                       <span className="px-3 py-1 bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] rounded-full text-[10px] font-black uppercase tracking-wider">
                         {u.role}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-text-700 font-medium text-xs">
                       <MapPin size={14} className="text-text-700" />
                       {u.zone?.nombre || 'Sin Zona'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-text-700">
                      {u.supervisor ? (
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px]">👤</div>
                           {u.supervisor.nombre}
                        </div>
                      ) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {u.activo ? 
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100"><UserCheck size={12}/> Activo</span> : 
                      <span className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-rose-100"><UserMinus size={12}/> Inactivo</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openModal(u)}
                        className="p-2 text-text-700 hover:text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] rounded-xl transition-all" title="Editar">
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Carga Masiva */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-surface-100 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20">
            <div className="p-8 border-b border-surface-200 flex justify-between items-center bg-surface-50/50">
              <div>
                <h3 className="text-xl font-bold text-text-900 uppercase tracking-tight">Carga Masiva de Usuarios</h3>
                <p className="text-xs font-bold text-text-700 uppercase tracking-widest mt-1">Subir archivo CSV con datos de usuarios</p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-surface-100 text-text-700 hover:text-text-700 rounded-2xl shadow-sm transition-all border border-surface-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {/* Template download */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
                <FileSpreadsheet size={24} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900">Formato requerido</p>
                  <p className="text-xs text-blue-700 mt-1">
                    El CSV debe tener las columnas: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px] font-mono">username, nombre, password, role, zone_name, supervisor_username</code>
                  </p>
                  <button onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                    <Download size={14} /> Descargar plantilla CSV
                  </button>
                </div>
              </div>

              {/* Upload area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-surface-300 hover:border-[var(--color-bcp-blue)] rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-[rgba(0,42,141,0.02)]"
              >
                {bulkLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
                    <p className="text-sm font-bold text-text-700">Procesando archivo...</p>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-text-700 mb-3" />
                    <p className="text-sm font-bold text-text-900">Haz clic aquí para seleccionar tu archivo CSV</p>
                    <p className="text-xs text-text-700 mt-1">Máximo 500 usuarios por carga</p>
                  </>
                )}
              </div>

              {/* Error */}
              {bulkError && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-800 font-medium">{bulkError}</p>
                </div>
              )}

              {/* Results */}
              {bulkResults && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle size={18} className="text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-800">
                      {bulkResults.created} usuario(s) creado(s) exitosamente
                    </p>
                  </div>
                  {bulkResults.errors?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <p className="text-sm font-bold text-amber-800 mb-2">
                        ⚠️ {bulkResults.errors.length} error(es) encontrado(s):
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {bulkResults.errors.map((err: any, i: number) => (
                          <div key={i} className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                            <span className="font-bold">Fila {err.row} ({err.username}):</span> {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Close button */}
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="action-button-primary w-full justify-center"
              >
                <Check size={18} /> Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Sincronizado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-surface-100 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
            <div className="p-8 border-b border-surface-200 flex justify-between items-center bg-surface-50/50">
              <div>
                <h3 className="text-xl font-bold text-text-900 uppercase tracking-tight">{editingUser ? 'Editar' : 'Nuevo'} Usuario</h3>
                <p className="text-xs font-bold text-text-700 uppercase tracking-widest mt-1">Configuración de Perfil Institucional</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-surface-100 text-text-700 hover:text-text-700 rounded-2xl shadow-sm transition-all border border-surface-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="stat-label">Usuario (Login)</label>
                  <input 
                    type="text" required
                    placeholder="ej. jdoe"
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none disabled:opacity-50"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    disabled={!!editingUser}
                  />
                </div>
                <div className="space-y-2">
                  <label className="stat-label">Nombre Completo</label>
                  <input 
                    type="text" required
                    placeholder="Nombre y Apellido"
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    value={formData.nombre}
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="stat-label">Contraseña {editingUser && '(Opcional)'}</label>
                <input 
                  type="password" required={!editingUser}
                  placeholder="••••••••"
                  className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="stat-label">Rol Operativo</label>
                  <select 
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="stat-label">Zona Asignada</label>
                  <select 
                    className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none disabled:opacity-50"
                    value={formData.zone_id}
                    onChange={e => setFormData({...formData, zone_id: e.target.value})}
                    disabled={isJefeZonal}
                  >
                    <option value="">-- Sin zona --</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="stat-label">Reporta a</label>
                <select 
                  className="w-full bg-surface-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                  value={formData.supervisor_id}
                  onChange={e => setFormData({...formData, supervisor_id: e.target.value})}
                >
                  <option value="">-- Sin supervisor --</option>
                  {potentialSupervisors.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 bg-surface-50 p-4 rounded-2xl border border-surface-200">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.activo}
                    onChange={e => setFormData({...formData, activo: e.target.checked})}
                    className="sr-only peer"
                    id="activo-toggle"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-100 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-bcp-blue)]"></div>
                </div>
                <label htmlFor="activo-toggle" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Usuario Activo</label>
              </div>

              <div className="flex gap-4">
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
                  <Check size={18} /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
