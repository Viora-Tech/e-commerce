import Link from 'next/link'
import { affiliateContent } from '@/data/affiliate'

type AffiliateSignInProps = {
  /** This signup page, to come back to after signing in. */
  returnTo: string
}

const copy = affiliateContent

/**
 * Where the form sits for a visitor who is not signed in: joining needs the store account, so
 * the full-width JOIN goes to the store's sign-in (which creates the account) and comes back.
 */
export default function AffiliateSignIn({ returnTo }: AffiliateSignInProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-muted">{copy.signIn.body}</p>
      <Link
        className="btn btn--primary w-full uppercase"
        href={`/account/login?return_to=${encodeURIComponent(returnTo)}`}
      >
        <span className="btn__label">{copy.register.join}</span>
      </Link>
    </div>
  )
}
