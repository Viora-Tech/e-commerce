'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'

type SettingsFrameProps = {
  /** The settings menu column (desktop) and its phone version. */
  nav: ReactNode
  children: ReactNode
}

/**
 * Settings pages that need the whole screen: the email editor and Email branding, with their live previews
 * (owner, 22 Nov 2026: like Shopify's editor, not squeezed beside the settings menu).
 */
const FULL_WIDTH = [
  /^\/settings\/notifications\/[^/]+\/edit$/,
  /^\/settings\/notifications\/branding$/,
]

/**
 * The settings area's frame: the settings menu on the left with the page beside it, in the
 * settings width; a full-width page (`FULL_WIDTH`) gets the whole content area without the menu.
 */
export default function SettingsFrame({ nav, children }: SettingsFrameProps) {
  // Hooks
  const pathname = usePathname()

  // Early returns
  if (FULL_WIDTH.some((re) => re.test(pathname))) {
    return <PageBody className="flex flex-col gap-4">{children}</PageBody>
  }

  // Render logic
  return (
    <PageBody width="settings" className="md:flex-row md:items-start md:gap-8">
      {nav}
      <div className="flex w-full min-w-0 flex-1 flex-col gap-6">{children}</div>
    </PageBody>
  )
}
