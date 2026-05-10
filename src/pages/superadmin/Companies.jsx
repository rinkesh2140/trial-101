import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Search, Users, MapPin, Trash2, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('*, sites(count), employees(count)')
        .order('name')
      return data ?? []
    }
  })
}

export default function SACompanies() {
  const { data: companies = [], isLoading } = useCompanies()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ name: '', admin_username: '', admin_password: '', admin_email: '' })
  const [error, setError]         = useState('')

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  async function handleAdd() {
    if (!form.name.trim() || !form.admin_username.trim() || !form.admin_password.trim()) {
      setError('Company name, admin username and password are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: company, error: cErr } = await supabase
        .from('companies')
        .insert({ name: form.name.trim() })
        .select()
        .single()
      if (cErr) throw cErr

      const { error: uErr } = await supabase.from('users').insert({
        username:      form.admin_username.trim(),
        password:      form.admin_password,
        role:          'company_admin',
        company_id:    company.id,
        is_superadmin: false,
      })
      if (uErr) throw uErr

      await qc.invalidateQueries({ queryKey: ['companies'] })
      setShowAdd(false)
      setForm({ name: '', admin_username: '', admin_password: '', admin_email: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(company) {
    if (!confirm(`Delete "${company.name}"? This cannot be undone.`)) return
    await supabase.from('companies').delete().eq('id', company.id)
    qc.invalidateQueries({ queryKey: ['companies'] })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-slate-400 text-sm mt-0.5">{companies.length} onboarded</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="md">
          <Plus size={18} /> Add Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-base border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No companies match your search.' : 'No companies yet. Add one to get started.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base truncate">{c.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    <Users size={13} /> {c.employees?.[0]?.count ?? 0} employees
                  </span>
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    <MapPin size={13} /> {c.sites?.[0]?.count ?? 0} sites
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => navigate(`/superadmin/company/${c.id}`)} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Settings size={16} />
                </button>
                <button onClick={() => handleDelete(c)} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Company Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setError('') }}
        title="Onboard New Company"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button fullWidth onClick={handleAdd} loading={saving}>Create Company</Button>
          </>
        }
      >
        {error && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{error}</p>}
        <Input label="Company Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Patel Infrastructure" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">Admin Account</p>
        <Input label="Username *" value={form.admin_username} onChange={e => setForm(f => ({ ...f, admin_username: e.target.value }))} placeholder="admin username" autoCapitalize="none" />
        <Input label="Password *" type="password" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} placeholder="admin password" />
        <Input label="Email (optional)" type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="admin@company.com" />
      </Modal>
    </div>
  )
}
