import {
  type Align,
  type BlockBox,
  type ButtonShape,
  type ButtonStyle,
  type DesignStyles,
  EMAIL_FONTS,
  type EmailFont,
  HEX,
  SLOT_EDITS,
  type SlotEdit,
  SPACES,
  type Space,
  STYLE_LIMITS,
  slotEditable,
} from './style-types'

/** Reading the look of a design (`styles`, `box`, slot `edit`): anything unknown is dropped. */

export type Raw = Record<string, unknown>

export const isObj = (v: unknown): v is Raw =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Control characters other than tab and newline never belong in an email's words. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

export function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  return v.replace(CONTROL, '').slice(0, max)
}

export const hex = (v: unknown): string | undefined =>
  typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : undefined

const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined

const ALIGNS: readonly Align[] = ['left', 'center', 'right']
const SHAPES: readonly ButtonShape[] = ['square', 'rounded', 'pill']

export const align = (v: unknown) => oneOf(v, ALIGNS)

function num(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  return Math.min(max, Math.max(min, Math.round(v)))
}

/** Drops undefined fields; undefined when nothing is left. */
function compact<T extends object>(o: T): T | undefined {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
  return Object.keys(out).length > 0 ? out : undefined
}

export function parseBox(v: unknown): BlockBox | undefined {
  if (!isObj(v)) return undefined
  return compact<BlockBox>({
    background: hex(v.background),
    top: oneOf<Space>(v.top, SPACES),
    bottom: oneOf<Space>(v.bottom, SPACES),
    align: align(v.align),
  })
}

export function parseButtonStyle(v: unknown): ButtonStyle | undefined {
  if (!isObj(v)) return undefined
  return compact<ButtonStyle>({
    background: hex(v.background),
    text: hex(v.text),
    shape: oneOf(v.shape, SHAPES),
    full: typeof v.full === 'boolean' ? v.full : undefined,
  })
}

export function parseStyles(v: unknown): DesignStyles | undefined {
  if (!isObj(v)) return undefined
  return compact<DesignStyles>({
    font: oneOf<EmailFont>(v.font, Object.keys(EMAIL_FONTS) as EmailFont[]),
    size: num(v.size, STYLE_LIMITS.sizeMin, STYLE_LIMITS.sizeMax),
    text: hex(v.text),
    heading: hex(v.heading),
    link: hex(v.link),
    accent: hex(v.accent),
    background: hex(v.background),
    card: hex(v.card),
    width: num(v.width, STYLE_LIMITS.widthMin, STYLE_LIMITS.widthMax),
    button: parseButtonStyle(v.button),
  })
}

/** A slot's edits, keeping only what its kind allows (`SLOT_EDITS`). */
export function parseSlotEdit(kind: string, v: unknown, max: number): SlotEdit | undefined {
  if (!isObj(v) || !slotEditable(kind)) return undefined
  const rules = SLOT_EDITS[kind]
  const rawTexts = isObj(v.texts) ? v.texts : {}
  const texts = compact<Record<string, string | undefined>>(
    Object.fromEntries(
      (rules.texts as readonly string[]).map((k) => [
        k,
        str(rawTexts[k], max)?.trim() || undefined,
      ]),
    ),
  )
  const hide = Array.isArray(v.hide)
    ? [...new Set(v.hide.filter((h): h is string => (rules.hide as readonly string[]).includes(h)))]
    : []
  const c = isObj(v.colours) ? v.colours : {}
  const allowed = rules.colours as readonly string[]
  const colours = compact({
    ink: allowed.includes('ink') ? hex(c.ink) : undefined,
    bg: allowed.includes('bg') ? hex(c.bg) : undefined,
    line: allowed.includes('line') ? hex(c.line) : undefined,
  })
  return compact<SlotEdit>({
    texts: texts as Record<string, string> | undefined,
    hide: hide.length > 0 ? hide : undefined,
    colours,
    button: rules.button ? parseButtonStyle(v.button) : undefined,
  })
}
