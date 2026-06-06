/**
 * GET /api/price-history?parcelId=3
 * Returns price points from PrimaryPurchase + ListingFilled events.
 * Paginates in 5000-block chunks (Mantle Sepolia RPC limit).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther, parseAbiItem } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS } from '@/lib/contracts'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const CHUNK_SIZE = BigInt(5000)
const MAX_LOOKBACK = BigInt(200000)

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLog = { args: any; blockNumber: bigint | null; transactionHash: string | null }

async function paginatedGetLogs(
  publicClient: ReturnType<typeof createPublicClient>,
  address: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  startBlock: bigint,
  endBlock: bigint,
): Promise<AnyLog[]> {
  const allLogs: AnyLog[] = []
  for (let from = startBlock; from < endBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE > endBlock ? endBlock : from + CHUNK_SIZE
    try {
      const logs = await publicClient.getLogs({ address: address as `0x${string}`, event, fromBlock: from, toBlock: to })
      allLogs.push(...(logs as unknown as AnyLog[]))
    } catch {
      // skip failed chunk
    }
  }
  return allLogs
}

export async function GET(request: NextRequest) {
  try {
    const parcelId = request.nextUrl.searchParams.get('parcelId')
    if (!parcelId) {
      return NextResponse.json({ error: 'parcelId required' }, { status: 400 })
    }

    const pid = BigInt(parcelId)

    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const currentBlock = await publicClient.getBlockNumber()
    const startBlock = currentBlock > MAX_LOOKBACK ? currentBlock - MAX_LOOKBACK : BigInt(0)

    // Fetch primary purchases and secondary fills
    const [primaryLogs, fillLogs] = await Promise.all([
      paginatedGetLogs(
        publicClient,
        CONTRACTS.marketplace,
        parseAbiItem('event PrimaryPurchase(uint256 indexed parcelId, address indexed buyer, uint256 amount, uint256 totalPaid)'),
        startBlock,
        currentBlock,
      ),
      paginatedGetLogs(
        publicClient,
        CONTRACTS.marketplace,
        parseAbiItem('event ListingFilled(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPaid)'),
        startBlock,
        currentBlock,
      ),
    ])

    type PricePoint = { block: number; price: number; amount: number; type: string }
    const points: PricePoint[] = []

    for (const log of primaryLogs) {
      if (log.args.parcelId !== pid) continue
      const amount = Number(log.args.amount || BigInt(1))
      const totalPaid = log.args.totalPaid as bigint
      const pricePerShare = parseFloat(formatEther(totalPaid)) / amount
      points.push({
        block: Number(log.blockNumber || BigInt(0)),
        price: pricePerShare,
        amount,
        type: 'primary',
      })
    }

    for (const log of fillLogs) {
      // ListingFilled doesn't have parcelId directly, include all for now
      const amount = Number(log.args.amount || BigInt(1))
      const totalPaid = log.args.totalPaid as bigint
      const pricePerShare = parseFloat(formatEther(totalPaid)) / amount
      points.push({
        block: Number(log.blockNumber || BigInt(0)),
        price: pricePerShare,
        amount,
        type: 'secondary',
      })
    }

    // Sort by block ascending
    points.sort((a, b) => a.block - b.block)

    return NextResponse.json(points)
  } catch (error) {
    console.error('Price history API error:', error)
    return NextResponse.json([])
  }
}
