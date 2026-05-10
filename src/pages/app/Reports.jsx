import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, AlertTriangle, ClipboardList, TrendingUp, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { today } from '../../lib/utils'
import { format } from 'date-fns'

const REPORT_TYPES = [
  { value: 'daily_report', label: 'Daily Report',    icon: ClipboardList, color: 'text-blue-400'   },
  { value: 'progress',     label: 'Progress Update', icon: TrendingUp,    color: 'text-green-400'  },
  { value: 'incident',     label: 'Incident Report', icon: AlertTriangle, color: 'text-red-400'    },
  { value: 'weekly_report',label: 'Weekly Report',   icon: Calendar,      color: 'text-amber-400'  },
]

const TYPE_COLOR = { daily_report: 'blue', progress: 'green', incident: 'red', weekly_report: 'amber' }
const TYPE_LABEL = { daily_report: 'Daily', progress: 'Progress', incident: 'Incident', weekly_report: 'Weekly' }

const BLANK = { type: 'daily_report', site_id: '', date: today(), text: '' }

export default function AppReports() {
  const { employee, user, assignedSites } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [filter, setFilter]     = useState('all')

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['emp-reports', employee?.id],
    enabled: !!employee?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('byEmployeeId', employee.id)
        .in('category', ['daily_report', 'weekly_report', 'incident', 'progress', 'report'])
        .order('createdAt', { ascending: false })
        .limit(30)
      return data ?? []
    }
  })

  const filtered = filter === 'all' ? reports : reports.filter(r => r.category === filter)

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit() {
    if (!form.text.trim()) { setErr('Please describe the report.'); return }
    if (!employee?.id)     { setErr('No employee profile linked.'); return }
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('notes').insert({
        id:            'RPT' + Date.now().toString(36).toUpperCase(),
        byEmployeeId:  employee.id,
        aboutEmployeeId: employee.id,
        text:          form.text.trim(),
        category:      form.type,
        createdAt:     new Date().toISOString(),
        company_id:    user.company_id,
        site_id:       form.site_id || null,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['emp-reports', employee.id] })
      setShowForm(false)
      setForm(BLANK)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">{reports.length} submitted</p>
        </div>
        <Button onClick={() => { setForm(BLANK); setErr(''); setShowForm(true) }} size="sm">
          <Plus size={16} /> Submit
        </Button>
      </div>

      {/* Quick submit buttons */}
      <div className="grid grid-cols-2 gap-2">
        {REPORT_TYPES.map(({ value, label, icon: Icon, color }) => (
          <button key={value}
            onClick={() => { setForm({ ...BLANK, type: value }); setErr(''); setShowForm(true) }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 flex items-center gap-2.5 hover:border-slate-500 transition-colors active:scale-[0.98]">
            <Icon size={18} className={color} />
            <span className="text-slate-200 text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilter('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'all' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
          All
        </button>
        {REPORT_TYPES.map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === value ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No reports yet. Submit your first report.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className={`bg-slate-800 rounded-2xl border p-4 ${r.category === 'incident' ? 'border-red-500/20' : 'border-slate-700'}`}>
              <div className="flex items-center justify-between mb-2">
                <Badge variant={TYPE_COLOR[r.category] ?? 'slate'}>
                  {r.category === 'incident' && <AlertTriangle size={9} className="mr-1" />}
                  {TYPE_LABEL[r.category] ?? r.category}
                </Badge>
                <span className="text-slate-500 text-xs">
                  {r.createdAt ? format(new Date(r.createdAt), 'd MMM yyyy, HH:mm') : ''}
                </span>
              </div>
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Submit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Submit Report"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowForm(false)}>Cancel</Button>
            <Button fullWidth onClick={submit} loading={saving}>Submit</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}

        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2">
          {REPORT_TYPES.map(({ value, label, icon: Icon, color }) => (
            <button key={value} type="button" onClick={() => setForm(f => ({ ...f, type: value }))}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${form.type === value ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-white'}`}>
              <Icon size={16} className={form.type === value ? '' : color} />
              {label}
            </button>
          ))}
        </div>

        {/* Site selector */}
        {assignedSites?.length > 0 && (
          <Select label="Site" value={form.site_id} onChange={f('site_id')}>
            <option value="">No specific site</option>
            {assignedSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}

        <Textarea
          label="Report Details *"
          value={form.text}
          onChange={f('text')}
          placeholder={
            form.type === 'daily_report'   ? 'Summarise today\'s work: progress made, tasks completed, labour on site...' :
            form.type === 'incident'        ? 'Describe the incident: what happened, who was involved, actions taken...' :
            form.type === 'progress'        ? 'Describe current progress, % complete, milestones reached...' :
            'Summarise the week: completed work, upcoming tasks, issues...'
          }
          rows={6}
        />
      </Modal>
    </div>
  )
}
