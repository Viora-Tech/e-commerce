'use client'

import { AppProvider } from '@shopify/polaris'
import en from '@shopify/polaris/locales/en.json'
import Link from 'next/link'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { ReactNode } from 'react'

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

export function PolarisProvider({ children }: { children: ReactNode }) {
  return (
    <AppProvider i18n={en} linkComponent={LinkComponent}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </AppProvider>
  )
}
