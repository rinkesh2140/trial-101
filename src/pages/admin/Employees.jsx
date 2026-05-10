import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Search, Edit2, UserCheck, UserX, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const BLANK = { name: '', mobile: '', email: '', role: '', designation: '', department: '', username: '', password: '', role_id: '' }

export default function AdminEmployees() {
  const { user } = useAuth()
  const cid = user?.company_id
  const qc  = useQueryClient()
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [selectedSites, setSelectedSites] = useState([])
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('*, roles(name, color)')
        .eq('company_id', cid)
        .order('name')
      return data ?? []
    }
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').eq('company_id', cid).order('level')
      return data ?? []
    }
  })

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('sites').select('id,name').eq('company_id', cid).order('name')
      return data ?? []
    }
  })

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.mobile?.includes(search) ||
    e.role?.toLowerCase().includes(search.toLowerCase())
  )

  async function openAdd() {
    setForm(BLANK); setErr(''); setSelectedSites([]); setModal('add')
  }

  async function openEdit(emp) {
    setForm({
      name: emp.name ?? '', mobile: emp.mobile ?? '', email: emp.email ?? '',
      role: emp.role ?? '', designation: emp.designation ?? '',
      department: emp.department ?? '', username: '', password: '',
      role_id: emp.role_id ?? '',
    })
    setErr('')
    // Load existing site assignments
    const { data: existing } = await supabase
      .from('employee_sites').select('site_id').eq('employee_id', emp.id)
    setSelectedSites((existing ?? []).map(s => s.site_id))
    setModal({ type: 'edit', emp })
  }

  function toggleSite(siteId) {
    setSelectedSites(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    )
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim()) { setErr('Name is required.'); return }
    if (modal === 'add' && (!form.username.trim() || !form.password.trim())) {
      setErr('Username and password are required.'); return
    }
    setSaving(true); setErr('')
    try {
      const empId = modal === 'add'
        ? 'EMP' + Date.now().toString(36).toUpperCase()
        : modal.emp.id

      const payload = {
        id:          empId,
        name:        form.name.trim(),
        mobile:      form.mobile.trim() || null,
        email:       form.email.trim() || null,
        role:        form.role.trim() || null,
        designation: form.designation.trim() || null,
        department:  form.department.trim() || null,
        role_id:     form.role_id || null,
        company_id:  cid,
        active:      true,
        status:      'active',
      }

      if (modal === 'add') {
        const { error: eErr } = await supabase.from('employees').insert(payload)
        if (eErr) throw eErr
        const { error: uErr } = await supabase.from('users').insert({
          username:    form.username.trim(),
          password:    form.password,
          role:        form.role.trim() || 'employee',
          employee_id: empId,
          company_id:  cid,
          is_superadmin: false,
        })
        if (uErr) throw uErr
      } else {
        const { error } = await supabase.from('employees').update(payload).eq('id', modal.emp.id)
        if (error) throw error
      }

      // Sync site assignments
      await supabase.from('employee_sites').delete().eq('employee_id', empId)
      if (selectedSites.length > 0) {
        await supabase.from('employee_sites').insert(
          selectedSites.map(siteId => ({ employee_id: empId, site_id: siteId }))
        )
      }

      await qc.invalidateQueries({ queryKey: ['employees', cid] })
      await qc.invalidateQueries({ queryKey: ['sites', cid] })
      setModal(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(emp) {
    await supabase.from('employees')
      .update({ active: !emp.active, status: emp.active ? 'inactive' : 'active' })
      .eq('id', emp.id)
    qc.invalidateQueries({ queryKey: ['employees', cid] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Employees</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {employees.filter(e => e.active).length} active · {employees.length} total
          </p>
        </div>
        <Button onClick={openAdd}><Plus size={18} /> Add</Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, mobile, role..."
          className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No results.' : 'No employees yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => (
            <div key={emp.id} className={`bg-slate-800 rounded-2xl border p-4 flex items-center gap-3 ${emp.active ? 'border-slate-700' : 'border-slate-700/40 opacity-60'}`}>
              <div className="w-11 h-11 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials(emp.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold text-sm">{emp.name}</p>
                  {emp.roles?.name && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ color: emp.roles.color ?? '#94A3B8', backgroundColor: (emp.roles.color ?? '#64748B') + '20' }}>
                      {emp.roles.name}
                    </span>
                  )}
                  {!emp.active && <Badge variant="slate">Inactive</Badge>}
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  {emp.designation || emp.role || '—'}{emp.mobile ? ` · ${emp.mobile}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(emp)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => toggleActive(emp)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${emp.active ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-green-400 hover:bg-green-400/10'}`}>
                  {emp.active ? <UserX size={14} /> : <UserCheck size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Employee' : 'Edit Employee'}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}

        <Input label="Full Name *" value={form.name} onChange={f('name')} placeholder="Employee full name" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Mobile" value={form.mobile} onChange={f('mobile')} placeholder="Phone number" type="tel" />
          <Input label="Email" value={form.email} onChange={f('email')} placeholder="Email" type="email" />
        </div>
        <Select label="Role" value={form.role_id} onChange={f('role_id')}>
          <option value="">Select role...</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Designation" value={form.designation} onChange={f('designation')} placeholder="e.g. Site Engineer" />
          <Input label="Department" value={form.department} onChange={f('department')} placeholder="e.g. Civil" />
        </div>

        {/* Site assignment */}
        {sites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} /> Site Assignment
            </p>
            <div className="space-y-1.5">
              {sites.map(s => (
                <label key={s.id} className="flex items-center gap-3 bg-slate-700/50 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedSites.includes(s.id)}
                    onChange={() => toggleSite(s.id)}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <span className="text-slate-200 text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {modal === 'add' && (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Login Credentials</p>
            <Input label="Username *" value={form.username} onChange={f('username')} placeholder="login username" autoCapitalize="none" />
            <Input label="Password *" value={form.password} onChange={f('password')} placeholder="login password" type="password" />
          </>
        )}
      </Modal>
    </div>
  )
}
