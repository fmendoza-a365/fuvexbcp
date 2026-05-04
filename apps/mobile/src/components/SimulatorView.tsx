import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  Modal, Dimensions, Platform
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DARK_COLORS, API_URL, DESIGN } from '../constants/theme';
import {
  calcCuotaFrancesa,
  generarCronograma, calcTCEA, fmt,
  calcFactorInteresMensualExcel, getTasaDesgravamenMensual, AJUSTE_CUOTA_CRONOGRAMA, getPrimerVencimiento, parseFechaLocal
} from '../utils/simulatorCalc';

interface SimConfig {
  convenios: { id: string; nombre: string; sector: string; variables_reserva: number; rci_default: number; periodo_gracia: number }[];
  cargos: { id: string; nombre: string }[];
  reglas: { convenio_id: string; cargo_id: string; rci_especifico: number; edad_maxima?: number | null }[];
  configuracion: { TEA_DEFAULT: number; COSTO_ENVIO_FISICO: number };
}

interface Props {
  isDark: boolean;
  token: string;
}

let cachedSimulatorConfig: SimConfig | null = null;

const toNum = (value: any) => Number(value) || 0;
const debtRatioFactors = [0.01, 0, 0.035, 0.022, 0, 0.0006944, 0.078, 0.003306];
const debtCemFactors = [0.011, 0.044, 0.024, 0.088, 0.028, 0.000694, 0.007417, 0.007417];
const calcDebtTotals = (rows: Array<{ bcp: string; noBcp: string; saldoAct: string; cuotaAct: string }>) => (
  rows.reduce((acc, row, index) => {
    const bcp = toNum(row.bcp);
    const noBcp = toNum(row.noBcp);
    const saldoAct = toNum(row.saldoAct);
    const cuotaAct = toNum(row.cuotaAct);
    acc.ratio += bcp + noBcp + (saldoAct * (debtRatioFactors[index] || 0));
    acc.cem += bcp + (noBcp || cuotaAct || (saldoAct * (debtCemFactors[index] || 0)));
    return acc;
  }, { ratio: 0, cem: 0 })
);

export default function SimulatorView({ isDark, token }: Props) {
  const theme = isDark ? DARK_COLORS : COLORS;
  const { width } = Dimensions.get('window');
  const isSmall = width < 400;
  const cachedTeaDefault = cachedSimulatorConfig?.configuracion?.TEA_DEFAULT
    ? (cachedSimulatorConfig.configuracion.TEA_DEFAULT * 100).toString()
    : '';

  const [config, setConfig] = useState<SimConfig | null>(cachedSimulatorConfig);
  const [loadingConfig, setLoadingConfig] = useState(!cachedSimulatorConfig);
  const [showCronograma, setShowCronograma] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState('');
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
    teaManual: cachedTeaDefault,
    periodoGracia: '0',
    fechaDesembolso: new Date().toISOString().split('T')[0],
    seguroDesgravamenTipo: 'Individual',
    seguroDesgravamenModalidad: 'Sin Retorno',
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
    if (cachedSimulatorConfig) {
      setConfig(cachedSimulatorConfig);
      setLoadingConfig(false);
      return;
    }

    let mounted = true;

    axios.get(`${API_URL}/simulator/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        cachedSimulatorConfig = res.data;
        if (!mounted) return;
        setConfig(res.data);
        if (res.data.configuracion?.TEA_DEFAULT) {
          setForm(prev => ({ ...prev, teaManual: (res.data.configuracion.TEA_DEFAULT * 100).toString() }));
        }
        setLoadingConfig(false);
      })
      .catch(err => {
        console.error(err);
        if (!mounted) return;
        setLoadingConfig(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

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

  const selectedRegla = useMemo(() =>
    config?.reglas.find(r => r.convenio_id === form.convenioId && r.cargo_id === form.cargoId),
    [form.convenioId, form.cargoId, config]);

  const effectiveRci = selectedRegla?.rci_especifico ?? selectedConvenio?.rci_default ?? 0;

  const calculations = useMemo(() => {
    const rci = effectiveRci;
    const ingresosFijos = toNum(form.ingresosFijos);
    const ingresoVariableMensual = toNum(form.ingresosVariables);
    const promedioVariables = toNum(form.promedioVariables);
    const otrosIngresosFijos = toNum(form.cafae);
    const ingresosNoConstantes = toNum(form.ingresosNoConstantes);
    const descuentosLey = toNum(form.descuentosLey);
    const reserva = toNum(form.reserva);
    const facultativos = toNum(form.facultativos);
    const disponible = selectedConvenio?.nombre === 'U_San_Juan_Bautista'
      ? ingresosFijos * rci
      : (ingresosFijos - ingresoVariableMensual + (promedioVariables * 0.5) + otrosIngresosFijos - ingresosNoConstantes - descuentosLey) * rci;
    const ind = disponible - reserva - facultativos;

    const debtTotals = calcDebtTotals(cargaCrediticia);
    const maxEndeudamiento = selectedConvenio?.nombre === 'UTES_N6'
      ? 0.70
      : ['Marina_de_Guerra', 'Ejército_del_Perú', 'Policia_Nacional_del_Perú', 'DIRIS_Lima_Norte', 'Hospital_de_apoyo_Iquitos', 'DIRIS_Lima_Centro', 'UE403_Morropon', 'Fuerza_Aerea_del_Perú', 'Red_Salud_APLAO'].includes(selectedConvenio?.nombre || '')
        ? 0.65
        : 0.50;
    const baseCem = ingresosFijos - ingresoVariableMensual + promedioVariables + otrosIngresosFijos - ingresosNoConstantes - descuentosLey - facultativos;
    const cem = (baseCem * maxEndeudamiento) - debtTotals.cem;
    const tea = (Number(form.teaManual) || 10.99) / 100;
    const tem = calcFactorInteresMensualExcel(tea);
    const tasaDesgravamenMensual = getTasaDesgravamenMensual(form.seguroDesgravamenTipo, form.seguroDesgravamenModalidad);
    const factorDesgravamen = (tasaDesgravamenMensual * 12 / 365) * 31;
    const n = Number(form.cuotas) || 12;
    const periodoGracia = Number(form.periodoGracia) || selectedConvenio?.periodo_gracia || 0;
    const montoSolicitado = Number(form.montoSolicitado) || 0;
    const capitalFinanciado = montoSolicitado * Math.pow(1 + tem + factorDesgravamen, periodoGracia);
    const capitalBaseCuota = capitalFinanciado + (montoSolicitado * factorDesgravamen * periodoGracia);
    const cuotaBase = calcCuotaFrancesa(capitalBaseCuota, tem + factorDesgravamen, n) + AJUSTE_CUOTA_CRONOGRAMA;
    const desgravamenMensual = montoSolicitado * factorDesgravamen;
    const envioFisicoCosto = form.envioFisico ? (config?.configuracion?.COSTO_ENVIO_FISICO || 10) : 0;
    const cuotaTotal = cuotaBase + envioFisicoCosto;

    const tcea = calcTCEA(montoSolicitado, cuotaTotal, n);

    const fechaDes = parseFechaLocal(form.fechaDesembolso);
    const fechaVenc = getPrimerVencimiento(fechaDes);

    const baseEndeudamiento = ingresosFijos + otrosIngresosFijos - ingresosNoConstantes - descuentosLey - facultativos;
    const endeudamientoPorc = baseEndeudamiento > 0 ? (debtTotals.ratio / baseEndeudamiento) * 100 : 0;
    const dictamen = endeudamientoPorc <= (maxEndeudamiento * 100) ? 'CONTINUAR' : 'SOBRE-ENDEUDADO';
    const totalIngresos = ingresosFijos + otrosIngresosFijos + promedioVariables;

    return {
      ind, cem, cuotaTotal, tea, tcea, dictamen, totalCuotasExternas: debtTotals.cem,
      desgravamenMensual, envioFisicoCosto, totalIngresos, disponible,
      fechaVenc: fechaVenc.toLocaleDateString('es-PE'),
      endeudamientoPorc, tem, tasaDesgravamenMensual
    };
  }, [form, effectiveRci, selectedConvenio, cargaCrediticia, config]);

  const handleSimulate = useCallback(async () => {
    if (!form.convenioId || !form.cargoId) {
      Alert.alert('Atención', 'Por favor complete el perfil del cliente para simular.');
      return;
    }
    setError('');
    setSimulating(true);
    try {
      const payload = {
        convenioId: form.convenioId,
        cargoId: form.cargoId,
        ingresosFijos: Number(form.ingresosFijos),
        ingresosVariables: Number(form.ingresosVariables),
        promedioVariables: Number(form.promedioVariables),
        otrosIngresosFijos: Number(form.cafae),
        ingresosNoConstantes: Number(form.ingresosNoConstantes),
        descuentosLey: Number(form.descuentosLey),
        reserva: Number(form.reserva),
        facultativos: Number(form.facultativos),
        otrosDescuentos: Number(form.facultativos),
        montoSolicitado: Number(form.montoSolicitado),
        cuotas: Number(form.cuotas),
        envioFisico: form.envioFisico,
        teaManual: Number(form.teaManual) ? Number(form.teaManual) / 100 : undefined,
        periodoGracia: Number(form.periodoGracia) || selectedConvenio?.periodo_gracia || 0,
        fechaDesembolso: form.fechaDesembolso,
        seguroDesgravamenTipo: form.seguroDesgravamenTipo,
        seguroDesgravamenModalidad: form.seguroDesgravamenModalidad,
        cargaCrediticia,
        deudaHipotecario: Number(cargaCrediticia[0]?.cuotaAct || cargaCrediticia[0]?.bcp || 0) + Number(cargaCrediticia[0]?.noBcp || 0),
        deudaEfectivo: Number(cargaCrediticia[1]?.cuotaAct || cargaCrediticia[1]?.bcp || 0) + Number(cargaCrediticia[1]?.noBcp || 0),
        deudaVehicular: Number(cargaCrediticia[2]?.cuotaAct || cargaCrediticia[2]?.bcp || 0) + Number(cargaCrediticia[2]?.noBcp || 0),
        deudaPyme: Number(cargaCrediticia[3]?.cuotaAct || cargaCrediticia[3]?.bcp || 0) + Number(cargaCrediticia[3]?.noBcp || 0),
        deudaComercial: Number(cargaCrediticia[4]?.cuotaAct || cargaCrediticia[4]?.bcp || 0) + Number(cargaCrediticia[4]?.noBcp || 0),
        deudaIndirecta: Number(cargaCrediticia[5]?.cuotaAct || cargaCrediticia[5]?.bcp || 0) + Number(cargaCrediticia[5]?.noBcp || 0),
        lineaUtilizadaTC: Number(cargaCrediticia[6]?.cuotaAct || cargaCrediticia[6]?.bcp || 0) + Number(cargaCrediticia[6]?.noBcp || 0),
        lineaNoUtilizadaTC: Number(cargaCrediticia[7]?.cuotaAct || cargaCrediticia[7]?.bcp || 0) + Number(cargaCrediticia[7]?.noBcp || 0)
      };
      const res = await axios.post(`${API_URL}/simulator/calculate`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServerSimulation(res.data);
      setShowCronograma(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'No se pudo ejecutar la simulación.';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSimulating(false);
    }
  }, [form, selectedConvenio, cargaCrediticia, token]);

  const cronogramaData = useMemo(() => {
    if (serverSimulation?.cronograma) {
      return {
        cronograma: serverSimulation.cronograma,
        totales: {
          interes: serverSimulation.resumen?.totales_tabla?.interes || 0,
          desgravamen: serverSimulation.resumen?.totales_tabla?.desgravamen || 0,
          cuota: serverSimulation.resumen?.total_pagar || 0
        }
      };
    }
    return generarCronograma(
      Number(form.montoSolicitado) || 0,
      calculations.tem,
      Number(form.cuotas) || 12,
      parseFechaLocal(form.fechaDesembolso),
      Number(form.periodoGracia) || selectedConvenio?.periodo_gracia || 0,
      calculations.envioFisicoCosto,
      calculations.tasaDesgravamenMensual
    );
  }, [serverSimulation, form, selectedConvenio, calculations]);

  const updateCargaCrediticia = (idx: number, field: string, value: string) => {
    const updated = [...cargaCrediticia];
    (updated[idx] as any)[field] = value;
    setCargaCrediticia(updated);
  };

  if (loadingConfig) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.slate }}>
        <ActivityIndicator size="large" color={theme.blue} />
        <Text style={{ color: theme.subtext, fontWeight: '900', fontSize: 10, letterSpacing: 2, marginTop: 16 }}>
          CARGANDO MOTOR BCP...
        </Text>
      </View>
    );
  }

  const selectOptions = (items: any[], labelKey = 'nombre') => {
    return items.map(item => ({ label: item[labelKey], value: item.id }));
  };

  const sectors = config ? Array.from(new Set(config.convenios.map(c => c.sector))) : [];
  const conveniosFiltered = config?.convenios.filter(c => !form.sector || c.sector === form.sector) || [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.slate }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 108 }}>
        
        {/* HEADER */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginTop: 8,
          marginBottom: 16,
          backgroundColor: theme.white,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: DESIGN.radius.lg,
          padding: 16,
          shadowColor: '#0F172A',
          shadowOpacity: isDark ? 0.22 : 0.07,
          shadowRadius: 18,
          elevation: 3
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: theme.blueDark, letterSpacing: 0, textTransform: 'uppercase' }}>
              SIMULADOR{' '}
              <Text style={{ color: theme.text }}>BCP PREMIUM</Text>
            </Text>
            <Text style={{ fontSize: 12, color: theme.subtext, fontWeight: '600', marginTop: 4 }}>
              Evaluación de Riesgo y Capacidad de Pago
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSimulate}
            disabled={simulating}
            style={{
              backgroundColor: theme.orange,
              paddingHorizontal: 16, paddingVertical: 13,
              borderRadius: DESIGN.radius.md, flexDirection: 'row', alignItems: 'center', gap: 8,
              opacity: simulating ? 0.6 : 1,
              shadowColor: theme.orange, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
            }}
          >
            <Ionicons name="flash" size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 }}>
              {simulating ? 'SIMULANDO...' : 'SIMULAR'}
            </Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={{
            backgroundColor: theme.roseSoft,
            borderWidth: 1, borderColor: isDark ? '#4a1515' : '#fecdd3',
            padding: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16
          }}>
            <Ionicons name="shield" size={18} color={theme.rose} />
            <Text style={{ color: theme.rose, fontSize: 11, fontWeight: '900', flex: 1, letterSpacing: 0.5 }}>{error}</Text>
          </View>
        ) : null}

        {/* 1. PERFIL DEL CLIENTE */}
        <Card theme={theme} isDark={isDark} title="1. PERFIL DEL CLIENTE">
          <Text style={labelStyle(theme)}>SECTOR</Text>
          <View style={pickerContainerStyle(theme, isDark)}>
            <PickerField
              theme={theme} isDark={isDark}
              selectedValue={form.sector}
              onValueChange={(v: string) => setForm({ ...form, sector: v, convenioId: '', cargoId: '' })}
              options={[{ label: 'Todos los sectores', value: '' }, ...sectors.map(s => ({ label: s, value: s }))]}
            />
          </View>

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>CONVENIO</Text>
          <View style={pickerContainerStyle(theme, isDark)}>
            <PickerField
              theme={theme} isDark={isDark}
              selectedValue={form.convenioId}
              onValueChange={(v: string) => setForm({ ...form, convenioId: v, cargoId: '' })}
              options={[{ label: 'Seleccionar Convenio', value: '' }, ...conveniosFiltered.map(c => ({ label: c.nombre, value: c.id }))]}
            />
          </View>

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>CARGO</Text>
          <View style={pickerContainerStyle(theme, isDark)}>
            <PickerField
              theme={theme} isDark={isDark}
              selectedValue={form.cargoId}
              onValueChange={(v: string) => setForm({ ...form, cargoId: v })}
              options={[{ label: 'Seleccionar Cargo', value: '' }, ...selectOptions(filteredCargos)]}
            />
          </View>

          {/* RCI Display */}
          <View style={{
            flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
            borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginTop: 16, gap: 8
          }}>
            <Text style={[labelStyle(theme), { marginBottom: 0 }]}>RCI</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: theme.blue }}>
                {(effectiveRci * 100).toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 8, fontWeight: '900', color: theme.subtext, letterSpacing: 0.6 }}>
                {selectedRegla ? 'CONVENIO + CARGO' : 'BASE CONVENIO'}
              </Text>
            </View>
          </View>
        </Card>

        {/* 2. INGRESOS MENSUALES */}
        <Card theme={theme} isDark={isDark} title="2. INGRESOS MENSUALES">
          <SimInput label="REMUNERACIÓN FIJA" value={form.ingresosFijos} onChange={(v: string) => setForm({ ...form, ingresosFijos: v })} theme={theme} isDark={isDark} />
          <SimInput label="BONOS / VARIABLES" value={form.ingresosVariables} onChange={(v: string) => setForm({ ...form, ingresosVariables: v })} theme={theme} isDark={isDark} />
          <SimInput label="PROMEDIO VARIABLES (3 ÚLT. MESES)" value={form.promedioVariables} onChange={(v: string) => setForm({ ...form, promedioVariables: v })} theme={theme} isDark={isDark} />
          <SimInput label="OTROS INGRESOS FIJOS (CAFAE)" value={form.cafae} onChange={(v: string) => setForm({ ...form, cafae: v })} theme={theme} isDark={isDark} />
          <SimInput label="INGRESOS NO CONSTANTES" value={form.ingresosNoConstantes} onChange={(v: string) => setForm({ ...form, ingresosNoConstantes: v })} theme={theme} isDark={isDark} />
          
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: theme.emeraldSoft, padding: 14, borderRadius: 10, marginTop: 8
          }}>
            <Text style={[labelStyle(theme), { marginBottom: 0 }]}>TOTAL INGRESOS</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.emerald }}>
              S/ {fmt(calculations.totalIngresos)}
            </Text>
          </View>
        </Card>

        {/* DESCUENTOS Y DISPONIBLE */}
        <Card theme={theme} isDark={isDark} title="DESCUENTOS Y DISPONIBLE">
          <SimInput label="SUMATORIA DESCUENTOS DE LEY" value={form.descuentosLey} onChange={(v: string) => setForm({ ...form, descuentosLey: v })} theme={theme} isDark={isDark} />
          <SimInput label="RESERVA" value={form.reserva} onChange={(v: string) => setForm({ ...form, reserva: v })} theme={theme} isDark={isDark} />
          <SimInput label="SUMATORIA DE FACULTATIVOS" value={form.facultativos} onChange={(v: string) => setForm({ ...form, facultativos: v })} theme={theme} isDark={isDark} />
          
          <View style={{
            backgroundColor: theme.blueDark, padding: 14, borderRadius: 10, marginTop: 8,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            shadowColor: theme.blueDark, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4
          }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', flex: 1 }}>
              INGRESO NETO DISPONIBLE (IND)
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: 'white' }}>
              S/ {fmt(calculations.ind)}
            </Text>
          </View>
        </Card>

        {/* 3. DEUDAS EXTERNAS (RCC) */}
        <Card theme={theme} isDark={isDark} title="3. DEUDAS EXTERNAS (RCC)" noPadding>
          {/* Table Header */}
          <View style={{
            flexDirection: 'row', backgroundColor: theme.input,
            paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.border
          }}>
            <Text style={{ flex: 2, fontSize: 8, fontWeight: '900', color: theme.subtext, letterSpacing: 0.5 }}>DEUDA</Text>
            <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: theme.subtext, textAlign: 'center', letterSpacing: 0.5 }}>BCP</Text>
            <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: theme.subtext, textAlign: 'center', letterSpacing: 0.5 }}>NO BCP</Text>
            <Text style={{ flex: 1.2, fontSize: 8, fontWeight: '900', color: theme.subtext, textAlign: 'right', letterSpacing: 0.5 }}>CUOTA ACT.</Text>
          </View>

          {cargaCrediticia.map((row, idx) => (
            <View key={idx} style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 6, paddingHorizontal: 12,
              borderBottomWidth: idx < cargaCrediticia.length - 1 ? 1 : 0,
              borderBottomColor: theme.divider
            }}>
              <Text style={{ flex: 2, fontSize: 10, fontWeight: '800', color: theme.text, textTransform: 'uppercase' }}>
                {row.tipo}
              </Text>
              <View style={{ flex: 1, marginHorizontal: 3 }}>
                <TextInput
                  style={{
                    backgroundColor: theme.input,
                    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
                    padding: 6, fontSize: 10, fontWeight: '800', color: theme.text,
                    textAlign: 'center'
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.subtext}
                  value={row.bcp}
                  onChangeText={(v) => updateCargaCrediticia(idx, 'bcp', v)}
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: 3 }}>
                <TextInput
                  style={{
                    backgroundColor: theme.input,
                    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
                    padding: 6, fontSize: 10, fontWeight: '800', color: theme.text,
                    textAlign: 'center'
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.subtext}
                  value={row.noBcp}
                  onChangeText={(v) => updateCargaCrediticia(idx, 'noBcp', v)}
                />
              </View>
              <View style={{ flex: 1.2, marginLeft: 6 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
                  backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(0,42,141,0.05)',
                  paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8
                }}>
                  <Text style={{ fontSize: 9, color: theme.subtext, fontWeight: '700', marginRight: 3 }}>S/</Text>
                  <TextInput
                    style={{
                      fontSize: 10, fontWeight: '900', color: theme.blue,
                      textAlign: 'right', minWidth: 50, padding: 0
                    }}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={theme.subtext}
                    value={row.cuotaAct}
                    onChangeText={(v) => updateCargaCrediticia(idx, 'cuotaAct', v)}
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Totales */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: theme.border,
            backgroundColor: theme.input
          }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: theme.subtext, letterSpacing: 0.5 }}>
              % ENDEUDAMIENTO:
            </Text>
            <Text style={{
              fontSize: 14, fontWeight: '900',
              color: calculations.endeudamientoPorc > 40 ? theme.rose : theme.emerald
            }}>
              {calculations.endeudamientoPorc.toFixed(1)}%
            </Text>
          </View>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: theme.border
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="information-circle" size={14} color={theme.amber} />
              <Text style={{ fontSize: 9, fontWeight: '900', color: theme.subtext, letterSpacing: 0.5 }}>
                CEM (CAP. ENDEUDAMIENTO MÁX.)
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '900', color: theme.blue }}>
              S/ {fmt(calculations.cem)}
            </Text>
          </View>
        </Card>

        {/* 4. DETALLES DEL PRÉSTAMO */}
        <Card theme={theme} isDark={isDark} title="4. DETALLES DEL PRÉSTAMO">
          <SimInput label="MONTO A SOLICITAR" value={form.montoSolicitado} onChange={(v: string) => setForm({ ...form, montoSolicitado: v })} theme={theme} isDark={isDark} />
          
          <Text style={[labelStyle(theme), { marginTop: 12 }]}>CUOTAS (MESES)</Text>
          <View style={pickerContainerStyle(theme, isDark)}>
            <PickerField
              theme={theme} isDark={isDark}
              selectedValue={form.cuotas}
              onValueChange={(v: string) => setForm({ ...form, cuotas: v })}
              options={[12, 24, 36, 48, 60, 72, 84, 96].map(v => ({ label: `${v} Meses`, value: String(v) }))}
            />
          </View>

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>TEA %</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: theme.input,
            borderWidth: 1, borderColor: theme.border, borderRadius: 10, overflow: 'hidden'
          }}>
            <TextInput
              style={{
                flex: 1, padding: 14, fontSize: 14, fontWeight: '800', color: theme.text
              }}
              keyboardType="numeric"
              value={form.teaManual}
              onChangeText={(v) => setForm({ ...form, teaManual: v })}
            />
            <Text style={{ paddingRight: 14, fontSize: 14, fontWeight: '700', color: theme.subtext }}>%</Text>
          </View>

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>TIPO DE SEGURO</Text>
          <View style={pickerContainerStyle(theme, isDark)}>
            <PickerField
              theme={theme} isDark={isDark}
              selectedValue={form.seguroDesgravamenTipo}
              onValueChange={(v: string) => setForm({ ...form, seguroDesgravamenTipo: v })}
              options={[{ label: 'Individual', value: 'Individual' }, { label: 'Endosado', value: 'Endosado' }]}
            />
          </View>

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>MODALIDAD DESGRAVAMEN</Text>
          <View style={pickerContainerStyle(theme, isDark)}>
            <PickerField
              theme={theme} isDark={isDark}
              selectedValue={form.seguroDesgravamenModalidad}
              onValueChange={(v: string) => setForm({ ...form, seguroDesgravamenModalidad: v })}
              options={[{ label: 'Sin Retorno', value: 'Sin Retorno' }, { label: 'Con Retorno', value: 'Con Retorno' }]}
            />
          </View>

          {/* Envío Estado Cuenta */}
          <Text style={[labelStyle(theme), { marginTop: 12 }]}>ENVÍO ESTADO CUENTA</Text>
          <View style={{
            flexDirection: 'row', backgroundColor: theme.input,
            borderRadius: 10, padding: 4, borderWidth: 1, borderColor: theme.border
          }}>
            {['VIRTUAL', 'FÍSICO'].map((opt, i) => {
              const isPhysic = i === 1;
              const active = form.envioFisico === isPhysic;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setForm({ ...form, envioFisico: isPhysic })}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                    backgroundColor: active ? theme.white : 'transparent',
                    shadowColor: active ? '#000' : 'transparent',
                    shadowOpacity: active ? 0.1 : 0, shadowRadius: 4, elevation: active ? 2 : 0
                  }}
                >
                  <Text style={{
                    fontSize: 10, fontWeight: '900', letterSpacing: 0.5,
                    color: active ? theme.blue : theme.subtext
                  }}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>FECHA DESEMBOLSO</Text>
          <TextInput
            style={inputStyle(theme, isDark)}
            value={form.fechaDesembolso}
            onChangeText={(v) => setForm({ ...form, fechaDesembolso: v })}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.subtext}
          />

          <Text style={[labelStyle(theme), { marginTop: 12 }]}>PERÍODO DE GRACIA (MESES)</Text>
          <TextInput
            style={inputStyle(theme, isDark)}
            keyboardType="numeric"
            value={form.periodoGracia}
            onChangeText={(v) => setForm({ ...form, periodoGracia: v })}
            placeholder="0"
            placeholderTextColor={theme.subtext}
          />
        </Card>

        {/* RESULTADOS */}
        <View style={{
          backgroundColor: theme.white, borderRadius: DESIGN.radius.lg, overflow: 'hidden',
          borderWidth: 1, borderColor: theme.border, marginBottom: 20,
          shadowColor: '#0F172A', shadowOpacity: isDark ? 0.24 : 0.08, shadowRadius: 20, elevation: 5
        }}>
          <View style={{ backgroundColor: theme.blueDark, padding: 18 }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Resultados de Evaluación
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: 'white', marginTop: 4 }}>
              CAPACIDAD DE PAGO
            </Text>
          </View>
          <View style={{ padding: 20 }}>
            {/* Dictamen */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{
                width: 76, height: 76, borderRadius: 12,
                backgroundColor: calculations.dictamen === 'CONTINUAR' ? theme.emerald : theme.amber,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: calculations.dictamen === 'CONTINUAR' ? theme.emerald : theme.amber,
                shadowOpacity: 0.4, shadowRadius: 15, elevation: 6,
                marginBottom: 12
              }}>
                <Ionicons
                  name={calculations.dictamen === 'CONTINUAR' ? 'checkmark-circle' : 'calculator'}
                  size={42} color="white"
                />
              </View>
              <Text style={{
                fontSize: 28, fontWeight: '900', letterSpacing: 0,
                color: calculations.dictamen === 'CONTINUAR' ? theme.emerald : theme.amber
              }}>
                {calculations.dictamen}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '900', color: theme.subtext, letterSpacing: 0.5, marginTop: 4 }}>
                Dictamen del Sistema
              </Text>
            </View>

            {/* Cuota vs CEM */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
              borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 20, marginBottom: 16
            }}>
              <View>
                <Text style={labelStyle(theme)}>Cuota Estimada</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>
                  S/ {fmt(calculations.cuotaTotal)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={labelStyle(theme)}>CEM Max.</Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: theme.blue }}>
                  S/ {fmt(calculations.cem)}
                </Text>
              </View>
            </View>

            {/* Detalles */}
            <View style={{ borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: 16, gap: 10 }}>
              <DetailRow label="TEA Aplicada" value={`${(calculations.tea * 100).toFixed(2)}%`} theme={theme} />
              <DetailRow label="TCEA Estimada" value={`${(calculations.tcea * 100).toFixed(2)}%`} theme={theme} />
              <DetailRow label="1er Vencimiento" value={calculations.fechaVenc} theme={theme} isBlue />
              <DetailRow label="Desgravamen Mensual" value={`S/ ${fmt(calculations.desgravamenMensual)}`} theme={theme} />
              {calculations.envioFisicoCosto > 0 && (
                <DetailRow label="Envío Físico" value={`S/ ${fmt(calculations.envioFisicoCosto)}`} theme={theme} />
              )}
            </View>

            {/* Cronograma Button */}
            <TouchableOpacity
              onPress={handleSimulate}
              disabled={simulating}
              style={{
                marginTop: 20, backgroundColor: theme.input,
                borderWidth: 1, borderColor: theme.border, borderRadius: 10,
                paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: simulating ? 0.6 : 1
              }}
            >
              <Ionicons name="business" size={16} color={theme.blue} />
              <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', color: theme.blue }}>
                CRONOGRAMA OFICIAL
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Nota Legal */}
        <View style={{
          backgroundColor: theme.orangeSoft,
          borderWidth: 1, borderColor: isDark ? 'rgba(255,120,0,0.15)' : '#fed7aa',
          borderRadius: 12, padding: 16, marginBottom: 20
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="information-circle" size={16} color={theme.orange} />
            <Text style={{ fontSize: 9, fontWeight: '900', color: theme.orange, letterSpacing: 1, textTransform: 'uppercase' }}>
              Nota Legal
            </Text>
          </View>
          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext, lineHeight: 16 }}>
            Las cuotas son referenciales, sujetas a calificación y a la fecha de desembolso del crédito y no incluyen ITF.
          </Text>
        </View>

      </ScrollView>

      {/* CRONOGRAMA MODAL */}
      <Modal visible={showCronograma} animationType="slide" onRequestClose={() => setShowCronograma(false)}>
        <View style={{ flex: 1, backgroundColor: theme.slate, paddingTop: Platform.OS === 'android' ? 40 : 50 }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 20, marginBottom: 16
          }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.blueDark, letterSpacing: 0 }}>
              CRONOGRAMA DE PAGOS
            </Text>
            <TouchableOpacity
              onPress={() => setShowCronograma(false)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: theme.white,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3
              }}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {/* Resumen */}
            <View style={{
              backgroundColor: theme.white, borderRadius: 12, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: theme.border
            }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: theme.blueDark, letterSpacing: 0.8, marginBottom: 12 }}>
                RESUMEN
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
                <MiniStat label="Monto" value={`S/ ${fmt(Number(form.montoSolicitado))}`} theme={theme} />
                <MiniStat label="TEA" value={`${(calculations.tea * 100).toFixed(2)}%`} theme={theme} />
                <MiniStat label="TCEA" value={`${(calculations.tcea * 100).toFixed(2)}%`} theme={theme} />
                <MiniStat label="Total Intereses" value={`S/ ${fmt(cronogramaData.totales.interes)}`} theme={theme} />
                <MiniStat label="Total Desgrav." value={`S/ ${fmt(cronogramaData.totales.desgravamen)}`} theme={theme} />
                <MiniStat label="Total a Pagar" value={`S/ ${fmt(cronogramaData.totales.cuota)}`} theme={theme} isHighlight />
              </View>
            </View>

            {/* Cronograma Table */}
            <View style={{
              backgroundColor: theme.white, borderRadius: 12, overflow: 'hidden',
              borderWidth: 1, borderColor: theme.border
            }}>
              {/* Header */}
              <View style={{
                flexDirection: 'row', backgroundColor: theme.blueDark,
                paddingVertical: 10, paddingHorizontal: 8
              }}>
                <Text style={{ width: 28, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'center' }}>N°</Text>
                <Text style={{ flex: 1.2, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'center' }}>FECHA</Text>
                <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'right' }}>CAPITAL</Text>
                <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'right' }}>INTERÉS</Text>
                <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'right' }}>DESGR.</Text>
                <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'right' }}>CUOTA</Text>
                <Text style={{ flex: 1, fontSize: 8, fontWeight: '900', color: 'white', textAlign: 'right' }}>SALDO</Text>
              </View>

              {cronogramaData.cronograma.map((row: any, idx: number) => (
                <View key={idx} style={{
                  flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8,
                  backgroundColor: idx % 2 === 0 ? theme.white : theme.input,
                  borderBottomWidth: idx < cronogramaData.cronograma.length - 1 ? 1 : 0,
                  borderBottomColor: theme.divider
                }}>
                  <Text style={{ width: 28, fontSize: 9, fontWeight: '800', color: theme.text, textAlign: 'center' }}>{row.nro}</Text>
                  <Text style={{ flex: 1.2, fontSize: 8, color: theme.subtext, textAlign: 'center' }}>{row.fecha}</Text>
                  <Text style={{ flex: 1, fontSize: 8, color: theme.text, textAlign: 'right' }}>{row.capital ? Number(row.capital).toFixed(2) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, color: theme.text, textAlign: 'right' }}>{row.interes ? Number(row.interes).toFixed(2) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, color: theme.text, textAlign: 'right' }}>{row.desgravamen ? Number(row.desgravamen).toFixed(2) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 9, fontWeight: '900', color: theme.blue, textAlign: 'right' }}>{row.cuotaTotal ? Number(row.cuotaTotal).toFixed(2) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, color: theme.subtext, textAlign: 'right' }}>{row.saldo ? Number(row.saldo).toFixed(2) : '-'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Helper Components ──

function Card({ theme, isDark, title, children, noPadding }: any) {
  return (
    <View style={{
      backgroundColor: theme.white, borderRadius: DESIGN.radius.lg, marginBottom: 16,
      shadowColor: '#0F172A', shadowOpacity: isDark ? 0.22 : 0.07, shadowRadius: 18, elevation: 3,
      borderWidth: 1, borderColor: theme.border,
      padding: noPadding ? 0 : 20
    }}>
      <View style={{
        borderBottomWidth: noPadding ? 1 : 0, borderBottomColor: theme.border,
        paddingBottom: noPadding ? 12 : 0, marginBottom: noPadding ? 0 : 0,
        padding: noPadding ? 16 : 0
      }}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: theme.text, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {title}
        </Text>
      </View>
      {noPadding ? children : <View style={{ marginTop: 16 }}>{children}</View>}
    </View>
  );
}

function SimInput({ label, value, onChange, theme, isDark }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={labelStyle(theme)}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.input,
        borderWidth: 1, borderColor: theme.border, borderRadius: 10, overflow: 'hidden'
      }}>
        <Text style={{ paddingLeft: 14, fontSize: 13, fontWeight: '700', color: theme.subtext }}>S/</Text>
        <TextInput
          style={{ flex: 1, padding: 14, fontSize: 14, fontWeight: '800', color: theme.text }}
          keyboardType="numeric"
          value={value}
          onChangeText={onChange}
          placeholder="0.00"
          placeholderTextColor={theme.subtext}
        />
      </View>
    </View>
  );
}

function PickerField({ theme, isDark, selectedValue, onValueChange, options }: any) {
  return (
    <ScrollView horizontal={false} style={{ maxHeight: 200 }}>
      {options.map((opt: any) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onValueChange(opt.value)}
          style={{
            paddingVertical: 10, paddingHorizontal: 14,
            backgroundColor: selectedValue === opt.value
              ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(0,42,141,0.08)')
              : 'transparent',
            borderRadius: 8, marginBottom: 2
          }}
        >
          <Text style={{
            fontSize: 13, fontWeight: selectedValue === opt.value ? '800' : '500',
            color: selectedValue === opt.value ? theme.blue : theme.text
          }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function DetailRow({ label, value, theme, isBlue }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.subtext }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color: isBlue ? theme.blue : theme.text }}>{value}</Text>
    </View>
  );
}

function MiniStat({ label, value, theme, isHighlight }: any) {
  return (
    <View style={{ width: '47%', marginBottom: 8 }}>
      <Text style={{ fontSize: 8, fontWeight: '900', color: theme.subtext, letterSpacing: 0.5, marginBottom: 3 }}>{label}</Text>
      <Text style={{
        fontSize: isHighlight ? 14 : 12,
        fontWeight: '900',
        color: isHighlight ? theme.orange : theme.text
      }}>{value}</Text>
    </View>
  );
}

const labelStyle = (theme: any) => ({
  fontSize: 9, fontWeight: '900' as const, color: theme.subtext, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const
});

const inputStyle = (theme: any, isDark: boolean) => ({
  backgroundColor: theme.input,
  borderWidth: 1, borderColor: theme.border, borderRadius: 10,
  padding: 14, fontSize: 14, fontWeight: '800' as const, color: theme.text
});

const pickerContainerStyle = (theme: any, isDark: boolean) => ({
  backgroundColor: theme.input,
  borderWidth: 1, borderColor: theme.border, borderRadius: 10,
  overflow: 'hidden' as const, maxHeight: 150
});

