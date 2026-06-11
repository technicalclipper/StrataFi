'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ExternalLink,
  RefreshCw,
  Loader2,
  Activity as ActivityIcon,
  Sparkles,
  ShoppingCart,
  HandCoins,
  Vote,
  Coins,
} from 'lucide-react'
import { LiveBadge } from '@/components/MarketUI'

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

const TYPE_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  mint: { color: 'var(--brand)', icon: <Sparkles size={11} />, label: 'Mint' },
  buy: { color: 'var(--up)', icon: <ShoppingCart size={11} />, label: 'Buy' },
  offer: { color: 'var(--accent-amber)', icon: <HandCoins size={11} />, label: 'Offer' },
  yield: { color: 'var(--up)', icon: <Coins size={11} />, label: 'Yield' },
  vote: { color: 'var(--brand)', icon: <Vote size={11} />, label: 'Vote' },
  sell: { color: 'var(--down)', icon: <ShoppingCart size={11} />, label: 'Sell' },
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

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

  const types = useMemo(
    () => ['all', ...Array.from(new Set(activities.map((a) => a.type)))],
    [activities],
  )
  const filtered = filter === 'all' ? activities : activities.filter((a) => a.type === filter)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of activities) c[a.type] = (c[a.type] || 0) + 1
    return c
  }, [activities])

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">On-Chain Activity</h1>
            <LiveBadge />
          </div>
          <p className="text-[12.5px] text-text-tertiary">
            Every mint, trade, offer, and vote — settled on Mantle Sepolia
          </p>
        </div>
        <button
          onClick={fetchActivity}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-2 border border-border-default rounded-[var(--radius-sm)] text-[12.5px] text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary chips */}
      {activities.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {types.map((t) => {
            const meta = TYPE_META[t]
            const active = filter === t
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-xs)] text-[11px] font-medium border transition-colors capitalize ${
                  active
                    ? 'bg-brand-bg text-brand border-brand-border'
                    : 'bg-surface-2 text-text-secondary border-border-default hover:text-text-primary hover:bg-surface-3'
                }`}
              >
                {t === 'all' ? (
                  <ActivityIcon size={11} />
                ) : (
                  <span style={{ color: active ? undefined : meta?.color }}>{meta?.icon}</span>
                )}
                {t === 'all' ? 'All' : meta?.label || t}
                <span className="tnum text-[10px] text-text-tertiary">
                  {t === 'all' ? activities.length : counts[t] || 0}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {loading && activities.length === 0 ? (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-12 text-center">
          <Loader2 size={24} className="mx-auto mb-3 text-text-tertiary animate-spin" />
          <div className="text-[12.5px] text-text-tertiary">Scanning Mantle Sepolia blocks…</div>
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-surface-2 border border-border-default flex items-center justify-center mx-auto mb-3">
            <ActivityIcon size={20} className="text-text-tertiary" />
          </div>
          <div className="text-[14px] text-text-secondary mb-1">No on-chain activity yet</div>
          <div className="text-[12.5px] text-text-tertiary">
            Mint a parcel or buy shares to see activity here
          </div>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2 border-b border-border-default">
                <th className="text-left px-4 py-2.5 font-medium">Event</th>
                <th className="text-left px-4 py-2.5 font-medium">Parcel</th>
                <th className="text-right px-4 py-2.5 font-medium">Shares</th>
                <th className="text-right px-4 py-2.5 font-medium">Price</th>
                <th className="text-left px-4 py-2.5 font-medium">Address</th>
                <th className="text-right px-4 py-2.5 font-medium">Block</th>
                <th className="px-4 py-2.5 w-10 text-right font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const meta = TYPE_META[a.type]
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.04em] px-2 py-1 rounded-[var(--radius-xs)]"
                        style={{
                          color: meta?.color || 'var(--text-secondary)',
                          backgroundColor: `color-mix(in srgb, ${meta?.color || 'var(--text-secondary)'} 10%, transparent)`,
                        }}
                      >
                        {meta?.icon}
                        {meta?.label || a.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12.5px] font-medium text-text-primary">
                      {a.parcel}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum text-[12.5px] text-text-primary">
                      {a.shares > 0 ? a.shares.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum text-[12.5px] text-text-secondary">
                      {a.price || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <a
                        href={`https://sepolia.mantlescan.xyz/address/${a.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] text-text-secondary hover:text-brand transition-colors"
                      >
                        {a.address
                          ? `${a.address.slice(0, 6)}…${a.address.slice(-4)}`
                          : '—'}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-right tnum font-mono text-[11px] text-text-tertiary">
                      #{a.blockNumber}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`https://sepolia.mantlescan.xyz/tx/${a.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-brand hover:text-brand-hover"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activities.length > 0 && (
        <div className="mt-3 text-[10px] text-text-tertiary text-center">
          All events read directly from Mantle Sepolia · click any row to verify on MantleScan
        </div>
      )}
    </div>
  )
}
