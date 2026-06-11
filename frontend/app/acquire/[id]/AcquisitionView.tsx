'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ArrowLeft, Bot, Loader2, Send, Vote, CheckCircle2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { ParcelData } from '@/lib/seed-parcels'
import { Badge } from '@/components/Badge'
import { useCreateOffer, useProposeBuyout, useShareBalance } from '@/hooks/useContracts'

type Holder = {
  address: string
  shares: number
  pct: number
  label: string
}

type OfferPlan = {
  address: string
  shares: number
  suggestedPrice: number
  sellProbability: string
  reasoning: string
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function AcquisitionView({
  parcel: initialParcel,
  holders: initialHolders,
}: {
  parcel: ParcelData
  holders: Holder[]
}) {
  const { address } = useAccount()
  const offerTx = useCreateOffer()
  const buyoutTx = useProposeBuyout()
  const { data: myShares } = useShareBalance(initialParcel.id, address)
  const myShareCount = Number(myShares || BigInt(0))

  const [parcel, setParcel] = useState(initialParcel)
  const [holders, setHolders] = useState(initialHolders)
  const [holdersLoading, setHoldersLoading] = useState(true)

  const myPct = (myShareCount / parcel.totalShares) * 100

  // Fetch live holders + parcel data from chain
  const fetchLiveData = useCallback(async () => {
    setHoldersLoading(true)
    try {
      const [holdersRes, parcelsRes] = await Promise.all([
        fetch(`/api/holders?parcelId=${initialParcel.id}`),
        fetch('/api/parcels'),
      ])
      const holdersData = await holdersRes.json()
      const parcelsData = await parcelsRes.json()

      // Update parcel with live availableShares
      if (Array.isArray(parcelsData)) {
        const live = parcelsData.find((p: ParcelData) => p.id === initialParcel.id)
        if (live) setParcel(live)
      }

      // Build holder list with labels — deployer is "Available (Unsold)", real buyers are investors
      if (Array.isArray(holdersData) && holdersData.length > 0) {
        const totalShares = initialParcel.totalShares
        const liveHolders: Holder[] = holdersData.map((h: { address: string; shares: number; role?: string }) => {
          const pct = (h.shares / totalShares) * 100
          return {
            address: h.address,
            shares: h.shares,
            pct,
            label: h.role === 'deployer' ? 'Available (Unsold)' : 'Investor',
          }
        })
        setHolders(liveHolders)
      }
    } catch {
      // keep initial
    } finally {
      setHoldersLoading(false)
    }
  }, [initialParcel.id, initialParcel.totalShares, initialParcel.seller])

  useEffect(() => {
    fetchLiveData()
  }, [fetchLiveData])

  const [budget, setBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [strategy, setStrategy] = useState<{
    feasibility: string
    costTo51Pct: number
    costTo100Pct: number
    offerPlan: OfferPlan[]
    strategy: string
  } | null>(null)
  const [sentOffers, setSentOffers] = useState<Set<string>>(new Set())

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acquisition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: parcel.id,
          holders: holders.map((h) => ({
            address: h.address,
            shares: h.shares,
            pct: h.pct,
          })),
          totalShares: parcel.totalShares,
          budget: parseFloat(budget),
          currentPrice: parcel.pricePerShare,
        }),
      })
      const data = await res.json()
      setStrategy(data)
    } catch {
      // Fallback mock
      setStrategy({
        feasibility: 'feasible',
        costTo51Pct: parcel.pricePerShare * parcel.totalShares * 0.55,
        costTo100Pct: parcel.pricePerShare * parcel.totalShares * 1.1,
        offerPlan: holders.map((h) => ({
          address: h.address,
          shares: h.shares,
          suggestedPrice:
            parcel.pricePerShare * (h.pct > 30 ? 1.05 : h.pct > 15 ? 1.1 : 1.15),
          sellProbability: h.pct > 30 ? 'medium' : h.pct > 15 ? 'medium' : 'high',
          reasoning:
            h.pct > 30
              ? 'Large holder, may require premium to sell.'
              : 'Smaller position, likely to accept near-market offer.',
        })),
        strategy:
          'Start by acquiring listed shares, then target smaller holders at a slight premium. The seller holds the largest position and may require direct negotiation.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendOffer = (holderAddr: string, shares: number, price: number) => {
    if (!address) return
    offerTx.createOffer(parcel.id, holderAddr as `0x${string}`, shares, price)
    setSentOffers((prev) => new Set([...prev, holderAddr]))
  }

  const handleProposeBuyout = () => {
    if (!address || myPct < 51) return
    const remainingShares = parcel.totalShares - myShareCount
    buyoutTx.propose(parcel.id, parcel.pricePerShare, remainingShares)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link
        href="/acquire"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        All Parcels
      </Link>

      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
            Acquire: {parcel.name}
          </h1>
          {parcel.verified && <Badge variant="verified" />}
          <Badge variant="on-chain" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
              Total Shares
            </div>
            <div className="tnum text-[20px] font-semibold">{parcel.totalShares}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
              Current Price
            </div>
            <div className="tnum text-[20px] font-semibold">
              {parcel.pricePerShare}{' '}
              <span className="text-[12px] font-normal text-text-tertiary">MNT</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
              Full Market Cap
            </div>
            <div className="tnum text-[20px] font-semibold">
              {(parcel.totalShares * parcel.pricePerShare).toFixed(1)}{' '}
              <span className="text-[12px] font-normal text-text-tertiary">MNT</span>
            </div>
          </div>
        </div>

        {/* Progress toward majority */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
              Your Progress to Majority
            </span>
            <span className="tnum text-[11px] font-medium text-text-secondary">
              {myShareCount} shares · {myPct.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-2.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-[var(--dur-slow)]"
              style={{
                width: `${Math.min(myPct, 100)}%`,
                backgroundColor: myPct >= 51 ? 'var(--up)' : 'var(--brand)',
              }}
            />
            {/* 51% threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-text-primary/60"
              style={{ left: '51%' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="tnum text-[9px] text-text-tertiary">0%</span>
            <span
              className="tnum text-[9px] font-medium"
              style={{ marginLeft: '2%', color: myPct >= 51 ? 'var(--up)' : 'var(--text-tertiary)' }}
            >
              51% — squeeze-out unlocked
            </span>
            <span className="tnum text-[9px] text-text-tertiary">100%</span>
          </div>
        </div>
      </div>

      {/* Cap table */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
            Cap Table
          </span>
          {holdersLoading && <Loader2 size={12} className="animate-spin text-text-tertiary" />}
          <span className="text-[9px] text-text-tertiary ml-auto">Live on-chain data</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2">
              <th className="text-left px-4 py-2 font-medium">Holder</th>
              <th className="text-left px-4 py-2 font-medium">Label</th>
              <th className="text-right px-4 py-2 font-medium">Shares</th>
              <th className="text-right px-4 py-2 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((h) => {
              const isMe = address && h.address.toLowerCase() === address.toLowerCase()
              return (
                <tr
                  key={h.address}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <a
                      href={`https://sepolia.mantlescan.xyz/address/${h.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-text-secondary hover:text-brand transition-colors"
                    >
                      {truncAddr(h.address)}
                    </a>
                    {isMe && (
                      <span className="ml-2 text-[9px] font-medium text-brand bg-brand-bg px-1.5 py-0.5 rounded-[var(--radius-xs)]">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-text-primary">{h.label}</td>
                  <td className="px-4 py-2.5 text-right tnum text-[12.5px]">{h.shares}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-[3px] rounded-full bg-surface-3 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${h.pct}%`,
                            backgroundColor:
                              h.label === 'Available (Unsold)' ? 'var(--text-tertiary)' : 'var(--brand)',
                          }}
                        />
                      </div>
                      <span className="tnum text-[12.5px] text-text-secondary w-12 text-right">
                        {h.pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* AI Strategy */}
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={16} className="text-brand" />
          <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
            AI Acquisition Strategy
          </span>
        </div>

        {!strategy ? (
          <div>
            <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
              Your Budget (MNT)
            </label>
            <div className="flex gap-3">
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                type="number"
                step={0.1}
                className="flex-1 bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary font-mono outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder={`e.g. ${(parcel.totalShares * parcel.pricePerShare * 1.2).toFixed(1)}`}
              />
              <button
                onClick={handleAnalyze}
                disabled={!budget || loading}
                className="px-6 py-2 bg-brand text-white rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Analyzing...' : 'Get AI Strategy'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-bg-sunken rounded-[var(--radius-sm)]">
                <div className="text-[10px] text-text-tertiary uppercase tracking-[0.06em] mb-1">
                  Feasibility
                </div>
                <div
                  className="text-[14px] font-semibold capitalize"
                  style={{
                    color:
                      strategy.feasibility === 'feasible'
                        ? 'var(--up)'
                        : strategy.feasibility === 'challenging'
                          ? 'var(--accent-amber)'
                          : 'var(--down)',
                  }}
                >
                  {strategy.feasibility}
                </div>
              </div>
              <div className="p-3 bg-bg-sunken rounded-[var(--radius-sm)]">
                <div className="text-[10px] text-text-tertiary uppercase tracking-[0.06em] mb-1">
                  Cost to 51%
                </div>
                <div className="tnum text-[14px] font-semibold">
                  {typeof strategy.costTo51Pct === 'number'
                    ? strategy.costTo51Pct.toFixed(2)
                    : strategy.costTo51Pct}{' '}
                  MNT
                </div>
              </div>
              <div className="p-3 bg-bg-sunken rounded-[var(--radius-sm)]">
                <div className="text-[10px] text-text-tertiary uppercase tracking-[0.06em] mb-1">
                  Cost to 100%
                </div>
                <div className="tnum text-[14px] font-semibold">
                  {typeof strategy.costTo100Pct === 'number'
                    ? strategy.costTo100Pct.toFixed(2)
                    : strategy.costTo100Pct}{' '}
                  MNT
                </div>
              </div>
            </div>

            {/* Strategy text */}
            <div className="text-[12.5px] text-text-secondary leading-relaxed bg-bg-sunken rounded-[var(--radius-sm)] p-3 mb-4">
              {strategy.strategy}
            </div>

            {/* Offer plan table */}
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
              Per-Holder Offer Plan
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2">
                  <th className="text-left px-3 py-1.5 font-medium">Holder</th>
                  <th className="text-right px-3 py-1.5 font-medium">Shares</th>
                  <th className="text-right px-3 py-1.5 font-medium">Offer Price</th>
                  <th className="text-center px-3 py-1.5 font-medium">Sell Prob.</th>
                  <th className="px-3 py-1.5 font-medium">Reasoning</th>
                  <th className="px-3 py-1.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {strategy.offerPlan.map((offer) => (
                  <tr
                    key={offer.address}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">
                      {truncAddr(offer.address)}
                    </td>
                    <td className="px-3 py-2 text-right tnum text-[12.5px]">
                      {offer.shares}
                    </td>
                    <td className="px-3 py-2 text-right tnum text-[12.5px] text-text-primary">
                      {typeof offer.suggestedPrice === 'number'
                        ? offer.suggestedPrice.toFixed(3)
                        : offer.suggestedPrice}{' '}
                      MNT
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color:
                            offer.sellProbability === 'high'
                              ? 'var(--up)'
                              : offer.sellProbability === 'medium'
                                ? 'var(--accent-amber)'
                                : 'var(--down)',
                          backgroundColor:
                            offer.sellProbability === 'high'
                              ? 'var(--up-bg)'
                              : offer.sellProbability === 'medium'
                                ? 'var(--accent-amber-bg)'
                                : 'var(--down-bg)',
                        }}
                      >
                        {offer.sellProbability}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-text-tertiary max-w-[200px] truncate">
                      {offer.reasoning}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleSendOffer(offer.address, offer.shares, offer.suggestedPrice)}
                        disabled={sentOffers.has(offer.address) || offerTx.isPending}
                        className="text-[10px] font-medium text-brand hover:text-brand-hover disabled:text-text-tertiary inline-flex items-center gap-1 transition-colors"
                      >
                        {sentOffers.has(offer.address) ? (
                          <><CheckCircle2 size={10} /> Sent</>
                        ) : offerTx.isPending ? (
                          <><Loader2 size={10} className="animate-spin" /> ...</>
                        ) : (
                          <>
                            <Send size={10} /> Offer
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Governance CTA */}
            <div className="mt-6 p-4 border border-brand-border rounded-[var(--radius-md)] bg-brand-bg">
              <div className="flex items-center gap-2 mb-2">
                <Vote size={16} className="text-brand" />
                <span className="text-[12.5px] font-medium text-brand">
                  Governance Buyout
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mb-3">
                Once you hold 51%+ shares, you can propose a buyout vote. If it passes,
                remaining holders are automatically paid your declared price.
              </p>
              <button
                onClick={handleProposeBuyout}
                disabled={myPct < 51 || buyoutTx.isPending || buyoutTx.isConfirming}
                className="px-4 py-2 bg-brand text-white rounded-[var(--radius-sm)] text-[12.5px] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover transition-colors inline-flex items-center gap-1.5"
              >
                {buyoutTx.isPending || buyoutTx.isConfirming ? (
                  <><Loader2 size={13} className="animate-spin" /> Submitting...</>
                ) : buyoutTx.isSuccess ? (
                  <><CheckCircle2 size={13} /> Buyout Proposed!</>
                ) : (
                  `Propose Buyout ${myPct >= 51 ? '' : '(requires 51%+)'}`
                )}
              </button>
              {myPct > 0 && (
                <div className="text-[10px] text-text-tertiary mt-2 tnum">
                  You hold {myShareCount} shares ({myPct.toFixed(1)}%)
                </div>
              )}
              {buyoutTx.hash && (
                <a
                  href={`https://sepolia.mantlescan.xyz/tx/${buyoutTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-brand hover:text-brand-hover mt-1"
                >
                  View tx <ExternalLink size={10} />
                </a>
              )}
            </div>

            {offerTx.hash && (
              <div className="mt-3">
                <a
                  href={`https://sepolia.mantlescan.xyz/tx/${offerTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-brand hover:text-brand-hover"
                >
                  Last offer tx <ExternalLink size={10} />
                </a>
              </div>
            )}

            <button
              onClick={() => setStrategy(null)}
              className="mt-3 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Re-analyze with different budget
            </button>
          </>
        )}
      </div>
    </div>
  )
}
