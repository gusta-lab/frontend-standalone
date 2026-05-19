import { NavLink } from 'react-router-dom';
import { Cloud, Globe2, Layers, ClipboardList, Terminal } from 'lucide-react';

export function Sidebar() {
  const navItem =
    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-slate-400 hover:text-white hover:bg-slate-800';
  const navItemActive = 'bg-slate-800 text-white';

  return (
    <aside className="w-56 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <NavLink to="/" className="flex items-center gap-3 px-4 py-5 border-b border-slate-800 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Terminal size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-none">GustaLab</p>
          <p className="text-slate-500 text-xs mt-0.5">CONSOLE</p>
        </div>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 pb-2">
          Provedores
        </p>

        <NavLink
          to="/providers/aws"
          className={({ isActive }) =>
            `${navItem} ${isActive ? navItemActive : ''}`
          }
        >
          <Cloud size={16} className="text-orange-400 flex-shrink-0" />
          AWS
        </NavLink>

        <div className={`${navItem} opacity-40 cursor-not-allowed`}>
          <Globe2 size={16} className="text-blue-400 flex-shrink-0" />
          GCP
          <span className="ml-auto text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
            breve
          </span>
        </div>

        <div className={`${navItem} opacity-40 cursor-not-allowed`}>
          <Layers size={16} className="text-sky-400 flex-shrink-0" />
          Azure
          <span className="ml-auto text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
            breve
          </span>
        </div>

        <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 pb-2 pt-4">
          Geral
        </p>

        <NavLink
          to="/orders"
          className={({ isActive }) =>
            `${navItem} ${isActive ? navItemActive : ''}`
          }
        >
          <ClipboardList size={16} className="flex-shrink-0" />
          Histórico
        </NavLink>


      </nav>

      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-slate-700 text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
