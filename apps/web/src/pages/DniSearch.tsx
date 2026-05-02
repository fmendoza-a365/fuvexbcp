import React, { useState } from 'react';
import { Search, User, MapPin, Calendar, CreditCard, Shield, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function DniSearch() {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dni.length !== 8) {
      setError('El DNI debe tener 8 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/dni/${dni}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo encontrar el DNI. Verifique el número e intente de nuevo.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Buscador <span className="text-[var(--color-bcp-blue)]">RENIEC</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Consulta integral de identidad nacional</p>
        </div>
      </div>

      {/* Search Form - Glassmorphism Style */}
      <div className="premium-card relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
          <Shield size={160} />
        </div>
        
        <form onSubmit={handleSearch} className="relative z-10">
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 w-full">
              <label htmlFor="dni_input" className="text-[10px] font-bold text-text-700 uppercase tracking-widest mb-1.5 block px-1">Número de DNI</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-text-700">
                  <CreditCard size={18} />
                </div>
                <input
                  id="dni_input"
                  type="text"
                  maxLength={8}
                  placeholder="Ej. 73024896"
                  className="w-full pl-12 pr-4 py-3 bg-surface-50 border-none rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading || dni.length !== 8}
              className="action-button-primary w-full md:w-auto justify-center py-3.5 px-8 text-xs font-black tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Search size={20} />
              )}
              CONSULTAR
            </button>
          </div>
        </form>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg flex items-center gap-2 border border-red-200 dark:border-red-800/30">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>

      {/* Result Card */}
      {result && (
        <div className="premium-card animate-in slide-in-from-bottom-6 duration-700 fade-in group">
          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 pb-8 border-b border-surface-200">
            <div className="h-20 w-20 bg-surface-100 rounded-3xl flex items-center justify-center text-[var(--color-bcp-blue)] shadow-inner">
              <User size={36} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-tight">{result.nombre_completo}</h2>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-text-700 uppercase tracking-widest bg-surface-100 px-3 py-1 rounded-full"><CreditCard size={14} className="text-[var(--color-bcp-blue)]"/> {result.dni}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-text-700 uppercase tracking-widest bg-surface-100 px-3 py-1 rounded-full"><Shield size={14} className="text-emerald-600"/> {result.estado_civil}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-text-500 uppercase tracking-[0.2em] mb-2 block">Datos de Nacimiento</span>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-surface-50 rounded-2xl text-[var(--color-bcp-orange)]"><Calendar size={18}/></div>
                  <div>
                    <div className="text-lg font-bold text-slate-800">{result.fecha_nacimiento}</div>
                    <div className="text-[10px] font-black text-[var(--color-bcp-orange)] uppercase tracking-widest">{result.edad} años cumplidos</div>
                  </div>
                </div>
              </div>
              
              <div>
                <span className="text-[10px] font-black text-text-500 uppercase tracking-[0.2em] mb-2 block">Residencia Actual</span>
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-surface-50 rounded-2xl text-[var(--color-bcp-blue)] mt-1"><MapPin size={18}/></div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 leading-snug">{result.direccion}</div>
                    <div className="text-[10px] font-black text-text-700 uppercase tracking-widest mt-1 opacity-70">{result.ubigeo}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-text-500 uppercase tracking-[0.2em] mb-2 block">Información Familiar</span>
                <div className="bg-surface-50 p-5 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center border-b border-white/50 pb-2">
                    <span className="text-[10px] font-bold text-text-700 uppercase">Madre</span>
                    <span className="text-xs font-black text-slate-800 uppercase">{result.madre}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-bold text-text-700 uppercase">Padre</span>
                    <span className="text-xs font-black text-slate-800 uppercase">{result.padre}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[rgba(0,42,141,0.03)] p-5 rounded-3xl border border-blue-50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-[var(--color-bcp-blue)]" />
                    <span className="text-[10px] font-black text-text-700 uppercase tracking-widest">Estado del Documento</span>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${new Date(result.fecha_caducidad) < new Date() ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {new Date(result.fecha_caducidad) < new Date() ? 'CADUCADO' : 'VIGENTE'}
                  </span>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-[9px] font-bold text-text-500 uppercase">Vence: {result.fecha_caducidad}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 p-8 opacity-[0.02] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700">
             <User size={160} />
          </div>
        </div>
      )}
    </div>
  );
}
