import { settingsSecret } from '@commerce/config'
import { newsletterSignupForToken } from '@commerce/core'
import type { Metadata } from 'next'
import { newsletterConfirmContent as copy } from '@/data/marketing'
import { confirmNewsletterAction } from '@/lib/newsletter-actions'
import { inStore } from '@/lib/store-context'

type Props = { params: Promise<{ storeId: string; token: string }> }

export const metadata: Metadata = { title: copy.title, robots: { index: false } }

/**
 * Where the newsletter confirm email lands (double opt-in, security audit D-09). Opening
 * the page changes nothing (mail scanners open links); the shopper confirms with a button.
 */
export default async function NewsletterConfirmPage({ params }: Props) {
  // Hooks
  const { storeId, token } = await params
  const signup = await inStore(storeId, (tx) =>
    newsletterSignupForToken(tx, storeId, token, settingsSecret()),
  )

  // Early returns
  if (!signup) {
    return (
      <section className="page-width flex flex-col items-center gap-6 py-24 text-center">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body">{copy.invalid}</p>
        <a href="/" className="btn btn--primary">
          {copy.home}
        </a>
      </section>
    )
  }

  // Render logic
  const confirmed = signup.status === 'confirmed'

  return (
    <section className="page-width flex flex-col items-center gap-6 py-24 text-center">
      <h1 className="h2">{copy.title}</h1>
      <p className="text-body">{confirmed ? copy.done(signup.email) : copy.ask(signup.email)}</p>
      {confirmed ? (
        <a href="/" className="btn btn--primary">
          {copy.home}
        </a>
      ) : (
        <form action={confirmNewsletterAction.bind(null, token)}>
          <button type="submit" className="btn btn--primary">
            {copy.confirm}
          </button>
        </form>
      )}
    </section>
  )
}
