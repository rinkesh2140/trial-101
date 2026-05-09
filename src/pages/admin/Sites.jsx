import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Plus, Users, Radio, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

const BLANK = { name: '', address: '', city: '', lat: '', lng: '', radius_meters: '200' }

export default function AdminSites() {
  const { user } = useAuth()
  const cid = user?.company_id
  const qc  = useQueryClient()
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data } = await supabase
        .from('sites')
        .select('*, employee_sites(count)')
        .eq('company_id', cid)
        .order('name')
      return data ?? []
    }
  })

  function openAdd()  { setForm(BLANK); setErr(''); setModal('add') }
  function openEdit(s) { setForm({ name: s.name, address: s.address ?? '', city: s.city ?? '', lat: s.lat ?? '', lng: s.lng ?? '', radius_meters: String(s.radius_meters ?? 200) }); setErr(''); setModal({ type: 'edit', id: s.id }) }

  async function save() {
    if (!form.name.trim()) { setErr('Site name is required.'); return }
    setSaving(true); setErr('')
    const payload = {
      name:           form.name.trim(),
      address:        form.address.trim() || null,
      city:           form.city.trim() || null,
      lat:            form.lat ? parseFloat(form.lat) : null,
      lng:            form.lng ? parseFloat(form.lng) : null,
      radius_meters:  parseInt(form.radius_meters) || 200,
      company_id:     cid,
    }
    try {
      if (modal === 'add') {
        const { error } = await supabase.from('sites').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sites').update(payload).eq('id', modal.id)
        if (error) throw error
      }
      await qc.invalidateQueries({ queryKey: ['sites', cid] })
      setModal(null)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(s) {
    await supabase.from('sites').update({ active: !s.active }).eq('id', s.id)
    qc.invalidateQueries({ queryKey: ['sites', cid] })
  }

  async function deleteSite(s) {
    if (!confirm(`Delete "${s.name}"?`)) return
    await supabase.from('sites').delete().eq('id', s.id)
    qc.invalidateQueries({ queryKey: ['sites', cid] })
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sites</h1>
          <p className="text-slate-400 text-sm mt-0.5">{sites.length} site{sites.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd}><Plus size={18} /> Add Site</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : sites.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MapPin size={40} className="mx-auto mb-3 opacity-30" />
          <p>No sites yet. Add your first construction site.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map(s => (
            <div key={s.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${s.active ? 'bg-green-400/15' : 'bg-slate-700'}`}>
                  <MapPin size={20} className={s.active ? 'text-green-400' : 'text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{s.name}</p>
                    <Badge variant={s.active ? 'green' : 'slate'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                    {s.lat && <Badge variant="blue"><Radio size={10} className="mr-1" />Geofenced</Badge>}
                  </div>
                  <p className="text-slate-400 text-sm mt-0.5">{[s.address, s.city].filter(Boolean).join(', ') || 'No address set'}</p>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <Users size={12} /> {s.employee_sites?.[0]?.count ?? 0} assigned
                    </span>
                    {s.lat && (
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Radio size={12} /> {s.radius_meters}m radius
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => toggleActive(s)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${s.active ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-green-400 hover:bg-green-400/10'}`}>
                    {s.active ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                  </button>
                  <button onClick={() => deleteSite(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Site' : 'Edit Site'}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth onClick={save} loading={saving}>Save Site</Button>
          </>
        }
      >
        {err && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{err}</p>}
        <Input label="Site Name *" value={form.name} onChange={f('name')} placeholder="e.g. Tower Block A" />
        <Input label="Address" value={form.address} onChange={f('address')} placeholder="Street address" />
        <Input label="City" value={form.city} onChange={f('city')} placeholder="City" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Geofence (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude"  value={form.lat} onChange={f('lat')} placeholder="e.g. 23.0225" type="number" step="any" />
          <Input label="Longitude" value={form.lng} onChange={f('lng')} placeholder="e.g. 72.5714" type="number" step="any" />
        </div>
        <Input label="Radius (meters)" value={form.radius_meters} onChange={f('radius_meters')} placeholder="200" type="number" />
        <p className="text-xs text-slate-500">Employees outside this radius will be flagged when checking in.</p>
      </Modal>
    </div>
  )
}
