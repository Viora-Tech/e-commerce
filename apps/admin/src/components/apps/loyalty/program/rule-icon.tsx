import {
  CalendarIcon,
  Eye,
  FacebookLogo,
  FireIcon,
  Gift,
  Globe,
  GoogleLogo,
  InstagramLogo,
  LinkIcon,
  MessageSquare,
  Newspaper,
  Send,
  ShoppingBag,
  StarIcon,
  UserRound,
  WhatsappLogo,
  YoutubeLogo,
} from '@commerce/ui/icons'
import type { ComponentType } from 'react'

type RuleIconProps = { type: string; ruleKey: string }

type Icon = ComponentType<{ className?: string }>

const BY_TYPE: Record<string, Icon> = {
  order_spend: ShoppingBag,
  first_order: Gift,
  signup: UserRound,
  newsletter: Newspaper,
  birthday: Gift,
  anniversary: CalendarIcon,
  daily_visit: Eye,
  visit_streak: FireIcon,
  product_review: StarIcon,
  google_review: GoogleLogo,
}

const BY_PLATFORM: Record<string, Icon> = {
  instagram: InstagramLogo,
  youtube: YoutubeLogo,
  facebook: FacebookLogo,
  whatsapp: WhatsappLogo,
  telegram: Send,
  discord: MessageSquare,
  reddit: MessageSquare,
  link: LinkIcon,
}

/** The glyph for an earning rule, in a small rounded tile (the platform's own mark for social). */
export default function RuleIcon({ type, ruleKey }: RuleIconProps) {
  // Render logic
  const Glyph = (type === 'social' ? BY_PLATFORM[ruleKey] : BY_TYPE[type]) ?? Globe

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-strong">
      <Glyph className="size-4" />
    </span>
  )
}
