'use client'

import { siteConfig } from '@commerce/config/site'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

type HelpFooterProps = {
  /** The merchant guide page this settings page is explained on ("payments", "shipping"). */
  page: 'payments' | 'shipping' | 'notifications'
}

/**
 * A plain link to this page's setup guide in the docs (WhatsApp help lives only in the user
 * menu). It opens the page's own guide, not the docs home.
 */
export default function HelpFooter({ page }: HelpFooterProps) {
  // Hooks
  const copy = useCopy(paymentsSetupContent)

  // Render logic
  const href = `${siteConfig.urls.docs}/merchant-guide/settings/${page}`

  return (
    <div className="flex justify-center">
      <Button
        variant="ghost"
        className="gap-2"
        render={<a href={href} target="_blank" rel="noreferrer" />}
        nativeButton={false}
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        {copy.guide.label}
      </Button>
    </div>
  )
}
