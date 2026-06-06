'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Badge } from '@/components/Badge'
import { useClaimYield, useClaimableYield, formatEther } from '@/hooks/useContracts'
import Link from 'next/link'
import { Bot, ArrowRight, Loader2, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react'
import { OfferInbox } from '@/components/OfferInbox'

type Holding = {
  parcelId: number
  name: string
  location: string
  shares: number
  totalShares: number
  pricePerShare: number
  currentValue: number
  confidenceScore: number
  ownershipPct: number
}

type Signal = {
  id: number
  parcelId: number
  message: string
  action: string
  time: string
}

export function PortfolioView() {
  const { address, isConnected } = useAccount()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loadingHoldings, setLoadingHoldings] = useState(true)
  const [aiSignals, setAiSignals] = useState<Signal[]>([])
  const [loadingSignals, setLoadingSignals] = useState(false)

  // Fetch real on-chain holdings
  const fetchHoldings = useCallback(async () => {
    if (!address) return
    setLoadingHoldings(true)
    try {
      const res = await fetch(`/api/portfolio?address=${address}`)
      const data = await res.json()
      if (Array.isArray(data)) setHoldings(data)
    } catch {
      // keep current
    } finally {
      setLoadingHoldings(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) fetchHoldings()
  }, [isConnected, address, fetchHoldings])

  // Yield claim hook
  const claimTx = useClaimYield()
  const firstParcelId = holdings[0]?.parcelId || 1
  const { data: claimableRaw } = useClaimableYield(firstParcelId, address)
  const claimableMNT = claimableRaw ? parseFloat(formatEther(claimableRaw)) : 0

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0)
  const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0)

  // Fetch live AI signals
  const fetchAiSignals = async () => {
    if (!isConnected || holdings.length === 0) return
    setLoadingSignals(true)
    try {
      const res = await fetch('/api/portfolio-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: holdings.map((h) => ({
            parcelId: h.parcelId,
            name: h.name,
            location: h.location,
            shares: h.shares,
            totalShares: h.totalShares,
            pricePerShare: h.pricePerShare,
            yieldPct: 0,
            demandScore: 3,
          })),
        }),
      })
      const data = await res.json()
      if (data.signals && Array.isArray(data.signals)) {
        setAiSignals(
          data.signals.map((s: { parcelId?: number; message: string; action: string }, i: number) => ({
            id: i + 1,
            parcelId: s.parcelId || holdings[i % holdings.length]?.parcelId || 1,
            message: s.message,
            action: s.action,
            time: 'just now',
          })),
        )
      }
    } catch {
      // Keep current signals on error
    } finally {
      setLoadingSignals(false)
    }
  }

  const handleClaimAll = () => {
    if (holdings.length > 0) {
      claimTx.claim(holdings[0].parcelId)
    }
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
          </div>
          <div className="text-[12.5px] text-text-tertiary mt-1">
            {totalShares} shares across {holdings.length} parcel{holdings.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Holdings table */}
        {loadingHoldings ? (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-8 text-center mb-6">
            <Loader2 size={20} className="mx-auto mb-2 text-text-tertiary animate-spin" />
            <div className="text-[12.5px] text-text-tertiary">Loading on-chain holdings...</div>
          </div>
        ) : holdings.length === 0 ? (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-8 text-center mb-6">
            <div className="text-[14px] text-text-secondary mb-2">No holdings found</div>
            <div className="text-[12.5px] text-text-tertiary mb-3">
              Buy shares on a parcel to see them here
            </div>
            <Link href="/" className="text-[12.5px] text-brand hover:text-brand-hover">
              Browse parcels &rarr;
            </Link>
          </div>
        ) : (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                Holdings
              </span>
              <span className="text-[9px] text-text-tertiary ml-auto">Live on-chain balances</span>
              <button
                onClick={fetchHoldings}
                className="text-text-tertiary hover:text-text-primary transition-colors"
              >
                <RefreshCw size={11} />
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2">
                  <th className="text-left px-4 py-2 font-medium">Parcel</th>
                  <th className="text-right px-4 py-2 font-medium">Shares</th>
                  <th className="text-right px-4 py-2 font-medium">Ownership</th>
                  <th className="text-right px-4 py-2 font-medium">Price</th>
                  <th className="text-right px-4 py-2 font-medium">Value</th>
                  <th className="text-right px-4 py-2 font-medium">Score</th>
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
                        {h.name}
                      </Link>
                      <div className="text-[10px] text-text-tertiary">
                        {h.location}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-primary">
                      {h.shares} / {h.totalShares}
                    </td>
                    <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-secondary">
                      {h.ownershipPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-primary">
                      {h.pricePerShare} MNT
                    </td>
                    <td className="px-4 py-3 text-right tnum text-[12.5px] text-text-primary">
                      {h.currentValue.toFixed(2)} MNT
                    </td>
                    <td className="px-4 py-3 text-right tnum text-[12.5px] text-up">
                      {h.confidenceScore}
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
        )}

        {/* Claimable yield */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                Claimable Yield
              </div>
              <div className="tnum text-[20px] font-semibold text-up">
                {claimableMNT > 0 ? claimableMNT.toFixed(4) : '0.0000'} MNT
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
                disabled={claimTx.isPending || claimTx.isConfirming || holdings.length === 0}
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

      {/* Right panel — AI agent feed + Offer inbox */}
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
            disabled={loadingSignals || holdings.length === 0}
            className="text-[10px] font-medium text-brand hover:text-brand-hover disabled:opacity-50 transition-colors"
          >
            {loadingSignals ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>

        {aiSignals.length === 0 && holdings.length > 0 && (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3 mb-3 text-center">
            <p className="text-[11px] text-text-tertiary">
              Click Refresh to get AI signals for your holdings
            </p>
          </div>
        )}

        {holdings.length === 0 && !loadingHoldings && (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3 mb-3 text-center">
            <p className="text-[11px] text-text-tertiary">
              Buy shares to see AI insights
            </p>
          </div>
        )}

        <div className="space-y-3">
          {aiSignals.map((signal) => {
            const holding = holdings.find((h) => h.parcelId === signal.parcelId)
            return (
              <div
                key={signal.id}
                className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="demand" demandLevel={3} label={holding?.name?.split(' ')[0] || 'Parcel'} />
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
