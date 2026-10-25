import { formatPaise } from '@commerce/blocks'
import { settingsSecret } from '@commerce/config'
import {
  loadDraftInvoice,
  orderViewToken,
  storeCheckoutLook,
  thankYouPath,
  verifyInvoiceToken,
} from '@commerce/core'
import { redirect } from 'next/navigation'
import CheckoutShell from '@/components/checkout/checkout-shell'
import InvoicePay from '@/components/checkout/invoice-pay'
import SummaryLine from '@/components/checkout/summary-line'
import { invoiceContent as content } from '@/data/checkout'
import { CK_HEADING } from '@/lib/checkout-classes'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; token: string }> }

/**
 * The signed page a draft invoice email's "Pay securely" button opens: the items and total,
 * and one Pay button. The token is an HMAC over the order id and an expiry, so a guessed id
 * opens nothing. An invoice already paid (or cancelled) lands on the order's thank-you page.
 */
export default async function InvoicePage({ params }: Params) {
  const { storeId, token } = await params
  const verified = verifyInvoiceToken(token, settingsSecret())
  const data = verified.ok
    ? await inStore(storeId, (tx) => loadDraftInvoice({ storeId, tx }, verified.orderId))
    : null

  // Paid, or no longer payable: the order's own page says where it stands.
  if (data && !data.payable)
    redirect(thankYouPath(data.number, orderViewToken(data.id, settingsSecret())))

  const look = await inStore(storeId, (tx) => storeCheckoutLook({ tx, storeId }))
  return (
    <CheckoutShell look={look} backHref="/" backLabel={content.back}>
      {data?.payable ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className={`${CK_HEADING} text-[1.75rem]!`}>{content.pageTitle(data.number)}</h1>
            <p className="text-[1rem] text-ck-muted">{content.intro(data.storeName)}</p>
          </div>
          <ul className="flex flex-col gap-4">
            {data.lines.map((l) => (
              <SummaryLine
                key={l.id}
                title={l.title ?? ''}
                variant={l.variant && l.variant !== 'Default' ? l.variant : null}
                quantity={l.quantity}
                linePaise={l.quantity * l.unitPricePaise}
                imageUrl={null}
              />
            ))}
          </ul>
          <p className="flex items-baseline justify-between border-t border-ck-summary-line pt-4 text-[1.125rem] font-semibold text-ck-ink">
            <span>{content.total}</span>
            <span className="tabular-nums">{formatPaise(data.totalPaise)}</span>
          </p>
          <InvoicePay token={token} totalLabel={formatPaise(data.totalPaise)} />
        </div>
      ) : (
        <p className="rounded-ck bg-ck-soft px-4 py-3 text-[0.9375rem] text-ck-ink">
          {content.unavailable}
        </p>
      )}
    </CheckoutShell>
  )
}
