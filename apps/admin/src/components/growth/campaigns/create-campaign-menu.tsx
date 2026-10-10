'use client'

import { ChevronDown, MessageSquare, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useRouter } from 'next/navigation'
import { campaignsContent as copy } from '@/data/marketing-campaigns'
import { routes } from '@/lib/routes'

const OPTIONS = [
  { kind: 'email', icon: Send, label: copy.createEmail, hint: copy.createEmailHint },
  {
    kind: 'whatsapp',
    icon: MessageSquare,
    label: copy.createWhatsapp,
    hint: copy.createWhatsappHint,
  },
] as const

/** "Create campaign" with the two kinds, email and WhatsApp, as Shopify offers its apps. */
export default function CreateCampaignMenu() {
  // Hooks
  const router = useRouter()

  // Render logic
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button />}>
        {copy.create}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.kind}
            onClick={() => router.push(`${routes.growth.newCampaign()}?kind=${o.kind}`)}
            className="items-start gap-3 py-2"
          >
            <o.icon className="mt-0.5 size-4 text-muted-foreground" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{o.label}</span>
              <span className="text-caption text-muted-foreground">{o.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
