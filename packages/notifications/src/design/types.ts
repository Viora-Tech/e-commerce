/**
 * A merchant's own layout for one transactional email (Settings → Notifications → Edit design):
 * an ordered list of blocks. Free blocks (logo, heading, text, image, button, divider, spacer,
 * social, help box, footer) carry the merchant's settings; `intro` is the built-in kicker,
 * heading and line under it (its words can be changed, it cannot be removed); `slot` blocks
 * stand for the template's own data blocks (the order ticket, the items, the code) and are
 * filled from `TemplateData` on every send. No saved design means the built-in email.
 */

export const DESIGN_VERSION = 1

/** Limits shared by the API's validation and the render-time parser. */
export const DESIGN_LIMITS = {
  blocks: 60,
  text: 2000,
  label: 120,
  subject: 200,
  url: 2000,
  id: 40,
  /** The whole design as JSON. */
  bytes: 64_000,
} as const

export type SpacerSize = 'small' | 'medium' | 'large'
export type TextAlign = 'left' | 'center'

export type LogoBlock = { id: string; type: 'logo'; menu: boolean }
export type HeadingBlock = { id: string; type: 'heading'; text: string; size: 'large' | 'small' }
export type FreeTextBlock = {
  id: string
  type: 'text'
  text: string
  align: TextAlign
  muted: boolean
}
export type ImageBlock = {
  id: string
  type: 'image'
  src: string
  alt: string
  href?: string | undefined
  /** Share of the card's width, 20-100. */
  width: number
}
export type FreeButtonBlock = { id: string; type: 'button'; label: string; url: string }
export type FreeDividerBlock = { id: string; type: 'divider'; label: string }
export type SpacerBlock = { id: string; type: 'spacer'; size: SpacerSize }
export type SocialBlock = { id: string; type: 'social' }
export type HelpBlock = { id: string; type: 'help' }
export type FooterBlock = { id: string; type: 'footer'; social: boolean }

/** The built-in kicker, heading and lead; an empty field keeps the built-in words. */
export type IntroBlock = {
  id: string
  type: 'intro'
  eyebrow?: string | undefined
  heading?: string | undefined
  lead?: string | undefined
}

/** One of the template's own blocks, by its slot key (`items#0`, `ticket#0`). */
export type SlotBlock = { id: string; type: 'slot'; slot: string }

export type FreeBlock =
  | LogoBlock
  | HeadingBlock
  | FreeTextBlock
  | ImageBlock
  | FreeButtonBlock
  | FreeDividerBlock
  | SpacerBlock
  | SocialBlock
  | HelpBlock
  | FooterBlock

export type DesignBlock = FreeBlock | IntroBlock | SlotBlock

export type FreeBlockType = FreeBlock['type']
export type DesignBlockType = DesignBlock['type']

export const FREE_BLOCK_TYPES: readonly FreeBlockType[] = [
  'logo',
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'spacer',
  'social',
  'help',
  'footer',
]

export type EmailTemplateDesign = {
  version: typeof DESIGN_VERSION
  /** The merchant's subject line, with variables; empty keeps the built-in subject. */
  subject?: string | undefined
  blocks: DesignBlock[]
  /**
   * Built-in blocks the merchant removed (only plain lines and dividers may go). A built-in
   * block missing from `blocks` and not listed here is one the sample never showed: it is put
   * back next to its neighbours, so a real order never loses a part of its email.
   */
  removed: string[]
}
