import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, BarChart3, LogOut, HardHat, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/superadmin',           icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/superadmin/companies', icon: Building2,       label: 'Companies' },
  { to: '/superadmin/analytics', icon: BarChart3,       label: 'Analytics' },
]

export default function SuperadminShell() {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col fixed h-full hidden md:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
            <HardHat size={20} className="text-slate-900" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">SiteHub Pro</p>
            <p className="text-amber-400 text-xs mt-0.5 font-medium">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'}
              `}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-800 border-b border-slate-700 h-14 flex items-center px-4 gap-3">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
          <HardHat size={16} className="text-slate-900" />
        </div>
        <p className="text-white font-bold flex-1">SiteHub Pro</p>
        <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg font-semibold">SUPERADMIN</span>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t border-slate-700 flex safe-bottom">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) => `
              flex-1 flex flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors
              ${isActive ? 'text-amber-400' : 'text-slate-500'}
            `}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-1 text-xs font-medium text-slate-500"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </div>
  )
}
