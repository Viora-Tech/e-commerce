'use client'

import {
  ChevronDown,
  Globe,
  InstagramLogo,
  LayoutGrid,
  Monitor,
  MoreHorizontal,
  Store,
  WhatsappLogo,
} from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'

export type Channel = 'all' | 'online'

type ChannelMenuProps = {
  value: Channel
  onChange: (channel: Channel) => void
  /** The pill's classes (the card's filter-pill look). */
  className: string
}

/* Figma 580:692 channels list. Only the online store sells today, so the rest wait as "Soon". */
const LIVE = [
  { id: 'all', icon: LayoutGrid },
  { id: 'online', icon: Store },
] as const

const SOON = [
  { id: 'instagram', icon: InstagramLogo },
  { id: 'whatsapp', icon: WhatsappLogo },
  { id: 'google', icon: Globe },
  { id: 'pos', icon: Monitor },
  { id: 'other', icon: MoreHorizontal },
] as const

/** The "All channels ▾" menu on the Home analytics card. */
export default function ChannelMenu({ value, onChange, className }: ChannelMenuProps) {
  // Hooks
  const content = useCopy(homePageContent)

  // Event handlers
  const handleChange = (next: unknown) => {
    if (next === 'all' || next === 'online') onChange(next)
  }

  // Render logic
  const copy = content.sales
  const Current = value === 'online' ? Store : LayoutGrid

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={className}>
        <Current aria-hidden="true" />
        {copy.channelOptions[value]}
        <ChevronDown className="text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuRadioGroup value={value} onValueChange={handleChange}>
          {LIVE.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} closeOnClick>
              <c.icon className="size-4" aria-hidden="true" />
              {copy.channelOptions[c.id]}
            </DropdownMenuRadioItem>
          ))}
          {SOON.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} disabled>
              <c.icon className="size-4" aria-hidden="true" />
              <span className="flex-1">{copy.channelOptions[c.id]}</span>
              <span className="text-xs text-muted-foreground">{copy.soon}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
