/**
 * GET /api/holders?parcelId=2
 * Builds a real holder map by paginating through TransferSingle events
 * in 5000-block chunks (Mantle Sepolia RPC limit), then reading balanceOf.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, SHARE_TOKEN_ABI } from '@/lib/contracts'
import { readFileSync } from 'fs'
import { join } from 'path'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')
const CHUNK_SIZE = BigInt(5000)
// How far back to search (200k blocks ≈ covers deployment + all activity)
const MAX_LOOKBACK = BigInt(200000)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const parcelId = request.nextUrl.searchParams.get('parcelId')
    if (!parcelId) {
      return NextResponse.json({ error: 'parcelId required' }, { status: 400 })
    }

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const pid = BigInt(parcelId)
    const addresses = new Set<string>()

    // 1. Read deployer + seller from parcels.json
    let deployerAddr: string | null = null
    try {
      const parcels = JSON.parse(readFileSync(PARCELS_FILE, 'utf-8'))
      const parcel = parcels.find((p: { id: number }) => p.id === Number(parcelId))
      if (parcel?.deployer) {
        addresses.add(parcel.deployer)
        deployerAddr = parcel.deployer.toLowerCase()
      }
      if (parcel?.seller) addresses.add(parcel.seller)
    } catch {
      // no local data
    }

    // 2. Paginate through TransferSingle events in 5000-block chunks
    const currentBlock = await publicClient.getBlockNumber()
    const startBlock = currentBlock > MAX_LOOKBACK ? currentBlock - MAX_LOOKBACK : BigInt(0)

    const transferEvent = parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)')

    for (let from = startBlock; from < currentBlock; from += CHUNK_SIZE) {
      const to = from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACTS.shareToken as `0x${string}`,
          event: transferEvent,
          fromBlock: from,
          toBlock: to,
        })
        for (const log of logs) {
          const args = log.args as { from?: string; to?: string; id?: bigint }
          if (args.id !== pid) continue
          if (args.from && args.from !== ZERO_ADDRESS) addresses.add(args.from)
          if (args.to && args.to !== ZERO_ADDRESS) addresses.add(args.to)
        }
      } catch {
        // skip failed chunk
      }
    }

    // 3. Read actual balanceOf for every collected address
    const holders: { address: string; shares: number; role: 'deployer' | 'investor' }[] = []

    for (const addr of addresses) {
      try {
        const balance = await publicClient.readContract({
          address: CONTRACTS.shareToken as `0x${string}`,
          abi: SHARE_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [addr as `0x${string}`, pid],
        }) as bigint
        if (balance > BigInt(0)) {
          const role = (deployerAddr && addr.toLowerCase() === deployerAddr) ? 'deployer' as const : 'investor' as const
          holders.push({ address: addr, shares: Number(balance), role })
        }
      } catch {
        // skip
      }
    }

    // Sort: investors first (by shares desc), deployer last
    holders.sort((a, b) => {
      if (a.role === 'deployer' && b.role !== 'deployer') return 1
      if (a.role !== 'deployer' && b.role === 'deployer') return -1
      return b.shares - a.shares
    })

    return NextResponse.json(holders)
  } catch (error) {
    console.error('Holders API error:', error)
    return NextResponse.json([])
  }
}
