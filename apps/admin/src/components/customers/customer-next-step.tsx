'use client'

import { Clock, Gift, Send, WhatsappLogo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import NextStepBanner from '@/components/layout/next-step-banner'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { whatsappUrl } from '@/lib/customer-contact'
import { formatPaiseWhole } from '@/lib/money'
import type { CustomerDetail, NextStep } from './customer-detail-types'

type CustomerNextStepProps = {
  customer: CustomerDetail
  step: NextStep
}

/**
 * The Next step banner (Figma "Customer · Next step", on the shared NextStepBanner like the order
 * page): one suggestion, shown only when the
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
      ? {
          title: copy.vip.title,
          body: copy.vip.body(step.orders, formatPaiseWhole(step.spentPaise)),
        }
      : { title: copy.winBack.title, body: copy.winBack.body(step.days) }

  return (
    <NextStepBanner
      tone="action"
      eyebrow={copy.eyebrow}
      title={content.title}
      body={content.body}
      icon={<Icon aria-hidden />}
      actions={
        <>
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
            <Button
              render={<a href={chat} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <WhatsappLogo />
              {copy.whatsapp}
            </Button>
          ) : mail ? (
            <Button render={<a href={mail} />} nativeButton={false}>
              <Send />
              {copy.emailPrimary}
            </Button>
          ) : null}
        </>
      }
    />
  )
}
