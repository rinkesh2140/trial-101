import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Plus, Search, Filter, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { fmtDate, PRIORITY_COLOR, STATUS_COLOR } from '../../lib/utils'

const BLANK = { title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '', site_id: '', status: 'open' }

export default function AdminTasks() {
  const { user } = useAuth()
  const cid = user?.company_id
  const qc  = useQueryClient()
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(BLANK)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks-admin', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('company_id', cid).order('createdAt', { ascending: false })
      return data ?? []
    }
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('id, name').eq('company_id', cid).eq('active', true).order('name')
      return data ?? []
    }
  })

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('sites').select('id, name').eq('company_id', cid).order('name')
      return data ?? []
    }
  })

  const filtered = tasks
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => t.title?.toLowerCase().includes(search.toLowerCase()))

  function openAdd() { setForm(BLANK); setErr(''); setModal('add') }
  function openEdit(t) {
    setForm({ title: t.title ?? '', description: t.description ?? '', priority: t.priority ?? 'medium', dueDate: t.dueDate ?? '', assignedTo: t.assignedTo ?? '', site_id: t.site_id ?? '', status: t.status ?? 'open' })
    setErr('')
    setModal({ type: 'edit', task: t })
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.title.trim()) { setErr('Task title is required.'); return }
    setSaving(true); setErr('')
    const payload = {
      title:       form.title.trim(),
      description: form.description.trim() || null,
      priority:    form.priority,
      dueDate:     form.dueDate || null,
      assignedTo:  form.assignedTo || null,
      site_id:     form.site_id || null,
      status:      form.status,
      company_id:  cid,
    }
    try {
      if (modal === 'add') {
        const { error } = await supabase.from('tasks').insert({ ...payload, id: 'TSK' + Date.now().toString(36).toUpperCase(), createdBy: user.employee_id, createdAt: new Date().toISOString() })
        if (error) throw error
      } else {
        const { error } = await supabase.from('tasks').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.task.id)
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ['tasks-admin', cid] })
      setModal(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['tasks-admin', cid] })
  }

  const counts = { all: tasks.length, open: tasks.filter(t => t.status === 'open').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, done: tasks.filter(t => t.status === 'done').length }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 text-sm mt-0.5">{counts.open} open · {counts.in_progress} in progress</p>
        </div>
        <Button onClick={openAdd}><Plus size={18} /> Add Task</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[['all','All'], ['open','Open'], ['in_progress','In Progress'], ['done','Done']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === val ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}
          >
            {label} <span className="ml-1 text-xs opacity-60">{counts[val] ?? ''}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p>No tasks found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} onClick={() => openEdit(t)} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 cursor-pointer active:scale-[0.99] transition-transform">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{t.title}</p>
                  {t.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={t.priority === 'critical' || t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'amber' : 'slate'}>{t.priority}</Badge>
                    <Badge variant={t.status === 'done' ? 'green' : t.status === 'in_progress' ? 'amber' : 'blue'}>{t.status?.replace('_', ' ')}</Badge>
                    {t.dueDate && <span className="text-slate-500 text-xs">Due {fmtDate(t.dueDate)}</span>}
                    {t.progress > 0 && <span className="text-slate-500 text-xs">{t.progress}%</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'New Task' : 'Edit Task'}
        footer={
          <>
            {modal?.task && <Button variant="danger" onClick={() => { deleteTask(modal.task.id); setModal(null) }}>Delete</Button>}
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Title *" value={form.title} onChange={f('title')} placeholder="Task title" />
        <Textarea label="Description" value={form.description} onChange={f('description')} placeholder="Details..." rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={form.priority} onChange={f('priority')}>
            {['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select label="Status" value={form.status} onChange={f('status')}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>
        <Select label="Assign To" value={form.assignedTo} onChange={f('assignedTo')}>
          <option value="">Unassigned</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Due Date" value={form.dueDate} onChange={f('dueDate')} type="date" />
          <Select label="Site" value={form.site_id} onChange={f('site_id')}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
