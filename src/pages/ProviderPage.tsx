import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Tag, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { getTemplatesByProvider } from '../api/backstage';
import { PROVIDER_DISPLAY, ProviderIcon, getProviderDisplay } from '../providers';
import type { Template } from '../types';

export function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.toLowerCase() ?? '';
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !PROVIDER_DISPLAY[id]) {
      setError('Provedor não disponível ainda.');
      setLoading(false);
      return;
    }
    getTemplatesByProvider(id)
      .then(setTemplates)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const provider = id ? getProviderDisplay(id) : null;

  const filtered = query
    ? templates.filter(
        t =>
          t.metadata.title?.toLowerCase().includes(query) ||
          t.metadata.description?.toLowerCase().includes(query) ||
          t.metadata.tags?.some(tag => tag.includes(query))
      )
    : templates;

  if (!provider || !id || !PROVIDER_DISPLAY[id]) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <AlertCircle size={16} /> Provedor desconhecido.
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-slate-800">Provedores</Link>
        <span>/</span>
        <span className="flex items-center gap-1 font-medium text-slate-800">
          <ProviderIcon id={id} size={16} /> {provider.name}
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Templates {provider.name}</h1>
        <p className="text-slate-500 mt-1">
          Selecione um recurso para provisionar na sua conta {provider.name}.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Carregando templates...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-slate-500 text-sm">
          {query
            ? `Nenhum template encontrado para "${query}".`
            : `Nenhum template ${provider.name} disponível no catálogo.`}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map(t => (
          <div
            key={t.metadata.name}
            onClick={() => navigate(`/templates/${t.metadata.name}`, { state: { provider: id } })}
            className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg ${provider.bgColor} flex items-center justify-center flex-shrink-0 border`}>
                <ProviderIcon id={id} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {t.metadata.title ?? t.metadata.name}
                </p>
                {t.metadata.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                    {t.metadata.description}
                  </p>
                )}
                {t.metadata.tags && t.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {t.metadata.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                      >
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-500 flex-shrink-0 mt-1 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
