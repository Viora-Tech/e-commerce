import type { SourceKey } from '@commerce/api'
import {
  FacebookLogo,
  Globe,
  GoogleLogo,
  InstagramLogo,
  Send,
  Sparkle,
  WhatsappLogo,
  YoutubeLogo,
} from '@commerce/ui/icons'

type SourceIconProps = {
  source: SourceKey
  className?: string
}

const ICONS: Record<SourceKey, typeof InstagramLogo> = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  youtube: YoutubeLogo,
  google: GoogleLogo,
  whatsapp: WhatsappLogo,
  ai_assistant: Sparkle,
  email: Send,
  direct: Globe,
  other: Globe,
}

/** The brand mark (or a generic glyph for direct/AI/other) for one normalised source. */
export default function SourceIcon({ source, className }: SourceIconProps) {
  // Render logic
  const Icon = ICONS[source]

  return <Icon className={className} />
}
