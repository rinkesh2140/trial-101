import { Component } from 'react'
import { HardHat, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App error:', error, info) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-4">
          <HardHat size={32} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-slate-400 text-sm mb-6 max-w-xs">{this.state.error?.message ?? 'Unexpected error'}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 bg-amber-500 text-slate-900 font-bold px-5 py-3 rounded-xl"
        >
          <RefreshCw size={18} /> Reload App
        </button>
      </div>
    )
  }
}
