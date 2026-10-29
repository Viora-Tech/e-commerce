import { z } from 'zod'
import { HandleSchema, RichTextSchema } from '../catalog/schemas'

export const ArticleStatusSchema = z.enum(['draft', 'scheduled', 'published'])
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>

export const CommentPolicySchema = z.enum(['disabled', 'moderated', 'open'])
export type CommentPolicy = z.infer<typeof CommentPolicySchema>

export const BlogWriteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  handle: HandleSchema.optional(),
  commentPolicy: CommentPolicySchema.optional(),
  /** Alternate template of the live theme (`<kind>.<suffix>`); blank or null is the default. */
  templateSuffix: z
    .string()
    .regex(/^[a-z0-9-]{0,40}$/)
    .nullable()
    .optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(400).nullable().optional(),
})
export type BlogWrite = z.infer<typeof BlogWriteSchema>

export const ArticleWriteSchema = z.object({
  blogId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  handle: HandleSchema.optional(),
  author: z.string().trim().max(120).optional(),
  body: z.union([RichTextSchema, z.string()]).nullable().optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  imageMediaId: z.uuid().nullable().optional(),
  imageAlt: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  status: ArticleStatusSchema,
  /** Required when scheduling; when publishing now it defaults to the save time. */
  publishedAt: z.coerce.date().nullable().optional(),
  /** Alternate template of the live theme (`<kind>.<suffix>`); blank or null is the default. */
  templateSuffix: z
    .string()
    .regex(/^[a-z0-9-]{0,40}$/)
    .nullable()
    .optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(400).nullable().optional(),
})
export type ArticleWrite = z.infer<typeof ArticleWriteSchema>

export const ArticleListSchema = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
  query: z.string().trim().max(200).optional(),
  status: z.enum(['all', 'published', 'scheduled', 'draft']).default('all'),
  blogId: z.uuid().optional(),
  tag: z.string().trim().max(40).optional(),
  /** The admin's filter panel; arrays are "any of" and combine with the tab and search. */
  blogIds: z.array(z.uuid()).max(50).optional(),
  tags: z.array(z.string().trim().max(40)).max(50).optional(),
  authors: z.array(z.string().trim().max(200)).max(50).optional(),
  /** Published (or scheduled) for [from, to); ISO times. */
  publishedFrom: z.iso.datetime().optional(),
  publishedTo: z.iso.datetime().optional(),
  hasImage: z.boolean().optional(),
})
export type ArticleList = z.infer<typeof ArticleListSchema>

/** Thrown by the write path so the router can answer 400 rather than 500. */
export class InvalidArticle extends Error {
  readonly errors: string[]
  constructor(errors: string[]) {
    super(errors.join('. '))
    this.name = 'InvalidArticle'
    this.errors = errors
  }
}
