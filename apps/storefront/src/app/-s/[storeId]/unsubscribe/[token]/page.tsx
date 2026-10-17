import { settingsSecret } from '@commerce/config'
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
  const verified = verifyUnsubscribeToken(token, settingsSecret())
  const state =
    verified && verified.storeId === storeId
      ? await inStore(storeId, (tx) => customerSubscription(tx, verified.customerId))
      : null

  // Early returns
  if (!state?.email) {
    return (
      <section className="mx-auto my-16 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 md:my-24 md:p-8">
        <h1 className="h3">{copy.title}</h1>
        <p className="text-body text-muted">{copy.invalid}</p>
        <a href="/" className="btn btn--primary">
          {copy.home}
        </a>
      </section>
    )
  }

  // Render logic
  const subscribed = state.acceptsMarketing && !state.unsubscribedAt

  return (
    <section className="mx-auto my-16 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 md:my-24 md:p-8">
      <h1 className="h3">{copy.title}</h1>
      <p className="text-body text-muted">
        {subscribed ? copy.subscribed(state.email) : copy.unsubscribed(state.email)}
      </p>
      <div className="flex flex-col gap-3">
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
