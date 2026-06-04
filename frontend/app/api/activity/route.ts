/**
 * GET /api/activity
 * Reads real on-chain event logs from all StrataFi contracts on Mantle Sepolia.
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

export async function GET() {
  try {
    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const parcels = getParcels()
    const currentBlock = await publicClient.getBlockNumber()
    // Look back ~50000 blocks (~a day or so on Mantle Sepolia)
    const fromBlock = currentBlock > BigInt(50000) ? currentBlock - BigInt(50000) : BigInt(0)

    // Fetch logs from all contracts in parallel
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
      publicClient.getLogs({
        address: CONTRACTS.parcelRegistry as `0x${string}`,
        event: parseAbiItem('event ParcelRegistered(uint256 indexed id, address indexed seller, bytes32 geoHash, bytes32 docHash, uint16 confidenceScore, uint256 totalShares)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.marketplace as `0x${string}`,
        event: parseAbiItem('event PrimaryPurchase(uint256 indexed parcelId, address indexed buyer, uint256 amount, uint256 totalPaid)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.marketplace as `0x${string}`,
        event: parseAbiItem('event ListingCreated(uint256 indexed listingId, uint256 indexed parcelId, address indexed seller, uint256 amount, uint256 pricePerShare)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.marketplace as `0x${string}`,
        event: parseAbiItem('event ListingFilled(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPaid)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.marketplace as `0x${string}`,
        event: parseAbiItem('event OfferCreated(uint256 indexed offerId, uint256 indexed parcelId, address indexed buyer, address targetHolder, uint256 amount, uint256 pricePerShare)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.marketplace as `0x${string}`,
        event: parseAbiItem('event OfferAccepted(uint256 indexed offerId)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.yieldSplitter as `0x${string}`,
        event: parseAbiItem('event YieldDeposited(uint256 indexed parcelId, address indexed depositor, uint256 amount)'),
        fromBlock,
      }).catch(() => []),
      publicClient.getLogs({
        address: CONTRACTS.yieldSplitter as `0x${string}`,
        event: parseAbiItem('event YieldClaimed(uint256 indexed parcelId, address indexed holder, uint256 amount)'),
        fromBlock,
      }).catch(() => []),
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
