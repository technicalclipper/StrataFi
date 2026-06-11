'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useClaimYield, useClaimableYield, formatEther } from '@/hooks/useContracts'
import Link from 'next/link'
import {
  Bot,
  Loader2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Wallet,
  PieChart,
  ArrowRight,
  Coins,
} from 'lucide-react'
import { OfferInbox } from '@/components/OfferInbox'
import {
  Sparkline,
  DeltaChip,
  ConfidenceCell,
  simulateSeries,
  makeTicker,
  LiveBadge,
} from '@/components/MarketUI'

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

const ALLOC_COLORS = ['var(--brand)', 'var(--up)', 'var(--accent-amber)', 'var(--heat-2)', 'var(--heat-4)', 'var(--heat-1)']

export function PortfolioView() {
  const { address, isConnected } = useAccount()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loadingHoldings, setLoadingHoldings] = useState(true)
  const [aiSignals, setAiSignals] = useState<Signal[]>([])
  const [loadingSignals, setLoadingSignals] = useState(false)

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

  const claimTx = useClaimYield()
  const firstParcelId = holdings[0]?.parcelId || 1
  const { data: claimableRaw } = useClaimableYield(firstParcelId, address)
  const claimableMNT = claimableRaw ? parseFloat(formatEther(claimableRaw)) : 0

  // Market-simulated view of holdings (same deterministic sim as /markets)
  const enriched = useMemo(
    () =>
      holdings.map((h) => {
        const sim = simulateSeries(h.parcelId, h.pricePerShare)
        return {
          ...h,
          ticker: makeTicker(h.name, h.parcelId),
          spark: sim.series,
          livePrice: sim.livePrice,
          changePct: sim.changePct,
          liveValue: sim.livePrice * h.shares,
        }
      }),
    [holdings],
  )

  const totalValue = enriched.reduce((s, h) => s + h.liveValue, 0)
  const totalCost = enriched.reduce((s, h) => s + h.currentValue, 0)
  const totalShares = enriched.reduce((s, h) => s + h.shares, 0)
  const totalChangePct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0
  const portfolioSpark = useMemo(() => {
    if (enriched.length === 0) return []
    const len = enriched[0].spark.length
    return Array.from({ length: len }, (_, i) =>
      enriched.reduce((s, h) => s + h.spark[i] * h.shares, 0),
    )
  }, [enriched])

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
          data.signals.map(
            (s: { parcelId?: number; message: string; action: string }, i: number) => ({
              id: i + 1,
              parcelId: s.parcelId || holdings[i % holdings.length]?.parcelId || 1,
              message: s.message,
              action: s.action,
              time: 'just now',
            }),
          ),
        )
      }
    } catch {
      // keep current
    } finally {
      setLoadingSignals(false)
    }
  }

  const handleClaimAll = () => {
    if (holdings.length > 0) claimTx.claim(holdings[0].parcelId)
  }

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-surface-2 border border-border-default flex items-center justify-center mx-auto mb-3">
            <Wallet size={20} className="text-text-tertiary" />
          </div>
          <div className="text-[14px] text-text-secondary mb-1">Connect your wallet</div>
          <div className="text-[12.5px] text-text-tertiary">
            Your on-chain holdings will appear here
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* ───── Hero: portfolio value ───── */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-5 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                  Portfolio Value
                </span>
                <LiveBadge />
              </div>
              <div className="flex items-baseline gap-3">
                <span className="tnum text-[34px] font-semibold text-text-primary leading-none">
                  {totalValue.toFixed(2)}
                </span>
                <span className="text-[14px] text-text-tertiary">MNT</span>
                {enriched.length > 0 && <DeltaChip value={totalChangePct} size="md" />}
              </div>
              <div className="text-[12.5px] text-text-tertiary mt-2">
                {totalShares} shares · {holdings.length} parcel
                {holdings.length !== 1 ? 's' : ''} · cost basis{' '}
                <span className="tnum">{totalCost.toFixed(2)} MNT</span>
              </div>
            </div>
            {portfolioSpark.length > 1 && (
              <Sparkline data={portfolioSpark} up={totalChangePct >= 0} w={200} h={56} />
            )}
          </div>
        </div>

        {/* ───── Allocation bar ───── */}
        {enriched.length > 0 && (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
              <PieChart size={11} /> Allocation
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-3 mb-3">
              {enriched.map((h, i) => (
                <div
                  key={h.parcelId}
                  style={{
                    width: `${totalValue > 0 ? (h.liveValue / totalValue) * 100 : 0}%`,
                    backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length],
                  }}
                  title={`${h.name}: ${((h.liveValue / totalValue) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {enriched.map((h, i) => (
                <div key={h.parcelId} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                  />
                  <span className="font-mono text-[10.5px] font-medium text-text-secondary">
                    {h.ticker}
                  </span>
                  <span className="tnum text-[10.5px] text-text-tertiary">
                    {totalValue > 0 ? ((h.liveValue / totalValue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ───── Holdings table ───── */}
        {loadingHoldings ? (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-10 text-center mb-5">
            <Loader2 size={20} className="mx-auto mb-2 text-text-tertiary animate-spin" />
            <div className="text-[12.5px] text-text-tertiary">Loading on-chain holdings…</div>
          </div>
        ) : holdings.length === 0 ? (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-10 text-center mb-5">
            <div className="text-[14px] text-text-secondary mb-1.5">No holdings found</div>
            <div className="text-[12.5px] text-text-tertiary mb-3">
              Buy shares on a parcel to see them here
            </div>
            <Link
              href="/markets"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-[var(--radius-sm)] text-[12.5px] font-medium hover:bg-brand-hover transition-colors"
            >
              Browse markets <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                Holdings
              </span>
              <span className="text-[9px] text-text-tertiary ml-auto">
                Live on-chain balances
              </span>
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
                  <th className="text-left px-4 py-2.5 font-medium">Asset</th>
                  <th className="text-right px-4 py-2.5 font-medium">Last Price</th>
                  <th className="text-right px-4 py-2.5 font-medium">24h</th>
                  <th className="text-center px-4 py-2.5 font-medium">Trend</th>
                  <th className="text-right px-4 py-2.5 font-medium">Shares</th>
                  <th className="text-right px-4 py-2.5 font-medium">Value</th>
                  <th className="text-right px-4 py-2.5 font-medium">AI Score</th>
                  <th className="px-4 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((h) => (
                  <tr
                    key={h.parcelId}
                    className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/parcel/${h.parcelId}`} className="block">
                        <div className="font-mono text-[12.5px] font-semibold text-text-primary group-hover:text-brand transition-colors">
                          {h.ticker}
                        </div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">
                          {h.name} · {h.location}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tnum text-[13px] font-semibold text-text-primary">
                        {h.livePrice.toFixed(3)}
                      </span>
                      <div className="text-[9px] text-text-tertiary">MNT</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeltaChip value={h.changePct} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Sparkline data={h.spark} up={h.changePct >= 0} w={80} h={26} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tnum text-[12.5px] text-text-primary">
                        {h.shares}
                        <span className="text-text-tertiary">/{h.totalShares}</span>
                      </span>
                      <div className="text-[9px] tnum text-text-tertiary">
                        {h.ownershipPct.toFixed(1)}% owned
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tnum text-[12.5px] font-medium text-text-primary">
                        {h.liveValue.toFixed(2)}
                      </span>
                      <div className="text-[9px] text-text-tertiary">MNT</div>
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceCell score={h.confidenceScore} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/parcel/${h.parcelId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium bg-surface-3 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity hover:text-text-primary border border-border-default"
                      >
                        Trade
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ───── Claimable yield ───── */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-up-bg flex items-center justify-center">
                <Coins size={16} className="text-up" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-0.5">
                  Claimable Yield
                </div>
                <div className="tnum text-[20px] font-semibold text-up leading-none">
                  {claimableMNT > 0 ? claimableMNT.toFixed(4) : '0.0000'}{' '}
                  <span className="text-[12px] font-normal text-text-tertiary">MNT</span>
                </div>
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
                  <>
                    <Loader2 size={13} className="animate-spin" /> Claiming…
                  </>
                ) : claimTx.isSuccess ? (
                  <>
                    <CheckCircle2 size={13} /> Claimed!
                  </>
                ) : (
                  'Claim All'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Right panel — AI agent + offers ───── */}
      <div className="w-80 border-l border-border-default bg-surface-1/50 p-4 overflow-auto shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[var(--radius-xs)] bg-brand-bg flex items-center justify-center">
              <Bot size={13} className="text-brand" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
              AI Portfolio Agent
            </span>
          </div>
          <button
            onClick={fetchAiSignals}
            disabled={loadingSignals || holdings.length === 0}
            className="text-[10px] font-medium text-brand hover:text-brand-hover disabled:opacity-50 transition-colors inline-flex items-center gap-1"
          >
            {loadingSignals ? (
              <>
                <Loader2 size={10} className="animate-spin" /> Analyzing…
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>

        {aiSignals.length === 0 && holdings.length > 0 && !loadingSignals && (
          <button
            onClick={fetchAiSignals}
            className="w-full bg-surface-1 border border-dashed border-border-default rounded-[var(--radius-md)] p-4 mb-3 text-center hover:border-brand-border hover:bg-brand-bg/30 transition-colors group"
          >
            <Bot size={16} className="mx-auto mb-1.5 text-text-tertiary group-hover:text-brand transition-colors" />
            <p className="text-[11px] text-text-tertiary group-hover:text-text-secondary">
              Run AI analysis on your holdings
            </p>
          </button>
        )}

        {holdings.length === 0 && !loadingHoldings && (
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3 mb-3 text-center">
            <p className="text-[11px] text-text-tertiary">Buy shares to see AI insights</p>
          </div>
        )}

        <div className="space-y-2.5">
          {aiSignals.map((signal) => {
            const holding = enriched.find((h) => h.parcelId === signal.parcelId)
            return (
              <div
                key={signal.id}
                className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-3 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] font-semibold text-brand bg-brand-bg px-1.5 py-0.5 rounded-[var(--radius-xs)]">
                    {holding?.ticker || `#${signal.parcelId}`}
                  </span>
                  <span className="text-[9px] font-mono text-text-tertiary">{signal.time}</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                  {signal.message}
                </p>
                <Link
                  href={`/parcel/${signal.parcelId}`}
                  className="text-[10px] font-medium text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1"
                >
                  {signal.action} <ArrowRight size={10} />
                </Link>
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-border-subtle">
          <OfferInbox />
        </div>
      </div>
    </div>
  )
}
