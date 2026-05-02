import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Target, Users, Calendar, ArrowUpRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const GoalPlanning = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchGoals();
  }, [month, year]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/goals?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast.error('Error al cargar metas');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAmount = (userId: string, value: string) => {
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, amount: parseFloat(value) || 0 } : u));
  };

  const saveGoal = async (user: any) => {
    setSaving(user.user_id);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/goals', {
        user_id: user.user_id,
        amount: user.amount,
        month,
        year
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Meta actualizada para ${user.nombre}`);
    } catch (error) {
      console.error('Error saving goal:', error);
      toast.error('Error al guardar meta');
    } finally {
      setSaving(null);
    }
  };

  const totalGoal = users.reduce((acc, u) => acc + u.amount, 0);

  const months = [
    { v: "1", l: "Enero" }, { v: "2", l: "Febrero" }, { v: "3", l: "Marzo" },
    { v: "4", l: "Abril" }, { v: "5", l: "Mayo" }, { v: "6", l: "Junio" },
    { v: "7", l: "Julio" }, { v: "8", l: "Agosto" }, { v: "9", l: "Septiembre" },
    { v: "10", l: "Octubre" }, { v: "11", l: "Noviembre" }, { v: "12", l: "Diciembre" }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Sincronizado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Planificación de <span className="text-[var(--color-bcp-blue)]">Metas</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Asignación de cuotas de MAF por equipo y zona</p>
        </div>
        
        <div className="flex gap-2 bg-surface-100 p-2 rounded-2xl border border-surface-200 shadow-sm">
          <div className="flex items-center gap-2 px-3 text-text-700">
            <Calendar size={16} />
          </div>
          <select 
            value={month} 
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer outline-none"
          >
            {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <div className="w-px bg-slate-100 my-1"></div>
          <select 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer outline-none px-2"
          >
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="premium-card relative overflow-hidden group">
            <span className="stat-label">Total Metas Asignadas</span>
            <div className="stat-value text-[var(--color-bcp-blue)] mb-8">S/ {totalGoal.toLocaleString()}</div>
            
            <div className="bg-[rgba(0,42,141,0.1)]/50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
              <div className="bg-surface-100 p-3 rounded-2xl text-[var(--color-bcp-blue)] shadow-sm">
                <Target size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-tight">Suma Consolidada</p>
                <p className="text-[10px] font-medium text-text-700 leading-relaxed">
                  Agregación automática de cuotas individuales para el periodo {month}/{year}.
                </p>
              </div>
            </div>
            <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
               <ArrowUpRight size={160} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 premium-card !p-0 overflow-hidden">
          {loading ? (
            <div className="flex justify-center p-24">
               <div className="w-8 h-8 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="data-table-header">
                    <th className="px-6 py-4">Usuario / Equipo</th>
                    <th className="px-6 py-4">Rol Operativo</th>
                    <th className="px-6 py-4 text-center">Cuota Mensual (S/)</th>
                    <th className="px-6 py-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700">
                  {users.map((item) => (
                    <tr key={item.user_id} className="data-table-row group/row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-text-700 group-hover/row:bg-[rgba(0,42,141,0.1)] group-hover/row:text-[var(--color-bcp-blue)] transition-all">
                            <Users size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-text-900 uppercase tracking-tight">{item.nombre}</div>
                            <div className="text-[10px] text-text-700 font-bold">{item.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-text-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                          {item.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <div className="relative group/input">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-700 text-xs font-bold">S/</span>
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => handleUpdateAmount(item.user_id, e.target.value)}
                              className="w-40 bg-surface-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-center text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] outline-none transition-all"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          disabled={saving === item.user_id}
                          onClick={() => saveGoal(item)}
                          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-[10px] tracking-widest transition-all ${
                            saving === item.user_id ? 'bg-slate-100 text-text-700' : 'bg-[var(--color-bcp-blue)] text-white hover:bg-blue-800 shadow-lg shadow-blue-100'
                          }`}
                        >
                          {saving === item.user_id ? (
                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                          ) : (
                            <Save size={14} />
                          )}
                          GUARDAR
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-24">
                         <div className="flex flex-col items-center gap-3 opacity-20">
                           <Target size={48} />
                           <p className="font-bold uppercase tracking-widest text-[10px]">Sin subordinados asignados</p>
                         </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalPlanning;
