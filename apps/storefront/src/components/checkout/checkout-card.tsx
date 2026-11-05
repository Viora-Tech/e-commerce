import type { ReactNode } from 'react'
import { CK_HEADING } from '@/lib/checkout-classes'

type CheckoutCardProps = {
  /** The DOM id Pay scrolls to (`sectionDomId`). */
  id: string
  headingId: string
  title: string
  body?: string | undefined
  /** The step on screen. The others stay mounted, so their fields still go with the order. */
  active: boolean
  /** Right of the heading: "Sign in", "To 122001", "Encrypted and secure". */
  aside?: ReactNode
  children: ReactNode
}

/** One step of the checkout: its heading and line, then its fields. Only the active one shows. */
export default function CheckoutCard({
  id,
  headingId,
  title,
  body,
  active,
  aside = null,
  children,
}: CheckoutCardProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={`${active ? 'flex' : 'hidden'} scroll-mt-4 flex-col gap-4 outline-none`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={headingId}
            className={`${CK_HEADING} text-[1.5rem]! tracking-[-0.02em]! sm:text-[1.75rem]!`}
          >
            {title}
          </h2>
          {body ? <p className="text-[0.875rem] text-ck-muted">{body}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
