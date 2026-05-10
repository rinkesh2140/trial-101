import { Outlet, NavLink } from 'react-router-dom'
import { Home, CheckSquare, FileText, Megaphone, User } from 'lucide-react'

const TABS = [
  { to: '/app',               icon: Home,        label: 'Home',    end: true },
  { to: '/app/tasks',         icon: CheckSquare, label: 'Tasks'           },
  { to: '/app/reports',       icon: FileText,    label: 'Reports'         },
  { to: '/app/announcements', icon: Megaphone,   label: 'Updates'         },
  { to: '/app/profile',       icon: User,        label: 'Profile'         },
]

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t border-slate-700 safe-bottom">
        <div className="flex max-w-lg mx-auto">
          {TABS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors min-h-[60px]
                ${isActive ? 'text-amber-400' : 'text-slate-500 active:text-slate-300'}
              `}
            >
              <Icon size={22} strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
