'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw, Loader2 } from 'lucide-react'

type Activity = {
  id: string
  type: string
  parcel: string
  shares: number
  address: string
  txHash: string
  blockNumber: string
  price?: string
}

const TYPE_COLORS: Record<string, string> = {
  mint: 'var(--brand)',
  buy: 'var(--up)',
  offer: 'var(--accent-amber)',
  yield: 'var(--up)',
  vote: 'var(--brand)',
  sell: 'var(--down)',
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivity = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/activity')
      const data = await res.json()
      if (Array.isArray(data)) setActivities(data)
    } catch {
      // keep current
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivity()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight">Activity</h1>
        <button
          onClick={fetchActivity}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && activities.length === 0 ? (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-12 text-center">
          <Loader2 size={24} className="mx-auto mb-3 text-text-tertiary animate-spin" />
          <div className="text-[12.5px] text-text-tertiary">Loading on-chain activity...</div>
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-12 text-center">
          <div className="text-[14px] text-text-secondary mb-1">No on-chain activity yet</div>
          <div className="text-[12.5px] text-text-tertiary">
            Mint a parcel or buy shares to see activity here
          </div>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2">
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Parcel</th>
                <th className="text-right px-4 py-2 font-medium">Shares</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-left px-4 py-2 font-medium">Address</th>
                <th className="text-right px-4 py-2 font-medium">Block</th>
                <th className="px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full"
                      style={{
                        color: TYPE_COLORS[a.type] || 'var(--text-secondary)',
                        backgroundColor: `${TYPE_COLORS[a.type] || 'var(--text-secondary)'}18`,
                      }}
                    >
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-text-primary">
                    {a.parcel}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-[12.5px] text-text-primary">
                    {a.shares > 0 ? a.shares : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-[12.5px] text-text-secondary">
                    {a.price || '-'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-text-secondary">
                    {a.address || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] font-mono text-text-tertiary">
                    {a.blockNumber}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={`https://sepolia.mantlescan.xyz/tx/${a.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-hover"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
