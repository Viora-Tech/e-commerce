/** SOURCE OF TRUTH: listMonthlyExpenses, createMonthlyExpense, updateMonthlyExpense,
 *   deleteMonthlyExpense, monthlyExpenseVersions
 * WHAT:  Settings › Monthly expenses: the store's running costs, stored as versions so an edit
 *        from a month on never changes an earlier month (finance/monthly-expenses.ts).
 * WHY:   Net profit per month takes these off the month's order profit.
 * WHERE: `monthlyExpenses.*` (api), api reports/profit.ts.
 */
import { monthlyExpense, newId, type StoreTx } from '@commerce/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import {
  EXPENSE_CATEGORIES,
  type ExpenseVersion,
  isMonthKey,
  type MonthKey,
  planExpenseEdit,
} from './monthly-expenses'

const MonthSchema = z.string().refine(isMonthKey, 'A month like 2026-10')

const ExpenseFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(EXPENSE_CATEGORIES).default('other'),
  /** Per month. */
  amountPaise: z.number().int().min(0).max(1_00_00_000_00),
  /** Last month it counts in; null keeps it running. A one-off sets it to its first month. */
  endsOn: MonthSchema.nullable().default(null),
})

export const MonthlyExpenseCreateSchema = ExpenseFieldsSchema.extend({ startsOn: MonthSchema })
export const MonthlyExpenseUpdateSchema = ExpenseFieldsSchema.extend({
  id: z.uuid(),
  /** The first month the new values count in; earlier months keep what they had. */
  fromMonth: MonthSchema,
})
export const MonthlyExpenseIdSchema = z.object({ id: z.uuid() })

class MonthlyExpenseNotFound extends CommerceError {
  constructor(id: string, storeId?: string) {
    super('MONTHLY_EXPENSE_NOT_FOUND', `Monthly expense ${id} not found`, { storeId })
  }
}

class MonthlyExpenseInvalid extends CommerceError {
  constructor(reason: string, storeId?: string) {
    super('MONTHLY_EXPENSE_INVALID', reason, { storeId })
  }
}

const toDate = (month: MonthKey) => `${month}-01`
const toMonth = (date: string | null) => (date ? date.slice(0, 7) : null)

type Row = typeof monthlyExpense.$inferSelect

function versionOf(r: Row): ExpenseVersion {
  return {
    id: r.id,
    seriesId: r.seriesId,
    name: r.name,
    category: r.category,
    amountPaise: r.amountPaise,
    startsOn: r.startsOn.slice(0, 7),
    endsOn: toMonth(r.endsOn),
  }
}

/** Every live (not deleted) version, by name then first month. Reads under RLS. */
export async function monthlyExpenseVersions(tx: StoreTx): Promise<ExpenseVersion[]> {
  const rows = await tx
    .select()
    .from(monthlyExpense)
    .where(isNull(monthlyExpense.archivedAt))
    .orderBy(asc(monthlyExpense.name), asc(monthlyExpense.startsOn))
  return rows.map(versionOf)
}

export const listMonthlyExpenses = (ctx: StoreContext) => monthlyExpenseVersions(ctx.tx)

export async function createMonthlyExpense(
  ctx: StoreContext,
  raw: z.input<typeof MonthlyExpenseCreateSchema>,
): Promise<ExpenseVersion> {
  const input = MonthlyExpenseCreateSchema.parse(raw)
  if (input.endsOn !== null && input.endsOn < input.startsOn) {
    throw new MonthlyExpenseInvalid('The last month is before the first.', ctx.storeId)
  }
  const id = newId()
  const [row] = await ctx.tx
    .insert(monthlyExpense)
    .values({
      id,
      seriesId: id,
      storeId: ctx.storeId,
      name: input.name,
      category: input.category,
      amountPaise: input.amountPaise,
      startsOn: toDate(input.startsOn),
      endsOn: input.endsOn ? toDate(input.endsOn) : null,
    })
    .returning()
  return versionOf(row as Row)
}

async function liveRow(ctx: StoreContext, id: string): Promise<Row> {
  const [row] = await ctx.tx
    .select()
    .from(monthlyExpense)
    .where(and(eq(monthlyExpense.id, id), isNull(monthlyExpense.archivedAt)))
  if (!row) throw new MonthlyExpenseNotFound(id, ctx.storeId)
  return row
}

/**
 * Change an expense from a month on (finance/monthly-expenses.ts planExpenseEdit): in place
 * from its first month or earlier, else the old version ends the month before and a new
 * version carries the new values. Returns the version that now holds them.
 */
export async function updateMonthlyExpense(
  ctx: StoreContext,
  raw: z.input<typeof MonthlyExpenseUpdateSchema>,
): Promise<ExpenseVersion> {
  const input = MonthlyExpenseUpdateSchema.parse(raw)
  const current = await liveRow(ctx, input.id)
  const plan = planExpenseEdit(versionOf(current), input)
  if (plan.kind === 'invalid') {
    throw new MonthlyExpenseInvalid(
      plan.reason === 'after_end'
        ? 'This expense had already ended by then.'
        : 'The last month is before the first.',
      ctx.storeId,
    )
  }
  const fields = {
    name: input.name,
    category: input.category,
    amountPaise: input.amountPaise,
    updatedAt: new Date(),
  }
  if (plan.kind === 'in_place') {
    const [row] = await ctx.tx
      .update(monthlyExpense)
      .set({ ...fields, endsOn: plan.endsOn ? toDate(plan.endsOn) : null })
      .where(eq(monthlyExpense.id, current.id))
      .returning()
    return versionOf(row as Row)
  }
  await ctx.tx
    .update(monthlyExpense)
    .set({ endsOn: toDate(plan.closeAt), updatedAt: new Date() })
    .where(eq(monthlyExpense.id, current.id))
  const [row] = await ctx.tx
    .insert(monthlyExpense)
    .values({
      storeId: ctx.storeId,
      seriesId: current.seriesId,
      ...fields,
      startsOn: toDate(plan.next.startsOn),
      endsOn: plan.next.endsOn ? toDate(plan.next.endsOn) : null,
    })
    .returning()
  return versionOf(row as Row)
}

/** Delete an expense entered by mistake: every version of it, so no month counts it. */
export async function deleteMonthlyExpense(
  ctx: StoreContext,
  raw: z.input<typeof MonthlyExpenseIdSchema>,
): Promise<void> {
  const { id } = MonthlyExpenseIdSchema.parse(raw)
  const current = await liveRow(ctx, id)
  await ctx.tx
    .update(monthlyExpense)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(monthlyExpense.seriesId, current.seriesId), isNull(monthlyExpense.archivedAt)))
}
