'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useVote, useContractWrite, useShareBalance } from '@/hooks/useContracts'
import { CONTRACTS, GOVERNANCE_ABI } from '@/lib/contracts'
import { useReadContract } from 'wagmi'
import {
  Vote,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Clock,
  Gavel,
} from 'lucide-react'

type Proposal = {
  id: number
  parcelId: number
  acquirer: string
  pricePerShare: string
  pricePerShareFormatted: string
  votesFor: number
  votesAgainst: number
  deadline: number
  executed: boolean
  active: boolean
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function timeRemaining(deadline: number): string {
  const diff = deadline - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Voting ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`
}

function ProposalCard({ proposal, parcelId }: { proposal: Proposal; parcelId: number }) {
  const { address } = useAccount()
  const voteTx = useVote()
  const { data: myShares } = useShareBalance(parcelId, address)
  const myShareCount = Number(myShares || BigInt(0))

  const { data: hasVoted } = useReadContract({
    address: CONTRACTS.governance as `0x${string}`,
    abi: GOVERNANCE_ABI,
    functionName: 'hasVoted',
    args: address ? [BigInt(proposal.id), address] : undefined,
    query: { enabled: !!address },
  })

  const totalVotes = proposal.votesFor + proposal.votesAgainst
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0
  const isExpired = proposal.deadline < Math.floor(Date.now() / 1000)

  return (
    <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gavel size={14} className="text-brand" />
          <span className="text-[12.5px] font-medium text-text-primary">
            Buyout Proposal #{proposal.id}
          </span>
          {proposal.executed && (
            <span className="text-[9px] font-medium uppercase px-2 py-0.5 rounded-full bg-up/20 text-up">
              Executed
            </span>
          )}
          {!proposal.active && !proposal.executed && (
            <span className="text-[9px] font-medium uppercase px-2 py-0.5 rounded-full bg-down/20 text-down">
              Closed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[9px] font-mono text-text-tertiary">
          <Clock size={10} />
          {timeRemaining(proposal.deadline)}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[9px] uppercase text-text-tertiary">Acquirer</div>
          <a
            href={`https://sepolia.mantlescan.xyz/address/${proposal.acquirer}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-brand hover:text-brand-hover inline-flex items-center gap-0.5"
          >
            {truncAddr(proposal.acquirer)} <ExternalLink size={9} />
          </a>
        </div>
        <div>
          <div className="text-[9px] uppercase text-text-tertiary">Price / Share</div>
          <div className="tnum text-[12.5px] text-text-primary">
            {proposal.pricePerShareFormatted} MNT
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-text-tertiary">Your Shares</div>
          <div className="tnum text-[12.5px] text-text-primary">
            {myShareCount} (= {myShareCount} votes)
          </div>
        </div>
      </div>

      {/* Vote progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[9px] uppercase text-text-tertiary mb-1">
          <span>For: {proposal.votesFor} shares</span>
          <span>Against: {proposal.votesAgainst} shares</span>
        </div>
        <div className="h-2 bg-bg-sunken rounded-full overflow-hidden flex">
          {totalVotes > 0 && (
            <>
              <div
                className="bg-up h-full transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="bg-down h-full transition-all"
                style={{ width: `${100 - forPct}%` }}
              />
            </>
          )}
        </div>
        <div className="text-[9px] text-text-tertiary mt-0.5 text-center">
          {totalVotes > 0 ? `${forPct.toFixed(1)}% in favor` : 'No votes yet'} — needs 51% to pass
        </div>
      </div>

      {/* Vote buttons */}
      {proposal.active && !isExpired && !hasVoted && myShareCount > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => voteTx.vote(proposal.id, true)}
            disabled={voteTx.isPending || voteTx.isConfirming}
            className="flex-1 py-2 bg-up text-text-inverse rounded-[var(--radius-sm)] text-[12.5px] font-medium hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-1.5"
          >
            {voteTx.isPending || voteTx.isConfirming ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ThumbsUp size={13} />
            )}
            Vote For
          </button>
          <button
            onClick={() => voteTx.vote(proposal.id, false)}
            disabled={voteTx.isPending || voteTx.isConfirming}
            className="flex-1 py-2 bg-down text-text-inverse rounded-[var(--radius-sm)] text-[12.5px] font-medium hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-1.5"
          >
            {voteTx.isPending || voteTx.isConfirming ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ThumbsDown size={13} />
            )}
            Vote Against
          </button>
        </div>
      )}

      {/* Already voted */}
      {hasVoted && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[12.5px] text-text-secondary">
          <CheckCircle2 size={13} className="text-up" />
          You have already voted
        </div>
      )}

      {/* No shares */}
      {!hasVoted && myShareCount === 0 && proposal.active && (
        <div className="text-center py-2 text-[11px] text-text-tertiary">
          You need shares to vote on this proposal
        </div>
      )}

      {/* Tx link */}
      {voteTx.hash && (
        <a
          href={`https://sepolia.mantlescan.xyz/tx/${voteTx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-brand hover:text-brand-hover mt-2 transition-colors"
        >
          View vote tx on MantleScan <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}

export function BuyoutProposals({ parcelId }: { parcelId: number }) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals?parcelId=${parcelId}`)
      const data = await res.json()
      if (Array.isArray(data)) setProposals(data)
    } catch {
      // keep current
    } finally {
      setLoading(false)
    }
  }, [parcelId])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  if (loading) {
    return (
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Vote size={14} className="text-brand" />
          <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
            Governance
          </span>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        </div>
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Vote size={14} className="text-brand" />
          <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
            Governance
          </span>
        </div>
        <div className="text-[12.5px] text-text-tertiary text-center py-2">
          No active buyout proposals
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Vote size={14} className="text-brand" />
        <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
          Buyout Proposals
        </span>
        <span className="text-[10px] font-medium text-brand bg-brand-bg px-2 py-0.5 rounded-full ml-auto">
          {proposals.length}
        </span>
      </div>
      <div className="space-y-3">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} parcelId={parcelId} />
        ))}
      </div>
    </div>
  )
}
