'use client'

import { ArrowRight } from '@commerce/ui/icons'
import Link from 'next/link'
import NoticeBar from '@/components/layout/notice-bar'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

const APP = 'delivery-options'

/**
 * Options: the default courier for some products is set in Product rules (a rule's Preferred
 * courier), not here, with a link there. The owner looked for it on this page (#1781).
 */
export default function RulesDefaultNote() {
  // Hooks
  const pages = useCopy(deliveryPagesContent)

  // Render logic
  return (
    <NoticeBar
      action={
        <Link
          href={routes.apps.page(APP, 'rules')}
          className="flex items-center gap-1 text-body font-medium whitespace-nowrap text-ink-strong hover:underline"
        >
          {pages.rulesNote.link}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      }
    >
      {pages.rulesNote.text}
    </NoticeBar>
  )
}
