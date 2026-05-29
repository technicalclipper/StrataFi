import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Topbar } from '@/components/Topbar'
import { NavRail } from '@/components/NavRail'
import { StatusBar } from '@/components/StatusBar'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'StrataFi — Fractional Land Ownership on Mantle',
  description:
    'AI-verified fractional land ownership, traded like stocks on Mantle.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="bg-bg-base text-text-primary">
        <Providers>
          <div
            id="app-shell"
            style={{
              height: '100dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Topbar />
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <NavRail />
              <main style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', overflow: 'auto' }}>
                {children}
              </main>
            </div>
            <StatusBar />
          </div>
        </Providers>
      </body>
    </html>
  )
}
