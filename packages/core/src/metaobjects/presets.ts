import { z } from 'zod'
import type { FieldDefinition, MetaobjectDefinitionWrite } from './schemas'

/**
 * SOURCE OF TRUTH KEYWORDS: METAOBJECT_PRESETS, PRESET_KEYS, PresetKey, PresetKeySchema, presetDefinition
 * WHAT:  Ready-made content types ("Size guide", "FAQ", ...) a merchant starts from instead of a blank form.
 * WHY:   One registry, so the router (`metaobjects.fromPreset`), the admin's "What do you want to make?"
 *        picture cards and the tests all read the same keys. Fields use only the 12 existing field
 *        types; a size chart is a list of text rows until richer types exist. Browser-safe, no database.
 * WHERE: `createDefinitionFromPreset` (service.ts) builds from it; card titles and Hindi live in the
 *        admin's `data/metaobjects.ts` (`presetContent`, typed `Record<PresetKey, ...>`).
 */

type Preset = {
  /** Default name; the merchant may rename it in the guided flow. */
  name: string
  description: string
  displayNameKey: string
  fields: FieldDefinition[]
}

const text = (
  key: string,
  name: string,
  extra: Partial<FieldDefinition> = {},
): FieldDefinition => ({
  key,
  name,
  type: 'single_line_text',
  list: false,
  required: false,
  ...extra,
})

const field = (
  key: string,
  name: string,
  type: FieldDefinition['type'],
  extra: Partial<FieldDefinition> = {},
): FieldDefinition => ({ key, name, type, list: false, required: false, ...extra })

export const METAOBJECT_PRESETS = {
  size_guide: {
    name: 'Size guide',
    description: 'Size charts you can show on product pages.',
    displayNameKey: 'title',
    fields: [
      text('title', 'Title', { required: true, description: 'For example: Women’s tops' }),
      text('unit', 'Measured in', { validations: { choices: ['cm', 'inches'] } }),
      text('rows', 'Size chart rows', {
        list: true,
        description: 'One row per size, like: S | Chest 36 | Waist 28',
      }),
      field('how_to_measure', 'How to measure', 'multi_line_text'),
      field('image', 'Picture', 'file'),
    ],
  },
  faq: {
    name: 'FAQ',
    description: 'Questions customers ask, with your answers.',
    displayNameKey: 'question',
    fields: [
      text('question', 'Question', { required: true }),
      field('answer', 'Answer', 'multi_line_text', { required: true }),
      text('topic', 'Topic', { description: 'Groups questions, like Shipping or Returns' }),
    ],
  },
  team_member: {
    name: 'Team member',
    description: 'The people behind your shop.',
    displayNameKey: 'name',
    fields: [
      text('name', 'Name', { required: true }),
      text('role', 'Role', { description: 'For example: Founder' }),
      field('photo', 'Photo', 'file'),
      field('bio', 'About them', 'multi_line_text'),
      field('instagram', 'Instagram link', 'url'),
    ],
  },
  store_location: {
    name: 'Store location',
    description: 'Shops and pickup points customers can visit.',
    displayNameKey: 'name',
    fields: [
      text('name', 'Store name', { required: true }),
      field('address', 'Address', 'multi_line_text', { required: true }),
      text('city', 'City'),
      text('phone', 'Phone number'),
      field('hours', 'Opening hours', 'multi_line_text'),
      field('map_link', 'Google Maps link', 'url'),
      field('photo', 'Photo', 'file'),
    ],
  },
  testimonial: {
    name: 'Testimonial',
    description: 'Kind words from happy customers.',
    displayNameKey: 'customer',
    fields: [
      text('customer', 'Customer name', { required: true }),
      field('quote', 'What they said', 'multi_line_text', { required: true }),
      field('rating', 'Stars (1 to 5)', 'number_integer', { validations: { min: 1, max: 5 } }),
      field('photo', 'Photo', 'file'),
      field('product', 'Product they bought', 'product_reference'),
    ],
  },
  lookbook: {
    name: 'Lookbook',
    description: 'Styled photos with the products in them.',
    displayNameKey: 'title',
    fields: [
      text('title', 'Title', { required: true }),
      field('cover', 'Cover picture', 'file'),
      field('photos', 'Photos', 'file', { list: true }),
      field('products', 'Products in the look', 'product_reference', { list: true }),
      field('story', 'Story', 'rich_text'),
    ],
  },
} satisfies Record<string, Preset>

export type PresetKey = keyof typeof METAOBJECT_PRESETS
/** Display order of the picture cards. */
export const PRESET_KEYS = Object.keys(METAOBJECT_PRESETS) as PresetKey[]
export const PresetKeySchema = z.enum(PRESET_KEYS as [PresetKey, ...PresetKey[]])

export const FromPresetInputSchema = z.object({
  preset: PresetKeySchema,
  /** The merchant's own name for it; the preset's name when blank. */
  name: z.string().trim().max(100).optional(),
})
export type FromPresetInput = z.infer<typeof FromPresetInputSchema>

/** The definition a preset creates. The type handle is left out so the server makes it unique. */
export function presetDefinition(input: FromPresetInput): MetaobjectDefinitionWrite {
  const preset: Preset = METAOBJECT_PRESETS[input.preset]
  return {
    name: input.name?.trim() || preset.name,
    description: preset.description,
    displayNameKey: preset.displayNameKey,
    fields: preset.fields.map((f) => structuredClone(f)),
    storefrontAccess: true,
  }
}
