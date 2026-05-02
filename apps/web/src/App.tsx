import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Layout from './components/Layout';

// Carga diferida de páginas pesadas
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ZoneManagement = lazy(() => import('./pages/ZoneManagement'));
const Profile = lazy(() => import('./pages/Profile'));
const Analytics = lazy(() => import('./pages/Analytics'));
const GoalPlanning = lazy(() => import('./pages/GoalPlanning'));
const DniSearch = lazy(() => import('./pages/DniSearch'));
const Simulator = lazy(() => import('./pages/Simulator'));
const SimulatorRules = lazy(() => import('./pages/SimulatorRules'));

// Componente de carga
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);


function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/app" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Analytics />} />
            <Route path="expedientes" element={<Dashboard />} />
            <Route path="metas" element={<GoalPlanning />} />
            <Route path="simulador" element={<Simulator />} />
            <Route path="simulador-reglas" element={<SimulatorRules />} />
            <Route path="reniec" element={<DniSearch />} />
            <Route path="usuarios" element={<UserManagement />} />
            <Route path="zonas" element={<ZoneManagement />} />
            <Route path="perfil" element={<Profile />} />
          </Route>

          {/* Redirigir cualquier ruta no encontrada a la landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
