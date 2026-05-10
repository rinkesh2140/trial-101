import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, AlertTriangle, CheckCircle2, Clock, CheckSquare, Megaphone, ChevronRight, Navigation, LogIn, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getPosition, checkGeofence } from '../../lib/geo'
import { today, fmtTime, fmtDuration, totalMins, isCurrentlyIN, attId } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'

function useAttendance(empId, date) {
  return useQuery({
    queryKey: ['att', empId, date],
    enabled: !!empId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance').select('*')
        .eq('id', attId(empId, date))
        .maybeSingle()
      return data ?? null
    }
  })
}

function useTodayTasks(empId, cid) {
  return useQuery({
    queryKey: ['tasks-emp', empId],
    enabled: !!empId && !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id,title,status,priority,dueDate')
        .eq('assignedTo', empId).eq('company_id', cid)
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false }).limit(3)
      return data ?? []
    }
  })
}

function useAnnouncements(cid) {
  return useQuery({
    queryKey: ['ann-home', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('id,title,body,priority')
        .eq('company_id', cid).order('createdAt', { ascending: false }).limit(2)
      return data ?? []
    }
  })
}

export default function AppHome() {
  const { employee, user, assignedSites, isSuperAdmin, isCompanyAdmin } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const t = today()

  // Redirect superadmin/admin who somehow land on /app
  if (isSuperAdmin) { navigate('/superadmin', { replace: true }); return null }
  if (isCompanyAdmin) { navigate('/admin', { replace: true }); return null }

  const { data: att, isLoading: attLoading } = useAttendance(employee?.id, t)
  const { data: tasks = [] } = useTodayTasks(employee?.id, user?.company_id)
  const { data: announcements = [] } = useAnnouncements(user?.company_id)

  const [geoState, setGeoState] = useState('idle')
  const [geoInfo, setGeoInfo]   = useState(null)
  const [punching, setPunching] = useState(false)
  const [punchErr, setPunchErr] = useState('')

  const checkedIn   = isCurrentlyIN(att)
  const workMins    = totalMins(att)
  const primarySite = assignedSites?.[0] ?? null

  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  async function handlePunch() {
    if (!employee?.id) { setPunchErr('No employee profile linked to this account.'); return }
    setPunching(true); setGeoState('locating'); setGeoInfo(null); setPunchErr('')

    let lat = null, lng = null, outside = false

    // Get location
    try {
      const pos = await getPosition()
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      if (primarySite?.lat) {
        const geo = checkGeofence(lat, lng, primarySite)
        outside = !geo.inside
        setGeoInfo(geo)
        setGeoState(outside ? 'warn' : 'ok')
        if (outside && !window.confirm(`You are ${geo.distance}m from site (limit: ${geo.radius}m).\n\nAttendance will be flagged. Continue?`)) {
          setPunching(false); setGeoState('idle'); return
        }
      } else {
        setGeoState('ok')
      }
    } catch {
      setGeoState('error')
    }

    try {
      const id  = attId(employee.id, t)
      const now = new Date().toISOString()
      const { data: existing } = await supabase.from('attendance').select('*').eq('id', id).maybeSingle()

      if (!checkedIn) {
        // CHECK IN
        const punches = [...(existing?.punches ?? []), { inTime: now, outTime: null }]
        const base = { punches, company_id: user.company_id ?? null, site_id: primarySite?.id ?? null }
        const geo  = lat ? { check_in_lat: lat, check_in_lng: lng, check_in_outside_geofence: outside } : {}

        if (existing) {
          // Try with geo, fallback without
          const { error } = await supabase.from('attendance').update({ ...base, ...geo }).eq('id', id)
          if (error) await supabase.from('attendance').update(base).eq('id', id)
        } else {
          const row = { id, employeeId: employee.id, date: t, ...base, ...geo }
          const { error } = await supabase.from('attendance').insert(row)
          if (error) {
            const { error: e2 } = await supabase.from('attendance').insert({ id, employeeId: employee.id, date: t, ...base })
            if (e2) throw new Error(e2.message)
          }
        }
      } else {
        // CHECK OUT
        const punches = [...(existing?.punches ?? [])]
        const last = punches.length - 1
        if (last >= 0 && !punches[last].outTime) punches[last].outTime = now
        const base = { punches }
        const geo  = lat ? { check_out_lat: lat, check_out_lng: lng } : {}
        const { error } = await supabase.from('attendance').update({ ...base, ...geo }).eq('id', id)
        if (error) await supabase.from('attendance').update(base).eq('id', id)
      }

      await qc.invalidateQueries({ queryKey: ['att', employee.id, t] })
      if (navigator.vibrate) navigator.vibrate([50, 30, 50])
    } catch (e) {
      setPunchErr(e.message)
    } finally {
      setPunching(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-4">
      {/* Greeting */}
      <div>
        <p className="text-slate-400 text-sm">{greet},</p>
        <h1 className="text-2xl font-bold text-white">{employee?.name?.split(' ')?.[0] ?? user?.username}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Check-in card */}
      <div className={`rounded-3xl p-5 border transition-colors ${
        checkedIn ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800 border-slate-700'
      }`}>
        {primarySite && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={13} className="text-slate-500" />
            <span className="text-slate-500 text-xs">{primarySite.name}</span>
          </div>
        )}

        <div className="flex items-end justify-between mb-4">
          <div>
            <p className={`text-3xl font-bold ${checkedIn ? 'text-green-400' : 'text-slate-400'}`}>
              {attLoading ? '—' : checkedIn ? 'On Site' : 'Off Site'}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              {attLoading ? '' : checkedIn
                ? `Since ${fmtTime(att?.punches?.at(-1)?.inTime)}`
                : workMins > 0 ? `${fmtDuration(workMins)} logged today` : 'Not checked in today'}
            </p>
          </div>
          {workMins > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{fmtDuration(workMins)}</p>
              <p className="text-slate-500 text-xs">today</p>
            </div>
          )}
        </div>

        {/* Geo status */}
        {geoState === 'warn' && geoInfo && (
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2.5 mb-3 text-orange-300 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{geoInfo.distance}m from site — attendance flagged</span>
          </div>
        )}
        {geoState === 'error' && (
          <div className="flex items-center gap-2 bg-slate-700 rounded-xl px-3 py-2.5 mb-3 text-slate-400 text-xs">
            <Navigation size={14} className="flex-shrink-0" />
            <span>Location unavailable — checked in without GPS</span>
          </div>
        )}
        {punchErr && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-3 text-red-300 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{punchErr}</span>
          </div>
        )}

        {/* Big punch button */}
        <button
          onClick={handlePunch}
          disabled={punching || attLoading}
          className={`w-full py-5 rounded-2xl text-lg font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]
            ${checkedIn
              ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/25'}
            disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {punching
            ? <><Spinner size={20} className="text-current" />{geoState === 'locating' ? 'Getting location…' : 'Recording…'}</>
            : checkedIn
              ? <><LogOut size={22} />Check Out</>
              : <><LogIn size={22} />Check In</>}
        </button>

        {/* Punch history */}
        {att?.punches?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {att.punches.map((p, i) => (
              <span key={i} className="text-xs bg-slate-700/70 rounded-lg px-2.5 py-1 text-slate-400">
                {fmtTime(p.inTime)} {p.outTime ? `→ ${fmtTime(p.outTime)}` : '→ now'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tasks preview */}
      {tasks.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <button onClick={() => navigate('/app/tasks')} className="w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-amber-400" />
              <span className="text-white font-semibold text-sm">My Tasks</span>
              <Badge variant="amber">{tasks.length}</Badge>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
          {tasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 last:border-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === 'high' || t.priority === 'critical' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-500'}`} />
              <p className="text-slate-300 text-sm flex-1 truncate">{t.title}</p>
              <Badge variant={t.status === 'in_progress' ? 'amber' : 'blue'} className="text-[10px] flex-shrink-0">
                {t.status?.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Announcements preview */}
      {announcements.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <button onClick={() => navigate('/app/announcements')} className="w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-amber-400" />
              <span className="text-white font-semibold text-sm">Announcements</span>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
          {announcements.map(a => (
            <div key={a.id} className="px-4 py-3 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center gap-2 mb-0.5">
                {a.priority === 'urgent' && <Badge variant="red" className="text-[10px]">Urgent</Badge>}
                <p className="text-white text-sm font-medium truncate">{a.title}</p>
              </div>
              <p className="text-slate-500 text-xs line-clamp-1">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
