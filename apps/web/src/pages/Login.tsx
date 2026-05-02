import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/app');
    } catch {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[var(--color-bcp-blue)]/[0.03]" />
        <div className="absolute -bottom-60 -right-40 w-[600px] h-[600px] rounded-full bg-[var(--color-bcp-orange)]/[0.04]" />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-[var(--color-bcp-blue)]/[0.02]" />
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-bcp-blue)] via-[#001A57] to-[var(--color-bcp-blue-dark)]" />
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-40 h-40 rounded-full border-2 border-white/10" />
        <div className="absolute bottom-32 right-16 w-60 h-60 rounded-full border border-white/5" />
        <div className="absolute top-1/3 right-1/4 w-20 h-20 rounded-full bg-[var(--color-bcp-orange)]/20" />

        <div className="relative z-10 max-w-lg">
          <div className="mb-8">
            <img src="/logo.png" alt="Logo Fuvex BCP" className="h-12 brightness-0 invert" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-6">
            Fuvex<br />
            <span className="text-[var(--color-bcp-orange)]">Sales Pro</span>
          </h1>
          <p className="text-lg text-white/70 font-medium leading-relaxed max-w-md">
            Plataforma integral de gestión comercial para el equipo de ventas BCP. 
            Registra, simula y gestiona expedientes de crédito desde un solo lugar.
          </p>

          <div className="mt-12 flex gap-8">
            <div>
              <div className="text-3xl font-black text-[var(--color-bcp-orange)]">+2K</div>
              <div className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">Expedientes</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-3xl font-black text-[var(--color-bcp-orange)]">98%</div>
              <div className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">Precisión</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-3xl font-black text-[var(--color-bcp-orange)]">24/7</div>
              <div className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">Disponibilidad</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src="/logo.png" alt="Logo Fuvex BCP" className="h-16 object-contain" />
          </div>

          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-main)' }}>
              Bienvenido
            </h2>
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
              Ingresa tus credenciales corporativas para continuar
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Username Field */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-2 block px-1" style={{ color: 'var(--text-muted)' }}>
                USUARIO
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-bcp-blue)] opacity-60 group-focus-within:opacity-100 transition-opacity">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-200 border"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }}
                  placeholder="Ej: jperalta"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--color-bcp-blue)';
                    e.target.style.boxShadow = '0 0 0 3px var(--color-bcp-blue-light)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border-main)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.15em] mb-2 block px-1" style={{ color: 'var(--text-muted)' }}>
                CONTRASEÑA
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-bcp-blue)] opacity-60 group-focus-within:opacity-100 transition-opacity">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-12 pr-12 py-3.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-200 border"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--color-bcp-blue)';
                    e.target.style.boxShadow = '0 0 0 3px var(--color-bcp-blue-light)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border-main)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600" role="alert" aria-live="assertive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-sm font-semibold">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
              style={{
                backgroundColor: 'var(--color-bcp-orange)',
                boxShadow: '0 10px 25px -5px rgba(255, 120, 0, 0.35)',
              }}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  INICIAR SESIÓN
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-10 text-center">
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              Versión 2.1.0 • Bearlytics © 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}