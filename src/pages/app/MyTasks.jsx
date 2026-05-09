import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, CheckCircle2, Circle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Input'
import { fmtDate } from '../../lib/utils'

const FILTERS = [['all','All'], ['open','Open'], ['in_progress','In Progress'], ['done','Done']]

export default function AppTasks() {
  const { employee, user } = useAuth()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks-emp', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('assignedTo', employee.id).eq('company_id', user.company_id).order('createdAt', { ascending: false })
      return data ?? []
    }
  })

  const filtered = tasks.filter(t => filter === 'all' || t.status === filter)

  async function updateStatus(task, status) {
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString(), ...(status === 'done' ? { completedAt: new Date().toISOString() } : {}) }).eq('id', task.id)
    qc.invalidateQueries({ queryKey: ['tasks-emp', employee.id] })
    setSelected(t => t?.id === task.id ? { ...t, status } : t)
  }

  async function addComment() {
    if (!comment.trim() || !selected) return
    setSaving(true)
    const comments = [...(selected.comments ?? []), { text: comment.trim(), by: employee.id, at: new Date().toISOString() }]
    await supabase.from('tasks').update({ comments, updated_at: new Date().toISOString() }).eq('id', selected.id)
    await qc.invalidateQueries({ queryKey: ['tasks-emp', employee.id] })
    setComment('')
    setSaving(false)
    setSelected(t => t?.id === selected.id ? { ...t, comments } : t)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Tasks</h1>
        <p className="text-slate-400 text-sm mt-0.5">{tasks.filter(t => t.status !== 'done').length} pending</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === val ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p>No tasks here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div
              key={t.id}
              onClick={() => setSelected(t)}
              className="bg-slate-800 rounded-2xl border border-slate-700 p-4 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={e => { e.stopPropagation(); updateStatus(t, t.status === 'done' ? 'open' : 'done') }}
                  className={`mt-0.5 flex-shrink-0 ${t.status === 'done' ? 'text-green-400' : 'text-slate-500 hover:text-green-400'} transition-colors`}
                >
                  {t.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{t.title}</p>
                  {t.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={t.priority === 'high' || t.priority === 'critical' ? 'red' : t.priority === 'medium' ? 'amber' : 'slate'}>
                      {t.priority}
                    </Badge>
                    {t.dueDate && (
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Clock size={11} /> {fmtDate(t.dueDate)}
                      </span>
                    )}
                    {t.progress > 0 && <span className="text-slate-500 text-xs">{t.progress}%</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        footer={
          <div className="flex gap-2 w-full">
            {selected?.status !== 'done' && (
              <Button
                variant="success"
                onClick={() => updateStatus(selected, 'done')}
                className="flex-1"
              >
                Mark Done
              </Button>
            )}
            {selected?.status === 'open' && (
              <Button variant="secondary" onClick={() => updateStatus(selected, 'in_progress')} className="flex-1">
                Start
              </Button>
            )}
          </div>
        }
      >
        {selected?.description && (
          <p className="text-slate-300 text-sm leading-relaxed">{selected.description}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={selected?.status === 'done' ? 'green' : selected?.status === 'in_progress' ? 'amber' : 'blue'}>
            {selected?.status?.replace('_', ' ')}
          </Badge>
          <Badge variant={selected?.priority === 'high' || selected?.priority === 'critical' ? 'red' : 'amber'}>
            {selected?.priority}
          </Badge>
          {selected?.dueDate && <span className="text-slate-400 text-xs self-center">Due {fmtDate(selected.dueDate)}</span>}
        </div>

        {/* Comments */}
        {selected?.comments?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comments</p>
            {selected.comments.map((c, i) => (
              <div key={i} className="bg-slate-700 rounded-xl p-3">
                <p className="text-slate-300 text-sm">{c.text}</p>
                <p className="text-slate-500 text-xs mt-1">{new Date(c.at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex-1 bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm border border-slate-600 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
          />
          <Button onClick={addComment} loading={saving} size="sm" className="self-end">Post</Button>
        </div>
      </Modal>
    </div>
  )
}
