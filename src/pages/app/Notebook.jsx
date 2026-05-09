import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Trash2, FileText, Phone, List } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import { fmtAgo } from '../../lib/utils'

const TYPE_ICON = { note: FileText, call: Phone, todo: List }
const TYPE_COLOR = { note: 'text-blue-400', call: 'text-green-400', todo: 'text-amber-400' }
const BLANK = { type: 'note', category: '', content: '' }

export default function AppNotebook() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['pad', user?.employee_id],
    enabled: !!user?.employee_id,
    queryFn: async () => {
      const { data } = await supabase.from('pad').select('*').eq('userId', user.employee_id).order('timestamp', { ascending: false })
      return data ?? []
    }
  })

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.content.trim()) { setErr('Content is required.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('pad').insert({
        userId:    user.employee_id,
        type:      form.type,
        category:  form.category.trim() || null,
        content:   form.content.trim(),
        timestamp: new Date().toISOString(),
        company_id: user.company_id,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['pad', user.employee_id] })
      setModal(null)
      setForm(BLANK)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function deleteItem(id) {
    await supabase.from('pad').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['pad', user.employee_id] })
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notebook</h1>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} entries</p>
        </div>
        <Button onClick={() => { setForm(BLANK); setErr(''); setModal('add') }} size="sm">
          <Plus size={16} /> New
        </Button>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2">
        {[['note','Notes', FileText], ['call','Calls', Phone], ['todo','To-Do', List]].map(([type, label, Icon]) => {
          const count = items.filter(i => i.type === type).length
          return (
            <div key={type} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-400">
              <Icon size={12} className={TYPE_COLOR[type]} />
              {label} {count > 0 && <span className="text-slate-600">{count}</span>}
            </div>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p>No entries yet. Tap + to add a note.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const Icon = TYPE_ICON[item.type] ?? FileText
            const color = TYPE_COLOR[item.type] ?? 'text-slate-400'
            return (
              <div key={item.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.category && <p className="text-xs text-slate-500 font-medium mb-0.5 uppercase tracking-wider">{item.category}</p>}
                    <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    <p className="text-slate-600 text-xs mt-1.5">{fmtAgo(item.timestamp)}</p>
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modal === 'add'}
        onClose={() => setModal(null)}
        title="New Entry"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <div className="grid grid-cols-3 gap-2">
          {[['note','Note', FileText], ['call','Call', Phone], ['todo','To-Do', List]].map(([type, label, Icon]) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm(f => ({ ...f, type }))}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-colors ${form.type === type ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'}`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        <Input label="Category (optional)" value={form.category} onChange={f('category')} placeholder="e.g. Site A, Client Call" />
        <Textarea label="Content *" value={form.content} onChange={f('content')} placeholder="Write your note..." rows={5} />
      </Modal>
    </div>
  )
}
