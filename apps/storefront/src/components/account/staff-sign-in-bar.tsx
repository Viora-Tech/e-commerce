import { staffSignInBarContent as copy } from '@/data/staff-sign-in'
import { signOutAction } from '@/lib/account-actions'
import { currentCustomer, hasStaffMarker } from '@/lib/customer-session'

type StaffSignInBarProps = {
  storeId: string
}

/**
 * Pinned bar while a staff member is signed in as a shopper ("Sign in as customer" in the
 * admin): who they are signed in as, and Sign out, which ends that one-hour session. Looks the
 * session up only when the marker cookie is there, so ordinary page views cost nothing.
 */
export default async function StaffSignInBar({ storeId }: StaffSignInBarProps) {
  // Early returns
  const me = (await hasStaffMarker()) ? await currentCustomer(storeId) : null
  if (!me?.impersonatedBy) return null

  // Render logic
  const name = me.name || me.email || copy.unnamed

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-sm text-bg"
    >
      <span className="font-semibold">{copy.label(name)}</span>
      <span aria-hidden="true" className="opacity-60">
        ·
      </span>
      <form action={signOutAction}>
        <button type="submit" className="underline underline-offset-4">
          {copy.signOut}
        </button>
      </form>
    </div>
  )
}
