import { useQuery } from '@tanstack/react-query'
import { Users, MapPin, CheckSquare, TrendingUp, AlertCircle, ArrowRight, Clock, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { today, fmtDate } from '../../lib/utils'
import { format } from 'date-fns'

export default function AdminDashboard() {
  const { company, user } = useAuth()
  const cid     = user?.company_id
  const t       = today()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard', cid, t],
    enabled: !!cid,
    queryFn: async () => {
      const [
        { count: empCount },
        { count: siteCount },
        { count: attendToday },
        { count: openTasks },
        { count: inProgressTasks },
        { data: recentTasks },
        { data: pendingReqs },
        { data: sites },
        { data: recentReports },
      ] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('active', true),
        supabase.from('sites').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('active', true),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('date', t),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'open'),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'in_progress'),
        supabase.from('tasks').select('id,title,priority,status,dueDate,assignedTo').eq('company_id', cid).in('status', ['open','in_progress']).order('createdAt', { ascending: false }).limit(4),
        supabase.from('punch_requests').select('*').eq('company_id', cid).eq('status', 'pending').limit(5),
        supabase.from('sites').select('id,name').eq('company_id', cid).eq('active', true).limit(10),
        supabase.from('notes').select('id,text,category,createdAt,byEmployeeId,site_id').eq('company_id', cid).in('category', ['daily_report','report','incident']).order('createdAt', { ascending: false }).limit(3),
      ])

      // Per-site attendance
      const siteAttMap = {}
      if (sites?.length) {
        const { data: siteAtt } = await supabase
          .from('attendance').select('site_id')
          .eq('company_id', cid).eq('date', t)
        for (const a of siteAtt ?? []) {
          if (a.site_id) siteAttMap[a.site_id] = (siteAttMap[a.site_id] ?? 0) + 1
        }
      }

      return {
        empCount, siteCount, attendToday, openTasks, inProgressTasks,
        recentTasks: recentTasks ?? [],
        pendingReqs: pendingReqs ?? [],
        sites: sites ?? [],
        siteAttMap,
        recentReports: recentReports ?? [],
      }
    }
  })

  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{greet}</p>
          <h1 className="text-2xl font-bold text-white">{company?.name ?? 'Dashboard'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Active Staff',    value: data?.empCount    ?? 0, icon: Users,       color: 'text-blue-400',   bg: 'bg-blue-400/10',   path: '/admin/employees' },
              { label: 'Active Sites',    value: data?.siteCount   ?? 0, icon: MapPin,       color: 'text-amber-400',  bg: 'bg-amber-400/10',  path: '/admin/sites' },
              { label: 'Present Today',   value: data?.attendToday ?? 0, icon: TrendingUp,   color: 'text-green-400',  bg: 'bg-green-400/10',  path: '/admin/attendance' },
              { label: 'Open Tasks',      value: (data?.openTasks ?? 0) + (data?.inProgressTasks ?? 0), icon: CheckSquare, color: 'text-orange-400', bg: 'bg-orange-400/10', path: '/admin/tasks' },
            ].map(({ label, value, icon: Icon, color, bg, path }) => (
              <button key={label} onClick={() => navigate(path)}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left hover:border-slate-500 transition-colors active:scale-[0.98]">
                <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon size={18} className={color} />
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{label}</p>
              </button>
            ))}
          </div>

          {/* Pending requests alert */}
          {data?.pendingReqs?.length > 0 && (
            <button onClick={() => navigate('/admin/attendance')}
              className="w-full bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 flex items-center gap-3 hover:bg-orange-500/15 transition-colors">
              <AlertCircle size={20} className="text-orange-400 flex-shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-white font-semibold text-sm">{data.pendingReqs.length} Pending Punch Requests</p>
                <p className="text-slate-400 text-xs mt-0.5">Employees awaiting attendance correction approval</p>
              </div>
              <ArrowRight size={16} className="text-orange-400 flex-shrink-0" />
            </button>
          )}

          {/* Site attendance today */}
          {data?.sites?.length > 0 && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-amber-400" />
                  <h2 className="font-semibold text-white text-sm">Site Attendance Today</h2>
                </div>
                <button onClick={() => navigate('/admin/attendance')} className="text-amber-400 text-xs flex items-center gap-1">
                  Full View <ArrowRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-slate-700">
                {data.sites.map(s => {
                  const count = data.siteAttMap?.[s.id] ?? 0
                  return (
                    <div key={s.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${count > 0 ? 'bg-green-400' : 'bg-slate-600'}`} />
                        <span className="text-slate-200 text-sm">{s.name}</span>
                      </div>
                      <span className={`text-sm font-semibold ${count > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                        {count} present
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active tasks */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-amber-400" />
                <h2 className="font-semibold text-white text-sm">Active Tasks</h2>
                <Badge variant="amber">{(data?.openTasks ?? 0) + (data?.inProgressTasks ?? 0)}</Badge>
              </div>
              <button onClick={() => navigate('/admin/tasks')} className="text-amber-400 text-xs flex items-center gap-1">
                All Tasks <ArrowRight size={12} />
              </button>
            </div>
            {data?.recentTasks?.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No open tasks</p>
            ) : (
              <div className="divide-y divide-slate-700">
                {data?.recentTasks?.map(task => (
                  <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'critical' || task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                    <p className="text-slate-200 text-sm flex-1 truncate">{task.title}</p>
                    <Badge variant={task.status === 'in_progress' ? 'amber' : 'blue'} className="text-[10px] flex-shrink-0">
                      {task.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent employee reports */}
          {data?.recentReports?.length > 0 && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-400" />
                  <h2 className="font-semibold text-white text-sm">Recent Reports</h2>
                </div>
                <button onClick={() => navigate('/admin/reports')} className="text-amber-400 text-xs flex items-center gap-1">
                  View All <ArrowRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-slate-700">
                {data.recentReports.map(r => (
                  <div key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-slate-500 text-xs capitalize">{r.category?.replace('_', ' ')}</span>
                      <span className="text-slate-600 text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="text-slate-200 text-sm line-clamp-2">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Add Employee',     path: '/admin/employees',    color: 'text-blue-400'   },
                { label: 'Add Site',         path: '/admin/sites',        color: 'text-amber-400'  },
                { label: 'Create Task',      path: '/admin/tasks',        color: 'text-green-400'  },
                { label: 'Post Announcement', path: '/admin/announcements', color: 'text-purple-400' },
              ].map(({ label, path, color }) => (
                <button key={label} onClick={() => navigate(path)}
                  className="bg-slate-700/60 hover:bg-slate-700 border border-slate-600 rounded-xl px-3 py-3 text-left transition-colors">
                  <span className={`text-sm font-medium ${color}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
