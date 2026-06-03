import { AcquisitionView } from './AcquisitionView'
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

export default async function AcquirePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parcels = getParcels()
  const parcel = parcels.find((p) => p.id === parseInt(id))
  if (!parcel) notFound()

  const holders = [
    {
      address: parcel.seller,
      shares: parcel.totalShares,
      pct: 100,
      label: 'Seller (Primary)',
    },
  ]

  return <AcquisitionView parcel={parcel} holders={holders} />
}
