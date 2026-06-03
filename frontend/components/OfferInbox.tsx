'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useContractWrite, useIsApprovedForAll } from '@/hooks/useContracts'
import { CONTRACTS, MARKETPLACE_ABI, SHARE_TOKEN_ABI } from '@/lib/contracts'
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Clock,
  RefreshCw,
} from 'lucide-react'

type OfferData = {
  offerId: number
  buyer: string
  parcelName: string
  parcelId: number
  shares: number
  pricePerShare: string
  pricePerShareFormatted: string
  expiry: number
  totalValue: string
  totalValueFormatted: string
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function timeRemaining(expiry: number): string {
  const diff = expiry - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return `${h}h ${m}m`
}

export function OfferInbox() {
  const { address, isConnected } = useAccount()
  const [offers, setOffers] = useState<OfferData[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [action, setAction] = useState<'accept' | 'reject' | null>(null)

  const approveTx = useContractWrite()
  const acceptTx = useContractWrite()
  const rejectTx = useContractWrite()
  const [pendingAcceptOffer, setPendingAcceptOffer] = useState<OfferData | null>(null)

  const { data: isApproved, refetch: refetchApproval } = useIsApprovedForAll(
    address,
    CONTRACTS.marketplace as `0x${string}`,
  )

  const fetchOffers = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch(`/api/offers?holder=${address}`)
      const data = await res.json()
      if (Array.isArray(data)) setOffers(data)
    } catch {
      // keep current
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) fetchOffers()
  }, [isConnected, address, fetchOffers])

  // Refetch after accept/reject succeeds
  const activeTx = action === 'accept' ? acceptTx : rejectTx
  useEffect(() => {
    if (activeTx.isSuccess) {
      const t = setTimeout(() => {
        fetchOffers()
        setProcessingId(null)
        setAction(null)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [activeTx.isSuccess, fetchOffers])

  const handleAccept = (offer: OfferData) => {
    setProcessingId(offer.offerId)
    setAction('accept')
    if (!isApproved) {
      // Need to approve marketplace first, then accept
      setPendingAcceptOffer(offer)
      approveTx.writeContract({
        address: CONTRACTS.shareToken as `0x${string}`,
        abi: SHARE_TOKEN_ABI,
        functionName: 'setApprovalForAll',
        args: [CONTRACTS.marketplace as `0x${string}`, true],
      })
    } else {
      acceptTx.writeContract({
        address: CONTRACTS.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'acceptOffer',
        args: [BigInt(offer.offerId)],
      })
    }
  }

  // After approval succeeds, auto-accept the pending offer
  useEffect(() => {
    if (approveTx.isSuccess && pendingAcceptOffer) {
      refetchApproval()
      acceptTx.writeContract({
        address: CONTRACTS.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'acceptOffer',
        args: [BigInt(pendingAcceptOffer.offerId)],
      })
      setPendingAcceptOffer(null)
    }
  }, [approveTx.isSuccess])

  const handleReject = (offer: OfferData) => {
    setProcessingId(offer.offerId)
    setAction('reject')
    rejectTx.writeContract({
      address: CONTRACTS.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: 'rejectOffer',
      args: [BigInt(offer.offerId)],
    })
  }

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <div className="text-text-tertiary text-[14px]">
          Connect wallet to view offers
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Inbox size={16} className="text-brand" />
        <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
          Incoming Offers
        </span>
        <span className="ml-auto text-[10px] font-medium text-brand bg-brand-bg px-2 py-0.5 rounded-full">
          {offers.length}
        </span>
        <button
          onClick={fetchOffers}
          disabled={loading}
          className="text-text-tertiary hover:text-text-primary transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && offers.length === 0 ? (
        <div className="text-center py-8">
          <Loader2 size={20} className="mx-auto mb-2 text-text-tertiary animate-spin" />
          <div className="text-[12.5px] text-text-tertiary">Loading on-chain offers...</div>
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-8">
          <Inbox size={24} className="mx-auto mb-2 text-text-tertiary" />
          <div className="text-[12.5px] text-text-tertiary">No pending offers</div>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const isProcessing = processingId === offer.offerId
            const isPending =
              isProcessing && (activeTx.isPending || activeTx.isConfirming || approveTx.isPending || approveTx.isConfirming)

            return (
              <div
                key={offer.offerId}
                className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12.5px] font-medium text-text-primary">
                    {offer.parcelName}
                  </span>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-text-tertiary">
                    <Clock size={10} />
                    {timeRemaining(offer.expiry)}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <div className="text-[9px] uppercase text-text-tertiary">
                      From
                    </div>
                    <div className="font-mono text-[11px] text-text-secondary">
                      {truncAddr(offer.buyer)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase text-text-tertiary">
                      Shares
                    </div>
                    <div className="tnum text-[12.5px] text-text-primary">
                      {offer.shares}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase text-text-tertiary">
                      Price/Share
                    </div>
                    <div className="tnum text-[12.5px] text-text-primary">
                      {offer.pricePerShareFormatted} MNT
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between py-2 border-t border-border-subtle mb-3">
                  <span className="text-[10px] text-text-tertiary">
                    Total Value
                  </span>
                  <span className="tnum text-[14px] font-semibold text-up">
                    {offer.totalValueFormatted} MNT
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(offer)}
                    disabled={isPending}
                    className="flex-1 py-2 bg-up text-text-inverse rounded-[var(--radius-sm)] text-[12.5px] font-medium hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    {isProcessing && action === 'accept' && isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : isProcessing && action === 'accept' && activeTx.isSuccess ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    {isProcessing && action === 'accept' && activeTx.isSuccess
                      ? 'Accepted'
                      : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleReject(offer)}
                    disabled={isPending}
                    className="flex-1 py-2 bg-surface-2 text-text-secondary border border-border-default rounded-[var(--radius-sm)] text-[12.5px] font-medium hover:bg-surface-3 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    {isProcessing && action === 'reject' && isPending ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <XCircle size={13} />
                    )}
                    Reject
                  </button>
                </div>

                {/* Tx link */}
                {isProcessing && activeTx.hash && (
                  <a
                    href={`https://sepolia.mantlescan.xyz/tx/${activeTx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-[10px] text-brand hover:text-brand-hover mt-2 transition-colors"
                  >
                    View on MantleScan <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
