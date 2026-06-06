'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type PricePoint = {
  block: number
  price: number
  amount: number
  type: string
}

export function PriceChart({ parcelId, currentPrice, totalShares }: { parcelId: number; currentPrice: number; totalShares?: number }) {
  const [points, setPoints] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/price-history?parcelId=${parcelId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setPoints(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [parcelId])

  // Build points: listing price as origin + real trades
  // Compute demand-adjusted market price: cumulative buying pressure pushes price up
  const supply = totalShares || 100
  let cumVolume = 0
  const adjustedPoints: PricePoint[] = [
    { block: 0, price: currentPrice, amount: 0, type: 'listing' },
  ]
  for (const p of points) {
    cumVolume += p.amount
    // Market price rises with demand: up to +25% when all shares are sold
    const demandMultiplier = 1 + (cumVolume / supply) * 0.25
    adjustedPoints.push({
      ...p,
      price: parseFloat((p.price * demandMultiplier).toFixed(6)),
    })
  }
  const allPoints = adjustedPoints

  if (loading) {
    return (
      <div className="h-48 bg-bg-sunken rounded-[var(--radius-sm)] flex items-center justify-center">
        <span className="text-[12.5px] text-text-tertiary animate-pulse">Loading price data...</span>
      </div>
    )
  }

  if (allPoints.length < 2) {
    // Show a flat line at current price
    return (
      <div className="h-48 bg-bg-sunken rounded-[var(--radius-sm)] relative overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 400 180" preserveAspectRatio="none">
          <line x1="20" y1="90" x2="380" y2="90" stroke="var(--brand)" strokeWidth="2" strokeDasharray="4,4" />
          <circle cx="380" cy="90" r="4" fill="var(--brand)" />
        </svg>
        <div className="absolute bottom-2 left-3 text-[10px] text-text-tertiary">
          Listing price: {currentPrice} MNT — waiting for trades
        </div>
      </div>
    )
  }

  // Build chart from real trade data
  const prices = allPoints.map((p) => p.price)
  const rawMin = Math.min(...prices)
  const rawMax = Math.max(...prices)
  // If all prices are the same, create a range around the price so the line shows mid-chart
  const minPrice = rawMin === rawMax ? rawMin * 0.9 : rawMin * 0.95
  const maxPrice = rawMin === rawMax ? rawMax * 1.1 : rawMax * 1.05
  const priceRange = maxPrice - minPrice || 1

  const W = 400
  const H = 160
  const PAD_X = 10
  const PAD_Y = 10
  const chartW = W - PAD_X * 2
  const chartH = H - PAD_Y * 2

  const xScale = (i: number) => PAD_X + (i / (allPoints.length - 1)) * chartW
  const yScale = (price: number) => PAD_Y + chartH - ((price - minPrice) / priceRange) * chartH

  const pathPoints = allPoints.map((p, i) => `${xScale(i)},${yScale(p.price)}`)
  const linePath = `M ${pathPoints.join(' L ')}`
  const areaPath = `${linePath} L ${xScale(allPoints.length - 1)},${H} L ${xScale(0)},${H} Z`

  const firstPrice = allPoints[0].price
  const lastPrice = allPoints[allPoints.length - 1].price
  const change = lastPrice - firstPrice
  const changePct = firstPrice > 0 ? (change / firstPrice) * 100 : 0
  const isUp = change >= 0
  const color = isUp ? 'var(--up)' : 'var(--down)'

  return (
    <div className="h-48 bg-bg-sunken rounded-[var(--radius-sm)] relative overflow-hidden">
      {/* Summary */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="tnum text-[14px] font-semibold" style={{ color }}>
          {lastPrice.toFixed(4)} MNT
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color }}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isUp ? '+' : ''}{changePct.toFixed(1)}%
        </span>
      </div>
      <div className="absolute top-2 right-3 z-10 text-[9px] text-text-tertiary">
        {allPoints.length} trades
      </div>

      {/* SVG Chart */}
      <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={PAD_X}
            y1={PAD_Y + chartH * frac}
            x2={W - PAD_X}
            y2={PAD_Y + chartH * frac}
            stroke="var(--border-subtle)"
            strokeWidth="0.5"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={color} opacity="0.08" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {/* Volume bars */}
        {(() => {
          const maxAmt = Math.max(...allPoints.map(p => p.amount), 1)
          return allPoints.map((p, i) => {
            if (p.amount <= 0) return null
            const barH = (p.amount / maxAmt) * 30
            return (
              <rect
                key={`vol-${i}`}
                x={xScale(i) - 4}
                y={H - barH}
                width={8}
                height={barH}
                fill={color}
                opacity="0.2"
                rx="1"
              />
            )
          })
        })()}

        {/* Trade dots */}
        {allPoints.map((p, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(p.price)}
            r="3"
            fill={color}
            stroke="var(--bg-base)"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Price labels */}
      <div className="absolute bottom-1 left-3 text-[9px] tnum text-text-tertiary">
        {minPrice.toFixed(3)}
      </div>
      <div className="absolute top-8 left-3 text-[9px] tnum text-text-tertiary">
        {maxPrice.toFixed(3)}
      </div>
    </div>
  )
}
