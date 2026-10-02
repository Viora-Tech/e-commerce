import type { ManualInstructions } from '@commerce/payments'
import { toDataURL } from 'qrcode'
import { manualPaymentContent as content, UPI_QR_SIZE } from '@/data/checkout'
import { CK_BUTTON_PRIMARY, CK_HEADING } from '@/lib/checkout-classes'

type TransferInstructionsProps = {
  instructions: ManualInstructions
  amountLabel: string
}

/**
 * "UPI or bank transfer to the shop", in the checkout's look: the shop's UPI QR (drawn
 * here on the server, nothing runs in the browser) and its bank details, with the
 * reference the shopper quotes so the merchant can match the money to the order.
 */
export default async function TransferInstructions({
  instructions,
  amountLabel,
}: TransferInstructionsProps) {
  const { upi, bank, reference, note } = instructions
  const qr = upi ? await toDataURL(upi.deepLink, { margin: 1, width: UPI_QR_SIZE }) : null
  const rows: [string, string, boolean][] = bank
    ? [
        [content.bank.rows.bankName, bank.bankName, false],
        [content.bank.rows.accountName, bank.accountName, false],
        [content.bank.rows.accountNumber, bank.accountNumber, true],
        [content.bank.rows.ifsc, bank.ifsc, true],
        [content.bank.rows.reference, reference, true],
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.9375rem] leading-relaxed text-ck-ink">
        {content.intro(amountLabel, reference)}
      </p>
      {upi ? (
        <div className="flex flex-col items-center gap-4 rounded-ck border border-ck-line bg-ck-field p-5 sm:flex-row sm:items-center">
          {qr ? (
            // biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise.
            <img
              src={qr}
              alt={content.upi.qrAlt(upi.id)}
              width={UPI_QR_SIZE}
              height={UPI_QR_SIZE}
              className="size-40! shrink-0 rounded-ck bg-ck-qr p-2"
            />
          ) : null}
          <div className="flex w-full flex-col gap-3">
            <h2 className={`${CK_HEADING} text-[1rem]!`}>{content.upi.heading}</h2>
            <p className="flex flex-col gap-0.5 text-[0.875rem]">
              <span className="text-ck-muted">{content.upi.idLabel}</span>
              <code className="font-mono text-[0.9375rem] break-all">{upi.id}</code>
            </p>
            <a href={upi.deepLink} className={`${CK_BUTTON_PRIMARY} h-11! no-underline lg:hidden`}>
              {content.upi.open}
            </a>
          </div>
        </div>
      ) : null}
      {bank ? (
        <div className="flex flex-col gap-3 rounded-ck border border-ck-line bg-ck-field p-5">
          <h2 className={`${CK_HEADING} text-[1rem]!`}>{content.bank.heading}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.875rem]">
            {rows.map(([label, value, mono]) => (
              <div key={label} className="contents">
                <dt className="text-ck-muted">{label}</dt>
                <dd className={mono ? 'font-mono break-all' : ''}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {note ? <p className="text-[0.8125rem] whitespace-pre-line text-ck-muted">{note}</p> : null}
    </div>
  )
}
