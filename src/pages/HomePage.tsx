import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Package, ExternalLink, Filter, Search,
  Cloud, LayoutGrid, List, ChevronDown,
} from 'lucide-react';
import { getGustaLabResources } from '../api/backstage';
import { getFileContent, parseTfvars, parseGithubRepo } from '../api/github';
import type { CatalogEntity } from '../types';

const PROVIDER_LABELS: Record<string, string> = { aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
const PROVIDER_COLORS: Record<string, string> = {
  aws: 'bg-orange-50 text-orange-700 border-orange-200',
  gcp: 'bg-blue-50 text-blue-700 border-blue-200',
  azure: 'bg-sky-50 text-sky-700 border-sky-200',
};
const TYPE_LABELS: Record<string, string> = {
  'sqs-queue': 'SQS Queue',
  queue: 'Queue',
  service: 'Service',
  website: 'Website',
  library: 'Library',
};

function providerOf(e: CatalogEntity) {
  return e.metadata.annotations?.['gustalab.io/provider']
    ?? e.metadata.tags?.find(t => ['aws', 'gcp', 'azure'].includes(t))
    ?? 'unknown';
}

function resourceTypeOf(e: CatalogEntity) {
  return e.metadata.annotations?.['gustalab.io/resource-type']
    ?? e.spec?.type
    ?? e.kind.toLowerCase();
}

function githubLinkOf(e: CatalogEntity) {
  const slug = e.metadata.annotations?.['github.com/project-slug'];
  return slug ? `https://github.com/${slug}` : null;
}

type ViewMode = 'grid' | 'list';

export function HomePage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<CatalogEntity[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
    getGustaLabResources()
      .then(setResources)
      .catch(() => { setError(true); setResources([]); });
  }, []);

  const allProviders = useMemo(() => {
    if (!resources) return [];
    return [...new Set(resources.map(providerOf))].filter(p => p !== 'unknown');
  }, [resources]);

  const allTypes = useMemo(() => {
    if (!resources) return [];
    return [...new Set(resources.map(resourceTypeOf))];
  }, [resources]);

  const filtered = useMemo(() => {
    if (!resources) return [];
    return resources.filter(r => {
      const q = search.toLowerCase();
      const matchesSearch = !q
        || r.metadata.name.toLowerCase().includes(q)
        || (r.metadata.title ?? '').toLowerCase().includes(q)
        || (r.metadata.description ?? '').toLowerCase().includes(q);
      const matchesProvider = selectedProviders.size === 0 || selectedProviders.has(providerOf(r));
      const matchesType = selectedTypes.size === 0 || selectedTypes.has(resourceTypeOf(r));
      return matchesSearch && matchesProvider && matchesType;
    });
  }, [resources, search, selectedProviders, selectedTypes]);

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }

  const hasFilters = search || selectedProviders.size > 0 || selectedTypes.size > 0;

  return (
    <div className="flex gap-6">
      {/* Feed principal */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Recursos</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {resources === null
                ? 'Carregando...'
                : `${filtered.length} recurso${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Estados */}
        {resources === null && (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Carregando recursos...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            Não foi possível carregar os recursos. Verifique se o Backstage está rodando.
          </div>
        )}

        {resources !== null && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
              <Package size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              {hasFilters ? 'Nenhum recurso com esses filtros' : 'Nenhum recurso provisionado ainda'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {hasFilters
                ? 'Tente ajustar os filtros'
                : 'Use o menu lateral para provisionar seu primeiro recurso'}
            </p>
          </div>
        )}

        {resources !== null && filtered.length > 0 && (
          view === 'grid'
            ? <ResourceGrid resources={filtered} />
            : <ResourceList resources={filtered} onOpen={r => navigate(`/resources/${r.kind.toLowerCase()}/${r.metadata.namespace ?? 'default'}/${r.metadata.name}`)} />
        )}
      </div>

      {/* Filtro lateral */}
      <aside className="w-52 flex-shrink-0">
        <div className="sticky top-6 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Filtros</span>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setSelectedProviders(new Set()); setSelectedTypes(new Set()); }}
                className="ml-auto text-xs text-indigo-600 hover:text-indigo-800"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Busca */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Provider */}
          {allProviders.length > 0 && (
            <FilterSection title="Provedor">
              {allProviders.map(p => (
                <FilterCheckbox
                  key={p}
                  label={PROVIDER_LABELS[p] ?? p.toUpperCase()}
                  checked={selectedProviders.has(p)}
                  onChange={() => setSelectedProviders(toggleSet(selectedProviders, p))}
                />
              ))}
            </FilterSection>
          )}

          {/* Tipo */}
          {allTypes.length > 0 && (
            <FilterSection title="Tipo">
              {allTypes.map(t => (
                <FilterCheckbox
                  key={t}
                  label={TYPE_LABELS[t] ?? t}
                  checked={selectedTypes.has(t)}
                  onChange={() => setSelectedTypes(toggleSet(selectedTypes, t))}
                />
              ))}
            </FilterSection>
          )}
        </div>
      </aside>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
      >
        {title}
        <ChevronDown size={12} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  );
}

function ResourceCard({ resource }: { resource: CatalogEntity }) {
  const navigate = useNavigate();
  const provider = providerOf(resource);
  const type = resourceTypeOf(resource);
  const githubLink = githubLinkOf(resource);
  const templateName = resource.metadata.annotations?.['gustalab.io/template'];
  const providerColor = PROVIDER_COLORS[provider] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!githubLink || !templateName) return;
    const parsed = parseGithubRepo(githubLink);
    if (!parsed) return;

    setLoading(true);
    try {
      const raw = await getFileContent(parsed.owner, parsed.repo, 'terraform.tfvars');
      const prefill = raw ? { ...parseTfvars(raw), mode: 'update' } : { mode: 'update' };
      navigate(`/templates/${templateName}`, { state: { provider, prefill } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-white border border-slate-200 rounded-xl p-4 transition-all group
        ${templateName ? 'hover:shadow-md hover:border-indigo-200 cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
          {loading
            ? <Loader2 size={16} className="animate-spin text-indigo-400" />
            : <Cloud size={18} className="text-orange-400" />}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${providerColor}`}>
          {PROVIDER_LABELS[provider] ?? provider.toUpperCase()}
        </span>
      </div>

      <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-indigo-700 transition-colors">
        {resource.metadata.title ?? resource.metadata.name}
      </p>
      <p className="text-xs text-slate-500 mt-0.5 truncate">
        {TYPE_LABELS[type] ?? type}
      </p>

      {resource.metadata.description && (
        <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
          {resource.metadata.description}
        </p>
      )}

      {githubLink && (
        <a
          href={githubLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ExternalLink size={11} />
          GitHub
        </a>
      )}
    </div>
  );
}

function ResourceGrid({ resources }: { resources: CatalogEntity[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {resources.map(r => (
        <ResourceCard key={r.metadata.uid ?? r.metadata.name} resource={r} />
      ))}
    </div>
  );
}

function ResourceList({ resources, onOpen }: { resources: CatalogEntity[]; onOpen: (r: CatalogEntity) => void }) {
  return (
    <div className="space-y-2">
      {resources.map(r => {
        const provider = providerOf(r);
        const type = resourceTypeOf(r);
        const githubLink = githubLinkOf(r);
        const providerColor = PROVIDER_COLORS[provider] ?? 'bg-slate-50 text-slate-600 border-slate-200';

        return (
          <div
            key={r.metadata.uid ?? r.metadata.name}
            onClick={() => onOpen(r)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Cloud size={16} className="text-orange-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors truncate">
                {r.metadata.title ?? r.metadata.name}
              </p>
              {r.metadata.description && (
                <p className="text-xs text-slate-400 truncate">{r.metadata.description}</p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-slate-400">{TYPE_LABELS[type] ?? type}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${providerColor}`}>
                {PROVIDER_LABELS[provider] ?? provider.toUpperCase()}
              </span>
              {githubLink && (
                <a
                  href={githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-slate-300 hover:text-indigo-500 transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
