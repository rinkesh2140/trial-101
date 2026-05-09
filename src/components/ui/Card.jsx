export default function Card({ children, className = '', onClick, noPad = false }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-slate-800 rounded-2xl border border-slate-700/50
        ${noPad ? '' : 'p-4'}
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'text-amber-400' }) {
  return (
    <Card className="flex items-center gap-3">
      {Icon && (
        <div className={`w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-sm text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}
