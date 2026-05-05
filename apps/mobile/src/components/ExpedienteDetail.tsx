/**
 * ═══════════════════════════════════════════════════
 * ExpedienteDetail — Vista de detalle con next-steps
 * Muestra información del expediente + pasos guiados
 * ═══════════════════════════════════════════════════
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet, RefreshControl
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

interface ExpedienteDetailProps {
  saleId: string;
  onClose: () => void;
  isDark: boolean;
  theme: any;
}

const getEstadoColor = (estado: string, theme: any) => {
  if (['DESEMBOLSADO', 'APROBADO_BCP', 'CONVENIO_APROBADO', 'SCORE_APROBADO'].includes(estado)) return theme.emerald;
  if (['OBSERVADO', 'PROSPECTO_NUEVO', 'PENDIENTE_DATOS', 'PENDIENTE_DOCUMENTOS', 'PENDIENTE_REASIGNACION'].includes(estado)) return theme.orange;
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

export default function ExpedienteDetail({ saleId, onClose, isDark, theme }: ExpedienteDetailProps) {
  const [sale, setSale] = useState<any>(null);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

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
      console.error('Error fetching detail:', error);
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
      console.error('Error uploading checklist document:', error);
      Alert.alert('Error', 'No se pudo subir el documento.');
    } finally {
      setUploadingDoc(null);
    }
  }, [fetchDetail, sale?.dni_cliente, saleId]);

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
    : sale.estado?.includes('PENDIENTE') || sale.estado === 'PROSPECTO_NUEVO' || sale.estado === 'OBSERVADO'
      ? theme.orangeSoft
      : ['DESEMBOLSADO', 'APROBADO_BCP', 'CONVENIO_APROBADO', 'SCORE_APROBADO'].includes(sale.estado)
        ? theme.emeraldSoft
        : theme.blueSoft;
  const diasEnEstado = sale.fecha_estado_desde
    ? Math.floor((Date.now() - new Date(sale.fecha_estado_desde).getTime()) / 86400000)
    : 0;
  const docsCompletados = checklist.filter(d => d.subido).length;
  const docsTotal = checklist.length;
  const docsProgress = docsTotal > 0 ? docsCompletados / docsTotal : 0;
  const operationalRows = [
    ['Celular', sale.celular || '-'],
    ['Correo', sale.correo || '-'],
    ['Cargo', sale.cargo_laboral || '-'],
    ['Entidad', sale.entidad_laboral || '-'],
    ['Ubicacion', [sale.distrito, sale.provincia, sale.departamento].filter(Boolean).join(', ') || '-'],
    ['Plazo', sale.plazo_deseado ? `${sale.plazo_deseado} meses` : '-'],
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
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>{sale.nombres_cliente}</Text>
          <Text style={[s.headerSub, { color: theme.subtext }]}>DNI: {sale.dni_cliente}</Text>
        </View>
        <View style={[s.estadoBadge, { backgroundColor: estadoBg, borderColor: theme.border }]}>
          <View style={[s.estadoDot, { backgroundColor: estadoColor }]} />
          <Text style={[s.estadoText, { color: estadoColor }]} numberOfLines={1}>{sale.estado}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
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
            <Text style={[s.infoValue, { color: theme.text }]}>{sale.convenio}</Text>
            <Text style={[s.infoLabel, { color: theme.subtext }]}>Convenio</Text>
          </View>
          <View style={[s.infoCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <Ionicons name="time-outline" size={20} color={diasEnEstado > 7 ? theme.rose : diasEnEstado > 3 ? theme.amber : theme.emerald} />
            <Text style={[s.infoValue, { color: theme.text }]}>{diasEnEstado}d</Text>
            <Text style={[s.infoLabel, { color: theme.subtext }]}>En Estado</Text>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={theme.blue} />
            <Text style={[s.sectionTitle, { color: theme.text }]}>DATOS OPERATIVOS</Text>
          </View>
          {operationalRows.map(([label, value]) => (
            <View key={label} style={[s.dataRow, { borderBottomColor: theme.divider }]}>
              <Text style={[s.dataLabel, { color: theme.subtext }]}>{label}</Text>
              <Text style={[s.dataValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Document Progress */}
        {docsTotal > 0 && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={theme.blue} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>DOCUMENTOS ({docsCompletados}/{docsTotal})</Text>
            </View>
            <View style={[s.progressBarBg, { backgroundColor: theme.track }]}>
              <View style={[s.progressBarFill, { width: `${docsProgress * 100}%`, backgroundColor: docsProgress === 1 ? theme.emerald : theme.blue }]} />
            </View>
            {checklist.map((item) => (
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
                ) : (
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
                )}
              </View>
            ))}
          </View>
        )}

        {observations.length > 0 && (
          <View style={[s.section, { backgroundColor: theme.white, borderColor: theme.border }]}>
            <View style={s.sectionHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.orange} />
              <Text style={[s.sectionTitle, { color: theme.text }]}>OBSERVACIONES</Text>
            </View>
            {observations.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  s.observationItem,
                  { borderBottomColor: theme.divider },
                  idx === observations.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }
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
            ))}
          </View>
        )}

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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderWidth: 1,
    borderRadius: DESIGN.radius.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  backBtn: { marginRight: 12, padding: 8, borderRadius: DESIGN.radius.md },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, maxWidth: 118 },
  estadoDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  estadoText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  infoRow: { flexDirection: 'row', padding: 16, gap: 8 },
  infoCard: { flex: 1, alignItems: 'center', padding: 13, borderRadius: DESIGN.radius.lg, gap: 4, borderWidth: 1 },
  infoValue: { fontSize: 16, fontWeight: '900' },
  infoLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: DESIGN.radius.lg, padding: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dataLabel: { width: 86, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  dataValue: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '800' },
  progressBarBg: { height: 6, borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },
  checkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  checkDoc: { fontSize: 13, fontWeight: '800' },
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
  stepAction: { fontSize: 13, fontWeight: '800' },
  stepDesc: { fontSize: 11, marginTop: 2 },
  observationItem: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  observationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  observationTitle: { flex: 1, fontSize: 12, fontWeight: '900' },
  observationDate: { fontSize: 10, fontWeight: '700' },
  observationText: { fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 5 },
  observationAuthor: { fontSize: 10, fontWeight: '900', marginTop: 6, textTransform: 'uppercase' },
});
