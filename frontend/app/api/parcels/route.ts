/**
 * GET /api/parcels
 * Returns all minted parcels, enriched with live on-chain share balances.
 * Reads the seller address from parcels.json (not env) to check available shares.
 */

import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createPublicClient, http } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, SHARE_TOKEN_ABI } from '@/lib/contracts'

const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')
const RPC_URL = 'https://rpc.sepolia.mantle.xyz'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const raw = readFileSync(PARCELS_FILE, 'utf-8')
    const parcels = JSON.parse(raw)

    if (parcels.length === 0) {
      return NextResponse.json(parcels)
    }

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    // Fetch deployer's balance for each parcel (deployer = backend signer who holds minted shares)
    const enriched = await Promise.all(
      parcels.map(async (p: { id: number; totalShares: number; deployer?: string; seller?: string; [k: string]: unknown }) => {
        const poolHolder = p.deployer || p.seller
        if (!poolHolder) return p
        try {
          const balance = await publicClient.readContract({
            address: CONTRACTS.shareToken as `0x${string}`,
            abi: SHARE_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [poolHolder as `0x${string}`, BigInt(p.id)],
          })
          return { ...p, availableShares: Number(balance) }
        } catch {
          return p
        }
      }),
    )

    return NextResponse.json(enriched)
  } catch {
    return NextResponse.json([])
  }
}
