import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('sh_session')
    if (raw) {
      try { setSession(JSON.parse(raw)) } catch {}
    }
    setLoading(false)
  }, [])

  async function login(username, password) {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim())
      .eq('password', password)

    if (error) throw new Error('Connection error. Please try again.')
    if (!users?.length) throw new Error('Invalid username or password.')

    const user = users[0]

    let employee     = null
    let company      = null
    let assignedSites = []
    let rolePerms    = {}

    if (user.employee_id) {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('id', user.employee_id)
        .single()
      employee = data
    }

    if (user.company_id) {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single()
      company = data
    }

    if (employee?.id) {
      const { data: siteLinks } = await supabase
        .from('employee_sites')
        .select('site_id, sites(*)')
        .eq('employee_id', employee.id)
      assignedSites = siteLinks?.map(s => s.sites).filter(Boolean) ?? []
    }

    if (employee?.role_id) {
      const { data: role } = await supabase
        .from('roles')
        .select('permissions')
        .eq('id', employee.role_id)
        .single()
      rolePerms = role?.permissions ?? {}
    }

    const newSession = { user, employee, company, assignedSites, rolePerms }
    localStorage.setItem('sh_session', JSON.stringify(newSession))
    setSession(newSession)
    return newSession
  }

  function logout() {
    localStorage.removeItem('sh_session')
    setSession(null)
  }

  function refreshSession(patch) {
    const updated = { ...session, ...patch }
    localStorage.setItem('sh_session', JSON.stringify(updated))
    setSession(updated)
  }

  function can(feature, action = 'view') {
    const u = session?.user
    if (!u) return false
    if (u.is_superadmin || u.role === 'company_admin') return true
    const p = session?.rolePerms ?? {}
    return p[feature]?.[action] ?? false
  }

  return (
    <AuthCtx.Provider value={{
      user:          session?.user      ?? null,
      employee:      session?.employee  ?? null,
      company:       session?.company   ?? null,
      assignedSites: session?.assignedSites ?? [],
      loading,
      login,
      logout,
      refreshSession,
      can,
      isSuperAdmin:    session?.user?.is_superadmin === true,
      isCompanyAdmin:  session?.user?.role === 'company_admin',
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
