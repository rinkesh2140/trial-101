import { useQuery } from '@tanstack/react-query'
import { Building2, Users, MapPin, TrendingUp, Activity, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { fmtAgo } from '../../lib/utils'

function useStats() {
  return useQuery({
    queryKey: ['sa-stats'],
    queryFn: async () => {
      const [{ count: companies }, { count: employees }, { count: sites }, { data: recent }] =
        await Promise.all([
          supabase.from('companies').select('*', { count: 'exact', head: true }),
          supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
          supabase.from('sites').select('*', { count: 'exact', head: true }),
          supabase.from('companies').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
        ])
      return { companies, employees, sites, recent: recent ?? [] }
    }
  })
}

export default function SADashboard() {
  const { data, isLoading, refetch } = useStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Platform-wide overview</p>
        </div>
        <button onClick={() => refetch()} className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Companies"      value={data?.companies ?? 0} icon={Building2}   color="text-amber-400" />
            <StatCard label="Active Employees" value={data?.employees ?? 0} icon={Users}     color="text-green-400" />
            <StatCard label="Total Sites"    value={data?.sites ?? 0}     icon={MapPin}      color="text-blue-400" />
          </div>

          {/* Recent Companies */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                Recently Onboarded
              </h2>
            </div>
            {data?.recent?.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No companies yet</p>
            ) : (
              <div className="divide-y divide-slate-700">
                {data?.recent?.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-amber-500/15 rounded-xl flex items-center justify-center">
                        <Building2 size={16} className="text-amber-400" />
                      </div>
                      <span className="text-white font-medium text-sm">{c.name}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{fmtAgo(c.created_at)}</span>
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
