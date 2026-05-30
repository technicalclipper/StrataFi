import { AcquisitionView } from './AcquisitionView'
import { SEED_PARCELS } from '@/lib/seed-parcels'
import { notFound } from 'next/navigation'

export default async function AcquirePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parcel = SEED_PARCELS.find((p) => p.id === parseInt(id))
  if (!parcel) notFound()

  const soldShares = parcel.totalShares - parcel.availableShares
  const holders = [
    {
      address: parcel.seller,
      shares: parcel.availableShares,
      pct: (parcel.availableShares / parcel.totalShares) * 100,
      label: 'Seller (Primary)',
    },
    ...(soldShares > 0
      ? [
          {
            address: '0xBuyerA1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
            shares: Math.floor(soldShares * 0.6),
            pct: ((soldShares * 0.6) / parcel.totalShares) * 100,
            label: 'Early Investor',
          },
          {
            address: '0xBuyerB9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2',
            shares: Math.ceil(soldShares * 0.25),
            pct: ((soldShares * 0.25) / parcel.totalShares) * 100,
            label: 'Retail Holder',
          },
          {
            address: '0xBuyerCf1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8',
            shares: Math.ceil(soldShares * 0.15),
            pct: ((soldShares * 0.15) / parcel.totalShares) * 100,
            label: 'Small Holder',
          },
        ]
      : []),
  ]

  return <AcquisitionView parcel={parcel} holders={holders} />
}
