/**
 * GET /api/holders?parcelId=2
 * Reads TransferSingle events from ShareToken to build a real holder map for a parcel.
 * Returns all addresses holding shares and their balances.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, SHARE_TOKEN_ABI } from '@/lib/contracts'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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

    const currentBlock = await publicClient.getBlockNumber()
    const fromBlock = currentBlock > BigInt(100000) ? currentBlock - BigInt(100000) : BigInt(0)

    // Get all TransferSingle events for this token ID (parcel)
    const logs = await publicClient.getLogs({
      address: CONTRACTS.shareToken as `0x${string}`,
      event: parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'),
      fromBlock,
    })

    // Filter for this parcelId and collect unique addresses
    const pid = BigInt(parcelId)
    const addresses = new Set<string>()

    for (const log of logs) {
      const args = log.args as { from?: string; to?: string; id?: bigint }
      if (args.id !== pid) continue
      if (args.from && args.from !== ZERO_ADDRESS) addresses.add(args.from)
      if (args.to && args.to !== ZERO_ADDRESS) addresses.add(args.to)
    }

    // Read actual balances for each address
    const holders: { address: string; shares: number }[] = []

    for (const addr of addresses) {
      try {
        const balance = await publicClient.readContract({
          address: CONTRACTS.shareToken as `0x${string}`,
          abi: SHARE_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [addr as `0x${string}`, pid],
        }) as bigint
        if (balance > BigInt(0)) {
          holders.push({ address: addr, shares: Number(balance) })
        }
      } catch {
        // skip
      }
    }

    // Sort by shares descending
    holders.sort((a, b) => b.shares - a.shares)

    return NextResponse.json(holders)
  } catch (error) {
    console.error('Holders API error:', error)
    return NextResponse.json([])
  }
}
