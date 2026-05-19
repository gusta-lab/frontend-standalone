import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { listTasks } from '../api/backstage';
import type { ScaffolderTask } from '../types';

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: JSX.Element; chip: string }
> = {
  completed: {
    label: 'Concluído',
    icon: <CheckCircle2 size={14} className="text-green-500" />,
    chip: 'bg-green-50 text-green-700 border-green-200',
  },
  failed: {
    label: 'Falhou',
    icon: <XCircle size={14} className="text-red-500" />,
    chip: 'bg-red-50 text-red-700 border-red-200',
  },
  processing: {
    label: 'Processando',
    icon: <Loader2 size={14} className="animate-spin text-indigo-500" />,
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  open: {
    label: 'Aguardando',
    icon: <Clock size={14} className="text-slate-400" />,
    chip: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  cancelled: {
    label: 'Cancelado',
    icon: <XCircle size={14} className="text-slate-400" />,
    chip: 'bg-slate-50 text-slate-500 border-slate-200',
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function templateLabel(task: ScaffolderTask) {
  return (
    task.spec.templateInfo?.entity?.metadata.title ??
    task.spec.templateInfo?.entity?.metadata.name ??
    task.spec.templateInfo?.entityRef?.split('/').pop() ??
    'Template desconhecido'
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ScaffolderTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listTasks()
      .then(data => setTasks([...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )))
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Histórico</h1>
          <p className="text-slate-500 mt-1">Todos os provisionamentos realizados.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Clock size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum provisionamento encontrado.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Explorar provedores →
          </button>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map(task => {
          const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.open;
          const params = Object.entries(task.spec.parameters ?? {});
          return (
            <div
              key={task.id}
              className="bg-white border border-slate-200 rounded-xl px-5 py-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">{status.icon}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm">
                      {templateLabel(task)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${status.chip}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {params.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                      {params.map(([key, val]) => (
                        <span key={key} className="text-xs text-slate-400">
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          {': '}
                          <span className="text-slate-600 font-medium">{String(val)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-1.5 font-mono">
                    {formatDate(task.createdAt)} · {task.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
