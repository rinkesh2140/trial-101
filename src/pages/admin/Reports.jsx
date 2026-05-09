import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileBarChart, Download, Calendar, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { fmtDuration, totalMins } from '../../lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns'

export default function AdminReports() {
  const { user } = useAuth()
  const cid   = user?.company_id
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))

  const start = format(startOfMonth(parseISO(month + '-01')), 'yyyy-MM-dd')
  const end   = format(endOfMonth(parseISO(month + '-01')), 'yyyy-MM-dd')
  const days  = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })

  const { data, isLoading } = useQuery({
    queryKey: ['reports', cid, month],
    enabled: !!cid,
    queryFn: async () => {
      const [{ data: att }, { data: emps }] = await Promise.all([
        supabase.from('attendance').select('*').eq('company_id', cid).gte('date', start).lte('date', end),
        supabase.from('employees').select('id, name, role').eq('company_id', cid).eq('active', true).order('name'),
      ])

      const byEmp = {}
      for (const a of att ?? []) {
        if (!byEmp[a.employeeId]) byEmp[a.employeeId] = []
        byEmp[a.employeeId].push(a)
      }

      return {
        emps: emps ?? [],
        byEmp,
        totalDays: days.length,
      }
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Monthly attendance summary</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-slate-800 text-white rounded-xl pl-10 pr-4 py-3 text-sm border border-slate-700 focus:border-amber-500 focus:outline-none" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
            <Users size={16} className="text-amber-400" />
            <h2 className="font-semibold text-white">Attendance Report — {format(parseISO(month + '-01'), 'MMMM yyyy')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium px-5 py-3 min-w-[140px]">Employee</th>
                  <th className="text-center text-slate-400 font-medium px-3 py-3">Days Present</th>
                  <th className="text-center text-slate-400 font-medium px-3 py-3">Total Hours</th>
                  <th className="text-center text-slate-400 font-medium px-3 py-3">Avg Hours/Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {data?.emps?.map(emp => {
                  const records = data?.byEmp?.[emp.id] ?? []
                  const presentDays = records.length
                  const totalMinutes = records.reduce((s, r) => s + totalMins(r), 0)
                  const avgMins = presentDays > 0 ? totalMinutes / presentDays : 0
                  return (
                    <tr key={emp.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{emp.name}</p>
                        <p className="text-slate-500 text-xs">{emp.role || '—'}</p>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={`font-semibold ${presentDays === 0 ? 'text-slate-500' : 'text-white'}`}>{presentDays}</span>
                        <span className="text-slate-500 text-xs">/{data?.totalDays}</span>
                      </td>
                      <td className="text-center px-3 py-3 text-white font-medium">{fmtDuration(totalMinutes)}</td>
                      <td className="text-center px-3 py-3 text-slate-300">{presentDays > 0 ? fmtDuration(avgMins) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
