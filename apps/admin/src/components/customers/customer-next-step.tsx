'use client'

import { Clock, Gift, Send, WhatsappLogo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { whatsappUrl } from '@/lib/customer-contact'
import { formatPaise } from '@/lib/money'
import type { CustomerDetail, NextStep } from './customer-detail-types'

type CustomerNextStepProps = {
  customer: CustomerDetail
  step: NextStep
}

/**
 * The Next step card (Figma "Customer · Next step"): one suggestion, shown only when the
 * orders back it, with the ways to reach them that the customer's contact details allow.
 * "Not now" hides it until the page is opened again.
 */
export default function CustomerNextStep({ customer, step }: CustomerNextStepProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)
  const [dismissed, setDismissed] = useState(false)

  // Early returns
  if (dismissed) return null

  // Render logic
  const copy = detail.nextStep
  const chat = whatsappUrl(customer.phone)
  const mail = customer.email ? `mailto:${customer.email}` : null
  const Icon = step.kind === 'vip' ? Gift : Clock
  const content =
    step.kind === 'vip'
      ? { title: copy.vip.title, body: copy.vip.body(step.orders, formatPaise(step.spentPaise)) }
      : { title: copy.winBack.title, body: copy.winBack.body(step.days) }

  return (
    <section
      aria-label={copy.eyebrow}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-primary/20 bg-primary-soft p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-card [&_svg]:size-5">
        <Icon aria-hidden />
      </span>
      <div className="min-w-[min(100%,16rem)] flex-1">
        <p className="text-caption font-medium text-primary">{copy.eyebrow}</p>
        <p className="text-card-title text-ink-strong">{content.title}</p>
        <p className="text-body text-muted-foreground">{content.body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          {copy.notNow}
        </Button>
        {chat && mail ? (
          <Button variant="outline" render={<a href={mail} />} nativeButton={false}>
            <Send aria-hidden="true" />
            {copy.email}
          </Button>
        ) : null}
        {chat ? (
          <Button render={<a href={chat} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <WhatsappLogo />
            {copy.whatsapp}
          </Button>
        ) : mail ? (
          <Button render={<a href={mail} />} nativeButton={false}>
            <Send />
            {copy.emailPrimary}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
