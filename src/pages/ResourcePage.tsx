import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, AlertCircle, ExternalLink, Tag,
  GitBranch, Box, User, Activity,
} from 'lucide-react';
import { getEntityByRef } from '../api/backstage';
import { ProviderIcon } from '../providers';
import type { CatalogEntity } from '../types';

const LIFECYCLE_CONFIG: Record<string, { label: string; chip: string }> = {
  production:    { label: 'Production',    chip: 'bg-green-50 text-green-700 border-green-200'   },
  staging:       { label: 'Staging',       chip: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  sandbox:       { label: 'Sandbox',       chip: 'bg-slate-50 text-slate-600 border-slate-200'    },
  experimental:  { label: 'Experimental',  chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  deprecated:    { label: 'Deprecated',    chip: 'bg-red-50 text-red-600 border-red-200'          },
};

function lifecycleChip(lifecycle?: string) {
  const cfg = LIFECYCLE_CONFIG[lifecycle ?? ''] ?? {
    label: lifecycle ?? 'unknown',
    chip: 'bg-slate-50 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.chip}`}>
      <Activity size={10} />
      {cfg.label}
    </span>
  );
}

function inferProvider(entity: CatalogEntity): string | undefined {
  const tags = entity.metadata.tags ?? [];
  for (const t of tags) {
    if (['aws', 'gcp', 'azure'].includes(t)) return t;
  }
  return undefined;
}

export function ResourcePage() {
  const { kind = '', namespace = '', name = '' } = useParams<{
    kind: string;
    namespace: string;
    name: string;
  }>();

  const entityRef = `${kind}:${namespace}/${name}`;

  const [entity, setEntity] = useState<CatalogEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntityByRef(entityRef)
      .then(setEntity)
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [entityRef]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Carregando recurso...
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle size={16} /> {error ?? 'Recurso não encontrado.'}
      </div>
    );
  }

  const provider = inferProvider(entity);
  const links = entity.metadata.links ?? [];
  const githubLink = links.find(l => l.url.includes('github.com'));
  const otherLinks = links.filter(l => !l.url.includes('github.com'));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-slate-800">Provedores</Link>
        {provider && (
          <>
            <span>/</span>
            <Link to={`/providers/${provider}`} className="hover:text-slate-800 uppercase">
              {provider.toUpperCase()}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-800 font-medium">
          {entity.metadata.title ?? entity.metadata.name}
        </span>
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
        <div className="flex items-start gap-4">
          {provider && (
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
              <ProviderIcon id={provider} size={28} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-slate-900">
                {entity.metadata.title ?? entity.metadata.name}
              </h1>
              {lifecycleChip(entity.spec.lifecycle)}
            </div>
            {entity.metadata.description && (
              <p className="text-slate-500 text-sm">{entity.metadata.description}</p>
            )}
            {entity.metadata.tags && entity.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {entity.metadata.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    <Tag size={10} /> {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-4">
        {entity.spec.type && (
          <div className="flex items-center gap-3 px-5 py-3">
            <Box size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-500 w-24">Tipo</span>
            <span className="text-sm font-medium text-slate-800">{entity.spec.type}</span>
          </div>
        )}
        {entity.spec.owner && (
          <div className="flex items-center gap-3 px-5 py-3">
            <User size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-500 w-24">Dono</span>
            <span className="text-sm font-medium text-slate-800">{entity.spec.owner}</span>
          </div>
        )}
        <div className="flex items-center gap-3 px-5 py-3">
          <GitBranch size={15} className="text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-500 w-24">Ref</span>
          <span className="text-xs font-mono text-slate-500">{entityRef}</span>
        </div>
      </div>

      {/* Links */}
      {(githubLink || otherLinks.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Links</p>
          <div className="flex flex-wrap gap-3">
            {githubLink && (
              <a
                href={githubLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ExternalLink size={14} /> {githubLink.title ?? 'GitHub'}
              </a>
            )}
            {otherLinks.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ExternalLink size={14} /> {l.title ?? l.url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
