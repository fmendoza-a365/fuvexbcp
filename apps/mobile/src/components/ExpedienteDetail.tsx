/**
 * ═══════════════════════════════════════════════════
 * ExpedienteDetail — Vista de detalle con next-steps
 * Muestra información del expediente + pasos guiados
 * ═══════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet, RefreshControl, Linking, Modal, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import api from '../api/client';
import { DESIGN } from '../constants/theme';

interface NextStep {
  step: number;
  action: string;
  description: string;
  targetState: string;
  icon: string;
  urgent: boolean;
}

interface ChecklistItem {
  tipo: string;
  nombre: string;
  obligatorio: boolean;
  orden: number;
  subido: boolean;
  cantidad: number;
}

interface ObservationItem {
  id: string;
  titulo: string;
  texto: string;
  autor?: string;
  fecha?: string;
}

interface TimelineEvent {
  id: string;
  source: string;
  type: string;
  title: string;
  text: string;
  created_at?: string;
  actor?: {
    username?: string;
    nombre?: string;
    role?: string;
  };
}

interface ExpedienteDetailProps {
  saleId: string;
  onClose: () => void;
  onOpenCalculator?: (sale: any) => void;
  isDark: boolean;
  theme: any;
}

const getEstadoColor = (estado: string, theme: any) => {
  if (['DESEMBOLSADO', 'REMESA_APROBADA', 'PENDIENTE_DESEMBOLSO', 'FILE_VALIDADO'].includes(estado)) return theme.emerald;
  if (['OBS_BACK_OFFICE', 'OBS_BCP', 'PROSPECTO_NUEVO', 'PENDIENTE_BOLETA', 'PENDIENTE_DATOS_FILE', 'REMESA_REDUCIDA', 'PENDIENTE_REASIGNACION'].includes(estado)) return theme.orange;
  if (estado?.includes('RECHAZ')) return theme.rose;
  if (estado?.includes('PENDIENTE')) return theme.amber;
  return theme.blue;
};

const normalizeChecklistItem = (item: any): ChecklistItem => ({
  tipo: item.tipo || item.tipo_documento || 'DOC',
  nombre: item.nombre || item.descripcion || item.tipo_documento || item.tipo || 'Documento',
  obligatorio: Boolean(item.obligatorio),
  orden: Number(item.orden || 0),
  subido: Boolean(item.subido || item.completado),
  cantidad: Number(item.cantidad || (item.subido || item.completado ? 1 : 0))
});

const CALCULATOR_STATES = new Set(['EVALUACION_CALCULADORA', 'COTIZACION_ENVIADA', 'PENDIENTE_ACEPTACION_CLIENTE']);
const DOCUMENT_UPLOAD_STATES = new Set(['PENDIENTE_BOLETA', 'PENDIENTE_DATOS_FILE', 'OBS_BACK_OFFICE']);

const SEMAFORO_COLORS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  VERDE: { label: 'APROBADO (VERDE)', color: '#10B981', bg: '#E6F4EA', icon: 'checkmark-circle-outline' },
  AMARILLO: { label: 'ALERTA (AMARILLO)', color: '#F59E0B', bg: '#FEF3C7', icon: 'alert-circle-outline' },
  ROJO: { label: 'RECHAZADO (ROJO)', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' },
  GRIS: { label: 'SIN REGISTRO', color: '#6B7280', bg: '#F3F4F6', icon: 'help-circle-outline' },
};

const TIMELINE_FILTERS = [
  { key: 'all', label: 'Todo' },
  { key: 'state', label: 'Estados' },
  { key: 'note', label: 'Notas' },
  { key: 'document', label: 'Docs' },
  { key: 'rcc', label: 'RCC' },
  { key: 'mail', label: 'Correo' },
  { key: 'digitalizacion', label: 'BCP' },
  { key: 'system', label: 'Sistema' }
];

const PDF_CORRECTION_FIELDS = [
  { key: 'dni_cliente', label: 'DNI cliente', type: 'text' },
  { key: 'nombres_cliente', label: 'Nombres cliente', type: 'text' },
  { key: 'celular', label: 'Celular', type: 'text' },
  { key: 'correo', label: 'Correo', type: 'email' },
  { key: 'estado_civil_cliente', label: 'Estado civil', type: 'text' },
  { key: 'direccion', label: 'Direccion', type: 'text' },
  { key: 'departamento', label: 'Departamento', type: 'text' },
  { key: 'provincia', label: 'Provincia', type: 'text' },
  { key: 'distrito', label: 'Distrito', type: 'text' },
  { key: 'convenio', label: 'Convenio', type: 'text' },
  { key: 'entidad_laboral', label: 'Entidad laboral', type: 'text' },
  { key: 'cargo_laboral', label: 'Cargo laboral', type: 'text' },
  { key: 'monto_solicitado', label: 'Monto solicitado', type: 'number' },
  { key: 'plazo_deseado', label: 'Plazo deseado', type: 'number' },
  { key: 'cotizacion_monto', label: 'Monto cotizado', type: 'number' },
  { key: 'cotizacion_plazo', label: 'Plazo cotizado', type: 'number' },
  { key: 'cotizacion_cuota', label: 'Cuota cotizada', type: 'number' },
  { key: 'conyuge_dni', label: 'DNI conyuge', type: 'text' },
  { key: 'conyuge_nombres', label: 'Nombres conyuge', type: 'text' },
] as const;

const PDF_NUMERIC_FIELDS = new Set(['monto_solicitado', 'plazo_deseado', 'cotizacion_monto', 'cotizacion_plazo', 'cotizacion_cuota']);

const buildPdfCorrectionForm = (source: any = {}) => PDF_CORRECTION_FIELDS.reduce((acc, field) => {
  const rawValue = source?.[field.key];
  acc[field.key] = rawValue === null || rawValue === undefined ? '' : String(rawValue);
  return acc;
}, {} as Record<string, string>);

const getTimelineIconName = (type: string) => {
  if (type === 'state') return 'git-branch-outline';
  if (type === 'note') return 'chatbox-ellipses-outline';
  if (type === 'document') return 'document-text-outline';
  if (type === 'rcc') return 'shield-checkmark-outline';
  if (type === 'mail') return 'mail-outline';
  return 'time-outline';
};

export default function ExpedienteDetail({ saleId, onClose, onOpenCalculator, isDark, theme }: ExpedienteDetailProps) {
  const [sale, setSale] = useState<any>(null);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineItems, setTimelineItems] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelinePages, setTimelinePages] = useState(1);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [showPdfEditor, setShowPdfEditor] = useState(false);
  const [pdfForm, setPdfForm] = useState<Record<string, string>>({});
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfSaved, setPdfSaved] = useState(false);

  const fetchDetail = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [saleRes, stepsRes, checkRes] = await Promise.all([
        api.get(`/sales/${saleId}`),
        api.get(`/sales/${saleId}/next-steps`).catch(() => ({ data: { nextSteps: [] } })),
        api.get(`/sales/${saleId}/documentos/checklist`).catch(() => ({ data: { checklist: [] } })),
      ]);
      setSale(saleRes.data);
      setNextSteps(stepsRes.data.nextSteps || []);
      setChecklist((checkRes.data.checklist || []).map(normalizeChecklistItem));
    } catch (error) {
      console.warn('Error fetching detail:', error);
      if (showLoader) Alert.alert('Error', 'No se pudo cargar el expediente');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    fetchDetail(true);
    const interval = setInterval(() => fetchDetail(false), 30000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetail(false);
    setRefreshing(false);
  }, [fetchDetail]);

  const fetchTimeline = useCallback(async (page = 1, append = false) => {
    setTimelineLoading(true);
    try {
      const res = await api.get(`/sales/${saleId}/timeline`, {
        params: { page, limit: 50, type: timelineFilter }
      });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setTimelineItems(current => append ? [...current, ...rows] : rows);
      setTimelinePage(res.data?.pagination?.page || page);
      setTimelinePages(res.data?.pagination?.pages || 1);
      setTimelineTotal(res.data?.pagination?.total || rows.length);
    } catch (error) {
      console.warn('Error fetching timeline:', error);
      Alert.alert('Error', 'No se pudo cargar la trazabilidad completa.');
    } finally {
      setTimelineLoading(false);
    }
  }, [saleId, timelineFilter]);

  useEffect(() => {
    if (!showTimeline) return;
    fetchTimeline(1, false);
  }, [showTimeline, timelineFilter, fetchTimeline]);

  useEffect(() => {
    if (!sale) return;
    setPdfForm(buildPdfCorrectionForm(sale));
    setPdfSaved(false);
  }, [sale?.id, sale?.updated_at, sale?.version]);

  const pdfBaseline = buildPdfCorrectionForm(sale || {});
  const pdfDirty = PDF_CORRECTION_FIELDS.some((field) => (pdfForm[field.key] || '').trim() !== (pdfBaseline[field.key] || '').trim());

  const handlePdfFieldChange = (key: string, value: string) => {
    setPdfForm(current => ({ ...current, [key]: value }));
    setPdfSaved(false);
  };

  const handleUploadChecklistDocument = useCallback(async (item: ChecklistItem) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: false
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingDoc(item.tipo);

      const formData = new FormData();
      formData.append('tipo_documento', item.tipo);
      formData.append('dni_cliente', sale?.dni_cliente || '');
      formData.append('documento', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream'
      } as any);

      await api.post(`/sales/${saleId}/documentos?dni=${sale?.dni_cliente || ''}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Alert.alert('Documento cargado', `${item.nombre} fue subido correctamente.`);
      await fetchDetail(false);
    } catch (error) {
      console.warn('Error uploading checklist document:', error);
      Alert.alert('Error', 'No se pudo subir el documento.');
    } finally {
      setUploadingDoc(null);
    }
  }, [fetchDetail, sale?.dni_cliente, saleId]);

  const showApiError = (error: any, fallback: string) => {
    const message = error.response?.data?.error ||
      (Array.isArray(error.response?.data?.documentos_faltantes)
        ? `Faltan documentos: ${error.response.data.documentos_faltantes.join(', ')}`
        : fallback);
    Alert.alert('No se pudo completar', message);
  };

  const advanceEstado = useCallback(async (nuevoEstado: string, successMessage: string, detalles?: string, motivo?: string) => {
    if (!sale) return;
    setActionLoading(nuevoEstado);
    try {
      await api.put(`/sales/${saleId}/estado`, {
        nuevo_estado: nuevoEstado,
        detalles: detalles || successMessage,
        motivo,
        expected_version: sale.version
      });
      Alert.alert('Actualizado', successMessage);
      await fetchDetail(false);
    } catch (error: any) {
      showApiError(error, 'No se pudo actualizar el estado.');
    } finally {
      setActionLoading(null);
    }
  }, [fetchDetail, sale, saleId]);

  const handleConsultarRCC = useCallback(async (sujeto: 'cliente' | 'conyuge') => {
    if (!sale) return;
    setActionLoading(`rcc-${sujeto}`);
    try {
      await api.post(`/sales/${saleId}/rcc`, {
        sujeto,
        conyuge_dni: sujeto === 'conyuge' ? sale.conyuge_dni : undefined
      });
      Alert.alert('Consulta Exitosa', `Se consultó el Infoburo para el ${sujeto === 'conyuge' ? 'cónyuge' : 'titular'} con éxito.`);
      await fetchDetail(false);
    } catch (error: any) {
      const msg = error.response?.data?.error || `No se pudo consultar el RCC del ${sujeto}.`;
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(null);
    }
  }, [fetchDetail, sale, saleId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!sale) return;
    setPdfLoading(true);
    try {
      // Open PDF in device browser
      const baseUrl = api.defaults.baseURL || '';
      const pdfUrl = `${baseUrl}/sales/${saleId}/pdf?download=1`;
      await Linking.openURL(pdfUrl);
    } catch (error) {
      console.warn('Error opening PDF:', error);
      Alert.alert('Error', 'No se pudo abrir el PDF de convenio.');
    } finally {
      setPdfLoading(false);
    }
  }, [sale, saleId]);

  const sendCotizacionWhatsApp = useCallback(async () => {
    if (!sale) return;
    setActionLoading('cotizacion-whatsapp');
    try {
      const res = await api.post(`/sales/${saleId}/cotizacion/imagen`);
      const whatsappUrl = res.data?.whatsapp_url;
      const imageUrl = res.data?.image_url;
      if (!whatsappUrl) {
        throw new Error('No se recibio el enlace de WhatsApp.');
      }

      const phone = res.data?.phone;
      const message = encodeURIComponent(res.data?.message || '');
      const nativeUrl = phone
        ? `whatsapp://send?phone=${phone}&text=${message}`
        : `whatsapp://send?text=${message}`;
      const canOpenNative = await Linking.canOpenURL(nativeUrl).catch(() => false);
      await Linking.openURL(canOpenNative ? nativeUrl : whatsappUrl);

      if (imageUrl) {
        Alert.alert('Cotizacion lista', 'WhatsApp se abrio con el mensaje y enlace de la imagen generada.');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'No se pudo generar la cotizacion para WhatsApp.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(null);
    }
  }, [sale, saleId]);

  const savePdfCorrection = useCallback(async () => {
    if (!sale) return;
    setPdfSaving(true);
    try {
      const baseline = buildPdfCorrectionForm(sale);
      const payload: Record<string, any> = {};

      for (const field of PDF_CORRECTION_FIELDS) {
        const nextValue = (pdfForm[field.key] || '').trim();
        const previousValue = (baseline[field.key] || '').trim();
        if (nextValue === previousValue) continue;

        if (['dni_cliente', 'nombres_cliente', 'celular'].includes(field.key) && !nextValue) {
          Alert.alert('Dato obligatorio', `${field.label} no puede quedar vacio.`);
          return;
        }

        if (['dni_cliente', 'conyuge_dni'].includes(field.key) && nextValue && !/^\d{8}$/.test(nextValue)) {
          Alert.alert('Dato invalido', `${field.label} debe tener 8 digitos.`);
          return;
        }

        if (field.key === 'correo' && nextValue && !/^\S+@\S+\.\S+$/.test(nextValue)) {
          Alert.alert('Correo invalido', 'El correo debe tener un formato valido.');
          return;
        }

        if (PDF_NUMERIC_FIELDS.has(field.key)) {
          if (nextValue === '') {
            payload[field.key] = null;
            continue;
          }
          const parsed = Number(nextValue);
          if (Number.isNaN(parsed)) {
            Alert.alert('Dato invalido', `${field.label} debe ser numerico.`);
            return;
          }
          payload[field.key] = parsed;
          continue;
        }

        payload[field.key] = nextValue || null;
      }

      if (Object.keys(payload).length === 0) {
        setPdfSaved(true);
        return;
      }

      if (sale.version) payload.expected_version = sale.version;

      await api.put(`/sales/${saleId}`, payload);
      await api.post(`/sales/${saleId}/pdf/regenerar`);
      await fetchDetail(false);
      setPdfSaved(true);
      Alert.alert('PDF actualizado', 'Los datos fueron guardados y el PDF fue regenerado.');
    } catch (error: any) {
      const message = error.response?.data?.error || 'No se pudo actualizar los datos del PDF.';
      Alert.alert('Error', message);
    } finally {
      setPdfSaving(false);
    }
  }, [fetchDetail, pdfForm, sale, saleId]);

  const registerBoleta = useCallback(async () => {
    setActionLoading('boleta');
    try {
      await api.post(`/sales/${saleId}/boleta`, {
        detalle: 'Boleta recibida desde app movil.'
      });
      Alert.alert('Boleta registrada', 'El prospecto quedo habilitado para evaluacion de calculadora.');
      await fetchDetail(false);
    } catch (error: any) {
      showApiError(error, 'No se pudo registrar la boleta.');
    } finally {
      setActionLoading(null);
    }
  }, [fetchDetail, saleId]);

  const registerCotizacionDecision = useCallback((acepta: boolean) => {
    Alert.alert(
      acepta ? 'Cliente acepta' : 'Cliente no acepta',
      acepta
        ? 'El expediente pasara a completar datos y documentos del file.'
        : 'El expediente se marcara como desistido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: acepta ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(acepta ? 'cotizacion-ok' : 'cotizacion-no');
            try {
              await api.post(`/sales/${saleId}/cotizacion/aceptacion`, {
                acepta,
                detalle: acepta
                  ? 'Cliente acepta cotizacion desde app movil.'
                  : 'Cliente no acepta cotizacion desde app movil.'
              });
              Alert.alert('Actualizado', acepta ? 'Cotizacion aceptada.' : 'Expediente marcado como desistido.');
              await fetchDetail(false);
            } catch (error: any) {
              showApiError(error, 'No se pudo registrar la decision del cliente.');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  }, [fetchDetail, saleId]);

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: theme.slate, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.blue} />
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={[s.container, { backgroundColor: theme.slate, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.text }}>Expediente no encontrado</Text>
      </View>
    );
  }

  const estadoColor = getEstadoColor(sale.estado, theme);
  const estadoBg = sale.estado?.includes('RECHAZ')
    ? theme.roseSoft
    : sale.estado?.includes('PENDIENTE') || sale.estado === 'PROSPECTO_NUEVO' || sale.estado?.startsWith('OBS_')
      ? theme.orangeSoft
      : ['DESEMBOLSADO', 'FILE_VALIDADO', 'REMESA_APROBADA', 'PENDIENTE_DESEMBOLSO'].includes(sale.estado)
        ? theme.emeraldSoft
        : theme.blueSoft;
  const diasEnEstado = sale.fecha_estado_desde
    ? Math.floor((Date.now() - new Date(sale.fecha_estado_desde).getTime()) / 86400000)
    : 0;
  const visibleChecklist = sale.estado === 'PENDIENTE_BOLETA'
    ? checklist.filter(d => d.tipo === 'BOLETA_PAGO' || d.nombre.toUpperCase().includes('BOLETA'))
    : checklist;
  const docsCompletados = visibleChecklist.filter(d => d.subido).length;
  const docsTotal = visibleChecklist.length;
  const docsProgress = docsTotal > 0 ? docsCompletados / docsTotal : 0;
  const boletaUploaded = sale.estado !== 'PENDIENTE_BOLETA' || visibleChecklist.some(d => d.subido && (d.tipo === 'BOLETA_PAGO' || d.nombre.toUpperCase().includes('BOLETA')));
  const isFinalState = ['DESEMBOLSADO', 'RECHAZADO', 'DESISTIDO'].includes(sale.estado);
  const hasSimulation = Boolean(sale.simulacion_id || sale.simulacion_dictamen || sale.calculadora_estado);
  const canUseCalculator = !isFinalState && CALCULATOR_STATES.has(sale.estado);
  const canUploadDocuments = DOCUMENT_UPLOAD_STATES.has(sale.estado);
  const isMarried = /CASAD/i.test(sale.estado_civil_cliente || '');
  const canShowDocuments = docsTotal > 0 && (canUploadDocuments || docsCompletados > 0 || ['VALIDACION_BACK_OFFICE', 'FILE_VALIDADO', 'ENVIADO_BCP_REMESA', 'OBS_BCP', 'REMESA_APROBADA', 'REMESA_REDUCIDA', 'PENDIENTE_DESEMBOLSO', 'PENDIENTE_CARTA_PODER', 'REENVIADO_BCP_COMPRA_DEUDA', 'PENDIENTE_CARTA_NO_ADEUDO', 'PENDIENTE_LIBERACION', 'DESEMBOLSADO'].includes(sale.estado));
  const operationalRows = [
    ['Celular', sale.celular || '-'],
    ['Correo', sale.correo || '-'],
    ['Estado civil', sale.estado_civil_cliente || '-'],
    ['Conyuge', sale.conyuge_nombres ? `${sale.conyuge_nombres}${sale.conyuge_dni ? ` | DNI ${sale.conyuge_dni}` : ''}` : '-'],
    ['Cargo', sale.cargo_laboral || '-'],
    ['Ubicacion', [sale.distrito, sale.provincia, sale.departamento].filter(Boolean).join(', ') || '-'],
    ['Plazo', sale.plazo_deseado ? `${sale.plazo_deseado} meses` : '-'],
  ];
  const actionButtons = [
    ...(sale.estado === 'PROSPECTO_NUEVO' ? [{
      key: 'VERIFICACION_SISTEMA',
      label: 'INICIAR VERIFICACION',
      icon: 'search-outline',
      variant: 'primary',
      onPress: () => advanceEstado('VERIFICACION_SISTEMA', 'Verificacion de sistema iniciada.', 'Vendedor inicia verificacion de sistema desde app movil.')
    }] : []),
    ...(sale.estado === 'PENDIENTE_BOLETA' ? [{
      key: 'boleta',
      label: 'REGISTRAR BOLETA RECIBIDA',
      icon: 'document-text-outline',
      variant: 'primary',
      onPress: registerBoleta,
      disabled: !boletaUploaded,
      hint: 'Sube la boleta en foto o PDF antes de registrar.'
    }] : []),
    ...(sale.estado === 'EVALUACION_CALCULADORA' ? [{
      key: 'calculadora',
      label: 'EVALUAR CON CALCULADORA',
      icon: 'calculator-outline',
      variant: 'primary',
      onPress: () => onOpenCalculator?.(sale)
    }] : []),
    ...((sale.cotizacion_monto || sale.simulacion_monto || sale.simulacion_id) ? [{
      key: 'cotizacion-whatsapp',
      label: 'ENVIAR COTIZACION POR WHATSAPP',
      icon: 'logo-whatsapp',
      variant: 'success',
      onPress: sendCotizacionWhatsApp,
      hint: 'Genera la imagen oficial de cotizacion y abre WhatsApp con el mensaje listo.'
    }] : []),
    ...(['COTIZACION_ENVIADA', 'PENDIENTE_ACEPTACION_CLIENTE'].includes(sale.estado) ? [
      {
        key: 'cotizacion-ok',
        label: 'CLIENTE ACEPTA',
        icon: 'checkmark-circle-outline',
        variant: 'success',
        onPress: () => registerCotizacionDecision(true)
      },
      {
        key: 'cotizacion-no',
        label: 'NO ACEPTA',
        icon: 'close-circle-outline',
        variant: 'danger',
        onPress: () => registerCotizacionDecision(false)
      }
    ] : []),
    ...(sale.estado === 'PENDIENTE_DATOS_FILE' ? [{
      key: 'VALIDACION_BACK_OFFICE',
      label: 'ENVIAR A BACK OFFICE',
      icon: 'send-outline',
      variant: 'primary',
      onPress: () => advanceEstado('VALIDACION_BACK_OFFICE', 'File enviado a validacion back office.', 'Vendedor completa file y lo envia a back office desde app movil.')
    }] : []),
    ...(sale.estado === 'OBS_BACK_OFFICE' ? [{
      key: 'VALIDACION_BACK_OFFICE',
      label: 'REENVIAR SUBSANACION',
      icon: 'send-outline',
      variant: 'primary',
      onPress: () => advanceEstado('VALIDACION_BACK_OFFICE', 'Subsanacion enviada a back office.', 'Vendedor subsana observacion desde app movil.')
    }] : [])
  ];
  const observations: ObservationItem[] = [
    ...(sale.feedback ? [{
      id: 'feedback-inicial',
      titulo: 'Observacion inicial',
      texto: sale.feedback,
      autor: sale.asesor?.nombre || sale.asesor?.username,
      fecha: sale.created_at
    }] : []),
    ...((sale.feedbackNotes || []).map((note: any) => ({
      id: note.id,
      titulo: 'Nota del expediente',
      texto: note.nota,
      autor: note.user?.nombre || note.user?.username,
      fecha: note.created_at
    }))),
    ...((sale.audit_logs || [])
      .filter((log: any) => Boolean(log.detalles))
      .map((log: any) => ({
        id: log.id,
        titulo: log.estado_nuevo ? `Cambio a ${log.estado_nuevo}` : (log.accion || 'Actualizacion'),
        texto: log.detalles,
        autor: log.user?.nombre || log.user?.username,
        fecha: log.created_at
      })))
  ];

  return (
    <View style={[s.container, { backgroundColor: theme.slate }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.white, borderColor: theme.border }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={onClose} style={[s.backBtn, { backgroundColor: theme.input }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={[s.estadoBadge, { backgroundColor: estadoBg, borderColor: theme.border }]}>
            <View style={[s.estadoDot, { backgroundColor: estadoColor }]} />
            <Text style={[s.estadoText, { color: estadoColor }]} numberOfLines={1}>{sale.estado}</Text>
          </View>
        </View>
        <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={2}>{sale.nombres_cliente}</Text>
        <View style={s.headerMetaRow}>
          <Text style={[s.headerSub, { color: theme.subtext }]}>DNI {sale.dni_cliente}</Text>
          <Text style={[s.headerSub, { color: theme.subtext }]}>Expediente activo</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.blue}
            colors={[theme.blue]}
          />
        }
      >
        {/* Info Cards */}
        <View style={s.infoRow}>
          <View style={[s.infoCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <Ionicons name="wallet-outline" size={20} color={theme.blue} />
            <Text style={[s.infoValue, { color: theme.text }]}>S/ {Number(sale.monto_solicitado ?? sale.maf_neto ?? 0).toLocaleString()}</Text>
            <Text style={[s.infoLabel, { color: theme.subtext }]}>Monto</Text>
          </View>
          <View style={[s.infoCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <Ionicons name="business-outline" size={20} color={theme.orange} />
            <Text style={[s.infoValue, { color: theme.text }]} numberOfLines={2}>{sale.convenio}</Text>
            <Text style={[s.infoLabel, { color: theme.subtext }]}>Convenio</Text>
          </View>
          <View style={[s.infoCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <Ionicons name="time-outline" size={20} color={diasEnEstado > 7 ? theme.rose : diasEnEstado > 3 ? theme.amber : theme.emerald} />
            <Text style={[s.infoValue, { color: theme.text }]}>{diasEnEstado}d</Text>
            <Text style={[s.infoLabel, { color: theme.subtext }]}>En Estado</Text>
          </View>
        </View>

        {actionButtons.length > 0 && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="flash-outline" size={18} color={theme.orange} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>ACCIONES DEL VENDEDOR</Text>
            </View>
            <View style={s.actionGrid}>
              {actionButtons.map((action) => {
                const isLoadingAction = actionLoading === action.key;
                const color = action.variant === 'success'
                  ? theme.emerald
                  : action.variant === 'danger'
                    ? theme.rose
                    : theme.blue;
                const bg = action.variant === 'success'
                  ? theme.emeraldSoft
                  : action.variant === 'danger'
                    ? theme.roseSoft
                    : theme.blueSoft;
                return (
                  <TouchableOpacity
                    key={action.key}
                    onPress={action.onPress}
                    disabled={Boolean(actionLoading) || action.disabled}
                    style={[s.actionButton, { backgroundColor: bg, borderColor: color }, (Boolean(actionLoading) || action.disabled) && { opacity: 0.65 }]}
                  >
                    {isLoadingAction ? (
                      <ActivityIndicator size="small" color={color} />
                    ) : (
                      <Ionicons name={action.icon as any} size={16} color={color} />
                    )}
                    <Text style={[s.actionButtonText, { color }]}>{action.label}</Text>
                    {action.disabled && action.hint ? <Text style={[s.actionHint, { color: theme.subtext }]}>{action.hint}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="calculator-outline" size={18} color={theme.blue} />
            <Text style={[s.sectionTitle, { color: theme.text }]}>EVALUACION DE CALCULADORA</Text>
          </View>

          {hasSimulation ? (
            <View style={[s.simulationSummary, { backgroundColor: theme.input, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.simulationState, { color: sale.calculadora_estado === 'RECHAZADO' ? theme.rose : theme.emerald }]}>
                  {sale.calculadora_estado || 'SIMULACION GUARDADA'}
                </Text>
                <Text style={[s.simulationMeta, { color: theme.subtext }]}>
                  {sale.simulacion_dictamen || 'Sin dictamen'}{sale.simulacion_plazo ? ` | ${sale.simulacion_plazo} meses` : ''}
                </Text>
              </View>
              <Text style={[s.simulationAmount, { color: theme.text }]}>
                {sale.simulacion_cuota ? `S/ ${Number(sale.simulacion_cuota).toLocaleString('es-PE')}` : '-'}
              </Text>
            </View>
          ) : (
            <Text style={[s.helperText, { color: theme.subtext }]}>
              El prospecto aun no tiene evaluacion de calculadora vinculada.
            </Text>
          )}

          {onOpenCalculator && canUseCalculator ? (
            <TouchableOpacity
              onPress={() => onOpenCalculator(sale)}
              style={[s.calculatorBtn, { backgroundColor: theme.blue, borderColor: theme.blue }]}
            >
              <Ionicons name="calculator" size={16} color="white" />
              <Text style={s.calculatorBtnText}>
                {hasSimulation ? 'RECALCULAR PRESTAMO' : 'EVALUAR CON CALCULADORA'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Riesgo Crediticio Section */}
        {(sale.rcc_semaforo || isMarried || sale.estado === 'VERIFICACION_SISTEMA') && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.blue} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>RIESGO CREDITICIO</Text>
            </View>

            {/* Titular */}
            <View style={{ marginBottom: isMarried ? 16 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: theme.subtext, textTransform: 'uppercase' }}>
                  Titular: {sale.nombres_cliente}
                </Text>
                {sale.rcc_semaforo && (
                  <TouchableOpacity 
                    disabled={Boolean(actionLoading)}
                    onPress={() => handleConsultarRCC('cliente')}
                    style={{ padding: 4 }}
                  >
                    {actionLoading === 'rcc-cliente' ? (
                      <ActivityIndicator size="small" color={theme.blue} />
                    ) : (
                      <Ionicons name="refresh-outline" size={16} color={theme.blue} />
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {!sale.rcc_semaforo ? (
                <TouchableOpacity
                  disabled={Boolean(actionLoading)}
                  onPress={() => handleConsultarRCC('cliente')}
                  style={[s.rccBtn, { backgroundColor: theme.blueSoft, borderColor: theme.blue }]}
                >
                  {actionLoading === 'rcc-cliente' ? (
                    <ActivityIndicator size="small" color={theme.blue} />
                  ) : (
                    <>
                      <Ionicons name="search" size={14} color={theme.blue} />
                      <Text style={[s.rccBtnText, { color: theme.blue }]}>CONSULTAR TITULAR (DNI {sale.dni_cliente})</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                (() => {
                  const cfg = SEMAFORO_COLORS[sale.rcc_semaforo] || SEMAFORO_COLORS.GRIS;
                  return (
                    <View style={[s.rccStatusContainer, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                        <Text style={{ fontSize: 12, fontWeight: '900', color: cfg.color }}>{cfg.label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext }}>DEUDA TOTAL SBS:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>
                          S/ {Number(sale.rcc_monto_deuda || 0).toLocaleString('es-PE')}
                        </Text>
                      </View>
                      {sale.rcc_calificacion && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext }}>CALIFICACION SBS:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>{sale.rcc_calificacion}</Text>
                        </View>
                      )}
                    </View>
                  );
                })()
              )}
            </View>

            {/* Cónyuge */}
            {isMarried && (
              <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider, paddingTop: 16, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: theme.subtext, textTransform: 'uppercase' }}>
                    Cónyuge: {sale.conyuge_nombres || 'No registrado'}
                  </Text>
                  {sale.conyuge_rcc_semaforo && (
                    <TouchableOpacity 
                      disabled={Boolean(actionLoading)}
                      onPress={() => handleConsultarRCC('conyuge')}
                      style={{ padding: 4 }}
                    >
                      {actionLoading === 'rcc-conyuge' ? (
                        <ActivityIndicator size="small" color={theme.blue} />
                      ) : (
                        <Ionicons name="refresh-outline" size={16} color={theme.blue} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {!sale.conyuge_rcc_semaforo ? (
                  <TouchableOpacity
                    disabled={Boolean(actionLoading) || !sale.conyuge_dni}
                    onPress={() => handleConsultarRCC('conyuge')}
                    style={[s.rccBtn, { backgroundColor: theme.blueSoft, borderColor: theme.blue }, !sale.conyuge_dni && { opacity: 0.5 }]}
                  >
                    {actionLoading === 'rcc-conyuge' ? (
                      <ActivityIndicator size="small" color={theme.blue} />
                    ) : (
                      <>
                        <Ionicons name="search" size={14} color={theme.blue} />
                        <Text style={[s.rccBtnText, { color: theme.blue }]}>
                          CONSULTAR CONYUGE (DNI {sale.conyuge_dni || 'N/A'})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  (() => {
                    const cfg = SEMAFORO_COLORS[sale.conyuge_rcc_semaforo] || SEMAFORO_COLORS.GRIS;
                    return (
                      <View style={[s.rccStatusContainer, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                          <Text style={{ fontSize: 12, fontWeight: '900', color: cfg.color }}>{cfg.label}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext }}>DEUDA TOTAL SBS:</Text>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>
                            S/ {Number(sale.conyuge_rcc_monto_deuda || 0).toLocaleString('es-PE')}
                          </Text>
                        </View>
                        {sale.conyuge_rcc_calificacion && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext }}>CALIFICACION SBS:</Text>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: theme.text }}>{sale.conyuge_rcc_calificacion}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()
                )}
              </View>
            )}
          </View>
        )}

        <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={theme.blue} />
            <Text style={[s.sectionTitle, { color: theme.text }]}>DATOS OPERATIVOS</Text>
          </View>
          <View style={s.dataGrid}>
          {operationalRows.map(([label, value]) => (
            <View key={label} style={[s.dataTile, { backgroundColor: theme.input, borderColor: theme.border }]}>
              <Text style={[s.dataLabel, { color: theme.subtext }]}>{label}</Text>
              <Text style={[s.dataValue, { color: theme.text }]} numberOfLines={3}>{value}</Text>
            </View>
          ))}
          </View>
        </View>

        {/* Document Progress */}
        {canShowDocuments && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={theme.blue} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>
                {sale.estado === 'PENDIENTE_BOLETA' ? 'BOLETA PARA CALCULADORA' : `DOCUMENTOS (${docsCompletados}/${docsTotal})`}
              </Text>
            </View>
            <View style={[s.progressBarBg, { backgroundColor: theme.track }]}>
              <View style={[s.progressBarFill, { width: `${docsProgress * 100}%`, backgroundColor: docsProgress === 1 ? theme.emerald : theme.blue }]} />
            </View>
            {visibleChecklist.map((item) => (
              <View key={item.tipo} style={[s.checkItem, { borderBottomColor: theme.divider }]}>
                <Ionicons
                  name={item.subido ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={item.subido ? theme.emerald : theme.subtext}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.checkDoc, { color: theme.text }]}>{item.nombre}</Text>
                  <Text style={[s.checkDesc, { color: theme.subtext }]}>{item.tipo}</Text>
                </View>
                {item.subido ? (
                  <View style={[s.docStatusBadge, { backgroundColor: theme.emeraldSoft }]}>
                    <Text style={[s.docStatusText, { color: theme.emerald }]}>
                      OK{item.cantidad > 1 ? ` x${item.cantidad}` : ''}
                    </Text>
                  </View>
                ) : canUploadDocuments ? (
                  <TouchableOpacity
                    onPress={() => handleUploadChecklistDocument(item)}
                    disabled={uploadingDoc === item.tipo}
                    style={[s.uploadDocBtn, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}
                  >
                    {uploadingDoc === item.tipo ? (
                      <ActivityIndicator size="small" color={theme.blue} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={14} color={theme.blue} />
                        <Text style={[s.uploadDocText, { color: theme.blue }]}>
                          {item.obligatorio ? 'Subir req.' : 'Subir'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[s.docStatusBadge, { backgroundColor: theme.track }]}>
                    <Text style={[s.docStatusText, { color: theme.subtext }]}>PEND.</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Solicitud de Convenio BCP (PDF) */}
        {sale.convenio && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.blue + '30' }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="document-attach-outline" size={18} color={theme.blue} />
              <Text style={[s.sectionTitle, { color: theme.blue }]}>SOLICITUD DE CONVENIO</Text>
            </View>
            <Text style={[s.pdfDescription, { color: theme.subtext }]}>
              PDF autollenado con datos del expediente para el convenio {sale.convenio}.
            </Text>
            <TouchableOpacity
              onPress={handleDownloadPdf}
              disabled={pdfLoading}
              style={[s.pdfDownloadBtn, { backgroundColor: theme.blue }]}
            >
              {pdfLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color="#FFF" />
                  <Text style={s.pdfDownloadText}>Descargar PDF Convenio</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowPdfEditor(current => !current)}
              style={[s.pdfEditToggle, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}
            >
              <Ionicons name={showPdfEditor ? 'chevron-up-outline' : 'create-outline'} size={15} color={theme.blue} />
              <Text style={[s.pdfEditToggleText, { color: theme.blue }]}>
                {showPdfEditor ? 'Ocultar correccion de datos' : 'Corregir datos del PDF'}
              </Text>
            </TouchableOpacity>

            {showPdfEditor && (
              <View style={[s.pdfEditor, { backgroundColor: theme.input, borderColor: theme.border }]}>
                <Text style={[s.pdfEditorIntro, { color: theme.subtext }]}>
                  Edita los datos fuente si detectas un error en el contrato. Al guardar se regenera el PDF.
                </Text>
                {PDF_CORRECTION_FIELDS.map((field) => (
                  <View key={field.key} style={s.pdfFieldWrap}>
                    <Text style={[s.pdfFieldLabel, { color: theme.subtext }]}>{field.label}</Text>
                    <TextInput
                      value={pdfForm[field.key] || ''}
                      onChangeText={(value) => handlePdfFieldChange(field.key, value)}
                      keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'email' ? 'email-address' : 'default'}
                      autoCapitalize={field.type === 'email' ? 'none' : 'characters'}
                      placeholder={field.label}
                      placeholderTextColor={theme.muted}
                      style={[s.pdfInput, { color: theme.text, backgroundColor: theme.white, borderColor: theme.border }]}
                    />
                  </View>
                ))}

                {pdfSaved && !pdfDirty ? (
                  <View style={[s.pdfSavedBadge, { backgroundColor: theme.emeraldSoft }]}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={theme.emerald} />
                    <Text style={[s.pdfSavedText, { color: theme.emerald }]}>Datos sincronizados</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={savePdfCorrection}
                  disabled={pdfSaving || !pdfDirty}
                  style={[
                    s.pdfSaveBtn,
                    { backgroundColor: theme.blue },
                    (pdfSaving || !pdfDirty) && { opacity: 0.55 }
                  ]}
                >
                  {pdfSaving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={15} color="#FFF" />
                      <Text style={s.pdfSaveText}>Guardar y regenerar PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}


        <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
          <View style={s.sectionHeaderSplit}>
            <View style={s.sectionHeaderCompact}>
              <Ionicons name="time-outline" size={18} color={theme.orange} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>TRAZABILIDAD RECIENTE</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTimeline(true)}
              style={[s.timelineOpenBtn, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}
            >
              <Ionicons name="open-outline" size={14} color={theme.blue} />
              <Text style={[s.timelineOpenText, { color: theme.blue }]}>VER COMPLETA</Text>
            </TouchableOpacity>
          </View>
          {observations.length > 0 ? observations.slice(0, 5).map((item, idx) => (
            <View
              key={item.id}
              style={[
                s.observationItem,
                { borderBottomColor: theme.divider },
                idx === Math.min(observations.length, 5) - 1 && { borderBottomWidth: 0, paddingBottom: 0 }
              ]}
            >
              <View style={s.observationHeader}>
                <Text style={[s.observationTitle, { color: theme.text }]}>{item.titulo}</Text>
                {item.fecha ? (
                  <Text style={[s.observationDate, { color: theme.subtext }]}>
                    {new Date(item.fecha).toLocaleDateString('es-PE')}
                  </Text>
                ) : null}
              </View>
              <Text style={[s.observationText, { color: theme.subtext }]}>{item.texto}</Text>
              {item.autor ? (
                <Text style={[s.observationAuthor, { color: theme.blue }]}>{item.autor}</Text>
              ) : null}
            </View>
          )) : (
            <Text style={[s.helperText, { color: theme.subtext, marginBottom: 0 }]}>
              Sin movimientos recientes. Abre la trazabilidad completa para consultar el historial auditado.
            </Text>
          )}
        </View>

        {/* Next Steps */}
        {nextSteps.length > 0 && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="compass-outline" size={18} color={theme.orange} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>PRÓXIMOS PASOS</Text>
            </View>
            {nextSteps.map((step, idx) => (
              <View key={idx} style={[s.stepCard, { borderBottomColor: theme.divider }, step.urgent && { backgroundColor: theme.roseSoft }]}>
                <View style={[s.stepNumber, { backgroundColor: step.urgent ? theme.roseSoft : theme.blueSoft }]}>
                  <Text style={[s.stepNumText, { color: step.urgent ? theme.rose : theme.blue }]}>{step.step}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[s.stepAction, { color: theme.text }]}>{step.action}</Text>
                    {step.urgent && <Ionicons name="alert-circle" size={14} color={theme.rose} style={{ marginLeft: 6 }} />}
                  </View>
                  <Text style={[s.stepDesc, { color: theme.subtext }]}>{step.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showTimeline}
        animationType="slide"
        onRequestClose={() => setShowTimeline(false)}
      >
        <View style={[s.timelineModal, { backgroundColor: theme.slate }]}>
          <View style={[s.timelineModalHeader, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowTimeline(false)} style={[s.backBtn, { backgroundColor: theme.input }]}>
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.timelineModalTitle, { color: theme.text }]}>Trazabilidad completa</Text>
              <Text style={[s.timelineModalSub, { color: theme.subtext }]}>
                {timelineTotal} eventos auditados
              </Text>
            </View>
          </View>

          <View style={[s.timelineFilterWrap, { backgroundColor: theme.white, borderBottomColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TIMELINE_FILTERS.map(filter => {
                const active = timelineFilter === filter.key;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    onPress={() => setTimelineFilter(filter.key)}
                    style={[
                      s.timelineFilterChip,
                      {
                        backgroundColor: active ? theme.blue : theme.input,
                        borderColor: active ? theme.blue : theme.border
                      }
                    ]}
                  >
                    <Text style={[s.timelineFilterText, { color: active ? theme.whiteText : theme.subtext }]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.timelineListContent}>
            {timelineLoading && timelineItems.length === 0 ? (
              <View style={s.timelineEmpty}>
                <ActivityIndicator color={theme.blue} />
                <Text style={[s.helperText, { color: theme.subtext, marginTop: 10 }]}>Cargando trazabilidad...</Text>
              </View>
            ) : timelineItems.length > 0 ? timelineItems.map((item) => (
              <View key={`${item.source}-${item.id}`} style={s.timelineItem}>
                <View style={[s.timelineIconBox, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name={getTimelineIconName(item.type) as any} size={18} color={theme.blue} />
                </View>
                <View style={[s.timelineCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
                  <View style={s.observationHeader}>
                    <Text style={[s.observationTitle, { color: theme.text }]}>{item.title}</Text>
                    {item.created_at ? (
                      <Text style={[s.observationDate, { color: theme.subtext }]}>
                        {new Date(item.created_at).toLocaleDateString('es-PE')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[s.observationText, { color: theme.subtext }]}>{item.text}</Text>
                  {(item.actor?.nombre || item.actor?.username) ? (
                    <Text style={[s.observationAuthor, { color: theme.blue }]}>
                      {item.actor.nombre || item.actor.username}{item.actor.role ? ` · ${item.actor.role}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            )) : (
              <View style={s.timelineEmpty}>
                <Ionicons name="time-outline" size={34} color={theme.subtext} />
                <Text style={[s.helperText, { color: theme.subtext, marginTop: 10 }]}>No hay eventos para este filtro.</Text>
              </View>
            )}

            {timelinePage < timelinePages && (
              <TouchableOpacity
                onPress={() => fetchTimeline(timelinePage + 1, true)}
                disabled={timelineLoading}
                style={[s.loadMoreBtn, { backgroundColor: theme.blue }]}
              >
                {timelineLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.loadMoreText}>CARGAR MAS</Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingBottom: 28
  },
  header: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    padding: 18,
    borderWidth: 1,
    borderRadius: DESIGN.radius.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  headerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8
  },
  backBtn: { padding: 9, borderRadius: DESIGN.radius.md },
  headerTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, maxWidth: 190 },
  estadoDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  estadoText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  infoRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  infoCard: { padding: 16, borderRadius: DESIGN.radius.lg, gap: 5, borderWidth: 1 },
  infoValue: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  infoLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: DESIGN.radius.lg, padding: 18, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionHeaderCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionHeaderSplit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  timelineOpenBtn: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  timelineOpenText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  actionGrid: { gap: 10 },
  actionButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexWrap: 'wrap'
  },
  actionButtonText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, flexShrink: 1, textAlign: 'center', lineHeight: 15 },
  actionHint: { width: '100%', fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center', lineHeight: 14 },
  dataGrid: { gap: 10 },
  dataTile: {
    borderWidth: 1,
    borderRadius: DESIGN.radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dataLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  dataValue: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  progressBarBg: { height: 6, borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },
  checkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  checkDoc: { fontSize: 14, fontWeight: '800' },
  checkDesc: { fontSize: 11, marginTop: 2 },
  reqBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  reqText: { fontSize: 9, fontWeight: '900' },
  docStatusBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 },
  docStatusText: { fontSize: 9, fontWeight: '900' },
  uploadDocBtn: {
    minWidth: 72,
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  uploadDocText: { fontSize: 10, fontWeight: '900' },
  stepCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  stepUrgent: { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  stepNumber: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 14, fontWeight: '900' },
  stepAction: { fontSize: 13, fontWeight: '800', flexShrink: 1, lineHeight: 17 },
  stepDesc: { fontSize: 11, marginTop: 2, lineHeight: 16, flexShrink: 1 },
  observationItem: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  observationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  observationTitle: { flex: 1, fontSize: 12, fontWeight: '900' },
  observationDate: { fontSize: 10, fontWeight: '700' },
  observationText: { fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 5 },
  observationAuthor: { fontSize: 10, fontWeight: '900', marginTop: 6, textTransform: 'uppercase' },
  timelineModal: { flex: 1, paddingTop: 28 },
  timelineModalHeader: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    padding: 14,
    borderWidth: 1,
    borderRadius: DESIGN.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  timelineModalTitle: { fontSize: 18, fontWeight: '900' },
  timelineModalSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  timelineFilterWrap: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  timelineFilterChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  timelineFilterText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  timelineListContent: { padding: 16, paddingBottom: 30 },
  timelineItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  timelineIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  timelineCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: DESIGN.radius.md,
    padding: 13
  },
  timelineEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadMoreBtn: {
    minHeight: 46,
    borderRadius: DESIGN.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  loadMoreText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  simulationSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  simulationState: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  simulationMeta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  simulationAmount: { fontSize: 16, fontWeight: '900' },
  helperText: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginBottom: 12 },
  calculatorBtn: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  calculatorBtnText: { color: 'white', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  rccBtn: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  rccBtnText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rccStatusContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  pdfDescription: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  pdfDownloadBtn: {
    minHeight: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  pdfDownloadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pdfEditToggle: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  pdfEditToggleText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
    textAlign: 'center',
  },
  pdfEditor: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: DESIGN.radius.md,
    borderWidth: 1,
    padding: 12,
  },
  pdfEditorIntro: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 12,
  },
  pdfFieldWrap: {
    marginBottom: 10,
  },
  pdfFieldLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  pdfInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  pdfSaveBtn: {
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  pdfSaveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
    textAlign: 'center',
  },
  pdfSavedBadge: {
    minHeight: 34,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  pdfSavedText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
