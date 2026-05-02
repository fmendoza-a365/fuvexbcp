import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/app');
    } catch (err) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="Logo Fuvex BCP" className="h-20 object-contain" />
        </div>
        <p className="mt-2 text-center text-sm text-text-700">
          Portal de Gestión BCP
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-100 py-8 px-4 shadow sm:rounded-lg sm:px-10 border-t-4 border-[var(--color-bcp-orange)]">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-text-700">Usuario</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-surface-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-[var(--color-bcp-blue)] focus:border-[var(--color-bcp-blue)] sm:text-sm"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-700">Contraseña</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-surface-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-[var(--color-bcp-blue)] focus:border-[var(--color-bcp-blue)] sm:text-sm"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div
                className="text-red-600 text-sm font-medium p-2 bg-red-50 rounded border border-red-200"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--color-bcp-blue)] hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-bcp-blue)] transition-colors"
              >
                Ingresar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
