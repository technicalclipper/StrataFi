'use client'

/**
 * AI Analyst strip — fair-value gauge, yield forecast, parcel-specific
 * insights, live-accruing yield counter, and a scripted "ask AI" box.
 * All derived client-side from parcel data (labeled as demo analysis).
 */

import { useEffect, useMemo, useState } from 'react'
import type { ParcelData } from '@/lib/seed-parcels'
import { mulberry32, Sparkline } from '@/components/MarketUI'
import { Bot, Send } from 'lucide-react'

function buildAnswer(q: string, p: ParcelData, livePrice: number): string {
  const s = q.toLowerCase()
  if (s.includes('yield') || s.includes('income') || s.includes('rent'))
    return `This parcel projects ${p.yieldPct}% annual yield from lease income. On 10 shares (${((10 / p.totalShares) * 100).toFixed(2)}% ownership) that's roughly ${((10 * livePrice * p.yieldPct) / 100).toFixed(4)} MNT/yr, claimable any time via the YieldSplitter contract.`
  if (s.includes('buy') || s.includes('worth') || s.includes('invest'))
    return `${p.availableShares} of ${p.totalShares} shares remain at ~${livePrice.toFixed(3)} MNT. Demand is ${p.demandScore}/5 and AI confidence is ${p.confidenceScore}/100 — ${p.demandScore >= 4 ? 'supply is tightening; entries near the listing price look favorable' : 'demand is moderate; there is no urgency premium at current prices'}.`
  if (s.includes('risk') || s.includes('safe'))
    return `Verification scored ${p.confidenceScore}/100: deed fields matched the registry, geo-boundary shows no overlaps, and valuation sits within the comparable range for ${p.location}. Main residual risk is liquidity — fractional land trades thinner than listed equities.`
  return `${p.name} (${p.landType}, ${p.areaSqFt.toLocaleString()} sq ft in ${p.location}) trades at ${livePrice.toFixed(3)} MNT/share with ${p.yieldPct}% projected yield and demand ${p.demandScore}/5. AI confidence: ${p.confidenceScore}/100.`
}

export function AIAnalyst({
  parcel,
  livePrice,
}: {
  parcel: ParcelData
  livePrice: number
}) {
  // AI fair-value band (deterministic per parcel)
  const { lo, hi, fair } = useMemo(() => {
    const rng = mulberry32(parcel.id * 433 + 17)
    const lo = parcel.pricePerShare * (0.88 + rng() * 0.05)
    const hi = parcel.pricePerShare * (1.08 + rng() * 0.1)
    return { lo, hi, fair: (lo + hi) / 2 }
  }, [parcel.id, parcel.pricePerShare])

  const pos = Math.min(Math.max((livePrice - lo) / (hi - lo), 0), 1)
  const vsFair = ((livePrice - fair) / fair) * 100

  // yield forecast mini-series (seeded, gently rising)
  const forecast = useMemo(() => {
    const rng = mulberry32(parcel.id * 911 + 3)
    const out: number[] = [parcel.yieldPct]
    for (let i = 1; i < 12; i++)
      out.push(Math.max(0.5, out[i - 1] + (rng() - 0.42) * 0.4))
    return out
  }, [parcel.id, parcel.yieldPct])

  // live-accruing parcel yield counter (annual yield streamed per second)
  const perSecond = (parcel.totalShares * livePrice * (parcel.yieldPct / 100)) / (365 * 24 * 3600)
  const [accrued, setAccrued] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const iv = setInterval(() => setAccrued(((Date.now() - start) / 1000) * perSecond), 120)
    return () => clearInterval(iv)
  }, [perSecond])

  const insights = useMemo(
    () => [
      vsFair < 0
        ? `Trading ${Math.abs(vsFair).toFixed(1)}% below AI fair value — accumulation zone.`
        : `Trading ${vsFair.toFixed(1)}% above AI fair value — momentum priced in.`,
      parcel.demandScore >= 4
        ? `Demand ${parcel.demandScore}/5 — among the hottest zones on the map.`
        : `Demand ${parcel.demandScore}/5 — quieter zone, wider entry spreads.`,
      `${(((parcel.totalShares - parcel.availableShares) / parcel.totalShares) * 100).toFixed(0)}% of supply already distributed across holders.`,
    ],
    [vsFair, parcel],
  )

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    if (!answer) return
    setTyped(0)
    const iv = setInterval(() => {
      setTyped((t) => {
        if (t >= answer.length) {
          clearInterval(iv)
          return t
        }
        return t + 2
      })
    }, 18)
    return () => clearInterval(iv)
  }, [answer])

  const ask = () => {
    if (!question.trim()) return
    setAnswer(buildAnswer(question, parcel, livePrice))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
        <Bot size={11} className="text-brand" /> AI Analyst
      </div>

      {/* Fair-value gauge */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3">
        <div className="text-[9px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
          Fair-value band
        </div>
        <div className="relative h-2 rounded-full mb-1.5"
          style={{
            background:
              'linear-gradient(to right, var(--up) 0%, var(--accent-amber) 55%, var(--down) 100%)',
            opacity: 0.85,
          }}
        >
          <div
            className="absolute -top-1 w-1 h-4 rounded-full bg-text-primary shadow-[var(--shadow-sm)]"
            style={{ left: `calc(${pos * 100}% - 2px)`, transition: 'left 320ms var(--ease-out)' }}
          />
        </div>
        <div className="flex justify-between tnum text-[9px] text-text-tertiary mb-2">
          <span>{lo.toFixed(3)}</span>
          <span>{hi.toFixed(3)} MNT</span>
        </div>
        <div className="text-[11px] font-medium" style={{ color: vsFair < 0 ? 'var(--up)' : 'var(--accent-amber)' }}>
          {vsFair < 0
            ? `${Math.abs(vsFair).toFixed(1)}% below AI fair value`
            : `${vsFair.toFixed(1)}% above AI fair value`}
        </div>
      </div>

      {/* Yield forecast */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
            Yield forecast · 12mo
          </span>
          <span className="tnum text-[11px] font-semibold text-up">
            {forecast[forecast.length - 1].toFixed(1)}%
          </span>
        </div>
        <Sparkline data={forecast} up={forecast[forecast.length - 1] >= forecast[0]} w={170} h={32} />
      </div>

      {/* Accruing yield counter */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3">
        <div className="text-[9px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
          Parcel yield accruing
        </div>
        <div className="tnum text-[15px] font-semibold text-up leading-none">
          +{accrued.toFixed(7)}
          <span className="text-[9px] font-normal text-text-tertiary ml-1">MNT this visit</span>
        </div>
        <div className="text-[9px] text-text-tertiary mt-1">
          {parcel.yieldPct}% APY streamed across all shares
        </div>
      </div>

      {/* Insights */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3 space-y-2">
        {insights.map((line) => (
          <div key={line} className="flex gap-1.5 text-[10.5px] text-text-secondary leading-relaxed">
            <span className="text-brand shrink-0">◆</span>
            {line}
          </div>
        ))}
      </div>

      {/* Ask AI */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3">
        <div className="text-[9px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
          Ask AI about this parcel
        </div>
        <div className="flex items-center gap-1.5 bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-2 py-1.5 focus-within:border-brand transition-colors">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Is the yield sustainable?"
            className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary outline-none min-w-0"
          />
          <button onClick={ask} className="text-brand hover:text-brand-hover shrink-0">
            <Send size={12} />
          </button>
        </div>
        {answer && (
          <div className="mt-2 text-[10.5px] text-text-secondary leading-relaxed font-mono bg-bg-sunken rounded-[var(--radius-sm)] p-2">
            {answer.slice(0, typed)}
            {typed < answer.length && <span className="caret text-brand">_</span>}
          </div>
        )}
        <div className="text-[8.5px] text-text-tertiary mt-1.5">
          Demo: scripted from parcel data
        </div>
      </div>
    </div>
  )
}
