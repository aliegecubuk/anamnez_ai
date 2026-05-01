import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'AnamnezAl',
  description: 'Diş hekimi için sesli anamnez uygulaması',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="tr" className={inter.variable}>
        <body className="bg-background text-foreground antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
