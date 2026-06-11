'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { mulberry32 } from '@/components/MarketUI'
import { ArrowRight, Users } from 'lucide-react'

type Holder = {
  address: string
  shares: number
  percentage: number
}

const SEGMENT_COLORS = ['#4D7CFE', '#1FCC8B', '#F5C518', '#FF8A3D', '#FF5C5C', '#9BA1AC']

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function ShareDistribution({
  holders,
  totalShares,
  pricePerShare,
  onMakeOffer,
}: {
  holders: Holder[]
  totalShares: number
  pricePerShare?: number
  onMakeOffer?: (address: string) => void
}) {
  const { address: myAddress } = useAccount()
  const [hovered, setHovered] = useState<string | null>(null)

  const isMe = (addr: string) =>
    !!myAddress && addr.toLowerCase() === myAddress.toLowerCase()

  // Simulated average entry price per holder (display only, seeded & stable)
  const avgEntry = (addr: string) => {
    if (!pricePerShare) return null
    const seed = addr
      .slice(2, 10)
      .split('')
      .reduce((a, c) => a + c.charCodeAt(0), 0)
    return pricePerShare * (0.92 + mulberry32(seed)() * 0.18)
  }

  return (
    <div id="cap-table" className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
        <Users size={11} className="text-brand" /> Cap Table
        <span className="tnum normal-case tracking-normal ml-auto text-text-tertiary">
          {holders.length} holder{holders.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Stacked ownership bar — hover to identify */}
      <div className="flex h-2.5 rounded-full overflow-hidden mb-1.5 bg-surface-2">
        {holders.map((h, i) => (
          <div
            key={h.address}
            onMouseEnter={() => setHovered(h.address)}
            onMouseLeave={() => setHovered(null)}
            className="h-full transition-all cursor-pointer"
            style={{
              width: `${h.percentage}%`,
              backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              opacity: hovered && hovered !== h.address ? 0.25 : 1,
              boxShadow: isMe(h.address)
                ? `0 0 8px ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`
                : undefined,
            }}
          />
        ))}
      </div>
      <div className="h-4 mb-3 text-[10px] font-mono text-text-secondary">
        {hovered && (
          <>
            {truncateAddress(hovered)}
            {isMe(hovered) && <span className="text-brand font-semibold"> · YOU</span>} ·{' '}
            <span className="tnum">
              {holders.find((h) => h.address === hovered)?.percentage.toFixed(1)}%
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary border-b border-border-subtle">
            <th className="text-left py-1.5 font-medium">Holder</th>
            <th className="text-right py-1.5 font-medium">Shares</th>
            <th className="text-right py-1.5 font-medium">%</th>
            {pricePerShare && (
              <th className="text-right py-1.5 font-medium">Avg Entry</th>
            )}
            {onMakeOffer && <th className="py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {holders.map((h, i) => {
            const entry = avgEntry(h.address)
            const me = isMe(h.address)
            return (
              <tr
                key={h.address}
                onMouseEnter={() => setHovered(h.address)}
                onMouseLeave={() => setHovered(null)}
                className={`text-[12.5px] border-b border-border-subtle last:border-0 transition-colors group ${
                  me ? 'bg-brand-bg/40' : 'hover:bg-surface-3'
                }`}
              >
                <td className="py-2 font-mono text-text-secondary">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                    />
                    {truncateAddress(h.address)}
                    {me && (
                      <span className="text-[8.5px] font-sans font-semibold text-brand bg-brand-bg px-1.5 py-px rounded-full">
                        YOU
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2 text-right tnum text-text-primary">{h.shares}</td>
                <td className="py-2 text-right tnum text-text-secondary">
                  {h.percentage.toFixed(1)}%
                </td>
                {pricePerShare && (
                  <td className="py-2 text-right tnum text-text-tertiary text-[11.5px]">
                    {entry ? `${entry.toFixed(3)}` : '—'}
                  </td>
                )}
                {onMakeOffer && (
                  <td className="py-2 text-right">
                    {!me && (
                      <button
                        onClick={() => onMakeOffer(h.address)}
                        className="inline-flex items-center gap-1 text-[10.5px] font-medium text-brand opacity-0 group-hover:opacity-100 hover:text-brand-hover transition-all"
                      >
                        Make offer <ArrowRight size={10} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="text-[10px] text-text-tertiary mt-2 tnum">
        Total: {totalShares} shares
        {pricePerShare && (
          <span className="ml-2 text-text-tertiary/70">· avg entry simulated for demo</span>
        )}
      </div>
    </div>
  )
}
