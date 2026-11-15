import { settingsSecret } from '@commerce/config'
import { openUnsubscribeToken } from '@commerce/plugin-reviews/server'
import type { Metadata } from 'next'
import SystemPanel from '@/components/system/system-panel'
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
      <SystemPanel>
        <h1 className="h3">{copy.title}</h1>
        <p className="text-body text-muted">{copy.invalid}</p>
        <a href="/" className="btn btn--primary">
          {copy.home}
        </a>
      </SystemPanel>
    )
  }

  return (
    <SystemPanel>
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
    </SystemPanel>
  )
}
