import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Trash2, Pin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { fmtAgo } from '../../lib/utils'

const BLANK = { title: '', body: '', priority: 'normal', site_id: '' }

export default function AdminAnnouncements() {
  const { user } = useAuth()
  const cid = user?.company_id
  const qc  = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState(BLANK)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements-admin', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').eq('company_id', cid).order('createdAt', { ascending: false })
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

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.title.trim() || !form.body.trim()) { setErr('Title and body are required.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('announcements').insert({
        id:        'ANN' + Date.now().toString(36).toUpperCase(),
        title:     form.title.trim(),
        body:      form.body.trim(),
        priority:  form.priority,
        site_id:   form.site_id || null,
        type:      form.site_id ? 'site' : 'company',
        createdBy: user.employee_id,
        createdAt: new Date().toISOString(),
        company_id: cid,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['announcements-admin', cid] })
      setShowAdd(false)
      setForm(BLANK)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteAnn(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['announcements-admin', cid] })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-slate-400 text-sm mt-0.5">{announcements.length} posted</p>
        </div>
        <Button onClick={() => { setShowAdd(true); setForm(BLANK); setErr('') }}>
          <Plus size={18} /> Post
        </Button>
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
                    {a.site_id && <Badge variant="blue">Site-specific</Badge>}
                    <span className="text-slate-500 text-xs">{fmtAgo(a.createdAt)}</span>
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

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Post Announcement"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button fullWidth onClick={save} loading={saving}>Post</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Title *" value={form.title} onChange={f('title')} placeholder="Announcement title" />
        <Textarea label="Message *" value={form.body} onChange={f('body')} placeholder="Write your announcement..." rows={4} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={form.priority} onChange={f('priority')}>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </Select>
          <Select label="Site (optional)" value={form.site_id} onChange={f('site_id')}>
            <option value="">All sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
