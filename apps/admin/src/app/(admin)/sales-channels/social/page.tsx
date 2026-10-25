import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** Social media opens on Meta (Facebook, Instagram, WhatsApp). */
export default function Page() {
  redirect(routes.salesChannels.socialMeta())
}
