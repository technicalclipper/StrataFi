/**
 * POST /api/mint
 * Server-side minting — registers parcel + mints shares on Mantle Sepolia
 * Uses the deployer private key (authorized verifier + minter)
 *
 * Input: { seller, geoHash, docHash, confidenceScore, totalShares }
 * Output: { success, parcelId, txHash, explorerUrl }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mantleSepoliaTestnet } from 'viem/chains'
import { CONTRACTS, PARCEL_REGISTRY_ABI, SHARE_TOKEN_ABI, MARKETPLACE_ABI } from '@/lib/contracts'

const RPC_URL = 'https://rpc.sepolia.mantle.xyz'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { seller, geoHash, docHash, confidenceScore, totalShares, pricePerShare } = body

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

    // Hash the geo and doc strings into bytes32
    const geoBytes = keccak256(toBytes(geoHash || 'geo-default'))
    const docBytes = keccak256(toBytes(docHash || 'doc-default'))

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

    // Extract parcelId from the ParcelRegistered event
    const registeredEvent = registerReceipt.logs.find(
      (log) => log.address.toLowerCase() === CONTRACTS.parcelRegistry.toLowerCase(),
    )
    // The parcelId is the first indexed topic (after event signature)
    const parcelId = registeredEvent?.topics[1]
      ? parseInt(registeredEvent.topics[1], 16)
      : 1

    // 2. Mint shares to seller
    const mintHash = await walletClient.writeContract({
      address: CONTRACTS.shareToken as `0x${string}`,
      abi: SHARE_TOKEN_ABI,
      functionName: 'mintShares',
      args: [BigInt(parcelId), seller as `0x${string}`, BigInt(totalShares || 100)],
    })

    await publicClient.waitForTransactionReceipt({ hash: mintHash })

    // 3. Create primary sale on marketplace (so buyers can buy immediately)
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
