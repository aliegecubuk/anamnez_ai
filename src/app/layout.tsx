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
  title: 'AnamnezAl — Sesli Anamnez',
  description: 'Hekim konuşur, form kendini doldurur. Diş kliniği ve hastane (poliklinik/acil) için hands-free anamnez.',
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
