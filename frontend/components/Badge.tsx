'use client'

import { Check, Diamond } from 'lucide-react'

type BadgeVariant = 'verified' | 'on-chain' | 'pending' | 'demand'

export function Badge({
  variant,
  label,
  demandLevel,
}: {
  variant: BadgeVariant
  label?: string
  demandLevel?: number
}) {
  switch (variant) {
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-verify bg-[rgba(31,204,139,0.12)] px-2 py-0.5 rounded-full">
          <Check size={12} strokeWidth={2} />
          {label || 'Verified'}
        </span>
      )
    case 'on-chain':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-on-chain bg-brand-bg px-2 py-0.5 rounded-full">
          <Diamond size={10} strokeWidth={2} />
          {label || 'On-chain'}
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-amber bg-accent-amber-bg px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
          {label || 'Pending'}
        </span>
      )
    case 'demand': {
      const colors: Record<number, string> = {
        1: '#3A6B8C',
        2: '#4D9DE0',
        3: '#F5C518',
        4: '#FF8A3D',
        5: '#FF4D4D',
      }
      const color = colors[demandLevel || 1] || colors[1]
      return (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ color, backgroundColor: `${color}18` }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label || `Demand ${demandLevel}/5`}
        </span>
      )
    }
    default:
      return null
  }
}
