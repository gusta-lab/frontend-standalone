import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, Loader2, CheckCircle2, XCircle,
  ChevronRight, Package, ExternalLink, RotateCcw, BookOpen,
} from 'lucide-react';
import { getTemplate, submitTemplate, getTask } from '../api/backstage';
import type { Template, TemplateProperty, ScaffolderTask } from '../types';

// ─── Field renderer ───────────────────────────────────────────────────────────

function Field({
  schema,
  value,
  required,
  onChange,
}: {
  schema: TemplateProperty;
  value: unknown;
  required: boolean;
  onChange: (v: unknown) => void;
}) {
  const base =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

  if (schema.type === 'boolean') {
    return (
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 accent-indigo-600"
        />
        <span className="text-sm text-slate-700">{schema.title}</span>
        {schema.description && (
          <span className="text-xs text-slate-400">— {schema.description}</span>
        )}
      </label>
    );
  }

  if (schema.type === 'array') {
    const itemEnum = schema.items?.enum;
    const selected = Array.isArray(value) ? (value as string[]) : [];

    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {schema.title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {schema.description && <p className="text-xs text-slate-400">{schema.description}</p>}
        {itemEnum ? (
          <div className="space-y-1.5">
            {itemEnum.map((opt, i) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...selected, opt]
                      : selected.filter(v => v !== opt);
                    onChange(next);
                  }}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-slate-700">
                  {schema.items?.enumNames?.[i] ?? opt}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <textarea
            rows={3}
            value={selected.join('\n')}
            placeholder="Um valor por linha"
            onChange={e => onChange(e.target.value.split('\n').filter(Boolean))}
            className={`${base} resize-y`}
          />
        )}
      </div>
    );
  }

  if (schema.type === 'object' && schema.properties) {
    const objValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const objRequired = new Set(schema.required ?? []);
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {schema.title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {schema.description && <p className="text-xs text-slate-400">{schema.description}</p>}
        <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50">
          {Object.entries(schema.properties).map(([key, subSchema]) => (
            <Field
              key={key}
              schema={subSchema}
              value={objValue[key]}
              required={objRequired.has(key)}
              onChange={v => onChange({ ...objValue, [key]: v })}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {schema.title}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {schema.description && (
        <p className="text-xs text-slate-400">{schema.description}</p>
      )}
      {schema.enum ? (
        <select
          value={String(value ?? schema.default ?? schema.enum[0])}
          onChange={e => onChange(e.target.value)}
          className={base}
        >
          {schema.enum.map((opt, i) => (
            <option key={opt} value={opt}>
              {schema.enumNames?.[i] ?? opt}
            </option>
          ))}
        </select>
      ) : schema.type === 'integer' ? (
        <input
          type="number"
          value={Number(value ?? schema.default ?? 0)}
          min={schema.minimum}
          max={schema.maximum}
          onChange={e => onChange(Number(e.target.value))}
          className={base}
        />
      ) : schema.type === 'number' ? (
        <input
          type="number"
          step="any"
          value={value !== undefined && value !== '' ? Number(value) : ''}
          min={schema.minimum}
          max={schema.maximum}
          placeholder={schema.description}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={base}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? '')}
          pattern={schema.pattern}
          minLength={schema.minLength}
          maxLength={schema.maxLength}
          placeholder={schema.description}
          onChange={e => onChange(e.target.value)}
          className={base}
          autoFocus={schema['ui:autofocus']}
        />
      )}
    </div>
  );
}

// ─── Provisioning view ───────────────────────────────────────────────────────

function ProvisioningView({
  taskId,
  values,
  onRetry,
}: {
  taskId: string;
  values: Record<string, unknown>;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const [task, setTask] = useState<ScaffolderTask | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const t = await getTask(taskId);
        if (!active) return;
        setTask(t);
        if (t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled') {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        if (active) setFetchError((err as Error).message);
      }
    }

    poll();
    return () => { active = false; };
  }, [taskId]);

  const status = task?.status ?? 'open';
  const done = status === 'completed';
  const failed = status === 'failed' || status === 'cancelled';
  const processing = status === 'open' || status === 'processing';

  // Steps do spec (sempre disponíveis, só nomes)
  const specSteps = task?.spec?.steps ?? [];

  // Links do output (só disponíveis em completed)
  const outputLinks = task?.output?.links ?? [];
  const githubLink = outputLinks.find(l => l.url?.includes('github.com'));
  const catalogLink = outputLinks.find(l => l.entityRef);

  return (
    <div className="space-y-4">

      {/* Resumo do pedido */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Resumo do pedido
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {Object.entries(values).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium text-slate-800">{String(val)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3 font-mono">ID: {taskId.slice(0, 12)}</p>
          </div>
        </div>
      </div>

      {/* Progresso */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          {processing && <Loader2 size={16} className="animate-spin text-indigo-500 flex-shrink-0" />}
          {done && <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />}
          {failed && <XCircle size={16} className="text-red-500 flex-shrink-0" />}
          {!task && <Loader2 size={16} className="animate-spin text-slate-400 flex-shrink-0" />}
          <p className="text-sm font-semibold text-slate-700">
            {!task && 'Conectando ao servidor...'}
            {processing && 'Provisionando...'}
            {done && 'Provisionamento concluído'}
            {failed && 'Falha no provisionamento'}
          </p>
        </div>

        {fetchError && (
          <div className="px-5 py-4 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={14} /> {fetchError}
          </div>
        )}

        {/* Lista de steps (nomes) com estado visual baseado no status geral */}
        {specSteps.length > 0 && (
          <div className="px-5 py-4">
            <div className="space-y-0">
              {specSteps.map((step, i) => {
                const isLast = i === specSteps.length - 1;
                return (
                  <div key={step.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      {done ? (
                        <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                      ) : failed ? (
                        <XCircle size={20} className="text-red-400 flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white flex-shrink-0" />
                      )}
                      {!isLast && (
                        <div className={`w-0.5 flex-1 my-1 min-h-4 ${done ? 'bg-green-200' : 'bg-slate-200'}`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm font-medium ${done ? 'text-slate-800' : failed ? 'text-slate-500' : 'text-slate-400'}`}>
                        {step.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sucesso */}
      {done && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Recurso provisionado com sucesso!</p>
              <p className="text-sm text-green-700 mt-0.5">
                Repositório criado e registrado no catálogo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {githubLink?.url && (
              <a
                href={githubLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ExternalLink size={14} /> Ver no GitHub
              </a>
            )}
            {catalogLink?.entityRef && (
              <a
                href={`http://localhost:3000/catalog/${catalogLink.entityRef.replace(':', '/')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-green-300 text-green-800 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
              >
                <BookOpen size={14} /> Ver no catálogo
              </a>
            )}
            <button
              onClick={() => navigate(provider ? `/providers/${provider}` : '/')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Provisionar outro recurso
            </button>
          </div>
        </div>
      )}

      {/* Falha */}
      {failed && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <XCircle size={22} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Falha no provisionamento</p>
              <p className="text-sm text-red-700 mt-0.5">
                Verifique as permissões e tente novamente.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
            >
              <RotateCcw size={14} /> Tentar novamente
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Ver todos os pedidos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInitialValues(template: Template): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const group of template.spec.parameters ?? []) {
    for (const [key, schema] of Object.entries(group.properties ?? {})) {
      if (schema.default !== undefined) {
        values[key] = schema.default;
      } else if (schema.type === 'boolean') {
        values[key] = false;
      } else if (schema.type === 'array') {
        values[key] = [];
      } else if (schema.type === 'object') {
        values[key] = {};
      } else {
        values[key] = schema.enum?.[0] ?? '';
      }
    }
  }
  return values;
}

function collectRequired(template: Template): Set<string> {
  const required = new Set<string>();
  for (const group of template.spec.parameters ?? []) {
    for (const r of group.required ?? []) required.add(r);
  }
  return required;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function TemplatePage() {
  const { name } = useParams<{ name: string }>();
  const location = useLocation();
  const provider = (location.state as { provider?: string } | null)?.provider;
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submittedValues, setSubmittedValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!name) return;
    getTemplate(name)
      .then(t => {
        setTemplate(t);
        setValues(buildInitialValues(t));
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!template) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await submitTemplate(template.metadata.name, values);
      setSubmittedValues({ ...values });
      setTaskId(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Carregando template...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle size={16} /> {error ?? 'Template não encontrado.'}
      </div>
    );
  }

  const required = collectRequired(template);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-slate-800">Provedores</Link>
        {provider && (
          <>
            <span>/</span>
            <Link to={`/providers/${provider}`} state={{ provider }} className="hover:text-slate-800 capitalize">
              {provider.toUpperCase()}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-800 font-medium">
          {template.metadata.title ?? template.metadata.name}
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {template.metadata.title ?? template.metadata.name}
        </h1>
        {template.metadata.description && (
          <p className="text-slate-500 mt-1">{template.metadata.description}</p>
        )}
      </div>

      {taskId ? (
        <ProvisioningView
          taskId={taskId}
          values={submittedValues}
          onRetry={() => { setTaskId(null); setError(null); }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {(template.spec.parameters ?? []).map((group, gi) => (
            <div key={gi} className="px-6 py-5 border-b border-slate-100 last:border-0">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">{group.title}</h2>
              <div className="space-y-4">
                {Object.entries(group.properties ?? {}).map(([key, schema]) => (
                  <Field
                    key={key}
                    schema={schema}
                    value={values[key]}
                    required={required.has(key)}
                    onChange={v => setValues(prev => ({ ...prev, [key]: v }))}
                  />
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="mx-6 mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              ) : (
                <>Provisionar recurso <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
