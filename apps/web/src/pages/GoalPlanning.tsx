import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { Activity, Calendar, Gauge, Save, Search, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface GoalRow {
  user_id: string;
  nombre: string;
  role: string;
  username: string;
  amount: number;
  goal_id?: string | null;
  prospects_count?: number;
  disbursed_count?: number;
  disbursed_amount?: number;
  pipeline_count?: number;
  pipeline_amount?: number;
  projected_amount?: number;
  gap_amount?: number;
  completion_rate?: number;
  conversion_rate?: number;
}

const months = [
  { v: 1, l: 'Enero' },
  { v: 2, l: 'Febrero' },
  { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' },
  { v: 5, l: 'Mayo' },
  { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' },
  { v: 8, l: 'Agosto' },
  { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' },
  { v: 11, l: 'Noviembre' },
  { v: 12, l: 'Diciembre' }
];

const formatCurrency = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `S/ ${safeValue.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
};

const roleLabel = (role: string) => role.replace(/_/g, ' ');

const GoalPlanning = () => {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<GoalRow[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [saving, setSaving] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');

  const yearOptions = useMemo(() => [currentYear - 1, currentYear, currentYear + 1, currentYear + 2], [currentYear]);

  useEffect(() => {
    fetchGoals();
  }, [month, year]);

  const fetchGoals = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/goals', {
        headers: { Authorization: `Bearer ${token}` },
        params: { month, year }
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
    const amount = Math.max(Number(value) || 0, 0);
    setUsers(prev => prev.map(user => user.user_id === userId ? { ...user, amount } : user));
  };

  const saveGoal = async (user: GoalRow) => {
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
      await fetchGoals(false);
    } catch (error) {
      console.error('Error saving goal:', error);
      toast.error('Error al guardar meta');
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'TODOS' || user.role === roleFilter;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle ||
      user.nombre.toLowerCase().includes(needle) ||
      user.username.toLowerCase().includes(needle);
    return matchesRole && matchesQuery;
  });

  const summary = users.reduce((acc, user) => {
    acc.goal += Number(user.amount) || 0;
    acc.disbursed += Number(user.disbursed_amount) || 0;
    acc.pipeline += Number(user.pipeline_amount) || 0;
    acc.gap += Number(user.gap_amount) || 0;
    acc.prospects += Number(user.prospects_count) || 0;
    acc.disbursedCount += Number(user.disbursed_count) || 0;
    return acc;
  }, { goal: 0, disbursed: 0, pipeline: 0, gap: 0, prospects: 0, disbursedCount: 0 });

  const completionRate = summary.goal > 0 ? (summary.disbursed / summary.goal) * 100 : 0;
  const conversionRate = summary.prospects > 0 ? (summary.disbursedCount / summary.prospects) * 100 : 0;
  const roles = Array.from(new Set(users.map(user => user.role))).sort();

  return (
    <div className="page-shell animate-in fade-in duration-500">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Planificacion de <span className="text-[var(--color-bcp-blue)]">Metas</span>
          </h1>
          <p className="page-subtitle">Asignacion, cumplimiento y brecha comercial por equipo.</p>
        </div>

        <div className="page-actions">
          <div className="bg-surface-100 border border-surface-200 p-2 rounded-xl shadow-sm flex items-center gap-2">
            <Calendar size={16} className="text-text-700" />
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="bg-transparent border-none text-xs font-black text-text-900 focus:ring-0 cursor-pointer outline-none"
            >
              {months.map(item => <option key={item.v} value={item.v}>{item.l}</option>)}
            </select>
            <div className="w-px h-6 bg-surface-200" />
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="bg-transparent border-none text-xs font-black text-text-900 focus:ring-0 cursor-pointer outline-none"
            >
              {yearOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Target size={20} />} label="Meta asignada" value={formatCurrency(summary.goal)} detail={`${users.length} responsables`} tone="blue" />
        <SummaryCard icon={<Wallet size={20} />} label="Desembolsado" value={formatCurrency(summary.disbursed)} detail={`${completionRate.toFixed(1)}% de avance`} tone="emerald" />
        <SummaryCard icon={<Activity size={20} />} label="Pipeline vivo" value={formatCurrency(summary.pipeline)} detail="Monto activo del periodo" tone="orange" />
        <SummaryCard icon={<Gauge size={20} />} label="Conversion" value={`${conversionRate.toFixed(1)}%`} detail={`${summary.disbursedCount}/${summary.prospects} operaciones`} tone="slate" />
      </div>

      <div className="premium-card !p-0 overflow-hidden">
        <div className="p-5 border-b border-surface-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h3 className="chart-title">
              <TrendingUp size={16} className="text-[var(--accent-blue)]" /> Cumplimiento por responsable
            </h3>
            <p className="text-xs font-semibold text-text-700 mt-2">Edita la meta y valida el avance real contra desembolsos del periodo seleccionado.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-700" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar usuario"
                className="field-input !pl-9 sm:w-56"
              />
            </div>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="field-input sm:w-52">
              <option value="TODOS">Todos los roles</option>
              {roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-24">
            <div className="w-8 h-8 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left">
              <thead>
                <tr className="data-table-header">
                  <th className="px-5 py-4">Responsable</th>
                  <th className="px-5 py-4">Rol</th>
                  <th className="px-5 py-4 text-right">Meta</th>
                  <th className="px-5 py-4 text-right">Desembolso</th>
                  <th className="px-5 py-4">Avance</th>
                  <th className="px-5 py-4 text-right">Pipeline</th>
                  <th className="px-5 py-4 text-right">Brecha</th>
                  <th className="px-5 py-4 text-right">Proyeccion</th>
                  <th className="px-5 py-4 text-center">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item) => {
                  const completion = Number(item.completion_rate) || 0;
                  return (
                    <tr key={item.user_id} className="data-table-row">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-soft)] text-[var(--accent-blue)] flex items-center justify-center">
                            <Users size={17} />
                          </div>
                          <div>
                            <div className="font-black text-text-900 uppercase tracking-tight">{item.nombre}</div>
                            <div className="text-[10px] text-text-700 font-bold">@{item.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-3 py-1 bg-surface-50 border border-surface-200 text-text-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          {roleLabel(item.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-700 text-xs font-black">S/</span>
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(event) => handleUpdateAmount(item.user_id, event.target.value)}
                              className="w-36 bg-surface-50 border border-surface-200 rounded-xl py-2.5 pl-9 pr-3 text-right text-sm font-black text-text-900 focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] outline-none"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="text-xs font-black text-[var(--accent-blue)]">{formatCurrency(Number(item.disbursed_amount) || 0)}</div>
                        <div className="text-[10px] font-bold text-text-700">{item.disbursed_count || 0} desembolsos</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 bg-surface-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${completion >= 100 ? 'bg-emerald-500' : 'bg-[var(--color-bcp-orange)]'}`}
                              style={{ width: `${Math.min(completion, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-text-900">{completion.toFixed(1)}%</span>
                        </div>
                        <div className="text-[10px] font-bold text-text-700 mt-1">Conv. {Number(item.conversion_rate || 0).toFixed(1)}%</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="text-xs font-black text-text-900">{formatCurrency(Number(item.pipeline_amount) || 0)}</div>
                        <div className="text-[10px] font-bold text-text-700">{item.pipeline_count || 0} activos</div>
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-black text-rose-600">
                        {formatCurrency(Number(item.gap_amount) || 0)}
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-black text-text-900">
                        {formatCurrency(Number(item.projected_amount) || 0)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          disabled={saving === item.user_id}
                          onClick={() => saveGoal(item)}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] tracking-widest transition-all ${
                            saving === item.user_id ? 'bg-surface-50 text-text-700' : 'bg-[var(--accent-blue)] text-white hover:brightness-95 shadow-sm'
                          }`}
                        >
                          {saving === item.user_id ? (
                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                          GUARDAR
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3 text-text-700">
                        <Target size={42} className="opacity-30" />
                        <p className="font-black uppercase tracking-widest text-[10px]">Sin responsables para este filtro</p>
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
  );
};

const SummaryCard = ({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'emerald' | 'orange' | 'slate';
}) => {
  const tones = {
    blue: 'bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-[var(--accent-orange-soft)] text-[var(--color-bcp-orange)]',
    slate: 'bg-surface-50 text-text-700'
  };

  return (
    <div className="premium-card flex items-center gap-4 min-h-[126px]">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="stat-label">{label}</div>
        <div className="text-2xl font-black text-text-900 truncate">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-text-700 mt-1">{detail}</div>
      </div>
    </div>
  );
};

export default GoalPlanning;
