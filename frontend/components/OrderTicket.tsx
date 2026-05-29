'use client'

import { useState } from 'react'
import type { ParcelData } from '@/lib/seed-parcels'

type Tab = 'buy' | 'offer' | 'sell'

export function OrderTicket({ parcel }: { parcel: ParcelData }) {
  const [tab, setTab] = useState<Tab>('buy')
  const [shares, setShares] = useState(1)
  const [offerPrice, setOfferPrice] = useState(parcel.pricePerShare)

  const total = tab === 'offer' ? shares * offerPrice : shares * parcel.pricePerShare

  return (
    <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
      {/* Tabs */}
      <div className="flex border-b border-border-subtle mb-4">
        {(['buy', 'offer', 'sell'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[12.5px] font-medium uppercase tracking-[0.04em] border-b-2 transition-colors ${
              tab === t
                ? t === 'sell'
                  ? 'text-down border-down'
                  : 'text-up border-up'
                : 'text-text-tertiary border-transparent hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Shares input */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
          Shares
        </label>
        <div className="flex items-center border border-border-default rounded-[var(--radius-sm)] bg-bg-sunken overflow-hidden">
          <button
            onClick={() => setShares(Math.max(1, shares - 1))}
            className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={parcel.availableShares}
            value={shares}
            onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
            className="flex-1 bg-transparent text-center tnum text-[14px] text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => setShares(Math.min(parcel.availableShares, shares + 1))}
            className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            +
          </button>
        </div>
        <div className="text-[10px] text-text-tertiary mt-1">
          {parcel.availableShares} available
        </div>
      </div>

      {/* Price per share (editable for offer) */}
      {tab === 'offer' && (
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Offer Price / Share
          </label>
          <div className="flex items-center border border-border-default rounded-[var(--radius-sm)] bg-bg-sunken px-3 py-2">
            <input
              type="number"
              step={0.01}
              min={0.01}
              value={offerPrice}
              onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0.01)}
              className="flex-1 bg-transparent tnum text-[14px] text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[11px] text-text-tertiary ml-2">MNT</span>
          </div>
        </div>
      )}

      {/* Price display (buy/sell) */}
      {tab !== 'offer' && (
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Price / Share
          </label>
          <div className="tnum text-[14px] text-text-primary">
            {parcel.pricePerShare} MNT
          </div>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between py-3 border-t border-border-subtle mb-4">
        <span className="text-[11px] text-text-secondary">Total</span>
        <span className="tnum text-[16px] font-semibold text-text-primary">
          {total.toFixed(4)} MNT
        </span>
      </div>

      {/* Submit */}
      <button
        className={`w-full py-2.5 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors ${
          tab === 'sell'
            ? 'bg-down text-text-inverse hover:brightness-110'
            : 'bg-up text-text-inverse hover:brightness-110'
        }`}
      >
        {tab === 'buy'
          ? `Buy ${shares} Share${shares > 1 ? 's' : ''}`
          : tab === 'offer'
            ? `Place Offer`
            : `Sell ${shares} Share${shares > 1 ? 's' : ''}`}
      </button>

      {/* Gas estimate */}
      <div className="text-[10px] text-text-tertiary text-center mt-2 tnum">
        ~ 0.0003 MNT gas on Mantle
      </div>
    </div>
  )
}
