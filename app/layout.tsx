import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CMS Compliance Hub',
  description: 'HVAC Specification Compliance Engine — Century Mechanical Systems Factory LLC',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
