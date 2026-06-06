/**
 * GET /api/proposals?parcelId=3
 * Reads all active buyout proposals for a parcel from the Governance contract.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, GOVERNANCE_ABI } from '@/lib/contracts'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const parcelId = request.nextUrl.searchParams.get('parcelId')

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const nextId = await publicClient.readContract({
      address: CONTRACTS.governance as `0x${string}`,
      abi: GOVERNANCE_ABI,
      functionName: 'nextProposalId',
    }) as bigint

    const count = Number(nextId)
    if (count <= 1) {
      return NextResponse.json([])
    }

    const proposals = []
    for (let i = 1; i < count; i++) {
      const p = await publicClient.readContract({
        address: CONTRACTS.governance as `0x${string}`,
        abi: GOVERNANCE_ABI,
        functionName: 'getProposal',
        args: [BigInt(i)],
      }) as {
        id: bigint
        parcelId: bigint
        acquirer: string
        pricePerShare: bigint
        votesFor: bigint
        votesAgainst: bigint
        deadline: bigint
        executed: boolean
        active: boolean
      }

      // Filter by parcelId if specified
      if (parcelId && Number(p.parcelId) !== Number(parcelId)) continue

      proposals.push({
        id: Number(p.id),
        parcelId: Number(p.parcelId),
        acquirer: p.acquirer,
        pricePerShare: p.pricePerShare.toString(),
        pricePerShareFormatted: formatEther(p.pricePerShare),
        votesFor: Number(p.votesFor),
        votesAgainst: Number(p.votesAgainst),
        deadline: Number(p.deadline),
        executed: p.executed,
        active: p.active,
      })
    }

    return NextResponse.json(proposals)
  } catch (error) {
    console.error('Proposals API error:', error)
    return NextResponse.json([])
  }
}
