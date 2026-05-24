import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, Loader2, CheckCircle2, XCircle,
  ChevronRight, Package, ExternalLink, RotateCcw, BookOpen, Minus,
} from 'lucide-react';
import { getTemplate, submitTemplate, getTask, streamTask } from '../api/backstage';
import type { StepStatus } from '../api/backstage';
import { getLatestWorkflowRun, parseGithubRepo, parseGithubPR, getPRPlanComment, mergePR } from '../api/github';
import type { WorkflowRun } from '../api/github';
import type { Template, TemplateProperty, ScaffolderTask, ScaffoldOutput } from '../types';

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

  if (schema['ui:widget'] === 'hidden') return null;

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

// ─── Step icon ────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />;
    case 'failed':    return <XCircle      size={20} className="text-red-400 flex-shrink-0"   />;
    case 'skipped':   return <Minus        size={20} className="text-slate-300 flex-shrink-0" />;
    case 'processing':return <Loader2      size={20} className="animate-spin text-indigo-500 flex-shrink-0" />;
    default:          return <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white flex-shrink-0" />;
  }
}

// ─── Terraform plan colorizer ────────────────────────────────────────────────

function planLineColor(line: string): string {
  const t = line.trimStart();
  if (t.startsWith('+')) return 'text-green-600';
  if (t.startsWith('-')) return 'text-red-500';
  if (t.startsWith('~')) return 'text-yellow-600';
  if (t.startsWith('#')) return 'text-indigo-500 font-semibold';
  if (t.startsWith('Plan:')) return 'text-slate-900 font-semibold';
  if (t.startsWith('<=')) return 'text-cyan-600';
  return 'text-slate-500';
}


// ─── PR Review card ──────────────────────────────────────────────────────────

function PRReviewCard({ prUrl, onBack }: { prUrl: string; onBack: () => void }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [applyRun, setApplyRun] = useState<WorkflowRun | null | undefined>(undefined);
  const preRunIdRef = useRef<number>(0);

  const prInfo = parseGithubPR(prUrl);

  // Fase 1: poll plan comment
  useEffect(() => {
    if (!prInfo) { setPolling(false); return; }
    let active = true;
    async function poll() {
      const comment = await getPRPlanComment(prInfo!.owner, prInfo!.repo, prInfo!.number);
      if (!active) return;
      if (comment) { setPlan(comment); setPolling(false); }
      else setTimeout(poll, 5000);
    }
    poll();
    return () => { active = false; };
  }, [prUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fase 2: poll apply workflow após merge
  useEffect(() => {
    if (!merged || !prInfo) return;
    let active = true;
    let last: WorkflowRun | null = null;
    async function poll() {
      const run = await getLatestWorkflowRun(prInfo!.owner, prInfo!.repo);
      if (!active) return;
      if (run !== undefined) {
        if (!run || run.id <= preRunIdRef.current) {
          setTimeout(poll, 10000);
          return;
        }
        last = run;
        setApplyRun(run);
      }
      if (last?.status !== 'completed') setTimeout(poll, 10000);
    }
    poll();
    return () => { active = false; };
  }, [merged]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMerge() {
    if (!prInfo) return;
    setMerging(true);
    setMergeError(null);
    try {
      const currentRun = await getLatestWorkflowRun(prInfo.owner, prInfo.repo);
      preRunIdRef.current = currentRun?.id ?? 0;
      await mergePR(prInfo.owner, prInfo.repo, prInfo.number);
      setMerged(true);
    } catch (err) {
      setMergeError((err as Error).message);
    } finally {
      setMerging(false);
    }
  }

  // ── Fase 2 UI ──────────────────────────────────────────────────────────────
  if (merged) {
    const applyDone   = applyRun?.status === 'completed' && applyRun.conclusion === 'success';
    const applyFailed = applyRun?.status === 'completed' && applyRun.conclusion !== 'success';
    const started     = !!applyRun && applyRun.status !== 'queued';

    const steps: { label: string; status: StepStatus }[] = [
      {
        label: 'Configurar credenciais AWS',
        status: applyFailed ? 'failed' : (started || applyDone) ? 'completed' : applyRun ? 'processing' : 'pending',
      },
      {
        label: 'Terraform Init',
        status: applyFailed ? 'failed' : (started || applyDone) ? 'completed' : 'pending',
      },
      {
        label: 'Terraform Apply',
        status: applyFailed ? 'failed' : applyDone ? 'completed' : started ? 'processing' : 'pending',
      },
    ];

    const headerLabel = !applyRun
      ? 'Aguardando pipeline AWS...'
      : applyDone   ? 'Mudanças aplicadas na AWS com sucesso!'
      : applyFailed ? 'Falha no pipeline de infraestrutura'
      : 'Aplicando mudanças na AWS...';

    const headerIcon = !applyRun
      ? <Loader2 size={16} className="animate-spin text-indigo-500" />
      : applyDone   ? <CheckCircle2 size={16} className="text-green-500" />
      : applyFailed ? <XCircle size={16} className="text-red-500" />
      : <Loader2 size={16} className="animate-spin text-indigo-500" />;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {headerIcon}
              <p className="text-sm font-semibold text-slate-700">{headerLabel}</p>
            </div>
            {applyRun?.html_url && (
              <a href={applyRun.html_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
                <ExternalLink size={12} /> GitHub Actions
              </a>
            )}
          </div>
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline AWS</p>
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1;
              const lineColor = step.status === 'completed' ? 'bg-green-200' : 'bg-slate-200';
              return (
                <div key={step.label} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <StepIcon status={step.status} />
                    {!isLast && <div className={`w-0.5 flex-1 my-1 min-h-4 ${lineColor}`} />}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm ${stepColor(step.status)}`}>{step.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {applyDone && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Mudanças aplicadas na AWS com sucesso!</p>
                <p className="text-sm text-green-700 mt-0.5">A fila SQS foi atualizada.</p>
              </div>
            </div>
            <button onClick={onBack}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Voltar para recursos
            </button>
          </div>
        )}

        {applyFailed && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <XCircle size={22} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Falha no pipeline de infraestrutura</p>
                <p className="text-sm text-red-700 mt-0.5">Verifique os logs do GitHub Actions.</p>
              </div>
            </div>
            <div className="flex gap-3">
              {applyRun?.html_url && (
                <a href={applyRun.html_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                  <ExternalLink size={14} /> Ver logs
                </a>
              )}
              <button onClick={onBack}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                Voltar para recursos
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Fase 1 UI: plan review ─────────────────────────────────────────────────
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-900">Pull Request aberto com sucesso!</p>
          <p className="text-sm text-green-700 mt-0.5">
            Revise o plano abaixo e confirme o merge para aplicar na AWS.
          </p>
        </div>
      </div>

      <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-green-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Terraform Plan</p>
          {polling && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 size={11} className="animate-spin" /> Aguardando plan...
            </span>
          )}
        </div>
        <div className="text-xs p-4 overflow-x-auto max-h-72 leading-relaxed font-mono whitespace-pre">
          {polling ? (
            <span className="text-slate-400 whitespace-normal">O Terraform Plan está sendo executado no GitHub Actions...</span>
          ) : (
            (plan ?? 'Nenhum output encontrado.').split(/\r?\n/).map((line, i) => (
              <div key={i} className={planLineColor(line)}>{line || ' '}</div>
            ))
          )}
        </div>
      </div>

      {mergeError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={14} /> {mergeError}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleMerge}
          disabled={polling || merging}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {merging
            ? <><Loader2 size={14} className="animate-spin" /> Fazendo merge...</>
            : <><CheckCircle2 size={14} /> Confirmar merge</>}
        </button>
        <a href={prUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
          <ExternalLink size={14} /> Ver Pull Request
        </a>
        <button onClick={onBack}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
          Voltar para recursos
        </button>
      </div>
    </div>
  );
}


// ─── Provisioning view ───────────────────────────────────────────────────────

function stepColor(st: StepStatus) {
  if (st === 'completed')  return 'text-slate-800';
  if (st === 'failed')     return 'text-red-600';
  if (st === 'processing') return 'text-indigo-700 font-semibold';
  return 'text-slate-400';
}

function ProvisioningView({
  taskId,
  provider,
  values,
  onRetry,
}: {
  taskId: string;
  provider: string | undefined;
  values: Record<string, unknown>;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const isUpdate = values.mode === 'update';

  // ── Tempo decorrido ───────────────────────────────────────────────────────
  const startedAt = useState(() => Date.now())[0];
  const [elapsed, setElapsed] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState<number | null>(null);

  // ── Fase 1: Backstage Scaffolder ─────────────────────────────────────────
  const [task, setTask] = useState<ScaffolderTask | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [scaffoldOutput, setScaffoldOutput] = useState<ScaffoldOutput | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();

    async function poll() {
      try {
        const t = await getTask(taskId);
        if (!active) return;
        setTask(t);
        if (!['completed', 'failed', 'cancelled'].includes(t.status)) {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        if (active) setFetchError((err as Error).message);
      }
    }

    async function startStream() {
      try {
        await streamTask(taskId, (stepId, status) => {
          if (active) setStepStatuses(prev => ({ ...prev, [stepId]: status }));
        }, (_result, output) => {
          if (active) setScaffoldOutput(output);
        }, ctrl.signal);
      } catch { /* polling cobre */ }
    }

    poll();
    startStream();
    return () => { active = false; ctrl.abort(); };
  }, [taskId]);

  const scaffoldStatus = task?.status ?? 'open';
  const scaffoldDone   = scaffoldStatus === 'completed';
  const scaffoldFailed = scaffoldStatus === 'failed' || scaffoldStatus === 'cancelled';

  const outputLinks = scaffoldOutput?.links ?? task?.output?.links ?? [];
  const githubLink  = outputLinks.find(l => l.url?.includes('github.com'));
  const catalogLink = outputLinks.find(l => l.entityRef);

  function getScaffoldStepStatus(stepId: string): StepStatus {
    if (stepStatuses[stepId]) return stepStatuses[stepId];
    if (scaffoldDone)   return 'completed';
    if (scaffoldFailed) return 'failed';
    return 'pending';
  }

  // ── Fase 2: GitHub Actions ────────────────────────────────────────────────
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);

  useEffect(() => {
    if (isUpdate || !scaffoldDone || !githubLink?.url) return;
    const parsed = parseGithubRepo(githubLink.url);
    if (!parsed) return;

    let active = true;
    let lastRun: WorkflowRun | null = null;

    async function pollWorkflow() {
      const run = await getLatestWorkflowRun(parsed!.owner, parsed!.repo);
      if (!active) return;

      // undefined = rate limit ou erro → preserva estado anterior
      if (run !== undefined) {
        lastRun = run;
        setWorkflowRun(run);
      }

      if (lastRun?.status !== 'completed') {
        setTimeout(pollWorkflow, 15000);
      }
    }

    pollWorkflow();
    return () => { active = false; };
  }, [scaffoldDone, githubLink?.url]);

  const infraDone   = workflowRun?.status === 'completed' && workflowRun.conclusion === 'success';
  const infraFailed = workflowRun?.status === 'completed' && workflowRun.conclusion !== 'success';
  const fullyDone   = isUpdate ? scaffoldDone : (scaffoldDone && infraDone);
  const anyFailed   = scaffoldFailed || infraFailed;

  useEffect(() => {
    if (fullyDone || anyFailed) {
      setFinalElapsed(prev => prev ?? Math.round((Date.now() - startedAt) / 1000));
      return;
    }
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [fullyDone, anyFailed, startedAt]);

  function formatElapsed(s: number) {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  const elapsedDisplay = finalElapsed !== null ? formatElapsed(finalElapsed) : formatElapsed(elapsed);

  // Steps do GitHub Actions com status derivado do workflow run
  const pipelineStarted = !!workflowRun && workflowRun.status !== 'queued';
  const ghSteps: { label: string; status: StepStatus }[] = [
    {
      label: 'Configurar credenciais AWS',
      status: infraFailed ? 'failed' : (pipelineStarted || infraDone) ? 'completed' : workflowRun ? 'processing' : 'pending',
    },
    {
      label: 'Terraform Init',
      status: infraFailed ? 'failed' : (pipelineStarted || infraDone) ? 'completed' : 'pending',
    },
    {
      label: 'Terraform Apply',
      status: infraFailed ? 'failed' : infraDone ? 'completed' : pipelineStarted ? 'processing' : 'pending',
    },
  ];

  // Header geral
  const overallStatus = !task
    ? { icon: <Loader2 size={16} className="animate-spin text-slate-400" />, label: 'Conectando...' }
    : scaffoldFailed
    ? { icon: <XCircle size={16} className="text-red-500" />, label: isUpdate ? 'Falha ao abrir Pull Request' : 'Falha ao criar repositório' }
    : infraFailed
    ? { icon: <XCircle size={16} className="text-red-500" />, label: 'Falha no pipeline de infraestrutura' }
    : fullyDone
    ? { icon: <CheckCircle2 size={16} className="text-green-500" />, label: isUpdate ? 'Pull Request aberto com sucesso' : 'Recurso criado com sucesso' }
    : scaffoldDone && !isUpdate
    ? { icon: <Loader2 size={16} className="animate-spin text-indigo-500" />, label: 'Aguardando pipeline AWS...' }
    : { icon: <Loader2 size={16} className="animate-spin text-indigo-500" />, label: isUpdate ? 'Abrindo Pull Request...' : 'Criando repositório...' };

  const scaffoldSteps = task?.spec?.steps ?? [];
  const totalSteps    = scaffoldSteps.length + ghSteps.length;

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
              {Object.entries(values)
                .filter(([key]) => !['mode', 'state_bucket'].includes(key))
                .map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="font-medium text-slate-800">{String(val)}</span>
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-6 mt-3">
              <p className="text-xs text-slate-400 font-mono">ID: {taskId.slice(0, 12)}</p>
              <p className="text-xs text-slate-400">
                Duração:{' '}
                <span className={`font-medium ${finalElapsed !== null ? 'text-slate-600' : 'text-indigo-500'}`}>
                  {elapsedDisplay}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trilha unificada */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

        {/* Header com status geral */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {overallStatus.icon}
            <p className="text-sm font-semibold text-slate-700">{overallStatus.label}</p>
          </div>
          {scaffoldDone && githubLink?.url && (
            <a
              href={isUpdate ? githubLink.url : (workflowRun?.html_url ?? `${githubLink.url}/actions`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
            >
              <ExternalLink size={12} /> {isUpdate ? 'Ver Pull Request' : 'GitHub Actions'}
            </a>
          )}
        </div>

        {fetchError && (
          <div className="px-5 py-3 flex items-center gap-2 text-red-600 text-sm border-b border-slate-100">
            <AlertCircle size={14} /> {fetchError}
          </div>
        )}

        {/* Steps */}
        <div className="px-5 py-5">

          {/* Fase 1: Backstage */}
          {scaffoldSteps.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Repositório
              </p>
              <div className="mb-2">
                {scaffoldSteps.map((step, i) => {
                  const st = getScaffoldStepStatus(step.id);
                  const isLastOfPhase = i === scaffoldSteps.length - 1;
                  const lineColor = st === 'completed' ? 'bg-green-200' : 'bg-slate-200';
                  return (
                    <div key={step.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <StepIcon status={st} />
                        {!(isLastOfPhase && ghSteps.length === 0) && (
                          <div className={`w-0.5 flex-1 my-1 min-h-4 ${lineColor}`} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm ${stepColor(st)}`}>{step.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Divisor entre fases */}
          {scaffoldDone && !isUpdate && (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 mt-1">
                Pipeline AWS
              </p>
              <div>
                {ghSteps.map((step, i) => {
                  const isLast = i === ghSteps.length - 1;
                  const lineColor = step.status === 'completed' ? 'bg-green-200' : 'bg-slate-200';
                  return (
                    <div key={step.label} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <StepIcon status={step.status} />
                        {!isLast && (
                          <div className={`w-0.5 flex-1 my-1 min-h-4 ${lineColor}`} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm ${stepColor(step.status)}`}>{step.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Placeholder da fase 2 antes de iniciar */}
          {!isUpdate && !scaffoldDone && totalSteps > 0 && (
            <div className="mt-1 ml-0">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Pipeline AWS
              </p>
              {ghSteps.map(step => (
                <div key={step.label} className="flex gap-4 opacity-30">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white flex-shrink-0" />
                    <div className="w-0.5 flex-1 my-1 min-h-4 bg-slate-200" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm text-slate-400">{step.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sucesso final */}
      {fullyDone && isUpdate && githubLink?.url && (
        <PRReviewCard
          prUrl={githubLink.url}
          onBack={() => navigate('/')}
        />
      )}

      {fullyDone && !isUpdate && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Recurso criado com sucesso!</p>
              <p className="text-sm text-green-700 mt-0.5">
                Fila SQS provisionada na AWS e registrada no catálogo.
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
              <button
                onClick={() => navigate(`/resources/${catalogLink.entityRef!.replace(':', '/')}`)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-green-300 text-green-800 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
              >
                <BookOpen size={14} /> Ver recurso
              </button>
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
      {anyFailed && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <XCircle size={22} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">
                {scaffoldFailed ? 'Falha ao criar repositório' : 'Falha no pipeline de infraestrutura'}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                {scaffoldFailed
                  ? 'Verifique as permissões do Backstage e tente novamente.'
                  : 'Verifique os logs do GitHub Actions e tente novamente.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {scaffoldFailed && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                <RotateCcw size={14} /> Tentar novamente
              </button>
            )}
            {infraFailed && githubLink?.url && (
              <a
                href={`${githubLink.url}/actions`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                <ExternalLink size={14} /> Ver logs
              </a>
            )}
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
  const state = location.state as { provider?: string; prefill?: Record<string, unknown> } | null;
  const provider = state?.provider;
  const prefill  = state?.prefill;
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
        setValues({ ...buildInitialValues(t), ...(prefill ?? {}) });
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
          {prefill?.mode === 'update'
            ? `Editar: ${String(prefill.queue_name ?? '')}`
            : (template.metadata.title ?? template.metadata.name)}
        </h1>
        {template.metadata.description && (
          <p className="text-slate-500 mt-1">{template.metadata.description}</p>
        )}
        {prefill?.mode === 'update' && (
          <p className="text-sm text-indigo-600 mt-1">
            As alterações serão submetidas como Pull Request para revisão antes de serem aplicadas.
          </p>
        )}
      </div>

      {taskId ? (
        <ProvisioningView
          taskId={taskId}
          provider={provider}
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
              ) : prefill?.mode === 'update' ? (
                <>Abrir Pull Request <ChevronRight size={16} /></>
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
