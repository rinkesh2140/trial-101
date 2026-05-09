import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Users, ShieldCheck,
  CheckSquare, Clock, FileBarChart, Megaphone, LogOut, HardHat, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Dashboard',    end: true },
  { to: '/admin/sites',        icon: MapPin,          label: 'Sites'         },
  { to: '/admin/employees',    icon: Users,           label: 'Employees'     },
  { to: '/admin/roles',        icon: ShieldCheck,     label: 'Roles'         },
  { to: '/admin/tasks',        icon: CheckSquare,     label: 'Tasks'         },
  { to: '/admin/attendance',   icon: Clock,           label: 'Attendance'    },
  { to: '/admin/reports',      icon: FileBarChart,    label: 'Reports'       },
  { to: '/admin/announcements',icon: Megaphone,       label: 'Announce'      },
]

export default function AdminShell() {
  const { logout, company } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleLogout() { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-800 border-r border-slate-700 flex flex-col z-50 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
              <HardHat size={16} className="text-slate-900" />
            </div>
            <div>
              <p className="text-white font-bold text-xs leading-none">SiteHub Pro</p>
              <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[130px]">{company?.name ?? 'Admin'}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'}
              `}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2.5 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-800 border-b border-slate-700 h-14 flex items-center px-4 gap-3">
        <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
          <Menu size={22} />
        </button>
        <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
          <HardHat size={14} className="text-slate-900" />
        </div>
        <p className="text-white font-semibold flex-1 text-sm truncate">{company?.name ?? 'Admin'}</p>
        <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg font-semibold">ADMIN</span>
      </div>

      {/* Main */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 overflow-y-auto min-h-screen">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
