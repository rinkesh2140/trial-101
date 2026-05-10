import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, Users, MapPin, CheckSquare, Clock,
  Megaphone, Plus, Edit2, Trash2, UserCheck, UserX, KeyRound,
  ShieldCheck, Settings
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { today, fmtTime, fmtDuration, totalMins, isCurrentlyIN, fmtAgo } from '../../lib/utils'
import { ROLE_TEMPLATES } from '../../lib/roleTemplates'

const TABS = ['Overview', 'Employees', 'Sites', 'Roles', 'Attendance', 'Tasks', 'Announcements']

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function CompanyDetail() {
  const { id: cid } = useParams()
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const [tab, setTab] = useState('Overview')
  const t = today()

  const { data: company, isLoading: compLoading } = useQuery({
    queryKey: ['sa-company', cid],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('*').eq('id', cid).maybeSingle()
      return data
    }
  })

  if (compLoading) return <div className="flex justify-center py-24"><Spinner size={32} /></div>
  if (!company)    return <div className="text-center py-24 text-slate-500">Company not found.</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/superadmin/companies')} className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{company.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Managing on behalf of company</p>
        </div>
        <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
          <Building2 size={18} className="text-amber-400" />
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview'      && <CompanyOverview cid={cid} company={company} />}
      {tab === 'Employees'     && <CompanyEmployees cid={cid} qc={qc} />}
      {tab === 'Sites'         && <CompanySites cid={cid} qc={qc} />}
      {tab === 'Roles'         && <CompanyRoles cid={cid} qc={qc} />}
      {tab === 'Attendance'    && <CompanyAttendance cid={cid} />}
      {tab === 'Tasks'         && <CompanyTasks cid={cid} qc={qc} />}
      {tab === 'Announcements' && <CompanyAnnouncements cid={cid} qc={qc} />}
    </div>
  )
}

/* ─── Overview ─────────────────────────────────────────── */
function CompanyOverview({ cid, company }) {
  const t = today()
  const { data: stats } = useQuery({
    queryKey: ['sa-company-stats', cid],
    queryFn: async () => {
      const [{ count: emps }, { count: sites }, { count: att }, { count: tasks }, { count: pending }] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('active', true),
        supabase.from('sites').select('*', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('date', t),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('company_id', cid).in('status', ['open','in_progress']),
        supabase.from('punch_requests').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'pending'),
      ])
      return { emps, sites, att, tasks, pending }
    }
  })

  const { data: adminUser } = useQuery({
    queryKey: ['sa-company-admin', cid],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('username,role').eq('company_id', cid).eq('role', 'company_admin').maybeSingle()
      return data
    }
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Employees',      value: stats?.emps    ?? 0, icon: Users,       color: 'text-blue-400'   },
          { label: 'Sites',          value: stats?.sites   ?? 0, icon: MapPin,       color: 'text-amber-400'  },
          { label: 'Present Today',  value: stats?.att     ?? 0, icon: Clock,        color: 'text-green-400'  },
          { label: 'Active Tasks',   value: stats?.tasks   ?? 0, icon: CheckSquare,  color: 'text-orange-400' },
          { label: 'Pending Req.',   value: stats?.pending ?? 0, icon: ShieldCheck,  color: 'text-red-400'    },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <Icon size={18} className={`${color} mb-2`} />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {adminUser && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin Account</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <ShieldCheck size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold">{adminUser.username}</p>
              <p className="text-slate-500 text-xs">Company Admin</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Employees ────────────────────────────────────────── */
function CompanyEmployees({ cid, qc }) {
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({ name: '', mobile: '', role: '', designation: '', username: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [resetModal, setReset] = useState(null)
  const [newPwd, setNewPwd]   = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['sa-employees', cid],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*').eq('company_id', cid).order('name')
      return data ?? []
    }
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', cid],
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('id,name').eq('company_id', cid).order('level')
      return data ?? []
    }
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim()) { setErr('Name required.'); return }
    if (modal === 'add' && (!form.username.trim() || !form.password.trim())) { setErr('Username and password required.'); return }
    setSaving(true); setErr('')
    try {
      const empId = modal === 'add' ? 'EMP' + Date.now().toString(36).toUpperCase() : modal.emp.id
      const payload = { id: empId, name: form.name.trim(), mobile: form.mobile.trim() || null, role: form.role.trim() || null, designation: form.designation.trim() || null, company_id: cid, active: true, status: 'active' }
      if (modal === 'add') {
        const { error: eErr } = await supabase.from('employees').insert(payload)
        if (eErr) throw eErr
        const { error: uErr } = await supabase.from('users').insert({ username: form.username.trim(), password: form.password, role: form.role.trim() || 'employee', employee_id: empId, company_id: cid, is_superadmin: false })
        if (uErr) throw uErr
      } else {
        const { error } = await supabase.from('employees').update(payload).eq('id', modal.emp.id)
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ['sa-employees', cid] })
      setModal(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(emp) {
    await supabase.from('employees').update({ active: !emp.active, status: emp.active ? 'inactive' : 'active' }).eq('id', emp.id)
    qc.invalidateQueries({ queryKey: ['sa-employees', cid] })
  }

  async function resetPassword() {
    if (!newPwd || newPwd.length < 6) return
    setPwdSaving(true)
    await supabase.from('users').update({ password: newPwd }).eq('employee_id', resetModal.id)
    setPwdSaving(false)
    setReset(null); setNewPwd('')
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{employees.filter(e => e.active).length} active employees</p>
        <Button size="sm" onClick={() => { setForm({ name: '', mobile: '', role: '', designation: '', username: '', password: '' }); setErr(''); setModal('add') }}>
          <Plus size={16} /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {employees.map(emp => (
          <div key={emp.id} className={`bg-slate-800 rounded-2xl border p-4 flex items-center gap-3 ${emp.active ? 'border-slate-700' : 'border-slate-700/40 opacity-60'}`}>
            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{initials(emp.name)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{emp.name}</p>
              <p className="text-slate-500 text-xs">{emp.designation || emp.role || '—'}{emp.mobile ? ` · ${emp.mobile}` : ''}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setForm({ name: emp.name ?? '', mobile: emp.mobile ?? '', role: emp.role ?? '', designation: emp.designation ?? '', username: '', password: '' }); setErr(''); setModal({ type: 'edit', emp }) }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"><Edit2 size={13} /></button>
              <button onClick={() => { setReset(emp); setNewPwd('') }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"><KeyRound size={13} /></button>
              <button onClick={() => toggleActive(emp)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${emp.active ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-green-400 hover:bg-green-400/10'}`}>{emp.active ? <UserX size={13} /> : <UserCheck size={13} />}</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!modal && modal !== 'add' ? true : modal === 'add'} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Employee' : 'Edit Employee'}
        footer={<><Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button><Button fullWidth onClick={save} loading={saving}>Save</Button></>}>
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Full Name *" value={form.name} onChange={f('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Mobile" value={form.mobile} onChange={f('mobile')} type="tel" />
          <Input label="Role Title" value={form.role} onChange={f('role')} placeholder="e.g. Engineer" />
        </div>
        <Input label="Designation" value={form.designation} onChange={f('designation')} />
        {modal === 'add' && <>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Login Credentials</p>
          <Input label="Username *" value={form.username} onChange={f('username')} autoCapitalize="none" />
          <Input label="Password *" value={form.password} onChange={f('password')} type="password" />
        </>}
      </Modal>

      <Modal open={!!resetModal} onClose={() => setReset(null)} title="Reset Password"
        footer={<><Button variant="secondary" fullWidth onClick={() => setReset(null)}>Cancel</Button><Button fullWidth onClick={resetPassword} loading={pwdSaving}>Reset</Button></>}>
        <p className="text-slate-400 text-sm">Reset password for <span className="text-white font-semibold">{resetModal?.name}</span></p>
        <Input label="New Password" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" />
      </Modal>
    </div>
  )
}

/* ─── Sites ─────────────────────────────────────────────── */
function CompanySites({ cid, qc }) {
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({ name: '', address: '', city: '', lat: '', lng: '', radius_meters: '200' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sa-sites', cid],
    queryFn: async () => {
      const { data } = await supabase.from('sites').select('*').eq('company_id', cid).order('name')
      return data ?? []
    }
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim()) { setErr('Site name required.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('sites').insert({
        name: form.name.trim(), address: form.address.trim() || null, city: form.city.trim() || null,
        lat: form.lat ? parseFloat(form.lat) : null, lng: form.lng ? parseFloat(form.lng) : null,
        radius_meters: parseInt(form.radius_meters) || 200, company_id: cid, active: true,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sa-sites', cid] })
      setModal(false)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteSite(id) {
    if (!confirm('Delete this site?')) return
    await supabase.from('sites').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['sa-sites', cid] })
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{sites.length} sites</p>
        <Button size="sm" onClick={() => { setForm({ name: '', address: '', city: '', lat: '', lng: '', radius_meters: '200' }); setErr(''); setModal(true) }}><Plus size={16} /> Add Site</Button>
      </div>
      <div className="space-y-2">
        {sites.map(s => (
          <div key={s.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center flex-shrink-0"><MapPin size={18} className="text-green-400" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{s.name}</p>
              <p className="text-slate-500 text-xs">{[s.address, s.city].filter(Boolean).join(', ') || 'No address'}{s.lat ? ` · Geofence ${s.radius_meters}m` : ''}</p>
            </div>
            <button onClick={() => deleteSite(s.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
          </div>
        ))}
        {sites.length === 0 && <div className="text-center py-12 text-slate-500"><MapPin size={32} className="mx-auto mb-2 opacity-30" /><p>No sites yet.</p></div>}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Add Site"
        footer={<><Button variant="secondary" fullWidth onClick={() => setModal(false)}>Cancel</Button><Button fullWidth onClick={save} loading={saving}>Save</Button></>}>
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Site Name *" value={form.name} onChange={f('name')} placeholder="e.g. Tower Block A" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" value={form.city} onChange={f('city')} />
          <Input label="Address" value={form.address} onChange={f('address')} />
        </div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Geofencing (optional)</p>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Latitude" value={form.lat} onChange={f('lat')} placeholder="28.6139" type="number" />
          <Input label="Longitude" value={form.lng} onChange={f('lng')} placeholder="77.2090" type="number" />
          <Input label="Radius (m)" value={form.radius_meters} onChange={f('radius_meters')} type="number" />
        </div>
      </Modal>
    </div>
  )
}

/* ─── Roles ──────────────────────────────────────────────── */
function CompanyRoles({ cid, qc }) {
  const [loadingTpl, setLoadingTpl] = useState(false)

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles', cid],
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').eq('company_id', cid).order('level')
      return data ?? []
    }
  })

  async function loadTemplates() {
    setLoadingTpl(true)
    const existing = roles.map(r => r.name.toLowerCase())
    const toInsert = ROLE_TEMPLATES
      .filter(t => !existing.includes(t.name.toLowerCase()))
      .map(({ name, level, color, description, permissions }) => ({ name, level, color, description, permissions, company_id: cid }))
    if (toInsert.length > 0) {
      const { error } = await supabase.from('roles').insert(toInsert)
      if (error) alert('Error: ' + error.message)
      else await qc.invalidateQueries({ queryKey: ['roles', cid] })
    }
    setLoadingTpl(false)
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{roles.length} roles configured</p>
        <Button size="sm" onClick={loadTemplates} loading={loadingTpl}><Plus size={16} /> Load Templates</Button>
      </div>
      <div className="space-y-2">
        {roles.map(r => (
          <div key={r.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (r.color ?? '#64748B') + '25' }}>
              <ShieldCheck size={18} style={{ color: r.color ?? '#64748B' }} />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{r.name}</p>
              <p className="text-slate-500 text-xs">Level {r.level}{r.description ? ` · ${r.description}` : ''}</p>
            </div>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
            <p className="text-amber-400 font-medium text-sm mb-1">No roles yet</p>
            <p className="text-slate-400 text-xs">Click "Load Templates" to add 14 standard construction roles.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Attendance ─────────────────────────────────────────── */
function CompanyAttendance({ cid }) {
  const [date, setDate] = useState(today())

  const { data, isLoading } = useQuery({
    queryKey: ['sa-co-att', cid, date],
    queryFn: async () => {
      const [{ data: att }, { data: emps }] = await Promise.all([
        supabase.from('attendance').select('*').eq('company_id', cid).eq('date', date),
        supabase.from('employees').select('id,name,role').eq('company_id', cid).eq('active', true),
      ])
      const attMap = Object.fromEntries((att ?? []).map(a => [a['employeeId'] ?? a.employee_id, a]))
      return { emps: emps ?? [], attMap }
    }
  })

  const rows = (data?.emps ?? []).map(e => ({ emp: e, att: data?.attMap?.[e.id] ?? null }))
  const present = rows.filter(r => !!r.att).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-800 text-white rounded-xl px-3 py-2 text-sm border border-slate-700 focus:border-amber-500 focus:outline-none" />
        <span className="text-slate-400 text-sm">{present}/{rows.length} present</span>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Spinner size={28} /></div> : (
        <div className="space-y-2">
          {rows.map(({ emp, att }) => {
            const ci   = isCurrentlyIN(att)
            const mins = totalMins(att)
            return (
              <div key={emp.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${att ? (ci ? 'bg-green-400/20 text-green-400' : 'bg-blue-400/20 text-blue-400') : 'bg-slate-700 text-slate-500'}`}>{emp.name?.slice(0,1)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{emp.name}</p>
                  <p className="text-slate-500 text-xs">{emp.role || '—'}</p>
                </div>
                <div className="text-right">
                  {!att ? <span className="text-slate-500 text-sm">Absent</span> : (
                    <><Badge variant={ci ? 'green' : 'blue'}>{ci ? 'In' : 'Out'}</Badge>{mins > 0 && <p className="text-slate-400 text-xs mt-1">{fmtDuration(mins)}</p>}</>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Tasks ──────────────────────────────────────────────── */
function CompanyTasks({ cid, qc }) {
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({ title: '', description: '', priority: 'medium', dueDate: '', status: 'open' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['sa-co-tasks', cid],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('company_id', cid).order('createdAt', { ascending: false }).limit(50)
      return data ?? []
    }
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.title.trim()) { setErr('Title required.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('tasks').insert({ id: 'TSK' + Date.now().toString(36).toUpperCase(), title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, dueDate: form.dueDate || null, status: form.status, company_id: cid, createdAt: new Date().toISOString() })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sa-co-tasks', cid] })
      setModal(false)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{tasks.filter(t => t.status !== 'done').length} active</p>
        <Button size="sm" onClick={() => { setForm({ title: '', description: '', priority: 'medium', dueDate: '', status: 'open' }); setErr(''); setModal(true) }}><Plus size={16} /> Add Task</Button>
      </div>
      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <p className="text-white font-medium text-sm">{t.title}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant={t.priority === 'high' || t.priority === 'critical' ? 'red' : t.priority === 'medium' ? 'amber' : 'slate'}>{t.priority}</Badge>
              <Badge variant={t.status === 'done' ? 'green' : t.status === 'in_progress' ? 'amber' : 'blue'}>{t.status?.replace('_',' ')}</Badge>
              {t.dueDate && <span className="text-slate-500 text-xs">Due {t.dueDate}</span>}
            </div>
          </div>
        ))}
        {tasks.length === 0 && <div className="text-center py-12 text-slate-500"><CheckSquare size={32} className="mx-auto mb-2 opacity-30" /><p>No tasks yet.</p></div>}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Add Task"
        footer={<><Button variant="secondary" fullWidth onClick={() => setModal(false)}>Cancel</Button><Button fullWidth onClick={save} loading={saving}>Create</Button></>}>
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Title *" value={form.title} onChange={f('title')} />
        <Textarea label="Description" value={form.description} onChange={f('description')} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={form.priority} onChange={f('priority')}>{['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}</Select>
          <Input label="Due Date" value={form.dueDate} onChange={f('dueDate')} type="date" />
        </div>
      </Modal>
    </div>
  )
}

/* ─── Announcements ──────────────────────────────────────── */
function CompanyAnnouncements({ cid, qc }) {
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({ title: '', body: '', priority: 'normal' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: anns = [], isLoading } = useQuery({
    queryKey: ['sa-co-ann', cid],
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').eq('company_id', cid).order('createdAt', { ascending: false }).limit(20)
      return data ?? []
    }
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.title.trim() || !form.body.trim()) { setErr('Title and body required.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('announcements').insert({ id: 'ANN' + Date.now().toString(36).toUpperCase(), title: form.title.trim(), body: form.body.trim(), priority: form.priority, type: 'company', createdAt: new Date().toISOString(), company_id: cid })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sa-co-ann', cid] })
      setModal(false)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteAnn(id) {
    if (!confirm('Delete?')) return
    await supabase.from('announcements').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['sa-co-ann', cid] })
  }

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">{anns.length} posted</p>
        <Button size="sm" onClick={() => { setForm({ title: '', body: '', priority: 'normal' }); setErr(''); setModal(true) }}><Plus size={16} /> Post</Button>
      </div>
      <div className="space-y-3">
        {anns.map(a => (
          <div key={a.id} className={`bg-slate-800 rounded-2xl border p-4 ${a.priority === 'urgent' ? 'border-red-500/30' : 'border-slate-700'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {a.priority === 'urgent' && <Badge variant="red">Urgent</Badge>}
                  <span className="text-slate-500 text-xs">{fmtAgo(a.createdAt)}</span>
                </div>
                <p className="text-white font-semibold">{a.title}</p>
                <p className="text-slate-400 text-sm mt-1">{a.body}</p>
              </div>
              <button onClick={() => deleteAnn(a.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {anns.length === 0 && <div className="text-center py-12 text-slate-500"><Megaphone size={32} className="mx-auto mb-2 opacity-30" /><p>No announcements yet.</p></div>}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Post Announcement"
        footer={<><Button variant="secondary" fullWidth onClick={() => setModal(false)}>Cancel</Button><Button fullWidth onClick={save} loading={saving}>Post</Button></>}>
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Title *" value={form.title} onChange={f('title')} />
        <Textarea label="Message *" value={form.body} onChange={f('body')} rows={4} />
        <Select label="Priority" value={form.priority} onChange={f('priority')}>
          <option value="normal">Normal</option>
          <option value="important">Important</option>
          <option value="urgent">Urgent</option>
        </Select>
      </Modal>
    </div>
  )
}
