import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'

type TrustLineProps = {
  /** The ways to pay on offer, e.g. "UPI · Cards · Cash on delivery". */
  methods: string[]
}

/** "Secure checkout" under the Pay button, with the ways to pay. Settings → Checkout → Branding turns it off. */
export default function TrustLine({ methods }: TrustLineProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center text-[0.75rem] text-ck-muted">
      <p className="flex items-center gap-1.5 font-medium text-ck-ink/80">
        <CheckoutIcon name="lock" className="size-3.5" />
        {content.trust.secure}
        {methods.length > 0 ? (
          <span className="font-normal text-ck-muted">· {methods.join(' · ')}</span>
        ) : null}
      </p>
      <p className="max-w-[24rem]">{content.trust.encrypted}</p>
    </div>
  )
}
