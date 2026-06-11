'use client'

/**
 * Shared trading-terminal UI primitives: sparklines, delta chips,
 * ticker derivation, and the deterministic market simulation
 * (seeded by parcel id so it's stable across pages and reloads).
 */

import { useRef } from 'react'

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeTicker(name: string, id: number) {
  return name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || `LND${id}`
}

/** Deterministic 24-point random walk anchored at the listing price. */
export function simulateSeries(id: number, basePrice: number) {
  const rng = mulberry32(id * 7919 + 31)
  const drift = (rng() - 0.42) * 0.012
  const series: number[] = [basePrice]
  for (let i = 1; i < 24; i++) {
    const shock = (rng() - 0.5) * 0.018
    series.push(Math.max(series[i - 1] * (1 + drift + shock), basePrice * 0.7))
  }
  const livePrice = series[series.length - 1]
  const changePct = ((livePrice - series[0]) / series[0]) * 100
  return { series, livePrice, changePct }
}

export function Sparkline({
  data,
  up,
  w = 96,
  h = 30,
}: {
  data: number[]
  up: boolean
  w?: number
  h?: number
}) {
  const gid = useRef(`sg-${Math.random().toString(36).slice(2, 8)}`).current
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - min) / range) * (h - 6)}`,
  )
  const color = up ? 'var(--up)' : 'var(--down)'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={w}
        cy={h - 3 - ((data[data.length - 1] - min) / range) * (h - 6)}
        r="2"
        fill={color}
      />
    </svg>
  )
}

export function DeltaChip({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const up = value >= 0
  const cls = size === 'md' ? 'text-[12.5px] px-2 py-1' : 'text-[11px] px-1.5 py-0.5'
  return (
    <span
      className={`tnum inline-flex items-center gap-1 font-medium rounded-[var(--radius-xs)] ${cls}`}
      style={{
        color: up ? 'var(--up)' : 'var(--down)',
        backgroundColor: up ? 'var(--up-bg)' : 'var(--down-bg)',
      }}
    >
      <span className="text-[9px]">{up ? '\u25B2' : '\u25BC'}</span>
      {up ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

export function ConfidenceCell({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--up)' : score >= 60 ? 'var(--accent-amber)' : 'var(--down)'
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-10 h-[3px] rounded-full bg-surface-3 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="tnum text-[12.5px] font-medium" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

export const LAND_TYPE_COLORS: Record<string, string> = {
  residential: 'text-brand bg-brand-bg',
  commercial: 'text-accent-amber bg-accent-amber-bg',
  agricultural: 'text-up bg-up-bg',
}

export const DEMAND_HEAT: Record<number, string> = {
  1: 'var(--heat-1)',
  2: 'var(--heat-2)',
  3: 'var(--heat-3)',
  4: 'var(--heat-4)',
  5: 'var(--heat-5)',
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-up bg-up-bg px-2 py-0.5 rounded-full">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-up opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-up" />
      </span>
      LIVE
    </span>
  )
}
