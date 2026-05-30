import { ExternalLink } from 'lucide-react'

// Mock on-chain activity feed
const MOCK_ACTIVITY = [
  { id: 1, type: 'mint', parcel: 'Indiranagar Premium', shares: 80, address: '0x6789...90ab', txHash: '0xabc123', time: '2 min ago' },
  { id: 2, type: 'buy', parcel: 'Whitefield Tech Park', shares: 10, address: '0xBuyer...e7f8', txHash: '0xdef456', time: '8 min ago', price: '0.5 MNT' },
  { id: 3, type: 'offer', parcel: 'Koramangala Mixed-Use', shares: 5, address: '0xBuyer...d3e2', txHash: '0xghi789', time: '23 min ago', price: '1.3 MNT' },
  { id: 4, type: 'buy', parcel: 'Hebbal Lake View', shares: 20, address: '0xBuyer...1234', txHash: '0xjkl012', time: '1h ago', price: '0.65 MNT' },
  { id: 5, type: 'yield', parcel: 'Electronic City Residential', shares: 0, address: '0xOwner...5678', txHash: '0xmno345', time: '2h ago', price: '0.24 MNT' },
  { id: 6, type: 'vote', parcel: 'Devanahalli Farmland', shares: 50, address: '0xAcquirer...9012', txHash: '0xpqr678', time: '4h ago' },
  { id: 7, type: 'mint', parcel: 'Sarjapur Road Residential', shares: 250, address: '0xSeller...3456', txHash: '0xstu901', time: '6h ago' },
  { id: 8, type: 'buy', parcel: 'Yelahanka Agri Plot', shares: 30, address: '0xBuyer...7890', txHash: '0xvwx234', time: '8h ago', price: '0.08 MNT' },
]

const TYPE_COLORS: Record<string, string> = {
  mint: 'var(--brand)',
  buy: 'var(--up)',
  offer: 'var(--accent-amber)',
  yield: 'var(--up)',
  vote: 'var(--brand)',
  sell: 'var(--down)',
}

export default function ActivityPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight mb-6">Activity</h1>

      <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary bg-surface-2">
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Parcel</th>
              <th className="text-right px-4 py-2 font-medium">Shares</th>
              <th className="text-right px-4 py-2 font-medium">Price</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-left px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ACTIVITY.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border-subtle last:border-0 hover:bg-surface-3 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <span
                    className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full"
                    style={{
                      color: TYPE_COLORS[a.type],
                      backgroundColor: `${TYPE_COLORS[a.type]}18`,
                    }}
                  >
                    {a.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[12.5px] text-text-primary">
                  {a.parcel}
                </td>
                <td className="px-4 py-2.5 text-right tnum text-[12.5px] text-text-primary">
                  {a.shares > 0 ? a.shares : '-'}
                </td>
                <td className="px-4 py-2.5 text-right tnum text-[12.5px] text-text-secondary">
                  {a.price || '-'}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-text-secondary">
                  {a.address}
                </td>
                <td className="px-4 py-2.5 text-[11px] font-mono text-text-tertiary">
                  {a.time}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={`https://sepolia.mantlescan.xyz/tx/${a.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:text-brand-hover"
                  >
                    <ExternalLink size={13} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
