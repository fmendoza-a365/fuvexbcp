import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
const OutletAny = Outlet as any;
const LinkAny = Link as any;
import { LogOut, FileText, Menu, X, Users, MapPin, ChevronLeft, ChevronRight, User, LayoutDashboard, Target, Search, Shield, AlertCircle, Moon, Sun, Calculator, Settings, Columns3, Building2 } from 'lucide-react';

import axios from 'axios';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [kpiData, setKpiData] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);


  useEffect(() => {
    fetchHeaderData();
    const interval = setInterval(fetchHeaderData, 60000); // Sync every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchHeaderData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [kpiRes, notifRes] = await Promise.all([
        axios.get('/api/analytics/dashboard', { headers }),
        axios.get('/api/notifications', { headers })
      ]);
      
      setKpiData(kpiRes.data);
      setNotifications(notifRes.data);
    } catch (error) {
      console.error('Error fetching header data:', error);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`/api/sales?q=${searchQuery}`, { headers });
      const results = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setSearchResults(results.slice(0, 5)); // Show top 5
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    };
    window.addEventListener('storage', handleUserUpdate);
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.profile-dropdown-container')) {
        setIsProfileOpen(false);
      }
      if (!(e.target as Element).closest('.notifications-container')) {
        setIsNotificationsOpen(false);
      }
      if (!(e.target as Element).closest('.search-container')) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('storage', handleUserUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const isAdmin = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL'].includes(user.role);
  const isSuperAdminOrGerente = ['SUPERADMIN', 'GERENTE'].includes(user.role);

  const navItems = [
    { to: '/app', icon: <LayoutDashboard size={20} />, label: 'Analítica Gerencial', show: true },
    { to: '/app/expedientes', icon: <FileText size={20} />, label: 'Bandeja de Expedientes', show: true },
    { to: '/app/metas', icon: <Target size={20} />, label: 'Planificación de Metas', show: (isSuperAdminOrGerente || user.role === 'JEFE_ZONAL') },
    { to: '/app/simulador', icon: <Calculator size={20} />, label: 'Simulador BCP', show: true },
    { to: '/app/reniec', icon: <Search size={20} />, label: 'Buscador RENIEC', show: true },
    { to: '/app/simulador-reglas', icon: <Settings size={20} />, label: 'Reglas Simulador', show: isAdmin },
    { to: '/app/kanban', icon: <Columns3 size={20} />, label: 'Pipeline Visual', show: true },
    { to: '/app/digitalizacion', icon: <Building2 size={20} />, label: 'Digitalización', show: isAdmin },
    { to: '/app/usuarios', icon: <Users size={20} />, label: 'Usuarios', show: isAdmin },
    { to: '/app/zonas', icon: <MapPin size={20} />, label: 'Zonas', show: isSuperAdminOrGerente },
  ];

  return (
    <div className="h-screen bg-surface-50 flex overflow-hidden font-sans text-text-900">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[10] md:hidden animate-in fade-in duration-300" 
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[20] bg-surface-100 border-r border-surface-200 text-text-700 flex flex-col transform transition-[width,transform] duration-300 ease-in-out md:static md:translate-x-0 h-full
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'md:w-20' : 'md:w-72'}
        w-72 shrink-0
      `}>
        {/* Floating Toggle Button */}
        <button 
          onClick={toggleCollapse}
          className="hidden md:flex absolute -right-3 top-10 z-[80] w-6 h-6 bg-surface-100 border border-surface-200 rounded-full items-center justify-center text-text-700 hover:text-[var(--color-bcp-orange)] hover:shadow-md shadow-sm group/toggle transition-all"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Sidebar Header */}
        <div className={`h-20 border-b border-surface-200 flex items-center px-4 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
          {!isCollapsed ? (
            <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
          ) : (
            <img src="/isotipobcp.png" alt="Isotipo" className="h-9 w-9 object-contain animate-in fade-in zoom-in duration-500" />
          )}
          
          <button onClick={toggleSidebar} className="md:hidden text-text-700 absolute right-4">
            <X size={24} />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Navegación principal">
          {navItems.map((item) => item.show && (
            <LinkAny 
              key={item.to}
              to={item.to} 
              className={`flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isCollapsed ? 'justify-center px-0 mx-2' : 'px-3'} ${location.pathname === item.to ? 'bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] font-bold shadow-sm' : 'hover:bg-surface-50 hover:text-text-900 hover:translate-x-1'}`} 
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className="flex-shrink-0 transition-all duration-300 group-hover:scale-110">
                {item.icon}
              </div>
              {!isCollapsed && <span className="truncate text-sm uppercase tracking-tight">{item.label}</span>}
            </LinkAny>
          ))}

          <div className={`my-6 border-t mx-4 transition-colors ${isCollapsed ? 'border-transparent' : 'border-surface-200'}`}></div>

          {/* Settings at bottom of main nav */}
          <LinkAny 
            to="/app/perfil" 
            className={`flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isCollapsed ? 'justify-center px-0 mx-2' : 'px-3'} ${location.pathname === '/perfil' ? 'bg-[rgba(255,120,0,0.1)] text-[var(--color-bcp-orange)] font-bold shadow-sm' : 'hover:bg-surface-50 hover:text-text-900 hover:translate-x-1'}`} 
            onClick={() => setIsSidebarOpen(false)}
          >
            <div className="flex-shrink-0 transition-all duration-300 group-hover:scale-110">
              <Shield size={20} />
            </div>
            {!isCollapsed && <span className="truncate text-sm uppercase tracking-tight">Seguridad y Perfil</span>}
          </LinkAny>
        </nav>
        
        {/* Help Link */}
        <div className={`p-4 border-t border-surface-200 bg-surface-50/20 ${isCollapsed ? 'flex justify-center' : ''}`}>
           <button className={`flex items-center gap-3 text-text-700 hover:text-[var(--color-bcp-blue)] transition-all ${isCollapsed ? 'p-2' : 'px-3 py-2 w-full text-xs font-bold uppercase tracking-widest'}`}>
              <AlertCircle size={isCollapsed ? 20 : 16} />
              {!isCollapsed && <span>Soporte Fuvex</span>}
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <div className="flex-1 flex flex-col overflow-y-auto relative bg-surface-50">
          <header className="sticky top-0 z-50 bg-surface-100/80 backdrop-blur-xl border-b border-surface-200 h-20 px-4 sm:px-8 py-4 flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="md:hidden text-text-700 hover:text-slate-700" aria-label="Abrir menú">
              <Menu size={24} />
            </button>
            
            {/* Breadcrumbs & Search Area */}
            <div className="flex items-center gap-4 sm:gap-8">
               <div className="hidden xl:flex flex-col w-48 shrink-0">
                  <div className="flex items-center gap-2 text-[10px] font-black text-text-700 uppercase tracking-[0.2em]">
                     <span>Fuvex</span>
                     <ChevronRight size={10} className="text-text-700" />
                     <span className="text-[var(--color-bcp-blue)]">
                        {location.pathname === '/' ? 'Analítica' : 
                         location.pathname === '/expedientes' ? 'Operaciones' :
                         location.pathname === '/metas' ? 'Planificación' :
                         'Gestión'}
                     </span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-tight">Consola Central</div>
               </div>

               <div className="relative search-container group">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSearchFocused ? 'text-[var(--color-bcp-orange)]' : 'text-text-700'}`}>
                     <Search size={16} />
                  </div>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    placeholder="Buscar registros..." 
                    className={`bg-surface-50 border border-surface-200 rounded-lg pl-11 pr-4 py-3 text-xs focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] focus:bg-surface-100 transition-all outline-none font-bold uppercase tracking-tight ${isSearchFocused ? 'w-80 md:w-96 shadow-sm' : 'w-64 md:w-80'}`}
                  />

                  {/* Search Results Dropdown */}
                  {isSearchFocused && (searchQuery.length > 0 || isSearching) && (
                    <div className="absolute top-full left-0 right-0 mt-3 bg-surface-100 rounded-lg shadow-xl border border-surface-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="px-4 py-2 text-[10px] font-black text-text-700 uppercase tracking-widest flex justify-between">
                            <span>{isSearching ? 'Buscando...' : 'Resultados Sugeridos'}</span>
                            {!isSearching && <span>{searchResults.length} encontrados</span>}
                        </div>
                        <div className="space-y-1 mt-1 max-h-80 overflow-y-auto">
                            {searchResults.map((res) => (
                              <div 
                                key={res.id} 
                                onClick={() => {
                                navigate(`/app/expedientes?id=${res.id}`);
                                  setIsSearchFocused(false);
                                  setSearchQuery('');
                                }}
                                className="flex items-center gap-3 p-3 hover:bg-surface-50 rounded-lg cursor-pointer transition-all group"
                              >
                                  <div className="w-8 h-8 rounded-lg bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] flex items-center justify-center font-bold text-[10px] uppercase">
                                     {res.estado.substring(0, 2)}
                                  </div>
                                  <div className="flex-1 truncate">
                                      <div className="text-xs font-bold text-slate-800 uppercase truncate">{res.nombres_cliente}</div>
                                      <div className="text-[9px] font-bold text-text-700 uppercase">DNI: {res.dni_cliente} • S/ {res.maf_neto.toLocaleString()}</div>
                                  </div>
                                  <div className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                                    res.estado === 'DESEMBOLSADO' ? 'bg-emerald-50 text-emerald-600' :
                                    res.estado === 'OBSERVADA' ? 'bg-amber-50 text-amber-600' : 'bg-[rgba(0,42,141,0.1)] text-blue-600'
                                  }`}>
                                    {res.estado}
                                  </div>
                              </div>
                            ))}
                            {!isSearching && searchResults.length === 0 && (
                              <div className="p-8 text-center text-text-700 text-[10px] font-bold uppercase italic">No se encontraron registros</div>
                            )}
                        </div>
                    </div>
                  )}
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
             {/* Global Goal KPI Widget */}
             <div className="hidden lg:flex items-center gap-4 px-6 py-2 border-r border-surface-200">
                <div className="text-right">
                   <div className="text-[10px] font-black text-text-700 uppercase tracking-widest">Meta Global</div>
                   <div className="text-xs font-black text-text-900 tracking-tighter">S/ {(kpiData?.totalDisbursed || 0).toLocaleString()}</div>
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                        <circle cx="24" cy="24" r="20" className="fill-none stroke-slate-100 stroke-[4px]" />
                        <circle 
                          cx="24" cy="24" r="20" 
                          className="fill-none stroke-[var(--color-bcp-orange)] stroke-[4px] transition-all duration-1000" 
                          strokeDasharray="125.6" 
                          strokeDashoffset={125.6 - (125.6 * Math.min(kpiData?.completionRate || 0, 100)) / 100} 
                          strokeLinecap="round" 
                        />
                    </svg>
                    <span className="absolute text-[10px] font-black text-[var(--color-bcp-orange)]">{Math.round(kpiData?.completionRate || 0)}%</span>
                </div>
             </div>

             {/* Theme Toggle */}
             <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2.5 rounded-xl transition-all text-text-700 hover:text-[var(--color-bcp-orange)] hover:bg-[rgba(255,120,0,0.1)] dark:hover:bg-slate-800"
                title={isDark ? "Modo Claro" : "Modo Oscuro"}
             >
                <div key={isDark ? 'dark' : 'light'} className="theme-icon-enter">
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </div>
             </button>


             {/* Action Icons */}

             <div className="flex items-center gap-2 notifications-container relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={`relative p-2.5 rounded-xl transition-all group ${isNotificationsOpen ? 'bg-[rgba(255,120,0,0.1)] text-[var(--color-bcp-orange)]' : 'text-text-700 hover:text-[var(--color-bcp-orange)] hover:bg-[rgba(255,120,0,0.1)]'}`} 
                  title="Notificaciones"
                >
                   <FileText size={20} />
                   <span className="absolute top-2 right-2 w-4 h-4 bg-[var(--color-bcp-orange)] text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm">3</span>
                </button>

                {/* Notifications Dropdown */}
                {isNotificationsOpen && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-surface-100 rounded-lg shadow-xl border border-surface-200 py-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="px-6 pb-4 border-b border-surface-200 flex justify-between items-center">
                        <div className="text-xs font-black text-text-900 uppercase tracking-tight">Alertas Fuvex</div>
                        <span className="text-[9px] font-bold text-[var(--color-bcp-blue)] cursor-pointer hover:underline">Limpiar</span>
                    </div>
                    <div className="p-2 space-y-1 max-h-[320px] overflow-y-auto">
                        {notifications.map((n) => (
                          <div key={n.id} className="flex items-start gap-3 p-4 hover:bg-surface-50 rounded-lg transition-all cursor-pointer group">
                              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.estado_nuevo === 'RECHAZADO' ? 'bg-rose-500' : 'bg-[var(--color-bcp-orange)]'}`} />
                              <div>
                                  <div className="text-xs font-bold text-slate-800 uppercase tracking-tight line-clamp-1">{n.accion}: {n.sale.nombres_cliente}</div>
                                  <p className="text-[10px] text-text-700 mt-1 line-clamp-2">{n.detalles}</p>
                                  <span className="text-[9px] font-bold text-text-700 uppercase mt-2 block">{new Date(n.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <div className="py-12 text-center text-text-700 text-[10px] font-bold uppercase italic">No hay actividad reciente</div>
                        )}
                    </div>
                  </div>
                )}
             </div>

             <div className="h-8 w-px bg-slate-100 hidden sm:block"></div>

             {/* Profile Dropdown Container */}
             <div className="relative profile-dropdown-container">
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center gap-3 p-1.5 rounded-lg transition-all border ${isProfileOpen ? 'bg-surface-50 border-surface-200' : 'border-transparent hover:bg-surface-50'}`}
                >
                   <div className="hidden sm:block text-right px-2">
                      <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{user.nombre || 'Admin'}</div>
                      <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1">
                         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> En Línea
                      </div>
                   </div>
                   <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${isProfileOpen ? 'border-[var(--color-bcp-orange)]' : 'border-white shadow-sm'}`}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-text-700">
                          <User size={20} />
                        </div>
                      )}
                   </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-3 w-64 bg-surface-100 rounded-lg shadow-xl border border-surface-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-6 py-4 border-b border-surface-200">
                       <div className="text-xs font-black text-text-900 uppercase tracking-tight mb-1">{user.nombre || user.username}</div>
                       <div className="text-[10px] font-bold text-text-700 uppercase tracking-widest">{user.role}</div>
                    </div>
                    <div className="p-2 space-y-1">
                       <LinkAny 
                         to="/app/perfil" 
                         onClick={() => setIsProfileOpen(false)}
                         className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-text-700 hover:text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] rounded-xl transition-all"
                       >
                          <User size={18} /> Mi Perfil
                       </LinkAny>
                       <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-text-700 hover:text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] rounded-xl transition-all text-left">
                          <Shield size={18} /> Seguridad
                       </button>
                    </div>
                    <div className="mt-2 pt-2 border-t border-surface-200 p-2">
                       <button 
                         onClick={handleLogout}
                         className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all text-left"
                       >
                          <LogOut size={18} /> Cerrar Sesión
                       </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </header>

          <main className="p-4 sm:p-8">
            <OutletAny />
          </main>
        </div>
      </div>
    </div>
  );
}
