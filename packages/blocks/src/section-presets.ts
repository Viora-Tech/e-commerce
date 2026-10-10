/**
 * Section styles: the "Style" a merchant picks when adding a section (Hero: slideshow, centred,
 * split or video; Feature cards: 3 or 4 across…). A style is only a different starting point:
 * each one is the section's own default settings with a few of them changed, so the section is
 * the same component either way and every setting stays editable afterwards. Pure and
 * client-safe; the admin's Add panel and `bun run section-previews` both read it. The first
 * style of a section is its plain defaults.
 */
import { sectionPresetsContent as copy } from './data/section-presets'

type Props = Record<string, unknown>

export type SectionPreset = {
  id: string
  label: string
  description: string
  /** The style's settings, from the section's own defaults. */
  apply: (defaults: Props) => Props
}

const same = (defaults: Props): Props => defaults

const list = (value: unknown): Props[] =>
  Array.isArray(value) ? value.filter((v): v is Props => !!v && typeof v === 'object') : []

/** The hero's first slide, changed by `slide`, as its only slide; the slideshow controls off. */
const oneSlide =
  (slide: Props) =>
  (defaults: Props): Props => ({
    ...defaults,
    slides: [{ ...(list(defaults.slides)[0] ?? {}), ...slide }],
    autoplay: false,
    showArrows: false,
    showDots: false,
    showSlideCounter: false,
  })

const firstItems = (key: string, count: number, defaults: Props): Props[] =>
  list(defaults[key]).slice(0, count)

/** Styles by section type; types not listed here are added as they are. */
export const SECTION_PRESETS: Readonly<Record<string, readonly SectionPreset[]>> = {
  Hero: [
    { id: 'slideshow', ...copy.Hero.slideshow, apply: same },
    {
      id: 'centred',
      ...copy.Hero.centred,
      apply: oneSlide({ kind: 'image', layout: 'full_bleed', textPosition: 'center' }),
    },
    {
      id: 'split',
      ...copy.Hero.split,
      apply: oneSlide({
        kind: 'image',
        layout: 'split',
        splitMediaPosition: 'right',
        textPosition: 'left',
      }),
    },
    {
      id: 'video',
      ...copy.Hero.video,
      apply: oneSlide({ kind: 'video', layout: 'full_bleed', textPosition: 'left', videoUrl: '' }),
    },
  ],
  FeatureCards: [
    { id: 'three', ...copy.FeatureCards.three, apply: (d) => ({ ...d, columns: 3 }) },
    {
      id: 'four',
      ...copy.FeatureCards.four,
      apply: (d) => ({ ...d, columns: 4, items: firstItems('items', 4, d) }),
    },
    {
      id: 'two',
      ...copy.FeatureCards.two,
      apply: (d) => ({ ...d, columns: 2, items: firstItems('items', 4, d) }),
    },
    {
      id: 'text',
      ...copy.FeatureCards.text,
      apply: (d) => ({ ...d, columns: 3, items: list(d.items).map((i) => ({ ...i, icon: '' })) }),
    },
  ],
  ImageBanner: [
    { id: 'centred', ...copy.ImageBanner.centred, apply: (d) => ({ ...d, align: 'center' }) },
    { id: 'left', ...copy.ImageBanner.left, apply: (d) => ({ ...d, align: 'left' }) },
    {
      id: 'tall',
      ...copy.ImageBanner.tall,
      apply: (d) => ({ ...d, align: 'center', height: 'large' }),
    },
  ],
  ImageWithText: [
    {
      id: 'imageLeft',
      ...copy.ImageWithText.imageLeft,
      apply: (d) => ({ ...d, imageFirst: true }),
    },
    {
      id: 'imageRight',
      ...copy.ImageWithText.imageRight,
      apply: (d) => ({ ...d, imageFirst: false }),
    },
  ],
  FeatureChecklist: [
    {
      id: 'imageLeft',
      ...copy.FeatureChecklist.imageLeft,
      apply: (d) => ({ ...d, imageSide: 'left' }),
    },
    {
      id: 'imageRight',
      ...copy.FeatureChecklist.imageRight,
      apply: (d) => ({ ...d, imageSide: 'right' }),
    },
  ],
}

/** The styles a section type offers; empty when it has none (it is added as it is). */
export function presetsFor(type: string): readonly SectionPreset[] {
  return SECTION_PRESETS[type] ?? []
}

/**
 * A section's settings in one style: a deep copy of its defaults with the style applied, so
 * the defaults the editor holds are never shared with the new section. Unknown style: the
 * defaults.
 */
export function presetProps(type: string, presetId: string, defaults: Props): Props {
  const preset = presetsFor(type).find((p) => p.id === presetId)
  let copied: Props
  try {
    copied = structuredClone(defaults)
  } catch {
    // Defaults holding something that cannot be cloned (a function) are copied one level deep.
    copied = { ...defaults }
  }
  return preset ? preset.apply(copied) : copied
}

/** The picture name `bun run section-previews` writes for a style: `<Type>--<style>`. */
export const presetPictureKey = (type: string, presetId: string): string => `${type}--${presetId}`
