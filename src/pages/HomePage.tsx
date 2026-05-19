import { useNavigate } from 'react-router-dom';
import { Cloud, Globe2, Layers, Plus } from 'lucide-react';

const providers = [
  {
    id: 'aws',
    name: 'AWS',
    icon: <Cloud size={32} className="text-orange-400" />,
    color: 'bg-orange-50 border-orange-100',
    count: null,
    active: true,
  },
  {
    id: 'gcp',
    name: 'GCP',
    icon: <Globe2 size={32} className="text-blue-400" />,
    color: 'bg-blue-50 border-blue-100',
    count: null,
    active: false,
  },
  {
    id: 'azure',
    name: 'Azure',
    icon: <Layers size={32} className="text-sky-400" />,
    color: 'bg-sky-50 border-sky-100',
    count: null,
    active: false,
  },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Bem-vindo ao GustaLab Console
        </h1>
        <p className="text-slate-500 mt-1">
          Provisione recursos de infraestrutura como se estivesse comprando um produto.
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">
          Selecione um provedor
        </h2>
        <p className="text-sm text-slate-500">
          Escolha onde deseja provisionar seus recursos
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {providers.map(p => (
          <div
            key={p.id}
            onClick={() => p.active && navigate(`/providers/${p.id}`)}
            className={`
              bg-white border rounded-xl p-6 flex flex-col gap-3 transition-all
              ${p.active
                ? 'border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 cursor-pointer'
                : 'border-slate-200 opacity-50 cursor-not-allowed'}
            `}
          >
            <div className={`w-12 h-12 rounded-xl ${p.color} flex items-center justify-center border`}>
              {p.icon}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{p.name}</p>
              {p.active ? (
                <p className="text-sm text-indigo-600 font-medium mt-1">
                  Explorar →
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Em breve</p>
              )}
            </div>
          </div>
        ))}

        {/* Card "mais provedores" */}
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 flex flex-col gap-3 opacity-50 cursor-not-allowed">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Plus size={24} className="text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-500">Em breve</p>
            <p className="text-xs text-slate-400 mt-1">Mais provedores</p>
          </div>
        </div>
      </div>
    </div>
  );
}
