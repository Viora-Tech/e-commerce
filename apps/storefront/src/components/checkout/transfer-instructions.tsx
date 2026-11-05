import type { ManualInstructions } from '@commerce/payments'
import { toDataURL } from 'qrcode'
import CopyButton from '@/components/checkout/copy-button'
import PaymentMark from '@/components/checkout/payment-mark'
import { manualPaymentContent as content, UPI_QR_SIZE } from '@/data/checkout'
import { CK_BUTTON_PRIMARY, CK_CARD, CK_HEADING } from '@/lib/checkout-classes'

type TransferInstructionsProps = {
  instructions: ManualInstructions
  amountLabel: string
}

const HEADING = `${CK_HEADING} text-[1.0625rem]! leading-[1.5625rem]!`

/**
 * "UPI or bank transfer to the shop", in the checkout's look: the shop's UPI QR beside what to
 * pay and where, then its bank details, each with Copy so nothing is retyped. Drawn on the
 * server; the reference is what the merchant matches the money to the order with.
 */
export default async function TransferInstructions({
  instructions,
  amountLabel,
}: TransferInstructionsProps) {
  const { upi, bank, reference, note } = instructions
  const qr = upi ? await toDataURL(upi.deepLink, { margin: 1, width: UPI_QR_SIZE }) : null
  const payRows: [string, string][] = upi
    ? [
        [content.upi.idLabel, upi.id],
        [content.upi.amount, amountLabel],
        [content.upi.note, reference],
      ]
    : []
  const bankRows: [string, string, boolean][] = bank
    ? [
        [content.bank.rows.bankName, bank.bankName, false],
        [content.bank.rows.accountName, bank.accountName, false],
        [content.bank.rows.accountNumber, bank.accountNumber, true],
        [content.bank.rows.ifsc, bank.ifsc, true],
        [content.bank.rows.reference, reference, true],
      ]
    : []

  return (
    <>
      <p className="text-[0.875rem] leading-5 text-pretty text-ck-muted">
        {content.intro(amountLabel, reference)}
      </p>
      {upi ? (
        <section
          className={`${CK_CARD} flex flex-col items-center gap-6 p-5 sm:flex-row sm:items-start`}
        >
          {qr ? (
            // biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise.
            <img
              src={qr}
              alt={content.upi.qrAlt(upi.id)}
              width={UPI_QR_SIZE}
              height={UPI_QR_SIZE}
              className="size-40! shrink-0 rounded-lg bg-ck-qr"
            />
          ) : null}
          <div className="flex w-full min-w-0 flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <h2 className={HEADING}>{content.upi.heading(amountLabel)}</h2>
              <p className="text-[0.8125rem] leading-[1.1875rem] text-ck-muted">
                {content.upi.help}
              </p>
            </div>
            <div className="divide-y divide-ck-line rounded-ck bg-ck-soft">
              {payRows.map(([label, value]) => (
                <div key={label} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="w-16 shrink-0 text-[0.8125rem] text-ck-faint">{label}</span>
                  <span className="min-w-0 flex-1 text-[0.875rem] font-medium text-ck-ink [overflow-wrap:anywhere]">
                    {value}
                  </span>
                  <CopyButton value={value} label={label} />
                </div>
              ))}
            </div>
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <PaymentMark mark="GPay" />
              <PaymentMark mark="PhonePe" />
              <PaymentMark mark="Paytm" />
            </span>
            <a href={upi.deepLink} className={`${CK_BUTTON_PRIMARY} no-underline lg:hidden`}>
              {content.upi.open}
            </a>
          </div>
        </section>
      ) : null}
      {bank ? (
        <section className={`${CK_CARD} flex flex-col gap-2.5 p-5`}>
          <h2 className={HEADING}>{content.bank.heading}</h2>
          <dl className="m-0! divide-y divide-ck-line">
            {bankRows.map(([label, value, copy]) => (
              <div key={label} className="flex items-center gap-3 py-2.5 sm:gap-6">
                <dt className="w-28 shrink-0 text-[0.75rem] font-medium text-ck-faint">{label}</dt>
                <dd className="m-0! min-w-0 flex-1 text-[0.875rem] text-ck-ink [overflow-wrap:anywhere]">
                  {value}
                </dd>
                {copy ? <CopyButton value={value} label={label} /> : null}
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {note ? <p className="text-[0.8125rem] whitespace-pre-line text-ck-muted">{note}</p> : null}
    </>
  )
}
