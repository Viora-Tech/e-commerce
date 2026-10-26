import { settingsSecret } from '@commerce/config'
import { codConfirmView } from '@commerce/core'
import { formatMoney } from '@commerce/money'
import type { Metadata } from 'next'
import { codConfirmContent as copy } from '@/data/cod'
import { answerCodAction } from '@/lib/cod-actions'
import { inStore } from '@/lib/store-context'

type Props = {
  params: Promise<{ storeId: string; token: string }>
  searchParams: Promise<{ done?: string }>
}

export const metadata: Metadata = { title: copy.title, robots: { index: false } }

// Centred by padding on a wrapper: a theme's own `section { margin: 0 }` outranks margin utilities.
const PAGE = 'flex justify-center px-4 py-16 md:py-24'

const PANEL =
  'flex w-full max-w-[28rem] flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6 md:p-8'

/**
 * Where the COD confirmation message lands (COD & RTO app). Opening the page changes
 * nothing (link scanners open links); the shopper confirms or cancels with a button.
 */
export default async function CodConfirmPage({ params, searchParams }: Props) {
  // Hooks
  const { storeId, token } = await params
  const { done } = await searchParams
  const view = await inStore(storeId, (tx) =>
    codConfirmView({ storeId, tx }, token, settingsSecret()),
  )

  // Early returns
  if (!view) {
    return (
      <div className={PAGE}>
        <section className={PANEL}>
          <h1 className="h3">{copy.title}</h1>
          <p className="text-body text-muted">{copy.invalid}</p>
          <a href="/" className="btn btn--primary">
            {copy.home}
          </a>
        </section>
      </div>
    )
  }

  // Render logic
  const answered = view.status === 'confirmed' || view.status === 'cancelled'
  const message =
    done === 'shipped'
      ? copy.shipped
      : view.status === 'confirmed'
        ? copy.confirmed(view.orderNumber)
        : view.status === 'cancelled'
          ? copy.cancelled(view.orderNumber)
          : copy.ask(view.orderNumber, formatMoney(view.totalPaise), view.items)

  return (
    <div className={PAGE}>
      <section className={PANEL}>
        <h1 className="h3">{copy.title}</h1>
        <p className="text-body text-muted" role={done ? 'status' : undefined}>
          {message}
        </p>
        {answered ? (
          <a href="/" className="btn btn--primary">
            {copy.home}
          </a>
        ) : (
          <div className="flex flex-col gap-3">
            <form action={answerCodAction.bind(null, token, 'confirm')}>
              <button type="submit" className="btn btn--primary w-full">
                {copy.confirm}
              </button>
            </form>
            {view.canCancel ? (
              <form
                action={answerCodAction.bind(null, token, 'cancel')}
                className="flex flex-col gap-2"
              >
                <button type="submit" className="btn btn--secondary w-full">
                  {copy.cancel}
                </button>
                <span className="text-small text-muted">{copy.cancelHelp}</span>
              </form>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
