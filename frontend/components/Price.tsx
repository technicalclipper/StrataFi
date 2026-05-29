'use client'

export function Price({
  value,
  currency = 'MNT',
  decimals = 2,
}: {
  value: number
  currency?: string
  decimals?: number
}) {
  return (
    <span className="tnum">
      {value.toFixed(decimals)} <span className="text-text-tertiary">{currency}</span>
    </span>
  )
}
