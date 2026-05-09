const VARIANTS = {
  primary:   'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900 font-bold',
  danger:    'bg-red-500 hover:bg-red-400 active:bg-red-600 text-white font-bold',
  success:   'bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-bold',
  secondary: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white font-semibold',
  ghost:     'bg-transparent hover:bg-slate-700 text-slate-300 font-semibold',
  outline:   'bg-transparent border border-slate-600 hover:border-slate-400 text-slate-300 font-semibold',
}

const SIZES = {
  sm:  'px-3 py-1.5 text-sm rounded-lg min-h-[36px]',
  md:  'px-4 py-2.5 text-base rounded-xl min-h-[44px]',
  lg:  'px-5 py-3.5 text-base rounded-xl min-h-[52px]',
  xl:  'px-6 py-4 text-lg rounded-2xl min-h-[60px]',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  className = '', disabled = false, loading = false,
  fullWidth = false, ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed select-none
        ${VARIANTS[variant]} ${SIZES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : children}
    </button>
  )
}
