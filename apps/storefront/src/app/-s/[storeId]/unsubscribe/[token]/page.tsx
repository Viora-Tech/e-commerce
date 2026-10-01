import { loadEnv } from '@commerce/config'
import { customerSubscription, verifyUnsubscribeToken } from '@commerce/core'
import type { Metadata } from 'next'
import { unsubscribeContent as copy } from '@/data/marketing'
import { resubscribeAction, unsubscribeAction } from '@/lib/marketing-actions'
import { inStore } from '@/lib/store-context'

type Props = { params: Promise<{ storeId: string; token: string }> }

export const metadata: Metadata = { title: copy.title, robots: { index: false } }

/**
 * Where the unsubscribe link in a marketing email lands. Opening the page
 * changes nothing (mail scanners open links); the shopper confirms with a
 * button. Mail clients' one-click unsubscribe posts to /api/m/unsubscribe.
 */
export default async function UnsubscribePage({ params }: Props) {
  // Hooks
  const { storeId, token } = await params
  const verified = verifyUnsubscribeToken(token, loadEnv(process.env).SETTINGS_SECRET)
  const state =
    verified && verified.storeId === storeId
      ? await inStore(storeId, (tx) => customerSubscription(tx, verified.customerId))
      : null

  // Early returns
  if (!state?.email) {
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
  const subscribed = state.acceptsMarketing && !state.unsubscribedAt

  return (
    <section className="page-width flex flex-col items-center gap-6 py-24 text-center">
      <h1 className="h2">{copy.title}</h1>
      <p className="text-body">
        {subscribed ? copy.subscribed(state.email) : copy.unsubscribed(state.email)}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {subscribed ? (
          <>
            <form action={unsubscribeAction.bind(null, token)}>
              <button type="submit" className="btn btn--primary">
                {copy.confirm}
              </button>
            </form>
            <a href="/" className="btn btn--secondary">
              {copy.keep}
            </a>
          </>
        ) : (
          <>
            <form action={resubscribeAction.bind(null, token)}>
              <button type="submit" className="btn btn--secondary">
                {copy.resubscribe}
              </button>
            </form>
            <a href="/" className="btn btn--primary">
              {copy.home}
            </a>
          </>
        )}
      </div>
    </section>
  )
}
