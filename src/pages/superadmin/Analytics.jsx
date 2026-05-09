import { useQuery } from '@tanstack/react-query'
import { BarChart3, Users, Building2, MapPin, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { today } from '../../lib/utils'

export default function SAAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['sa-analytics'],
    queryFn: async () => {
      const t = today()
      const [
        { count: totalCompanies },
        { count: totalEmployees },
        { count: totalSites },
        { count: todayAttendance },
        { count: openTasks },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', t),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ])
      return { totalCompanies, totalEmployees, totalSites, todayAttendance, openTasks }
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-0.5">Platform-wide metrics</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Companies"        value={data?.totalCompanies  ?? 0} icon={Building2}   color="text-amber-400" />
          <StatCard label="Active Employees" value={data?.totalEmployees  ?? 0} icon={Users}       color="text-green-400" />
          <StatCard label="Total Sites"      value={data?.totalSites      ?? 0} icon={MapPin}      color="text-blue-400" />
          <StatCard label="Present Today"    value={data?.todayAttendance ?? 0} icon={TrendingUp}  color="text-green-400" />
          <StatCard label="Open Tasks"       value={data?.openTasks       ?? 0} icon={BarChart3}   color="text-orange-400" />
        </div>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 text-center text-slate-500">
        <BarChart3 size={36} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Detailed charts coming soon</p>
      </div>
    </div>
  )
}
