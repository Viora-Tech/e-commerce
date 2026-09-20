'use client'

import { AppProvider } from '@shopify/polaris'
import en from '@shopify/polaris/locales/en.json'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { type ReactNode, useEffect, useState } from 'react'

/** Polaris links route through Next so navigation stays client-side. */
function LinkComponent({
  url,
  children,
  external,
  ...rest
}: {
  url: string
  children?: ReactNode
  external?: boolean
  [key: string]: unknown
}) {
  if (external) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={url} {...rest}>
      {children}
    </Link>
  )
}

/**
 * Polaris follows the same light/dark choice as the shadcn shell (next-themes).
 * Polaris's dark theme is its "dark-experimental" token set. The theme is
 * applied after mount so server and first client render agree.
 */
export function PolarisProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const theme = mounted && resolvedTheme === 'dark' ? 'dark-experimental' : 'light'

  return (
    <AppProvider i18n={en} linkComponent={LinkComponent} theme={theme}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </AppProvider>
  )
}
