import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Plus, Search, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { fmtDate } from '../../lib/utils'

export default function SATasks() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [compFilter, setComp]   = useState('all')
  const [statusFilter, setStat] = useState('active')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({ title: '', description: '', priority: 'medium', dueDate: '', company_id: '', status: 'open' })
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  const { data: companies = [] } = useQuery({
    queryKey: ['sa-companies-list'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id,name').order('name')
      return data ?? []
    }
  })

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['sa-tasks', compFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from('tasks').select('*').order('createdAt', { ascending: false })
      if (compFilter !== 'all') q = q.eq('company_id', compFilter)
      if (statusFilter === 'active') q = q.in('status', ['open','in_progress'])
      else if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      const { data } = await q.limit(100)
      return data ?? []
    }
  })

  const compMap = Object.fromEntries(companies.map(c => [c.id, c.name]))

  const filtered = tasks.filter(t => t.title?.toLowerCase().includes(search.toLowerCase()))

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.title.trim() || !form.company_id) { setErr('Title and company are required.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('tasks').insert({
        id:          'TSK' + Date.now().toString(36).toUpperCase(),
        title:       form.title.trim(),
        description: form.description.trim() || null,
        priority:    form.priority,
        dueDate:     form.dueDate || null,
        status:      form.status,
        company_id:  form.company_id,
        createdAt:   new Date().toISOString(),
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sa-tasks'] })
      setModal(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function updateStatus(task, status) {
    await supabase.from('tasks').update({ status }).eq('id', task.id)
    qc.invalidateQueries({ queryKey: ['sa-tasks'] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} tasks</p>
        </div>
        <Button onClick={() => { setForm({ title: '', description: '', priority: 'medium', dueDate: '', company_id: companies[0]?.id ?? '', status: 'open' }); setErr(''); setModal('add') }}>
          <Plus size={18} /> Add Task
        </Button>
      </div>

      {/* Company filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setComp('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${compFilter === 'all' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>All</button>
        {companies.map(c => (
          <button key={c.id} onClick={() => setComp(c.id)} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${compFilter === c.id ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{c.name}</button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {[['active','Active'],['all','All'],['done','Done'],['blocked','Blocked']].map(([v,l]) => (
          <button key={v} onClick={() => setStat(v)} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${statusFilter === v ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{l}</button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
          className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
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
            <div key={t.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{t.title}</p>
                  {t.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={t.priority === 'critical' || t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'amber' : 'slate'}>{t.priority}</Badge>
                    <Badge variant={t.status === 'done' ? 'green' : t.status === 'in_progress' ? 'amber' : t.status === 'blocked' ? 'red' : 'blue'}>{t.status?.replace('_',' ')}</Badge>
                    {t.dueDate && <span className="text-slate-500 text-xs">Due {fmtDate(t.dueDate)}</span>}
                    <span className="text-slate-600 text-xs flex items-center gap-1"><Building2 size={10} />{compMap[t.company_id] ?? '—'}</span>
                  </div>
                </div>
                <Select value={t.status} onChange={e => updateStatus(t, e.target.value)} className="text-xs w-32 flex-shrink-0">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="New Task"
        footer={<><Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button><Button fullWidth onClick={save} loading={saving}>Create</Button></>}>
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Select label="Company *" value={form.company_id} onChange={f('company_id')}>
          <option value="">Select company...</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Title *" value={form.title} onChange={f('title')} placeholder="Task title" />
        <Textarea label="Description" value={form.description} onChange={f('description')} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={form.priority} onChange={f('priority')}>
            {['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Input label="Due Date" value={form.dueDate} onChange={f('dueDate')} type="date" />
        </div>
      </Modal>
    </div>
  )
}
