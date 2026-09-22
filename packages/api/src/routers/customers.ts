import { z } from 'zod'
import { storeProcedure } from '../procedures'
import {
  customerStats,
  customerTags,
  deleteCustomer,
  deleteSegment,
  getCustomer,
  getSegment,
  listAllCustomers,
  listCustomers,
  listSegmentCustomers,
  listSegments,
  saveSegment,
  tagCustomers,
  updateCustomer,
} from '../services/customer.service'

const FiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  segment: z.enum(['new', 'returning', 'subscribed']).optional(),
  stateCode: z.string().trim().length(2).optional(),
  minSpentPaise: z.number().int().min(0).optional(),
  maxSpentPaise: z.number().int().min(0).optional(),
  minOrders: z.number().int().min(0).optional(),
  acceptsMarketing: z.boolean().optional(),
  tag: z.string().trim().min(1).max(40).optional(),
})

const RulesSchema = z.object({
  match: z.enum(['all', 'any']).default('all'),
  conditions: z
    .array(
      z.object({
        field: z.enum(['spend', 'orders', 'state', 'tag', 'last_order_days', 'marketing']),
        op: z.enum(['gte', 'lte', 'eq', 'neq', 'contains']),
        value: z.string().trim().max(100),
      }),
    )
    .max(20)
    .default([]),
})

export const customersRouter = {
  list: storeProcedure
    .input(
      FiltersSchema.extend({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        sort: z.enum(['recent', 'name', 'orders', 'spent']).optional(),
      }),
    )
    .handler(({ context, input }) => listCustomers(context.tx, input)),

  stats: storeProcedure.handler(({ context }) => customerStats(context.tx)),

  tags: storeProcedure.handler(({ context }) => customerTags(context.tx)),

  /** Rows for a CSV export of the current filter; the browser builds the file. */
  export: storeProcedure
    .input(FiltersSchema)
    .handler(({ context, input }) => listAllCustomers(context.tx, input)),

  get: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getCustomer(context.tx, input.id)),

  update: storeProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().trim().max(200).nullable().optional(),
        phone: z.string().trim().max(30).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
        note: z.string().trim().max(2000).nullable().optional(),
        acceptsMarketing: z.boolean().optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateCustomer(context.tx, id, patch)),

  delete: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteCustomer(context.tx, input.id)),

  tagMany: storeProcedure
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(200),
        tag: z.string().trim().min(1).max(40),
        action: z.enum(['add', 'remove']),
      }),
    )
    .handler(({ context, input }) => tagCustomers(context.tx, input)),

  segments: storeProcedure.handler(({ context }) => listSegments(context.tx)),

  segment: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getSegment(context.tx, input.id)),

  saveSegment: storeProcedure
    .input(
      z.object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1).max(80),
        rules: RulesSchema,
      }),
    )
    .handler(({ context, input }) =>
      saveSegment(context.tx, { ...input, storeId: context.scope.storeId }),
    ),

  deleteSegment: storeProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteSegment(context.tx, input.id)),

  /** Live count and a sample for the rule builder. */
  previewSegment: storeProcedure
    .input(z.object({ rules: RulesSchema }))
    .handler(async ({ context, input }) => {
      const matches = await listSegmentCustomers(context.tx, input.rules)
      return { total: matches.length, sample: matches.slice(0, 5) }
    }),
}
