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
] as const
export type FieldType = (typeof FIELD_TYPES)[number]
export const FieldTypeSchema = z.enum(FIELD_TYPES)

/** Types whose value is the id of another record. */
export const REFERENCE_TYPES = [
  'file',
  'product_reference',
  'collection_reference',
  'metaobject_reference',
] as const satisfies readonly FieldType[]
export type ReferenceType = (typeof REFERENCE_TYPES)[number]

export const isReferenceType = (t: FieldType): t is ReferenceType =>
  (REFERENCE_TYPES as readonly string[]).includes(t)

/** Types that cannot be lists (a list of booleans or rich text documents means nothing). */
export const NO_LIST_TYPES: readonly FieldType[] = ['boolean', 'rich_text', 'multi_line_text']

/** Field and metafield keys: lower snake case, starting with a letter. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
export const KeySchema = z
  .string()
  .trim()
  .regex(KEY_PATTERN, 'Use lower case letters, digits and _')

/** Type-specific rules. Each applies only to the types that make sense for it. */
export const FieldValidationsSchema = z
  .object({
    /** Number value bounds, or the earliest/latest date as YYYY-MM-DD. */
    min: z.union([z.number(), z.string().max(10)]).optional(),
    max: z.union([z.number(), z.string().max(10)]).optional(),
    /** Text length bounds. */
    minLength: z.number().int().min(0).max(100_000).optional(),
    maxLength: z.number().int().min(1).max(100_000).optional(),
    /** Allowed values for single line text; the admin renders a select. */
    choices: z.array(z.string().trim().min(1).max(200)).max(128).optional(),
    /** For metaobject references: the definition the entry must belong to. */
    metaobjectDefinitionId: z.uuid().optional(),
    /** For lists: how many items at most. */
    maxItems: z.number().int().min(1).max(250).optional(),
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
