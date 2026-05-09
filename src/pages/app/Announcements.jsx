import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { fmtAgo } from '../../lib/utils'

export default function AppAnnouncements() {
  const { user } = useAuth()
  const cid = user?.company_id

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['announcements', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase.from('announcements').select('*').eq('company_id', cid).order('createdAt', { ascending: false })
      return data ?? []
    }
  })

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <p className="text-slate-400 text-sm mt-0.5">Updates from your company</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p>No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div
              key={a.id}
              className={`bg-slate-800 rounded-2xl border p-4 ${a.priority === 'urgent' ? 'border-red-500/30' : a.priority === 'important' ? 'border-amber-500/20' : 'border-slate-700'}`}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {a.priority === 'urgent' && <Badge variant="red">Urgent</Badge>}
                {a.priority === 'important' && <Badge variant="amber">Important</Badge>}
                {a.type === 'site' && <Badge variant="blue">Your Site</Badge>}
                <span className="text-slate-500 text-xs ml-auto">{fmtAgo(a.createdAt)}</span>
              </div>
              <p className="text-white font-semibold text-base">{a.title}</p>
              <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
