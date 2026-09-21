import type { ManualInstructions } from '@commerce/payments'
import { toDataURL } from 'qrcode'
import { manualPaymentContent as content, UPI_QR_SIZE } from '@/data/checkout'

type ManualPaymentInstructionsProps = {
  instructions: ManualInstructions
  amountLabel: string
}

/** label, value, render value in monospace */
type BankRow = [string, string, boolean]

/** Server component: the QR is rendered to a data URI here, nothing runs in the browser. */
export default async function ManualPaymentInstructions({
  instructions,
  amountLabel,
}: ManualPaymentInstructionsProps) {
  const { upi, bank, reference, note } = instructions
  const qr = upi ? await toDataURL(upi.deepLink, { margin: 1, width: UPI_QR_SIZE }) : null
  const bankRows: BankRow[] = bank
    ? [
        [content.bank.rows.bankName, bank.bankName, false],
        [content.bank.rows.accountName, bank.accountName, false],
        [content.bank.rows.accountNumber, bank.accountNumber, true],
        [content.bank.rows.ifsc, bank.ifsc, true],
        [content.bank.rows.reference, reference, true],
      ]
    : []

  return (
    <div className="manual-pay">
      <p className="text-body">{content.intro(amountLabel, reference)}</p>
      <div className="manual-pay__grid">
        {upi ? (
          <div className="manual-pay__card">
            <h3 className="h4">{content.upi.heading}</h3>
            {qr ? (
              // biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise.
              <img
                className="manual-pay__qr"
                src={qr}
                alt={content.upi.qrAlt(upi.id)}
                width={UPI_QR_SIZE}
                height={UPI_QR_SIZE}
              />
            ) : null}
            <p className="text-small">
              <span className="text-caption">{content.upi.idLabel}</span>
              <br />
              <code>{upi.id}</code>
            </p>
            <a href={upi.deepLink} className="btn btn--primary btn--small manual-pay__open">
              {content.upi.open}
            </a>
          </div>
        ) : null}
        {bank ? (
          <div className="manual-pay__card">
            <h3 className="h4">{content.bank.heading}</h3>
            <dl className="manual-pay__bank">
              {bankRows.map(([label, value, mono]) => (
                <Row key={label} label={label} value={value} mono={mono} />
              ))}
            </dl>
          </div>
        ) : null}
      </div>
      {note ? <p className="text-small manual-pay__note">{note}</p> : null}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{mono ? <code>{value}</code> : value}</dd>
    </>
  )
}
