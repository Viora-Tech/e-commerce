import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@shopify/polaris/build/esm/styles.css'
import { PolarisProvider } from '@/components/polaris-provider'

export const metadata: Metadata = { title: 'Admin' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PolarisProvider>{children}</PolarisProvider>
      </body>
    </html>
  )
}
