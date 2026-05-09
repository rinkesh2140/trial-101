import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Search, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { today, fmtTime, fmtDuration, totalMins, isCurrentlyIN } from '../../lib/utils'
import { format, subDays } from 'date-fns'

export default function AdminAttendance() {
  const { user } = useAuth()
  const cid = user?.company_id
  const [date, setDate]     = useState(today())
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-admin', cid, date],
    enabled: !!cid,
    queryFn: async () => {
      const [{ data: att }, { data: emps }] = await Promise.all([
        supabase.from('attendance').select('*').eq('company_id', cid).eq('date', date),
        supabase.from('employees').select('id, name, role').eq('company_id', cid).eq('active', true),
      ])
      const attMap = Object.fromEntries((att ?? []).map(a => [a.employeeId, a]))
      return { att: att ?? [], emps: emps ?? [], attMap }
    }
  })

  const rows = (data?.emps ?? [])
    .filter(e => e.name?.toLowerCase().includes(search.toLowerCase()))
    .map(e => ({ emp: e, att: data?.attMap?.[e.id] ?? null }))

  const presentCount = rows.filter(r => !!r.att).length
  const flaggedCount = rows.filter(r => r.att?.check_in_outside_geofence).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <p className="text-slate-400 text-sm mt-0.5">{presentCount}/{rows.length} present · {flaggedCount} flagged</p>
      </div>

      {/* Date picker */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[0,1,2,3,4,5,6].map(d => {
          const dt = format(subDays(new Date(), d), 'yyyy-MM-dd')
          const label = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : format(subDays(new Date(), d), 'EEE d')
          return (
            <button
              key={dt}
              onClick={() => setDate(dt)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${date === dt ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}
            >
              {label}
            </button>
          )
        })}
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-shrink-0 bg-slate-800 text-white rounded-xl px-3 py-1.5 text-sm border border-slate-700 focus:border-amber-500 focus:outline-none" />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ emp, att }) => {
            const checkedIn = isCurrentlyIN(att)
            const mins = totalMins(att)
            const flagged = att?.check_in_outside_geofence

            return (
              <div key={emp.id} className={`bg-slate-800 rounded-2xl border p-4 ${flagged ? 'border-orange-500/30' : 'border-slate-700'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${att ? (checkedIn ? 'bg-green-400/20 text-green-400' : 'bg-blue-400/20 text-blue-400') : 'bg-slate-700 text-slate-500'}`}>
                    {emp.name?.slice(0, 1) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm">{emp.name}</p>
                      {flagged && <Badge variant="orange"><AlertTriangle size={10} className="mr-1" />Outside geofence</Badge>}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{emp.role || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {!att ? (
                      <span className="text-slate-500 text-sm">Absent</span>
                    ) : (
                      <>
                        <Badge variant={checkedIn ? 'green' : 'blue'}>{checkedIn ? 'In' : 'Out'}</Badge>
                        <p className="text-slate-400 text-xs mt-1">{fmtDuration(mins)}</p>
                      </>
                    )}
                  </div>
                </div>
                {att?.punches?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {att.punches.map((p, i) => (
                      <div key={i} className="text-xs bg-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300">
                        IN {fmtTime(p.inTime)} {p.outTime ? `→ OUT ${fmtTime(p.outTime)}` : '→ active'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
