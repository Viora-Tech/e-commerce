import { settingsSecret } from '@commerce/config'
import { openUnsubscribeToken } from '@commerce/plugin-reviews/server'
import type { Metadata } from 'next'
import { reviewEmailsContent as copy } from '@/data/reviews'
import { stopReviewEmailsAction } from '@/lib/review-email-actions'

type Props = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ t?: string; done?: string }>
}

export const metadata: Metadata = { title: copy.title, robots: { index: false } }

/**
 * Where "Stop review emails" in a review request lands. Opening the page changes nothing
 * (mail scanners open links); the shopper confirms with a button.
 */
export default async function ReviewEmailsPage({ params, searchParams }: Props) {
  // Hooks
  const { storeId } = await params
  const { t = '', done } = await searchParams
  const valid = openUnsubscribeToken(settingsSecret(), t, storeId) !== null

  // Early returns
  if (!valid) {
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

  return (
    <section className="mx-auto my-16 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 md:my-24 md:p-8">
      <h1 className="h3">{copy.title}</h1>
      <p className="text-body text-muted">{done ? copy.done : copy.question}</p>
      {done ? (
        <a href="/" className="btn btn--primary">
          {copy.home}
        </a>
      ) : (
        <div className="flex flex-col gap-3">
          <form action={stopReviewEmailsAction.bind(null, t)}>
            <button type="submit" className="btn btn--primary">
              {copy.confirm}
            </button>
          </form>
          <a href="/" className="btn btn--secondary">
            {copy.keep}
          </a>
        </div>
      )}
    </section>
  )
}
