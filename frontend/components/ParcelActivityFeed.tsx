'use client'

/**
 * Per-parcel on-chain activity feed. Reuses the existing /api/activity
 * endpoint and filters client-side to this parcel — no backend changes.
 */

import { useEffect, useState } from 'react'
import { ExternalLink, Activity as ActivityIcon } from 'lucide-react'
import { LiveBadge } from '@/components/MarketUI'

type ActivityEvent = {
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
  sell: 'var(--accent-amber)',
  offer: 'var(--heat-2)',
  yield: 'var(--up)',
  vote: 'var(--heat-4)',
}

export function ParcelActivityFeed({ parcelName }: { parcelName: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/activity')
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !Array.isArray(data)) return
          setEvents(
            data.filter((e: ActivityEvent) => e.parcel === parcelName).slice(0, 12),
          )
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    load()
    const iv = setInterval(load, 45000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [parcelName])

  return (
    <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
          <ActivityIcon size={11} className="text-brand" /> On-chain Activity
        </div>
        <LiveBadge />
      </div>

      {loading ? (
        <div className="text-[11px] text-text-tertiary animate-pulse py-4 text-center">
          Reading Mantle event logs…
        </div>
      ) : events.length === 0 ? (
        <div className="text-[11.5px] text-text-tertiary py-4 text-center">
          No on-chain events for this parcel yet.
        </div>
      ) : (
        <div className="font-mono">
          {events.map((e) => {
            const color = TYPE_COLORS[e.type] || 'var(--text-secondary)'
            return (
              <a
                key={e.id}
                href={`https://sepolia.mantlescan.xyz/tx/${e.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="feed-in flex items-center justify-between py-1.5 border-b border-border-subtle last:border-b-0 hover:bg-surface-2 transition-colors px-1 rounded-[var(--radius-xs)] group"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[8.5px] font-semibold uppercase px-1.5 py-px rounded-[var(--radius-xs)] w-12 text-center"
                    style={{
                      color,
                      backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                    }}
                  >
                    {e.type}
                  </span>
                  <span className="text-[10.5px] text-text-secondary">
                    {e.shares > 0 ? `${e.shares} sh` : '—'}
                    {e.price ? ` · ${e.price}` : ''}
                  </span>
                  {e.address && (
                    <span className="text-[10px] text-text-tertiary">{e.address}</span>
                  )}
                </div>
                <span className="tnum flex items-center gap-1.5 text-[9.5px] text-text-tertiary">
                  #{e.blockNumber}
                  <ExternalLink
                    size={9}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-brand"
                  />
                </span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
