import { useQuery } from '@tanstack/react-query'
import { Users, MapPin, CheckSquare, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { StatCard } from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { today, fmtTime, fmtDate, PRIORITY_COLOR } from '../../lib/utils'
import { format } from 'date-fns'

export default function AdminDashboard() {
  const { company, user } = useAuth()
  const cid = user?.company_id
  const t   = today()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard', cid],
    enabled: !!cid,
    queryFn: async () => {
      const [
        { count: empCount },
        { count: siteCount },
        { count: attendToday },
        { data: recentTasks },
        { data: pendingRequests },
      ] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('active', true),
        supabase.from('sites').select('*', { count: 'exact', head: true }).eq('company_id', cid),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('date', t),
        supabase.from('tasks').select('*').eq('company_id', cid).in('status', ['open','in_progress']).order('createdAt', { ascending: false }).limit(5),
        supabase.from('punch_requests').select('*').eq('company_id', cid).eq('status', 'pending').limit(5),
      ])
      return { empCount, siteCount, attendToday, recentTasks: recentTasks ?? [], pendingRequests: pendingRequests ?? [] }
    }
  })

  const hour   = new Date().getHours()
  const greet  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-slate-400 text-sm">{greet}</p>
        <h1 className="text-2xl font-bold text-white">{company?.name ?? 'Dashboard'}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Employees"    value={data?.empCount    ?? 0} icon={Users}       color="text-blue-400"   />
            <StatCard label="Sites"        value={data?.siteCount   ?? 0} icon={MapPin}      color="text-amber-400"  />
            <StatCard label="Present Today" value={data?.attendToday ?? 0} icon={TrendingUp}  color="text-green-400"  />
            <StatCard label="Pending Requests" value={data?.pendingRequests?.length ?? 0} icon={AlertCircle} color="text-orange-400" />
          </div>

          {/* Active Tasks */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
              <CheckSquare size={16} className="text-amber-400" />
              <h2 className="font-semibold text-white">Active Tasks</h2>
            </div>
            {data?.recentTasks?.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No open tasks</p>
            ) : (
              <div className="divide-y divide-slate-700">
                {data?.recentTasks?.map(task => (
                  <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{task.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Due: {task.dueDate ? fmtDate(task.dueDate) : '—'}</p>
                    </div>
                    <Badge variant={task.priority === 'high' || task.priority === 'critical' ? 'red' : task.priority === 'medium' ? 'amber' : 'slate'}>
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Punch Requests */}
          {data?.pendingRequests?.length > 0 && (
            <div className="bg-slate-800 rounded-2xl border border-orange-500/20">
              <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-400" />
                <h2 className="font-semibold text-white">Pending Requests</h2>
                <Badge variant="orange">{data.pendingRequests.length}</Badge>
              </div>
              <div className="divide-y divide-slate-700">
                {data.pendingRequests.map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium capitalize">{r.type?.replace('-', ' ')}</p>
                      <p className="text-slate-500 text-xs">{r.date} · {r.employeeId}</p>
                    </div>
                    <Badge variant="orange">pending</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
