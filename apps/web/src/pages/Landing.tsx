import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
} from 'lucide-react';

const APK_VERSION = '20260522-upload-sync';
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
    { label: 'Expedientes activos', value: '+2K' },
    { label: 'Operacion continua', value: '24/7' },
    { label: 'Acceso protegido', value: 'TLS' }
  ], []);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950 transition-colors dark:bg-[#070a12] dark:text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#070a12]/92">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="flex min-w-0 items-center gap-3" aria-label="Fuvex Manager BCP">
            <img src="/logo.png" alt="Fuvex BCP" className="h-10 w-auto shrink-0" />
            <span className="hidden text-sm font-black uppercase tracking-[0.2em] text-[#002A8D] dark:text-white sm:inline">
              Fuvex BCP
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[#002A8D] hover:text-[#002A8D] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#ff7800] dark:hover:text-[#ffb071]"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#002A8D] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#001f68] dark:bg-[#ff7800] dark:text-[#111827] dark:hover:bg-[#ff8b24]"
            >
              Iniciar sesion
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-[4.5rem]">
        <section className="relative isolate overflow-hidden border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#080d18]">
          <div className="absolute inset-0 opacity-[0.12] dark:opacity-[0.18]" aria-hidden="true">
            <div className="h-full w-full bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] bg-[size:56px_56px]" />
          </div>
          <div className="absolute inset-x-0 top-0 h-1 bg-[#ff7800]" aria-hidden="true" />

          <div className="relative mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#ff7800]/35 bg-[#ff7800]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-[#9b4600] dark:text-[#ffb071]">
                <ShieldCheck size={16} /> Plataforma en produccion
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.03] text-[#002A8D] dark:text-white sm:text-6xl lg:text-7xl">
                Fuvex Manager BCP
              </h1>
              <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                Gestion comercial para equipos de campo: expedientes, simulaciones, documentos y seguimiento operativo desde web y Android.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#002A8D] px-6 text-sm font-black uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-[#001f68] dark:bg-[#ff7800] dark:text-[#111827] dark:hover:bg-[#ff8b24]"
                >
                  Acceder al panel <ArrowRight size={18} />
                </button>
                <a
                  href={APK_URL}
                  download="Fvx365.apk"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-black uppercase tracking-[0.08em] text-[#002A8D] shadow-sm transition hover:border-[#ff7800] hover:text-[#c45600] dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:border-[#ff7800] dark:hover:text-[#ffb071]"
                >
                  <Download size={18} /> Descargar APK
                </a>
              </div>

              <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
                {metrics.map(item => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-[#f8fafc] p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="text-2xl font-black text-[#ff7800] dark:text-[#ff9b3d]">{item.value}</div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <ProductPreview metrics={metrics} />
            </div>
          </div>
        </section>

        <section className="bg-[#f4f7fb] py-14 dark:bg-[#070a12]">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            <Feature icon={<Smartphone size={22} />} title="App Android final" description="APK publicado en esta landing y conectado de forma fija al servidor de produccion." />
            <Feature icon={<FileCheck2 size={22} />} title="Expediente digital" description="Carga documental, estados, validaciones y trazabilidad en un flujo unico de trabajo." />
            <Feature icon={<BarChart3 size={22} />} title="Seguimiento ejecutivo" description="Indicadores y bandejas para supervisar avance comercial por equipo y convenio." />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-12 dark:border-white/10 dark:bg-[#0c1220]">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff7800]">Android production</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Descarga la app oficial Fvx365</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">La APK final apunta siempre a {API_HOST}/api y no permite modificar la IP del servidor.</p>
            </div>
            <a
              href={APK_URL}
              download="Fvx365.apk"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#ff7800] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#111827] shadow-sm transition hover:bg-[#ff8b24]"
            >
              <Download size={18} /> Descargar APK final
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
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/10 dark:border-white/10 dark:bg-[#111827] dark:shadow-black/40">
      <div className="rounded-lg border border-slate-200 bg-[#f8fafc] dark:border-white/10 dark:bg-[#0b1220]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <Activity size={14} className="text-emerald-500" /> Operacion comercial
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff7800]" />
          </div>
        </div>

        <div className="grid min-h-[430px] grid-cols-[150px_1fr] sm:grid-cols-[190px_1fr]">
          <aside className="border-r border-slate-200 bg-[#eef3fb] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            {['Dashboard', 'Expedientes', 'Simulador', 'Digitalizacion'].map((item, index) => (
              <div key={item} className={`mb-3 rounded-lg px-3 py-2 text-xs font-black ${index === 0 ? 'bg-[#002A8D] text-white dark:bg-[#ff7800] dark:text-[#111827]' : 'text-slate-500 dark:text-slate-400'}`}>
                {item}
              </div>
            ))}
          </aside>

          <div className="p-4 sm:p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {metrics.map(item => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-2xl font-black text-[#002A8D] dark:text-[#ff7800]">{item.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d1524]">
              {[
                ['Maria Quispe', 'Convenio BCP', 'Aprobado'],
                ['Carlos Rojas', 'Convenio BCP', 'Aprobado'],
                ['Ana Torres', 'Convenio BCP', 'Revision'],
                ['Luis Medina', 'Convenio BCP', 'Pendiente'],
              ].map(([name, agreement, status]) => (
                <div key={name} className="grid grid-cols-[1.1fr_0.9fr_0.8fr] gap-3 border-b border-slate-200 px-4 py-3 text-xs last:border-b-0 dark:border-white/10">
                  <span className="font-black text-slate-900 dark:text-white">{name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{agreement}</span>
                  <span className={status === 'Aprobado' ? 'font-black text-emerald-600 dark:text-emerald-400' : 'font-black text-[#ff7800]'}>{status}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniStatus icon={<LockKeyhole size={17} />} title="Servidor" value="bcp.fuvexa365.com" />
              <MiniStatus icon={<CheckCircle2 size={17} />} title="APK" value="Produccion" />
            </div>
          </div>
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
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#ff7800]/60 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[#002A8D]/10 text-[#002A8D] dark:bg-[#ff7800]/15 dark:text-[#ffb071]">
        {icon}
      </div>
      <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  );
}
