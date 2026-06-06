/**
 * GET /api/activity
 * Reads real on-chain event logs from all StrataFi contracts on Mantle Sepolia.
 * Paginates in 5000-block chunks (RPC limit) over the last 200k blocks.
 * Returns a unified activity feed sorted by block number (most recent first).
 */

import { NextResponse } from 'next/server'
import { createPublicClient, http, formatEther, parseAbiItem } from 'viem'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS } from '@/lib/contracts'
import { readFileSync } from 'fs'
import { join } from 'path'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')
const CHUNK_SIZE = BigInt(5000)
const MAX_LOOKBACK = BigInt(200000)

export const dynamic = 'force-dynamic'

function getParcels(): { id: number; name: string }[] {
  try {
    return JSON.parse(readFileSync(PARCELS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function parcelName(parcels: { id: number; name: string }[], id: number): string {
  return parcels.find((p) => p.id === id)?.name || `Parcel #${id}`
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

type EventDef = { address: string; event: ReturnType<typeof parseAbiItem> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLog = { args: any; transactionHash: string | null; blockNumber: bigint | null }

// Helper to paginate getLogs across chunks (Mantle Sepolia limits ~5000 blocks per call)
async function paginatedGetLogs(
  publicClient: ReturnType<typeof createPublicClient>,
  def: EventDef,
  startBlock: bigint,
  endBlock: bigint,
): Promise<AnyLog[]> {
  const allLogs: AnyLog[] = []
  for (let from = startBlock; from < endBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE > endBlock ? endBlock : from + CHUNK_SIZE
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs = await publicClient.getLogs({ address: def.address as `0x${string}`, event: def.event as any, fromBlock: from, toBlock: to })
      allLogs.push(...(logs as unknown as AnyLog[]))
    } catch {
      // skip failed chunk
    }
  }
  return allLogs
}

export async function GET() {
  try {
    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const parcels = getParcels()
    const currentBlock = await publicClient.getBlockNumber()
    const startBlock = currentBlock > MAX_LOOKBACK ? currentBlock - MAX_LOOKBACK : BigInt(0)

    // Fetch all event types with pagination
    const [
      parcelRegisteredLogs,
      primaryPurchaseLogs,
      listingCreatedLogs,
      listingFilledLogs,
      offerCreatedLogs,
      offerAcceptedLogs,
      yieldDepositedLogs,
      yieldClaimedLogs,
    ] = await Promise.all([
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.parcelRegistry,
        event: parseAbiItem('event ParcelRegistered(uint256 indexed id, address indexed seller, bytes32 geoHash, bytes32 docHash, uint16 confidenceScore, uint256 totalShares)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.marketplace,
        event: parseAbiItem('event PrimaryPurchase(uint256 indexed parcelId, address indexed buyer, uint256 amount, uint256 totalPaid)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.marketplace,
        event: parseAbiItem('event ListingCreated(uint256 indexed listingId, uint256 indexed parcelId, address indexed seller, uint256 amount, uint256 pricePerShare)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.marketplace,
        event: parseAbiItem('event ListingFilled(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPaid)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.marketplace,
        event: parseAbiItem('event OfferCreated(uint256 indexed offerId, uint256 indexed parcelId, address indexed buyer, address targetHolder, uint256 amount, uint256 pricePerShare)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.marketplace,
        event: parseAbiItem('event OfferAccepted(uint256 indexed offerId)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.yieldSplitter,
        event: parseAbiItem('event YieldDeposited(uint256 indexed parcelId, address indexed depositor, uint256 amount)'),
      }, startBlock, currentBlock),
      paginatedGetLogs(publicClient, {
        address: CONTRACTS.yieldSplitter,
        event: parseAbiItem('event YieldClaimed(uint256 indexed parcelId, address indexed holder, uint256 amount)'),
      }, startBlock, currentBlock),
    ])

    type Activity = {
      id: string
      type: string
      parcel: string
      shares: number
      address: string
      txHash: string
      blockNumber: bigint
      price?: string
    }

    const activities: Activity[] = []

    for (const log of parcelRegisteredLogs) {
      const args = log.args as { id?: bigint; seller?: string; totalShares?: bigint }
      activities.push({
        id: `mint-${log.transactionHash}`,
        type: 'mint',
        parcel: parcelName(parcels, Number(args.id || 0)),
        shares: Number(args.totalShares || 0),
        address: truncAddr(args.seller || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
      })
    }

    for (const log of primaryPurchaseLogs) {
      const args = log.args as { parcelId?: bigint; buyer?: string; amount?: bigint; totalPaid?: bigint }
      activities.push({
        id: `buy-${log.transactionHash}`,
        type: 'buy',
        parcel: parcelName(parcels, Number(args.parcelId || 0)),
        shares: Number(args.amount || 0),
        address: truncAddr(args.buyer || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
        price: args.totalPaid ? `${formatEther(args.totalPaid)} MNT` : undefined,
      })
    }

    for (const log of listingCreatedLogs) {
      const args = log.args as { parcelId?: bigint; seller?: string; amount?: bigint; pricePerShare?: bigint }
      activities.push({
        id: `list-${log.transactionHash}`,
        type: 'sell',
        parcel: parcelName(parcels, Number(args.parcelId || 0)),
        shares: Number(args.amount || 0),
        address: truncAddr(args.seller || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
        price: args.pricePerShare ? `${formatEther(args.pricePerShare)} MNT/sh` : undefined,
      })
    }

    for (const log of listingFilledLogs) {
      const args = log.args as { buyer?: string; amount?: bigint; totalPaid?: bigint }
      activities.push({
        id: `fill-${log.transactionHash}`,
        type: 'buy',
        parcel: 'Secondary',
        shares: Number(args.amount || 0),
        address: truncAddr(args.buyer || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
        price: args.totalPaid ? `${formatEther(args.totalPaid)} MNT` : undefined,
      })
    }

    for (const log of offerCreatedLogs) {
      const args = log.args as { parcelId?: bigint; buyer?: string; amount?: bigint; pricePerShare?: bigint }
      activities.push({
        id: `offer-${log.transactionHash}`,
        type: 'offer',
        parcel: parcelName(parcels, Number(args.parcelId || 0)),
        shares: Number(args.amount || 0),
        address: truncAddr(args.buyer || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
        price: args.pricePerShare ? `${formatEther(args.pricePerShare)} MNT/sh` : undefined,
      })
    }

    for (const log of offerAcceptedLogs) {
      activities.push({
        id: `accept-${log.transactionHash}`,
        type: 'offer',
        parcel: 'Offer accepted',
        shares: 0,
        address: '',
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
      })
    }

    for (const log of yieldDepositedLogs) {
      const args = log.args as { parcelId?: bigint; depositor?: string; amount?: bigint }
      activities.push({
        id: `ydep-${log.transactionHash}`,
        type: 'yield',
        parcel: parcelName(parcels, Number(args.parcelId || 0)),
        shares: 0,
        address: truncAddr(args.depositor || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
        price: args.amount ? `${formatEther(args.amount)} MNT` : undefined,
      })
    }

    for (const log of yieldClaimedLogs) {
      const args = log.args as { parcelId?: bigint; holder?: string; amount?: bigint }
      activities.push({
        id: `yclm-${log.transactionHash}`,
        type: 'yield',
        parcel: parcelName(parcels, Number(args.parcelId || 0)),
        shares: 0,
        address: truncAddr(args.holder || ''),
        txHash: log.transactionHash || '',
        blockNumber: log.blockNumber || BigInt(0),
        price: args.amount ? `${formatEther(args.amount)} MNT` : undefined,
      })
    }

    // Sort by block number descending (most recent first)
    activities.sort((a, b) => Number(b.blockNumber - a.blockNumber))

    // Convert blockNumber to string for JSON serialization
    const result = activities.map(({ blockNumber, ...rest }) => ({
      ...rest,
      blockNumber: blockNumber.toString(),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Activity API error:', error)
    return NextResponse.json([])
  }
}
