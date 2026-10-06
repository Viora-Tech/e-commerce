'use client'

import { applyMergeTags, type EmailBlock, renderMarketingEmail } from '@commerce/core/marketing'
import { Monitor, Smartphone } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { campaignEditorContent } from '@/data/marketing-campaigns'

type EmailPreviewProps = {
  storeName: string
  storefrontUrl: string
  subject: string
  previewText: string
  blocks: EmailBlock[]
  /** A sample basket for cart and checkout automations. */
  sampleCart?: boolean | undefined
}

const copy = campaignEditorContent.preview

const SAMPLE_MERGE = {
  first_name: 'Asha',
  name: 'Asha Menon',
  discount_code: 'WELCOME10',
  checkout_url: '#',
  cart_total: '₹4,998',
  order_number: '#1042',
}

const SAMPLE_CART = {
  lines: [{ title: 'Glasspad Pro / Black', quantity: 1, priceLabel: '₹4,998' }],
  totalLabel: '₹4,998',
}

/**
 * Live preview of the email exactly as the worker renders it, in a sandboxed
 * frame (no scripts) at desktop or phone width, under an inbox-style header.
 */
export default function EmailPreview({
  storeName,
  storefrontUrl,
  subject,
  previewText,
  blocks,
  sampleCart,
}: EmailPreviewProps) {
  // Hooks
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  // Render logic
  const shownSubject = applyMergeTags(subject, { ...SAMPLE_MERGE, store_name: storeName })
  const { html } = renderMarketingEmail(blocks, {
    storeName,
    shopUrl: storefrontUrl,
    previewText,
    merge: SAMPLE_MERGE,
    cart: sampleCart ? SAMPLE_CART : undefined,
    unsubscribeUrl: '#',
  })

  return (
    <Card gap="none" inset="none" className="sticky top-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-card-title">{copy.title}</p>
        <ToggleGroup
          value={[device]}
          onValueChange={(v) => v[0] && setDevice(v[0] as 'desktop' | 'mobile')}
          size="sm"
        >
          <ToggleGroupItem value="desktop" aria-label={copy.desktop}>
            <Monitor />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label={copy.mobile}>
            <Smartphone />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="border-b border-border px-4 py-3">
        <p className="truncate text-body-strong">{shownSubject || ' '}</p>
        <p className="truncate text-caption text-muted-foreground">
          {copy.from(storeName)}
          {previewText ? ` · ${previewText}` : ''}
        </p>
      </div>
      <div className="flex justify-center bg-muted p-3">
        <iframe
          title={copy.title}
          sandbox=""
          srcDoc={html}
          className={cn(
            'h-[40rem] rounded-md border-0 bg-background transition-[width]',
            device === 'mobile' ? 'w-[23.4375rem]' : 'w-full',
          )}
        />
      </div>
    </Card>
  )
}
