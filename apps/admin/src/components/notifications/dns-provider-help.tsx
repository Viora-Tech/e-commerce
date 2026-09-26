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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { type DnsProviderId, senderEmailContent } from '@/data/sender-email'

const copy = senderEmailContent.where

const PROVIDERS: DnsProviderId[] = ['cloudflare', 'godaddy', 'hostinger', 'namecheap']

/** "Where do I add these?": short steps for the four registrars most Indian shops use. */
export default function DnsProviderHelp() {
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
        <Tabs defaultValue="cloudflare" className="mt-2">
          <TabsList className="w-full flex-wrap">
            {PROVIDERS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {copy.providers[p].name}
              </TabsTrigger>
            ))}
          </TabsList>
          {PROVIDERS.map((p) => (
            <TabsContent key={p} value={p}>
              <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-body text-foreground">
                {copy.providers[p].steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-3 text-caption text-muted-foreground">{copy.other}</p>
      </PopoverContent>
    </Popover>
  )
}
