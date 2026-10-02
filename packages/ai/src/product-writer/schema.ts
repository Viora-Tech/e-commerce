/**
 * SOURCE OF TRUTH: product writer output — WHAT the shape "Write with AI" returns (description,
 * SEO, tags, specs) and its tone and language choices / WHY the model, the API and the admin
 * preview all agree on one zod schema. Client-safe.
 */
import { z } from 'zod'

export const WRITER_TONES = ['friendly', 'premium', 'playful', 'technical', 'simple'] as const
export type WriterTone = (typeof WRITER_TONES)[number]

export const WRITER_LANGUAGES = ['en', 'hi'] as const
export type WriterLanguage = (typeof WRITER_LANGUAGES)[number]

/** Most photos sent to the model per call (each is ~1.5k input tokens). */
export const WRITER_MAX_PHOTOS = 3

/**
 * What the model must return. No length limits in the schema itself (not every provider's
 * structured output enforces them); `clampProductCopy` trims afterwards instead.
 */
export const ProductCopySchema = z.object({
  intro: z
    .string()
    .describe('Opening paragraph, 2-4 sentences: what it is and why a shopper wants it.'),
  highlights: z
    .array(z.string())
    .describe('3-6 short benefit-led bullet points, no full stops at the end.'),
  closing: z.string().describe('One short closing sentence, or an empty string.'),
  specsTitle: z.string().describe('Heading for the specs list, in the output language.'),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe('Key specs visible in the photos or given in the notes. Never guess numbers.'),
  seoTitle: z.string().describe('Search result title, at most 60 characters.'),
  seoDescription: z.string().describe('Search result description, 120-155 characters.'),
  tags: z.array(z.string()).describe('4-8 lowercase tags shoppers would filter or search by.'),
  altTexts: z
    .array(z.string())
    .describe(
      'One short alt text per photo, in the order given: what is visible, for shoppers using a screen reader. Empty when there are no photos.',
    ),
})

export type ProductCopy = z.infer<typeof ProductCopySchema>

const LIMITS = {
  intro: 900,
  highlight: 160,
  highlights: 6,
  closing: 300,
  specsTitle: 40,
  specs: 8,
  specLabel: 40,
  specValue: 80,
  seoTitle: 70,
  seoDescription: 160,
  tags: 10,
  tag: 30,
  altTexts: 3,
  altText: 125,
} as const

function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max)
  const space = slice.lastIndexOf(' ')
  return (space > max * 0.6 ? slice.slice(0, space) : slice).trim()
}

/** The model's output trimmed to what the product form and search engines accept. */
export function clampProductCopy(copy: ProductCopy): ProductCopy {
  const tags = [...new Set(copy.tags.map((t) => cut(t.toLowerCase(), LIMITS.tag)).filter(Boolean))]
  return {
    intro: cut(copy.intro, LIMITS.intro),
    highlights: copy.highlights
      .map((h) => cut(h, LIMITS.highlight))
      .filter(Boolean)
      .slice(0, LIMITS.highlights),
    closing: cut(copy.closing, LIMITS.closing),
    specsTitle: cut(copy.specsTitle, LIMITS.specsTitle),
    specs: copy.specs
      .map((s) => ({
        label: cut(s.label, LIMITS.specLabel),
        value: cut(s.value, LIMITS.specValue),
      }))
      .filter((s) => s.label && s.value)
      .slice(0, LIMITS.specs),
    seoTitle: cut(copy.seoTitle, LIMITS.seoTitle),
    seoDescription: cut(copy.seoDescription, LIMITS.seoDescription),
    tags: tags.slice(0, LIMITS.tags),
    altTexts: (copy.altTexts ?? [])
      .map((a) => cut(a, LIMITS.altText))
      .filter(Boolean)
      .slice(0, LIMITS.altTexts),
  }
}
