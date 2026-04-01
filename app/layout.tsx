import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MeLi Booster — Cash Flow',
  description: 'Cash flow diario de MercadoLibre',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-950 antialiased">{children}</body>
    </html>
  )
}
