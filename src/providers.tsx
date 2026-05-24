import { Cloud, Globe2, Layers } from 'lucide-react';

export interface ProviderDisplay {
  name: string;
  color: string;
  bgColor: string;
}

export const PROVIDER_DISPLAY: Record<string, ProviderDisplay> = {
  aws:   { name: 'AWS',   color: 'text-orange-400', bgColor: 'bg-orange-50 border-orange-100' },
  gcp:   { name: 'GCP',   color: 'text-blue-400',   bgColor: 'bg-blue-50 border-blue-100'     },
  azure: { name: 'Azure', color: 'text-sky-400',     bgColor: 'bg-sky-50 border-sky-100'       },
};

export function ProviderIcon({ id, size }: { id: string; size: number }) {
  switch (id) {
    case 'aws':   return <Cloud   size={size} className="text-orange-400" />;
    case 'gcp':   return <Globe2  size={size} className="text-blue-400"   />;
    case 'azure': return <Layers  size={size} className="text-sky-400"    />;
    default:      return <Cloud   size={size} className="text-slate-400"  />;
  }
}

export function getProviderDisplay(id: string): ProviderDisplay {
  return PROVIDER_DISPLAY[id] ?? {
    name: id.toUpperCase(),
    color: 'text-slate-400',
    bgColor: 'bg-slate-50 border-slate-200',
  };
}
