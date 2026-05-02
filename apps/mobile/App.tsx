import React, { useState, useEffect, useMemo } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ScrollView, Alert, Image, SafeAreaView,
  StatusBar, useWindowDimensions, ActivityIndicator,
  useColorScheme, Platform, StyleSheet
} from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
 
 // Configuración Ngrok para saltar advertencia
 axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// Imports Optimizados
import { COLORS, DARK_COLORS, API_URL, CONVENIOS } from './src/constants/theme';
import { createStyles } from './src/styles/global';
import { createSimStyles } from './src/styles/simulator';
import { LoginView } from './src/components/LoginView';


interface Attachment {
  uri: string;
  name: string;
  type: string;
}


export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(isDark);
  const simStyles = createSimStyles(isDark);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;


  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'list' | 'form' | 'simulator'>('home');

  // Data State
  const [mySales, setMySales] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Form State
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [plaza, setPlaza] = useState('');
  const [convenio, setConvenio] = useState('');
  const [maf, setMaf] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [feedback, setFeedback] = useState('');
  const [clientAge, setClientAge] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [isSearchingDni, setIsSearchingDni] = useState(false);

  // Simulator State
  const [simConfig, setSimConfig] = useState<any>(null);
  const [simForm, setSimForm] = useState({
    convenioId: '',
    cargoId: '',
    ingresosFijos: '0',
    ingresosVariables: '0',
    descuentosLey: '0',
    otrosDescuentos: '0',
    montoSolicitado: '10000',
    cuotas: '12',
    envioFisico: false
  });
  const [simResult, setSimResult] = useState<any>(null);

  const fetchDniInfo = async (id: string) => {
    setIsSearchingDni(true);
    setClientAge(null);
    setClientData(null);
    try {
      const res = await axios.get(`${API_URL}/dni/${id}`, {
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

  useEffect(() => {
    if (token) {
      fetchData();
      fetchSimulatorConfig();
      registerForPushNotificationsAsync().then(pushToken => {
        if (pushToken) {
          axios.post(`${API_URL}/users/push-token`, { push_token: pushToken }, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(() => {
            console.log('Push token registered successfully');
          }).catch(err => {
            Alert.alert('Error de Notificación', 'No se pudo registrar el token en el servidor.');
          });
        }
      }).catch(err => {
        Alert.alert('Error de Notificación', 'No se pudieron obtener permisos.');
      });
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  async function registerForPushNotificationsAsync() {
    let pushToken;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: theme.orange,
      });
    }

    return pushToken;
  }

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [salesRes, kpiRes] = await Promise.all([
        axios.get(`${API_URL}/sales`, { headers }),
        axios.get(`${API_URL}/analytics/dashboard`, { headers })
      ]);
      setMySales(salesRes.data);
      setKpi(kpiRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const fetchSimulatorConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/simulator/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSimConfig(res.data);
      if (res.data.convenios.length > 0 && !simForm.convenioId) {
        setSimForm(prev => ({ ...prev, convenioId: res.data.convenios[0].id }));
      }
      if (res.data.cargos.length > 0 && !simForm.cargoId) {
        setSimForm(prev => ({ ...prev, cargoId: res.data.cargos[0].id }));
      }
    } catch (error) {
      console.error('Simulator config error:', error);
    }
  };

  const handleSimulateMobile = async () => {
    setLoading(true);
    setSimResult(null);
    try {
      const payload = {
        ...simForm,
        ingresosFijos: parseFloat(simForm.ingresosFijos),
        ingresosVariables: parseFloat(simForm.ingresosVariables),
        descuentosLey: parseFloat(simForm.descuentosLey),
        otrosDescuentos: parseFloat(simForm.otrosDescuentos),
        montoSolicitado: parseFloat(simForm.montoSolicitado),
        cuotas: parseInt(simForm.cuotas)
      };
      const res = await axios.post(`${API_URL}/simulator/calculate`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSimResult(res.data);
    } catch (error: any) {
      Alert.alert('Error en Simulación', error.response?.data?.error || 'No se pudo realizar el cálculo.');
    } finally {
      setLoading(false);
    }
  };

  const testPush = async () => {
    try {
      await axios.post(`${API_URL}/notifications/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Enviado', 'Se ha solicitado una notificación de prueba.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la prueba.');
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (error) {
      Alert.alert('Error', 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
      });

      if (!result.canceled) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        }));
        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
  };

  const handleSubmit = async () => {
    if (!dni || !nombres || !maf || !convenio) {
      Alert.alert('Faltan Datos', 'Por favor completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const saleRes = await axios.post(
        `${API_URL}/sales`,
        {
          dni_cliente: dni, nombres_cliente: nombres, plaza, convenio,
          maf_neto: parseFloat(maf), fecha_ingreso: new Date().toISOString(), feedback
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const saleId = saleRes.data.id;
      for (const att of attachments) {
        const formData = new FormData();
        formData.append('tipo_documento', 'DOC');
        formData.append('dni_cliente', dni);
        formData.append('documento', { uri: att.uri, name: att.name, type: att.type } as any);

        // Enviamos el DNI también por query param para asegurar que multer lo reciba a tiempo
        await axios.post(`${API_URL}/sales/${saleId}/documentos?dni=${dni}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      Alert.alert('¡Éxito!', 'Expediente registrado correctamente.');
      resetForm(); setActiveTab('list'); fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo registrar la operación.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDni(''); setNombres(''); setPlaza(''); setConvenio(''); setMaf(''); setAttachments([]); setFeedback('');
  };

  // VIEWS
  const renderLogin = () => (
    <LoginView
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      handleLogin={handleLogin}
      loading={loading}
    />
  );

  const renderHome = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>¡Hola, {user?.nombre?.split(' ')[0]}!</Text>
          <Text style={styles.headerSubtitle}>Hoy es un buen día para cerrar ventas.</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => setToken(null)}>
          <Ionicons name="log-out-outline" size={20} color={theme.orange} />
        </TouchableOpacity>
      </View>

      {/* KPI SECTION */}
      <View style={[styles.kpiGrid, isLandscape && styles.kpiGridLandscape]}>
        <View style={[styles.mainKpiCard, isLandscape && { flex: 1, marginRight: 10 }]}>
          <Text style={styles.kpiLabel}>MI AVANCE MENSUAL</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressTextRow}>
              <Text style={styles.kpiValue}>{Math.round(kpi?.completionRate || 0)}%</Text>
              <Text style={styles.kpiSubValue}>S/ {(kpi?.totalDisbursed || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(kpi?.completionRate || 0, 100)}%` }]} />
            </View>
            <Text style={styles.metaLabel}>Meta: S/ {(kpi?.monthlyGoal || 500000).toLocaleString()}</Text>
          </View>
        </View>

        <View style={[styles.commissionCard, isLandscape && { flex: 1 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.kpiLabel, { color: '#fff' }]}>COMISIÓN ESTIMADA</Text>
            <Ionicons name="trending-up" size={16} color="#fff" />
          </View>
          <Text style={styles.commissionValue}>S/ {Math.round(currentCommission).toLocaleString()}</Text>
          <Text style={styles.commissionNote}>*Basado en volumen total del mes</Text>
        </View>
      </View>

      {/* TEST PUSH SECTION */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <TouchableOpacity 
          style={{ 
            backgroundColor: theme.white, 
            padding: 15, 
            borderRadius: 20, 
            flexDirection: 'row', 
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: theme.border
          }} 
          onPress={testPush}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#FFF7ED', padding: 10, borderRadius: 12, marginRight: 15 }}>
              <Ionicons name="notifications" size={20} color={theme.orange} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Sistema de Alertas</Text>
              <Text style={{ fontSize: 11, color: theme.subtext }}>Probar recepción de notificaciones</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
        </TouchableOpacity>
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>MIS GESTIONES DEL DÍA</Text>
        <TouchableOpacity onPress={() => setActiveTab('list')} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.seeAllText}>VER TODO</Text>
          <Ionicons name="chevron-forward" size={12} color={theme.orange} />
        </TouchableOpacity>
      </View>

      <View style={styles.quickList}>
        {mySales.slice(0, 3).map((sale) => (
          <View key={sale.id} style={styles.saleItem}>
            <View style={[styles.statusIndicator, { backgroundColor: sale.estado === 'DESEMBOLSADO' ? theme.emerald : sale.estado === 'OBSERVADA' ? theme.orange : theme.blue }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.saleName}>{sale.nombres_cliente}</Text>
              <Text style={styles.saleMeta}>{sale.dni_cliente} • S/ {sale.maf_neto.toLocaleString()}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: sale.estado === 'DESEMBOLSADO' ? '#E1F8F0' : '#E8F0FF' }]}>
              <Text style={[styles.pillText, { color: sale.estado === 'DESEMBOLSADO' ? theme.emerald : theme.blue }]}>{sale.estado}</Text>
            </View>
          </View>
        ))}
        {mySales.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="document-text-outline" size={40} color={theme.border} />
            <Text style={styles.emptyText}>No hay gestiones hoy.</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => setActiveTab('form')}>
        <Ionicons name="add" size={32} color={theme.white} />
      </TouchableOpacity>
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderList = () => (
    <View style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: 20 }]}>
        <Text style={styles.welcomeText}>BANDEJA DE EXPEDIENTES</Text>
        <TouchableOpacity><Ionicons name="filter" size={20} color={theme.blue} /></TouchableOpacity>
      </View>
      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {mySales.map((sale) => (
          <TouchableOpacity key={sale.id} style={styles.fullSaleCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDni}>{sale.dni_cliente}</Text>
              <View style={[styles.pill, { backgroundColor: sale.estado === 'DESEMBOLSADO' ? '#E1F8F0' : '#E8F0FF' }]}>
                <Text style={[styles.pillText, { color: sale.estado === 'DESEMBOLSADO' ? theme.emerald : theme.blue }]}>{sale.estado}</Text>
              </View>
            </View>
            <Text style={styles.cardName}>{sale.nombres_cliente}</Text>
            <View style={styles.cardFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="wallet-outline" size={14} color={theme.text} style={{ marginRight: 5 }} />
                <Text style={styles.cardAmount}>S/ {sale.maf_neto.toLocaleString()}</Text>
              </View>
              <Text style={styles.cardDate}>{new Date(sale.fecha_ingreso).toLocaleDateString()}</Text>
            </View>
            {sale.estado === 'POR INGRESAR' && (
              <View style={styles.warningAlert}>
                <Ionicons name="alert-circle" size={14} color="#D97706" style={{ marginRight: 5 }} />
                <Text style={styles.warningText}>FILE PENDIENTE (48H)</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );

  const renderForm = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>NUEVO EXPEDIENTE</Text>
      </View>
      <View style={styles.formCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
          <Ionicons name="person-circle" size={20} color={theme.blue} style={{ marginRight: 10 }} />
          <Text style={styles.inputLabel}>DATOS DEL CLIENTE</Text>
        </View>
        <TextInput 
          style={styles.input} 
          placeholder="DNI del Cliente" 
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: -5 }}>
            <ActivityIndicator size="small" color={theme.orange} />
            <Text style={{ fontSize: 12, color: theme.subtext, marginLeft: 10 }}>Buscando información...</Text>
          </View>
        )}
        {clientAge && (
          <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 15, marginTop: -10, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: theme.blue }}>
            <Ionicons name="calendar" size={18} color={theme.blue} style={{ marginRight: 10 }} />
            <View>
              <Text style={{ fontSize: 10, fontWeight: '900', color: theme.subtext, letterSpacing: 1 }}>EDAD ESTIMADA</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.blue }}>{clientAge}</Text>
            </View>
          </View>
        )}
        <TextInput 
          style={styles.input} 
          placeholder="Nombres Completos" 
          value={nombres} 
          onChangeText={(text) => {
            // Este filtro asegura que SOLO se guarden letras y espacios. 
            // Cualquier otro caracter es ignorado al instante.
            const filtered = text.split('').filter(char => 
              /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/.test(char)
            ).join('');
            setNombres(filtered);
          }}
          autoCapitalize="words"
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 }}>
          <Ionicons name="briefcase" size={20} color={theme.blue} style={{ marginRight: 10 }} />
          <Text style={styles.inputLabel}>CONDICIONES</Text>
        </View>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={convenio} onValueChange={setConvenio} style={{ height: 50 }}>
            {simConfig?.convenios ? [
              { label: 'Seleccionar Convenio...', value: '' },
              ...simConfig.convenios.map((c: any) => ({ label: c.nombre, value: c.id }))
            ].map(c => <Picker.Item key={c.value} label={c.label} value={c.value} />) : 
            CONVENIOS.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} />)}
          </Picker>
        </View>
        <View style={styles.inputWrapper}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.blue, marginRight: 5 }}>S/</Text>
          <TextInput 
            style={[styles.input, { marginBottom: 0, flex: 1, backgroundColor: 'transparent' }]} 
            placeholder="0.00" 
            value={maf} 
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9.]/g, '');
              // Evitar más de un punto decimal
              const parts = cleaned.split('.');
              if (parts.length <= 2) setMaf(cleaned);
            }} 
            keyboardType="decimal-pad" 
          />
        </View>

        <View style={styles.attachmentSection}>
          <View style={styles.attachmentHeader}>
            <Ionicons name="attach" size={20} color={theme.blue} style={{ marginRight: 10 }} />
            <Text style={styles.inputLabel}>DOCUMENTACIÓN ADJUNTA</Text>
            <View style={styles.attachmentCount}>
              <Text style={styles.attachmentCountText}>{attachments.length}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.uploadZone} onPress={pickDocument}>
            <View style={styles.uploadCircle}>
              <Ionicons name="cloud-upload" size={24} color={theme.orange} />
            </View>
            <Text style={styles.uploadTitle}>Seleccionar archivos</Text>
            <Text style={styles.uploadSubtitle}>PDF o Imágenes (Máx. 10MB)</Text>
          </TouchableOpacity>

          {attachments.length > 0 && (
            <View style={styles.attachmentsList}>
              {attachments.map((att, index) => (
                <View key={index} style={styles.attachmentCard}>
                  <View style={styles.fileIconBox}>
                    <Ionicons
                      name={att.type.includes('image') ? "image" : "document-text"}
                      size={20}
                      color={theme.blue}
                    />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{att.name}</Text>
                    <Text style={styles.fileType}>{att.type.split('/')[1].toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeAttachment(index)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={18} color={theme.rose} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.buttonText}>ENVIAR A EVALUACIÓN</Text>
              <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 10 }} />
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

  const renderSimulator = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>SIMULADOR BCP</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>CONVENIO Y CARGO</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={simForm.convenioId}
            onValueChange={(val) => setSimForm({ ...simForm, convenioId: val })}
            style={{ height: 50 }}
          >
            {simConfig?.convenios.map((c: any) => (
              <Picker.Item key={c.id} label={c.nombre} value={c.id} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={simForm.cargoId}
            onValueChange={(val) => setSimForm({ ...simForm, cargoId: val })}
            style={{ height: 50 }}
          >
            {simConfig?.cargos.map((c: any) => (
              <Picker.Item key={c.id} label={c.nombre} value={c.id} />
            ))}
          </Picker>
        </View>

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>INGRESOS Y DESCUENTOS</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 9, color: theme.subtext, marginBottom: 5 }}>ING. FIJO</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={simForm.ingresosFijos}
              onChangeText={(t) => setSimForm({ ...simForm, ingresosFijos: t })}
            />
          </View>
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 9, color: theme.subtext, marginBottom: 5 }}>ING. VARIABLE</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={simForm.ingresosVariables}
              onChangeText={(t) => setSimForm({ ...simForm, ingresosVariables: t })}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 9, color: theme.subtext, marginBottom: 5 }}>DESC. LEY</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={simForm.descuentosLey}
              onChangeText={(t) => setSimForm({ ...simForm, descuentosLey: t })}
            />
          </View>
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 9, color: theme.subtext, marginBottom: 5 }}>OTROS DESC.</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={simForm.otrosDescuentos}
              onChangeText={(t) => setSimForm({ ...simForm, otrosDescuentos: t })}
            />
          </View>
        </View>

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>SOLICITUD</Text>
        <TextInput
          style={styles.input}
          placeholder="Monto a Solicitar"
          keyboardType="decimal-pad"
          value={simForm.montoSolicitado}
          onChangeText={(t) => setSimForm({ ...simForm, montoSolicitado: t })}
        />

        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={simForm.cuotas}
            onValueChange={(val) => setSimForm({ ...simForm, cuotas: val })}
            style={{ height: 50 }}
          >
            {[12, 18, 24, 36, 48, 60, 72].map(n => (
              <Picker.Item key={n} label={`${n} Meses`} value={n.toString()} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity 
          style={[styles.primaryButton, { marginTop: 20 }]} 
          onPress={handleSimulateMobile}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.buttonText}>CALCULAR CRÉDITO</Text>
          )}
        </TouchableOpacity>

        {simResult && (
          <View style={[simStyles.simResultCard, { marginTop: 30 }]}>
            <Text style={simStyles.simResultTitle}>RESULTADO DE SIMULACIÓN</Text>
            
            <View style={simStyles.simHighlight}>
              <Text style={simStyles.simHighlightLabel}>CUOTA MENSUAL</Text>
              <Text style={simStyles.simHighlightValue}>S/ {simResult.resumen.cuota_mensual.toLocaleString()}</Text>
            </View>

            <View style={simStyles.simGrid}>
              <View style={simStyles.simStat}>
                <Text style={simStyles.simStatLabel}>TEA APLICADA</Text>
                <Text style={simStyles.simStatValue}>{(simResult.resumen.tea * 100).toFixed(2)}%</Text>
              </View>
              <View style={simStyles.simStat}>
                <Text style={simStyles.simStatLabel}>PLAZO</Text>
                <Text style={simStyles.simStatValue}>{simResult.resumen.plazo} Meses</Text>
              </View>
              <View style={simStyles.simStat}>
                <Text style={simStyles.simStatLabel}>CAPACIDAD MÁX.</Text>
                <Text style={simStyles.simStatValue}>S/ {simResult.resumen.capacidad_maxima.toLocaleString()}</Text>
              </View>
              <View style={simStyles.simStat}>
                <Text style={simStyles.simStatLabel}>INGRESO NETO</Text>
                <Text style={simStyles.simStatValue}>S/ {simResult.resumen.ingreso_neto_disponible.toLocaleString()}</Text>
              </View>
            </View>

            <View style={[simStyles.rciBadge, { backgroundColor: simResult.validaciones.rci_valido ? '#E1F8F0' : '#FFF1F2' }]}>
              <Text style={[simStyles.rciBadgeText, { color: simResult.validaciones.rci_valido ? theme.emerald : theme.rose }]}>
                {simResult.validaciones.rci_valido ? 'RCI DENTRO DEL LÍMITE' : 'EXCEDE RCI PERMITIDO'}
              </Text>
            </View>
          </View>
        )}
        
        <View style={{ height: 120 }} />
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {!token ? renderLogin() : (
        <View style={{ flex: 1 }}>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'list' && renderList()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'simulator' && renderSimulator()}

          {/* TAB BAR */}
          <View style={[styles.tabBar, isLandscape && { bottom: 10, width: '70%', alignSelf: 'center' }]}>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
              <Ionicons name={activeTab === 'home' ? "home" : "home-outline"} size={22} color={activeTab === 'home' ? theme.white : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.tabText, activeTab === 'home' && styles.tabActive]}>INICIO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('list')}>
              <Ionicons name={activeTab === 'list' ? "list" : "list-outline"} size={22} color={activeTab === 'list' ? theme.white : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.tabText, activeTab === 'list' && styles.tabActive]}>BANDEJA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('simulator')}>
              <Ionicons name={activeTab === 'simulator' ? "calculator" : "calculator-outline"} size={22} color={activeTab === 'simulator' ? theme.white : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.tabText, activeTab === 'simulator' && styles.tabActive]}>CALCULAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('form')}>
              <Ionicons name={activeTab === 'form' ? "add-circle" : "add-circle-outline"} size={22} color={activeTab === 'form' ? theme.white : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.tabText, activeTab === 'form' && styles.tabActive]}>NUEVO</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}


