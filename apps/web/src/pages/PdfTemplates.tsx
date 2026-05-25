import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { CheckCircle2, FileText, Power, RefreshCw, Save, UploadCloud, XCircle } from 'lucide-react';

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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [templatesRes, optionsRes] = await Promise.all([
        axios.get('/api/pdf-templates', { headers: authHeaders() }),
        axios.get('/api/pdf-templates/field-options', { headers: authHeaders() })
      ]);
      const nextTemplates = Array.isArray(templatesRes.data) ? templatesRes.data : [];
      setTemplates(nextTemplates);
      setFieldOptions(Array.isArray(optionsRes.data) ? optionsRes.data : []);
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

  return (
    <div className="h-full overflow-y-auto bg-surface-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-bcp-orange)]">Configuracion documental</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-text-900">Plantillas PDF</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-text-700">
              Administra contratos editables por convenio. El sistema detecta los campos del PDF y los usa al regenerar contratos.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-surface-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-text-800 transition hover:border-[var(--color-bcp-orange)] hover:text-[var(--color-bcp-orange)]"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </header>

        {(message || error) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
            {error || message}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <form onSubmit={handleUpload} className="rounded-2xl border border-surface-200 bg-surface-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]">
                  <UploadCloud size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-text-900">Nueva plantilla</h2>
                  <p className="text-xs font-bold text-text-700">Sube un PDF editable.</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-text-700">Nombre</span>
                  <input
                    value={nombre}
                    onChange={event => setNombre(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm font-bold text-text-900 outline-none transition focus:border-[var(--color-bcp-orange)]"
                    placeholder="Contrato PNP 2026"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-text-700">Convenio</span>
                  <input
                    value={convenio}
                    onChange={event => setConvenio(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm font-bold text-text-900 outline-none transition focus:border-[var(--color-bcp-orange)]"
                    placeholder="PNP"
                  />
                </label>

                <label className="block rounded-xl border border-dashed border-surface-300 bg-surface-50 p-4">
                  <span className="text-xs font-black uppercase tracking-widest text-text-700">Archivo PDF</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={event => setFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm font-bold text-text-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-bcp-orange)] file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-black"
                  />
                  {file && <p className="mt-2 truncate text-xs font-bold text-text-700">{file.name}</p>}
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-bcp-orange)] px-4 py-3 text-xs font-black uppercase tracking-widest text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UploadCloud size={16} />
                  Subir y detectar
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-surface-200 bg-surface-100 p-3 shadow-sm">
              <div className="px-2 py-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-text-900">Plantillas</h2>
                <p className="mt-1 text-xs font-bold text-text-700">{templates.length} versiones registradas</p>
              </div>

              <div className="mt-2 space-y-2">
                {loading && <div className="p-4 text-sm font-bold text-text-700">Cargando plantillas...</div>}
                {!loading && templates.length === 0 && <div className="p-4 text-sm font-bold text-text-700">Aun no hay plantillas subidas.</div>}
                {templates.map(template => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelected(template)}
                    className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === template.id ? 'border-[var(--color-bcp-orange)] bg-[var(--accent-orange-soft)]' : 'border-surface-200 bg-surface-50 hover:border-surface-300'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-text-900">{template.nombre}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-widest text-text-700">{template.convenio} · v{template.version}</div>
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

          <div className="rounded-2xl border border-surface-200 bg-surface-100 shadow-sm">
            {!selected ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center p-10 text-center">
                <FileText size={42} className="text-text-500" />
                <h2 className="mt-4 text-xl font-black text-text-900">Selecciona una plantilla</h2>
                <p className="mt-2 max-w-md text-sm font-semibold text-text-700">Cuando subas o selecciones un PDF, aqui podras mapear sus campos contra los datos del expediente.</p>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="border-b border-surface-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${selected.activo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-surface-200 text-text-700'}`}>
                          {selected.activo ? 'Activa' : 'Inactiva'}
                        </span>
                        <span className="rounded-full bg-surface-200 px-3 py-1 text-xs font-black uppercase tracking-widest text-text-700">{selected.convenio} · v{selected.version}</span>
                      </div>
                      <h2 className="mt-3 truncate text-2xl font-black text-text-900">{selected.nombre}</h2>
                      <p className="mt-1 text-sm font-semibold text-text-700">
                        {selected.original_name} · {selectedTextFields.length} campos editables · {mappedCount} mapeados
                      </p>
                      <p className="mt-1 text-xs font-bold text-text-500">
                        Creado {formatDate(selected.created_at)} por {selected.creator?.nombre || selected.creator?.username || 'sistema'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(selected)}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-text-800 transition hover:border-[var(--color-bcp-orange)] disabled:opacity-60"
                      >
                        <Power size={16} />
                        {selected.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={saveSelected}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-bcp-orange)] px-4 py-3 text-xs font-black uppercase tracking-widest text-black transition hover:brightness-110 disabled:opacity-60"
                      >
                        <Save size={16} />
                        Guardar mapeo
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto p-5">
                  <table className="w-full min-w-[760px] border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left text-[11px] font-black uppercase tracking-widest text-text-700">
                        <th className="border-b border-surface-200 px-3 py-3">Campo PDF</th>
                        <th className="border-b border-surface-200 px-3 py-3">Tipo</th>
                        <th className="border-b border-surface-200 px-3 py-3">Dato del sistema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.fields.map(field => {
                        const isTextField = field.type === 'PDFTextField';
                        return (
                          <tr key={`${field.name}-${field.type}`} className="group">
                            <td className="border-b border-surface-200 px-3 py-3">
                              <div className="font-mono text-xs font-bold text-text-900">{field.name}</div>
                              {field.suggested_key && <div className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">Sugerido: {field.suggested_key}</div>}
                            </td>
                            <td className="border-b border-surface-200 px-3 py-3">
                              <span className="rounded-lg bg-surface-200 px-2 py-1 text-[11px] font-black uppercase tracking-widest text-text-700">{field.type.replace('PDF', '')}</span>
                            </td>
                            <td className="border-b border-surface-200 px-3 py-3">
                              <select
                                value={selected.mappings[field.name] || ''}
                                onChange={event => updateMapping(field.name, event.target.value)}
                                disabled={!isTextField}
                                className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm font-bold text-text-900 outline-none transition focus:border-[var(--color-bcp-orange)] disabled:cursor-not-allowed disabled:opacity-50"
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
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
