import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, Calendar, LogOut, Edit2, KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { fmtDate } from '../../lib/utils'

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-700 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-slate-400" />
      </div>
      <div>
        <p className="text-slate-500 text-xs">{label}</p>
        <p className="text-white text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function AppProfile() {
  const { employee, user, company, logout, refreshSession } = useAuth()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' })
  const [pwdErr, setPwdErr]   = useState('')
  const [pwdOk, setPwdOk]     = useState(false)
  const [saving, setSaving]   = useState(false)

  function handleLogout() { logout(); navigate('/login') }

  async function changePassword() {
    if (!pwdForm.current || !pwdForm.next) { setPwdErr('All fields required.'); return }
    if (pwdForm.next !== pwdForm.confirm)  { setPwdErr('Passwords do not match.'); return }
    if (pwdForm.next.length < 6)           { setPwdErr('Password must be at least 6 characters.'); return }
    setSaving(true); setPwdErr('')
    const { data: match } = await supabase.from('users').select('id').eq('id', user.id).eq('password', pwdForm.current).single()
    if (!match) { setPwdErr('Current password is incorrect.'); setSaving(false); return }
    const { error } = await supabase.from('users').update({ password: pwdForm.next }).eq('id', user.id)
    if (error) { setPwdErr(error.message); setSaving(false); return }
    setPwdOk(true)
    setSaving(false)
    setTimeout(() => { setShowPwd(false); setPwdForm({ current: '', next: '', confirm: '' }); setPwdOk(false) }, 1500)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl font-bold mb-3">
          {initials(employee?.name)}
        </div>
        <h1 className="text-xl font-bold text-white">{employee?.name ?? user?.username}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{employee?.designation || employee?.role || '—'}</p>
        {company && <p className="text-slate-500 text-xs mt-1">{company.name}</p>}
      </div>

      {/* Info card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 px-4">
        <InfoRow icon={Phone}    label="Mobile"      value={employee?.mobile} />
        <InfoRow icon={Mail}     label="Email"       value={employee?.email} />
        <InfoRow icon={MapPin}   label="Department"  value={employee?.department} />
        <InfoRow icon={Calendar} label="Joined"      value={fmtDate(employee?.joinDate)} />
        <InfoRow icon={User}     label="Employee ID" value={employee?.id} />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPwd(true)}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
        >
          <KeyRound size={18} className="text-amber-400" />
          <span className="font-medium">Change Password</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 bg-slate-800 border border-red-500/20 rounded-2xl px-4 py-4 text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut size={18} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>

      {/* Change password modal */}
      <Modal
        open={showPwd}
        onClose={() => { setShowPwd(false); setPwdErr('') }}
        title="Change Password"
        footer={
          pwdOk ? null : (
            <>
              <Button variant="secondary" fullWidth onClick={() => setShowPwd(false)}>Cancel</Button>
              <Button fullWidth onClick={changePassword} loading={saving}>Update</Button>
            </>
          )
        }
      >
        {pwdOk ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-400/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <p className="text-white font-semibold">Password updated!</p>
          </div>
        ) : (
          <>
            {pwdErr && <p className="text-sm text-red-400 bg-red-400/10 rounded-xl p-3">{pwdErr}</p>}
            <Input label="Current Password" type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} placeholder="Current password" />
            <Input label="New Password" type="password" value={pwdForm.next} onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))} placeholder="New password (min 6 chars)" />
            <Input label="Confirm New Password" type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
          </>
        )}
      </Modal>
    </div>
  )
}
