import { z } from 'zod'
import { HandleSchema, RichTextSchema } from '../catalog/schemas'
import { COLLECTION_FIELDS, COLLECTION_OPS, COLLECTION_SORTS } from './rules'

export const CollectionKindSchema = z.enum(['manual', 'automatic'])
export type CollectionKind = z.infer<typeof CollectionKindSchema>

export const CollectionStatusSchema = z.enum(['draft', 'active'])
export type CollectionStatus = z.infer<typeof CollectionStatusSchema>

export const CollectionSortSchema = z.enum(COLLECTION_SORTS)

export const CollectionConditionSchema = z.object({
  field: z.enum(COLLECTION_FIELDS),
  op: z.enum(COLLECTION_OPS),
  value: z.string().trim().max(200),
})

export const CollectionRulesSchema = z.object({
  match: z.enum(['all', 'any']),
  conditions: z.array(CollectionConditionSchema).max(20),
})

export const CollectionWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  handle: HandleSchema.optional(),
  description: z.union([RichTextSchema, z.string()]).nullable().optional(),
  imageMediaId: z.uuid().nullable().optional(),
  kind: CollectionKindSchema,
  rules: CollectionRulesSchema.optional(),
  sortOrder: CollectionSortSchema.optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(400).nullable().optional(),
  status: CollectionStatusSchema.optional(),
  /** Manual collections only; ignored for automatic ones. */
  productIds: z.array(z.uuid()).max(500).optional(),
})
export type CollectionWrite = z.infer<typeof CollectionWriteSchema>

/** Thrown by the write path so the router can answer 400 rather than 500. */
export class InvalidCollection extends Error {
  readonly errors: string[]
  constructor(errors: string[]) {
    super(errors.join('. '))
    this.name = 'InvalidCollection'
    this.errors = errors
  }
}
