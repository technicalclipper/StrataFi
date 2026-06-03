'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import type { ParcelData } from '@/lib/seed-parcels'
import { useBuyPrimary, useCreateOffer, useCreateListing, useApproveMarketplace, useIsApprovedForAll, useShareBalance } from '@/hooks/useContracts'
import { CONTRACTS } from '@/lib/contracts'
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react'

type Tab = 'buy' | 'offer' | 'sell'

export function OrderTicket({ parcel }: { parcel: ParcelData }) {
  const { address, isConnected } = useAccount()
  const [tab, setTab] = useState<Tab>('buy')
  const [shares, setShares] = useState(1)
  const [offerPrice, setOfferPrice] = useState(parcel.pricePerShare)
  const [targetHolder, setTargetHolder] = useState(parcel.seller)

  const buyTx = useBuyPrimary()
  const offerTx = useCreateOffer()
  const listTx = useCreateListing()
  const approveTx = useApproveMarketplace()

  const { data: isApproved } = useIsApprovedForAll(
    address,
    CONTRACTS.marketplace as `0x${string}`,
  )
  const { data: myBalance } = useShareBalance(parcel.id, address)

  const total = tab === 'offer' ? shares * offerPrice : shares * parcel.pricePerShare

  const activeTx = tab === 'buy' ? buyTx : tab === 'offer' ? offerTx : listTx
  const isPending = activeTx.isPending || activeTx.isConfirming

  const handleSubmit = () => {
    if (!isConnected) return

    if (tab === 'buy') {
      buyTx.buy(parcel.id, shares, parcel.pricePerShare)
    } else if (tab === 'offer') {
      offerTx.createOffer(
        parcel.id,
        targetHolder as `0x${string}`,
        shares,
        offerPrice,
      )
    } else {
      // Sell = create listing; need approval first
      if (!isApproved) {
        approveTx.approve()
        return
      }
      listTx.createListing(parcel.id, shares, parcel.pricePerShare)
    }
  }

  // After approval succeeds, auto-create the listing
  useEffect(() => {
    if (approveTx.isSuccess && tab === 'sell') {
      listTx.createListing(parcel.id, shares, parcel.pricePerShare)
    }
  }, [approveTx.isSuccess])

  const buttonLabel = () => {
    if (!isConnected) return 'Connect Wallet'
    if (isPending) return 'Confirming...'
    if (activeTx.isSuccess) return 'Success!'
    if (tab === 'sell' && !isApproved && !approveTx.isPending) return 'Approve & List'
    if (tab === 'buy') return `Buy ${shares} Share${shares > 1 ? 's' : ''}`
    if (tab === 'offer') return 'Place Offer'
    return `List ${shares} Share${shares > 1 ? 's' : ''}`
  }

  return (
    <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
      {/* Tabs */}
      <div className="flex border-b border-border-subtle mb-4">
        {(['buy', 'offer', 'sell'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); activeTx.reset?.() }}
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
            max={tab === 'sell' ? Number(myBalance || 0) : parcel.availableShares}
            value={shares}
            onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
            className="flex-1 bg-transparent text-center tnum text-[14px] text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() =>
              setShares(
                Math.min(
                  tab === 'sell' ? Number(myBalance || 0) : parcel.availableShares,
                  shares + 1,
                ),
              )
            }
            className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            +
          </button>
        </div>
        <div className="text-[10px] text-text-tertiary mt-1">
          {tab === 'sell'
            ? `${myBalance?.toString() || '0'} owned`
            : `${parcel.availableShares} available`}
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

      {/* Target holder for offer */}
      {tab === 'offer' && (
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Target Holder
          </label>
          <input
            value={targetHolder}
            onChange={(e) => setTargetHolder(e.target.value)}
            className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[11px] text-text-primary font-mono outline-none focus:border-brand"
            placeholder="0x..."
          />
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
        onClick={handleSubmit}
        disabled={isPending || activeTx.isSuccess || !isConnected}
        className={`w-full py-2.5 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
          activeTx.isSuccess
            ? 'bg-up text-text-inverse'
            : tab === 'sell'
              ? 'bg-down text-text-inverse hover:brightness-110'
              : 'bg-up text-text-inverse hover:brightness-110'
        }`}
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        {activeTx.isSuccess && <CheckCircle2 size={14} />}
        {buttonLabel()}
      </button>

      {/* Tx hash link */}
      {activeTx.hash && (
        <a
          href={`https://sepolia.mantlescan.xyz/tx/${activeTx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-brand hover:text-brand-hover mt-2 transition-colors"
        >
          View on MantleScan <ExternalLink size={10} />
        </a>
      )}

      {/* Error */}
      {activeTx.error && (
        <div className="text-[10px] text-down text-center mt-2 truncate">
          {(activeTx.error as Error).message?.slice(0, 80)}
        </div>
      )}

      {/* Gas estimate */}
      {!activeTx.hash && (
        <div className="text-[10px] text-text-tertiary text-center mt-2 tnum">
          ~ 0.0003 MNT gas on Mantle
        </div>
      )}
    </div>
  )
}
