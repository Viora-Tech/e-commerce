import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Social media' }

/** Social media opens on Meta (Facebook, Instagram, WhatsApp). */
export default function Page() {
  redirect(routes.salesChannels.socialMeta())
}
