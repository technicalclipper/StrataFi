'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import {
  CONTRACTS,
  SHARE_TOKEN_ABI,
  MARKETPLACE_ABI,
  YIELD_SPLITTER_ABI,
  GOVERNANCE_ABI,
  PARCEL_REGISTRY_ABI,
} from '@/lib/contracts'

// ─── Read: share balance ───
export function useShareBalance(parcelId: number, address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.shareToken as `0x${string}`,
    abi: SHARE_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address, BigInt(parcelId)] : undefined,
    query: { enabled: !!address },
  })
}

// ─── Read: primary sale info ───
export function usePrimarySale(parcelId: number) {
  return useReadContract({
    address: CONTRACTS.marketplace as `0x${string}`,
    abi: MARKETPLACE_ABI,
    functionName: 'primarySales',
    args: [BigInt(parcelId)],
  })
}

// ─── Read: claimable yield ───
export function useClaimableYield(parcelId: number, address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.yieldSplitter as `0x${string}`,
    abi: YIELD_SPLITTER_ABI,
    functionName: 'claimable',
    args: address ? [BigInt(parcelId), address] : undefined,
    query: { enabled: !!address },
  })
}

// ─── Read: on-chain parcel ───
export function useOnChainParcel(parcelId: number) {
  return useReadContract({
    address: CONTRACTS.parcelRegistry as `0x${string}`,
    abi: PARCEL_REGISTRY_ABI,
    functionName: 'getParcel',
    args: [BigInt(parcelId)],
  })
}

// ─── Read: governance proposal ───
export function useProposal(proposalId: number) {
  return useReadContract({
    address: CONTRACTS.governance as `0x${string}`,
    abi: GOVERNANCE_ABI,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
    query: { enabled: proposalId > 0 },
  })
}

// ─── Write hook wrapper with receipt tracking ───
export function useContractWrite() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  return { writeContract, hash, isPending, isConfirming, isSuccess, error, reset }
}

// ─── Convenience: buy primary shares ───
export function useBuyPrimary() {
  const tx = useContractWrite()

  const buy = (parcelId: number, amount: number, pricePerShareMNT: number) => {
    const totalWei = parseEther((amount * pricePerShareMNT).toString())
    tx.writeContract({
      address: CONTRACTS.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: 'buyPrimary',
      args: [BigInt(parcelId), BigInt(amount)],
      value: totalWei,
    })
  }

  return { buy, ...tx }
}

// ─── Convenience: create offer ───
export function useCreateOffer() {
  const tx = useContractWrite()

  const createOffer = (
    parcelId: number,
    targetHolder: `0x${string}`,
    amount: number,
    pricePerShareMNT: number,
  ) => {
    const totalWei = parseEther((amount * pricePerShareMNT).toString())
    tx.writeContract({
      address: CONTRACTS.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: 'createOffer',
      args: [BigInt(parcelId), targetHolder, BigInt(amount), parseEther(pricePerShareMNT.toString())],
      value: totalWei,
    })
  }

  return { createOffer, ...tx }
}

// ─── Convenience: create secondary listing ───
export function useCreateListing() {
  const tx = useContractWrite()

  const createListing = (parcelId: number, amount: number, pricePerShareMNT: number) => {
    tx.writeContract({
      address: CONTRACTS.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: 'createListing',
      args: [BigInt(parcelId), BigInt(amount), parseEther(pricePerShareMNT.toString())],
    })
  }

  return { createListing, ...tx }
}

// ─── Convenience: claim yield ───
export function useClaimYield() {
  const tx = useContractWrite()

  const claim = (parcelId: number) => {
    tx.writeContract({
      address: CONTRACTS.yieldSplitter as `0x${string}`,
      abi: YIELD_SPLITTER_ABI,
      functionName: 'claim',
      args: [BigInt(parcelId)],
    })
  }

  return { claim, ...tx }
}

// ─── Convenience: approve marketplace for shares ───
export function useApproveMarketplace() {
  const tx = useContractWrite()

  const approve = () => {
    tx.writeContract({
      address: CONTRACTS.shareToken as `0x${string}`,
      abi: SHARE_TOKEN_ABI,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.marketplace as `0x${string}`, true],
    })
  }

  return { approve, ...tx }
}

// ─── Convenience: governance propose buyout ───
export function useProposeBuyout() {
  const tx = useContractWrite()

  const propose = (parcelId: number, pricePerShareMNT: number, remainingShares: number) => {
    const escrowWei = parseEther((remainingShares * pricePerShareMNT).toString())
    tx.writeContract({
      address: CONTRACTS.governance as `0x${string}`,
      abi: GOVERNANCE_ABI,
      functionName: 'proposeBuyout',
      args: [BigInt(parcelId), parseEther(pricePerShareMNT.toString())],
      value: escrowWei,
    })
  }

  return { propose, ...tx }
}

// ─── Convenience: governance vote ───
export function useVote() {
  const tx = useContractWrite()

  const vote = (proposalId: number, support: boolean) => {
    tx.writeContract({
      address: CONTRACTS.governance as `0x${string}`,
      abi: GOVERNANCE_ABI,
      functionName: 'vote',
      args: [BigInt(proposalId), support],
    })
  }

  return { vote, ...tx }
}

// ─── Convenience: check approval ───
export function useIsApprovedForAll(owner?: `0x${string}`, operator?: `0x${string}`) {
  return useReadContract({
    address: CONTRACTS.shareToken as `0x${string}`,
    abi: SHARE_TOKEN_ABI,
    functionName: 'isApprovedForAll',
    args: owner && operator ? [owner, operator] : undefined,
    query: { enabled: !!owner && !!operator },
  })
}

export { formatEther, parseEther }
