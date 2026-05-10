import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)
const SESSION_KEY = 'sh_v2_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) setSession(JSON.parse(raw))
    } catch {}
    setLoading(false)
  }, [])

  async function login(username, password) {
    const uname = username.trim().toLowerCase()

    // Try exact match first, then lowercase
    const { data: rows, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username.trim()},username.eq.${uname}`)

    if (error) throw new Error(`Connection error: ${error.message}`)
    if (!rows?.length) throw new Error('Invalid username or password.')

    // Match password manually (handles case-insensitive usernames)
    const user = rows.find(r => r.password === password)
    if (!user) throw new Error('Invalid username or password.')

    let employee     = null
    let company      = null
    let assignedSites = []
    let rolePerms    = {}

    if (user.employee_id) {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('id', user.employee_id)
        .maybeSingle()
      employee = data
    }

    if (user.company_id) {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .maybeSingle()
      company = data
    }

    if (employee?.id) {
      const { data: links } = await supabase
        .from('employee_sites')
        .select('site_id, sites(*)')
        .eq('employee_id', employee.id)
      assignedSites = links?.map(l => l.sites).filter(Boolean) ?? []

      if (employee.role_id) {
        const { data: role } = await supabase
          .from('roles')
          .select('permissions')
          .eq('id', employee.role_id)
          .maybeSingle()
        rolePerms = role?.permissions ?? {}
      }
    }

    const newSession = { user, employee, company, assignedSites, rolePerms }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(newSession)) } catch {}
    setSession(newSession)
    return newSession
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY) } catch {}
    setSession(null)
  }

  function refreshSession(patch) {
    const updated = { ...session, ...patch }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(updated)) } catch {}
    setSession(updated)
  }

  function can(feature, action = 'view') {
    const u = session?.user
    if (!u) return false
    if (u.is_superadmin || u.role === 'company_admin') return true
    return session?.rolePerms?.[feature]?.[action] ?? false
  }

  return (
    <AuthCtx.Provider value={{
      user:           session?.user         ?? null,
      employee:       session?.employee     ?? null,
      company:        session?.company      ?? null,
      assignedSites:  session?.assignedSites ?? [],
      loading,
      login,
      logout,
      refreshSession,
      can,
      isSuperAdmin:   session?.user?.is_superadmin === true,
      isCompanyAdmin: session?.user?.role === 'company_admin',
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
