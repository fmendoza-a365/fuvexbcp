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
  AppState
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, DARK_COLORS, API_URL, CONVENIOS } from './src/constants/theme';
import { createStyles } from './src/styles/global';
import { LoginView } from './src/components/LoginView';
import SimulatorView from './src/components/SimulatorView';
import ExpedienteDetail from './src/components/ExpedienteDetail';
import {
  registerForPushNotifications,
  unregisterPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener
} from './src/services/pushService';
import { setAuthToken } from './src/api/client';

interface Attachment {
  uri: string;
  name: string;
  type: string;
}

type ActiveTab = 'home' | 'list' | 'form' | 'simulator';

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const [mySales, setMySales] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [plaza, setPlaza] = useState('');
  const [convenio, setConvenio] = useState('');
  const [convenioOptions, setConvenioOptions] = useState(CONVENIOS);
  const [maf, setMaf] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [feedback, setFeedback] = useState('');
  const [clientAge, setClientAge] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [isSearchingDni, setIsSearchingDni] = useState(false);

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

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [salesRes, kpiRes] = await Promise.all([
        axios.get(`${API_URL}/sales`, { headers }),
        axios.get(`${API_URL}/analytics/dashboard`, { headers })
      ]);
      setMySales(normalizeSalesResponse(salesRes.data));
      setKpi(kpiRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const fetchConvenios = async () => {
    if (!token) return;

    try {
      const res = await axios.get(`${API_URL}/simulator/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const convenios = Array.isArray(res.data?.convenios) ? res.data.convenios : [];
      const options = convenios
        .filter((item: any) => item?.nombre)
        .map((item: any) => ({ label: item.nombre, value: item.nombre }));

      setConvenioOptions([
        { label: 'Seleccionar Convenio...', value: '' },
        ...(options.length > 0 ? options : CONVENIOS.slice(1))
      ]);
    } catch (error) {
      console.error('Convenios fetch error:', error);
      setConvenioOptions(CONVENIOS);
    }
  };

  useEffect(() => {
    if (!token) return;

    registerForPushNotifications();

    const receivedSub = addNotificationReceivedListener((notification) => {
      console.log('Notification received in foreground:', notification.request.content.title);
      fetchData();
    });

    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.saleId) {
        setSelectedSaleId(data.saleId as string);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetchData();
    fetchConvenios();
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

  const testPush = async () => {
    try {
      await axios.post(`${API_URL}/notifications/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Enviado', 'Se solicito una notificacion de prueba.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la prueba.');
    }
  };

  const handleLogin = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      Alert.alert('Faltan datos', 'Ingresa usuario y contrasena.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username: cleanUsername, password });
      setAuthToken(res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (error: any) {
      const message = error.response?.data?.error ||
        (error.request ? `No se pudo conectar al API movil (${API_URL}). Verifica que el backend este iniciado y que el celular este en la misma red WiFi.` : 'Credenciales invalidas');
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true
      });

      if (!result.canceled) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream'
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
      Alert.alert('Faltan datos', 'Completa los campos obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const saleRes = await axios.post(
        `${API_URL}/sales`,
        {
          dni_cliente: dni,
          nombres_cliente: nombres,
          plaza,
          convenio,
          maf_neto: parseFloat(maf),
          fecha_ingreso: new Date().toISOString(),
          feedback
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const saleId = saleRes.data.id;
      for (const att of attachments) {
        const formData = new FormData();
        formData.append('tipo_documento', 'DOC');
        formData.append('dni_cliente', dni);
        formData.append('documento', { uri: att.uri, name: att.name, type: att.type } as any);

        await axios.post(`${API_URL}/sales/${saleId}/documentos?dni=${dni}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      Alert.alert('Exito', 'Expediente registrado correctamente.');
      resetForm();
      setActiveTab('list');
      fetchData();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo registrar la operacion.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDni('');
    setNombres('');
    setPlaza('');
    setConvenio('');
    setMaf('');
    setAttachments([]);
    setFeedback('');
    setClientAge(null);
    setClientData(null);
  };

  const statusColor = (estado: string) => {
    if (estado === 'DESEMBOLSADO' || estado === 'APROBADA' || estado === 'CONFORMIDAD') return theme.emerald;
    if (estado === 'OBSERVADA' || estado === 'OBSERVADO_BACK' || estado === 'POR INGRESAR') return theme.orange;
    if (estado?.includes('RECHAZ')) return theme.rose;
    return theme.blue;
  };

  const statusBg = (estado: string) => {
    if (estado === 'DESEMBOLSADO' || estado === 'APROBADA' || estado === 'CONFORMIDAD') return theme.emeraldSoft;
    if (estado === 'OBSERVADA' || estado === 'OBSERVADO_BACK' || estado === 'POR INGRESAR') return theme.orangeSoft;
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

  const renderHome = () => (
    <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
      {renderHeader(
        `Hola, ${user?.nombre?.split(' ')[0] || 'equipo'}`,
        'Gestiona tu avance y expedientes activos.',
        <TouchableOpacity style={styles.profileBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.orange} />
        </TouchableOpacity>
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

      <TouchableOpacity
        style={[
          styles.fullSaleCard,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }
        ]}
        onPress={testPush}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{ backgroundColor: theme.orangeSoft, padding: 10, borderRadius: 10, marginRight: 14 }}>
            <Ionicons name="notifications" size={20} color={theme.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>Sistema de alertas</Text>
            <Text style={{ fontSize: 11, color: theme.subtext, marginTop: 2 }}>Probar recepcion de notificaciones</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
      </TouchableOpacity>

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
                {sale.dni_cliente} | S/ {(Number(sale.maf_neto) || 0).toLocaleString()}
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
                <Text style={styles.cardDni}>DNI {sale.dni_cliente}</Text>
                <View style={[styles.pill, { backgroundColor: statusBg(sale.estado) }]}>
                  <Text style={[styles.pillText, { color: statusColor(sale.estado) }]}>{sale.estado}</Text>
                </View>
              </View>
              <Text style={styles.cardName}>{sale.nombres_cliente}</Text>
              <View style={styles.cardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="wallet-outline" size={14} color={theme.text} style={{ marginRight: 5 }} />
                  <Text style={styles.cardAmount}>S/ {(Number(sale.maf_neto) || 0).toLocaleString()}</Text>
                </View>
                <Text style={styles.cardDate}>{new Date(sale.fecha_ingreso).toLocaleDateString()}</Text>
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

              {sale.estado === 'POR INGRESAR' && (
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
      {renderHeader('Nuevo expediente', 'Registra al cliente y adjunta la documentacion requerida.')}

      <View style={styles.formCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: -5 }}>
            <ActivityIndicator size="small" color={theme.orange} />
            <Text style={{ fontSize: 12, color: theme.subtext, marginLeft: 10 }}>Buscando informacion...</Text>
          </View>
        )}

        {clientAge && (
          <View
            style={{
              backgroundColor: theme.blueSoft,
              padding: 12,
              borderRadius: 10,
              marginTop: -10,
              marginBottom: 15,
              flexDirection: 'row',
              alignItems: 'center',
              borderLeftWidth: 4,
              borderLeftColor: theme.blue
            }}
          >
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
          onChangeText={(text) => setNombres(text.replace(/[^\p{L}\s]/gu, ''))}
          autoCapitalize="words"
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 }}>
          <Ionicons name="briefcase" size={20} color={theme.blue} style={{ marginRight: 10 }} />
          <Text style={styles.inputLabel}>CONDICIONES</Text>
        </View>

        <View style={styles.pickerWrapper}>
          <Picker selectedValue={convenio} onValueChange={setConvenio} style={{ height: 50, color: theme.text }}>
            {convenioOptions.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} />)}
          </Picker>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: theme.blue, marginRight: 5 }}>S/</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0, flex: 1, backgroundColor: 'transparent', borderWidth: 0 }]}
            placeholder="0.00"
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

        <View style={styles.attachmentSection}>
          <View style={styles.attachmentHeader}>
            <Ionicons name="attach" size={20} color={theme.blue} style={{ marginRight: 10 }} />
            <Text style={styles.inputLabel}>DOCUMENTACION ADJUNTA</Text>
            <View style={styles.attachmentCount}>
              <Text style={styles.attachmentCountText}>{attachments.length}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.uploadZone} onPress={pickDocument}>
            <View style={styles.uploadCircle}>
              <Ionicons name="cloud-upload" size={24} color={theme.orange} />
            </View>
            <Text style={styles.uploadTitle}>Seleccionar archivos</Text>
            <Text style={styles.uploadSubtitle}>PDF o imagenes hasta 10MB</Text>
          </TouchableOpacity>

          {attachments.length > 0 && (
            <View style={styles.attachmentsList}>
              {attachments.map((att, index) => (
                <View key={`${att.name}-${index}`} style={styles.attachmentCard}>
                  <View style={styles.fileIconBox}>
                    <Ionicons
                      name={att.type.includes('image') ? 'image' : 'document-text'}
                      size={20}
                      color={theme.blue}
                    />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{att.name}</Text>
                    <Text style={styles.fileType}>{att.type.split('/')[1]?.toUpperCase() || 'FILE'}</Text>
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
          {loading ? (
            <ActivityIndicator color={theme.whiteText} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.buttonText}>ENVIAR A EVALUACION</Text>
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

  const renderSimulator = () => (
    <SimulatorView isDark={isDark} token={token || ''} />
  );

  const inactiveTabColor = 'rgba(255,255,255,0.56)';
  const activeTabColor = theme.whiteText;

  if (!token) {
    return renderLogin();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {selectedSaleId ? (
        <ExpedienteDetail
          saleId={selectedSaleId}
          onClose={() => {
            setSelectedSaleId(null);
            fetchData();
          }}
          isDark={isDark}
          theme={theme}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'list' && renderList()}
          {activeTab === 'form' && renderForm()}
          {activeTab === 'simulator' && renderSimulator()}

          <View style={[styles.tabBar, isLandscape && { bottom: 10, width: '70%', alignSelf: 'center' }]}>
            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
              <Ionicons
                name={activeTab === 'home' ? 'home' : 'home-outline'}
                size={22}
                color={activeTab === 'home' ? activeTabColor : inactiveTabColor}
              />
              <Text style={[styles.tabText, activeTab === 'home' && styles.tabActive]}>INICIO</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('list')}>
              <Ionicons
                name={activeTab === 'list' ? 'list' : 'list-outline'}
                size={22}
                color={activeTab === 'list' ? activeTabColor : inactiveTabColor}
              />
              <Text style={[styles.tabText, activeTab === 'list' && styles.tabActive]}>BANDEJA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('simulator')}>
              <Ionicons
                name={activeTab === 'simulator' ? 'calculator' : 'calculator-outline'}
                size={22}
                color={activeTab === 'simulator' ? activeTabColor : inactiveTabColor}
              />
              <Text style={[styles.tabText, activeTab === 'simulator' && styles.tabActive]}>CALCULAR</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('form')}>
              <Ionicons
                name={activeTab === 'form' ? 'document-text' : 'document-text-outline'}
                size={22}
                color={activeTab === 'form' ? activeTabColor : inactiveTabColor}
              />
              <Text style={[styles.tabText, activeTab === 'form' && styles.tabActive]}>NUEVO</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
