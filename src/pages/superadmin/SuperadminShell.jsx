import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Building2, Users, BarChart3,
  LogOut, HardHat, Menu, X, ShieldCheck,
  Clock, CheckSquare, Megaphone
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/superadmin',               icon: LayoutDashboard, label: 'Overview',      end: true },
  { to: '/superadmin/companies',     icon: Building2,       label: 'Companies'                },
  { to: '/superadmin/attendance',    icon: Clock,           label: 'Attendance'               },
  { to: '/superadmin/tasks',         icon: CheckSquare,     label: 'Tasks'                    },
  { to: '/superadmin/announcements', icon: Megaphone,       label: 'Announcements'            },
  { to: '/superadmin/analytics',     icon: BarChart3,       label: 'Analytics'                },
  { to: '/superadmin/users',         icon: Users,           label: 'Users'                    },
]

export default function SuperadminShell() {
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const [open, setOpen] = useState(false)

  function handleLogout() { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {open && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-800 border-r border-slate-700 flex flex-col z-50 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <HardHat size={18} className="text-slate-900" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">SiteHub Pro</p>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck size={10} className="text-amber-400" />
                <p className="text-amber-400 text-xs font-semibold">SUPER ADMIN</p>
              </div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden text-slate-400"><X size={18} /></button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isActive ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <LogOut size={17} />Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-800 border-b border-slate-700 h-14 flex items-center px-4 gap-3">
        <button onClick={() => setOpen(true)} className="text-slate-400"><Menu size={22} /></button>
        <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
          <HardHat size={14} className="text-slate-900" />
        </div>
        <p className="text-white font-bold flex-1 text-sm">SiteHub Pro</p>
        <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg font-bold">SA</span>
      </div>

      {/* Main */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav — show first 5 items */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t border-slate-700">
        <div className="flex">
          {NAV.slice(0, 5).map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[9px] font-medium transition-colors min-h-[52px]
                ${isActive ? 'text-amber-400' : 'text-slate-500'}`}
            >
              <Icon size={19} strokeWidth={1.75} />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
