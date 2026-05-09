export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        {...props}
        className={`
          w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base
          border border-slate-600 placeholder-slate-500
          focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <select
        {...props}
        className={`
          w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base
          border border-slate-600
          focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
          disabled:opacity-50
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <textarea
        {...props}
        className={`
          w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base
          border border-slate-600 placeholder-slate-500 resize-none
          focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
