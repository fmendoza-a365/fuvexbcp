import React, { useState, useEffect, useMemo } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  useColorScheme,
  AppState,
  BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import CustomPicker from './src/components/CustomPicker';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, DARK_COLORS, API_URL, CONVENIOS } from './src/constants/theme';
import { createStyles } from './src/styles/global';
import { LoginView } from './src/components/LoginView';
import SimulatorView from './src/components/SimulatorView';
import ExpedienteDetail from './src/components/ExpedienteDetail';
import {
  registerForPushNotifications,
  unregisterPushToken,
  checkPushTokenStatus,
  addNotificationReceivedListener,
  addNotificationResponseListener
} from './src/services/pushService';
import api, { setApiBaseUrl, setAuthToken } from './src/api/client';
import { loadSavedApiUrl } from './src/config/api';

interface SimulatorCatalog {
  convenios: Array<{
    id: string;
    nombre: string;
    sector?: string;
    rci_default?: number;
    periodo_gracia?: number;
    variables_reserva?: number;
  }>;
  cargos: Array<{ id: string; nombre: string }>;
  reglas: Array<{
    convenio_id: string;
    cargo_id: string;
    rci_especifico?: number;
    edad_maxima?: number | null;
  }>;
}

interface GeoDepartamento {
  id: number;
  departamento: string;
  ubigeo: string;
}

interface GeoProvincia {
  id: number;
  provincia: string;
  ubigeo: string;
  departamento_id: number;
}

interface GeoDistrito {
  id: number;
  distrito: string;
  ubigeo: string;
  provincia_id: number;
  departamento_id: number;
}

type ActiveTab = 'home' | 'list' | 'form' | 'simulator' | 'alerts';

const EMAIL_DOMAIN_OPTIONS = ['gmail.com', 'outlook.com', 'yahoo.com'];
const ESTADO_CIVIL_OPTIONS = [
  { label: 'Seleccionar estado civil...', value: '' },
  { label: 'Soltero/a', value: 'SOLTERO' },
  { label: 'Casado/a', value: 'CASADO' },
  { label: 'Conviviente', value: 'CONVIVIENTE' },
  { label: 'Divorciado/a', value: 'DIVORCIADO' },
  { label: 'Viudo/a', value: 'VIUDO' },
];

const onlyDigits = (value: string, maxLength: number) => value.replace(/\D/g, '').slice(0, maxLength);

const getEmailLocalPart = (value: string) => value
  .split('@')[0]
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._%+-]/g, '');

const isValidPeruMobile = (value: string) => /^9\d{8}$/.test(value);

const isValidPeruPhone = (value: string) => {
  if (!value) return true;
  return /^\d{6,9}$/.test(value);
};

const isValidEmail = (value: string) => {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
};

const requiresSpouseEvaluation = (value: string) => ['CASADO', 'CASADA', 'CONVIVIENTE'].includes(value);

const normalizeSalesResponse = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(isDark);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState(API_URL);
  const [apiReady, setApiReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [calculatorSale, setCalculatorSale] = useState<any | null>(null);

  const [mySales, setMySales] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [operations, setOperations] = useState<any>(null);
  const [rankings, setRankings] = useState<any>(null);
  const [dashboardView, setDashboardView] = useState<'general' | 'equipos' | 'zonas' | 'embudo'>('general');
  const [pushStatus, setPushStatus] = useState<{ has_token: boolean; token_preview: string | null } | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [plaza, setPlaza] = useState('');
  const [sectorLaboral, setSectorLaboral] = useState('');
  const [convenio, setConvenio] = useState('');
  const [convenioOptions, setConvenioOptions] = useState(CONVENIOS);
  const [simulatorCatalog, setSimulatorCatalog] = useState<SimulatorCatalog | null>(null);
  const [maf, setMaf] = useState('');
  const [celular, setCelular] = useState('');
  const [telefonoAlt, setTelefonoAlt] = useState('');
  const [correo, setCorreo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [conyugeDni, setConyugeDni] = useState('');
  const [conyugeNombres, setConyugeNombres] = useState('');
  const [direccion, setDireccion] = useState('');
  const [departamento, setDepartamento] = useState('LIMA');
  const [provincia, setProvincia] = useState('');
  const [distrito, setDistrito] = useState('');
  const [zonaComercial, setZonaComercial] = useState('');
  const [departamentoOptions, setDepartamentoOptions] = useState<GeoDepartamento[]>([]);
  const [provinciaOptions, setProvinciaOptions] = useState<GeoProvincia[]>([]);
  const [distritoOptions, setDistritoOptions] = useState<GeoDistrito[]>([]);
  const [cargoLaboral, setCargoLaboral] = useState('');
  const [plazoDeseado, setPlazoDeseado] = useState('');
  const [origenProspecto, setOrigenProspecto] = useState('Prospeccion directa');
  const [consentimiento, setConsentimiento] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [clientAge, setClientAge] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [isSearchingDni, setIsSearchingDni] = useState(false);
  const [isSearchingConyugeDni, setIsSearchingConyugeDni] = useState(false);
  const canViewLeadershipDashboard = ['SUPERADMIN', 'GERENTE', 'JEFE_ZONAL', 'SUPERVISOR'].includes(user?.role);

  useEffect(() => {
    let mounted = true;

    loadSavedApiUrl()
      .then((resolvedUrl) => {
        setApiBaseUrl(resolvedUrl);
        if (!mounted) return;
        setApiUrl(resolvedUrl);
      })
      .catch(() => {
        setApiBaseUrl(API_URL);
        if (!mounted) return;
        setApiUrl(API_URL);
      })
      .finally(() => {
        if (mounted) setApiReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const fetchDniInfo = async (id: string) => {
    setIsSearchingDni(true);
    setClientAge(null);
    setClientData(null);
    try {
      const res = await axios.get(`${apiUrl}/dni/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setClientData(res.data);
        if (res.data.edad) setClientAge(res.data.edad);
        if (res.data.nombre_completo) setNombres(res.data.nombre_completo);
      }
    } catch (e) {
      console.log('DNI not found or error');
    } finally {
      setIsSearchingDni(false);
    }
  };

  const fetchConyugeDniInfo = async (id: string) => {
    setIsSearchingConyugeDni(true);
    try {
      const res = await axios.get(`${apiUrl}/dni/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.nombre_completo) {
        setConyugeNombres(res.data.nombre_completo);
      }
    } catch (e) {
      console.log('Spouse DNI not found or error');
    } finally {
      setIsSearchingConyugeDni(false);
    }
  };

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [salesRes, kpiRes, operationsRes, rankingsRes] = await Promise.all([
        axios.get(`${apiUrl}/sales`, { headers }),
        axios.get(`${apiUrl}/analytics/dashboard`, { headers }),
        canViewLeadershipDashboard
          ? axios.get(`${apiUrl}/analytics/operations`, { headers }).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
        canViewLeadershipDashboard
          ? axios.get(`${apiUrl}/analytics/rankings`, { headers }).catch(() => ({ data: null }))
          : Promise.resolve({ data: null })
      ]);
      setMySales(normalizeSalesResponse(salesRes.data));
      setKpi(kpiRes.data);
      setOperations(operationsRes.data);
      setRankings(rankingsRes.data);
    } catch (error) {
      console.warn('Fetch error:', error);
    }
  };

  const fetchConvenios = async () => {
    if (!token) return;

    try {
      const res = await axios.get(`${apiUrl}/simulator/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const convenios = Array.isArray(res.data?.convenios) ? res.data.convenios : [];
      setSimulatorCatalog({
        convenios,
        cargos: Array.isArray(res.data?.cargos) ? res.data.cargos : [],
        reglas: Array.isArray(res.data?.reglas) ? res.data.reglas : []
      });
      const options = convenios
        .filter((item: any) => item?.nombre)
        .sort((a: any, b: any) => String(a.nombre).localeCompare(String(b.nombre)))
        .map((item: any) => ({ label: item.nombre, value: item.nombre }));

      setConvenioOptions([
        { label: 'Seleccionar Convenio...', value: '' },
        ...(options.length > 0 ? options : CONVENIOS.slice(1))
      ]);
    } catch (error) {
      console.warn('Convenios fetch error:', error);
      setSimulatorCatalog(null);
      setConvenioOptions(CONVENIOS);
    }
  };

  const selectedConvenio = useMemo(() => (
    simulatorCatalog?.convenios.find(item => item.nombre === convenio) || null
  ), [simulatorCatalog, convenio]);

  const sectorOptions = useMemo(() => {
    if (!simulatorCatalog) return [];
    return Array.from(new Set(
      simulatorCatalog.convenios
        .map(item => item.sector || 'Otros')
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  }, [simulatorCatalog]);

  const filteredConvenioOptions = useMemo(() => {
    if (!simulatorCatalog) return convenioOptions;

    const rows = simulatorCatalog.convenios
      .filter(item => !sectorLaboral || (item.sector || 'Otros') === sectorLaboral)
      .filter(item => item?.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(item => ({ label: item.nombre, value: item.nombre }));

    return [
      { label: sectorLaboral ? 'Seleccionar convenio...' : 'Primero selecciona sector', value: '' },
      ...rows
    ];
  }, [simulatorCatalog, sectorLaboral, convenioOptions]);

  const cargoOptions = useMemo(() => {
    if (!simulatorCatalog || !selectedConvenio) return [];

    const validCargoIds = new Set(
      simulatorCatalog.reglas
        .filter(regla => regla.convenio_id === selectedConvenio.id)
        .map(regla => regla.cargo_id)
    );

    return simulatorCatalog.cargos
      .filter(cargo => validCargoIds.has(cargo.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [simulatorCatalog, selectedConvenio]);

  const handleSectorChange = (value: string) => {
    setSectorLaboral(value);
    setConvenio('');
    setCargoLaboral('');
  };

  const handleConvenioChange = (value: string) => {
    const selected = simulatorCatalog?.convenios.find(item => item.nombre === value);
    if (selected?.sector && !sectorLaboral) {
      setSectorLaboral(selected.sector);
    }
    setConvenio(value);
    setCargoLaboral('');
  };

  const applyEmailDomain = (domainValue: string) => {
    const localPart = getEmailLocalPart(correo);
    const domain = domainValue.trim().toLowerCase().replace(/^@+/, '');

    if (!localPart) {
      Alert.alert('Correo incompleto', 'Primero escribe el usuario del correo antes del @.');
      return;
    }

    setCorreo(`${localPart}@${domain}`);
  };

  const fetchDepartamentos = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${apiUrl}/geo/departamentos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setDepartamentoOptions(rows);

      if (!departamento && rows.length > 0) {
        setDepartamento(rows[0].departamento);
      }
    } catch (error) {
      console.warn('Geo departamentos error:', error);
    }
  };

  const fetchProvincias = async (departamentoValue: string) => {
    if (!token || !departamentoValue) return;
    try {
      const res = await axios.get(`${apiUrl}/geo/provincias`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { departamento: departamentoValue }
      });
      setProvinciaOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.warn('Geo provincias error:', error);
      setProvinciaOptions([]);
    }
  };

  const fetchDistritos = async (departamentoValue: string, provinciaValue: string) => {
    if (!token || !departamentoValue || !provinciaValue) return;
    try {
      const res = await axios.get(`${apiUrl}/geo/distritos`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { departamento: departamentoValue, provincia: provinciaValue }
      });
      setDistritoOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.warn('Geo distritos error:', error);
      setDistritoOptions([]);
    }
  };

  const handleDepartamentoChange = (value: string) => {
    setDepartamento(value);
    setProvincia('');
    setDistrito('');
    setZonaComercial('');
    setProvinciaOptions([]);
    setDistritoOptions([]);
    fetchProvincias(value);
  };

  const handleProvinciaChange = (value: string) => {
    setProvincia(value);
    setDistrito('');
    setZonaComercial('');
    setDistritoOptions([]);
    fetchDistritos(departamento, value);
  };

  const handleDistritoChange = (value: string) => {
    setDistrito(value);
    if (!zonaComercial) setZonaComercial(value);
  };

  const handleEstadoCivilChange = (value: string) => {
    setEstadoCivil(value);
    if (!requiresSpouseEvaluation(value)) {
      setConyugeDni('');
      setConyugeNombres('');
    }
  };

  const openCalculatorForSale = (sale: any) => {
    setSelectedSaleId(null);
    setCalculatorSale(sale);
    setActiveTab('simulator');
  };

  const closeCalculator = () => {
    setCalculatorSale(null);
    setActiveTab('list');
    fetchData();
  };

  const closeSelectedSale = () => {
    setSelectedSaleId(null);
    fetchData();
  };

  const refreshPushStatus = async () => {
    setPushBusy(true);
    try {
      const status = await checkPushTokenStatus();
      setPushStatus(status);
      return status;
    } finally {
      setPushBusy(false);
    }
  };

  const openNotificationTarget = (data: any) => {
    const saleId = data?.saleId || data?.sale_id;
    if (typeof saleId === 'string' && saleId.length > 0) {
      setActiveTab('list');
      setSelectedSaleId(saleId);
    } else if (data?.screen === 'home') {
      setActiveTab('home');
    }
    fetchData();
  };

  const handleRegisterPush = async () => {
    setPushBusy(true);
    try {
      const registeredToken = await registerForPushNotifications();
      const status = await checkPushTokenStatus();
      setPushStatus(status);
      Alert.alert(
        status.has_token ? 'Notificaciones activas' : 'Notificaciones no activas',
        status.has_token
          ? 'Este dispositivo ya esta conectado para recibir alertas reales.'
          : 'No se pudo registrar el dispositivo. Usa la APK instalada en un telefono fisico y acepta el permiso de notificaciones.'
      );
      return registeredToken;
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    try {
      const res = await api.post('/notifications/test');
      Alert.alert(
        res.data?.sent_count > 0 ? 'Prueba enviada' : 'Token no activo',
        res.data?.message || 'Solicitud procesada.'
      );
      await refreshPushStatus();
    } catch (error: any) {
      Alert.alert('No se pudo enviar', error.response?.data?.error || 'Revisa la conexion y vuelve a intentar.');
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    let mounted = true;

    const setupPush = async () => {
      await registerForPushNotifications();
      const status = await checkPushTokenStatus();
      if (mounted) setPushStatus(status);
    };

    setupPush();

    const receivedSub = addNotificationReceivedListener((notification) => {
      console.log('Notification received in foreground:', notification.request.content.title);
      fetchData();
    });

    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      openNotificationTarget(data);
    });

    return () => {
      mounted = false;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetchData();
    fetchConvenios();
    fetchDepartamentos();
    fetchProvincias(departamento);
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchData();
      }
    });

    return () => subscription.remove();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedSaleId) {
        closeSelectedSale();
        return true;
      }

      if (activeTab === 'simulator') {
        closeCalculator();
        return true;
      }

      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [token, selectedSaleId, activeTab]);

  const handleLogin = async () => {
    if (!apiReady) {
      Alert.alert('Preparando API', 'Espera unos segundos y vuelve a intentar.');
      return;
    }
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      Alert.alert('Faltan datos', 'Ingresa usuario y contrasena.');
      return;
    }
    if (!apiUrl) {
      Alert.alert(
        'API no configurada',
        'Configura la URL de API en esta pantalla o inicia Expo con Iniciar Fuvex.bat.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${apiUrl}/auth/login`, { username: cleanUsername, password });
      setAuthToken(res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (error: any) {
      const message = error.response?.data?.error ||
        (error.request ? `No se pudo conectar al API movil (${apiUrl}). Verifica que el backend este iniciado y que la URL sea correcta.` : 'Credenciales invalidas');
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    unregisterPushToken();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setSelectedSaleId(null);
    setCalculatorSale(null);
    setPushStatus(null);
    setActiveTab('home');
  };

  const calculateCommission = (volume: number) => {
    if (volume >= 550000) return volume * 0.0105;
    if (volume >= 450000) return volume * 0.0100;
    if (volume >= 350000) return volume * 0.0090;
    if (volume >= 250000) return volume * 0.0080;
    if (volume >= 150000) return volume * 0.0070;
    return volume * 0.0065;
  };

  const currentCommission = useMemo(() => {
    const totalDisbursed = kpi?.totalDisbursed || 0;
    return calculateCommission(totalDisbursed);
  }, [kpi]);

  const formatCurrencyShort = (value: any) => {
    const amount = Number(value) || 0;
    if (Math.abs(amount) >= 1000000) return `S/ ${(amount / 1000000).toFixed(1)}M`;
    if (Math.abs(amount) >= 1000) return `S/ ${Math.round(amount / 1000)}K`;
    return `S/ ${Math.round(amount).toLocaleString()}`;
  };

  const formatCurrencyFull = (value: any) => `S/ ${Math.round(Number(value) || 0).toLocaleString()}`;
  const formatPct = (value: any) => `${Number(value || 0).toFixed(1)}%`;

  const dashboardTabs = [
    { key: 'general' as const, label: 'General', icon: 'speedometer-outline' },
    { key: 'equipos' as const, label: 'Equipos', icon: 'people-outline' },
    { key: 'zonas' as const, label: 'Zonas', icon: 'map-outline' },
    { key: 'embudo' as const, label: 'Embudo', icon: 'filter-outline' }
  ];
  const handleSubmit = async () => {
    const evaluaConyuge = requiresSpouseEvaluation(estadoCivil);

    if (!dni || !nombres || !celular || !maf || !convenio || !cargoLaboral || !plazoDeseado || !estadoCivil || !consentimiento || (sectorOptions.length > 0 && !sectorLaboral)) {
      Alert.alert('Faltan datos', 'Completa DNI, nombre, celular, estado civil, sector, convenio, cargo, monto referencial, plazo y consentimiento.');
      return;
    }

    if (evaluaConyuge && (!/^\d{8}$/.test(conyugeDni) || conyugeNombres.trim().length < 3)) {
      Alert.alert('Datos del conyuge', 'Si el cliente es casado o conviviente, registra DNI y nombres del conyuge para su evaluacion.');
      return;
    }

    if (!isValidPeruMobile(celular)) {
      Alert.alert('Celular invalido', 'El celular debe tener 9 digitos y empezar con 9. El prefijo +51 se agrega automaticamente.');
      return;
    }

    if (!isValidPeruPhone(telefonoAlt)) {
      Alert.alert('Telefono alterno invalido', 'El telefono alterno debe contener solo numeros y tener entre 6 y 9 digitos.');
      return;
    }

    if (!isValidEmail(correo)) {
      Alert.alert('Correo invalido', 'Ingresa un correo valido o deja el campo vacio.');
      return;
    }

    setLoading(true);
    try {
      const saleRes = await axios.post(
        `${apiUrl}/sales`,
        {
          dni_cliente: dni,
          nombres_cliente: nombres,
          celular: `+51${celular}`,
          telefono_alt: telefonoAlt || undefined,
          correo: correo.trim() || undefined,
          estado_civil_cliente: estadoCivil,
          conyuge_dni: evaluaConyuge ? conyugeDni : undefined,
          conyuge_nombres: evaluaConyuge ? conyugeNombres.trim() : undefined,
          direccion,
          plaza,
          departamento,
          provincia,
          distrito,
          zona_comercial: zonaComercial,
          convenio,
          cargo_laboral: cargoLaboral,
          maf_neto: parseFloat(maf),
          monto_solicitado: parseFloat(maf),
          plazo_deseado: parseInt(plazoDeseado, 10),
          origen_prospecto: origenProspecto,
          consentimiento,
          fecha_ingreso: new Date().toISOString(),
          feedback
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const saleId = saleRes.data.id;
      Alert.alert('Exito', 'Prospecto registrado. Ahora inicia la verificacion desde el detalle.');
      resetForm();
      setSelectedSaleId(saleId);
      setActiveTab('list');
      fetchData();
    } catch (error: any) {
      console.warn(error);
      const details = error.response?.data?.details;
      Alert.alert('Error', Array.isArray(details) ? details.join('\n') : (error.response?.data?.error || 'No se pudo registrar la operacion.'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDni('');
    setNombres('');
    setPlaza('');
    setSectorLaboral('');
    setConvenio('');
    setMaf('');
    setCelular('');
    setTelefonoAlt('');
    setCorreo('');
    setEstadoCivil('');
    setConyugeDni('');
    setConyugeNombres('');
    setDireccion('');
    setDepartamento('LIMA');
    setProvincia('');
    setDistrito('');
    setZonaComercial('');
    setCargoLaboral('');
    setPlazoDeseado('');
    setOrigenProspecto('Prospeccion directa');
    setConsentimiento(false);
    setFeedback('');
    setClientAge(null);
    setClientData(null);
  };

  const statusColor = (estado: string) => {
    if (['DESEMBOLSADO', 'FILE_VALIDADO', 'REMESA_APROBADA', 'PENDIENTE_DESEMBOLSO'].includes(estado)) return theme.emerald;
    if (estado?.startsWith('OBS_') || estado?.startsWith('PENDIENTE_') || ['PROSPECTO_NUEVO', 'REMESA_REDUCIDA'].includes(estado)) return theme.orange;
    if (estado?.includes('RECHAZ')) return theme.rose;
    return theme.blue;
  };

  const statusBg = (estado: string) => {
    if (['DESEMBOLSADO', 'FILE_VALIDADO', 'REMESA_APROBADA', 'PENDIENTE_DESEMBOLSO'].includes(estado)) return theme.emeraldSoft;
    if (estado?.startsWith('OBS_') || estado?.startsWith('PENDIENTE_') || ['PROSPECTO_NUEVO', 'REMESA_REDUCIDA'].includes(estado)) return theme.orangeSoft;
    if (estado?.includes('RECHAZ')) return theme.roseSoft;
    return theme.blueSoft;
  };

  const getSaleTrace = (sale: any) => {
    const items = [
      ...(sale.feedback ? [{
        title: 'Observacion inicial',
        text: sale.feedback,
        date: sale.created_at,
        icon: 'chatbox-ellipses-outline'
      }] : []),
      ...((sale.feedbackNotes || []).map((note: any) => ({
        title: 'Nota del expediente',
        text: note.nota,
        date: note.created_at,
        icon: 'chatbox-ellipses-outline'
      }))),
      ...((sale.audit_logs || [])
        .filter((log: any) => Boolean(log.detalles))
        .map((log: any) => ({
          title: log.estado_nuevo ? `Cambio a ${log.estado_nuevo}` : (log.accion || 'Actualizacion'),
          text: log.detalles,
          date: log.created_at,
          icon: 'git-branch-outline'
        })))
    ];

    return items
      .filter(item => Boolean(item.text))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];
  };

  const renderLogin = () => (
    <LoginView
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      handleLogin={handleLogin}
      loading={loading}
      apiReady={apiReady}
      apiUrl={apiUrl}
    />
  );

  const renderHeader = (title: string, subtitle?: string, right?: React.ReactNode) => (
    <View style={styles.header}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.welcomeText}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  const renderExecutiveRow = (item: any, index: number, mode: 'team' | 'zone' | 'ranking' = 'team') => {
    const name = item?.name || item?.nombre || 'Sin responsable';
    const total = item?.total_desembolso ?? item?.value ?? 0;
    const pipeline = item?.pipeline ?? 0;
    const prospectos = item?.prospectos ?? item?.count ?? 0;
    const avance = item?.avance ?? 0;

    return (
      <View key={`${mode}-${name}-${index}`} style={styles.executiveRow}>
        <View style={[styles.executiveRank, { backgroundColor: index === 0 ? theme.orange : theme.blueSoft }]}>
          <Text style={[styles.executiveRankText, { color: index === 0 ? theme.whiteText : theme.blue }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.executiveRowTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.executiveRowMeta} numberOfLines={1}>
            {mode === 'ranking'
              ? 'Ranking mensual'
              : `${prospectos} prospectos | Pipeline ${formatCurrencyShort(pipeline)}`}
          </Text>
          {mode !== 'ranking' && (
            <View style={[styles.progressBarBg, { height: 6, marginTop: 7, marginBottom: 0 }]}>
              <View style={[styles.progressBarFill, { width: `${Math.min(Number(avance) || 0, 100)}%`, backgroundColor: theme.orange }]} />
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.executiveMoney}>{formatCurrencyShort(total)}</Text>
          <Text style={styles.executiveRowMeta}>{mode === 'ranking' ? 'Desembolso' : `${formatPct(avance)} avance`}</Text>
        </View>
      </View>
    );
  };

  const renderLeadershipDashboard = () => {
    const supervisors = operations?.summaries?.supervisors || [];
    const zones = operations?.summaries?.zones || [];
    const funnel = Array.isArray(operations?.funnel) ? operations.funnel : [];
    const risk = Array.isArray(operations?.risk) ? operations.risk : [];
    const topVendedores = rankings?.vendedores || [];
    const slaAlerts = Number(operations?.sla?.por_vencer || 0) + Number(operations?.sla?.vencidos || 0);

    return (
      <View style={styles.fullSaleCard}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ backgroundColor: theme.blueSoft, padding: 9, borderRadius: 10, marginRight: 10 }}>
              <Ionicons name="analytics-outline" size={18} color={theme.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>DASHBOARD EJECUTIVO</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.subtext, marginTop: 2 }}>
                Control de agentes, supervisores, zonas y embudo comercial.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={styles.executiveTabs}>
            {dashboardTabs.map((tab) => {
              const active = dashboardView === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setDashboardView(tab.key)}
                  style={[styles.executiveTab, active && { backgroundColor: theme.blue, borderColor: theme.blue }]}
                >
                  <Ionicons name={tab.icon as any} size={14} color={active ? theme.whiteText : theme.blue} />
                  <Text style={[styles.executiveTabText, active && { color: theme.whiteText }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {dashboardView === 'general' && (
          <View>
            <View style={styles.saleMetricGrid}>
              <View style={styles.saleMetricBox}>
                <Text style={styles.saleMetricLabel}>PIPELINE</Text>
                <Text style={styles.saleMetricValue}>{formatCurrencyShort(kpi?.pipelineValue)}</Text>
              </View>
              <View style={styles.saleMetricBox}>
                <Text style={styles.saleMetricLabel}>ACTIVOS</Text>
                <Text style={styles.saleMetricValue}>{kpi?.pipelineCount || 0} exp.</Text>
              </View>
            </View>
            <View style={[styles.saleMetricGrid, { marginTop: 10 }]}>
              <View style={styles.saleMetricBox}>
                <Text style={styles.saleMetricLabel}>CONVERSION</Text>
                <Text style={styles.saleMetricValue}>{formatPct(kpi?.conversionRate)}</Text>
              </View>
              <View style={styles.saleMetricBox}>
                <Text style={styles.saleMetricLabel}>PROYECCION</Text>
                <Text style={styles.saleMetricValue}>{formatCurrencyShort(kpi?.forecasting)}</Text>
              </View>
            </View>
            <View style={styles.executiveInsight}>
              <Ionicons name="notifications-outline" size={18} color={theme.orange} />
              <View style={{ flex: 1 }}>
                <Text style={styles.executiveRowTitle}>Alertas operativas reales</Text>
                <Text style={styles.executiveRowMeta}>
                  {slaAlerts} expedientes requieren seguimiento por SLA o inactividad.
                </Text>
              </View>
            </View>
            <Text style={[styles.metaLabel, { marginTop: 10 }]}>
              Productividad: {Number(kpi?.productivity || 0).toFixed(1)} expedientes por asesor activo.
            </Text>
          </View>
        )}

        {dashboardView === 'equipos' && (
          <View>
            <Text style={styles.executiveBlockTitle}>SUPERVISORES Y EQUIPOS</Text>
            {supervisors.slice(0, 5).map((item: any, index: number) => renderExecutiveRow(item, index, 'team'))}
            {supervisors.length === 0 && <Text style={styles.emptyText}>Sin datos de equipos para este mes.</Text>}
            {topVendedores.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.executiveBlockTitle}>TOP ASESORES</Text>
                {topVendedores.slice(0, 3).map((item: any, index: number) => renderExecutiveRow(item, index, 'ranking'))}
              </View>
            )}
          </View>
        )}

        {dashboardView === 'zonas' && (
          <View>
            <Text style={styles.executiveBlockTitle}>AVANCE POR ZONA</Text>
            {zones.slice(0, 6).map((item: any, index: number) => renderExecutiveRow(item, index, 'zone'))}
            {zones.length === 0 && <Text style={styles.emptyText}>Sin zonas con actividad mensual.</Text>}
          </View>
        )}

        {dashboardView === 'embudo' && (
          <View>
            <Text style={styles.executiveBlockTitle}>ESTADOS DEL PIPELINE</Text>
            {funnel.slice(0, 6).map((item: any, index: number) => (
              <View key={`${item.estado}-${index}`} style={styles.funnelRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.executiveRowTitle} numberOfLines={1}>{item.estado || 'Sin estado'}</Text>
                  <Text style={styles.executiveRowMeta}>{item._count || 0} expedientes</Text>
                </View>
                <Text style={styles.executiveMoney}>{item._count || 0}</Text>
              </View>
            ))}
            {risk.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.executiveBlockTitle}>RIESGO INFOBURO</Text>
                <View style={styles.saleMetricGrid}>
                  {risk.slice(0, 3).map((item: any) => (
                    <View key={item.rcc_semaforo || 'SIN'} style={styles.saleMetricBox}>
                      <Text style={styles.saleMetricLabel}>{item.rcc_semaforo || 'SIN DATO'}</Text>
                      <Text style={styles.saleMetricValue}>{item._count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHome = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      {renderHeader(
        `Hola, ${user?.nombre?.split(' ')[0] || 'equipo'}`,
        'Gestiona tu avance y expedientes activos.',
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={[styles.profileBtn, { marginRight: 8 }]} onPress={() => setActiveTab('alerts')}>
            <Ionicons name="notifications-outline" size={20} color={theme.blue} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={theme.orange} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.kpiGrid, isLandscape && styles.kpiGridLandscape]}>
        <View style={[styles.mainKpiCard, isLandscape && { flex: 1, marginRight: 10 }]}>
          <Text style={styles.kpiLabel}>AVANCE MENSUAL</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressTextRow}>
              <Text style={styles.kpiValue}>{Math.round(kpi?.completionRate || 0)}%</Text>
              <Text style={styles.kpiSubValue}>S/ {(kpi?.totalDisbursed || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(kpi?.completionRate || 0, 100)}%` }]} />
            </View>
            <Text style={styles.metaLabel}>Meta: S/ {(kpi?.goalAmount || 500000).toLocaleString()}</Text>
          </View>
        </View>

        <View style={[styles.commissionCard, isLandscape && { flex: 1 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.kpiLabel, { color: 'rgba(255,255,255,0.72)' }]}>COMISION ESTIMADA</Text>
            <Ionicons name="trending-up" size={16} color={theme.whiteText} />
          </View>
          <Text style={styles.commissionValue}>S/ {Math.round(currentCommission).toLocaleString()}</Text>
          <Text style={styles.commissionNote}>Basado en volumen total del mes</Text>
        </View>
      </View>

      {canViewLeadershipDashboard && renderLeadershipDashboard()}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>GESTIONES DEL DIA</Text>
        <TouchableOpacity onPress={() => setActiveTab('list')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.seeAllText}>VER TODO</Text>
          <Ionicons name="chevron-forward" size={12} color={theme.orange} />
        </TouchableOpacity>
      </View>

      <View style={styles.quickList}>
        {mySales.slice(0, 3).map((sale) => (
          <TouchableOpacity key={sale.id} style={styles.saleItem} onPress={() => setSelectedSaleId(sale.id)}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor(sale.estado) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.saleName}>{sale.nombres_cliente}</Text>
              <Text style={styles.saleMeta}>
                {sale.dni_cliente} | S/ {(Number(sale.monto_solicitado ?? sale.maf_neto) || 0).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: statusBg(sale.estado) }]}>
              <Text style={[styles.pillText, { color: statusColor(sale.estado) }]}>{sale.estado}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {mySales.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="document-text-outline" size={40} color={theme.border} />
            <Text style={styles.emptyText}>No hay gestiones registradas.</Text>
          </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderAlerts = () => (
    <View style={styles.container}>
      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {renderHeader(
          'Alertas push',
          'Activa y prueba las notificaciones reales del sistema.',
          <TouchableOpacity style={styles.profileBtn} onPress={refreshPushStatus} disabled={pushBusy}>
            {pushBusy ? (
              <ActivityIndicator size="small" color={theme.orange} />
            ) : (
              <Ionicons name="refresh" size={20} color={theme.orange} />
            )}
          </TouchableOpacity>
        )}

        <View style={styles.fullSaleCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: theme.blueSoft, padding: 10, borderRadius: 12, marginRight: 12 }}>
              <Ionicons
                name={pushStatus?.has_token ? 'checkmark-circle' : 'warning-outline'}
                size={22}
                color={pushStatus?.has_token ? theme.emerald : theme.amber}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>
                {pushStatus?.has_token ? 'Dispositivo conectado' : 'Dispositivo pendiente'}
              </Text>
              <Text style={styles.saleMeta}>
                {pushStatus?.token_preview || 'Sin token registrado para este usuario.'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.orange }]}
            onPress={handleRegisterPush}
            disabled={pushBusy}
          >
            {pushBusy ? (
              <ActivityIndicator color={theme.whiteText} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.buttonText}>ACTIVAR EN ESTE TELEFONO</Text>
                <Ionicons name="notifications" size={18} color={theme.whiteText} style={{ marginLeft: 10 }} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: theme.blueDark, marginTop: 12, opacity: pushStatus?.has_token ? 1 : 0.74 }
            ]}
            onPress={handleTestPush}
            disabled={pushBusy}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.buttonText}>ENVIAR PRUEBA PUSH</Text>
              <Ionicons name="send" size={18} color={theme.whiteText} style={{ marginLeft: 10 }} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.quickList}>
          {[
            { icon: 'git-compare-outline', title: 'Cambios de estado', text: 'Avisa al asesor y su jerarquia cuando un expediente cambia de etapa.' },
            { icon: 'timer-outline', title: 'SLA e inactividad', text: 'Revisa expedientes por vencer, vencidos o criticos cada 15 minutos.' },
            { icon: 'shield-checkmark-outline', title: 'Escalamiento', text: 'Los casos criticos tambien notifican a gerencia y superadministracion.' }
          ].map((item) => (
            <View key={item.title} style={styles.saleItem}>
              <View style={[styles.traceIconBox, { marginRight: 12 }]}>
                <Ionicons name={item.icon as any} size={16} color={theme.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.saleName}>{item.title}</Text>
                <Text style={styles.saleMeta}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );

  const renderList = () => (
    <View style={styles.container}>
      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {renderHeader(
          'Bandeja de expedientes',
          `${mySales.length} expedientes activos`,
          <TouchableOpacity style={styles.profileBtn}>
            <Ionicons name="filter" size={20} color={theme.blue} />
          </TouchableOpacity>
        )}

        {mySales.map((sale) => {
          const trace = getSaleTrace(sale);

          return (
            <TouchableOpacity key={sale.id} style={styles.fullSaleCard} onPress={() => setSelectedSaleId(sale.id)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardDni}>DNI {sale.dni_cliente}</Text>
                  <Text style={styles.cardDate}>{new Date(sale.fecha_ingreso).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: statusBg(sale.estado) }]}>
                  <Text numberOfLines={1} style={[styles.pillText, { color: statusColor(sale.estado) }]}>{sale.estado}</Text>
                </View>
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{sale.nombres_cliente}</Text>

              <View style={styles.saleMetricGrid}>
                <View style={styles.saleMetricBox}>
                  <Text style={styles.saleMetricLabel}>MONTO</Text>
                  <Text style={styles.saleMetricValue}>S/ {(Number(sale.monto_solicitado ?? sale.maf_neto) || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.saleMetricBox}>
                  <Text style={styles.saleMetricLabel}>CONVENIO</Text>
                  <Text style={styles.saleMetricValue} numberOfLines={1}>{sale.convenio || 'Sin convenio'}</Text>
                </View>
              </View>

              {trace && (
                <View style={styles.tracePreview}>
                  <View style={styles.traceIconBox}>
                    <Ionicons name={trace.icon as any} size={15} color={theme.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.traceLabel} numberOfLines={1}>{trace.title}</Text>
                    <Text style={styles.traceText} numberOfLines={2}>{trace.text}</Text>
                  </View>
                </View>
              )}

              {sale.estado === 'PROSPECTO_NUEVO' && (
                <View style={styles.warningAlert}>
                  <Ionicons name="alert-circle" size={14} color={theme.amber} style={{ marginRight: 5 }} />
                  <Text style={styles.warningText}>FILE PENDIENTE (48H)</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {mySales.length === 0 && (
          <View style={styles.quickList}>
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name="folder-open-outline" size={42} color={theme.border} />
              <Text style={styles.emptyText}>No hay expedientes para mostrar.</Text>
            </View>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );

  const renderForm = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      {renderHeader('Nuevo prospecto', 'Registra datos base. La documentacion se carga despues de la aceptacion del cliente.')}

      <View style={styles.formCard}>
        <View style={styles.formSection}>
          <View style={styles.formSectionHeader}>
            <Ionicons name="person-circle" size={20} color={theme.blue} style={{ marginRight: 10 }} />
            <Text style={styles.inputLabel}>DATOS DEL CLIENTE</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="DNI del cliente"
            placeholderTextColor={theme.subtext}
            value={dni}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, '');
              if (cleaned.length <= 8) {
                setDni(cleaned);
                if (cleaned.length === 8) fetchDniInfo(cleaned);
                else setClientAge(null);
              }
            }}
            keyboardType="number-pad"
            maxLength={8}
          />

          {isSearchingDni && (
            <View style={styles.formHintRow}>
              <ActivityIndicator size="small" color={theme.orange} />
              <Text style={{ fontSize: 12, color: theme.subtext, marginLeft: 10 }}>Buscando informacion...</Text>
            </View>
          )}

          {clientAge && (
            <View style={styles.formInfoCard}>
              <Ionicons name="calendar" size={18} color={theme.blue} style={{ marginRight: 10 }} />
              <View>
                <Text style={{ fontSize: 10, fontWeight: '900', color: theme.subtext, letterSpacing: 1 }}>EDAD ESTIMADA</Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.blue }}>{clientAge}</Text>
              </View>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Nombres completos"
            placeholderTextColor={theme.subtext}
            value={nombres}
            onChangeText={(text) => setNombres(text.replace(/[^a-zA-ZÃ¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘Ã¼Ãœ\s]/g, ''))}
            autoCapitalize="words"
          />

          <View style={styles.phoneRow}>
            <View style={styles.phonePrefixBox}>
              <Text style={{ color: theme.blue, fontSize: 14, fontWeight: '900' }}>+51</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Celular 9 digitos"
              placeholderTextColor={theme.subtext}
              value={celular}
              onChangeText={(text) => setCelular(onlyDigits(text, 9))}
              keyboardType="number-pad"
              maxLength={9}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Telefono alterno fijo o movil"
            placeholderTextColor={theme.subtext}
            value={telefonoAlt}
            onChangeText={(text) => setTelefonoAlt(onlyDigits(text, 9))}
            keyboardType="number-pad"
            maxLength={9}
          />

          <TextInput
            style={styles.input}
            placeholder="Correo del cliente"
            placeholderTextColor={theme.subtext}
            value={correo}
            onChangeText={(text) => setCorreo(text.trim().toLowerCase())}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.emailDomainRow}>
            {EMAIL_DOMAIN_OPTIONS.map(domain => (
              <TouchableOpacity
                key={domain}
                onPress={() => applyEmailDomain(domain)}
                style={styles.emailDomainChip}
              >
                <Text style={{ color: theme.blue, fontSize: 11, fontWeight: '900' }}>@{domain}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <CustomPicker
            selectedValue={estadoCivil}
            onValueChange={handleEstadoCivilChange}
            options={ESTADO_CIVIL_OPTIONS}
            placeholder="Seleccionar estado civil..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />

          {requiresSpouseEvaluation(estadoCivil) && (
            <View>
              <View style={styles.formInfoCard}>
                <Ionicons name="people" size={18} color={theme.orange} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: theme.subtext, letterSpacing: 1 }}>EVALUACION DE CONYUGE</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                    Si el conyuge presenta problemas en sistema/BCP, el cliente no aplica.
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.input}
                placeholder="DNI del conyuge"
                placeholderTextColor={theme.subtext}
                value={conyugeDni}
                onChangeText={(text) => {
                  const cleaned = onlyDigits(text, 8);
                  setConyugeDni(cleaned);
                  if (cleaned.length === 8) fetchConyugeDniInfo(cleaned);
                }}
                keyboardType="number-pad"
                maxLength={8}
              />

              {isSearchingConyugeDni && (
                <View style={styles.formHintRow}>
                  <ActivityIndicator size="small" color={theme.orange} />
                  <Text style={{ fontSize: 12, color: theme.subtext, marginLeft: 10 }}>Buscando conyuge...</Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Nombres del conyuge"
                placeholderTextColor={theme.subtext}
                value={conyugeNombres}
                onChangeText={(text) => setConyugeNombres(text.replace(/[^a-zA-ZÃ¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘Ã¼Ãœ\s]/g, ''))}
                autoCapitalize="words"
              />
            </View>
          )}
        </View>

        <View style={styles.formSection}>
          <View style={styles.formSectionHeader}>
            <Ionicons name="location" size={20} color={theme.blue} style={{ marginRight: 10 }} />
            <Text style={styles.inputLabel}>UBICACION</Text>
          </View>

        <TextInput
          style={styles.input}
          placeholder="Direccion"
          placeholderTextColor={theme.subtext}
          value={direccion}
          onChangeText={setDireccion}
        />

        {departamentoOptions.length > 0 ? (
          <CustomPicker
            selectedValue={departamento}
            onValueChange={handleDepartamentoChange}
            options={[{ label: 'Seleccionar departamento...', value: '' }, ...departamentoOptions.map(item => ({ label: item.departamento, value: item.departamento }))]}
            placeholder="Seleccionar departamento..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Departamento"
            placeholderTextColor={theme.subtext}
            value={departamento}
            onChangeText={(text) => setDepartamento(text.toUpperCase())}
          />
        )}

        {provinciaOptions.length > 0 ? (
          <CustomPicker
            selectedValue={provincia}
            onValueChange={handleProvinciaChange}
            options={[{ label: 'Seleccionar provincia...', value: '' }, ...provinciaOptions.map(item => ({ label: item.provincia, value: item.provincia }))]}
            placeholder="Seleccionar provincia..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Provincia"
            placeholderTextColor={theme.subtext}
            value={provincia}
            onChangeText={(text) => setProvincia(text.toUpperCase())}
          />
        )}

        {distritoOptions.length > 0 ? (
          <CustomPicker
            selectedValue={distrito}
            onValueChange={handleDistritoChange}
            options={[{ label: 'Seleccionar distrito...', value: '' }, ...distritoOptions.map(item => ({ label: item.distrito, value: item.distrito }))]}
            placeholder="Seleccionar distrito..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Distrito"
            placeholderTextColor={theme.subtext}
            value={distrito}
            onChangeText={(text) => setDistrito(text.toUpperCase())}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Zona"
          placeholderTextColor={theme.subtext}
          value={zonaComercial}
          onChangeText={(text) => setZonaComercial(text.toUpperCase())}
        />
        </View>

        <View style={styles.formSection}>
          <View style={styles.formSectionHeader}>
            <Ionicons name="briefcase" size={20} color={theme.blue} style={{ marginRight: 10 }} />
            <Text style={styles.inputLabel}>CONDICIONES</Text>
          </View>

        {sectorOptions.length > 0 && (
          <CustomPicker
            selectedValue={sectorLaboral}
            onValueChange={handleSectorChange}
            options={[{ label: 'Seleccionar sector...', value: '' }, ...sectorOptions.map(s => ({ label: s, value: s }))]}
            placeholder="Seleccionar sector..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />
        )}

        <CustomPicker
          selectedValue={convenio}
          onValueChange={handleConvenioChange}
          options={filteredConvenioOptions}
          placeholder="Seleccionar convenio..."
          theme={theme}
          isDark={isDark}
          style={styles.formPicker}
        />

        {simulatorCatalog && !selectedConvenio ? (
          <CustomPicker
            selectedValue=""
            onValueChange={() => undefined}
            options={[{ label: 'Primero selecciona convenio', value: '' }]}
            placeholder="Seleccionar cargo..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />
        ) : cargoOptions.length > 0 ? (
          <CustomPicker
            selectedValue={cargoLaboral}
            onValueChange={setCargoLaboral}
            options={[{ label: 'Seleccionar cargo...', value: '' }, ...cargoOptions.map(cargo => ({ label: cargo.nombre, value: cargo.nombre }))]}
            placeholder="Seleccionar cargo..."
            theme={theme}
            isDark={isDark}
            style={styles.formPicker}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Cargo laboral"
            placeholderTextColor={theme.subtext}
            value={cargoLaboral}
            onChangeText={(text) => setCargoLaboral(text.toUpperCase())}
          />
        )}

        <View style={styles.moneyInputWrapper}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: theme.blue, marginRight: 5 }}>S/</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0, flex: 1, backgroundColor: 'transparent', borderWidth: 0 }]}
            placeholder="Monto solicitado"
            placeholderTextColor={theme.subtext}
            value={maf}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9.]/g, '');
              const parts = cleaned.split('.');
              if (parts.length <= 2) setMaf(cleaned);
            }}
            keyboardType="decimal-pad"
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Plazo deseado en meses"
          placeholderTextColor={theme.subtext}
          value={plazoDeseado}
          onChangeText={(text) => setPlazoDeseado(text.replace(/[^0-9]/g, '').slice(0, 3))}
          keyboardType="number-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Origen del prospecto"
          placeholderTextColor={theme.subtext}
          value={origenProspecto}
          onChangeText={setOrigenProspecto}
        />

        <TextInput
          style={[styles.input, { minHeight: 76, textAlignVertical: 'top', paddingTop: 14 }]}
          placeholder="Observaciones iniciales"
          placeholderTextColor={theme.subtext}
          value={feedback}
          onChangeText={setFeedback}
          multiline
        />
        </View>

        <View style={[styles.formSection, styles.formSectionLast]}>

        <TouchableOpacity
          onPress={() => setConsentimiento(!consentimiento)}
          style={[
            styles.consentCard,
            {
            borderColor: consentimiento ? theme.blue : theme.border,
            backgroundColor: consentimiento ? theme.blueSoft : theme.white
            }
          ]}
        >
          <Ionicons
            name={consentimiento ? 'checkbox' : 'square-outline'}
            size={22}
            color={consentimiento ? theme.blue : theme.subtext}
            style={{ marginRight: 10 }}
          />
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: theme.text }}>
            Cliente autoriza el tratamiento de datos y evaluacion crediticia.
          </Text>
        </TouchableOpacity>

        <View style={styles.formInfoCard}>
          <Ionicons name="document-text" size={18} color={theme.blue} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: theme.subtext, letterSpacing: 1 }}>DOCUMENTOS DESPUES DEL CIERRE</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
              DNI, boleta y documentos del file se cargan desde el detalle cuando el cliente acepta la cotizacion.
            </Text>
          </View>
        </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.whiteText} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.buttonText}>CREAR PROSPECTO</Text>
              <Ionicons name="send" size={18} color={theme.whiteText} style={{ marginLeft: 10 }} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab('home')}>
          <Text style={styles.secondaryButtonText}>CANCELAR</Text>
        </TouchableOpacity>
        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );

  const renderSimulator = () => {
    if (!calculatorSale) {
      return (
        <View style={styles.container}>
          <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
            {renderHeader('Calculadora', 'Selecciona un prospecto de la bandeja para evaluarlo.')}
            <View style={styles.fullSaleCard}>
              <View style={{ alignItems: 'center', paddingVertical: 26 }}>
                <Ionicons name="calculator-outline" size={42} color={theme.blue} />
                <Text style={[styles.cardName, { textAlign: 'center', marginTop: 12 }]}>
                  La calculadora se aplica despues de crear el prospecto
                </Text>
                <Text style={[styles.emptyText, { marginTop: 8, textAlign: 'center' }]}>
                  Abre un expediente y usa la accion de evaluacion para guardar el resultado en ese prospecto.
                </Text>
                <TouchableOpacity style={[styles.primaryButton, { marginTop: 18 }]} onPress={() => setActiveTab('list')}>
                  <Text style={styles.buttonText}>IR A BANDEJA</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <SimulatorView
        isDark={isDark}
        token={token || ''}
        apiUrl={apiUrl}
        targetSale={calculatorSale}
        onClose={closeCalculator}
        onSimulationSaved={fetchData}
      />
    );
  };

  const inactiveTabColor = 'rgba(255,255,255,0.56)';
  const activeTabColor = theme.orange;

  if (!token) {
    return renderLogin();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {selectedSaleId ? (
        <ExpedienteDetail
          saleId={selectedSaleId}
          onClose={closeSelectedSale}
          onOpenCalculator={openCalculatorForSale}
          isDark={isDark}
          theme={theme}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'list' && renderList()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'alerts' && renderAlerts()}
          {activeTab === 'simulator' && renderSimulator()}

          {activeTab !== 'simulator' && (
          <View style={[styles.tabBar, isLandscape && { bottom: 10, width: '70%', alignSelf: 'center' }]}>
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.tabItem, activeTab === 'home' && styles.tabItemActive]}
              onPress={() => setActiveTab('home')}
            >
              {activeTab === 'home' && <View style={styles.tabActiveIndicator} />}
              <View style={[styles.tabIconWrap, activeTab === 'home' && styles.tabIconWrapActive]}>
                <Ionicons
                  name={activeTab === 'home' ? 'home' : 'home-outline'}
                  size={21}
                  color={activeTab === 'home' ? activeTabColor : inactiveTabColor}
                />
              </View>
              <Text numberOfLines={1} style={[styles.tabText, activeTab === 'home' && styles.tabActive]}>INICIO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.tabItem, activeTab === 'list' && styles.tabItemActive]}
              onPress={() => setActiveTab('list')}
            >
              {activeTab === 'list' && <View style={styles.tabActiveIndicator} />}
              <View style={[styles.tabIconWrap, activeTab === 'list' && styles.tabIconWrapActive]}>
                <Ionicons
                  name={activeTab === 'list' ? 'list' : 'list-outline'}
                  size={21}
                  color={activeTab === 'list' ? activeTabColor : inactiveTabColor}
                />
              </View>
              <Text numberOfLines={1} style={[styles.tabText, activeTab === 'list' && styles.tabActive]}>BANDEJA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.tabItem, activeTab === 'form' && styles.tabItemActive]}
              onPress={() => setActiveTab('form')}
            >
              {activeTab === 'form' && <View style={styles.tabActiveIndicator} />}
              <View style={[styles.tabIconWrap, activeTab === 'form' && styles.tabIconWrapActive]}>
                <Ionicons
                  name={activeTab === 'form' ? 'document-text' : 'document-text-outline'}
                  size={21}
                  color={activeTab === 'form' ? activeTabColor : inactiveTabColor}
                />
              </View>
              <Text numberOfLines={1} style={[styles.tabText, activeTab === 'form' && styles.tabActive]}>NUEVO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.tabItem, activeTab === 'alerts' && styles.tabItemActive]}
              onPress={() => setActiveTab('alerts')}
            >
              {activeTab === 'alerts' && <View style={styles.tabActiveIndicator} />}
              <View style={[styles.tabIconWrap, activeTab === 'alerts' && styles.tabIconWrapActive]}>
                <Ionicons
                  name={activeTab === 'alerts' ? 'notifications' : 'notifications-outline'}
                  size={21}
                  color={activeTab === 'alerts' ? activeTabColor : inactiveTabColor}
                />
              </View>
              <Text numberOfLines={1} style={[styles.tabText, activeTab === 'alerts' && styles.tabActive]}>ALERTAS</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
