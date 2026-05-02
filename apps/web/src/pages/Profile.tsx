import { useState, useEffect } from 'react';
import { User, Mail, Lock, Camera, Save, AlertCircle, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    avatar_url: '',
    password: '',
    confirmPassword: ''
  });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar perfil');
      const data = await response.json();
      setFormData({
        ...formData,
        nombre: data.nombre || '',
        email: data.email || '',
        telefono: data.telefono || '',
        avatar_url: data.avatar_url || ''
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          email: formData.email,
          telefono: formData.telefono,
          avatar_url: formData.avatar_url,
          password: formData.password || undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar perfil');
      }

      const updatedUser = await response.json();
      const userData = { ...currentUser, ...updatedUser };
      localStorage.setItem('user', JSON.stringify(userData));
      
      setSuccess('Perfil actualizado correctamente');
      setFormData({ ...formData, password: '', confirmPassword: '' });
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
        <p className="text-text-700 font-bold uppercase tracking-widest text-[10px]">Cargando Perfil...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Sincronizado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Mi <span className="text-[var(--color-bcp-blue)]">Perfil</span>
          </h1>
          <p className="text-text-700 text-sm font-medium">Gestión de identidad corporativa y seguridad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Izquierdo: Resumen */}
        <div className="lg:col-span-4">
          <div className="premium-card flex flex-col items-center">
            <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden bg-surface-50 border-4 border-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={64} className="text-slate-200" />
                )}
              </div>
              <button className="absolute -bottom-2 -right-2 bg-[var(--color-bcp-blue)] text-white p-3 rounded-2xl shadow-xl hover:bg-blue-800 transition-all hover:rotate-12 border-4 border-white">
                <Camera size={20} />
              </button>
            </div>
            
            <h2 className="mt-8 text-2xl font-bold text-text-900 text-center uppercase tracking-tight">{formData.nombre || currentUser.username}</h2>
            <div className="mt-3 px-4 py-1.5 bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] text-[10px] font-black rounded-full uppercase tracking-[0.2em] border border-blue-100">
              {currentUser.role}
            </div>
            
            <div className="mt-8 w-full space-y-4 pt-8 border-t border-surface-200">
              <div className="flex items-center gap-4 p-4 bg-surface-50/50 rounded-2xl border border-transparent hover:border-surface-200 transition-all group/info">
                <div className="p-2.5 bg-surface-100 rounded-xl shadow-sm group-hover/info:text-[var(--color-bcp-blue)] transition-colors">
                  <Mail size={16} />
                </div>
                <div>
                   <span className="stat-label mb-0 text-[8px]">Correo Corporativo</span>
                   <div className="text-xs font-bold text-slate-700 truncate">{formData.email || 'No asignado'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-surface-50/50 rounded-2xl border border-transparent hover:border-surface-200 transition-all group/info">
                <div className="p-2.5 bg-surface-100 rounded-xl shadow-sm group-hover/info:text-[var(--color-bcp-blue)] transition-colors">
                  <Smartphone size={16} />
                </div>
                <div>
                   <span className="stat-label mb-0 text-[8px]">Contacto Directo</span>
                   <div className="text-xs font-bold text-slate-700">{formData.telefono || 'No asignado'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formularios */}
        <div className="lg:col-span-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
              <AlertCircle size={24} />
              <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-6 py-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
              <CheckCircle2 size={24} />
              <p className="text-sm font-bold uppercase tracking-tight">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="premium-card space-y-10 !p-10">
            {/* Sección Personal */}
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-surface-200 pb-6">
                <div className="p-3 bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] rounded-2xl">
                   <ShieldCheck size={24} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-text-900 uppercase tracking-tight">Información de Identidad</h3>
                   <p className="text-[10px] font-bold text-text-700 uppercase tracking-widest">Datos verificados en el sistema Fuvex</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="stat-label">Nombre y Apellidos</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="stat-label">Email Institucional</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    placeholder="usuario@bcp.com.pe"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="stat-label">Teléfono de Contacto</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    placeholder="Ej. 999 888 777"
                  />
                </div>

                <div className="space-y-2">
                  <label className="stat-label">URL Avatar (HTTPS)</label>
                  <input
                    type="text"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Sección Seguridad */}
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-surface-200 pb-6 pt-4">
                <div className="p-3 bg-surface-50 text-text-700 rounded-2xl">
                   <Lock size={24} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-text-900 uppercase tracking-tight">Seguridad y Acceso</h3>
                   <p className="text-[10px] font-bold text-text-700 uppercase tracking-widest">Protección de credenciales de red</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="stat-label">Nueva Contraseña</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <p className="text-[9px] font-black text-text-700 uppercase tracking-widest mt-2 ml-2 italic">Solo si desea cambiarla</p>
                </div>
                
                <div className="space-y-2">
                  <label className="stat-label">Reconfirmar Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="action-button-primary min-w-[240px] justify-center"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Confirmar Cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
