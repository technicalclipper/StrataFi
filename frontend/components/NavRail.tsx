'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Map,
  Briefcase,
  PlusCircle,
  Target,
  Activity,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { href: '/', icon: Map, label: 'Map' },
  { href: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { href: '/list', icon: PlusCircle, label: 'List Asset' },
  { href: '/acquire', icon: Target, label: 'Acquire' },
  { href: '/kyc', icon: ShieldCheck, label: 'KYC' },
  { href: '/activity', icon: Activity, label: 'Activity' },
]

export function NavRail() {
  const pathname = usePathname()

  return (
    <nav className="w-16 hover:w-[200px] transition-all duration-[var(--dur-base)] ease-[var(--ease-out)] bg-surface-1 border-r border-border-default flex flex-col py-3 overflow-hidden shrink-0 group">
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-5 py-3 text-[12.5px] font-medium transition-colors relative ${
              isActive
                ? 'text-brand bg-brand-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
            }`}
          >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand" />
            )}
            <Icon size={18} strokeWidth={1.5} className="shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--dur-base)]">
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
