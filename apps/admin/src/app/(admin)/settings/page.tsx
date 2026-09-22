import { redirect } from 'next/navigation'

/** The settings index is the first tab. */
export default function Page() {
  redirect('/settings/general')
}
