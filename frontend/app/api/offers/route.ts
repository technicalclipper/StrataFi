/**
 * GET /api/offers
 * Reads all active offers from the Marketplace contract on-chain.
 * Query param: ?holder=0x... to filter offers targeting a specific address
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, MARKETPLACE_ABI } from '@/lib/contracts'
import { readFileSync } from 'fs'
import { join } from 'path'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')

export const dynamic = 'force-dynamic'

function getParcels(): { id: number; name: string }[] {
  try {
    return JSON.parse(readFileSync(PARCELS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const holder = request.nextUrl.searchParams.get('holder')?.toLowerCase()

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const nextOfferId = await publicClient.readContract({
      address: CONTRACTS.marketplace as `0x${string}`,
      abi: MARKETPLACE_ABI,
      functionName: 'nextOfferId',
    }) as bigint

    const count = Number(nextOfferId)
    if (count <= 1) {
      return NextResponse.json([])
    }

    const parcels = getParcels()

    const offers = []
    for (let i = 1; i < count; i++) {
      const offer = await publicClient.readContract({
        address: CONTRACTS.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'offers',
        args: [BigInt(i)],
      }) as [string, string, bigint, bigint, bigint, bigint, boolean]

      const [buyer, targetHolder, parcelId, amount, pricePerShare, expiry, active] = offer

      if (!active) continue
      if (holder && targetHolder.toLowerCase() !== holder) continue

      const parcel = parcels.find((p) => p.id === Number(parcelId))

      offers.push({
        offerId: i,
        buyer,
        targetHolder,
        parcelId: Number(parcelId),
        parcelName: parcel?.name || `Parcel #${parcelId}`,
        shares: Number(amount),
        pricePerShare: pricePerShare.toString(),
        pricePerShareFormatted: formatEther(pricePerShare),
        expiry: Number(expiry),
        totalValue: (pricePerShare * amount).toString(),
        totalValueFormatted: formatEther(pricePerShare * amount),
      })
    }

    return NextResponse.json(offers)
  } catch (error) {
    console.error('Offers API error:', error)
    return NextResponse.json([])
  }
}
