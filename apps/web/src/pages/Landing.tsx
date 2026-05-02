import { useNavigate } from 'react-router-dom';
import { 
  ArrowRightIcon as ArrowRightIconOrig, 
  DevicePhoneMobileIcon as DevicePhoneMobileIconOrig, 
  UserGroupIcon as UserGroupIconOrig,
  ShieldCheckIcon as ShieldCheckIconOrig,
  ArrowDownTrayIcon as ArrowDownTrayIconOrig
} from '@heroicons/react/24/outline';

const ArrowRightIcon = ArrowRightIconOrig as any;
const DevicePhoneMobileIcon = DevicePhoneMobileIconOrig as any;
const UserGroupIcon = UserGroupIconOrig as any;
const ShieldCheckIcon = ShieldCheckIconOrig as any;
const ArrowDownTrayIcon = ArrowDownTrayIconOrig as any;

export default function Landing() {
  const navigate = useNavigate();

  const handleDownload = () => {
    // Enlace directo al archivo público
    window.location.href = '/Fvx365.apk';
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-[#FF7800]/20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Fuvex BCP" className="h-10 w-auto" />
              <span className="hidden sm:block font-bold text-xl tracking-tight text-[#002A8D]">
                Fuvex <span className="text-[#FF7800]">Manager</span>
              </span>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="bg-[#002A8D] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#00206b] transition-all duration-300 shadow-lg shadow-blue-900/10 active:scale-95"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            {/* Content Left */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-[#FF7800]/10 text-[#FF7800] px-4 py-1.5 rounded-full text-sm font-bold mb-6 animate-fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7800] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF7800]"></span>
                </span>
                SISTEMA OFICIAL BCP
              </div>
              <h1 className="text-5xl sm:text-6xl font-black text-[#002A8D] leading-[1.1] mb-6">
                Gestión de <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#002A8D] to-[#0051ff]">
                  Ventas y Expedientes
                </span>
              </h1>
              <p className="text-lg text-slate-600 mb-10 max-w-lg leading-relaxed">
                Centraliza tus operaciones, realiza consultas de RCC en tiempo real y gestiona tus metas comerciales desde un solo lugar.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/login')}
                  className="flex items-center justify-center gap-2 bg-[#002A8D] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#00206b] transition-all transform hover:-translate-y-1 shadow-xl shadow-blue-900/20 active:translate-y-0"
                >
                  Acceder al Panel
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 bg-white text-[#002A8D] border-2 border-slate-100 px-8 py-4 rounded-2xl font-bold text-lg hover:border-[#FF7800] hover:text-[#FF7800] transition-all group active:scale-95"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 group-hover:animate-bounce" />
                  Descargar App
                </button>
              </div>

              {/* Stats/Badges */}
              <div className="mt-12 flex items-center gap-8 border-t border-slate-100 pt-8">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-[#002A8D]">100%</span>
                  <span className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Seguro</span>
                </div>
                <div className="w-px h-10 bg-slate-100" />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-[#002A8D]">24/7</span>
                  <span className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Disponibilidad</span>
                </div>
              </div>
            </div>

            {/* Visual Right */}
            <div className="mt-16 lg:mt-0 relative">
              <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#002A8D]/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#FF7800]/5 rounded-full blur-3xl" />
              
              <div className="relative bg-slate-50 rounded-[2.5rem] p-4 border border-slate-100 shadow-2xl transform lg:rotate-3 hover:rotate-0 transition-transform duration-700">
                <div className="bg-white rounded-[2rem] overflow-hidden shadow-inner aspect-[4/3] relative group">
                   <div className="absolute inset-0 bg-gradient-to-br from-[#002A8D]/10 to-transparent z-10" />
                   {/* Placeholder for App Preview */}
                   <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className="grid grid-cols-2 gap-4 w-full h-full">
                         <div className="bg-slate-100 rounded-2xl animate-pulse" />
                         <div className="space-y-4">
                            <div className="bg-slate-200 h-1/3 rounded-2xl animate-pulse" />
                            <div className="bg-[#FF7800]/20 h-2/3 rounded-2xl animate-pulse" />
                         </div>
                      </div>
                   </div>
                   <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-white/50 z-20 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-[#FF7800] rounded-lg flex items-center justify-center text-white font-bold">FX</div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Dashboard de Control</p>
                          <p className="text-xs text-slate-500 font-medium">Actualizado hace un momento</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-[#002A8D] mb-4">Herramientas Especializadas</h2>
            <p className="text-slate-500 max-w-2xl mx-auto font-medium">Diseñado específicamente para las necesidades del equipo de Fuvex BCP.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<DevicePhoneMobileIcon className="h-7 w-7" />}
              title="Acceso Móvil"
              description="Lleva tu gestión en el bolsillo. Descarga el APK e instálalo en segundos."
            />
            <FeatureCard 
              icon={<UserGroupIcon className="h-7 w-7" />}
              title="Jerarquía Inteligente"
              description="Control total para Jefes Zonales, Supervisores y Asesores."
            />
            <FeatureCard 
              icon={<ShieldCheckIcon className="h-7 w-7" />}
              title="Consulta RCC"
              description="Integración directa con Infoburo para evaluaciones precisas."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="h-8 grayscale opacity-50" />
            <p className="text-slate-400 text-sm font-medium">© 2026 Fuvex BCP - Todos los derechos reservados.</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-[#002A8D] transition-colors">Términos</a>
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-[#002A8D] transition-colors">Privacidad</a>
            <a href="#" className="text-sm font-bold text-slate-400 hover:text-[#002A8D] transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 hover:border-[#FF7800]/30 transition-all group">
      <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-[#002A8D] mb-6 group-hover:bg-[#FF7800] group-hover:text-white transition-colors duration-500">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed font-medium">{description}</p>
    </div>
  );
}
