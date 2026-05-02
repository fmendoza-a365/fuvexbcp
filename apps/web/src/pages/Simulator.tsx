import { useState, useEffect, useMemo } from 'react';
import { Calculator, ShieldAlert, BadgeCheck, Zap, Info, ChevronRight, Landmark } from 'lucide-react';
import axios from 'axios';
import {
  calcTEM, calcCuotaFrancesa, calcCEM,
  generarCronograma, calcTCEA, fmt
} from '../utils/simulatorCalc';
import CronogramaModal from '../components/CronogramaModal';

interface SimConfig {
  convenios: { id: string; nombre: string; sector: string; variables_reserva: number; rci_default: number; periodo_gracia: number }[];
  cargos: { id: string; nombre: string }[];
  reglas: { convenio_id: string; cargo_id: string; rci_especifico: number }[];
  configuracion: { TEA_DEFAULT: number; COSTO_ENVIO_FISICO: number };
}

export default function Simulator() {
  const [config, setConfig] = useState<SimConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [serverSimulation, setServerSimulation] = useState<any>(null);

  const [form, setForm] = useState({
    convenioId: '',
    cargoId: '',
    sector: '',
    ingresosFijos: '',
    ingresosVariables: '',
    promedioVariables: '',
    cafae: '',
    ingresosNoConstantes: '',
    descuentosLey: '',
    reserva: '',
    facultativos: '',
    montoSolicitado: '',
    cuotas: '12',
    envioFisico: false,
    teaManual: '',
    periodoGracia: '0',
    fechaDesembolso: new Date().toISOString().split('T')[0],
    tipoDesgravamen: 'Individual',
  });

  const [cargaCrediticia, setCargaCrediticia] = useState([
    { tipo: 'Crédito Hipotecario', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Crédito Efectivo', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Crédito Vehicular', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Pyme', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Comercial', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Deuda Indirecta', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Línea TC Utilizada', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
    { tipo: 'Línea TC No Utilizada', bcp: '', noBcp: '', saldo: '', saldoAct: '', cuotaAct: '' },
  ]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/api/simulator/config', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setConfig(res.data);
        if (res.data.configuracion?.TEA_DEFAULT) {
          setForm(prev => ({ ...prev, teaManual: (res.data.configuracion.TEA_DEFAULT * 100).toString() }));
        }
        setLoadingConfig(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingConfig(false);
      });
  }, []);

  const selectedConvenio = useMemo(() =>
    config?.convenios.find(c => c.id === form.convenioId),
    [form.convenioId, config]);

  const filteredCargos = useMemo(() => {
    if (!form.convenioId || !config) return [];
    const validCargoIds = config.reglas
      .filter(r => r.convenio_id === form.convenioId)
      .map(r => r.cargo_id);
    return config.cargos.filter(c => validCargoIds.includes(c.id));
  }, [form.convenioId, config]);

  const calculations = useMemo(() => {
    const rci = selectedConvenio?.rci_default || 0;

    // IND Logic from Excel:
    // Total Ingresos = Fijos + Promedio Variables + CAFAE
    // Disponible = Total Ingresos * RCI
    // IND = Disponible - Descuentos Ley - Reserva - Facultativos
    const totalIngresos = Number(form.ingresosFijos) + Number(form.promedioVariables) + Number(form.cafae);
    const disponible = totalIngresos * rci;
    const ind = disponible - Number(form.descuentosLey) - Number(form.reserva) - Number(form.facultativos);

    const totalCuotasExternas = cargaCrediticia.reduce((acc, curr) => {
      const bcp = Number(curr.bcp) || 0;
      const noBcp = Number(curr.noBcp) || 0;
      // Si hay una cuota manual se usa esa, sino la suma de BCP + No BCP
      const cuotaRow = Number(curr.cuotaAct) || (bcp + noBcp);
      return acc + cuotaRow;
    }, 0);

    const cem = calcCEM(ind, totalCuotasExternas);
    const tea = (Number(form.teaManual) || 10.99) / 100;
    const tem = calcTEM(tea);
    const n = Number(form.cuotas) || 12;
    const cuotaBase = calcCuotaFrancesa(Number(form.montoSolicitado) || 0, tem, n);
    const desgravamenMensual = (Number(form.montoSolicitado) || 0) * 0.000767;
    const envioFisico = form.envioFisico ? (config?.configuracion?.COSTO_ENVIO_FISICO || 10) : 0;
    const cuotaTotal = cuotaBase + desgravamenMensual + envioFisico;

    const tcea = calcTCEA(Number(form.montoSolicitado) || 0, cuotaTotal, n);
    const dictamen = cuotaTotal <= cem ? 'CONTINUAR' : 'EVALUAR';

    const fechaDes = new Date(form.fechaDesembolso);
    const fechaVenc = new Date(fechaDes);
    fechaVenc.setMonth(fechaVenc.getMonth() + Number(form.periodoGracia) + 1);

    const endeudamientoPorc = totalIngresos > 0 ? (totalCuotasExternas / totalIngresos) * 100 : 0;

    return {
      ind, cem, cuotaTotal, tea, tcea, dictamen, totalCuotasExternas,
      desgravamenMensual, envioFisico, totalIngresos, disponible,
      fechaVenc: fechaVenc.toLocaleDateString('es-PE'),
      endeudamientoPorc
    };
  }, [form, selectedConvenio, cargaCrediticia, config]);

  const handleSimulate = async () => {
    if (!form.convenioId || !form.cargoId) {
      setError('Por favor complete el perfil del cliente para simular.');
      return;
    }
    setError('');
    setSimulating(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        convenioId: form.convenioId,
        cargoId: form.cargoId,
        ingresosFijos: Number(form.ingresosFijos) + Number(form.promedioVariables) + Number(form.cafae),
        ingresosVariables: Number(form.ingresosVariables),
        descuentosLey: Number(form.descuentosLey),
        otrosDescuentos: Number(form.reserva) + Number(form.facultativos),
        montoSolicitado: Number(form.montoSolicitado),
        cuotas: Number(form.cuotas),
        envioFisico: form.envioFisico,
        teaManual: Number(form.teaManual) ? Number(form.teaManual) / 100 : undefined,
        periodoGracia: Number(form.periodoGracia) || selectedConvenio?.periodo_gracia || 0,
        deudaHipotecario: Number(cargaCrediticia[0]?.cuotaAct || cargaCrediticia[0]?.bcp || 0) + Number(cargaCrediticia[0]?.noBcp || 0),
        deudaEfectivo: Number(cargaCrediticia[1]?.cuotaAct || cargaCrediticia[1]?.bcp || 0) + Number(cargaCrediticia[1]?.noBcp || 0),
        deudaVehicular: Number(cargaCrediticia[2]?.cuotaAct || cargaCrediticia[2]?.bcp || 0) + Number(cargaCrediticia[2]?.noBcp || 0),
        deudaPyme: Number(cargaCrediticia[3]?.cuotaAct || cargaCrediticia[3]?.bcp || 0) + Number(cargaCrediticia[3]?.noBcp || 0),
        deudaComercial: Number(cargaCrediticia[4]?.cuotaAct || cargaCrediticia[4]?.bcp || 0) + Number(cargaCrediticia[4]?.noBcp || 0),
        deudaIndirecta: Number(cargaCrediticia[5]?.cuotaAct || cargaCrediticia[5]?.bcp || 0) + Number(cargaCrediticia[5]?.noBcp || 0),
        lineaUtilizadaTC: Number(cargaCrediticia[6]?.cuotaAct || cargaCrediticia[6]?.bcp || 0) + Number(cargaCrediticia[6]?.noBcp || 0),
        lineaNoUtilizadaTC: Number(cargaCrediticia[7]?.cuotaAct || cargaCrediticia[7]?.bcp || 0) + Number(cargaCrediticia[7]?.noBcp || 0)
      };
      const res = await axios.post('/api/simulator/calculate', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServerSimulation(res.data);
      setShowModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo ejecutar la simulacion en el servidor.');
    } finally {
      setSimulating(false);
    }
  };

  const cronogramaData = useMemo(() => {
    if (!showModal) return { cronograma: [], totales: { interes: 0, desgravamen: 0, cuota: 0 } };
    if (serverSimulation?.cronograma) {
      return {
        cronograma: serverSimulation.cronograma.map((row: any) => ({
          ...row,
          capital: String(row.capital ?? ''),
          interes: String(row.interes ?? ''),
          desgravamen: String(row.desgravamen ?? ''),
          amortizacion: String(row.amortizacion ?? ''),
          envioFisico: String(row.envioFisico ?? ''),
          cuotaTotal: String(row.cuotaTotal ?? ''),
          saldo: String(row.saldo ?? '')
        })),
        totales: {
          interes: serverSimulation.resumen?.totales_tabla?.interes || 0,
          desgravamen: serverSimulation.resumen?.totales_tabla?.desgravamen || 0,
          cuota: serverSimulation.resumen?.total_pagar || 0
        }
      };
    }
    const result = generarCronograma(
      Number(form.montoSolicitado) || 0,
      calcTEM(calculations.tea),
      Number(form.cuotas) || 12,
      new Date(form.fechaDesembolso),
      Number(form.periodoGracia) || 0,
      calculations.envioFisico
    );
    return result;
  }, [showModal, serverSimulation, form, calculations.tea, calculations.envioFisico]);

  if (loadingConfig) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
        <p className="text-text-700 font-bold uppercase tracking-widest text-[10px]">Cargando Motor BCP...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-full space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header Estilo Screenshot */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-bcp-blue)] tracking-tight uppercase">
            SIMULADOR <span className="text-text-900">BCP PREMIUM</span>
          </h1>
          <p className="text-text-700 text-sm font-medium mt-1">Evaluación de Riesgo y Capacidad de Pago</p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className="action-button-primary bg-[var(--color-bcp-orange)] hover:bg-[#E66C00] shadow-lg shadow-orange-500/20 px-8 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Zap size={18} />
          <span className="font-bold">{simulating ? 'SIMULANDO...' : 'SIMULAR AHORA'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <ShieldAlert size={20} />
          <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">

          {/* 1. PERFIL DEL CLIENTE */}
          <div className="premium-card">
            <div className="border-b border-surface-200 pb-4 mb-6">
              <h2 className="text-sm font-black text-text-900 uppercase tracking-widest flex items-center gap-2">
                1. PERFIL DEL CLIENTE
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="sim-label">SECTOR</label>
                <select className="sim-input" value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value, convenioId: '', cargoId: '' })}>
                  <option value="">Todos los sectores</option>
                  {Array.from(new Set(config?.convenios.map(c => c.sector))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="sim-label">CONVENIO</label>
                <select className="sim-input" value={form.convenioId} onChange={e => setForm({ ...form, convenioId: e.target.value, cargoId: '' })} disabled={!form.sector}>
                  <option value="">Seleccionar Convenio</option>
                  {config?.convenios.filter(c => c.sector === form.sector).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="sim-label">CARGO</label>
                <select className="sim-input" value={form.cargoId} onChange={e => setForm({ ...form, cargoId: e.target.value })} disabled={!form.convenioId}>
                  <option value="">Seleccionar Cargo</option>
                  {filteredCargos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-8 border-t border-surface-100 pt-4">
              <div className="flex flex-col items-end">
                <span className="sim-label !mb-0">RCI</span>
                <span className="text-lg font-black text-[var(--color-bcp-blue)]">{selectedConvenio ? (selectedConvenio.rci_default * 100) : 0}%</span>
              </div>
            </div>
          </div>

          {/* 2. INGRESOS MENSUALES */}
          <div className="premium-card">
            <div className="border-b border-surface-200 pb-4 mb-6">
              <h2 className="text-sm font-black text-text-900 uppercase tracking-widest">
                2. INGRESOS MENSUALES
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">REMUNERACIÓN FIJA</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.ingresosFijos} onChange={e => setForm({ ...form, ingresosFijos: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">BONOS / VARIABLES</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.ingresosVariables} onChange={e => setForm({ ...form, ingresosVariables: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">PROMEDIO VARIABLES (3 ÚLT. MESES)</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.promedioVariables} onChange={e => setForm({ ...form, promedioVariables: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">OTROS INGRESOS FIJOS (CAFAE)</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.cafae} onChange={e => setForm({ ...form, cafae: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">INGRESOS NO CONSTANTES</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.ingresosNoConstantes} onChange={e => setForm({ ...form, ingresosNoConstantes: e.target.value })} />
                  </div>
                </div>
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-200 flex justify-between items-center mt-2">
                  <span className="sim-label !mb-0">TOTAL INGRESOS</span>
                  <span className="text-xl font-black text-emerald-600">S/ {fmt(calculations.totalIngresos)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* DESCUENTOS DE LEY Y FACULTATIVOS */}
          <div className="premium-card">
            <div className="border-b border-surface-200 pb-4 mb-6">
              <h2 className="text-sm font-black text-text-900 uppercase tracking-widest">
                DESCUENTOS Y DISPONIBLE
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">SUMATORIA DESCUENTOS DE LEY</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.descuentosLey} onChange={e => setForm({ ...form, descuentosLey: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">RESERVA</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.reserva} onChange={e => setForm({ ...form, reserva: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">SUMATORIA DE FACULTATIVOS</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.facultativos} onChange={e => setForm({ ...form, facultativos: e.target.value })} />
                  </div>
                </div>
                <div className="bg-[var(--color-bcp-blue)] p-4 rounded-2xl text-white flex justify-between items-center mt-2 shadow-lg shadow-blue-900/20">
                  <span className="text-[10px] font-black uppercase tracking-widest">INGRESO NETO DISPONIBLE (IND)</span>
                  <span className="text-xl font-black">S/ {fmt(calculations.ind)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. DEUDAS EXTERNAS (RCC) */}
          <div className="premium-card !p-0 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-surface-200">
              <h2 className="text-sm font-black text-text-900 uppercase tracking-widest">
                3. DEUDAS EXTERNAS (RCC)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50">
                    <th className="px-6 py-3 text-[9px] font-black uppercase text-text-700 w-56">Deuda</th>
                    <th className="px-2 py-3 text-[9px] font-black uppercase text-text-700 text-center">Cuota BCP</th>
                    <th className="px-2 py-3 text-[9px] font-black uppercase text-text-700 text-center">Cuota No</th>
                    <th className="px-2 py-3 text-[9px] font-black uppercase text-text-700 text-center">Saldo</th>
                    <th className="px-2 py-3 text-[9px] font-black uppercase text-text-700 text-center">Saldo Act.</th>
                    <th className="px-6 py-3 text-[9px] font-black uppercase text-text-700 text-right">Cuota Act.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {cargaCrediticia.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-2 text-[11px] font-bold text-text-900 uppercase">{row.tipo}</td>
                      <td className="px-1 py-1">
                        <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-xl focus-within:ring-1 focus-within:ring-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                          <span className="pl-2 text-[10px] text-text-500 font-bold select-none">S/</span>
                          <input type="number" className="bg-transparent border-none py-2 px-1 text-[11px] font-black text-text-900 outline-none w-full text-center" value={row.bcp} onChange={e => {
                            const n = [...cargaCrediticia]; n[idx].bcp = e.target.value; setCargaCrediticia(n);
                          }} />
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-xl focus-within:ring-1 focus-within:ring-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                          <span className="pl-2 text-[10px] text-text-500 font-bold select-none">S/</span>
                          <input type="number" className="bg-transparent border-none py-2 px-1 text-[11px] font-black text-text-900 outline-none w-full text-center" value={row.noBcp} onChange={e => {
                            const n = [...cargaCrediticia]; n[idx].noBcp = e.target.value; setCargaCrediticia(n);
                          }} />
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-xl focus-within:ring-1 focus-within:ring-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                          <span className="pl-2 text-[10px] text-text-500 font-bold select-none">S/</span>
                          <input type="number" className="bg-transparent border-none py-2 px-1 text-[11px] font-black text-text-900 outline-none w-full text-center" value={row.saldo} onChange={e => {
                            const n = [...cargaCrediticia]; n[idx].saldo = e.target.value; setCargaCrediticia(n);
                          }} />
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-xl focus-within:ring-1 focus-within:ring-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                          <span className="pl-2 text-[10px] text-text-500 font-bold select-none">S/</span>
                          <input type="number" className="bg-transparent border-none py-2 px-1 text-[11px] font-black text-text-900 outline-none w-full text-center" value={row.saldoAct} onChange={e => {
                            const n = [...cargaCrediticia]; n[idx].saldoAct = e.target.value; setCargaCrediticia(n);
                          }} />
                        </div>
                      </td>
                      <td className="px-6 py-1">
                        <div className="flex items-center justify-end gap-2 bg-blue-50/30 py-2 px-3 rounded-xl">
                          <span className="text-[10px] text-text-500 font-bold">S/</span>
                          <input type="number" className="bg-transparent border-none text-right text-[11px] font-black text-[var(--color-bcp-blue)] outline-none w-20" value={row.cuotaAct} onChange={e => {
                            const n = [...cargaCrediticia]; n[idx].cuotaAct = e.target.value; setCargaCrediticia(n);
                          }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-surface-50/80 font-black">
                    <td colSpan={5} className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-text-700">% Endeudamiento Total:</td>
                    <td className={`px-6 py-4 text-right text-sm ${calculations.endeudamientoPorc > 40 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {calculations.endeudamientoPorc.toFixed(1)}%
                    </td>
                  </tr>
                  <tr className="bg-white font-black border-t border-surface-100">
                    <td colSpan={5} className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-text-700">
                      <div className="flex items-center justify-end gap-2">
                        <Info size={12} className="text-amber-500" />
                        CEM (CAPACIDAD DE ENDEUDAMIENTO MÁX.):
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-[var(--color-bcp-blue)]">
                      S/ {fmt(calculations.cem)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DETALLES DEL PRÉSTAMO */}
          <div className="premium-card">
            <div className="border-b border-surface-200 pb-4 mb-6">
              <h2 className="text-sm font-black text-text-900 uppercase tracking-widest">
                4. DETALLES DEL PRÉSTAMO
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">MONTO A SOLICITAR</label>
                  <div className="flex items-center bg-[var(--color-surface-50)] border border-[var(--color-surface-200)] rounded-2xl focus-within:ring-2 focus-within:ring-[var(--color-bcp-blue-light)] focus-within:border-[var(--color-bcp-blue)] focus-within:bg-white transition-all overflow-hidden">
                    <span className="pl-4 text-text-500 font-bold text-sm select-none">S/</span>
                    <input type="number" className="bg-transparent border-none py-3 px-2 text-sm font-black text-[var(--color-text-900)] outline-none w-full" value={form.montoSolicitado} onChange={e => setForm({ ...form, montoSolicitado: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">CUOTAS (MESES)</label>
                  <select className="sim-input" value={form.cuotas} onChange={e => setForm({ ...form, cuotas: e.target.value })}>
                    {[12, 24, 36, 48, 60, 72, 84, 96].map(v => <option key={v} value={v}>{v} Meses</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">TEA %</label>
                  <div className="relative group">
                    <input type="number" className="sim-input pr-8" value={form.teaManual} onChange={e => setForm({ ...form, teaManual: e.target.value })} />
                    <span className="absolute right-4 bottom-3 text-text-500 font-bold">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">SEGURO DESGRAVAMEN</label>
                  <select className="sim-input" value={form.tipoDesgravamen} onChange={e => setForm({ ...form, tipoDesgravamen: e.target.value })}>
                    <option value="Individual">Individual</option>
                    <option value="Sin retorno">Sin retorno</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="sim-label">ENVÍO ESTADO CUENTA</label>
                  <div className="flex bg-surface-50 p-1 rounded-xl border border-surface-200">
                    <button onClick={() => setForm({ ...form, envioFisico: false })} className={`flex-1 py-2 text-[10px] font-black rounded-lg ${!form.envioFisico ? 'bg-white shadow text-[var(--color-bcp-blue)]' : 'text-text-500'}`}>VIRTUAL</button>
                    <button onClick={() => setForm({ ...form, envioFisico: true })} className={`flex-1 py-2 text-[10px] font-black rounded-lg ${form.envioFisico ? 'bg-white shadow text-[var(--color-bcp-blue)]' : 'text-text-500'}`}>FÍSICO</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="sim-label">FECHA DESEMBOLSO</label>
                  <input type="date" className="sim-input" value={form.fechaDesembolso} onChange={e => setForm({ ...form, fechaDesembolso: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR DERECHO - RESULTADOS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card !p-0 overflow-hidden shadow-2xl">
            <div className="bg-[var(--color-bcp-blue)] p-6 text-white">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Resultados de Evaluación</span>
              <h3 className="text-lg font-black mt-1">CAPACIDAD DE PAGO</h3>
            </div>
            <div className="p-8 space-y-8">
              <div className="flex flex-col items-center gap-4">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-white shadow-xl transition-all duration-700 ${calculations.dictamen === 'CONTINUAR' ? 'bg-emerald-500 rotate-0' : 'bg-amber-500'
                  }`}>
                  {calculations.dictamen === 'CONTINUAR' ? <BadgeCheck size={52} /> : <Calculator size={52} className="animate-pulse" />}
                </div>
                <div className="text-center">
                  <h4 className={`text-3xl font-black tracking-tighter ${calculations.dictamen === 'CONTINUAR' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {calculations.dictamen}
                  </h4>
                  <p className="sim-label !mb-0 mt-1">Dictamen del Sistema</p>
                </div>
              </div>

              <div className="space-y-6 border-t border-surface-100 pt-8">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="sim-label">Cuota Estimada</span>
                    <span className="text-2xl font-black text-text-900 tracking-tight">S/ {fmt(calculations.cuotaTotal)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="sim-label">CEM Max.</span>
                    <span className="text-lg font-black text-[var(--color-bcp-blue)]">S/ {fmt(calculations.cem)}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-surface-50">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-text-500">TEA Aplicada</span>
                    <span className="text-text-900">{(calculations.tea * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-text-500">TCEA Estimada</span>
                    <span className="text-text-900">{(calculations.tcea * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-text-500">1er Vencimiento</span>
                    <span className="text-[var(--color-bcp-blue)]">{calculations.fechaVenc}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="w-full py-4 bg-surface-50 border-2 border-surface-100 rounded-2xl flex items-center justify-center gap-3 group hover:border-[var(--color-bcp-blue)] hover:bg-[var(--color-bcp-blue)] hover:text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Landmark size={18} className="text-[var(--color-bcp-blue)] group-hover:text-white" />
                <span className="text-[11px] font-black uppercase tracking-widest">Cronograma Oficial</span>
                <ChevronRight size={16} className="text-text-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>

          <div className="premium-card bg-[var(--color-bcp-orange-light)] border-[var(--color-bcp-orange)]/10">
            <div className="flex items-center gap-3 text-[var(--color-bcp-orange)] mb-4">
              <Info size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Nota Legal</span>
            </div>
            <p className="text-[10px] font-bold text-text-700 leading-relaxed uppercase">
              Las cuotas son referenciales, sujetas a calificación y a la fecha de desembolso del crédito y no incluyen ITF.
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <CronogramaModal
          onClose={() => setShowModal(false)}
          cronograma={cronogramaData.cronograma}
          resumen={{
            monto_solicitado: serverSimulation?.resumen?.monto_solicitado ?? Number(form.montoSolicitado),
            tea: serverSimulation?.resumen?.tea ?? calculations.tea,
            tcea: serverSimulation?.resumen?.tcea ?? calculations.tcea,
            total_pagar: cronogramaData.totales.cuota,
            totales_tabla: {
              interes: cronogramaData.totales.interes,
              desgravamen: cronogramaData.totales.desgravamen
            }
          }}
        />
      )}
    </div>
  );
}
