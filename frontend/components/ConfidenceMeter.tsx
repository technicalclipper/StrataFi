'use client'

export function ConfidenceMeter({
  score,
  rationale,
}: {
  score: number
  rationale?: string
}) {
  const getColor = () => {
    if (score >= 80) return 'var(--up)'
    if (score >= 60) return 'var(--accent-amber)'
    return 'var(--down)'
  }

  const getLabel = () => {
    if (score >= 80) return 'Auto-Approved'
    if (score >= 60) return 'Review Needed'
    return 'Rejected'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
          AI Confidence
        </span>
        <span className="tnum text-[14px] font-semibold" style={{ color: getColor() }}>
          {score}
        </span>
      </div>
      {/* Bar */}
      <div className="flex gap-px h-2 rounded-[var(--radius-xs)] overflow-hidden bg-surface-2">
        {/* Red zone 0-60 */}
        <div className="flex-[60] relative">
          <div
            className="absolute inset-0 rounded-l-[var(--radius-xs)]"
            style={{
              backgroundColor: score < 60 ? getColor() : 'var(--down)',
              opacity: score < 60 ? 0.8 : 0.15,
              width: score < 60 ? `${(score / 60) * 100}%` : '100%',
            }}
          />
        </div>
        {/* Amber zone 60-80 */}
        <div className="flex-[20] relative">
          <div
            className="absolute inset-0"
            style={{
              backgroundColor:
                score >= 60 && score < 80 ? getColor() : 'var(--accent-amber)',
              opacity: score >= 60 && score < 80 ? 0.8 : score >= 80 ? 0.15 : 0.08,
              width:
                score >= 60 && score < 80
                  ? `${((score - 60) / 20) * 100}%`
                  : score >= 80
                    ? '100%'
                    : '0%',
            }}
          />
        </div>
        {/* Green zone 80-100 */}
        <div className="flex-[20] relative">
          <div
            className="absolute inset-0 rounded-r-[var(--radius-xs)]"
            style={{
              backgroundColor: score >= 80 ? getColor() : 'var(--up)',
              opacity: score >= 80 ? 0.8 : 0.08,
              width: score >= 80 ? `${((score - 80) / 20) * 100}%` : '0%',
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span
          className="text-[10px] font-medium"
          style={{ color: getColor() }}
        >
          {getLabel()}
        </span>
        {rationale && (
          <span className="text-[10px] text-text-tertiary truncate ml-2 max-w-[200px]">
            {rationale}
          </span>
        )}
      </div>
    </div>
  )
}
