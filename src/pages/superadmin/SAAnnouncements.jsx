import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { fmtAgo } from '../../lib/utils'

export default function SAAnnouncements() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [compFilter, setComp] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ title: '', body: '', priority: 'normal', company_id: '' })
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const { data: companies = [] } = useQuery({
    queryKey: ['sa-companies-list'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id,name').order('name')
      return data ?? []
    }
  })

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['sa-announcements', compFilter],
    queryFn: async () => {
      let q = supabase.from('announcements').select('*').order('createdAt', { ascending: false })
      if (compFilter !== 'all') q = q.eq('company_id', compFilter)
      const { data } = await q.limit(50)
      return data ?? []
    }
  })

  const compMap = Object.fromEntries(companies.map(c => [c.id, c.name]))
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.title.trim() || !form.body.trim()) { setErr('Title and body required.'); return }
    if (!form.company_id) { setErr('Select a company.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('announcements').insert({
        id:         'ANN' + Date.now().toString(36).toUpperCase(),
        title:      form.title.trim(),
        body:       form.body.trim(),
        priority:   form.priority,
        type:       'company',
        createdBy:  user?.username,
        createdAt:  new Date().toISOString(),
        company_id: form.company_id,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sa-announcements'] })
      setShowAdd(false)
      setForm({ title: '', body: '', priority: 'normal', company_id: '' })
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteAnn(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['sa-announcements'] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-slate-400 text-sm mt-0.5">Post announcements to any company</p>
        </div>
        <Button onClick={() => { setShowAdd(true); setErr(''); setForm({ title: '', body: '', priority: 'normal', company_id: companies[0]?.id ?? '' }) }}>
          <Plus size={18} /> Post
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setComp('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${compFilter === 'all' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>All Companies</button>
        {companies.map(c => (
          <button key={c.id} onClick={() => setComp(c.id)} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${compFilter === c.id ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{c.name}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p>No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={`bg-slate-800 rounded-2xl border p-4 ${a.priority === 'urgent' ? 'border-red-500/30' : 'border-slate-700'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {a.priority === 'urgent' && <Badge variant="red">Urgent</Badge>}
                    {a.priority === 'important' && <Badge variant="amber">Important</Badge>}
                    <span className="text-slate-500 text-xs flex items-center gap-1"><Building2 size={10} />{compMap[a.company_id] ?? '—'}</span>
                    <span className="text-slate-600 text-xs">{fmtAgo(a.createdAt)}</span>
                  </div>
                  <p className="text-white font-semibold">{a.title}</p>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">{a.body}</p>
                </div>
                <button onClick={() => deleteAnn(a.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Post Announcement"
        footer={<><Button variant="secondary" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button><Button fullWidth onClick={save} loading={saving}>Post</Button></>}>
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Select label="Company *" value={form.company_id} onChange={f('company_id')}>
          <option value="">Select company...</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Title *" value={form.title} onChange={f('title')} placeholder="Announcement title" />
        <Textarea label="Message *" value={form.body} onChange={f('body')} rows={4} placeholder="Write your announcement..." />
        <Select label="Priority" value={form.priority} onChange={f('priority')}>
          <option value="normal">Normal</option>
          <option value="important">Important</option>
          <option value="urgent">Urgent</option>
        </Select>
      </Modal>
    </div>
  )
}
