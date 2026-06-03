/**
 * POST /api/mint
 * Server-side minting — registers parcel + mints shares on Mantle Sepolia
 * Also saves off-chain metadata (name, coords, etc.) to data/parcels.json
 *
 * Input: { seller, name, lat, lng, area, landType, surveyNo, geoHash, docHash, confidenceScore, totalShares, pricePerShare }
 * Output: { success, parcelId, txHash, explorerUrl }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, PARCEL_REGISTRY_ABI, SHARE_TOKEN_ABI, MARKETPLACE_ABI } from '@/lib/contracts'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'
const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')

function readParcels(): unknown[] {
  try {
    return JSON.parse(readFileSync(PARCELS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeParcels(parcels: unknown[]) {
  writeFileSync(PARCELS_FILE, JSON.stringify(parcels, null, 2))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      seller, name, lat, lng, area, landType, surveyNo,
      geoHash, docHash, confidenceScore, totalShares, pricePerShare,
    } = body

    const pk = process.env.DEPLOYER_PRIVATE_KEY
    if (!pk) {
      return NextResponse.json({ error: 'Deployer key not configured' }, { status: 500 })
    }

    const account = privateKeyToAccount(pk as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })
    const publicClient = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(RPC_URL),
    })

    const geoStr = geoHash || `${lat},${lng}`
    const docStr = docHash || `${surveyNo}-${name}`
    const geoBytes = keccak256(toBytes(geoStr))
    const docBytes = keccak256(toBytes(docStr))

    // 1. Register parcel on ParcelRegistry
    const registerHash = await walletClient.writeContract({
      address: CONTRACTS.parcelRegistry as `0x${string}`,
      abi: PARCEL_REGISTRY_ABI,
      functionName: 'registerParcel',
      args: [
        geoBytes,
        docBytes,
        confidenceScore || 85,
        BigInt(totalShares || 100),
        seller as `0x${string}`,
      ],
    })

    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash })

    const registeredEvent = registerReceipt.logs.find(
      (log) => log.address.toLowerCase() === CONTRACTS.parcelRegistry.toLowerCase(),
    )
    const parcelId = registeredEvent?.topics[1]
      ? parseInt(registeredEvent.topics[1], 16)
      : 1

    // 2. Mint shares to deployer (who acts as the primary sale pool)
    //    The deployer holds shares and sells them via Marketplace.buyPrimary
    const deployerAddr = account.address
    const mintHash = await walletClient.writeContract({
      address: CONTRACTS.shareToken as `0x${string}`,
      abi: SHARE_TOKEN_ABI,
      functionName: 'mintShares',
      args: [BigInt(parcelId), deployerAddr, BigInt(totalShares || 100)],
    })

    await publicClient.waitForTransactionReceipt({ hash: mintHash })

    // 3. Approve marketplace to transfer deployer's shares (idempotent)
    const isApproved = await publicClient.readContract({
      address: CONTRACTS.shareToken as `0x${string}`,
      abi: SHARE_TOKEN_ABI,
      functionName: 'isApprovedForAll',
      args: [deployerAddr, CONTRACTS.marketplace as `0x${string}`],
    })
    if (!isApproved) {
      const approveHash = await walletClient.writeContract({
        address: CONTRACTS.shareToken as `0x${string}`,
        abi: SHARE_TOKEN_ABI,
        functionName: 'setApprovalForAll',
        args: [CONTRACTS.marketplace as `0x${string}`, true],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
    }

    // 4. Create primary sale on marketplace (deployer is msg.sender = seller)
    if (pricePerShare) {
      const priceBigInt = BigInt(Math.floor(parseFloat(pricePerShare) * 1e18))
      const primaryHash = await walletClient.writeContract({
        address: CONTRACTS.marketplace as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'createPrimarySale',
        args: [BigInt(parcelId), priceBigInt],
      })
      await publicClient.waitForTransactionReceipt({ hash: primaryHash })
    }

    // 4. Save off-chain metadata
    const latNum = parseFloat(lat) || 12.97
    const lngNum = parseFloat(lng) || 77.65
    const areaNum = parseFloat(area) || 10000
    const priceNum = parseFloat(pricePerShare) || 0.5

    // Generate polygon from center + area
    const sideFt = Math.sqrt(areaNum)
    const dLat = sideFt / 364000 / 2
    const dLng = sideFt / (364000 * Math.cos((latNum * Math.PI) / 180)) / 2

    const parcelMeta = {
      id: parcelId,
      name: name || `Parcel #${parcelId}`,
      location: `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`,
      coordinates: [lngNum, latNum],
      polygon: [
        [lngNum - dLng, latNum - dLat],
        [lngNum + dLng, latNum - dLat],
        [lngNum + dLng, latNum + dLat],
        [lngNum - dLng, latNum + dLat],
        [lngNum - dLng, latNum - dLat],
      ],
      totalShares: parseInt(totalShares) || 100,
      availableShares: parseInt(totalShares) || 100,
      pricePerShare: priceNum,
      yieldPct: 0,
      demandScore: 3,
      confidenceScore: confidenceScore || 85,
      verified: true,
      seller: seller,
      landType: landType || 'residential',
      areaSqFt: areaNum,
      docHash: docBytes.slice(0, 14),
      geoHash: geoBytes.slice(0, 14),
      surveyNo: surveyNo || '',
      txHash: registerHash,
      mintedAt: new Date().toISOString(),
    }

    const parcels = readParcels()
    parcels.push(parcelMeta)
    writeParcels(parcels)

    return NextResponse.json({
      success: true,
      parcelId,
      txHash: registerHash,
      mintTxHash: mintHash,
      explorerUrl: `https://sepolia.mantlescan.xyz/tx/${registerHash}`,
    })
  } catch (error) {
    console.error('Mint error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Minting failed' },
      { status: 500 },
    )
  }
}
