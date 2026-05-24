import { NavLink, useLocation } from 'react-router-dom';
import {
  Terminal, Cloud, Server, LayoutDashboard, BarChart2,
  ScrollText, PlayCircle, BookOpen, Plug, Shield, ChevronDown
} from 'lucide-react';
import { useState, useEffect } from 'react';

type NavItem = {
  label: string;
  icon: React.ReactNode;
  to?: string;
  disabled?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
  activePaths?: string[];
};

const GROUPS: NavGroup[] = [
  {
    id: 'infra',
    label: 'Infraestrutura',
    defaultOpen: true,
    activePaths: ['/providers', '/templates', '/resources'],
    items: [
      { label: 'Cloud', icon: <Cloud size={15} className="text-orange-400" />, to: '/providers/aws' },
      { label: 'On-Premise', icon: <Server size={15} className="text-slate-500" />, disabled: true },
    ],
  },
  {
    id: 'obs',
    label: 'Observabilidade',
    activePaths: ['/orders', '/dashboards', '/metrics', '/logs'],
    items: [
      { label: 'Dashboards', icon: <LayoutDashboard size={15} className="text-slate-500" />, disabled: true },
      { label: 'Métricas', icon: <BarChart2 size={15} className="text-slate-500" />, disabled: true },
      { label: 'Logs', icon: <ScrollText size={15} className="text-slate-500" />, disabled: true },
      { label: 'Execuções', icon: <PlayCircle size={15} className="text-emerald-400" />, to: '/orders' },
    ],
  },
  {
    id: 'config',
    label: 'Configurações',
    activePaths: ['/cadastros', '/integracoes', '/permissoes'],
    items: [
      { label: 'Cadastros', icon: <BookOpen size={15} className="text-slate-500" />, disabled: true },
      { label: 'Integrações', icon: <Plug size={15} className="text-slate-500" />, disabled: true },
      { label: 'Permissões', icon: <Shield size={15} className="text-slate-500" />, disabled: true },
    ],
  },
];

function useActiveGroup(pathname: string) {
  for (const g of GROUPS) {
    if (g.activePaths?.some(p => pathname.startsWith(p))) return g.id;
  }
  return null;
}

export function Sidebar() {
  const { pathname } = useLocation();
  const activeGroup = useActiveGroup(pathname);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map(g => [g.id, g.defaultOpen ?? false]))
  );

  // Auto-expand the group that owns the current route
  useEffect(() => {
    if (activeGroup) {
      setOpen(prev => prev[activeGroup] ? prev : { ...prev, [activeGroup]: true });
    }
  }, [activeGroup]);

  const toggle = (id: string) =>
    setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const itemBase =
    'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors duration-150';
  const itemIdle = 'text-slate-400 hover:text-white hover:bg-slate-800';
  const itemActive = 'bg-slate-800 text-white';
  const itemDisabled = 'text-slate-600 cursor-not-allowed opacity-60';

  return (
    <aside className="w-56 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <NavLink
        to="/"
        className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Terminal size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-none">GustaLab</p>
          <p className="text-slate-500 text-xs mt-0.5">CONSOLE</p>
        </div>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {GROUPS.map(group => (
          <div key={group.id} className="mb-1">
            {/* Group header */}
            <button
              onClick={() => toggle(group.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors duration-150 select-none"
            >
              {group.label}
              <ChevronDown
                size={13}
                className="transition-transform duration-200"
                style={{ transform: open[group.id] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>

            {/* Group items */}
            <div
              className="overflow-hidden transition-all duration-200"
              style={{ maxHeight: open[group.id] ? `${group.items.length * 40}px` : '0px' }}
            >
              <div className="pt-0.5 pb-1 space-y-0.5">
                {group.items.map(item =>
                  item.disabled ? (
                    <div key={item.label} className={`${itemBase} ${itemDisabled}`}>
                      {item.icon}
                      <span>{item.label}</span>
                      <span className="ml-auto text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                        breve
                      </span>
                    </div>
                  ) : (
                    <NavLink
                      key={item.label}
                      to={item.to!}
                      className={({ isActive }) =>
                        `${itemBase} ${isActive ? itemActive : itemIdle}`
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-slate-700 text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
