import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** Appearance is your own preference, so it lives under Account only (#81); old links land there. */
export default function Page() {
  redirect(routes.account.appearance())
}
