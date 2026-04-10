import type { Metadata } from 'next'
import { DM_Serif_Display, IBM_Plex_Mono, Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['200', '300', '400', '500', '600', '700'],
})

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-dm-serif',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'FP&A Chatbot',
  description: 'FP&A assistant for analysis, tables, and visualizations',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSerifDisplay.variable} ${ibmPlexMono.variable}`}>
      <body className={`${inter.className} font-sans antialiased`}>{children}</body>
    </html>
  )
}
