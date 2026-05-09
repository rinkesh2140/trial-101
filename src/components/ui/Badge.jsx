const VARIANTS = {
  amber:  'bg-amber-400/15 text-amber-300 border-amber-400/20',
  green:  'bg-green-400/15 text-green-300 border-green-400/20',
  red:    'bg-red-400/15 text-red-300 border-red-400/20',
  blue:   'bg-blue-400/15 text-blue-300 border-blue-400/20',
  orange: 'bg-orange-400/15 text-orange-300 border-orange-400/20',
  slate:  'bg-slate-400/15 text-slate-300 border-slate-400/20',
  purple: 'bg-purple-400/15 text-purple-300 border-purple-400/20',
}

export default function Badge({ children, variant = 'slate', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${VARIANTS[variant] ?? VARIANTS.slate} ${className}`}>
      {children}
    </span>
  )
}
