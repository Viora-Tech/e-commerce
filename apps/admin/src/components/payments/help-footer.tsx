'use client'

import { siteConfig } from '@commerce/config/site'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

/** A plain link to the setup guide in the docs (WhatsApp help lives only in the user menu). */
export default function HelpFooter() {
  // Hooks
  const copy = useCopy(paymentsSetupContent)

  return (
    <div className="flex justify-center">
      <Button
        variant="ghost"
        className="gap-2"
        render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
        nativeButton={false}
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        {copy.guide.label}
      </Button>
    </div>
  )
}
