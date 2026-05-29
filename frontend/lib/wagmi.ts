import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mantleSepolia } from './mantle'

export const config = getDefaultConfig({
  appName: 'StrataFi',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'stratafi-dev',
  chains: [mantleSepolia],
  ssr: true,
})
