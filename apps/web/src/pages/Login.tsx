import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react';

type ThemeMode = 'light' | 'dark';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  return {
    isDark: theme === 'dark',
    toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark')
  };
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isDark, toggleTheme } = useThemeMode();
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { username: username.trim(), password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/app');
    } catch {
      setError('Credenciales invalidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950 transition-colors dark:bg-[#080b12] dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b101b] lg:block">
          <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.16]" aria-hidden="true">
            <div className="h-full w-full bg-[linear-gradient(to_right,#64748b_1px,transparent_1px),linear-gradient(to_bottom,#64748b_1px,transparent_1px)] bg-[size:44px_44px]" />
          </div>
          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
            <button onClick={() => navigate('/')} className="flex w-fit items-center gap-3" aria-label="Volver a inicio">
              <img src="/logo.png" alt="Fuvex BCP" className="h-11 w-auto" />
              <span className="text-sm font-black uppercase tracking-[0.24em] text-[#002A8D] dark:text-white">Fuvex BCP</span>
            </button>

            <div className="max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                <ShieldCheck size={16} /> Acceso seguro
              </div>
              <h1 className="text-5xl font-black leading-[1.02] tracking-tight text-[#002A8D] dark:text-white xl:text-6xl">
                Operacion comercial centralizada
              </h1>
              <p className="mt-6 max-w-md text-base font-semibold leading-8 text-slate-600 dark:text-slate-300">
                Panel web para gestionar expedientes, validar informacion y seguir el avance del equipo en tiempo real.
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-3 gap-3">
              <Kpi label="Sesion" value="TLS" />
              <Kpi label="Servidor" value="BCP" />
              <Kpi label="Estado" value="Online" />
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-20 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between">
              <button onClick={() => navigate('/')} className="flex items-center gap-3 lg:hidden" aria-label="Volver a inicio">
                <img src="/logo.png" alt="Fuvex BCP" className="h-10 w-auto" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#002A8D] dark:text-white">Fuvex</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-[#002A8D] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                aria-label="Cambiar tema"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-[#111827] dark:shadow-black/30 sm:p-8">
              <div className="mb-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff7800]">Fuvex Manager BCP</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Iniciar sesion</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  Ingresa tus credenciales asignadas para continuar.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Usuario</span>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 transition focus-within:border-[#002A8D] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#002A8D]/10 dark:border-white/10 dark:bg-white/[0.04] dark:focus-within:border-[#ff7800] dark:focus-within:ring-[#ff7800]/10">
                    <UserRound size={18} className="text-slate-400" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
                      placeholder="usuario"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Contrasena</span>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 transition focus-within:border-[#002A8D] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#002A8D]/10 dark:border-white/10 dark:bg-white/[0.04] dark:focus-within:border-[#ff7800] dark:focus-within:ring-[#ff7800]/10">
                    <LockKeyhole size={18} className="text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      className="h-12 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
                      placeholder="********"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(current => !current)}
                      className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#002A8D] text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#001f68] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#ff7800] dark:text-[#101010] dark:hover:bg-[#e66c00]"
                >
                  {loading ? 'Validando...' : 'Entrar'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>

              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <ShieldCheck size={16} className="text-emerald-500" /> Servidor protegido
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">https://bcp.fuvexa365.com</p>
              </div>
            </div>

            <p className="mt-6 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
              Fuvex Manager BCP 2026
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-2xl font-black text-[#002A8D] dark:text-[#ff7800]">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
