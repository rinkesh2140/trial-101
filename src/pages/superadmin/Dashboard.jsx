import { useQuery } from '@tanstack/react-query'
import { Building2, Users, MapPin, TrendingUp, CheckSquare, Activity, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { today, fmtAgo } from '../../lib/utils'
import { format } from 'date-fns'

function useOverview() {
  return useQuery({
    queryKey: ['sa-overview'],
    queryFn: async () => {
      const t = today()
      const [
        { count: companies },
        { count: employees },
        { count: sites },
        { count: presentToday },
        { count: openTasks },
        { count: pendingRequests },
        { data: recentCompanies },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', t),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('punch_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('companies').select('id,name,created_at').order('created_at', { ascending: false }).limit(5),
      ])
      // Safe query — check_in_outside_geofence column may not exist yet
      let flaggedAtt = []
      const { data: flagged, error: flagErr } = await supabase
        .from('attendance').select('id,date')
        .eq('date', t).eq('check_in_outside_geofence', true).limit(5)
      if (!flagErr) flaggedAtt = flagged ?? []

      return { companies, employees, sites, presentToday, openTasks, pendingRequests, recentCompanies: recentCompanies ?? [], flaggedAtt }
    }
  })
}

function useCompanyBreakdown() {
  return useQuery({
    queryKey: ['sa-company-breakdown'],
    queryFn: async () => {
      const t = today()
      const { data: companies } = await supabase.from('companies').select('id,name').order('name')
      if (!companies?.length) return []

      const breakdown = await Promise.all(companies.map(async c => {
        const [{ count: empCount }, { count: attToday }, { count: taskCount }] = await Promise.all([
          supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', c.id).eq('active', true),
          supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('company_id', c.id).eq('date', t),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('company_id', c.id).in('status', ['open', 'in_progress']),
        ])
        return { ...c, empCount: empCount ?? 0, attToday: attToday ?? 0, taskCount: taskCount ?? 0 }
      }))
      return breakdown
    }
  })
}

export default function SADashboard() {
  const { data: stats, isLoading: statsLoading, refetch } = useOverview()
  const { data: companies = [], isLoading: compLoading } = useCompanyBreakdown()
  const navigate = useNavigate()

  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">{greet}</p>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <button onClick={() => refetch()} className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Companies"      value={stats?.companies   ?? 0} icon={Building2}   color="text-amber-400" />
            <StatCard label="Active Staff"   value={stats?.employees   ?? 0} icon={Users}       color="text-blue-400" />
            <StatCard label="Sites"          value={stats?.sites       ?? 0} icon={MapPin}      color="text-green-400" />
            <StatCard label="Present Today"  value={stats?.presentToday ?? 0} icon={TrendingUp}  color="text-green-400" />
            <StatCard label="Active Tasks"   value={stats?.openTasks   ?? 0} icon={CheckSquare} color="text-orange-400" />
            <StatCard label="Pending Requests" value={stats?.pendingRequests ?? 0} icon={AlertTriangle} color="text-red-400" />
          </div>

          {/* Flagged check-ins */}
          {stats?.flaggedAtt?.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-orange-500/15">
                <AlertTriangle size={16} className="text-orange-400" />
                <h2 className="font-semibold text-white text-sm">Outside Geofence Today</h2>
                <Badge variant="orange">{stats.flaggedAtt.length}</Badge>
              </div>
              {stats.flaggedAtt.map(a => (
                <div key={a.id} className="px-5 py-3 border-b border-orange-500/10 last:border-0 flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{a.id?.split('_')?.[0] ?? a.id}</span>
                  <Badge variant="orange">outside geofence</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Company breakdown */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                <h2 className="font-semibold text-white">Company Status</h2>
              </div>
              <button onClick={() => navigate('/superadmin/companies')} className="text-xs text-amber-400 flex items-center gap-1">
                Manage <ArrowRight size={12} />
              </button>
            </div>

            {compLoading ? (
              <div className="flex justify-center py-6"><Spinner size={24} /></div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No companies yet.{' '}
                <button onClick={() => navigate('/superadmin/companies')} className="text-amber-400 underline">Add one</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {companies.map(c => (
                  <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{c.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-slate-500 text-xs flex items-center gap-1"><Users size={11} />{c.empCount}</span>
                        <span className="text-slate-500 text-xs flex items-center gap-1"><TrendingUp size={11} />{c.attToday} today</span>
                        <span className="text-slate-500 text-xs flex items-center gap-1"><CheckSquare size={11} />{c.taskCount} tasks</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${c.attToday > 0 ? 'bg-green-400' : 'bg-slate-600'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
