import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  CheckCircle2,
  LockKeyhole,
  Moon,
  MousePointer2,
  ShieldCheck,
  Smartphone,
  Sun,
  TrendingUp,
  Users,
} from 'lucide-react';

const APK_VERSION = '20260525-kpis-whatsapp';
const APK_URL = `/Fvx365.apk?v=${APK_VERSION}`;
const API_HOST = 'https://bcp.fuvexa365.com';

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

export default function Landing() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeMode();

  const metrics = useMemo(() => [
    { label: 'Pipeline activo', value: '+2K', icon: Users },
    { label: 'Operacion continua', value: '24/7', icon: Activity },
    { label: 'Servidor protegido', value: 'TLS', icon: LockKeyhole }
  ], []);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950 transition-colors dark:bg-[#070a12] dark:text-white">
      <style>
        {`
          @keyframes fuvexPulse {
            0%, 100% { transform: translateY(0); opacity: .72; }
            50% { transform: translateY(-7px); opacity: 1; }
          }
          @keyframes fuvexScan {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(110%); }
          }
        `}
      </style>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#070a12]/92">
        <div className="mx-auto flex min-h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-3" aria-label="Fuvex Manager BCP">
            <img src="/logo.png" alt="Fuvex BCP" className="h-9 w-auto shrink-0 sm:h-10" />
            <span className="hidden text-sm font-black uppercase tracking-[0.22em] text-[#002A8D] dark:text-white sm:inline">
              Fuvex BCP
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[#002A8D] hover:text-[#002A8D] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#ff7800] dark:hover:text-[#ffb071] sm:h-11 sm:w-11"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002A8D] px-3 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#001f68] hover:shadow-lg dark:bg-[#ff7800] dark:text-[#111827] dark:hover:bg-[#ff8b24] sm:h-11 sm:px-4 sm:text-sm"
            >
              Iniciar sesion
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-[4.25rem]">
        <section className="relative isolate overflow-hidden border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#080d18]">
          <div className="absolute inset-0 opacity-[0.16] dark:opacity-[0.20]" aria-hidden="true">
            <div className="h-full w-full bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] bg-[size:44px_44px] sm:bg-[size:58px_58px]" />
          </div>
          <div className="absolute inset-x-0 top-0 h-1 bg-[#ff7800]" aria-hidden="true" />

          <div className="relative mx-auto grid min-h-[calc(100svh-4.25rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#ff7800]/35 bg-[#ff7800]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#9b4600] dark:text-[#ffb071]">
                <ShieldCheck size={15} /> Plataforma en produccion
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.03] text-[#002A8D] dark:text-white sm:text-6xl lg:text-7xl">
                Fuvex Manager BCP
              </h1>
              <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                Gestion comercial para equipos de campo: expedientes, simulaciones, documentos, cotizaciones por WhatsApp y seguimiento ejecutivo desde web y Android.
              </p>

              <div className="mt-7 flex flex-col gap-3 min-[430px]:flex-row">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#002A8D] px-5 text-sm font-black uppercase tracking-[0.08em] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#001f68] hover:shadow-xl dark:bg-[#ff7800] dark:text-[#111827] dark:hover:bg-[#ff8b24]"
                >
                  Acceder al panel <ArrowRight size={18} />
                </button>
                <a
                  href={APK_URL}
                  download="Fvx365.apk"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black uppercase tracking-[0.08em] text-[#002A8D] shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-xl dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:border-emerald-400 dark:hover:text-emerald-300"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/12 text-emerald-600 transition group-hover:scale-110 dark:text-emerald-300">
                    <Bot size={17} />
                  </span>
                  Descargar Android
                </a>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
                {metrics.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`rounded-lg border border-slate-200 bg-[#f8fafc] p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-black text-[#ff7800] dark:text-[#ff9b3d]">{item.value}</div>
                        <Icon size={18} className="text-[#002A8D] dark:text-[#ffb071]" />
                      </div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <ProductPreview metrics={metrics} />
            </div>
          </div>
        </section>

        <section className="bg-[#f4f7fb] py-10 dark:bg-[#070a12] sm:py-14">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            <Feature icon={<Smartphone size={22} />} title="App Android fija" description="La APK final apunta siempre al servidor productivo y no expone configuracion de IP al usuario." />
            <Feature icon={<BellRing size={22} />} title="Push operativo" description="Alertas reales para cambios de estado, notas y eventos criticos del expediente." />
            <Feature icon={<BarChart3 size={22} />} title="Indicadores ejecutivos" description="KPIs por equipo, zona, embudo y avance comercial para perfiles de supervision." />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-10 dark:border-white/10 dark:bg-[#0c1220] sm:py-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff7800]">Android production</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Descarga la app oficial Fvx365</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">APK conectada a {API_HOST}/api con cotizacion WhatsApp y notificaciones push reales.</p>
            </div>
            <a
              href={APK_URL}
              download="Fvx365.apk"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#ff7800] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ff8b24] hover:shadow-xl"
            >
              <Bot size={18} className="transition group-hover:rotate-6 group-hover:scale-110" /> Descargar APK final
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-[#f4f7fb] py-8 dark:bg-[#070a12]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>Fuvex Manager BCP 2026</span>
          <span>{API_HOST}</span>
        </div>
      </footer>
    </div>
  );
}

function ProductPreview({ metrics }: { metrics: Array<{ label: string; value: string }> }) {
  return (
    <div className="group mx-auto max-w-2xl">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/10 transition duration-500 group-hover:-translate-y-2 group-hover:shadow-[#002A8D]/20 dark:border-white/10 dark:bg-[#111827] dark:shadow-black/40">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ff7800] to-transparent" aria-hidden="true" />
        <div className="rounded-lg border border-slate-200 bg-[#f8fafc] dark:border-white/10 dark:bg-[#0b1220]">
          <div className="relative flex items-center justify-between overflow-hidden border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 group-hover:opacity-100 dark:via-white/10" style={{ animation: 'fuvexScan 1.8s ease-in-out infinite' }} aria-hidden="true" />
            <div className="relative flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              <Activity size={14} className="text-emerald-500" /> Operacion comercial
            </div>
            <div className="relative flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff7800]" />
            </div>
          </div>

          <div className="grid min-h-[340px] grid-cols-[112px_1fr] sm:min-h-[430px] sm:grid-cols-[185px_1fr]">
            <aside className="border-r border-slate-200 bg-[#eef3fb] p-3 dark:border-white/10 dark:bg-white/[0.03] sm:p-4">
              {['Dashboard', 'Expedientes', 'Simulador', 'WhatsApp'].map((item, index) => (
                <div key={item} className={`mb-3 rounded-lg px-3 py-2 text-[10px] font-black sm:text-xs ${index === 0 ? 'bg-[#002A8D] text-white dark:bg-[#ff7800] dark:text-[#111827]' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item}
                </div>
              ))}
            </aside>

            <div className="p-3 sm:p-5">
              <div className="mb-3 grid gap-2 sm:mb-4 sm:grid-cols-3 sm:gap-3">
                {metrics.map(item => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:p-4">
                    <div className="text-xl font-black text-[#002A8D] dark:text-[#ff7800] sm:text-2xl">{item.value}</div>
                    <div className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d1524]">
                {[
                  ['Maria Quispe', 'Cotizacion enviada', 'WhatsApp'],
                  ['Carlos Rojas', 'File validado', 'OK'],
                  ['Ana Torres', 'Remesa aprobada', 'BCP'],
                  ['Luis Medina', 'Pendiente boleta', 'App'],
                ].map(([name, status, channel]) => (
                  <div key={name} className="grid grid-cols-[1fr_1fr_0.5fr] gap-2 border-b border-slate-200 px-3 py-3 text-[10px] last:border-b-0 dark:border-white/10 sm:px-4 sm:text-xs">
                    <span className="font-black text-slate-900 dark:text-white">{name}</span>
                    <span className="truncate text-slate-500 dark:text-slate-400">{status}</span>
                    <span className="font-black text-[#ff7800]">{channel}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                <MiniStatus icon={<MousePointer2 size={17} />} title="Cotizacion" value="Lista para enviar" />
                <MiniStatus icon={<TrendingUp size={17} />} title="KPIs" value="Equipo y zonas" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 hidden rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl transition duration-500 group-hover:-translate-y-2 dark:border-white/10 dark:bg-[#0d1524]/95 sm:block" style={{ animation: 'fuvexPulse 2.8s ease-in-out infinite' }}>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">
            <Bot size={16} className="text-emerald-500" />
            Android activo
          </div>
          <div className="mt-1 text-sm font-black text-slate-950 dark:text-white">Push + WhatsApp</div>
        </div>
      </div>
    </div>
  );
}

function MiniStatus({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#002A8D]/10 text-[#002A8D] dark:bg-[#ff7800]/15 dark:text-[#ffb071]">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{title}</div>
        <div className="truncate text-sm font-black text-slate-950 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#ff7800]/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[#002A8D]/10 text-[#002A8D] dark:bg-[#ff7800]/15 dark:text-[#ffb071]">
        {icon}
      </div>
      <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      <div className="mt-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#ff7800]">
        <CheckCircle2 size={14} />
        Produccion
      </div>
    </article>
  );
}
