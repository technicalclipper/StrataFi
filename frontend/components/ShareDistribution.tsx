'use client'

type Holder = {
  address: string
  shares: number
  percentage: number
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function ShareDistribution({
  holders,
  totalShares,
}: {
  holders: Holder[]
  totalShares: number
}) {
  return (
    <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4">
      <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
        Cap Table
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-4 bg-surface-2">
        {holders.map((h, i) => {
          const colors = ['#4D7CFE', '#1FCC8B', '#F5C518', '#FF8A3D', '#FF5C5C', '#9BA1AC']
          return (
            <div
              key={h.address}
              className="h-full transition-all"
              style={{
                width: `${h.percentage}%`,
                backgroundColor: colors[i % colors.length],
              }}
            />
          )
        })}
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary border-b border-border-subtle">
            <th className="text-left py-1.5 font-medium">Holder</th>
            <th className="text-right py-1.5 font-medium">Shares</th>
            <th className="text-right py-1.5 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h) => (
            <tr
              key={h.address}
              className="text-[12.5px] border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors"
            >
              <td className="py-2 font-mono text-text-secondary">
                {truncateAddress(h.address)}
              </td>
              <td className="py-2 text-right tnum text-text-primary">{h.shares}</td>
              <td className="py-2 text-right tnum text-text-secondary">
                {h.percentage.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-[10px] text-text-tertiary mt-2 tnum">
        Total: {totalShares} shares
      </div>
    </div>
  )
}
