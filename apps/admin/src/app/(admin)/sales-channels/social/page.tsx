import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** Social media opens on its first channel. */
export default function Page() {
  redirect(routes.salesChannels.socialChannel('instagram'))
}
