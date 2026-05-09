import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const FEATURES = [
  { key: 'attendance',    label: 'Attendance',    actions: ['view', 'edit'] },
  { key: 'tasks',         label: 'Tasks',         actions: ['view', 'create', 'assign'] },
  { key: 'reports',       label: 'Reports',       actions: ['view'] },
  { key: 'announcements', label: 'Announcements', actions: ['view', 'create'] },
  { key: 'employees',     label: 'Employee Dir',  actions: ['view', 'edit'] },
  { key: 'notebook',      label: 'Notebook',      actions: ['view', 'create'] },
  { key: 'sites',         label: 'Sites',         actions: ['view'] },
]

const DEFAULT_PERMS = Object.fromEntries(FEATURES.map(f => [f.key, Object.fromEntries(f.actions.map(a => [a, a === 'view']))]))

const BLANK = { name: '', level: '5', color: '#64748B', permissions: DEFAULT_PERMS }

export default function AdminRoles() {
  const { user } = useAuth()
  const cid = user?.company_id
  const qc  = useQueryClient()
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('roles').select('*').eq('company_id', cid).order('level')
      return data ?? []
    }
  })

  function openAdd()  { setForm(BLANK); setErr(''); setModal('add') }
  function openEdit(r) {
    setForm({ name: r.name, level: String(r.level), color: r.color ?? '#64748B', permissions: r.permissions ?? DEFAULT_PERMS })
    setErr('')
    setModal({ type: 'edit', id: r.id })
  }

  function togglePerm(feature, action) {
    setForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [feature]: { ...(f.permissions[feature] ?? {}), [action]: !(f.permissions[feature]?.[action]) }
      }
    }))
  }

  async function save() {
    if (!form.name.trim()) { setErr('Role name is required.'); return }
    setSaving(true); setErr('')
    const payload = { name: form.name.trim(), level: parseInt(form.level) || 5, color: form.color, permissions: form.permissions, company_id: cid }
    try {
      if (modal === 'add') {
        const { error } = await supabase.from('roles').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('roles').update(payload).eq('id', modal.id)
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ['roles', cid] })
      setModal(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteRole(r) {
    if (!confirm(`Delete role "${r.name}"?`)) return
    await supabase.from('roles').delete().eq('id', r.id)
    qc.invalidateQueries({ queryKey: ['roles', cid] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
          <p className="text-slate-400 text-sm mt-0.5">Define what each role can access</p>
        </div>
        <Button onClick={openAdd}><Plus size={18} /> Add Role</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : roles.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No roles yet. Create roles to control feature access.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map(r => (
            <div key={r.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (r.color ?? '#64748B') + '25' }}>
                  <ShieldCheck size={20} style={{ color: r.color ?? '#64748B' }} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{r.name}</p>
                  <p className="text-slate-500 text-xs">Level {r.level} · {Object.values(r.permissions ?? {}).flat(0).length} permissions</p>
                </div>
                <button onClick={() => openEdit(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => deleteRole(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {FEATURES.map(feat =>
                  feat.actions.map(act =>
                    r.permissions?.[feat.key]?.[act] ? (
                      <span key={`${feat.key}-${act}`} className="text-xs px-2 py-0.5 rounded-md bg-green-400/10 text-green-400 border border-green-400/15">
                        {feat.label}:{act}
                      </span>
                    ) : null
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Role' : 'Edit Role'}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth onClick={save} loading={saving}>Save Role</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Role Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Site Manager" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Level (1=highest)" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} type="number" min="1" max="10" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Badge Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer bg-slate-700 border border-slate-600" />
              <span className="text-slate-400 text-sm">{form.color}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Permissions</p>
          {FEATURES.map(feat => (
            <div key={feat.key} className="bg-slate-700/50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-medium text-white">{feat.label}</p>
              <div className="flex gap-2 flex-wrap">
                {feat.actions.map(act => {
                  const enabled = form.permissions?.[feat.key]?.[act] ?? false
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => togglePerm(feat.key, act)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${enabled ? 'bg-green-400/15 text-green-400 border border-green-400/20' : 'bg-slate-700 text-slate-500 border border-slate-600'}`}
                    >
                      {enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {act}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
