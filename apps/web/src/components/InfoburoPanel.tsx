import { useState } from 'react';
import { Search, Loader2, AlertTriangle, X, User, CheckCircle, XCircle, AlertOctagon, HelpCircle } from 'lucide-react';
import axios from 'axios';

const calificacion: Record<string, any> = {
  VERDE: {
    verdict: 'CALIFICA',
    color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '#86efac',
    icon: CheckCircle, textColor: '#065f46',
    msg: 'Cliente apto para ofrecimiento de producto.',
  },
  AMARILLO: {
    verdict: 'REVISAR',
    color: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '#fcd34d',
    icon: AlertOctagon, textColor: '#92400e',
    msg: 'Cliente con observaciones. Evaluar condiciones.',
  },
  ROJO: {
    verdict: 'NO CALIFICA',
    color: '#ef4444', bg: 'linear-gradient(135deg, #fef2f2, #fecaca)', border: '#fca5a5',
    icon: XCircle, textColor: '#991b1b',
    msg: 'Cliente no apto. No ofrecer producto.',
  },
  GRIS: {
    verdict: 'SIN DATOS',
    color: '#6b7280', bg: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', border: '#d1d5db',
    icon: HelpCircle, textColor: '#374151',
    msg: 'No se encontro informacion crediticia.',
  },
};

type TabKey = 'resumen' | 'general' | 'historico' | 'deudas' | 'otros';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'general', label: 'Informacion General' },
  { key: 'historico', label: 'Historico' },
  { key: 'deudas', label: 'Deudas' },
  { key: 'otros', label: 'Resumen Financiero' },
];

export default function InfoburoPanel() {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');

  const handleSearch = async () => {
    if (!/^\d{8}$/.test(dni)) { setError('DNI invalido (8 digitos)'); return; }
    setLoading(true); setError(''); setResult(null); setActiveTab('resumen');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/infoburo/${dni}`, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al consultar');
    } finally { setLoading(false); }
  };

  const clear = () => { setResult(null); setDni(''); setError(''); setActiveTab('resumen'); };
  const cal = result ? calificacion[result.semaforo] || calificacion.GRIS : null;
  const CalIcon = cal?.icon || HelpCircle;

  const sectionHeader: React.CSSProperties = { padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const fieldLabel: React.CSSProperties = { fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' };
  const fieldValue: React.CSSProperties = { margin: '2px 0 0', fontSize: '13px', color: '#1e293b', fontWeight: 500 };
  const thStyle: React.CSSProperties = { padding: '7px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '11px' };
  const tdStyle: React.CSSProperties = { padding: '6px 10px', fontSize: '12px', borderBottom: '1px solid #f1f5f9' };

  return (
    <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #002B5C, #003d82)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} color="white" />
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>Validacion Crediticia (RCC)</span>
        </div>
        {result && <button onClick={clear} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '3px', cursor: 'pointer', display: 'flex' }}><X size={14} color="white" /></button>}
      </div>

      {/* Barra de busqueda */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input type="text" inputMode="numeric" maxLength={8} placeholder="DNI del cliente"
            value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} disabled={loading}
            style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", letterSpacing: '0.08em' }}
          />
          <User size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
        <button onClick={handleSearch} disabled={loading || dni.length !== 8}
          style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#002B5C', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading || dni.length !== 8 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: dni.length !== 8 ? 0.4 : 1, whiteSpace: 'nowrap' }}>
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          {loading ? 'Buscando...' : 'Validar'}
        </button>
      </div>

      {error && <div style={{ margin: '0 16px 12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} />{error}</div>}

      {loading && <div style={{ padding: '20px 16px', textAlign: 'center' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 20px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}><Loader2 size={18} color="#0284c7" className="spin" /><span style={{ color: '#0369a1', fontSize: '12px', fontWeight: 500 }}>Consultando central de riesgos...</span></div></div>}

      {/* RESULTADO */}
      {result && cal && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Veredicto */}
          <div style={{ background: cal.bg, border: `1.5px solid ${cal.border}`, borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <CalIcon size={28} color={cal.color} />
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: cal.textColor }}>{cal.verdict}</div>
                <div style={{ fontSize: '11px', color: cal.textColor, opacity: 0.8 }}>{cal.msg}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Cliente</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{result.nombres}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Deuda Total</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>S/ {result.deudaTotal?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#475569' }}><b>DNI:</b> {result.dni}</span>
              <span style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#475569' }}><b>Actualizacion:</b> {result.ultimaActualizacion || 'N/A'}</span>
              {result.score && <span style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: '#475569' }}><b>Score:</b> {result.score}</span>}
            </div>
          </div>

          {result.flagNoContactar && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} color="#dc2626" /><span style={{ color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>Cliente en base NO CONTACTAR</span>
            </div>
          )}

          {/* Pestanas */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '12px', overflowX: 'auto', gap: '0' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '8px 14px', fontSize: '12px', fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? '#002B5C' : '#64748b',
                  background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #002B5C' : '2px solid transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-2px', transition: 'all 0.15s',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Resumen */}
          {activeTab === 'resumen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.lineasCredito?.length > 0 && (
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={sectionHeader}>Entidades con deuda</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#f8fafc' }}>
                        {['Entidad', 'Linea Aprobada', 'No Utilizada', 'Utilizada'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>{result.lineasCredito.map((l: any, i: number) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{l.entidad}</td>
                          <td style={tdStyle}>{l.lineaAprobada}</td>
                          <td style={tdStyle}>{l.lineaNoUtilizada}</td>
                          <td style={tdStyle}>{l.lineaUtilizada}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {result.lineasCredito?.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Sin lineas de credito registradas.</div>}
            </div>
          )}

          {/* Tab: Informacion General */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={sectionHeader}>Datos Generales</div>
                <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Nombres', value: result.infoGeneral?.nombres || result.nombres },
                    { label: 'Documento', value: result.infoGeneral?.documento || result.documento },
                    { label: 'Nacimiento', value: result.infoGeneral?.nacimiento },
                    { label: 'Sexo', value: result.infoGeneral?.sexo },
                    { label: 'Estado Civil', value: result.infoGeneral?.estadoCivil },
                  ].map((f, i) => (
                    <div key={i}>
                      <span style={fieldLabel}>{f.label}</span>
                      <p style={fieldValue}>{f.value || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
              {result.ruc && Object.values(result.ruc).some((v: any) => v) && (
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={sectionHeader}>Datos RUC</div>
                  <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                    {[
                      { label: 'RUC', value: result.ruc.ruc },
                      { label: 'Razon Social', value: result.ruc.razonSocial },
                      { label: 'Giro', value: result.ruc.giro },
                      { label: 'Estado', value: result.ruc.estado },
                      { label: 'Tipo', value: result.ruc.tipo },
                      { label: 'Condicion', value: result.ruc.condicion },
                    ].filter(f => f.value).map((f, i) => (
                      <div key={i}>
                        <span style={fieldLabel}>{f.label}</span>
                        <p style={fieldValue}>{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Campos adicionales */}
              <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={sectionHeader}>Otros Datos</div>
                <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Motivo Caida DxP', value: result.motivoCaida },
                    { label: 'Filtro Vehicular', value: result.filtroVehicular },
                    { label: 'Producto', value: result.producto },
                    { label: 'Color DxP', value: result.colorDxP },
                    { label: 'Score', value: result.score },
                  ].map((f, i) => (
                    <div key={i}>
                      <span style={fieldLabel}>{f.label}</span>
                      <p style={fieldValue}>{f.value || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Historico */}
          {activeTab === 'historico' && (
            <div>
              {result.historico?.length > 0 ? (
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={sectionHeader}>Historico SBS - {result.historico.length} periodos</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#f8fafc' }}>
                        {['Fecha', 'Mes', 'Entidades', 'Deuda Total', '% NOR', '% CPP', '% DEF', '% DUD', '% PER'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>{result.historico.map((h: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{h.fecha}</td>
                          <td style={tdStyle}>{h.mes}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{h.numEntidades}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{h.deudaTotal}</td>
                          <td style={{ ...tdStyle, color: '#10b981', fontWeight: 600 }}>{h.porNOR}</td>
                          <td style={{ ...tdStyle, color: '#f59e0b' }}>{h.porCPP}</td>
                          <td style={{ ...tdStyle, color: '#f97316' }}>{h.porDEF}</td>
                          <td style={{ ...tdStyle, color: '#ef4444' }}>{h.porDUD}</td>
                          <td style={{ ...tdStyle, color: '#991b1b' }}>{h.porPER}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Sin registros historicos.</div>
              )}
            </div>
          )}

          {/* Tab: Deudas */}
          {activeTab === 'deudas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.lineasCredito?.length > 0 && (
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={sectionHeader}>Lineas de Credito</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#f8fafc' }}>
                        {['Entidad', 'Linea Aprobada', 'No Utilizada', 'Utilizada'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr></thead>
                      <tbody>{result.lineasCredito.map((l: any, i: number) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{l.entidad}</td>
                          <td style={tdStyle}>{l.lineaAprobada}</td>
                          <td style={tdStyle}>{l.lineaNoUtilizada}</td>
                          <td style={tdStyle}>{l.lineaUtilizada}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {result.detalleDeuda?.length > 0 && (
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={sectionHeader}>Detalle de Deuda - {result.detalleDeuda.length} entidad(es)</div>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {result.detalleDeuda.map((d: any, i: number) => (
                      <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>{d.entidad}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px' }}>
                          {Object.entries(d.campos || {}).filter(([, v]) => v).map(([k, v]: any) => (
                            <div key={k}>
                              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{k}</span>
                              <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#334155', fontWeight: 500 }}>{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.lineasCredito?.length === 0 && result.detalleDeuda?.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Sin deudas registradas.</div>
              )}
            </div>
          )}

          {/* Tab: Otros */}
          {activeTab === 'otros' && (
            <div>
              {result.otros?.length > 0 ? (
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={sectionHeader}>Resumen Financiero - {result.otros.length} entidad(es)</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#f8fafc' }}>
                        {result.otros[0] && Object.keys(result.otros[0]).map((k: string) => <th key={k} style={thStyle}>{k}</th>)}
                      </tr></thead>
                      <tbody>{result.otros.map((row: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                          {Object.values(row).map((v: any, j: number) => <td key={j} style={tdStyle}>{v}</td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Sin registros adicionales.</div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}
