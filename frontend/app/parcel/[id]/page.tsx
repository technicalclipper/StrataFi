import { ParcelDetail } from './ParcelDetail'
import type { ParcelData } from '@/lib/seed-parcels'
import { notFound } from 'next/navigation'
import { readFileSync } from 'fs'
import { join } from 'path'

const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')

function getParcels(): ParcelData[] {
  try {
    return JSON.parse(readFileSync(PARCELS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export default async function ParcelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parcels = getParcels()
  const parcel = parcels.find((p) => p.id === parseInt(id))
  if (!parcel) notFound()

  // Build holders from on-chain data (seller holds all initially)
  const holders = [
    {
      address: parcel.seller,
      shares: parcel.availableShares,
      percentage: (parcel.availableShares / parcel.totalShares) * 100,
    },
  ]

  return <ParcelDetail parcel={parcel} holders={holders} />
}
