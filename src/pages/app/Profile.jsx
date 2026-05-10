import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, Calendar, LogOut, KeyRound, Building2, BadgeCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { fmtDate } from '../../lib/utils'

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-slate-700/60 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-slate-400" />
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium">{label}</p>
        <p className="text-white text-sm font-medium mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function AppProfile() {
  const { employee, user, company, logout } = useAuth()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' })
  const [pwdErr, setPwdErr]   = useState('')
  const [pwdOk, setPwdOk]     = useState(false)
  const [saving, setSaving]   = useState(false)

  function handleLogout() { logout(); navigate('/login', { replace: true }) }

  const pf = k => e => setPwdForm(f => ({ ...f, [k]: e.target.value }))

  async function changePassword() {
    setPwdErr('')
    if (!pwdForm.current || !pwdForm.next)      { setPwdErr('All fields are required.'); return }
    if (pwdForm.next !== pwdForm.confirm)        { setPwdErr('New passwords do not match.'); return }
    if (pwdForm.next.length < 6)                 { setPwdErr('Password must be at least 6 characters.'); return }
    if (pwdForm.current === pwdForm.next)        { setPwdErr('New password must differ from current.'); return }
    setSaving(true)

    // Verify current password using username (no id column)
    const { data: match } = await supabase
      .from('users')
      .select('username')
      .eq('username', user.username)
      .eq('password', pwdForm.current)
      .maybeSingle()

    if (!match) { setPwdErr('Current password is incorrect.'); setSaving(false); return }

    const { error } = await supabase
      .from('users')
      .update({ password: pwdForm.next })
      .eq('username', user.username)

    setSaving(false)
    if (error) { setPwdErr(error.message); return }
    setPwdOk(true)
    setTimeout(() => {
      setShowPwd(false)
      setPwdForm({ current: '', next: '', confirm: '' })
      setPwdOk(false)
    }, 1800)
  }

  const roleLabel = employee?.designation || employee?.role || user?.role || '—'

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-4">
      {/* Avatar */}
      <div className="flex flex-col items-center py-6">
        <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 text-3xl font-bold mb-3">
          {initials(employee?.name ?? user?.username)}
        </div>
        <h1 className="text-xl font-bold text-white">{employee?.name ?? user?.username}</h1>
        <p className="text-amber-400 text-sm font-medium mt-0.5">{roleLabel}</p>
        {company && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Building2 size={13} className="text-slate-500" />
            <p className="text-slate-500 text-xs">{company.name}</p>
          </div>
        )}
        {user?.is_superadmin && (
          <div className="flex items-center gap-1 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
            <BadgeCheck size={13} className="text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold">Super Admin</span>
          </div>
        )}
      </div>

      {/* Info */}
      {employee && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 px-4">
          <InfoRow icon={Phone}    label="Mobile"      value={employee.mobile} />
          <InfoRow icon={Mail}     label="Email"       value={employee.email} />
          <InfoRow icon={MapPin}   label="Department"  value={employee.department} />
          <InfoRow icon={Calendar} label="Joined"      value={fmtDate(employee.joinDate)} />
          <InfoRow icon={User}     label="Employee ID" value={employee.id} />
        </div>
      )}

      {/* Login info */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 px-4">
        <InfoRow icon={User} label="Username" value={user?.username} />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <button
          onClick={() => { setShowPwd(true); setPwdErr(''); setPwdOk(false) }}
          className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-2xl px-4 py-4 text-slate-300 hover:text-white transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
            <KeyRound size={16} className="text-amber-400" />
          </div>
          <span className="font-medium">Change Password</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 bg-slate-800 border border-red-500/20 hover:bg-red-400/10 rounded-2xl px-4 py-4 text-red-400 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-red-400/10 flex items-center justify-center">
            <LogOut size={16} className="text-red-400" />
          </div>
          <span className="font-medium">Sign Out</span>
        </button>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={showPwd}
        onClose={() => setShowPwd(false)}
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
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-green-400/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-green-400 text-3xl">✓</span>
            </div>
            <p className="text-white font-semibold text-lg">Password updated!</p>
            <p className="text-slate-400 text-sm mt-1">You're all set.</p>
          </div>
        ) : (
          <>
            {pwdErr && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-sm">
                <span className="flex-shrink-0 mt-0.5">⚠</span> {pwdErr}
              </div>
            )}
            <Input label="Current Password" type="password" value={pwdForm.current} onChange={pf('current')} placeholder="Current password" />
            <Input label="New Password" type="password" value={pwdForm.next} onChange={pf('next')} placeholder="Min 6 characters" />
            <Input label="Confirm New Password" type="password" value={pwdForm.confirm} onChange={pf('confirm')} placeholder="Repeat new password" />
          </>
        )}
      </Modal>
    </div>
  )
}
