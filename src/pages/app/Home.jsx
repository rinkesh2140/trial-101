import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, AlertTriangle, CheckCircle2, Clock, CheckSquare, Megaphone, ChevronRight, Navigation } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getPosition, checkGeofence } from '../../lib/geo'
import { today, fmtTime, fmtDuration, totalMins, isCurrentlyIN, attId } from '../../lib/utils'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'

function useAttendance(employeeId, date) {
  return useQuery({
    queryKey: ['att', employeeId, date],
    enabled: !!employeeId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from('attendance').select('*').eq('id', attId(employeeId, date)).single()
      return data ?? null
    }
  })
}

function useTodayTasks(employeeId, cid) {
  return useQuery({
    queryKey: ['tasks-emp', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('assignedTo', employeeId).in('status', ['open','in_progress']).eq('company_id', cid).order('priority', { ascending: false }).limit(3)
      return data ?? []
    }
  })
}

function useAnnouncements(cid, siteIds) {
  return useQuery({
    queryKey: ['ann-home', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').eq('company_id', cid).order('createdAt', { ascending: false }).limit(3)
      return data ?? []
    }
  })
}

export default function AppHome() {
  const { employee, company, assignedSites, user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const t = today()

  const { data: att, isLoading: attLoading } = useAttendance(employee?.id, t)
  const { data: tasks = [] } = useTodayTasks(employee?.id, user?.company_id)
  const { data: announcements = [] } = useAnnouncements(user?.company_id, assignedSites)

  const [geoState, setGeoState]   = useState('idle') // idle | locating | ok | warn | error
  const [geoInfo, setGeoInfo]     = useState(null)
  const [punching, setPunching]   = useState(false)

  const checkedIn = isCurrentlyIN(att)
  const workMins  = totalMins(att)
  const primarySite = assignedSites?.[0] ?? null

  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  async function handlePunch() {
    setPunching(true)
    setGeoState('locating')
    setGeoInfo(null)

    let lat = null, lng = null, outside = false

    try {
      const pos = await getPosition()
      lat = pos.coords.latitude
      lng = pos.coords.longitude

      if (primarySite?.lat) {
        const result = checkGeofence(lat, lng, primarySite)
        outside = !result.inside
        setGeoInfo(result)
        setGeoState(outside ? 'warn' : 'ok')

        if (outside) {
          const confirmed = window.confirm(
            `You are ${result.distance}m from site (allowed: ${result.radius}m).\n\nYour check-${checkedIn ? 'out' : 'in'} will be flagged. Continue?`
          )
          if (!confirmed) { setPunching(false); setGeoState('idle'); return }
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

      const { data: existing } = await supabase.from('attendance').select('*').eq('id', id).single()

      if (!checkedIn) {
        // CHECK IN
        const punches = existing?.punches ?? []
        punches.push({ inTime: now, outTime: null })

        if (existing) {
          await supabase.from('attendance').update({
            punches,
            check_in_lat: lat,
            check_in_lng: lng,
            check_in_outside_geofence: outside,
          }).eq('id', id)
        } else {
          await supabase.from('attendance').insert({
            id,
            employeeId: employee.id,
            date:       t,
            punches,
            check_in_lat:  lat,
            check_in_lng:  lng,
            check_in_outside_geofence: outside,
            company_id: user.company_id,
            site_id:    primarySite?.id ?? null,
          })
        }
      } else {
        // CHECK OUT
        const punches = [...(existing?.punches ?? [])]
        const lastIdx = punches.length - 1
        if (lastIdx >= 0 && !punches[lastIdx].outTime) {
          punches[lastIdx].outTime = now
        }
        await supabase.from('attendance').update({
          punches,
          check_out_lat: lat,
          check_out_lng: lng,
        }).eq('id', id)
      }

      await qc.invalidateQueries({ queryKey: ['att', employee.id, t] })
    } catch (e) {
      alert('Failed to record attendance: ' + e.message)
    } finally {
      setPunching(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-slate-400 text-sm">{greet},</p>
        <h1 className="text-2xl font-bold text-white leading-tight">{employee?.name?.split(' ')?.[0] ?? 'there'}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM')}</p>
      </div>

      {/* Check-in card */}
      <div className={`rounded-3xl p-5 border transition-all ${
        checkedIn
          ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30'
          : 'bg-gradient-to-br from-slate-800 to-slate-800 border-slate-700'
      }`}>
        {/* Site */}
        {primarySite && (
          <div className="flex items-center gap-1.5 mb-4">
            <MapPin size={13} className="text-slate-400" />
            <span className="text-slate-400 text-xs">{primarySite.name}</span>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`text-3xl font-bold ${checkedIn ? 'text-green-400' : 'text-slate-400'}`}>
              {checkedIn ? 'On Site' : 'Off Site'}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              {attLoading ? '—' : checkedIn ? `Since ${fmtTime(att?.punches?.at(-1)?.inTime)}` : workMins > 0 ? `${fmtDuration(workMins)} today` : 'Not checked in today'}
            </p>
          </div>
          {workMins > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{fmtDuration(workMins)}</p>
              <p className="text-slate-500 text-xs">worked today</p>
            </div>
          )}
        </div>

        {/* Geofence notice */}
        {geoState === 'warn' && geoInfo && (
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-3 text-orange-300 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{geoInfo.distance}m from site boundary — flagged</span>
          </div>
        )}
        {geoState === 'error' && (
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-3 text-orange-300 text-xs">
            <Navigation size={14} className="flex-shrink-0" />
            <span>Location unavailable — attendance logged without geo</span>
          </div>
        )}

        {/* Punch button */}
        <button
          onClick={handlePunch}
          disabled={punching || attLoading}
          className={`
            w-full py-4 rounded-2xl text-base font-bold transition-all flex items-center justify-center gap-2
            ${checkedIn
              ? 'bg-red-500 hover:bg-red-400 active:bg-red-600 text-white'
              : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900'}
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        >
          {punching
            ? <><Spinner size={18} /> {geoState === 'locating' ? 'Getting location...' : 'Recording...'}</>
            : checkedIn
              ? <><Clock size={20} /> Check Out</>
              : <><CheckCircle2 size={20} /> Check In</>}
        </button>

        {/* Punch history */}
        {att?.punches?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {att.punches.map((p, i) => (
              <span key={i} className="text-xs bg-slate-700/60 rounded-lg px-2.5 py-1 text-slate-300">
                {fmtTime(p.inTime)} {p.outTime ? `→ ${fmtTime(p.outTime)}` : '→ now'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* My Tasks */}
      {tasks.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <button
            onClick={() => navigate('/app/tasks')}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-700"
          >
            <div className="flex items-center gap-2">
              <CheckSquare size={15} className="text-amber-400" />
              <span className="text-white font-semibold text-sm">My Tasks</span>
              <Badge variant="amber">{tasks.length}</Badge>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
          <div className="divide-y divide-slate-700">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === 'high' || t.priority === 'critical' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                <p className="text-slate-300 text-sm flex-1 truncate">{t.title}</p>
                <Badge variant={t.status === 'in_progress' ? 'amber' : 'blue'} className="flex-shrink-0 text-[10px]">
                  {t.status?.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <button
            onClick={() => navigate('/app/announcements')}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-700"
          >
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="text-amber-400" />
              <span className="text-white font-semibold text-sm">Announcements</span>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </button>
          <div className="divide-y divide-slate-700">
            {announcements.map(a => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  {a.priority === 'urgent' && <Badge variant="red" className="text-[10px]">Urgent</Badge>}
                  <p className="text-white text-sm font-medium truncate">{a.title}</p>
                </div>
                <p className="text-slate-500 text-xs line-clamp-2">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
