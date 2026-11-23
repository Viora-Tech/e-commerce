/**
 * The look of a saved email design (version 2): the email's own styles (font, size, colours,
 * width, buttons), a block's box (background, space above and below, alignment) and the edits a
 * merchant makes to one of the order's built-in blocks. Pure, so the admin's editor uses it too.
 * Every field is optional: left out, the built-in look (or Email branding) stays.
 */

/** `#rrggbb`. */
export type Hex = string

export type Align = 'left' | 'center' | 'right'

/** Space steps above or below a block. */
export type Space = 'none' | 'small' | 'medium' | 'large'

export const SPACES: readonly Space[] = ['none', 'small', 'medium', 'large']

/** Space steps in px, as the email's inline styles write them. */
export const SPACE_PX: Record<Space, number> = { none: 0, small: 12, medium: 24, large: 44 }

/** A block's wrapper: its own background band, its spacing and where its content sits. */
export type BlockBox = {
  background?: Hex | undefined
  top?: Space | undefined
  bottom?: Space | undefined
  align?: Align | undefined
}

export type ButtonShape = 'square' | 'rounded' | 'pill'

export const BUTTON_RADIUS: Record<ButtonShape, string> = {
  square: '0',
  rounded: '4px',
  pill: '999px',
}

export type ButtonStyle = {
  background?: Hex | undefined
  text?: Hex | undefined
  shape?: ButtonShape | undefined
  /** As wide as the card's content. */
  full?: boolean | undefined
}

/**
 * Fonts every inbox has (Gmail and Outlook ignore web fonts), each with fallbacks. `times` is
 * the built-in look.
 */
export const EMAIL_FONTS = {
  times: "'Times New Roman', Times, Tinos, Georgia, serif",
  georgia: 'Georgia, Times, serif',
  arial: 'Arial, Helvetica, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Verdana, sans-serif',
  trebuchet: "'Trebuchet MS', Helvetica, sans-serif",
  system: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  courier: "'Courier New', Courier, monospace",
} as const

export type EmailFont = keyof typeof EMAIL_FONTS

export const EMAIL_FONT_KEYS = Object.keys(EMAIL_FONTS) as EmailFont[]

/** Bounds of the email's own styles. */
export const STYLE_LIMITS = {
  sizeMin: 13,
  sizeMax: 18,
  /** The built-in body size the others scale from. */
  sizeBase: 15,
  widthMin: 480,
  widthMax: 720,
  widthBase: 620,
} as const

/** The whole email's look, over Email branding. */
export type DesignStyles = {
  font?: EmailFont | undefined
  /** Body text size in px; every size in the email scales with it. */
  size?: number | undefined
  text?: Hex | undefined
  heading?: Hex | undefined
  link?: Hex | undefined
  /** Highlights: the kicker, codes, the route line. */
  accent?: Hex | undefined
  /** Around the card. */
  background?: Hex | undefined
  /** The card itself. */
  card?: Hex | undefined
  /** The card's width in px. */
  width?: number | undefined
  button?: ButtonStyle | undefined
}

/**
 * What a merchant may change on one of the order's built-in blocks, by its kind. `texts` are
 * words that replace the built-in ones (variables allowed, empty keeps the built-in words);
 * `hide` are parts that can be switched off; `colours` says which colours apply; `button` that
 * the button's style can be set. The data itself (lines, totals, codes) always comes from the
 * order.
 */
export const SLOT_EDITS = {
  items: {
    texts: ['title', 'totalHeading'],
    hide: ['image', 'variant', 'quantity', 'note', 'price', 'totals', 'gst'],
    colours: ['ink', 'line'],
    button: false,
  },
  status: { texts: ['title', 'body'], hide: [], colours: ['ink', 'bg'], button: false },
  notice: { texts: ['title', 'body'], hide: [], colours: ['ink', 'bg'], button: false },
  button: { texts: ['label'], hide: ['secondary'], colours: [], button: true },
  coupon: { texts: ['label', 'note'], hide: [], colours: ['ink'], button: false },
  code: { texts: [], hide: [], colours: ['ink'], button: false },
  ticket: { texts: [], hide: [], colours: ['ink'], button: false },
  divider: { texts: ['label'], hide: [], colours: [], button: false },
  text: { texts: ['text'], hide: [], colours: [], button: false },
  quote: { texts: ['label'], hide: [], colours: ['ink'], button: false },
} as const satisfies Record<
  string,
  { texts: readonly string[]; hide: readonly string[]; colours: readonly string[]; button: boolean }
>

export type SlotEditKind = keyof typeof SLOT_EDITS

export const slotEditable = (kind: string): kind is SlotEditKind => kind in SLOT_EDITS

/** A merchant's changes to one built-in block (only keys its kind allows are kept). */
export type SlotEdit = {
  texts?: Record<string, string> | undefined
  hide?: string[] | undefined
  colours?: { ink?: Hex | undefined; bg?: Hex | undefined; line?: Hex | undefined } | undefined
  button?: ButtonStyle | undefined
}

export const HEX = /^#[0-9a-f]{6}$/i
