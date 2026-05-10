import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Search, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { today, fmtTime, fmtDuration, totalMins, isCurrentlyIN } from '../../lib/utils'
import { format, subDays } from 'date-fns'

const TABS = ['Daily View', 'Punch Requests']

export default function AdminAttendance() {
  const { user } = useAuth()
  const cid  = user?.company_id
  const qc   = useQueryClient()
  const [tab, setTab]       = useState('Daily View')
  const [date, setDate]     = useState(today())
  const [search, setSearch] = useState('')

  // ── Daily attendance ────────────────────────────────────
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['attendance-admin', cid, date],
    enabled: !!cid && tab === 'Daily View',
    queryFn: async () => {
      const [{ data: att }, { data: emps }] = await Promise.all([
        supabase.from('attendance').select('*').eq('company_id', cid).eq('date', date),
        supabase.from('employees').select('id,name,role').eq('company_id', cid).eq('active', true),
      ])
      const attMap = Object.fromEntries((att ?? []).map(a => [a['employeeId'], a]))
      return { att: att ?? [], emps: emps ?? [], attMap }
    }
  })

  const rows = (dailyData?.emps ?? [])
    .filter(e => e.name?.toLowerCase().includes(search.toLowerCase()))
    .map(e => ({ emp: e, att: dailyData?.attMap?.[e.id] ?? null }))

  const presentCount = rows.filter(r => !!r.att).length
  const flaggedCount = rows.filter(r => r.att?.check_in_outside_geofence).length

  // ── Punch requests ──────────────────────────────────────
  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['punch-requests', cid],
    enabled: !!cid && tab === 'Punch Requests',
    queryFn: async () => {
      const { data } = await supabase
        .from('punch_requests').select('*').eq('company_id', cid)
        .order('submittedAt', { ascending: false }).limit(50)
      return data ?? []
    }
  })

  async function decideRequest(id, status) {
    await supabase.from('punch_requests').update({
      status,
      decidedBy:  user?.username,
      decidedAt:  new Date().toISOString(),
    }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['punch-requests', cid] })
    qc.invalidateQueries({ queryKey: ['admin-dashboard', cid] })
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {tab === 'Daily View' ? `${presentCount}/${rows.length} present · ${flaggedCount} flagged` : `${pendingCount} pending requests`}
        </p>
      </div>

      {/* Tab switch */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}>
            {t} {t === 'Punch Requests' && pendingCount > 0 && tab !== t && (
              <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Daily View ── */}
      {tab === 'Daily View' && (
        <>
          {/* Date picker */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[0,1,2,3,4,5,6].map(d => {
              const dt    = format(subDays(new Date(), d), 'yyyy-MM-dd')
              const label = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : format(subDays(new Date(), d), 'EEE d')
              return (
                <button key={dt} onClick={() => setDate(dt)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${date === dt ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}>
                  {label}
                </button>
              )
            })}
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="flex-shrink-0 bg-slate-800 text-white rounded-xl px-3 py-1.5 text-sm border border-slate-700 focus:border-amber-500 focus:outline-none" />
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
              className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
          </div>

          {dailyLoading ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : (
            <div className="space-y-2">
              {rows.map(({ emp, att }) => {
                const ci     = isCurrentlyIN(att)
                const mins   = totalMins(att)
                const flagged = att?.check_in_outside_geofence
                return (
                  <div key={emp.id} className={`bg-slate-800 rounded-2xl border p-4 ${flagged ? 'border-orange-500/30' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${att ? (ci ? 'bg-green-400/20 text-green-400' : 'bg-blue-400/20 text-blue-400') : 'bg-slate-700 text-slate-500'}`}>
                        {emp.name?.slice(0, 1) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium text-sm">{emp.name}</p>
                          {flagged && <Badge variant="orange"><AlertTriangle size={10} className="mr-0.5" />Flagged</Badge>}
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">{emp.role || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {!att ? (
                          <span className="text-slate-500 text-sm">Absent</span>
                        ) : (
                          <>
                            <Badge variant={ci ? 'green' : 'blue'}>{ci ? 'In' : 'Out'}</Badge>
                            <p className="text-slate-400 text-xs mt-1">{fmtDuration(mins)}</p>
                          </>
                        )}
                      </div>
                    </div>
                    {att?.punches?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {att.punches.map((p, i) => (
                          <div key={i} className="text-xs bg-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300">
                            IN {fmtTime(p.inTime)}{p.outTime ? ` → OUT ${fmtTime(p.outTime)}` : ' → active'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {rows.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Clock size={36} className="mx-auto mb-2 opacity-30" />
                  <p>No employees found.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Punch Requests ── */}
      {tab === 'Punch Requests' && (
        <>
          {reqLoading ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>No punch requests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className={`bg-slate-800 rounded-2xl border p-4 ${r.status === 'pending' ? 'border-orange-500/25' : r.status === 'approved' ? 'border-green-500/25' : 'border-slate-700'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={r.status === 'pending' ? 'orange' : r.status === 'approved' ? 'green' : 'slate'}>
                          {r.status}
                        </Badge>
                        <span className="text-white text-sm font-semibold capitalize">{r.type?.replace('-', ' ')}</span>
                      </div>
                      <p className="text-slate-400 text-xs">{r['employeeId']} · {r.date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {r.inTime && <p className="text-slate-300 text-xs">IN: {r.inTime}</p>}
                      {r.outTime && <p className="text-slate-300 text-xs">OUT: {r.outTime}</p>}
                    </div>
                  </div>

                  {r.reason && (
                    <p className="text-slate-400 text-xs bg-slate-700/50 rounded-lg px-3 py-2 mb-3">
                      "{r.reason}"
                    </p>
                  )}

                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="success" onClick={() => decideRequest(r.id, 'approved')} className="flex-1">
                        <CheckCircle2 size={14} /> Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => decideRequest(r.id, 'rejected')} className="flex-1">
                        <XCircle size={14} /> Reject
                      </Button>
                    </div>
                  )}

                  {r.status !== 'pending' && r.decidedBy && (
                    <p className="text-slate-600 text-xs">
                      {r.status === 'approved' ? '✓' : '✗'} {r.status} by {r.decidedBy}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
