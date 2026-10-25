import type { SalesChannelId } from '@commerce/core/sales-channels'
import {
  ChatGptLogo,
  CopilotLogo,
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  type LucideIcon,
  PerplexityLogo,
  WhatsappLogo,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

const LOGOS: Record<SalesChannelId, LucideIcon> = {
  chatgpt: ChatGptLogo,
  google_ai: GoogleLogo,
  perplexity: PerplexityLogo,
  copilot: CopilotLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  whatsapp: WhatsappLogo,
  google: GoogleLogo,
}

type ChannelLogoProps = {
  channel: SalesChannelId
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: 'size-7 rounded-md [&_svg]:size-4',
  md: 'size-9 rounded-lg [&_svg]:size-5',
  lg: 'size-12 rounded-xl [&_svg]:size-6',
}

/** The channel's mark on a quiet tile (Figma "Channel logo"). */
export default function ChannelLogo({ channel, size = 'md', className }: ChannelLogoProps) {
  // Render logic
  const Icon = LOGOS[channel]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-border bg-card text-foreground shadow-input',
        SIZE[size],
        className,
      )}
    >
      <Icon />
    </span>
  )
}
