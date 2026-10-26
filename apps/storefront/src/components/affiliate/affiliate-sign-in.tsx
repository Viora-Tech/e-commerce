import Link from 'next/link'
import { affiliateContent } from '@/data/affiliate'

type AffiliateSignInProps = {
  /** This signup page, to come back to after signing in. */
  returnTo: string
}

const copy = affiliateContent.signIn

/** The shopper login in front of the application form. */
export default function AffiliateSignIn({ returnTo }: AffiliateSignInProps) {
  // Render logic
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-surface p-6">
      <h2 className="h3">{copy.title}</h2>
      <p className="text-body text-muted">{copy.body}</p>
      <Link
        className="btn btn--primary w-full sm:w-auto"
        href={`/account/login?return_to=${encodeURIComponent(returnTo)}`}
      >
        <span className="btn__label">{copy.button}</span>
      </Link>
    </div>
  )
}
