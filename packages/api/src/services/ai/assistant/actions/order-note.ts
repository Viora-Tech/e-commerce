/**
 * "Draft a reply to order #2250". Adds an internal note to the order's timeline: a note for
 * the team, or a reply draft the merchant copies and sends themselves. Nothing is ever sent
 * to the customer. Notes stay on the timeline, so there is no undo.
 */
import { ASSISTANT_LIMITS } from '@commerce/ai'
import { permissions } from '@commerce/core'
import { z } from 'zod'
import { addOrderNote } from '../../../order.service'
import { orderByNumber, ProposalProblem } from './resolve'
import { defineAction } from './types'

const Input = z.object({
  order: z.number().int().min(1).describe('The order number, e.g. 2250 for #2250.'),
  kind: z
    .enum(['note', 'reply'])
    .default('note')
    .describe(
      'note: an internal note for the team. reply: a draft reply to the customer, saved as a note (never sent).',
    ),
  text: z.string().trim().min(1).max(ASSISTANT_LIMITS.maxNoteLength),
})
type Raw = z.infer<typeof Input>

type Resolved = { orderId: string; number: number; body: string; kind: Raw['kind'] }

const REPLY_PREFIX = 'Reply draft (not sent):'

export const orderNoteAction = defineAction<Raw, Resolved>({
  tool: 'proposeOrderNote',
  permission: permissions.ORDERS_WRITE,
  description:
    "Draft an internal note on an order's timeline, or a reply to the customer saved as a note for the merchant to copy. Never sends anything to the customer.",
  input: Input,
  editFields: (raw) => [{ key: 'text', kind: 'textarea', value: raw.text }],
  propose: async (env, raw) => {
    const found = await orderByNumber(env.tx, raw.order)
    const body = raw.kind === 'reply' ? `${REPLY_PREFIX}\n${raw.text.trim()}` : raw.text.trim()
    const what = raw.kind === 'reply' ? 'reply draft' : 'note'
    return {
      summary: `Add a ${what} to order #${found.number}`,
      resolved: { orderId: found.id, number: found.number, body, kind: raw.kind },
      preview: {
        title:
          raw.kind === 'reply'
            ? `Draft reply to order #${found.number}`
            : `Note on order #${found.number}`,
        lines: [{ label: 'Order', value: `#${found.number}` }],
        rows: [
          {
            label: raw.kind === 'reply' ? 'Reply draft' : 'Note',
            before: '',
            after: raw.text.trim(),
          },
        ],
        more: 0,
        count: 1,
        undoable: false,
        notes: ['Saved on the order timeline only. Nothing is sent to the customer.'],
      },
    }
  },
  execute: async (env, resolved) => {
    const note = await addOrderNote(env.tx, env.storeId, {
      orderId: resolved.orderId,
      body: resolved.body,
      author: env.email,
    })
    if (!note) throw new ProposalProblem('That order no longer exists.')
    return {
      message: `${resolved.kind === 'reply' ? 'Reply draft' : 'Note'} added to order #${resolved.number}`,
      href: `/orders/${resolved.orderId}`,
      result: { orderId: resolved.orderId, noteId: note.id },
      undo: null,
    }
  },
})
