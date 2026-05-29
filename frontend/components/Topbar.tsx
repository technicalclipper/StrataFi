'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Search } from 'lucide-react'

export function Topbar() {
  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border-default bg-surface-1 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-[20px] font-semibold tracking-tight text-text-primary">
          Strata<span className="text-brand">Fi</span>
        </span>
      </div>

      {/* Global search */}
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] bg-surface-2 border border-border-default text-text-tertiary text-[12.5px] hover:border-border-strong transition-colors w-72">
        <Search size={14} strokeWidth={1.5} />
        <span>Search location, parcel ID...</span>
        <kbd className="ml-auto text-[10px] bg-surface-3 px-1.5 py-0.5 rounded-[var(--radius-xs)]">
          &#8984;K
        </kbd>
      </button>

      {/* Wallet */}
      <div className="flex items-center gap-3">
        <ConnectButton
          chainStatus="icon"
          accountStatus="address"
          showBalance={true}
        />
      </div>
    </header>
  )
}
