import Link from 'next/link'
import { SEED_PARCELS } from '@/lib/seed-parcels'
import { Target } from 'lucide-react'

export default function AcquirePage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight mb-2">
        Full Parcel Acquisition
      </h1>
      <p className="text-[12.5px] text-text-secondary mb-6">
        Select a parcel to begin a full acquisition strategy.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {SEED_PARCELS.map((parcel) => {
          const pctSold =
            ((parcel.totalShares - parcel.availableShares) / parcel.totalShares) * 100
          return (
            <Link
              key={parcel.id}
              href={`/acquire/${parcel.id}`}
              className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 hover:border-brand transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] font-medium text-text-primary group-hover:text-brand transition-colors">
                  {parcel.name}
                </span>
                <Target size={16} className="text-text-tertiary" />
              </div>
              <div className="text-[11px] text-text-tertiary mb-3">
                {parcel.location}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <div className="text-text-tertiary uppercase tracking-[0.06em]">
                    Price
                  </div>
                  <div className="tnum text-text-primary">{parcel.pricePerShare} MNT</div>
                </div>
                <div>
                  <div className="text-text-tertiary uppercase tracking-[0.06em]">
                    Shares
                  </div>
                  <div className="tnum text-text-primary">{parcel.totalShares}</div>
                </div>
                <div>
                  <div className="text-text-tertiary uppercase tracking-[0.06em]">
                    Sold
                  </div>
                  <div className="tnum text-text-primary">{pctSold.toFixed(0)}%</div>
                </div>
              </div>
              <div className="mt-2 h-1 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{ width: `${pctSold}%` }}
                />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
