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
    <p className="text-center text-[0.75rem] leading-relaxed text-ck-muted">
      {content.agreement}{' '}
      {policies.map((p, i) => (
        <span key={p.type}>
          {separator(i, policies.length)}
          <a
            href={p.href}
            target="_blank"
            rel="noreferrer"
            className="text-ck-muted! underline decoration-ck-line underline-offset-[3px] hover:text-ck-ink!"
          >
            {p.title}
          </a>
        </span>
      ))}
      .
    </p>
  )
}
