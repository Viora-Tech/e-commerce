/**
 * "Write this product in Hindi" / "Improve the SEO". Changes one product's title,
 * description, search title and description, or tags. The card shows each field now and
 * after; Undo puts the previous text back.
 */
import { descriptionFromText, descriptionText } from '@commerce/ai'
import {
  type ProductFieldsPatch,
  type ProductFieldsSnapshot,
  patchProductFields,
  permissions,
  productFieldsSnapshot,
  restoreProductFields,
} from '@commerce/core'
import { z } from 'zod'
import { oneProduct, ProposalProblem } from './resolve'
import type { PreviewRow } from './types'
import { defineAction } from './types'

const Input = z.object({
  product: z.string().max(200).describe('The product handle (best) or exact title.'),
  title: z.string().trim().max(200).optional(),
  description: z
    .string()
    .max(5000)
    .optional()
    .describe(
      'The full new description as plain text: blank lines between paragraphs, "- " for bullet points.',
    ),
  seoTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe('Search result title, at most 60 characters.'),
  seoDescription: z
    .string()
    .trim()
    .max(320)
    .optional()
    .describe('Search result description, 120-155 characters.'),
  addTags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  removeTags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
})
type Raw = z.infer<typeof Input>

type Resolved = { productId: string; title: string; patch: ProductFieldsPatch }
type Undo = { snapshots: ProductFieldsSnapshot[] }

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

export const productUpdateAction = defineAction<Raw, Resolved>({
  tool: 'proposeProductUpdate',
  permission: permissions.PRODUCTS_WRITE,
  description:
    "Draft changes to one product's title, description, search title, search description or tags (for example a Hindi description, or better search text). Shows each field before and after; the merchant approves it, and it can be undone.",
  input: Input,
  editFields: (raw) => [
    ...(raw.title !== undefined ? [{ key: 'title', kind: 'text' as const, value: raw.title }] : []),
    ...(raw.description !== undefined
      ? [{ key: 'description', kind: 'textarea' as const, value: raw.description }]
      : []),
    ...(raw.seoTitle !== undefined
      ? [{ key: 'seoTitle', kind: 'text' as const, value: raw.seoTitle }]
      : []),
    ...(raw.seoDescription !== undefined
      ? [{ key: 'seoDescription', kind: 'textarea' as const, value: raw.seoDescription }]
      : []),
  ],
  propose: async (env, raw) => {
    const found = await oneProduct(env.tx, raw.product)
    const [now] = await productFieldsSnapshot(env.tx, [found.id])
    if (!now) throw new ProposalProblem(`No product called "${raw.product}".`)
    const patch: ProductFieldsPatch = {}
    const rows: PreviewRow[] = []
    if (raw.title && raw.title !== now.title) {
      patch.title = raw.title
      rows.push({ label: 'Title', before: now.title, after: raw.title })
    }
    if (raw.description?.trim()) {
      patch.description = descriptionFromText(raw.description)
      rows.push({
        label: 'Description',
        before: cut(descriptionText(now.description), 400) || '—',
        after: cut(descriptionText(patch.description), 400),
      })
    }
    if (raw.seoTitle && raw.seoTitle !== now.seoTitle) {
      patch.seoTitle = cut(raw.seoTitle, 70)
      rows.push({ label: 'Search title', before: now.seoTitle ?? '—', after: patch.seoTitle })
    }
    if (raw.seoDescription && raw.seoDescription !== now.seoDescription) {
      patch.seoDescription = cut(raw.seoDescription, 160)
      rows.push({
        label: 'Search description',
        before: now.seoDescription ?? '—',
        after: patch.seoDescription,
      })
    }
    if (raw.addTags?.length || raw.removeTags?.length) {
      const remove = new Set((raw.removeTags ?? []).map((t) => t.toLowerCase()))
      const kept = now.tags.filter((t) => !remove.has(t.toLowerCase()))
      const have = new Set(kept.map((t) => t.toLowerCase()))
      const added = [...new Set((raw.addTags ?? []).map((t) => t.toLowerCase()))].filter(
        (t) => !have.has(t),
      )
      const tags = [...kept, ...added].slice(0, 50)
      if (tags.join('|') !== now.tags.join('|')) {
        patch.tags = tags
        rows.push({
          label: 'Tags',
          before: now.tags.join(', ') || '—',
          after: tags.join(', ') || '—',
        })
      }
    }
    if (!rows.length) throw new ProposalProblem('That would not change anything on the product.')
    const fields = rows.map((r) => r.label.toLowerCase()).join(', ')
    return {
      summary: `Update ${found.title}: ${fields}`,
      resolved: { productId: found.id, title: found.title, patch },
      preview: {
        title: `Update ${found.title}`,
        lines: [{ label: 'Product', value: found.title }],
        rows,
        more: 0,
        count: 1,
        undoable: true,
        notes: [],
      },
    }
  },
  execute: async (env, resolved) => {
    const snapshots = await productFieldsSnapshot(env.tx, [resolved.productId])
    if (!snapshots.length) throw new ProposalProblem('That product no longer exists.')
    await patchProductFields(env.tx, env.storeId, [
      { productId: resolved.productId, patch: resolved.patch },
    ])
    return {
      message: `${resolved.title} updated`,
      href: `/products/${resolved.productId}`,
      result: { productId: resolved.productId },
      undo: { snapshots } satisfies Undo,
    }
  },
  undo: async (env, undo) => {
    const { snapshots } = undo as Undo
    const n = await restoreProductFields(env.tx, env.storeId, snapshots)
    if (!n) throw new ProposalProblem('That product no longer exists.')
    return n === 1 ? 'Previous text put back' : `Previous text put back on ${n} products`
  },
})
