/**
 * GET /api/portfolio?address=0x...
 * Returns the user's real share holdings across all parcels
 * by reading balanceOf from the ShareToken contract.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, SHARE_TOKEN_ABI } from '@/lib/contracts'
import { readFileSync } from 'fs'
import { join } from 'path'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')
    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 })
    }

    // Read all parcels
    let parcels: { id: number; name: string; location: string; pricePerShare: number; totalShares: number; confidenceScore: number; [k: string]: unknown }[] = []
    try {
      parcels = JSON.parse(readFileSync(PARCELS_FILE, 'utf-8'))
    } catch {
      return NextResponse.json([])
    }

    if (parcels.length === 0) return NextResponse.json([])

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    // Check balance for each parcel
    const holdings = []
    for (const p of parcels) {
      try {
        const balance = await publicClient.readContract({
          address: CONTRACTS.shareToken as `0x${string}`,
          abi: SHARE_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`, BigInt(p.id)],
        }) as bigint

        const shares = Number(balance)
        if (shares > 0) {
          holdings.push({
            parcelId: p.id,
            name: p.name,
            location: p.location,
            shares,
            totalShares: p.totalShares,
            pricePerShare: p.pricePerShare,
            currentValue: shares * p.pricePerShare,
            confidenceScore: p.confidenceScore,
            ownershipPct: (shares / p.totalShares) * 100,
          })
        }
      } catch {
        // skip
      }
    }

    return NextResponse.json(holdings)
  } catch (error) {
    console.error('Portfolio API error:', error)
    return NextResponse.json([])
  }
}
