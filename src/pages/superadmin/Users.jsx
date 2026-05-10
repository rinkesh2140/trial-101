import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Search, ShieldCheck, Building2, Trash2, KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const ROLE_BADGE = {
  superadmin:    'amber',
  company_admin: 'blue',
  PM: 'purple', SM: 'blue', HR: 'purple',
}

function useAllUsers() {
  return useQuery({
    queryKey: ['sa-users'],
    queryFn: async () => {
      const [{ data: users }, { data: companies }] = await Promise.all([
        supabase.from('users').select('username,role,employee_id,company_id,is_superadmin').order('role'),
        supabase.from('companies').select('id,name'),
      ])
      const compMap = Object.fromEntries((companies ?? []).map(c => [c.id, c.name]))
      return (users ?? []).map(u => ({ ...u, companyName: compMap[u.company_id] ?? null }))
    }
  })
}

export default function SAUsers() {
  const { data: users = [], isLoading } = useAllUsers()
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [resetModal, setReset]  = useState(null)
  const [newPwd, setNewPwd]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [ok, setOk]             = useState(false)

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase()) ||
    u.companyName?.toLowerCase().includes(search.toLowerCase())
  )

  async function resetPassword() {
    if (!newPwd || newPwd.length < 6) { setErr('Min 6 characters.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('users').update({ password: newPwd }).eq('username', resetModal.username)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    setTimeout(() => { setReset(null); setNewPwd(''); setOk(false) }, 1500)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">All Users</h1>
        <p className="text-slate-400 text-sm mt-0.5">{users.length} accounts across all companies</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username, role, company..."
          className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.username} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${u.is_superadmin ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                {u.is_superadmin ? <ShieldCheck size={18} /> : u.username?.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-medium text-sm truncate">{u.username}</p>
                  <Badge variant={ROLE_BADGE[u.role] ?? 'slate'}>{u.role}</Badge>
                  {u.is_superadmin && <Badge variant="amber">Super Admin</Badge>}
                </div>
                {u.companyName && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 size={11} className="text-slate-500" />
                    <span className="text-slate-500 text-xs">{u.companyName}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setReset(u); setNewPwd(''); setErr(''); setOk(false) }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors flex-shrink-0"
              >
                <KeyRound size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!resetModal}
        onClose={() => setReset(null)}
        title={`Reset Password`}
        footer={ok ? null : (
          <>
            <Button variant="secondary" fullWidth onClick={() => setReset(null)}>Cancel</Button>
            <Button fullWidth onClick={resetPassword} loading={saving}>Reset</Button>
          </>
        )}
      >
        {ok ? (
          <div className="text-center py-4">
            <p className="text-green-400 text-2xl mb-2">✓</p>
            <p className="text-white font-semibold">Password reset!</p>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm">Resetting password for <span className="text-white font-semibold">{resetModal?.username}</span></p>
            {err && <p className="text-red-400 text-sm bg-red-400/10 rounded-xl p-3">{err}</p>}
            <Input label="New Password" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" />
          </>
        )}
      </Modal>
    </div>
  )
}
