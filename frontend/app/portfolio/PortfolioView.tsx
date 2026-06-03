'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { SEED_PARCELS } from '@/lib/seed-parcels'
import { Delta } from '@/components/Delta'
import { Badge } from '@/components/Badge'
import { useClaimYield, useClaimableYield, useShareBalance, formatEther } from '@/hooks/useContracts'
import Link from 'next/link'
import { Bot, ArrowRight, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { OfferInbox } from '@/components/OfferInbox'

// Mock portfolio holdings (in production, read from on-chain events / indexer)
const MOCK_HOLDINGS = [
  { parcelId: 1, shares: 25, avgCost: 0.45 },
  { parcelId: 4, shares: 10, avgCost: 1.05 },
  { parcelId: 5, shares: 40, avgCost: 0.58 },
  { parcelId: 7, shares: 3, avgCost: 2.2 },
]

// Mock AI agent signals
const AGENT_SIGNALS = [
  {
    id: 1,
    parcelId: 4,
    message:
      'Metro station announced 800m from Koramangala plot. Projected +15% price impact within 6 months.',
    action: 'Hold',
    time: '2m ago',
  },
  {
    id: 2,
    parcelId: 1,
    message:
      'Demand near Whitefield Tech Park dropped 20% this week. Consider trimming position.',
    action: 'Trim',
    time: '14m ago',
  },
  {
    id: 3,
    parcelId: 5,
    message:
      'Your Hebbal Lake View shares are up 12% since purchase. Yield stable at 7.8%.',
    action: 'Hold',
    time: '1h ago',
  },
  {
    id: 4,
    parcelId: 7,
    message:
      'Indiranagar Premium is 93.75% sold. High scarcity — potential squeeze play incoming.',
    action: 'View',
    time: '3h ago',
  },
]

export function PortfolioView() {
  const { address, isConnected } = useAccount()
  const [aiSignals, setAiSignals] = useState(AGENT_SIGNALS)
  const [loadingSignals, setLoadingSignals] = useState(false)

  // Yield claim hook
  const claimTx = useClaimYield()

  // Read claimable yield for first parcel (demo)
  const { data: claimableRaw } = useClaimableYield(1, address)
  const claimableMNT = claimableRaw ? parseFloat(formatEther(claimableRaw)) : 0

  const holdings = MOCK_HOLDINGS.map((h) => {
    const parcel = SEED_PARCELS.find((p) => p.id === h.parcelId)!
    const currentValue = h.shares * parcel.pricePerShare
    const costBasis = h.shares * h.avgCost
    const pnl = currentValue - costBasis
    const pnlPct = (pnl / costBasis) * 100
    return { ...h, parcel, currentValue, costBasis, pnl, pnlPct }
  })

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0)
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0)
  const totalPnlPct = ((totalValue - totalCost) / totalCost) * 100

  // Fetch live AI signals
  const fetchAiSignals = async () => {
    if (!isConnected) return
    setLoadingSignals(true)
    try {
      const res = await fetch('/api/portfolio-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: MOCK_HOLDINGS.map((h) => {
            const p = SEED_PARCELS.find((p) => p.id === h.parcelId)!
            return {
              parcelId: h.parcelId,
              name: p.name,
              location: p.location,
              shares: h.shares,
              totalShares: p.totalShares,
              pricePerShare: p.pricePerShare,
              yieldPct: p.yieldPct,
              demandScore: p.demandScore,
            }
          }),
        }),
      })
      const data = await res.json()
      if (data.signals && Array.isArray(data.signals)) {
        setAiSignals(
          data.signals.map((s: { parcelId?: number; message: string; action: string }, i: number) => ({
            id: i + 1,
            parcelId: s.parcelId || MOCK_HOLDINGS[i % MOCK_HOLDINGS.length].parcelId,
            message: s.message,
            action: s.action,
            time: 'just now',
          })),
        )
      }
    } catch {
      // Keep mock signals on error
    } finally {
      setLoadingSignals(false)
    }
  }

  const handleClaimAll = () => {
    // Claim from each parcel that has yield
    claimTx.claim(1) // Demo: claim from parcel 1
  }

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-text-tertiary text-[14px] mb-2">
            Connect your wallet to view portfolio
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Portfolio value header */}
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
            Portfolio Value
          </div>
          <div className="flex items-baseline gap-3">
            <span className="tnum text-[34px] font-semibold text-text-primary">
              {totalValue.toFixed(2)}
            </span>
            <span className="text-[16px] text-text-tertiary">MNT</span>
            <Delta value={totalPnlPct} showBg />
          </div>
        </div>

        {/* Holdings table */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border-subtle">
            <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
              Holdings
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2">
                <th className="text-left px-4 py-2 font-medium">Parcel</th>
                <th className="text-right px-4 py-2 font-medium">Shares</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">Value</th>
                <th className="text-right px-4 py-2 font-medium">Yield</th>
                <th className="text-right px-4 py-2 font-medium">P&L</th>
                <th className="px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr
                  key={h.parcelId}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/parcel/${h.parcelId}`}
                      className="text-[12.5px] font-medium text-text-primary hover:text-brand transition-colors"
                    >
                      {h.parcel.name}
                    </Link>
                    <div className="text-[10px] text-text-tertiary">
                      {h.parcel.location}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-primary">
                    {h.shares}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-primary">
                    {h.parcel.pricePerShare} MNT
                  </td>
                  <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-primary">
                    {h.currentValue.toFixed(2)} MNT
                  </td>
                  <td className="px-4 py-3 text-right tnum text-[12.5px] text-up">
                    {h.parcel.yieldPct}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Delta value={h.pnlPct} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/parcel/${h.parcelId}`}>
                      <ArrowRight
                        size={14}
                        className="text-text-tertiary hover:text-text-primary"
                      />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Claimable yield */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                Claimable Yield
              </div>
              <div className="tnum text-[20px] font-semibold text-up">
                {claimableMNT > 0 ? claimableMNT.toFixed(4) : '0.8420'} MNT
              </div>
            </div>
            <div className="flex items-center gap-2">
              {claimTx.hash && (
                <a
                  href={`https://sepolia.mantlescan.xyz/tx/${claimTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:text-brand-hover"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                onClick={handleClaimAll}
                disabled={claimTx.isPending || claimTx.isConfirming}
                className="px-4 py-2 bg-up text-text-inverse rounded-[var(--radius-sm)] text-[12.5px] font-medium hover:brightness-110 transition-all disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {claimTx.isPending || claimTx.isConfirming ? (
                  <><Loader2 size={13} className="animate-spin" /> Claiming...</>
                ) : claimTx.isSuccess ? (
                  <><CheckCircle2 size={13} /> Claimed!</>
                ) : (
                  'Claim All'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — AI agent feed */}
      <div className="w-80 border-l border-border-default bg-surface-1/50 p-4 overflow-auto shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-brand" />
            <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
              AI Portfolio Agent
            </span>
          </div>
          <button
            onClick={fetchAiSignals}
            disabled={loadingSignals}
            className="text-[10px] font-medium text-brand hover:text-brand-hover disabled:opacity-50 transition-colors"
          >
            {loadingSignals ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>

        <div className="space-y-3">
          {aiSignals.map((signal) => {
            const parcel = SEED_PARCELS.find((p) => p.id === signal.parcelId)
            return (
              <div
                key={signal.id}
                className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="demand" demandLevel={parcel?.demandScore || 3} label={parcel?.name.split(' ')[0]} />
                  <span className="text-[9px] font-mono text-text-tertiary">
                    {signal.time}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                  {signal.message}
                </p>
                <Link
                  href={`/parcel/${signal.parcelId}`}
                  className="text-[10px] font-medium text-brand hover:text-brand-hover transition-colors"
                >
                  {signal.action} &rarr;
                </Link>
              </div>
            )
          })}
        </div>

        {/* Offer inbox */}
        <div className="mt-6 pt-6 border-t border-border-subtle">
          <OfferInbox />
        </div>
      </div>
    </div>
  )
}
