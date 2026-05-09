import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, HardHat, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const { login }   = useAuth()
  const navigate    = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) return
    setError('')
    setLoading(true)
    try {
      const { user } = await login(username, password)
      if (user.is_superadmin)        navigate('/superadmin', { replace: true })
      else if (user.role === 'company_admin') navigate('/admin', { replace: true })
      else                           navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-5">
      {/* Brand */}
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/25">
          <HardHat size={40} className="text-slate-900" strokeWidth={2} />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">SiteHub Pro</h1>
        <p className="text-slate-400 text-base mt-1.5">Construction Site Management</p>
      </div>

      {/* Card */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 space-y-4">
          <h2 className="text-lg font-semibold text-white">Sign in to your account</h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-3.5">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoCapitalize="none"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3.5 text-base border border-slate-600 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3.5 pr-12 text-base border border-slate-600 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold rounded-xl py-4 text-base transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" /> Signing in...</>
              : 'Sign In'}
          </button>
        </div>
      </form>

      <p className="text-slate-600 text-xs mt-8">© 2025 SiteHub Pro · All rights reserved</p>
    </div>
  )
}
