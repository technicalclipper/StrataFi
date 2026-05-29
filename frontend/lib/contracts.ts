// Contract addresses — populated after deploying to Mantle Sepolia
export const CONTRACTS = {
  parcelRegistry: (process.env.NEXT_PUBLIC_PARCEL_REGISTRY || '0x') as `0x${string}`,
  shareToken: (process.env.NEXT_PUBLIC_SHARE_TOKEN || '0x') as `0x${string}`,
  marketplace: (process.env.NEXT_PUBLIC_MARKETPLACE || '0x') as `0x${string}`,
  yieldSplitter: (process.env.NEXT_PUBLIC_YIELD_SPLITTER || '0x') as `0x${string}`,
  governance: (process.env.NEXT_PUBLIC_GOVERNANCE || '0x') as `0x${string}`,
} as const

// ABIs will be imported from compiled contract artifacts after deployment
// For now, define minimal interfaces for development
export const PARCEL_REGISTRY_ABI = [] as const
export const SHARE_TOKEN_ABI = [] as const
export const MARKETPLACE_ABI = [] as const
export const YIELD_SPLITTER_ABI = [] as const
export const GOVERNANCE_ABI = [] as const
