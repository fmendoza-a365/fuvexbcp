import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Eye, AlertTriangle, Trash2, TrendingUp, LayoutList, Clock, Search, FileSpreadsheet } from 'lucide-react';
import DocumentViewer from '../components/DocumentViewer';
import ReassignmentPanel from '../components/ReassignmentPanel';

interface Sale {
  id: string;
  dni_cliente: string;
  nombres_cliente: string;
  estado: string;
  maf_neto: number;
  vencimiento_remesa: string;
  asesor: { username: string };
  documents: { file_path: string, tipo_documento: string }[];
}

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/sales', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Handle both direct array and paginated { data: [] } formats
      const salesArray = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setSales(salesArray);
    } catch (error) {
      console.error('Error fetching sales', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    const handleRefresh = () => fetchSales();
    window.addEventListener('refresh-sales', handleRefresh);
    return () => window.removeEventListener('refresh-sales', handleRefresh);
  }, []);

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/export/ventas', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ventas_fuvex.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch(err) {
      console.error(err);
    }
  };

  const isExpiringSoon = (dateString: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/sales/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSales();
    } catch (error) {
      console.error('Error deleting sale', error);
    }
  };

  const { totalMaf, expiringCount } = useMemo(() => {
    let maf = 0;
    let expCount = 0;
    if (Array.isArray(sales)) {
      for (const sale of sales) {
        maf += (sale.maf_neto || 0);
        if (isExpiringSoon(sale.vencimiento_remesa)) {
          expCount++;
        }
      }
    }
    return { totalMaf: maf, expiringCount: expCount };
  }, [sales]);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = ['ADMIN', 'SUPERADMIN', 'GERENTE'].includes(user.role);
  const isJefeZonal = user.role === 'JEFE_ZONAL';
  const canExport = ['SUPERVISOR', 'JEFE_ZONAL', 'GERENTE', 'SUPERADMIN', 'BACK_OFFICE', 'ANALISTA'].includes(user.role);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
        <p className="text-text-700 font-bold uppercase tracking-widest text-[10px]">Cargando Expedientes...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Sección */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-900 tracking-tight uppercase">
            Bandeja de <span className="text-[var(--color-bcp-blue)]">Expedientes</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Gestión operativa y seguimiento de colocaciones</p>
        </div>
        <div className="flex items-center gap-3">
          {canExport && (
            <button onClick={exportCSV} className="action-button-secondary">
              <FileSpreadsheet size={18} className="text-emerald-600" /> Exportar Data
            </button>
          )}
        </div>
      </div>

      {/* Panel de Reasignaciones */}
      {(isAdmin || isJefeZonal) && <ReassignmentPanel />}

      {/* KPI Cards Sincronizadas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="premium-card group">
          <div className="flex justify-between items-start">
            <div>
              <span className="stat-label">MAF Neto Acumulado</span>
              <div className="stat-value text-[var(--color-bcp-blue)]">S/ {totalMaf.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>
        
        <div className="premium-card group">
          <div className="flex justify-between items-start">
            <div>
              <span className="stat-label">Expedientes Totales</span>
              <div className="stat-value">{sales.length}</div>
            </div>
            <div className="p-3 bg-surface-50 text-text-700 rounded-2xl group-hover:scale-110 transition-transform">
              <LayoutList size={20} />
            </div>
          </div>
        </div>

        <div className="premium-card group">
          <div className="flex justify-between items-start">
            <div>
              <span className="stat-label">Alertas Vencimiento</span>
              <div className="stat-value text-[var(--color-bcp-orange)]">{expiringCount}</div>
            </div>
            <div className="p-3 bg-[rgba(255,120,0,0.1)] text-[var(--color-bcp-orange)] rounded-2xl group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Sincronizada */}
      <div className="premium-card !p-0 overflow-hidden border-surface-200">
        <div className="p-6 border-b border-surface-200 flex justify-between items-center bg-surface-100">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-700" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar cliente, DNI o asesor..." 
                  className="w-full pl-10 pr-4 py-2 bg-surface-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-bcp-blue-light)] transition-all"
                />
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="data-table-header">
                <th className="px-6 py-4">DNI / Cliente</th>
                <th className="px-6 py-4">Asesor</th>
                <th className="px-6 py-4 text-right">MAF Neto</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4">Vencimiento</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700">
              {sales.map((sale) => (
                <tr key={sale.id} className="data-table-row group/row">
                  <td className="px-6 py-4">
                    <div className="font-bold text-text-900">{sale.nombres_cliente}</div>
                    <div className="text-[10px] text-text-700 font-bold">{sale.dni_cliente}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-text-700 uppercase">
                          {sale.asesor?.username.substring(0,2)}
                       </div>
                       <span className="font-medium">{sale.asesor?.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-text-900">S/ {sale.maf_neto?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 bg-[rgba(0,42,141,0.1)] text-[var(--color-bcp-blue)] rounded-full text-[10px] font-black uppercase tracking-wider">
                      {sale.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {sale.vencimiento_remesa && (
                      <div className={`flex items-center gap-2 text-xs font-bold ${isExpiringSoon(sale.vencimiento_remesa) ? 'text-red-600' : 'text-text-700'}`}>
                        {isExpiringSoon(sale.vencimiento_remesa) ? <AlertTriangle size={14} className="animate-pulse" /> : <Clock size={14} />}
                        {new Date(sale.vencimiento_remesa).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setSelectedSale(sale)}
                        className="p-2 text-[var(--color-bcp-blue)] hover:bg-[rgba(0,42,141,0.1)] rounded-xl transition-all" title="Ver Detalle">
                        <Eye size={18} />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDelete(sale.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Eliminar">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-20">
                       <LayoutList size={48} />
                       <p className="font-bold uppercase tracking-widest text-xs">No hay expedientes registrados</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {selectedSale && (
        <DocumentViewer 
          sale={sales.find(s => s.id === selectedSale.id) || selectedSale} 
          onClose={() => setSelectedSale(null)} 
          onUpdate={fetchSales} 
        />
      )}
    </div>
  );
}
