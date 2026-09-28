import type { PolicyLink } from '@commerce/core/policies'
import { checkoutContent as content } from '@/data/checkout'

type CheckoutAgreementProps = { policies: PolicyLink[] }

/** Separator before the i-th of n links: none, ", " or " and ". */
const separator = (i: number, n: number): string =>
  i === 0 ? '' : i === n - 1 ? ` ${content.agreementAnd} ` : ', '

/** "By placing your order, you agree to our Terms of service, Privacy policy and Refund policy." */
export default function CheckoutAgreement({ policies }: CheckoutAgreementProps) {
  // Early returns
  if (policies.length === 0) return null

  return (
    <p className="text-small text-muted">
      {content.agreement}{' '}
      {policies.map((p, i) => (
        <span key={p.type}>
          {separator(i, policies.length)}
          <a
            href={p.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {p.title}
          </a>
        </span>
      ))}
      .
    </p>
  )
}
