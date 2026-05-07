import { ClerkProvider } from '@clerk/nextjs'
import { Inter, Instrument_Serif } from 'next/font/google'
import type { Metadata } from 'next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AnamnezAl — Sesli Diş Anamnezi',
  description: 'Diş hekimi konuşur, form kendini doldurur. Hands-free anamnez ve diş chartı.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="tr" className={`${inter.variable} ${instrument.variable}`}>
        <body className="bg-background text-foreground antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
