import { CURRENCIES, type Currency } from '@commerce/money'
import { z } from 'zod'

/**
 * Value types for metaobject fields and product/collection metafields. Mirrors
 * `METAFIELD_TYPES` in @commerce/db (a test keeps them equal); repeated here so
 * browser code can use it without the database barrel.
 */
export const FIELD_TYPES = [
  'single_line_text',
  'multi_line_text',
  'rich_text',
  'number_integer',
  'number_decimal',
  'boolean',
  'date',
  'url',
  'file',
  'product_reference',
  'collection_reference',
  'metaobject_reference',
  // CMS PR2. What each stores (checked in `field-values.ts`):
  'color', // "#1a2b3c"
  'date_time', // an instant in UTC: "2026-10-02T04:30:00.000Z"
  'money', // { amount: 49900, currency: "INR" }, amount in paise / cents
  'choice', // one of `validations.choices`; a list field is a multi-pick
  'link', // { label: "Size chart", url: "https://..." or "/pages/size-chart" }
  'rating', // { value: 4.5, max: 5 }
  'measurement', // { value: 1.5, unit: "kg" }, unit from `validations.measure`
  'page_reference', // page id
  'variant_reference', // variant id
  'article_reference', // blog post id
  'group', // rows: [{ <sub key>: value }], sub fields in `validations.subfields`
] as const
export type FieldType = (typeof FIELD_TYPES)[number]
export const FieldTypeSchema = z.enum(FIELD_TYPES)

/** Types whose value is the id of another record. */
export const REFERENCE_TYPES = [
  'file',
  'product_reference',
  'collection_reference',
  'metaobject_reference',
  'page_reference',
  'variant_reference',
  'article_reference',
] as const satisfies readonly FieldType[]
export type ReferenceType = (typeof REFERENCE_TYPES)[number]

export const isReferenceType = (t: FieldType): t is ReferenceType =>
  (REFERENCE_TYPES as readonly string[]).includes(t)

/**
 * Types that cannot be lists (a list of booleans or rich text documents means nothing; a group
 * already is a list of rows).
 */
export const NO_LIST_TYPES: readonly FieldType[] = [
  'boolean',
  'rich_text',
  'multi_line_text',
  'group',
]

/**
 * What the rows of a group can hold: plain values and files, one level deep (no group in a
 * group, no links to other records except files). The idea follows Payload CMS's `array`
 * field and Instatic's repeater (both MIT); no code copied.
 */
export const GROUP_FIELD_TYPES = [
  'single_line_text',
  'multi_line_text',
  'number_integer',
  'number_decimal',
  'boolean',
  'date',
  'date_time',
  'url',
  'color',
  'money',
  'choice',
  'link',
  'rating',
  'measurement',
  'file',
] as const satisfies readonly FieldType[]
export type GroupFieldType = (typeof GROUP_FIELD_TYPES)[number]

/** Units a measurement can use, per kind. Shopify calls length "dimension". */
export const MEASURE_UNITS = {
  weight: ['g', 'kg', 'oz', 'lb'],
  length: ['mm', 'cm', 'm', 'in', 'ft'],
  volume: ['ml', 'l', 'fl_oz'],
} as const
export type MeasureKind = keyof typeof MEASURE_UNITS
export type MeasureUnit = (typeof MEASURE_UNITS)[MeasureKind][number]
export const MEASURE_KINDS = Object.keys(MEASURE_UNITS) as MeasureKind[]

/** Currencies a money field can hold: the money module's list. */
export const FIELD_CURRENCIES = Object.keys(CURRENCIES) as Currency[]

/** A rating is out of 5 unless the field says otherwise. */
export const DEFAULT_RATING_MAX = 5
const RATING_MAX_LIMIT = 10
/** Most rows a group keeps, and most fields per row. */
export const GROUP_ROWS_MAX = 100
export const GROUP_FIELDS_MAX = 12

/** Field and metafield keys: lower snake case, starting with a letter. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
export const KeySchema = z
  .string()
  .trim()
  .regex(KEY_PATTERN, 'Use lower case letters, digits and _')

/** Type-specific rules. Each applies only to the types that make sense for it. */
const validationShape = {
  /** Number value bounds, or the earliest/latest date as YYYY-MM-DD. */
  min: z.union([z.number(), z.string().max(10)]).optional(),
  max: z.union([z.number(), z.string().max(10)]).optional(),
  /** Text length bounds. */
  minLength: z.number().int().min(0).max(100_000).optional(),
  maxLength: z.number().int().min(1).max(100_000).optional(),
  /** The values a choice field offers; on single line text, a select. */
  choices: z.array(z.string().trim().min(1).max(200)).max(128).optional(),
  /** For metaobject references: the definition the entry must belong to. */
  metaobjectDefinitionId: z.uuid().optional(),
  /** For lists: how many items at most; for groups, how many rows. */
  maxItems: z.number().int().min(1).max(250).optional(),
  /** For money: the currency amounts are in (INR when absent). */
  currency: z.enum(FIELD_CURRENCIES as [Currency, ...Currency[]]).optional(),
  /** For measurements: weight, length or volume. A measurement field must have one. */
  measure: z.enum(MEASURE_KINDS as [MeasureKind, ...MeasureKind[]]).optional(),
  /** For ratings: the top of the scale (5 when absent). */
  ratingMax: z.number().int().min(1).max(RATING_MAX_LIMIT).optional(),
}

/** One field of a group's rows: a plain value with its own simple rules. */
const GroupFieldSchema = z.object({
  key: KeySchema,
  name: z.string().trim().min(1).max(100),
  type: z.enum(GROUP_FIELD_TYPES),
  required: z.boolean().default(false),
  validations: z.object(validationShape).strict().optional(),
})
export type GroupField = z.infer<typeof GroupFieldSchema>

export const FieldValidationsSchema = z
  .object({
    ...validationShape,
    /** For groups: the fields every row has. */
    subfields: z.array(GroupFieldSchema).max(GROUP_FIELDS_MAX).optional(),
  })
  .strict()
export type FieldValidations = z.infer<typeof FieldValidationsSchema>

export const FieldDefinitionSchema = z.object({
  key: KeySchema,
  name: z.string().trim().min(1).max(100),
  type: FieldTypeSchema,
  list: z.boolean().default(false),
  required: z.boolean().default(false),
  description: z.string().trim().max(300).optional(),
  validations: FieldValidationsSchema.optional(),
})
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>

export const MetaobjectDefinitionWriteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** Handle used by templates (`metaobjects.<type>`); derived from the name when absent. */
  type: KeySchema.optional(),
  description: z.string().trim().max(300).nullable().optional(),
  displayNameKey: KeySchema.nullable().optional(),
  fields: z.array(FieldDefinitionSchema).max(40),
  storefrontAccess: z.boolean().default(true),
})
export type MetaobjectDefinitionWrite = z.infer<typeof MetaobjectDefinitionWriteSchema>

export const MetaobjectStatusSchema = z.enum(['draft', 'active'])
export type MetaobjectStatus = z.infer<typeof MetaobjectStatusSchema>

export const MetaobjectWriteSchema = z.object({
  definitionId: z.uuid(),
  handle: z.string().trim().max(200).optional(),
  status: MetaobjectStatusSchema.default('active'),
  fields: z.record(z.string(), z.unknown()),
})
export type MetaobjectWrite = z.infer<typeof MetaobjectWriteSchema>

export const MetafieldOwnerTypeSchema = z.enum(['product', 'collection'])
export type MetafieldOwnerType = z.infer<typeof MetafieldOwnerTypeSchema>

export const MetafieldDefinitionWriteSchema = z.object({
  ownerType: MetafieldOwnerTypeSchema,
  name: z.string().trim().min(1).max(100),
  namespace: KeySchema.default('custom'),
  /** Derived from the name when absent. Immutable after creation. */
  key: KeySchema.optional(),
  description: z.string().trim().max(300).nullable().optional(),
  type: FieldTypeSchema,
  list: z.boolean().default(false),
  validations: FieldValidationsSchema.default({}),
  storefrontAccess: z.boolean().default(true),
})
export type MetafieldDefinitionWrite = z.infer<typeof MetafieldDefinitionWriteSchema>

/** Thrown by the write paths so the router can answer 400 rather than 500. */
export class InvalidMetaobject extends Error {
  readonly errors: string[]
  /** Per field key, for forms that show the message under the input. */
  readonly fieldErrors: Record<string, string>
  constructor(errors: string[], fieldErrors: Record<string, string> = {}) {
    super(errors.join('. '))
    this.name = 'InvalidMetaobject'
    this.errors = errors
    this.fieldErrors = fieldErrors
  }
}
