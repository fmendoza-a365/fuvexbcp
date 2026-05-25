import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { CheckCircle2, FileText, Link2, Power, RefreshCw, Save, UploadCloud, XCircle } from 'lucide-react';

type FieldOption = {
  value: string;
  label: string;
  group: string;
};

type PdfField = {
  name: string;
  normalized: string;
  type: string;
  suggested_key: string | null;
};

type PdfTemplate = {
  id: string;
  nombre: string;
  convenio: string;
  version: number;
  original_name: string;
  activo: boolean;
  created_at: string;
  fields: PdfField[];
  mappings: Record<string, string>;
  creator?: {
    nombre?: string;
    username?: string;
  } | null;
};

type SimulatorConvenio = {
  id: string;
  nombre: string;
  sector?: string | null;
  activo?: boolean;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`
});

const formatDate = (value: string) => new Date(value).toLocaleString('es-PE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export default function PdfTemplates() {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([]);
  const [convenioOptions, setConvenioOptions] = useState<SimulatorConvenio[]>([]);
  const [selected, setSelected] = useState<PdfTemplate | null>(null);
  const [nombre, setNombre] = useState('');
  const [convenio, setConvenio] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, FieldOption[]>();
    fieldOptions.forEach(option => {
      if (!groups.has(option.group)) groups.set(option.group, []);
      groups.get(option.group)?.push(option);
    });
    return Array.from(groups.entries());
  }, [fieldOptions]);

  const selectedTextFields = useMemo(() => (
    selected?.fields.filter(field => field.type === 'PDFTextField') || []
  ), [selected]);

  const mappedCount = selectedTextFields.filter(field => selected?.mappings[field.name]).length;

  const convenioChoices = useMemo(() => {
    const byName = new Map<string, SimulatorConvenio>();
    convenioOptions.forEach(item => {
      const name = String(item.nombre || '').trim();
      if (name) byName.set(name, item);
    });
    templates.forEach(template => {
      const name = String(template.convenio || '').trim();
      if (name && !byName.has(name)) byName.set(name, { id: name, nombre: name, sector: 'Registrado' });
    });
    return Array.from(byName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [convenioOptions, templates]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [templatesRes, optionsRes] = await Promise.all([
        axios.get('/api/pdf-templates', { headers: authHeaders() }),
        axios.get('/api/pdf-templates/field-options', { headers: authHeaders() })
      ]);
      const simulatorRes = await axios.get('/api/simulator/config', { headers: authHeaders() }).catch(() => ({ data: { convenios: [] } }));
      const nextTemplates = Array.isArray(templatesRes.data) ? templatesRes.data : [];
      setTemplates(nextTemplates);
      setFieldOptions(Array.isArray(optionsRes.data) ? optionsRes.data : []);
      setConvenioOptions(Array.isArray(simulatorRes.data?.convenios) ? simulatorRes.data.convenios : []);
      setSelected(current => {
        if (!current) return nextTemplates[0] || null;
        return nextTemplates.find((item: PdfTemplate) => item.id === current.id) || nextTemplates[0] || null;
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar las plantillas PDF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const clearNotices = () => {
    setMessage('');
    setError('');
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    clearNotices();

    if (!nombre.trim() || !convenio.trim() || !file) {
      setError('Completa nombre, convenio y archivo PDF.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('nombre', nombre.trim());
      formData.append('convenio', convenio.trim());
      formData.append('pdf', file);

      const res = await axios.post('/api/pdf-templates', formData, {
        headers: authHeaders()
      });

      setNombre('');
      setConvenio('');
      setFile(null);
      setMessage('Plantilla creada y activada para el convenio.');
      await fetchData();
      setSelected(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo subir la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (fieldName: string, value: string) => {
    setSelected(current => {
      if (!current) return current;
      const mappings = { ...current.mappings };
      if (value) {
        mappings[fieldName] = value;
      } else {
        delete mappings[fieldName];
      }
      return { ...current, mappings };
    });
  };

  const saveSelected = async () => {
    if (!selected) return;
    clearNotices();
    setSaving(true);
    try {
      const res = await axios.put(`/api/pdf-templates/${selected.id}`, {
        mappings: selected.mappings,
        nombre: selected.nombre,
        activo: selected.activo
      }, { headers: authHeaders() });
      setSelected(res.data);
      setMessage('Mapeo guardado correctamente.');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo guardar el mapeo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: PdfTemplate) => {
    clearNotices();
    setSaving(true);
    try {
      const res = await axios.put(`/api/pdf-templates/${template.id}`, {
        activo: !template.activo
      }, { headers: authHeaders() });
      setSelected(res.data);
      setMessage(res.data.activo ? 'Plantilla activada.' : 'Plantilla desactivada.');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo actualizar el estado.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-surface-200 border-t-[var(--color-bcp-blue)] rounded-full animate-spin" />
          <p className="text-text-700 font-bold uppercase tracking-widest text-[10px]">Cargando plantillas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell animate-in fade-in duration-500">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Plantillas <span>PDF</span>
          </h1>
          <p className="page-subtitle">Administracion de contratos editables y mapeo de campos por convenio</p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={fetchData} className="action-button-secondary">
            <RefreshCw size={18} /> Actualizar
          </button>
          <button type="button" onClick={saveSelected} disabled={!selected || saving} className="action-button-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <Save size={18} /> Guardar mapeo
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form onSubmit={handleUpload} className="premium-card">
            <div className="flex items-center gap-3 mb-5">
              <div className="icon-badge bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]">
                <UploadCloud size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-text-900">Nueva plantilla</h2>
                <p className="text-xs font-bold text-text-700 mt-1">Sube un contrato PDF editable.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Nombre</span>
                <input
                  value={nombre}
                  onChange={event => setNombre(event.target.value)}
                  className="field-input"
                  placeholder="Contrato PNP 2026"
                />
              </label>

              <label className="block">
                <span className="field-label">Convenio</span>
                {convenioChoices.length > 0 ? (
                  <select
                    value={convenio}
                    onChange={event => setConvenio(event.target.value)}
                    className="field-input"
                  >
                    <option value="">Selecciona convenio...</option>
                    {convenioChoices.map(option => (
                      <option key={option.id || option.nombre} value={option.nombre}>
                        {option.nombre}{option.sector ? ` - ${option.sector}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={convenio}
                    onChange={event => setConvenio(event.target.value)}
                    className="field-input"
                    placeholder="PNP"
                  />
                )}
                <p className="mt-2 text-[11px] font-bold leading-5 text-text-700">
                  Usa el mismo nombre del convenio del simulador para que el PDF se encuentre automaticamente.
                </p>
              </label>

              <label className="block">
                <span className="field-label">Archivo PDF</span>
                <div className="rounded-lg border border-dashed border-surface-200 bg-surface-50 p-4">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={event => setFile(event.target.files?.[0] || null)}
                    className="block w-full text-xs font-bold text-text-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-blue)] file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:text-white"
                  />
                  {file && <p className="mt-3 truncate text-xs font-bold text-text-700">{file.name}</p>}
                </div>
              </label>

              <button type="submit" disabled={saving} className="action-button-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                <UploadCloud size={18} /> Subir y detectar
              </button>
            </div>
          </form>

          <div className="premium-card !p-0 overflow-hidden">
            <div className="p-5 border-b border-surface-200 bg-surface-100">
              <h2 className="text-sm font-black uppercase tracking-widest text-text-900">Versiones registradas</h2>
              <p className="text-xs font-bold text-text-700 mt-1">{templates.length} plantillas en el sistema</p>
            </div>

            <div className="divide-y divide-surface-200">
              {templates.length === 0 && (
                <div className="p-5 text-sm font-bold text-text-700">Aun no hay plantillas subidas.</div>
              )}
              {templates.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelected(template)}
                  className={`w-full p-4 text-left transition-colors ${selected?.id === template.id ? 'bg-[var(--accent-blue-soft)]' : 'hover:bg-[var(--surface-hover)]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-text-900">{template.nombre}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-text-700">{template.convenio} - v{template.version}</div>
                    </div>
                    {template.activo ? (
                      <CheckCircle2 className="shrink-0 text-emerald-500" size={18} />
                    ) : (
                      <XCircle className="shrink-0 text-text-500" size={18} />
                    )}
                  </div>
                  <div className="mt-3 truncate text-xs font-semibold text-text-700">{template.original_name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="premium-card !p-0 overflow-hidden">
          {!selected ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center p-10 text-center">
              <div className="icon-badge bg-surface-50 text-text-700">
                <FileText size={22} />
              </div>
              <h2 className="mt-4 text-lg font-black text-text-900">Selecciona una plantilla</h2>
              <p className="mt-2 max-w-md text-sm font-semibold text-text-700">Cuando subas o selecciones un PDF, podras mapear sus campos contra los datos del expediente.</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-surface-200 bg-surface-100">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${selected.activo ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-surface-200 bg-surface-50 text-text-700'}`}>
                        {selected.activo ? 'Activa' : 'Inactiva'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-text-700">
                        <Link2 size={12} /> {selected.convenio} - v{selected.version}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-xl font-black text-text-900">{selected.nombre}</h2>
                    <p className="mt-1 text-sm font-semibold text-text-700">
                      {selected.original_name} - {selectedTextFields.length} campos editables - {mappedCount} mapeados
                    </p>
                    <p className="mt-1 text-xs font-bold text-text-500">
                      Creado {formatDate(selected.created_at)} por {selected.creator?.nombre || selected.creator?.username || 'sistema'}
                    </p>
                  </div>

                  <div className="page-actions">
                    <button
                      type="button"
                      onClick={() => toggleActive(selected)}
                      disabled={saving}
                      className="action-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Power size={18} />
                      {selected.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={saveSelected}
                      disabled={saving}
                      className="action-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save size={18} />
                      Guardar
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead>
                    <tr className="data-table-header">
                      <th className="p-4">Campo PDF</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Dato del sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.fields.map(field => {
                      const isTextField = field.type === 'PDFTextField';
                      return (
                        <tr key={`${field.name}-${field.type}`} className="data-table-row">
                          <td className="p-4 align-top">
                            <div className="font-mono text-xs font-bold text-text-900">{field.name}</div>
                            {field.suggested_key && <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent-emerald)]">Sugerido: {field.suggested_key}</div>}
                          </td>
                          <td className="p-4 align-top">
                            <span className="rounded-lg border border-surface-200 bg-surface-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-text-700">{field.type.replace('PDF', '')}</span>
                          </td>
                          <td className="p-4 align-top">
                            <select
                              value={selected.mappings[field.name] || ''}
                              onChange={event => updateMapping(field.name, event.target.value)}
                              disabled={!isTextField}
                              className="field-input min-w-[260px] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Sin autocompletar</option>
                              {groupedOptions.map(([group, options]) => (
                                <optgroup key={group} label={group}>
                                  {options.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
