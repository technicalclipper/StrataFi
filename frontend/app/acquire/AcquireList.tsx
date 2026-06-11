'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Target, ShieldCheck, ArrowRight, Crosshair } from 'lucide-react'
import type { ParcelData } from '@/lib/seed-parcels'
import {
  Sparkline,
  DeltaChip,
  simulateSeries,
  makeTicker,
  LAND_TYPE_COLORS,
} from '@/components/MarketUI'

export function AcquireList() {
  const [parcels, setParcels] = useState<ParcelData[]>([])

  useEffect(() => {
    fetch('/api/parcels')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setParcels(data)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-brand-bg flex items-center justify-center">
          <Crosshair size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] leading-tight">
            Full Parcel Acquisition
          </h1>
          <p className="text-[11px] text-text-tertiary">
            Tender-offer style takeovers — AI plans the cheapest path to 51% and 100%
          </p>
        </div>
      </div>

      {/* How it works strip */}
      <div className="grid grid-cols-3 gap-3 my-6">
        {[
          { n: '01', t: 'Sweep listed shares', d: 'Instantly buy everything on the market' },
          { n: '02', t: 'AI per-holder offers', d: 'Simultaneous escrowed bids, ranked by sell-probability' },
          { n: '03', t: '51% → squeeze-out', d: 'Governance vote pays out the minority automatically' },
        ].map((s) => (
          <div
            key={s.n}
            className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3.5"
          >
            <div className="tnum text-[10px] font-mono text-brand mb-1.5">{s.n}</div>
            <div className="text-[12px] font-medium text-text-primary mb-0.5">{s.t}</div>
            <div className="text-[10.5px] text-text-tertiary leading-relaxed">{s.d}</div>
          </div>
        ))}
      </div>

      {parcels.length === 0 ? (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-10 text-center">
          <Target size={32} className="mx-auto mb-3 text-text-tertiary" />
          <div className="text-[14px] text-text-secondary mb-2">No parcels available</div>
          <Link href="/list" className="text-[12.5px] text-brand hover:text-brand-hover">
            List a parcel first &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {parcels.map((parcel) => {
            const sim = simulateSeries(parcel.id, parcel.pricePerShare)
            const ticker = makeTicker(parcel.name, parcel.id)
            const pctSold =
              ((parcel.totalShares - parcel.availableShares) / parcel.totalShares) * 100
            const costTo51 = Math.ceil(parcel.totalShares * 0.51) * sim.livePrice
            const costTo100 = parcel.totalShares * sim.livePrice
            return (
              <Link
                key={parcel.id}
                href={`/acquire/${parcel.id}`}
                className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 hover:border-border-strong hover:bg-surface-2 transition-all group"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-text-primary group-hover:text-brand transition-colors">
                      {ticker}
                    </span>
                    {parcel.verified && <ShieldCheck size={12} className="text-verify" />}
                    <span
                      className={`text-[8.5px] font-medium uppercase tracking-[0.05em] px-1.5 py-px rounded-[var(--radius-xs)] ${
                        LAND_TYPE_COLORS[parcel.landType] || 'text-text-tertiary bg-surface-3'
                      }`}
                    >
                      {parcel.landType}
                    </span>
                  </div>
                  <DeltaChip value={sim.changePct} />
                </div>
                <div className="text-[10.5px] text-text-tertiary mb-3">
                  {parcel.name} · {parcel.location}
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="tnum text-[18px] font-semibold text-text-primary leading-none">
                      {sim.livePrice.toFixed(3)}
                      <span className="text-[10px] font-normal text-text-tertiary ml-1">
                        MNT/share
                      </span>
                    </div>
                  </div>
                  <Sparkline data={sim.series} up={sim.changePct >= 0} w={90} h={28} />
                </div>

                {/* Acquisition economics */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-bg-sunken rounded-[var(--radius-xs)] px-2.5 py-2">
                    <div className="text-[8.5px] uppercase tracking-[0.06em] text-text-tertiary mb-0.5">
                      Cost to 51%
                    </div>
                    <div className="tnum text-[12px] font-semibold text-brand">
                      {costTo51.toLocaleString(undefined, { maximumFractionDigits: 1 })} MNT
                    </div>
                  </div>
                  <div className="bg-bg-sunken rounded-[var(--radius-xs)] px-2.5 py-2">
                    <div className="text-[8.5px] uppercase tracking-[0.06em] text-text-tertiary mb-0.5">
                      Cost to 100%
                    </div>
                    <div className="tnum text-[12px] font-semibold text-text-primary">
                      {costTo100.toLocaleString(undefined, { maximumFractionDigits: 1 })} MNT
                    </div>
                  </div>
                </div>

                {/* Distribution bar */}
                <div className="flex items-center justify-between text-[9.5px] text-text-tertiary mb-1">
                  <span>
                    Distributed <span className="tnum text-text-secondary">{pctSold.toFixed(0)}%</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-brand opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Plan acquisition <ArrowRight size={10} />
                  </span>
                </div>
                <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${pctSold}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
