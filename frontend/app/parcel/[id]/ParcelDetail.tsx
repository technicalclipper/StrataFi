'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react'
import type { ParcelData } from '@/lib/seed-parcels'
import { Badge } from '@/components/Badge'
import { ConfidenceMeter } from '@/components/ConfidenceMeter'
import { ShareDistribution } from '@/components/ShareDistribution'
import { OrderTicket } from '@/components/OrderTicket'
import { Delta } from '@/components/Delta'
import { BuyoutProposals } from '@/components/BuyoutProposals'
import { PriceChart } from '@/components/PriceChart'

type Holder = {
  address: string
  shares: number
  percentage: number
}

export function ParcelDetail({
  parcel: initialParcel,
  holders: initialHolders,
}: {
  parcel: ParcelData
  holders: Holder[]
}) {
  const [parcel, setParcel] = useState(initialParcel)
  const [holders, setHolders] = useState(initialHolders)

  // Fetch live on-chain data (availableShares + real holder addresses)
  const refetchParcel = useCallback(async () => {
    try {
      const [parcelsRes, holdersRes] = await Promise.all([
        fetch('/api/parcels'),
        fetch(`/api/holders?parcelId=${initialParcel.id}`),
      ])
      const parcels = await parcelsRes.json()
      const holdersData = await holdersRes.json()

      if (Array.isArray(parcels)) {
        const live = parcels.find((p: ParcelData) => p.id === initialParcel.id)
        if (live) setParcel(live)
      }

      if (Array.isArray(holdersData) && holdersData.length > 0) {
        const totalShares = initialParcel.totalShares
        setHolders(
          holdersData
            .filter((h: { role?: string }) => h.role !== 'deployer')
            .map((h: { address: string; shares: number }) => ({
              address: h.address,
              shares: h.shares,
              percentage: (h.shares / totalShares) * 100,
            })),
        )
      }
    } catch {
      // Keep current data on error
    }
  }, [initialParcel.id, initialParcel.totalShares])

  // Fetch live data on mount
  useEffect(() => {
    refetchParcel()
  }, [refetchParcel])

  // Mock price history for sparkline area
  const mockPriceChange = ((parcel.demandScore - 3) / 3) * 12.5

  return (
    <div className="flex h-full">
      {/* Left — main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to Map
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[26px] font-semibold tracking-tight">
              {parcel.name}
            </h1>
            {parcel.verified && <Badge variant="verified" />}
            <Badge variant="on-chain" />
          </div>
          <div className="flex items-center gap-4 text-[12.5px] text-text-secondary">
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {parcel.location}
            </span>
            <span className="tnum font-mono text-[11px] text-text-tertiary">
              {parcel.coordinates[1].toFixed(6)}, {parcel.coordinates[0].toFixed(6)}
            </span>
            <Badge variant="demand" demandLevel={parcel.demandScore} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Price / Share',
              value: `${parcel.pricePerShare} MNT`,
              delta: mockPriceChange,
            },
            {
              label: 'Yield',
              value: `${parcel.yieldPct}%`,
              delta: parcel.yieldPct > 7 ? 2.1 : -0.8,
            },
            {
              label: 'Shares Available',
              value: `${parcel.availableShares} / ${parcel.totalShares}`,
              delta: null,
            },
            {
              label: 'Market Cap',
              value: `${(parcel.totalShares * parcel.pricePerShare).toFixed(1)} MNT`,
              delta: mockPriceChange,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4"
            >
              <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                {stat.label}
              </div>
              <div className="flex items-center gap-2">
                <span className="tnum text-[16px] font-semibold text-text-primary">
                  {stat.value}
                </span>
                {stat.delta !== null && <Delta value={stat.delta} showBg />}
              </div>
            </div>
          ))}
        </div>

        {/* Price chart */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
            Price History
          </div>
          <PriceChart parcelId={parcel.id} currentPrice={parcel.pricePerShare} totalShares={parcel.totalShares} />
        </div>

        {/* AI Valuation */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
            AI Valuation
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-[10px] text-text-tertiary mb-0.5">Suggested Price</div>
              <div className="tnum text-[14px] font-semibold text-text-primary">
                {parcel.pricePerShare} MNT
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary mb-0.5">Est. Yield</div>
              <div className="tnum text-[14px] font-semibold text-up">
                {parcel.yieldPct}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary mb-0.5">Land Type</div>
              <div className="text-[14px] font-medium text-text-primary capitalize">
                {parcel.landType}
              </div>
            </div>
          </div>
          <div className="text-[12.5px] text-text-secondary leading-relaxed bg-bg-sunken rounded-[var(--radius-sm)] p-3">
            Based on location analysis, nearby infrastructure, and comparable land sales
            in {parcel.location}, this parcel is valued at {parcel.pricePerShare} MNT per
            share with a projected annual yield of {parcel.yieldPct}%. The{' '}
            {parcel.landType} classification and {parcel.areaSqFt.toLocaleString()} sq ft
            area support this valuation.
          </div>
        </div>

        {/* Confidence meter */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
          <ConfidenceMeter
            score={parcel.confidenceScore}
            rationale="Document verified, geo-boundaries validated, valuation within market range."
          />
        </div>

        {/* Cap table */}
        <ShareDistribution holders={holders} totalShares={parcel.totalShares} />

        {/* Buyout Proposals / Governance */}
        <div className="mt-6">
          <BuyoutProposals parcelId={parcel.id} />
        </div>

        {/* Parcel info */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mt-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
            Parcel Info
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-text-tertiary">Area</span>
              <span className="tnum text-text-primary">
                {parcel.areaSqFt.toLocaleString()} sq ft
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Land Type</span>
              <span className="text-text-primary capitalize">{parcel.landType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Doc Hash</span>
              <span className="font-mono text-[11px] text-text-secondary">
                {parcel.docHash}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-tertiary">Geo Hash</span>
              <span className="font-mono text-[11px] text-text-secondary">
                {parcel.geoHash}
              </span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-text-tertiary">Seller</span>
              <a
                href={`https://sepolia.mantlescan.xyz/address/${parcel.seller}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-brand hover:text-brand-hover inline-flex items-center gap-1"
              >
                {parcel.seller.slice(0, 10)}...{parcel.seller.slice(-8)}
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right — context panel (order ticket) */}
      <div className="w-80 border-l border-border-default bg-surface-1/50 p-4 overflow-auto shrink-0">
        <OrderTicket parcel={parcel} onSuccess={refetchParcel} />

        {/* Quick acquire CTA */}
        <Link
          href={`/acquire/${parcel.id}`}
          className="block mt-4 text-center py-2.5 rounded-[var(--radius-sm)] border border-brand-border text-brand text-[12.5px] font-medium hover:bg-brand-bg transition-colors"
        >
          Full Parcel Acquisition
        </Link>
      </div>
    </div>
  )
}
