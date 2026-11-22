'use client'

import { InfoIcon } from '@commerce/ui/icons'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { type DnsProviderId, senderEmailContent } from '@/data/sender-email'
import { useCopy } from '@/hooks/use-copy'

const PROVIDERS: DnsProviderId[] = ['cloudflare', 'godaddy', 'hostinger', 'namecheap']

/** "Where do I add these?": short steps for the four registrars most Indian shops use. */
export default function DnsProviderHelp() {
  // Hooks
  const copy = useCopy(senderEmailContent.where)
  const [provider, setProvider] = useState<DnsProviderId>('cloudflare')

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-body font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <InfoIcon aria-hidden="true" className="size-4" />
        {copy.trigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{copy.title}</PopoverTitle>
          <PopoverDescription>{copy.intro}</PopoverDescription>
        </PopoverHeader>
        <div className="mt-2 flex flex-col gap-2">
          <PillTabs
            variant="segmented"
            className="max-w-full flex-wrap"
            value={provider}
            onChange={setProvider}
            tabs={PROVIDERS.map((p) => ({ value: p, label: copy.providers[p].name }))}
          />
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-body text-foreground">
            {copy.providers[provider].steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <p className="mt-3 text-caption text-muted-foreground">{copy.other}</p>
      </PopoverContent>
    </Popover>
  )
}
