import { format, formatDistanceToNow, parseISO } from 'date-fns'

export const today = () => format(new Date(), 'yyyy-MM-dd')

export const fmtDate  = d => d ? format(parseISO(d), 'dd MMM yyyy') : '—'
export const fmtTime  = d => d ? format(new Date(d), 'hh:mm a') : '—'
export const fmtAgo   = d => d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—'

export const attId = (employeeId, date) => `${employeeId}_${date}`

export function isCurrentlyIN(att) {
  if (!att?.punches?.length) return false
  const last = att.punches[att.punches.length - 1]
  return !!last.inTime && !last.outTime
}

export function totalMins(att) {
  if (!att?.punches?.length) return 0
  return att.punches.reduce((sum, p) => {
    if (!p.inTime || !p.outTime) return sum
    return sum + (new Date(p.outTime) - new Date(p.inTime)) / 60000
  }, 0)
}

export function fmtDuration(mins) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export const PRIORITY_COLOR = {
  critical: 'text-red-400 bg-red-400/10',
  high:     'text-orange-400 bg-orange-400/10',
  medium:   'text-amber-400 bg-amber-400/10',
  low:      'text-slate-400 bg-slate-400/10',
}

export const STATUS_COLOR = {
  open:        'text-blue-400 bg-blue-400/10',
  in_progress: 'text-amber-400 bg-amber-400/10',
  done:        'text-green-400 bg-green-400/10',
  blocked:     'text-red-400 bg-red-400/10',
}
