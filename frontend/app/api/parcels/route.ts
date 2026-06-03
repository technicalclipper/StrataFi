/**
 * GET /api/parcels
 * Returns all minted parcels, enriched with live on-chain share balances
 */

import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createPublicClient, http } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, SHARE_TOKEN_ABI } from '@/lib/contracts'
import { privateKeyToAccount } from 'viem/accounts'

const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')
const RPC_URL = 'https://rpc.sepolia.mantle.xyz'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const raw = readFileSync(PARCELS_FILE, 'utf-8')
    const parcels = JSON.parse(raw)

    // Read deployer address (the primary sale pool holder)
    const pk = process.env.DEPLOYER_PRIVATE_KEY
    if (!pk || parcels.length === 0) {
      return NextResponse.json(parcels)
    }

    const deployerAddr = privateKeyToAccount(pk as `0x${string}`).address
    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    // Fetch deployer's balance for each parcel (= available shares)
    const enriched = await Promise.all(
      parcels.map(async (p: { id: number; totalShares: number; [k: string]: unknown }) => {
        try {
          const balance = await publicClient.readContract({
            address: CONTRACTS.shareToken as `0x${string}`,
            abi: SHARE_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [deployerAddr, BigInt(p.id)],
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
