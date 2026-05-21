import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Download,
  FileCheck2,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
} from 'lucide-react';

const APK_URL = '/Fvx365.apk';
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
    { label: 'Operacion disponible', value: '24/7' },
    { label: 'Acceso protegido', value: 'TLS' }
  ], []);

  const downloadApp = () => {
    window.location.href = APK_URL;
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950 transition-colors dark:bg-[#080b12] dark:text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#080b12]/88">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-3" aria-label="Fuvex Manager BCP">
            <img src="/logo.png" alt="Fuvex BCP" className="h-9 w-auto" />
            <span className="hidden text-sm font-black uppercase tracking-[0.22em] text-[#002A8D] dark:text-white sm:inline">
              Fuvex BCP
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-[#002A8D] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002A8D] px-4 text-sm font-black text-white transition hover:bg-[#001f68] dark:bg-[#ff7800] dark:text-[#101010]"
            >
              Iniciar sesion
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[92vh] overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f6f8fb_100%)] pt-24 dark:border-white/10 dark:bg-[linear-gradient(180deg,#080b12_0%,#101522_100%)]">
          <div className="absolute inset-0 opacity-[0.08] dark:opacity-[0.16]" aria-hidden="true">
            <div className="h-full w-full bg-[linear-gradient(to_right,#64748b_1px,transparent_1px),linear-gradient(to_bottom,#64748b_1px,transparent_1px)] bg-[size:48px_48px]" />
          </div>

          <div className="absolute bottom-8 right-[-160px] top-24 hidden w-[760px] rotate-[-3deg] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/10 dark:border-white/10 dark:bg-[#111827] dark:shadow-black/60 lg:block" aria-hidden="true">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 px-5 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <Activity size={14} className="text-emerald-500" /> Operacion comercial
              </div>
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff7800]" />
              </div>
            </div>
            <div className="grid h-[calc(100%-3rem)] grid-cols-[200px_1fr]">
              <div className="border-r border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                {['Dashboard', 'Expedientes', 'Simulador', 'Digitalizacion'].map((item, index) => (
                  <div key={item} className={`mb-3 rounded-lg px-3 py-2 text-xs font-black ${index === 0 ? 'bg-[#002A8D] text-white dark:bg-[#ff7800] dark:text-[#101010]' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="p-5">
                <div className="mb-5 grid grid-cols-3 gap-3">
                  {metrics.map(item => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="text-2xl font-black text-[#002A8D] dark:text-[#ff7800]">{item.value}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/10">
                  {['Maria Quispe', 'Carlos Rojas', 'Ana Torres', 'Luis Medina'].map((name, index) => (
                    <div key={name} className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-3 border-b border-slate-200 px-4 py-3 text-xs last:border-b-0 dark:border-white/10">
                      <span className="font-black text-slate-800 dark:text-white">{name}</span>
                      <span className="text-slate-500 dark:text-slate-400">Convenio BCP</span>
                      <span className={index < 2 ? 'font-black text-emerald-600' : 'font-black text-amber-500'}>{index < 2 ? 'Aprobado' : 'Revision'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto flex min-h-[calc(92vh-6rem)] max-w-7xl items-center px-4 pb-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl py-14">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#ff7800]/25 bg-[#ff7800]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#a64a00] dark:text-[#ffb071]">
                <ShieldCheck size={16} /> Plataforma en produccion
              </div>
              <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-[#002A8D] dark:text-white sm:text-6xl lg:text-7xl">
                Fuvex Manager BCP
              </h1>
              <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                Gestion comercial para equipos de campo: expedientes, simulaciones, documentos y seguimiento operativo desde web y Android.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#002A8D] px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#001f68] dark:bg-[#ff7800] dark:text-[#101010]"
                >
                  Acceder al panel <ArrowRight size={18} />
                </button>
                <button
                  onClick={downloadApp}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-black uppercase tracking-[0.08em] text-[#002A8D] transition hover:border-[#ff7800] hover:text-[#c45b00] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <Download size={18} /> Descargar Android
                </button>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                {metrics.map(item => (
                  <div key={item.label} className="border-l border-slate-300 pl-4 dark:border-white/15">
                    <div className="text-2xl font-black text-slate-950 dark:text-white">{item.value}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 dark:bg-[#0b101b]">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            <Feature icon={<Smartphone size={22} />} title="App Android lista" description="APK publicado desde esta landing y conectado al servidor de produccion." />
            <Feature icon={<FileCheck2 size={22} />} title="Expediente digital" description="Carga documental, estados y validaciones en un flujo unico de trabajo." />
            <Feature icon={<BarChart3 size={22} />} title="Seguimiento ejecutivo" description="Indicadores y bandejas para supervisar avance comercial por equipo." />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-12 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7800]">Android production</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Descarga la app oficial Fvx365</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Servidor configurado: {API_HOST}</p>
            </div>
            <button
              onClick={downloadApp}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#ff7800] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#15110d] transition hover:bg-[#e66c00]"
            >
              <Download size={18} /> Descargar APK
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-white py-8 dark:bg-[#080b12]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>Fuvex Manager BCP 2026</span>
          <span>{API_HOST}</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#ff7800]/50 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[#002A8D]/10 text-[#002A8D] dark:bg-[#ff7800]/15 dark:text-[#ffb071]">
        {icon}
      </div>
      <h3 className="text-base font-black text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  );
}
