'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  ArrowRight,
  TrendingUp,
  Layers,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Loader2,
  ChevronsUpDown,
  Flame,
  CircleDollarSign,
} from 'lucide-react'
import {
  Sparkline,
  DeltaChip,
  ConfidenceCell,
  simulateSeries,
  makeTicker,
  mulberry32,
  LAND_TYPE_COLORS,
  DEMAND_HEAT,
} from '@/components/MarketUI'

type Parcel = {
  id: number
  name: string
  location: string
  landType: string
  areaSqFt: number
  totalShares: number
  availableShares: number
  pricePerShare: number
  yieldPct: number
  demandScore: number
  confidenceScore: number
  verified: boolean
}

type MarketParcel = Parcel & {
  ticker: string
  livePrice: number
  changePct: number
  spark: number[]
  volume24h: number
  marketCap: number
}

type SortKey =
  | 'ticker'
  | 'livePrice'
  | 'changePct'
  | 'marketCap'
  | 'availableShares'
  | 'yieldPct'
  | 'confidenceScore'

/* ---------- market enrichment (shared deterministic sim) ---------- */

function buildMarket(p: Parcel): MarketParcel {
  const sim = simulateSeries(p.id, p.pricePerShare)
  const rng = mulberry32(p.id * 104729 + 7)
  return {
    ...p,
    ticker: makeTicker(p.name, p.id),
    livePrice: sim.livePrice,
    changePct: sim.changePct,
    spark: sim.series,
    volume24h: Math.round(rng() * p.totalShares * 0.4),
    marketCap: p.totalShares * sim.livePrice,
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={10} className="text-text-tertiary ml-0.5" />
  return dir === 'asc' ? (
    <ChevronUp size={10} className="text-brand ml-0.5" />
  ) : (
    <ChevronDown size={10} className="text-brand ml-0.5" />
  )
}

/* ---------- main view ---------- */

export function MarketsView() {
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [ticks, setTicks] = useState<Record<number, { dir: 'up' | 'down'; delta: number; key: number }>>({})

  useEffect(() => {
    fetch('/api/parcels')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setParcels(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const market = useMemo(() => parcels.map(buildMarket), [parcels])

  // Simulated live ticks — flash a random row every few seconds
  useEffect(() => {
    if (market.length === 0) return
    const interval = setInterval(() => {
      const p = market[Math.floor(Math.random() * market.length)]
      const dir = Math.random() > 0.45 ? 'up' : 'down'
      const delta = (Math.random() * 0.6) * (dir === 'up' ? 1 : -1)
      setTicks((t) => ({ ...t, [p.id]: { dir, delta, key: Date.now() } }))
    }, 2800)
    return () => clearInterval(interval)
  }, [market])

  const livePriceOf = (p: MarketParcel) => {
    const tick = ticks[p.id]
    return tick ? p.livePrice * (1 + tick.delta / 100) : p.livePrice
  }

  const landTypes = ['all', ...Array.from(new Set(market.map((p) => p.landType).filter(Boolean)))]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return market
      .filter((p) => {
        const matchSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.ticker.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          String(p.id).includes(q)
        return matchSearch && (filterType === 'all' || p.landType === filterType)
      })
      .sort((a, b) => {
        const av = a[sortKey] as number | string
        const bv = b[sortKey] as number | string
        if (typeof av === 'string' && typeof bv === 'string')
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
      })
  }, [market, search, filterType, sortKey, sortDir])

  const totalMarketCap = market.reduce((s, p) => s + p.marketCap, 0)
  const totalVolume = market.reduce((s, p) => s + p.volume24h, 0)
  const gainers = market.filter((p) => p.changePct >= 0).length
  const verifiedCount = market.filter((p) => p.verified).length
  const topMover = [...market].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0]

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const thClass =
    'px-4 py-2.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary font-medium cursor-pointer select-none hover:text-text-secondary transition-colors whitespace-nowrap'

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 size={22} className="text-text-tertiary animate-spin" />
        <span className="text-[12.5px] text-text-tertiary">Loading markets…</span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-bg-base">
      {/* ───── Ticker tape ───── */}
      {market.length > 0 && (
        <div className="border-b border-border-subtle bg-bg-sunken overflow-hidden whitespace-nowrap select-none">
          <div className="ticker-tape inline-flex items-center py-1.5">
            {[...market, ...market, ...market, ...market].map((p, i) => (
              <Link
                key={`${p.id}-${i}`}
                href={`/parcel/${p.id}`}
                className="inline-flex items-center gap-2 px-5 border-r border-border-subtle hover:bg-surface-2 transition-colors"
              >
                <span className="font-mono text-[11px] font-semibold text-text-secondary">
                  {p.ticker}
                </span>
                <span className="tnum text-[11px] text-text-primary">
                  {livePriceOf(p).toFixed(3)}
                </span>
                <span
                  className="tnum text-[10px] font-medium"
                  style={{ color: p.changePct >= 0 ? 'var(--up)' : 'var(--down)' }}
                >
                  {p.changePct >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(p.changePct).toFixed(2)}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-6">
        {/* ───── Header ───── */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-[22px] font-semibold text-text-primary tracking-[-0.01em]">
                Land Markets
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-up bg-up-bg px-2 py-0.5 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-up opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-up" />
                </span>
                LIVE
              </span>
            </div>
            <p className="text-[12.5px] text-text-tertiary">
              {market.length} tokenized parcels trading on Mantle Sepolia · settlement in seconds
            </p>
          </div>
          {topMover && (
            <Link
              href={`/parcel/${topMover.id}`}
              className="flex items-center gap-3 bg-surface-1 border border-border-default rounded-[var(--radius-md)] px-4 py-2.5 hover:bg-surface-2 transition-colors"
            >
              <Flame size={14} className="text-accent-amber shrink-0" />
              <div>
                <div className="text-[9px] uppercase tracking-[0.06em] text-text-tertiary">
                  Top Mover
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-text-primary">
                    {topMover.ticker}
                  </span>
                  <DeltaChip value={topMover.changePct} />
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* ───── Stat strip ───── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1.5">
              <CircleDollarSign size={11} /> Total Market Cap
            </div>
            <div className="tnum text-[22px] font-semibold text-text-primary leading-none">
              {totalMarketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-[12px] text-text-tertiary font-normal ml-1.5">MNT</span>
            </div>
          </div>
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1.5">
              <TrendingUp size={11} /> 24h Volume
            </div>
            <div className="tnum text-[22px] font-semibold text-text-primary leading-none">
              {totalVolume.toLocaleString()}
              <span className="text-[12px] text-text-tertiary font-normal ml-1.5">shares</span>
            </div>
          </div>
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1.5">
              <Layers size={11} /> Gainers / Losers
            </div>
            <div className="tnum text-[22px] font-semibold leading-none">
              <span className="text-up">{gainers}</span>
              <span className="text-text-tertiary text-[14px] mx-1.5">/</span>
              <span className="text-down">{market.length - gainers}</span>
            </div>
          </div>
          <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1.5">
              <ShieldCheck size={11} /> AI Verified
            </div>
            <div className="tnum text-[22px] font-semibold text-verify leading-none">
              {verifiedCount}
              <span className="text-text-tertiary text-[14px]"> / {market.length}</span>
            </div>
          </div>
        </div>

        {/* ───── Featured cards ───── */}
        {market.length > 0 && (
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-2.5">
              Featured Parcels
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[...market]
                .sort((a, b) => b.marketCap - a.marketCap)
                .slice(0, 3)
                .map((p) => {
                  const up = p.changePct >= 0
                  return (
                    <Link
                      key={p.id}
                      href={`/parcel/${p.id}`}
                      className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 hover:bg-surface-2 hover:border-border-strong transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-semibold text-text-primary group-hover:text-brand transition-colors">
                              {p.ticker}
                            </span>
                            {p.verified && <ShieldCheck size={12} className="text-verify" />}
                          </div>
                          <div className="text-[10px] text-text-tertiary mt-0.5">
                            {p.name} · {p.location}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-medium uppercase tracking-[0.05em] px-1.5 py-0.5 rounded-[var(--radius-xs)] ${
                            LAND_TYPE_COLORS[p.landType] || 'text-text-tertiary bg-surface-3'
                          }`}
                        >
                          {p.landType}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="tnum text-[22px] font-semibold text-text-primary leading-none mb-1.5">
                            {livePriceOf(p).toFixed(3)}
                            <span className="text-[11px] text-text-tertiary font-normal ml-1">
                              MNT
                            </span>
                          </div>
                          <DeltaChip value={p.changePct} />
                        </div>
                        <Sparkline data={p.spark} up={up} w={110} h={36} />
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
                        <span className="text-[10px] text-text-tertiary">
                          Cap{' '}
                          <span className="tnum text-text-secondary">
                            {p.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} MNT
                          </span>
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          Avail{' '}
                          <span className="tnum text-text-secondary">
                            {p.availableShares}/{p.totalShares}
                          </span>
                        </span>
                        <span className="tnum text-[10px]" style={{ color: 'var(--up)' }}>
                          {p.yieldPct > 0 ? `${p.yieldPct.toFixed(1)}% yield` : ''}
                        </span>
                      </div>
                    </Link>
                  )
                })}
            </div>
          </div>
        )}

        {/* ───── Toolbar ───── */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search ticker, parcel, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border-default rounded-[var(--radius-sm)] pl-8 pr-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {landTypes.map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-[var(--radius-xs)] text-[11px] font-medium transition-colors capitalize ${
                  filterType === t
                    ? 'bg-brand-bg text-brand border border-brand-border'
                    : 'bg-surface-2 text-text-secondary border border-border-default hover:text-text-primary hover:bg-surface-3'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto tnum text-[11px] text-text-tertiary">
            {filtered.length} listed
          </div>
        </div>

        {/* ───── Market table ───── */}
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="text-[14px] text-text-secondary">No parcels found</div>
              <div className="text-[12.5px] text-text-tertiary">
                Try adjusting your search or filter
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-surface-2 border-b border-border-default">
                  <th className={`${thClass} text-left`} onClick={() => handleSort('ticker')}>
                    <span className="flex items-center gap-0.5">
                      Asset <SortIcon active={sortKey === 'ticker'} dir={sortDir} />
                    </span>
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('livePrice')}>
                    <span className="flex items-center justify-end gap-0.5">
                      Last Price <SortIcon active={sortKey === 'livePrice'} dir={sortDir} />
                    </span>
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('changePct')}>
                    <span className="flex items-center justify-end gap-0.5">
                      24h <SortIcon active={sortKey === 'changePct'} dir={sortDir} />
                    </span>
                  </th>
                  <th className={`${thClass} text-center cursor-default`}>Trend</th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('marketCap')}>
                    <span className="flex items-center justify-end gap-0.5">
                      Market Cap <SortIcon active={sortKey === 'marketCap'} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className={`${thClass} text-right`}
                    onClick={() => handleSort('availableShares')}
                  >
                    <span className="flex items-center justify-end gap-0.5">
                      Avail <SortIcon active={sortKey === 'availableShares'} dir={sortDir} />
                    </span>
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => handleSort('yieldPct')}>
                    <span className="flex items-center justify-end gap-0.5">
                      Yield <SortIcon active={sortKey === 'yieldPct'} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className={`${thClass} text-right`}
                    onClick={() => handleSort('confidenceScore')}
                  >
                    <span className="flex items-center justify-end gap-0.5">
                      AI Score <SortIcon active={sortKey === 'confidenceScore'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const up = p.changePct >= 0
                  const tick = ticks[p.id]
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors group"
                    >
                      {/* Asset */}
                      <td className="px-4 py-3">
                        <Link href={`/parcel/${p.id}`} className="flex items-center gap-3">
                          <div
                            className="w-1 h-8 rounded-full shrink-0"
                            style={{ backgroundColor: DEMAND_HEAT[p.demandScore] || 'var(--heat-0)' }}
                            title={`Demand ${p.demandScore}/5`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[12.5px] font-semibold text-text-primary group-hover:text-brand transition-colors">
                                {p.ticker}
                              </span>
                              {p.verified && (
                                <ShieldCheck size={11} className="text-verify shrink-0" />
                              )}
                              <span
                                className={`text-[8.5px] font-medium uppercase tracking-[0.05em] px-1.5 py-px rounded-[var(--radius-xs)] ${
                                  LAND_TYPE_COLORS[p.landType] || 'text-text-tertiary bg-surface-3'
                                }`}
                              >
                                {p.landType?.slice(0, 3)}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-tertiary mt-0.5">
                              {p.name} · {p.areaSqFt?.toLocaleString()} sqft
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Last price w/ tick flash */}
                      <td className="px-4 py-3 text-right">
                        <span
                          key={tick?.key}
                          className={`tnum text-[13px] font-semibold text-text-primary px-1.5 py-0.5 rounded-[var(--radius-xs)] inline-block ${
                            tick ? (tick.dir === 'up' ? 'tick-up' : 'tick-down') : ''
                          }`}
                        >
                          {livePriceOf(p).toFixed(3)}
                        </span>
                        <div className="text-[9px] text-text-tertiary mt-0.5">MNT</div>
                      </td>

                      {/* 24h change */}
                      <td className="px-4 py-3 text-right">
                        <DeltaChip value={p.changePct} />
                      </td>

                      {/* Sparkline */}
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Sparkline data={p.spark} up={up} />
                        </div>
                      </td>

                      {/* Market cap */}
                      <td className="px-4 py-3 text-right">
                        <span className="tnum text-[12.5px] text-text-primary">
                          {p.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <div className="text-[9px] text-text-tertiary mt-0.5">MNT</div>
                      </td>

                      {/* Available shares */}
                      <td className="px-4 py-3 text-right">
                        <span className="tnum text-[12.5px] text-text-primary">
                          {p.availableShares.toLocaleString()}
                          <span className="text-text-tertiary">/{p.totalShares}</span>
                        </span>
                        <div className="flex justify-end mt-1">
                          <div className="w-14 h-[3px] rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{
                                width: `${p.totalShares > 0 ? (p.availableShares / p.totalShares) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Yield */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`tnum text-[12.5px] font-medium ${
                            p.yieldPct > 0 ? 'text-up' : 'text-text-tertiary'
                          }`}
                        >
                          {p.yieldPct > 0 ? `${p.yieldPct.toFixed(1)}%` : '—'}
                        </span>
                      </td>

                      {/* AI confidence */}
                      <td className="px-4 py-3">
                        <ConfidenceCell score={p.confidenceScore} />
                      </td>

                      {/* Trade button */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/parcel/${p.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium bg-up text-text-inverse opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-110"
                        >
                          Trade <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3 text-[10px] text-text-tertiary text-center">
          Trend &amp; 24h data simulated for demo · prices anchored to on-chain listing price ·
          settlement on Mantle Sepolia
        </div>
      </div>
    </div>
  )
}
