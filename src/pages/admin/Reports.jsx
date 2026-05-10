import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileBarChart, Calendar, Users, FileText, AlertTriangle, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { fmtDuration, totalMins } from '../../lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'

const TABS = ['Attendance', 'Employee Reports']
const CATEGORY_LABEL = { daily_report: 'Daily', weekly_report: 'Weekly', incident: 'Incident', progress: 'Progress', report: 'Report' }
const CATEGORY_COLOR = { daily_report: 'blue', weekly_report: 'green', incident: 'red', progress: 'amber', report: 'slate' }

export default function AdminReports() {
  const { user } = useAuth()
  const cid   = user?.company_id
  const [tab, setTab]     = useState('Attendance')
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))

  const start = format(startOfMonth(parseISO(month + '-01')), 'yyyy-MM-dd')
  const end   = format(endOfMonth(parseISO(month + '-01')), 'yyyy-MM-dd')
  const days  = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })

  // ── Attendance report ─────────────────────────────────
  const { data: attData, isLoading: attLoading } = useQuery({
    queryKey: ['reports-att', cid, month],
    enabled: !!cid && tab === 'Attendance',
    queryFn: async () => {
      const [{ data: att }, { data: emps }] = await Promise.all([
        supabase.from('attendance').select('*').eq('company_id', cid).gte('date', start).lte('date', end),
        supabase.from('employees').select('id,name,role').eq('company_id', cid).eq('active', true).order('name'),
      ])
      const byEmp = {}
      for (const a of att ?? []) {
        const empId = a['employeeId']
        if (empId) {
          if (!byEmp[empId]) byEmp[empId] = []
          byEmp[empId].push(a)
        }
      }
      return { emps: emps ?? [], byEmp, totalDays: days.length }
    }
  })

  // ── Employee reports ───────────────────────────────────
  const { data: empReports = [], isLoading: repLoading } = useQuery({
    queryKey: ['reports-emp', cid, month],
    enabled: !!cid && tab === 'Employee Reports',
    queryFn: async () => {
      const { data: reports } = await supabase
        .from('notes')
        .select('*')
        .eq('company_id', cid)
        .in('category', ['daily_report', 'weekly_report', 'incident', 'progress', 'report'])
        .gte('createdAt', start + 'T00:00:00')
        .lte('createdAt', end + 'T23:59:59')
        .order('createdAt', { ascending: false })

      const { data: emps } = await supabase
        .from('employees').select('id,name').eq('company_id', cid)

      const { data: sites } = await supabase
        .from('sites').select('id,name').eq('company_id', cid)

      const empMap  = Object.fromEntries((emps  ?? []).map(e => [e.id, e.name]))
      const siteMap = Object.fromEntries((sites ?? []).map(s => [s.id, s.name]))

      return (reports ?? []).map(r => ({
        ...r,
        employeeName: empMap[r.byEmployeeId] ?? r.byEmployeeId ?? '—',
        siteName: r.site_id ? (siteMap[r.site_id] ?? '—') : null,
      }))
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Monthly summaries & employee reports</p>
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[200px]">
          <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 focus:border-amber-500 focus:outline-none" />
        </div>
        <span className="text-slate-400 text-sm">{format(parseISO(month + '-01'), 'MMMM yyyy')}</span>
      </div>

      {/* ── Attendance Report ── */}
      {tab === 'Attendance' && (
        attLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
              <Users size={16} className="text-amber-400" />
              <h2 className="font-semibold text-white text-sm">Attendance — {format(parseISO(month + '-01'), 'MMMM yyyy')}</h2>
            </div>
            {attData?.emps?.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No employees found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-medium px-5 py-3 min-w-[140px]">Employee</th>
                      <th className="text-center text-slate-400 font-medium px-3 py-3 min-w-[80px]">Present</th>
                      <th className="text-center text-slate-400 font-medium px-3 py-3 min-w-[90px]">Total Hrs</th>
                      <th className="text-center text-slate-400 font-medium px-3 py-3 min-w-[90px]">Avg/Day</th>
                      <th className="text-center text-slate-400 font-medium px-3 py-3 min-w-[70px]">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {attData?.emps?.map(emp => {
                      const records      = attData?.byEmp?.[emp.id] ?? []
                      const presentDays  = records.length
                      const totalMinutes = records.reduce((s, r) => s + totalMins(r), 0)
                      const avgMins      = presentDays > 0 ? totalMinutes / presentDays : 0
                      const pct          = attData?.totalDays ? Math.round(presentDays / attData.totalDays * 100) : 0
                      return (
                        <tr key={emp.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-5 py-3">
                            <p className="text-white font-medium">{emp.name}</p>
                            <p className="text-slate-500 text-xs">{emp.role || '—'}</p>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`font-semibold ${presentDays === 0 ? 'text-slate-500' : 'text-white'}`}>{presentDays}</span>
                            <span className="text-slate-500 text-xs">/{attData?.totalDays}</span>
                          </td>
                          <td className="text-center px-3 py-3 text-white font-medium">{fmtDuration(totalMinutes)}</td>
                          <td className="text-center px-3 py-3 text-slate-300">{presentDays > 0 ? fmtDuration(avgMins) : '—'}</td>
                          <td className="text-center px-3 py-3">
                            <span className={`text-xs font-semibold ${pct >= 90 ? 'text-green-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Employee Reports ── */}
      {tab === 'Employee Reports' && (
        repLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : empReports.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p>No employee reports submitted this month.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {empReports.map(r => (
              <div key={r.id} className={`bg-slate-800 rounded-2xl border p-4 ${r.category === 'incident' ? 'border-red-500/25' : 'border-slate-700'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={CATEGORY_COLOR[r.category] ?? 'slate'}>
                      {r.category === 'incident' && <AlertTriangle size={10} className="mr-1" />}
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </Badge>
                    <span className="text-white font-semibold text-sm">{r.employeeName}</span>
                    {r.siteName && <span className="text-slate-500 text-xs">@ {r.siteName}</span>}
                  </div>
                  <span className="text-slate-500 text-xs flex-shrink-0">
                    {r.createdAt ? format(new Date(r.createdAt), 'd MMM, HH:mm') : ''}
                  </span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{r.text}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
