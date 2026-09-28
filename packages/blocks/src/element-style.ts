import type { CSSProperties } from 'react'

/**
 * The style panel every custom-section element and container carries
 * (`style` prop): spacing, size, typography, colour, corners, shadow and
 * visibility per breakpoint. Values are plain and small so a stored element
 * renders without the editor; `elementStyle()` turns them into inline styles
 * plus a few static classes, all server-rendered (no JS, no layout shift).
 *
 * Colours are theme tokens first (`brand`, `ink`, …, drawn from the storefront
 * theme's custom properties so colour schemes and dark mode apply) or a custom
 * CSS colour, which must parse as one (see `safeColour`).
 */

export type ColourToken =
  | 'inherit'
  | 'ink'
  | 'muted'
  | 'brand'
  | 'accent'
  | 'bg'
  | 'surface'
  | 'line'
export type ColourChoice = { token: ColourToken | 'custom'; custom: string }

export type ElementStyle = {
  spacing: { marginTop: number; marginBottom: number; paddingX: number; paddingY: number }
  size: { width: 'auto' | 'full' | 'fit'; maxWidth: number; minHeight: number }
  typography: {
    size: 'inherit' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
    weight: 'inherit' | '400' | '500' | '600' | '700'
    align: 'inherit' | 'left' | 'center' | 'right'
  }
  colour: { text: ColourChoice; background: ColourChoice }
  corners: { radius: 'none' | 'sm' | 'md' | 'lg' | 'pill'; shadow: 'none' | 'sm' | 'md' | 'lg' }
  visibility: { mobile: boolean; tablet: boolean; desktop: boolean }
}

export const defaultElementStyle = (): ElementStyle => ({
  spacing: { marginTop: 0, marginBottom: 0, paddingX: 0, paddingY: 0 },
  size: { width: 'auto', maxWidth: 0, minHeight: 0 },
  typography: { size: 'inherit', weight: 'inherit', align: 'inherit' },
  colour: {
    text: { token: 'inherit', custom: '' },
    background: { token: 'inherit', custom: '' },
  },
  corners: { radius: 'none', shadow: 'none' },
  visibility: { mobile: true, tablet: true, desktop: true },
})

const TOKEN_VAR: Record<Exclude<ColourToken, 'inherit'>, string> = {
  ink: 'var(--color-ink)',
  muted: 'var(--color-muted)',
  brand: 'var(--color-brand)',
  accent: 'var(--color-accent)',
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  line: 'var(--color-line)',
}

const COLOUR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9.,%\s/+-]+\))$/i

/** A custom colour only when it is plainly a CSS colour; anything else (a `url()`, a `;`) is dropped. */
export function safeColour(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length <= 64 && COLOUR.test(v) ? v : null
}

/** An own-key table lookup, so a stored `'constructor'` or `'__proto__'` finds nothing. */
function lookup<T extends string | null>(table: Record<string, T>, key: unknown): T | null {
  return typeof key === 'string' && Object.hasOwn(table, key) ? (table[key] ?? null) : null
}

const TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify'])

/** The CSS value a colour choice stands for, or null to inherit. */
export function colourValue(choice: Partial<ColourChoice> | undefined): string | null {
  if (!choice?.token || choice.token === 'inherit') return null
  if (choice.token === 'custom') return safeColour(choice.custom)
  return lookup(TOKEN_VAR, choice.token)
}

const FONT_SIZE: Record<Exclude<ElementStyle['typography']['size'], 'inherit'>, string> = {
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': 'clamp(1.375rem, 1.2rem + 0.8vw, 1.5rem)',
  '3xl': 'clamp(1.625rem, 1.3rem + 1.4vw, 1.875rem)',
  '4xl': 'clamp(1.875rem, 1.4rem + 2.2vw, 2.5rem)',
}
const RADIUS: Record<ElementStyle['corners']['radius'], string | null> = {
  none: null,
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
  pill: '999px',
}
const SHADOW: Record<ElementStyle['corners']['shadow'], string | null> = {
  none: null,
  sm: '0 1px 2px rgb(0 0 0 / 0.08)',
  md: '0 4px 12px rgb(0 0 0 / 0.1)',
  lg: '0 12px 32px rgb(0 0 0 / 0.14)',
}

/** Pixels (as the panel shows them) to rem, clamped to a sane range. */
export const rem = (px: unknown, max = 400): string | null => {
  const n = typeof px === 'number' && Number.isFinite(px) ? Math.min(Math.max(px, 0), max) : 0
  return n > 0 ? `${n / 16}rem` : null
}

/**
 * Classes that hide an element per breakpoint (mobile < 48rem, tablet 48 to 64rem,
 * desktop from 64rem). CSS only, so hidden elements cost no layout shift.
 */
export function visibilityClassName(visibility: Partial<ElementStyle['visibility']> | undefined) {
  const v = { mobile: true, tablet: true, desktop: true, ...visibility }
  return [
    v.mobile ? null : 'max-md:hidden',
    v.tablet ? null : 'md:max-lg:hidden',
    v.desktop ? null : 'lg:hidden',
  ]
    .filter(Boolean)
    .join(' ')
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** An element's stored style as inline CSS plus its visibility classes. */
export function elementStyle(style: DeepPartial<ElementStyle> | undefined): {
  className: string
  style: CSSProperties
} {
  const s = style ?? {}
  const css: CSSProperties = {}
  const set = (key: keyof CSSProperties, value: string | null) => {
    if (value) (css as Record<string, string>)[key] = value
  }
  set('marginTop', rem(s.spacing?.marginTop))
  set('marginBottom', rem(s.spacing?.marginBottom))
  const px = rem(s.spacing?.paddingX)
  const py = rem(s.spacing?.paddingY)
  if (px) {
    css.paddingLeft = px
    css.paddingRight = px
  }
  if (py) {
    css.paddingTop = py
    css.paddingBottom = py
  }
  if (s.size?.width === 'full') css.width = '100%'
  if (s.size?.width === 'fit') css.width = 'fit-content'
  set('maxWidth', rem(s.size?.maxWidth, 2400))
  set('minHeight', rem(s.size?.minHeight, 2400))
  const size = s.typography?.size
  if (size && size !== 'inherit') set('fontSize', lookup(FONT_SIZE, size))
  const weight = Number(s.typography?.weight)
  if (Number.isFinite(weight) && weight >= 100 && weight <= 900) css.fontWeight = weight
  const align = s.typography?.align
  if (typeof align === 'string' && TEXT_ALIGN.has(align)) css.textAlign = align
  set('color', colourValue(s.colour?.text as Partial<ColourChoice> | undefined))
  set('backgroundColor', colourValue(s.colour?.background as Partial<ColourChoice> | undefined))
  set('borderRadius', lookup(RADIUS, s.corners?.radius))
  set('boxShadow', lookup(SHADOW, s.corners?.shadow))
  if (css.borderRadius && css.backgroundColor) css.overflow = 'hidden'
  return { className: visibilityClassName(s.visibility), style: css }
}

const COLOUR_OPTIONS = [
  { label: 'Same as around it', value: 'inherit' },
  { label: 'Text', value: 'ink' },
  { label: 'Muted text', value: 'muted' },
  { label: 'Brand', value: 'brand' },
  { label: 'Accent', value: 'accent' },
  { label: 'Background', value: 'bg' },
  { label: 'Surface', value: 'surface' },
  { label: 'Line', value: 'line' },
  { label: 'Custom colour', value: 'custom' },
]

const colourField = (label: string) => ({
  type: 'object',
  label,
  objectFields: {
    token: { type: 'select', label, options: COLOUR_OPTIONS },
    custom: { type: 'text', label: 'Custom colour' },
  },
})

const yesNo = (label: string) => ({
  type: 'radio',
  label,
  options: [
    { label: 'Show', value: true },
    { label: 'Hide', value: false },
  ],
})

const px = (label: string, max = 160) => ({ type: 'number', label, min: 0, max })

/**
 * The Puck field for `style`: six groups the admin draws as the collapsible
 * style panel (`section-settings-groups.tsx`, which summarises each group).
 */
export const elementStyleField = {
  type: 'object',
  label: 'Style',
  objectFields: {
    spacing: {
      type: 'object',
      label: 'Spacing',
      objectFields: {
        marginTop: px('Space above'),
        marginBottom: px('Space below'),
        paddingX: px('Inner space, sides'),
        paddingY: px('Inner space, top and bottom'),
      },
    },
    size: {
      type: 'object',
      label: 'Size',
      objectFields: {
        width: {
          type: 'select',
          label: 'Width',
          options: [
            { label: 'Automatic', value: 'auto' },
            { label: 'Full width', value: 'full' },
            { label: 'Fit the content', value: 'fit' },
          ],
        },
        maxWidth: px('Largest width (0 for none)', 1600),
        minHeight: px('Smallest height', 1200),
      },
    },
    typography: {
      type: 'object',
      label: 'Text',
      objectFields: {
        size: {
          type: 'select',
          label: 'Text size',
          options: [
            { label: 'Same as around it', value: 'inherit' },
            { label: 'Small', value: 'sm' },
            { label: 'Normal', value: 'base' },
            { label: 'Large', value: 'lg' },
            { label: 'Extra large', value: 'xl' },
            { label: 'Heading small', value: '2xl' },
            { label: 'Heading', value: '3xl' },
            { label: 'Heading large', value: '4xl' },
          ],
        },
        weight: {
          type: 'select',
          label: 'Weight',
          options: [
            { label: 'Same as around it', value: 'inherit' },
            { label: 'Regular', value: '400' },
            { label: 'Medium', value: '500' },
            { label: 'Semibold', value: '600' },
            { label: 'Bold', value: '700' },
          ],
        },
        align: {
          type: 'select',
          label: 'Align',
          options: [
            { label: 'Same as around it', value: 'inherit' },
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
        },
      },
    },
    colour: {
      type: 'object',
      label: 'Colour',
      objectFields: {
        text: colourField('Text colour'),
        background: colourField('Background colour'),
      },
    },
    corners: {
      type: 'object',
      label: 'Corners and shadow',
      objectFields: {
        radius: {
          type: 'select',
          label: 'Corner radius',
          options: [
            { label: 'Square', value: 'none' },
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
            { label: 'Round', value: 'pill' },
          ],
        },
        shadow: {
          type: 'select',
          label: 'Shadow',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Soft', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Strong', value: 'lg' },
          ],
        },
      },
    },
    visibility: {
      type: 'object',
      label: 'Visibility',
      objectFields: {
        mobile: yesNo('On phones'),
        tablet: yesNo('On tablets'),
        desktop: yesNo('On computers'),
      },
    },
  },
} as const
