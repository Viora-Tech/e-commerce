import CheckoutIcon from '@/components/checkout/checkout-icon'
import { ACCOUNT_ERROR } from '@/lib/account-classes'

type AccountErrorProps = {
  /** Fields point at it with aria-describedby. */
  id?: string
  message: string | null
}

/** A refused step, in red with the alert mark; read out as it appears. */
export default function AccountError({ id, message }: AccountErrorProps) {
  // Early returns
  if (!message) return null

  return (
    <p id={id} className={ACCOUNT_ERROR} role="alert">
      <CheckoutIcon name="alert" className="mt-0.5! size-4" />
      {message}
    </p>
  )
}
