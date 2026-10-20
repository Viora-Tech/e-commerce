import type { Fields } from '@puckeditor/core'
import type { CSSProperties } from 'react'
import { safeColour } from './element-style'
import { cleanExperiment, EXPERIMENT_GROUP, type SectionExperiment } from './section-experiment'

/** Longest custom CSS one section keeps. */
const CUSTOM_CSS_MAX = 5000

/** Applies to this section only; rules are written as if inside it, e.g. `h2 { … }`. */
const CUSTOM_CSS_FIELD = { type: 'textarea', label: 'Custom CSS' }

/**
 * The merchant's CSS made safe to put in a `<style>`: nothing that could close the tag or open
 * HTML, and no `@import` (a remote stylesheet the store's CSP would not allow anyway).
 */
export function cleanCustomCss(css: string): string {
  return css
    .slice(0, CUSTOM_CSS_MAX)
    .replace(/<\/?\s*style/gi, '')
    .replace(/</g, '')
    .replace(/@import[^;]*;?/gi, '')
    .trim()
}

/** A stable class for one section's custom CSS (same CSS, same class); undefined when there is none. */
export function customCssClass(css: string): string | undefined {
  const clean = cleanCustomCss(css)
  if (!clean) return undefined
  let h = 2166136261
  for (let i = 0; i < clean.length; i++) h = Math.imul(h ^ clean.charCodeAt(i), 16777619)
  return `section-css-${(h >>> 0).toString(36)}`
}

/** `.section-css-x { <css> }`: the section's rules nested under its class; null when empty. */
export function scopedCustomCss(css: string): string | null {
  const cls = customCssClass(css)
  return cls ? `.${cls}{${cleanCustomCss(css)}}` : null
}

/** Layout / spacing / style / advanced settings every section can carry. */
export type ContentWidth = 'narrow' | 'normal' | 'wide' | 'full'
export type Alignment = 'left' | 'center' | 'right'
export type CornerRadius = 'none' | 'sm' | 'md' | 'lg'
export type Shadow = 'none' | 'sm' | 'md'
export type EntranceAnimation = 'none' | 'fade' | 'slide-up' | 'zoom'

export type ResponsivePadding = { mobile: number; tablet: number; desktop: number }

export type SectionSettingsValue = {
  layout: { contentWidth: ContentWidth; alignment: Alignment; gap: number }
  spacing: { paddingTop: ResponsivePadding; paddingBottom: ResponsivePadding }
  style: {
    colorScheme: string
    backgroundColor: string
    backgroundImage: { url: string; alt: string }
    overlayOpacity: number
    cornerRadius: CornerRadius
    border: boolean
    shadow: Shadow
  }
  advanced: {
    showOnMobile: boolean
    showOnDesktop: boolean
    entranceAnimation: EntranceAnimation
    anchorId: string
    /** The merchant's own CSS for this section, scoped to it (`.section-css-<hash> { … }`). */
    customCss: string
  }
  /**
   * Show only in one variant of a GrowthBook experiment (the GrowthBook app): the experiment's
   * tracking key and the variant (`0` or `control`, `1`, or the variation's name). Absent or a
   * blank key shows the section to everyone. The storefront applies it before rendering.
   */
  experiment?: SectionExperiment
}

/** Legacy per-section shape (`packages/blocks/src/sections/library.tsx`'s old `Frame`). */
export type LegacySectionProps = {
  scheme?: unknown
  padTop?: unknown
  padBottom?: unknown
  settings?: unknown
}

const responsivePadding = (value: number): ResponsivePadding => ({
  mobile: value,
  tablet: value,
  desktop: value,
})

/**
 * Defaults that reproduce today's rendering: a section with no settings looks
 * exactly like the old `{ scheme, padTop, padBottom }` frame did. Pass the
 * section's own legacy defaults (or stored legacy values) to seed padding and
 * colour scheme; everything else — width, alignment, background, animation —
 * starts at its neutral "off" value.
 */
export function defaultSectionSettings(
  legacy: {
    scheme?: string | undefined
    padTop?: number | undefined
    padBottom?: number | undefined
  } = {},
): SectionSettingsValue {
  const scheme = legacy.scheme ?? 'scheme-1'
  const padTop = legacy.padTop ?? 48
  const padBottom = legacy.padBottom ?? 48
  return {
    layout: { contentWidth: 'normal', alignment: 'center', gap: 0 },
    spacing: {
      paddingTop: responsivePadding(padTop),
      paddingBottom: responsivePadding(padBottom),
    },
    style: {
      colorScheme: scheme,
      backgroundColor: '',
      backgroundImage: { url: '', alt: '' },
      overlayOpacity: 0,
      cornerRadius: 'none',
      border: false,
      shadow: 'none',
    },
    advanced: {
      showOnMobile: true,
      showOnDesktop: true,
      entranceAnimation: 'none',
      anchorId: '',
      customCss: '',
    },
  }
}

/** Structural check — good enough to tell "a settings object" from `undefined`/junk. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Same shape as a theme scheme id (`packages/core/src/theme/schema.ts`); it becomes a class name. */
const SCHEME_ID = /^[a-z0-9-]{1,40}$/
/** Becomes the section's `id`, so only a plain slug. */
const ANCHOR_ID = /^[a-z][a-z0-9-]{0,40}$/i

const schemeOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' && SCHEME_ID.test(value) ? value : fallback

const anchorOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' && ANCHOR_ID.test(value) ? value : fallback

function isResponsivePadding(value: unknown): value is Partial<ResponsivePadding> {
  return isPlainObject(value)
}

/** Deep-merges a possibly-partial/stale stored `settings` object onto fresh defaults. */
function mergeSettings(
  base: SectionSettingsValue,
  stored: Partial<SectionSettingsValue> | Record<string, unknown>,
): SectionSettingsValue {
  const s = stored as Partial<SectionSettingsValue>
  const experiment = cleanExperiment(s.experiment)
  const mergePadding = (
    fallback: ResponsivePadding,
    partial: Partial<ResponsivePadding> | undefined,
  ): ResponsivePadding => ({
    mobile: typeof partial?.mobile === 'number' ? partial.mobile : fallback.mobile,
    tablet: typeof partial?.tablet === 'number' ? partial.tablet : fallback.tablet,
    desktop: typeof partial?.desktop === 'number' ? partial.desktop : fallback.desktop,
  })
  return {
    layout: {
      contentWidth: s.layout?.contentWidth ?? base.layout.contentWidth,
      alignment: s.layout?.alignment ?? base.layout.alignment,
      gap: typeof s.layout?.gap === 'number' ? s.layout.gap : base.layout.gap,
    },
    spacing: {
      paddingTop: mergePadding(
        base.spacing.paddingTop,
        isResponsivePadding(s.spacing?.paddingTop) ? s.spacing?.paddingTop : undefined,
      ),
      paddingBottom: mergePadding(
        base.spacing.paddingBottom,
        isResponsivePadding(s.spacing?.paddingBottom) ? s.spacing?.paddingBottom : undefined,
      ),
    },
    style: {
      colorScheme: schemeOr(s.style?.colorScheme, base.style.colorScheme),
      backgroundColor:
        s.style?.backgroundColor === undefined
          ? base.style.backgroundColor
          : (safeColour(s.style.backgroundColor) ?? ''),
      backgroundImage: {
        url: s.style?.backgroundImage?.url ?? base.style.backgroundImage.url,
        alt: s.style?.backgroundImage?.alt ?? base.style.backgroundImage.alt,
      },
      overlayOpacity:
        typeof s.style?.overlayOpacity === 'number'
          ? s.style.overlayOpacity
          : base.style.overlayOpacity,
      cornerRadius: s.style?.cornerRadius ?? base.style.cornerRadius,
      border: typeof s.style?.border === 'boolean' ? s.style.border : base.style.border,
      shadow: s.style?.shadow ?? base.style.shadow,
    },
    advanced: {
      showOnMobile:
        typeof s.advanced?.showOnMobile === 'boolean'
          ? s.advanced.showOnMobile
          : base.advanced.showOnMobile,
      showOnDesktop:
        typeof s.advanced?.showOnDesktop === 'boolean'
          ? s.advanced.showOnDesktop
          : base.advanced.showOnDesktop,
      entranceAnimation: s.advanced?.entranceAnimation ?? base.advanced.entranceAnimation,
      anchorId: anchorOr(s.advanced?.anchorId, ''),
      customCss:
        typeof s.advanced?.customCss === 'string'
          ? s.advanced.customCss.slice(0, CUSTOM_CSS_MAX)
          : '',
    },
    ...(experiment ? { experiment } : {}),
  }
}

/**
 * Pure migration: turns whatever a section's stored props look like — the old
 * flat `{ scheme, padTop, padBottom }`, an already-migrated `settings` object
 * (possibly missing fields a later release added), or nothing at all — into a
 * complete `SectionSettingsValue`. Never throws; unknown/malformed input just
 * falls back to defaults. Idempotent: migrating an already-migrated value is a
 * no-op merge.
 *
 * Used by `apps/admin/src/lib/customize-doc.ts`'s `normalizeDoc` (so the Field
 * panel edits real values, not blanks) and inside every section's own
 * `render()` (`packages/blocks/src/sections/library.tsx`, `puck-config.tsx`),
 * so the storefront — which calls `render()` directly, not through
 * `normalizeDoc` — renders old docs correctly too.
 */
export function migrateSectionSettings(
  props: LegacySectionProps,
  /**
   * The section's own default settings, for a section saved before it had any (its look
   * then, e.g. a hero's 40px frame padding). Without it the generic defaults apply.
   */
  fallback?: SectionSettingsValue,
): SectionSettingsValue {
  const legacyScheme = schemeOr(props.scheme, '') || undefined
  const legacyPadTop = typeof props.padTop === 'number' ? props.padTop : undefined
  const legacyPadBottom = typeof props.padBottom === 'number' ? props.padBottom : undefined
  const base = fallback
    ? mergeSettings(fallback, {
        ...(legacyScheme ? { style: { ...fallback.style, colorScheme: legacyScheme } } : {}),
        spacing: {
          paddingTop: responsivePadding(legacyPadTop ?? fallback.spacing.paddingTop.desktop),
          paddingBottom: responsivePadding(
            legacyPadBottom ?? fallback.spacing.paddingBottom.desktop,
          ),
        },
      })
    : defaultSectionSettings({
        scheme: legacyScheme,
        padTop: legacyPadTop,
        padBottom: legacyPadBottom,
      })
  if (isPlainObject(props.settings)) return mergeSettings(base, props.settings)
  return base
}

const YES_NO = (label: string) =>
  ({
    type: 'radio',
    label,
    options: [
      { label: 'Show', value: true },
      { label: 'Hide', value: false },
    ],
  }) as const

/**
 * Which settings a section offers. `section` is the full set for sections drawn inside the
 * shared frame. `bleed` is for full-bleed sections that draw their own frame (the hero, the
 * announcement bar): spacing plus show on mobile/desktop and the anchor, since width,
 * alignment, background and entrance motion are theirs to decide. `flow` is for the sections
 * the storefront draws for the page (main sections, related and recently viewed products):
 * `bleed` plus the colour scheme, applied on a frame around what the storefront drew.
 */
export type SettingsKind = 'section' | 'bleed' | 'flow'

/**
 * The grouped Puck fields for `migrateSectionSettings`'s shape. Each top
 * group (`layout`/`spacing`/`style`/`advanced`) is a nested `object` field,
 * which `apps/admin/src/components/themes/customize/customize-object-field.tsx`
 * renders as its own collapsible section — so the Field panel shows four
 * short groups instead of one long flat list.
 */
export function sectionSettingsField(
  schemeOptions: { label: string; value: string }[],
  kind: SettingsKind = 'section',
): Fields[string] {
  const paddingFields = {
    mobile: { type: 'number', label: 'Mobile', min: 0, max: 160 },
    tablet: { type: 'number', label: 'Tablet', min: 0, max: 160 },
    desktop: { type: 'number', label: 'Desktop', min: 0, max: 160 },
  } as const

  const spacing = {
    type: 'object',
    label: 'Spacing',
    objectFields: {
      paddingTop: { type: 'object', label: 'Padding top', objectFields: paddingFields },
      paddingBottom: { type: 'object', label: 'Padding bottom', objectFields: paddingFields },
    },
  } as const
  if (kind === 'bleed' || kind === 'flow') {
    return {
      type: 'object',
      label: 'Section settings',
      objectFields: {
        spacing,
        ...(kind === 'flow'
          ? {
              style: {
                type: 'object',
                label: 'Style',
                objectFields: {
                  colorScheme: { type: 'select', label: 'Colour scheme', options: schemeOptions },
                },
              },
            }
          : {}),
        advanced: {
          type: 'object',
          label: 'Advanced',
          objectFields: {
            showOnMobile: YES_NO('Show on mobile'),
            showOnDesktop: YES_NO('Show on desktop'),
            anchorId: { type: 'text', label: 'Anchor ID' },
            customCss: CUSTOM_CSS_FIELD,
          },
        },
        experiment: EXPERIMENT_GROUP,
      },
    } as unknown as Fields[string]
  }

  return {
    type: 'object',
    label: 'Section settings',
    objectFields: {
      layout: {
        type: 'object',
        label: 'Layout',
        objectFields: {
          contentWidth: {
            type: 'select',
            label: 'Content width',
            options: [
              { label: 'Narrow', value: 'narrow' },
              { label: 'Normal', value: 'normal' },
              { label: 'Wide', value: 'wide' },
              { label: 'Full', value: 'full' },
            ],
          },
          alignment: {
            type: 'select',
            label: 'Alignment',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ],
          },
          gap: { type: 'number', label: 'Gap', min: 0, max: 16 },
        },
      },
      spacing,
      style: {
        type: 'object',
        label: 'Style',
        objectFields: {
          colorScheme: { type: 'select', label: 'Colour scheme', options: schemeOptions },
          backgroundColor: { type: 'text', label: 'Background colour' },
          backgroundImage: {
            type: 'object',
            label: 'Background image',
            objectFields: {
              url: { type: 'text', label: 'Image URL' },
              alt: { type: 'text', label: 'Alt text' },
            },
          },
          overlayOpacity: { type: 'number', label: 'Overlay opacity (%)', min: 0, max: 90 },
          cornerRadius: {
            type: 'select',
            label: 'Corner radius',
            options: [
              { label: 'None', value: 'none' },
              { label: 'Small', value: 'sm' },
              { label: 'Med', value: 'md' },
              { label: 'Large', value: 'lg' },
            ],
          },
          border: {
            type: 'radio',
            label: 'Border',
            options: [
              { label: 'On', value: true },
              { label: 'Off', value: false },
            ],
          },
          shadow: {
            type: 'select',
            label: 'Shadow',
            options: [
              { label: 'None', value: 'none' },
              { label: 'Small', value: 'sm' },
              { label: 'Medium', value: 'md' },
            ],
          },
        },
      },
      advanced: {
        type: 'object',
        label: 'Advanced',
        objectFields: {
          showOnMobile: YES_NO('Show on mobile'),
          showOnDesktop: YES_NO('Show on desktop'),
          entranceAnimation: {
            type: 'select',
            label: 'Entrance animation',
            options: [
              { label: 'None', value: 'none' },
              { label: 'Fade', value: 'fade' },
              { label: 'Slide up', value: 'slide-up' },
              { label: 'Zoom', value: 'zoom' },
            ],
          },
          anchorId: { type: 'text', label: 'Anchor ID' },
          customCss: CUSTOM_CSS_FIELD,
        },
      },
      experiment: EXPERIMENT_GROUP,
    },
  } as unknown as Fields[string]
}

/**
 * Theme colours a section background can follow (stored by name, so they change with the colour
 * scheme and dark mode). None of these names is a CSS colour, so they never clash with a
 * typed custom colour, which `safeColour` still checks.
 */
export const SECTION_BACKGROUND_TOKENS = {
  ink: 'var(--color-ink)',
  brand: 'var(--color-brand)',
  background: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent: 'var(--color-accent)',
} as const

/** The CSS value of a stored section background: a theme colour name or a custom colour. */
export function sectionBackground(value: string): string | null {
  if (Object.hasOwn(SECTION_BACKGROUND_TOKENS, value)) {
    return SECTION_BACKGROUND_TOKENS[value as keyof typeof SECTION_BACKGROUND_TOKENS]
  }
  return safeColour(value)
}

/** The responsive padding custom properties `.section-frame[data-content-width]` reads. */
export function sectionPaddingStyle(spacing: SectionSettingsValue['spacing']): CSSProperties {
  const vars = (prefix: 'pt' | 'pb', value: ResponsivePadding) => ({
    [`--section-${prefix}-mobile`]: `${value.mobile}px`,
    [`--section-${prefix}-tablet`]: `${value.tablet}px`,
    [`--section-${prefix}-desktop`]: `${value.desktop}px`,
  })
  return {
    ...vars('pt', spacing.paddingTop),
    ...vars('pb', spacing.paddingBottom),
  } as CSSProperties
}

/**
 * The attributes a `bleed` section puts on its own outermost element, which carries the
 * `section-frame` class: its padding, its mobile/desktop visibility and its anchor.
 */
export function bleedFrameProps(settings: SectionSettingsValue): {
  className: string
  style: CSSProperties
  id: string | undefined
  'data-content-width': ContentWidth
} {
  return {
    className: [
      sectionVisibilityClassName(settings.advanced),
      customCssClass(settings.advanced.customCss),
    ]
      .filter(Boolean)
      .join(' '),
    style: sectionPaddingStyle(settings.spacing),
    id: settings.advanced.anchorId || undefined,
    'data-content-width': 'full',
  }
}

/**
 * Whether `flow` settings change nothing: no padding, the default scheme, shown everywhere and
 * no anchor. Then the section is drawn without any frame, exactly as before it had settings.
 */
export function isNeutralFlow(settings: SectionSettingsValue): boolean {
  const { paddingTop, paddingBottom } = settings.spacing
  const noPadding = [paddingTop, paddingBottom].every(
    (p) => p.mobile === 0 && p.tablet === 0 && p.desktop === 0,
  )
  const { advanced } = settings
  return (
    noPadding &&
    settings.style.colorScheme === 'scheme-1' &&
    advanced.showOnMobile &&
    advanced.showOnDesktop &&
    !advanced.anchorId &&
    !advanced.customCss.trim()
  )
}

/** Tailwind classes that hide the section below/at the `md` breakpoint. No JS, no layout shift. */
export function sectionVisibilityClassName(advanced: SectionSettingsValue['advanced']): string {
  const classes: string[] = []
  if (!advanced.showOnMobile) classes.push('max-md:hidden')
  if (!advanced.showOnDesktop) classes.push('md:hidden')
  return classes.join(' ')
}

/** Whether an entrance animation should actually run (never for reduced motion or "none"). */
export function shouldAnimateEntrance(
  animation: EntranceAnimation,
  reducedMotion: boolean,
): boolean {
  return animation !== 'none' && !reducedMotion
}
