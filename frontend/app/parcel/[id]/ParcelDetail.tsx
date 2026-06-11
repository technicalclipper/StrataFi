'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ExternalLink,
  Bot,
  ShieldCheck,
  Hexagon,
  Users,
  Diamond,
} from 'lucide-react'
import type { ParcelData } from '@/lib/seed-parcels'
import { Badge } from '@/components/Badge'
import { ShareDistribution } from '@/components/ShareDistribution'
import { OrderTicket } from '@/components/OrderTicket'
import { BuyoutProposals } from '@/components/BuyoutProposals'
import { PriceChart } from '@/components/PriceChart'
import { ParcelHero } from '@/components/ParcelHero'
import { VerificationTheater } from '@/components/VerificationTheater'
import { ParcelActivityFeed } from '@/components/ParcelActivityFeed'
import { AIAnalyst } from '@/components/AIAnalyst'
import { simulateSeries, makeTicker, LAND_TYPE_COLORS } from '@/components/MarketUI'
import { CONTRACTS } from '@/lib/contracts'

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
  const [offerRequest, setOfferRequest] = useState<{ target: string; nonce: number } | null>(null)

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

  // Deterministic market simulation (same as /markets page)
  const sim = simulateSeries(parcel.id, parcel.pricePerShare)
  const ticker = makeTicker(parcel.name, parcel.id)
  const soldPct =
    parcel.totalShares > 0
      ? ((parcel.totalShares - parcel.availableShares) / parcel.totalShares) * 100
      : 0

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="flex h-full">
      {/* Left — main content */}
      <div className="flex-1 overflow-auto p-6 min-w-0">
        {/* Back */}
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to Markets
        </Link>

        {/* ───── Cinematic satellite hero ───── */}
        <ParcelHero
          parcel={parcel}
          ticker={ticker}
          livePrice={sim.livePrice}
          changePct={sim.changePct}
        />

        {/* ───── Trust strip ───── */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            onClick={() => scrollTo('verification-theater')}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-up bg-up-bg border border-up-border rounded-full px-3 py-1 hover:brightness-110 transition-all"
          >
            <ShieldCheck size={11} />
            AI Verified {parcel.confidenceScore}/100
          </button>
          <a
            href={`https://sepolia.mantlescan.xyz/address/${CONTRACTS.shareToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-brand bg-brand-bg border border-brand-border rounded-full px-3 py-1 hover:brightness-110 transition-all"
          >
            <Diamond size={10} />
            Minted on Mantle
            <ExternalLink size={9} />
          </a>
          <span
            title={`Geo hash ${parcel.geoHash}`}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary bg-surface-2 border border-border-default rounded-full px-3 py-1"
          >
            <Hexagon size={10} className="text-brand" />
            Geo-validated
          </span>
          <button
            onClick={() => scrollTo('cap-table')}
            className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-text-secondary bg-surface-2 border border-border-default rounded-full px-3 py-1 hover:border-border-strong transition-colors"
          >
            <Users size={10} />
            {holders.length} holder{holders.length === 1 ? '' : 's'}
          </button>
          <span
            className={`inline-flex items-center text-[10.5px] font-medium uppercase tracking-[0.04em] rounded-full px-3 py-1 ${
              LAND_TYPE_COLORS[parcel.landType] || 'text-text-tertiary bg-surface-3'
            }`}
          >
            {parcel.landType}
          </span>
        </div>

        {/* Stat strip */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-5">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                Market Cap
              </div>
              <div className="tnum text-[14px] font-semibold text-text-primary">
                {(parcel.totalShares * sim.livePrice).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}{' '}
                <span className="text-[10px] font-normal text-text-tertiary">MNT</span>
              </div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                Yield
              </div>
              <div
                className={`tnum text-[14px] font-semibold ${parcel.yieldPct > 0 ? 'text-up' : 'text-text-tertiary'}`}
              >
                {parcel.yieldPct > 0 ? `${parcel.yieldPct}%` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                Shares Sold
              </div>
              <div className="flex items-center gap-2">
                <span className="tnum text-[14px] font-semibold text-text-primary">
                  {soldPct.toFixed(0)}%
                </span>
                <div className="flex-1 max-w-20 h-[3px] rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${soldPct}%` }}
                  />
                </div>
              </div>
              <div className="tnum text-[9.5px] text-text-tertiary mt-0.5">
                {parcel.availableShares}/{parcel.totalShares} available
              </div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                Demand
              </div>
              <Badge variant="demand" demandLevel={parcel.demandScore} />
            </div>
          </div>
        </div>

        {/* Governance moment — buyout proposals up top, full width */}
        <div className="mb-5">
          <BuyoutProposals parcelId={parcel.id} />
        </div>

        {/* Price chart */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
            Price History
          </div>
          <PriceChart
            parcelId={parcel.id}
            currentPrice={parcel.pricePerShare}
            totalShares={parcel.totalShares}
          />
        </div>

        {/* AI Verification Theater */}
        <VerificationTheater parcel={parcel} />

        {/* AI Valuation */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
            <Bot size={11} className="text-brand" /> AI Valuation
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

        {/* Cap table — stacked bar + per-holder offers */}
        <ShareDistribution
          holders={holders}
          totalShares={parcel.totalShares}
          pricePerShare={parcel.pricePerShare}
          onMakeOffer={(target) => setOfferRequest({ target, nonce: Date.now() })}
        />

        {/* On-chain activity feed for this parcel */}
        <ParcelActivityFeed parcelName={parcel.name} />

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

      {/* Middle-right — sticky order ticket */}
      <div className="w-80 border-l border-border-default bg-surface-1/50 p-4 overflow-auto shrink-0">
        <OrderTicket parcel={parcel} onSuccess={refetchParcel} offerRequest={offerRequest} />

        {/* Quick acquire CTA */}
        <Link
          href={`/acquire/${parcel.id}`}
          className="block mt-4 text-center py-2.5 rounded-[var(--radius-sm)] border border-brand-border text-brand text-[12.5px] font-medium hover:bg-brand-bg transition-colors"
        >
          Full Parcel Acquisition
        </Link>
      </div>

      {/* Far-right — AI analyst strip */}
      <div className="w-60 border-l border-border-default bg-bg-sunken/50 p-3.5 overflow-auto shrink-0 hidden xl:block">
        <AIAnalyst parcel={parcel} livePrice={sim.livePrice} />
      </div>
    </div>
  )
}
