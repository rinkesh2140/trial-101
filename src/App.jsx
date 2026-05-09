import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Spinner from './components/ui/Spinner'

import Login from './pages/Login'

import SuperadminShell from './pages/superadmin/SuperadminShell'
import SADashboard     from './pages/superadmin/Dashboard'
import SACompanies     from './pages/superadmin/Companies'
import SAAnalytics     from './pages/superadmin/Analytics'

import AdminShell      from './pages/admin/AdminShell'
import AdminDashboard  from './pages/admin/Dashboard'
import AdminSites      from './pages/admin/Sites'
import AdminEmployees  from './pages/admin/Employees'
import AdminRoles      from './pages/admin/Roles'
import AdminTasks      from './pages/admin/Tasks'
import AdminAttendance from './pages/admin/Attendance'
import AdminReports    from './pages/admin/Reports'
import AdminAnnounce   from './pages/admin/Announcements'

import AppShell        from './pages/app/AppShell'
import AppHome         from './pages/app/Home'
import AppTasks        from './pages/app/MyTasks'
import AppNotebook     from './pages/app/Notebook'
import AppAnnounce     from './pages/app/Announcements'
import AppProfile      from './pages/app/Profile'

function Guard({ require, children }) {
  const { user, loading, isSuperAdmin, isCompanyAdmin } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Spinner size={40} />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (require === 'superadmin' && !isSuperAdmin)
    return <Navigate to="/login" replace />

  if (require === 'admin' && !isCompanyAdmin && !isSuperAdmin)
    return <Navigate to="/app" replace />

  return children
}

function Root() {
  const { user, loading, isSuperAdmin, isCompanyAdmin } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (isSuperAdmin)    return <Navigate to="/superadmin" replace />
  if (isCompanyAdmin)  return <Navigate to="/admin" replace />
  return <Navigate to="/app" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />

        {/* Superadmin */}
        <Route path="/superadmin" element={<Guard require="superadmin"><SuperadminShell /></Guard>}>
          <Route index element={<SADashboard />} />
          <Route path="companies" element={<SACompanies />} />
          <Route path="analytics" element={<SAAnalytics />} />
        </Route>

        {/* Company Admin */}
        <Route path="/admin" element={<Guard require="admin"><AdminShell /></Guard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="sites"        element={<AdminSites />} />
          <Route path="employees"    element={<AdminEmployees />} />
          <Route path="roles"        element={<AdminRoles />} />
          <Route path="tasks"        element={<AdminTasks />} />
          <Route path="attendance"   element={<AdminAttendance />} />
          <Route path="reports"      element={<AdminReports />} />
          <Route path="announcements" element={<AdminAnnounce />} />
        </Route>

        {/* Employee App */}
        <Route path="/app" element={<Guard><AppShell /></Guard>}>
          <Route index element={<AppHome />} />
          <Route path="tasks"         element={<AppTasks />} />
          <Route path="notebook"      element={<AppNotebook />} />
          <Route path="announcements" element={<AppAnnounce />} />
          <Route path="profile"       element={<AppProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
