'use client'

export function Delta({
  value,
  showBg = false,
}: {
  value: number
  showBg?: boolean
}) {
  const isUp = value > 0
  const isFlat = value === 0
  const color = isFlat ? 'var(--flat)' : isUp ? 'var(--up)' : 'var(--down)'
  const bg = isFlat ? 'transparent' : isUp ? 'var(--up-bg)' : 'var(--down-bg)'
  const glyph = isFlat ? '-' : isUp ? '\u25B2' : '\u25BC'
  const sign = isFlat ? '' : isUp ? '+' : ''

  return (
    <span
      className="tnum text-[12.5px] px-1.5 py-0.5 rounded-[var(--radius-xs)] inline-flex items-center gap-1"
      style={{
        color,
        backgroundColor: showBg ? bg : 'transparent',
      }}
    >
      <span className="text-[10px]">{glyph}</span>
      {sign}{value.toFixed(2)}%
    </span>
  )
}
