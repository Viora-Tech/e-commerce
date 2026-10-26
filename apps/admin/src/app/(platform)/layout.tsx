import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import PlatformFrame from '@/components/platform/platform-frame'
import { platformContent } from '@/data/platform'
import { requirePlatformStaff } from '@/lib/platform-access'

export const metadata: Metadata = { title: platformContent.brand }

/**
 * The Koomerce staff console, outside any store. The guard runs here and again on every page
 * (`requirePlatformStaff`, cached per render): anyone who is not platform staff gets a 404.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const actor = await requirePlatformStaff()
  return <PlatformFrame email={actor.email}>{children}</PlatformFrame>
}
