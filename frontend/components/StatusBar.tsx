'use client'

import { useBlockNumber } from 'wagmi'
import { mantleSepolia } from '@/lib/mantle'

export function StatusBar() {
  const { data: blockNumber } = useBlockNumber({
    chainId: mantleSepolia.id,
    watch: true,
  })

  return (
    <footer className="h-7 flex items-center justify-between px-4 border-t border-border-default bg-surface-1 text-[10px] font-mono shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-text-tertiary">
          <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
          Mantle Sepolia
        </span>
        <span className="text-text-tertiary">
          Block{' '}
          <span className="tnum text-text-secondary">
            {blockNumber ? blockNumber.toString() : '---'}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-text-tertiary">
          MNT/USD <span className="tnum text-text-secondary">$0.42</span>
        </span>
        <span className="text-text-tertiary">
          Gas <span className="tnum text-text-secondary">0.02 gwei</span>
        </span>
      </div>
    </footer>
  )
}
