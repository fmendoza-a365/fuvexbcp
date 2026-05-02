import { X, Download, Printer, List } from 'lucide-react';
import type { CronogramaRow } from '../utils/simulatorCalc';
import { fmt } from '../utils/simulatorCalc';

interface Props {
  cronograma: CronogramaRow[];
  resumen: { monto_solicitado: number; tea: number; tcea: number; total_pagar: number; totales_tabla: { interes: number; desgravamen: number } };
  onClose: () => void;
}

export default function CronogramaModal({ cronograma, resumen, onClose }: Props) {
  const handleDownload = () => {
    const header = "NRO,FECHA,CAPITAL,INTERES,DESGRAVAMEN,AMORTIZACION,ENVIO,CUOTA TOTAL,SALDO\n";
    const rows = cronograma.map(c =>
      `${c.nro},${c.fecha},${c.capital},${c.interes},${c.desgravamen},${c.amortizacion},${c.envioFisico},${c.cuotaTotal},${c.saldo}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Cronograma_BCP_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[var(--color-surface-100)] w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 border border-[var(--color-surface-200)]">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-[var(--color-surface-200)] flex justify-between items-center bg-[var(--color-surface-50)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--color-bcp-blue)] rounded-2xl flex items-center justify-center text-white shadow-lg">
              <List size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--color-text-900)] tracking-tight">CRONOGRAMA DE PAGOS</h2>
              <p className="stat-label tracking-widest">Referencial - Sujeto a evaluación crediticia</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleDownload} className="action-button-secondary !w-11 !h-11 !p-0 !rounded-2xl justify-center cursor-pointer"><Download size={20} /></button>
            <button onClick={() => window.print()} className="action-button-secondary !w-11 !h-11 !p-0 !rounded-2xl justify-center cursor-pointer"><Printer size={20} /></button>
            <button onClick={onClose} className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm cursor-pointer"><X size={20} /></button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="flex-1 overflow-auto p-8 space-y-8 bg-[var(--color-surface-100)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[var(--color-bcp-blue)] rounded-3xl p-5 text-white shadow-xl shadow-blue-900/10">
              <p className="text-[8px] font-black uppercase opacity-60 mb-1">Monto Solicitado</p>
              <p className="text-2xl font-black tracking-tighter">S/ {fmt(resumen.monto_solicitado)}</p>
            </div>
            <div className="bg-[var(--color-surface-50)] rounded-3xl p-5 border border-[var(--color-surface-200)]">
              <p className="stat-label mb-1">Interés Total</p>
              <p className="text-2xl font-black text-[var(--color-text-900)] tracking-tighter">S/ {fmt(resumen.totales_tabla.interes)}</p>
            </div>
            <div className="bg-[var(--color-surface-50)] rounded-3xl p-5 border border-[var(--color-surface-200)]">
              <p className="stat-label mb-1">Seguros Total</p>
              <p className="text-2xl font-black text-[var(--color-text-900)] tracking-tighter">S/ {fmt(resumen.totales_tabla.desgravamen)}</p>
            </div>
            <div className="bg-emerald-500 rounded-3xl p-5 text-white shadow-xl shadow-emerald-900/10">
              <p className="text-[8px] font-black uppercase opacity-60 mb-1">Total a Pagar</p>
              <p className="text-2xl font-black tracking-tighter">S/ {fmt(resumen.total_pagar)}</p>
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-3xl border border-[var(--color-surface-200)] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--color-surface-50)]">
                <tr>
                  {['N°','Fecha','Capital','Interés','Desgravamen','Amortización','Envío','Cuota Final','Saldo'].map(h => (
                    <th key={h} className="text-[9px] font-black text-[var(--color-text-900)] uppercase px-4 py-4 border-b border-[var(--color-surface-200)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-surface-200)]">
                {cronograma.map((c, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface-50)] transition-colors">
                    <td className="px-4 py-3 text-[11px] font-black text-[var(--color-text-900)]">{c.nro}</td>
                    <td className="px-4 py-3 text-[11px] font-bold text-[var(--color-text-900)]">{c.fecha}</td>
                    <td className="px-4 py-3 text-[11px] font-medium text-[var(--color-text-500)]">S/ {c.capital}</td>
                    <td className="px-4 py-3 text-[11px] font-bold text-rose-600">S/ {c.interes}</td>
                    <td className="px-4 py-3 text-[11px] font-medium text-amber-600">S/ {c.desgravamen}</td>
                    <td className="px-4 py-3 text-[11px] font-black text-emerald-600">S/ {c.amortizacion || '-'}</td>
                    <td className="px-4 py-3 text-[11px] font-medium text-[var(--color-text-500)]">S/ {c.envioFisico || '-'}</td>
                    <td className="px-4 py-3 text-[12px] font-black text-[var(--color-bcp-blue)]">S/ {c.cuotaTotal || '-'}</td>
                    <td className="px-4 py-3 text-[11px] font-black text-[var(--color-text-900)]">S/ {c.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-[var(--color-surface-50)] border-t border-[var(--color-surface-200)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="stat-label">TEA Anual</span>
              <span className="text-sm font-black text-[var(--color-text-900)]">{(resumen.tea * 100).toFixed(2)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="stat-label">TCEA (Referencial)</span>
              <span className="text-sm font-black text-[var(--color-bcp-blue)]">{(resumen.tcea * 100).toFixed(2)}%</span>
            </div>
          </div>
          <p className="text-[9px] font-medium text-[var(--color-text-500)] italic max-w-xs text-right">
            Nota: Los montos son referenciales y dependen de la fecha exacta de desembolso y evaluación crediticia final.
          </p>
        </div>
      </div>
    </div>
  );
}
