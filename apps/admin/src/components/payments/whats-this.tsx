'use client'

import WhatsThisHelp from '@/components/settings/whats-this-help'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

/** The "What's this?" link: how online payments work, in two sentences (the one help popover). */
export default function WhatsThis() {
  // Hooks
  const copy = useCopy(paymentsSetupContent)

  return (
    <WhatsThisHelp
      trigger={copy.whatsThis.trigger}
      title={copy.whatsThis.title}
      body={copy.whatsThis.body}
    />
  )
}
