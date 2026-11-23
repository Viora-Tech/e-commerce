import type { Align, BlockBox, ButtonStyle, DesignStyles, Hex, SlotEdit } from './style-types'

/**
 * A merchant's own layout for one transactional email (Settings → Notifications → Edit design):
 * an ordered list of blocks. Free blocks (logo, heading, text, image, button, divider, spacer,
 * social, help box, footer, hero, products, coupon, video, HTML, columns) carry the merchant's
 * settings; `intro` is the built-in kicker, heading and line under it (its words can be changed,
 * it cannot be removed); `slot` blocks stand for the template's own data blocks (the order
 * ticket, the items, the code) and are filled from `TemplateData` on every send, with the
 * merchant's words and colours over them. No saved design means the built-in email.
 *
 * Version 2 (23 Nov 2026) adds the email's `styles`, a `box` on every block, `edit` on slots and
 * the new block types. Every new field is optional, so a version 1 design reads as version 2
 * unchanged (`parseEmailDesign` upgrades it) and sends the same email.
 */

export const DESIGN_VERSION = 2

/** Versions a stored design may carry; older ones are upgraded when read. */
export const DESIGN_VERSIONS: readonly number[] = [1, 2]

/** Limits shared by the API's validation and the render-time parser. */
export const DESIGN_LIMITS = {
  blocks: 60,
  text: 2000,
  label: 120,
  subject: 200,
  url: 2000,
  id: 40,
  html: 20_000,
  products: 9,
  links: 6,
  /** Blocks in one column of a Columns block. */
  cell: 8,
  /** The whole design as JSON. */
  bytes: 96_000,
} as const

export type SpacerSize = 'small' | 'medium' | 'large'
export type TextAlign = 'left' | 'center'

/** Every block may carry its own box (background, spacing, alignment). */
type Base = { id: string; box?: BlockBox | undefined }

export type LogoBlock = Base & { type: 'logo'; menu: boolean }
export type HeadingBlock = Base & {
  type: 'heading'
  text: string
  size: 'large' | 'small'
  colour?: Hex | undefined
}
export type FreeTextBlock = Base & {
  type: 'text'
  text: string
  align: TextAlign
  muted: boolean
  /** `**bold**`, `*italic*`, `[link](url)` and `- ` lists (`rich-text.ts`); off for old blocks. */
  rich?: boolean | undefined
  colour?: Hex | undefined
}
export type ImageBlock = Base & {
  type: 'image'
  src: string
  alt: string
  href?: string | undefined
  /** Share of the card's width, 20-100. */
  width: number
}
export type FreeButtonBlock = Base & {
  type: 'button'
  label: string
  url: string
  style?: ButtonStyle | undefined
}
export type FreeDividerBlock = Base & { type: 'divider'; label: string; colour?: Hex | undefined }
export type SpacerBlock = Base & { type: 'spacer'; size: SpacerSize }
export type SocialBlock = Base & { type: 'social' }
export type HelpBlock = Base & {
  type: 'help'
  title?: string | undefined
  body?: string | undefined
  /** The WhatsApp button, when the store has a number. */
  whatsapp?: boolean | undefined
}
export type FooterBlock = Base & {
  type: 'footer'
  social: boolean
  /** The "why you got this" line; empty keeps the built-in one. */
  note?: string | undefined
  /** The store's address under it; false hides it. */
  address?: boolean | undefined
  links?: { label: string; url: string }[] | undefined
}

/** A wide picture with a heading, a line and a button under it. */
export type HeroBlock = Base & {
  type: 'hero'
  src: string
  alt: string
  href?: string | undefined
  heading: string
  text: string
  buttonLabel: string
  buttonUrl: string
}

/** Products the merchant chose, as they were when picked (title, price, picture, handle). */
export type ProductItem = {
  id: string
  title: string
  priceLabel: string
  imageUrl?: string | undefined
  handle: string
}
export type ProductsGridBlock = Base & {
  type: 'products'
  title: string
  items: ProductItem[]
  columns: 2 | 3
  showPrice: boolean
  buttonLabel: string
}

/** A discount code the merchant types in (a welcome code, a sale code). */
export type CouponFreeBlock = Base & {
  type: 'coupon'
  label: string
  code: string
  note: string
  value: string
  valueNote: string
}

/** A video's thumbnail with a play line, linking to the video. */
export type VideoBlock = Base & {
  type: 'video'
  src: string
  alt: string
  url: string
  label: string
}

/** The merchant's own HTML, cleaned on save and again on every send (`sanitize-html.ts`). */
export type HtmlBlock = Base & { type: 'html'; html: string }

/** Blocks that fit inside a column. */
export type CellBlock = HeadingBlock | FreeTextBlock | ImageBlock | FreeButtonBlock | SpacerBlock

export const CELL_BLOCK_TYPES = ['heading', 'text', 'image', 'button', 'spacer'] as const

/** One to three columns side by side; phones stack them. */
export type ColumnsLayoutBlock = Base & {
  type: 'columns'
  cells: CellBlock[][]
  /** Stack the columns on phones. */
  stack: boolean
  valign?: 'top' | 'middle' | undefined
  gap?: 'small' | 'medium' | undefined
}

/** The built-in kicker, heading and lead; an empty field keeps the built-in words. */
export type IntroBlock = Base & {
  type: 'intro'
  eyebrow?: string | undefined
  heading?: string | undefined
  lead?: string | undefined
  align?: Align | undefined
}

/** One of the template's own blocks, by its slot key (`items#0`, `ticket#0`). */
export type SlotBlock = Base & { type: 'slot'; slot: string; edit?: SlotEdit | undefined }

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
  | HeroBlock
  | ProductsGridBlock
  | CouponFreeBlock
  | VideoBlock
  | HtmlBlock
  | ColumnsLayoutBlock

export type DesignBlock = FreeBlock | IntroBlock | SlotBlock

export type FreeBlockType = FreeBlock['type']
export type DesignBlockType = DesignBlock['type']

export const FREE_BLOCK_TYPES: readonly FreeBlockType[] = [
  'logo',
  'heading',
  'text',
  'image',
  'button',
  'hero',
  'columns',
  'products',
  'coupon',
  'video',
  'divider',
  'spacer',
  'social',
  'html',
  'help',
  'footer',
]

export type EmailTemplateDesign = {
  version: typeof DESIGN_VERSION
  /** The merchant's subject line, with variables; empty keeps the built-in subject. */
  subject?: string | undefined
  /** The email's own look, over Email branding. */
  styles?: DesignStyles | undefined
  blocks: DesignBlock[]
  /**
   * Built-in blocks the merchant removed (only plain lines and dividers may go). A built-in
   * block missing from `blocks` and not listed here is one the sample never showed: it is put
   * back next to its neighbours, so a real order never loses a part of its email.
   */
  removed: string[]
}
