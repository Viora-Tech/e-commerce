/**
 * SOURCE OF TRUTH: the theme editor's page outline and AI theme edits — WHAT the compact outline
 * of the open page that Customize sends with each assistant message (sections in order, their
 * simple settings and block settings with current values), its size limits, how it is written
 * into the prompt as data, and how a `proposeThemeEdit` call is checked against it / WHY the
 * browser builds the outline, the API validates it and the model reads it, so all three must
 * agree on one shape and one set of bounds. Pure and client-safe.
 */
import { z } from 'zod'
import { guardData } from '../guard-text'

export const THEME_OUTLINE_LIMITS = {
  /** Sections listed (header, page, footer together). */
  maxSections: 60,
  /** Blocks listed per section. */
  maxBlocks: 40,
  /** Settings listed per section or block. */
  maxSettings: 40,
  /** Characters of one value in the outline (longer ones end in "…"). */
  maxValue: 200,
  /** Choices listed for one select setting. */
  maxOptions: 30,
  /**
   * Characters of the whole outline as JSON; settings go first, then sections, to fit. A long
   * imported home page (Waimers' has 20+ sections) lost every lower section's settings at
   * 12,000, so the AI said the newsletter had "no editable settings".
   */
  maxSize: 32_000,
  /** Changes in one proposed theme edit, and the longest new value. */
  maxEdits: 20,
  maxEditValue: 2000,
} as const

/** The setting kinds the outline carries (and the assistant may change). */
export const THEME_SETTING_KINDS = [
  'text',
  'textarea',
  'richtext',
  'url',
  'checkbox',
  'number',
  'select',
  /** A picture: the value is its URL (`findImages` gives the store's own), '' for none. */
  'image',
] as const
export type ThemeSettingKind = (typeof THEME_SETTING_KINDS)[number]

const L = THEME_OUTLINE_LIMITS
const Id = z.string().min(1).max(120)
const Label = z.string().max(120)
const OutlineValue = z.union([z.string().max(L.maxValue), z.number(), z.boolean(), z.null()])

const SettingSchema = z.object({
  /** The prop key (a section setting) or the block's settings key. */
  key: Id,
  label: Label,
  kind: z.enum(THEME_SETTING_KINDS),
  value: OutlineValue,
  /** The value was cut to `maxValue` characters. */
  truncated: z.boolean().optional(),
  options: z
    .array(z.union([z.string().max(L.maxValue), z.number()]))
    .max(L.maxOptions)
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
})

const BlockSchema = z.object({
  id: Id,
  type: z.string().max(120),
  label: Label,
  settings: z.array(SettingSchema).max(L.maxSettings),
})

const SectionSchema = z.object({
  id: Id,
  zone: z.enum(['header', 'main', 'footer']),
  type: z.string().max(120),
  label: Label,
  settings: z.array(SettingSchema).max(L.maxSettings),
  blocks: z.array(BlockSchema).max(L.maxBlocks).default([]),
})

/** The open page as the assistant sees it. Checked on the server; never trusted as instructions. */
export const ThemeOutlineSchema = z
  .object({
    themeName: z.string().max(120),
    templateLabel: z.string().max(120),
    published: z.boolean(),
    selectedSectionId: Id.nullable().default(null),
    /** Settings or sections were left out to fit `maxSize`. */
    partial: z.boolean().default(false),
    sections: z.array(SectionSchema).max(L.maxSections),
  })
  .refine((o) => JSON.stringify(o).length <= L.maxSize, { message: 'Page outline is too large' })

export type ThemeOutline = z.infer<typeof ThemeOutlineSchema>
export type ThemeOutlineSection = ThemeOutline['sections'][number]
export type ThemeOutlineBlock = ThemeOutlineSection['blocks'][number]
export type ThemeOutlineSetting = ThemeOutlineSection['settings'][number]
export type ThemeValue = string | number | boolean

const sizeOf = (outline: ThemeOutline) => JSON.stringify(outline).length

/**
 * The outline cut to `max` characters of JSON: first the settings, section by section from the
 * bottom of the page up (its blocks' settings, then its own; the selected section last), so the
 * top of the page keeps its detail; then whole sections from the bottom (the selected one kept).
 * Marks it `partial` when anything went.
 */
export function fitOutline(outline: ThemeOutline, max: number = L.maxSize): ThemeOutline {
  if (sizeOf(outline) <= max) return outline
  let next: ThemeOutline = { ...outline, partial: true, sections: [...outline.sections] }
  const order = next.sections
    .map((s, i) => ({ id: s.id, i }))
    .sort((a, b) => {
      const sel = (id: string) => (id === outline.selectedSectionId ? 1 : 0)
      return sel(a.id) - sel(b.id) || b.i - a.i
    })
  for (const { i } of order) {
    for (const step of ['blocks', 'settings'] as const) {
      if (sizeOf(next) <= max) return next
      const section = next.sections[i]
      if (!section) continue
      const sections = [...next.sections]
      sections[i] =
        step === 'blocks'
          ? { ...section, blocks: section.blocks.map((b) => ({ ...b, settings: [] })) }
          : { ...section, settings: [] }
      next = { ...next, sections }
    }
  }
  while (sizeOf(next) > max && next.sections.length > 0) {
    const sections = [...next.sections]
    const last = sections.findLastIndex((s) => s.id !== outline.selectedSectionId)
    sections.splice(last === -1 ? sections.length - 1 : last, 1)
    next = { ...next, sections }
  }
  return next
}

/** A text value for the outline: one string of at most `maxValue` characters. */
export function outlineText(raw: string): { value: string; truncated: boolean } {
  if (raw.length <= L.maxValue) return { value: raw, truncated: false }
  return { value: `${raw.slice(0, L.maxValue - 1)}…`, truncated: true }
}

/**
 * The outline for the prompt: compact JSON with every label and value passed through
 * `guardData`, so page text that reads like orders is hidden. `flagged` when any was.
 */
export function themeOutlineForPrompt(outline: ThemeOutline): { text: string; flagged: boolean } {
  let flagged = false
  const guard = (raw: string, max: number) => {
    const g = guardData(raw, max)
    if (g.flagged) flagged = true
    return g.text
  }
  const value = (v: ThemeOutlineSetting['value']) =>
    typeof v === 'string' ? guard(v, L.maxValue) : v
  const settings = (list: ThemeOutlineSetting[]) =>
    list.map((s) => ({
      key: s.key,
      label: guard(s.label, 120),
      kind: s.kind,
      value: value(s.value),
      ...(s.truncated ? { truncated: true } : {}),
      ...(s.options ? { options: s.options.map((o) => value(o)) } : {}),
      ...(s.min !== undefined ? { min: s.min } : {}),
      ...(s.max !== undefined ? { max: s.max } : {}),
    }))
  const data = {
    theme: guard(outline.themeName, 120),
    page: guard(outline.templateLabel, 120),
    published: outline.published,
    selectedSectionId: outline.selectedSectionId,
    partial: outline.partial,
    sections: outline.sections.map((s) => ({
      id: s.id,
      zone: s.zone,
      type: s.type,
      label: guard(s.label, 120),
      settings: settings(s.settings),
      ...(s.blocks.length
        ? {
            blocks: s.blocks.map((b) => ({
              id: b.id,
              type: b.type,
              label: guard(b.label, 120),
              settings: settings(b.settings),
            })),
          }
        : {}),
    })),
  }
  return { text: JSON.stringify(data), flagged }
}

/** What the model sends to `proposeThemeEdit`. */
export const ThemeEditInput = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('One short line saying what the change does, e.g. "New announcement bar text".'),
  edits: z
    .array(
      z.object({
        sectionId: Id.describe('The section id, exactly as in the page outline.'),
        blockId: Id.optional().describe('The block id, only when the setting belongs to a block.'),
        setting: Id.describe('The setting key, exactly as in the page outline.'),
        value: z
          .union([z.string().max(L.maxEditValue), z.number(), z.boolean()])
          .describe(
            'The new value: text for text, textarea, richtext (plain text), url and select settings; true or false for checkbox; a number for number; an image URL from findImages for image.',
          ),
      }),
    )
    .min(1)
    .max(L.maxEdits),
})
export type ThemeEditRequest = z.infer<typeof ThemeEditInput>

/** One checked change, with what the card shows: where it goes and the value before. */
export type ThemeEditChange = {
  sectionId: string
  blockId: string | null
  setting: string
  kind: ThemeSettingKind
  value: ThemeValue
  before: ThemeOutlineSetting['value']
  sectionLabel: string
  blockLabel: string | null
  settingLabel: string
}

/** A proposed theme edit as the browser gets it; nothing is written until the merchant applies it. */
export type ThemeEditView = {
  id: string
  summary: string
  changes: ThemeEditChange[]
  /** Text the assistant read looked like instructions to the AI: the card warns. */
  flagged: boolean
}

const SAFE_URL = /^(\/|#|https?:\/\/|mailto:|tel:|shopify:\/\/)/i
const IMAGE_URL = /^(\/|https:\/\/)\S+$/i

/** Why `value` cannot go into a setting of this kind, or the value to store. */
function checkValue(
  setting: ThemeOutlineSetting,
  value: ThemeValue,
): { ok: true; value: ThemeValue } | { ok: false; error: string } {
  const mismatch = (want: string) => ({
    ok: false as const,
    error: `Setting "${setting.key}" takes ${want}.`,
  })
  switch (setting.kind) {
    case 'text':
    case 'textarea':
    case 'richtext':
      return typeof value === 'string' ? { ok: true, value } : mismatch('text')
    case 'url':
      if (typeof value !== 'string') return mismatch('a link')
      return value === '' || (SAFE_URL.test(value) && !/\s/.test(value))
        ? { ok: true, value }
        : mismatch('a link starting with /, https:// or mailto:')
    case 'image':
      if (typeof value !== 'string') return mismatch('an image URL')
      return value === '' || IMAGE_URL.test(value)
        ? { ok: true, value }
        : mismatch('an image URL from findImages (https://… or /…)')
    case 'checkbox':
      return typeof value === 'boolean' ? { ok: true, value } : mismatch('true or false')
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return mismatch('a number')
      if (setting.min !== undefined && value < setting.min)
        return mismatch(`at least ${setting.min}`)
      if (setting.max !== undefined && value > setting.max)
        return mismatch(`at most ${setting.max}`)
      return { ok: true, value }
    }
    case 'select': {
      if (typeof value === 'boolean') return mismatch('one of its options')
      const match = (setting.options ?? []).find((o) => String(o) === String(value))
      return match === undefined ? mismatch('one of its options') : { ok: true, value: match }
    }
  }
}

/**
 * A `proposeThemeEdit` call checked against the outline sent with the same message: every
 * section, block and setting must be in it, and each value must fit its setting's kind.
 * The error is written for the model, so it can correct itself.
 */
export function validateThemeEdits(
  outline: ThemeOutline,
  request: ThemeEditRequest,
): { ok: true; changes: ThemeEditChange[] } | { ok: false; error: string } {
  const changes: ThemeEditChange[] = []
  const seen = new Set<string>()
  for (const edit of request.edits) {
    const section = outline.sections.find((s) => s.id === edit.sectionId)
    if (!section) return { ok: false, error: `No section "${edit.sectionId}" on this page.` }
    const block = edit.blockId ? section.blocks.find((b) => b.id === edit.blockId) : null
    if (edit.blockId && !block) {
      return { ok: false, error: `Section "${section.id}" has no block "${edit.blockId}".` }
    }
    const setting = (block ?? section).settings.find((s) => s.key === edit.setting)
    if (!setting) {
      const owner = block ? `Block "${block.id}"` : `Section "${section.id}"`
      return { ok: false, error: `${owner} has no setting "${edit.setting}".` }
    }
    const target = `${section.id}/${block?.id ?? ''}/${setting.key}`
    if (seen.has(target)) return { ok: false, error: `Setting "${setting.key}" is changed twice.` }
    seen.add(target)
    const checked = checkValue(setting, edit.value)
    if (!checked.ok) return checked
    changes.push({
      sectionId: section.id,
      blockId: block?.id ?? null,
      setting: setting.key,
      kind: setting.kind,
      value: checked.value,
      before: setting.value,
      sectionLabel: section.label,
      blockLabel: block?.label ?? null,
      settingLabel: setting.label,
    })
  }
  return { ok: true, changes }
}
