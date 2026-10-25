import {
  createMonthlyExpense,
  deleteMonthlyExpense,
  expensesForMonth,
  feeGstClaimable,
  listMonthlyExpenses,
  MonthlyExpenseCreateSchema,
  MonthlyExpenseIdSchema,
  MonthlyExpenseUpdateSchema,
  monthOf,
  permissions,
  updateMonthlyExpense,
} from '@commerce/core'
import { dayKey } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { can } from '../procedures'

type Ctx = { scope: { storeId: string }; tx: StoreTx }
const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

/** Settings › Monthly expenses: the store's running costs, taken off order profit for net profit. */
export const monthlyExpensesRouter = {
  /** Every expense (each version of it), and what this month carries so far. */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const expenses = await listMonthlyExpenses(ctxOf(context))
    const today = dayKey(new Date())
    const month = monthOf(today)
    const days = Array.from(
      { length: Number(today.slice(8, 10)) },
      (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
    )
    return {
      expenses,
      today,
      thisMonth: expensesForMonth(expenses, month, { days, today }),
      /** Amounts are typed before GST (claimed back) rather than as paid. */
      gstClaimable: await feeGstClaimable(context.tx, context.scope.storeId),
    }
  }),
  /** Add a monthly expense from a month on (one-off: its last month is its first). */
  create: can(permissions.SETTINGS_MANAGE)
    .input(MonthlyExpenseCreateSchema)
    .handler(({ context, input }) => createMonthlyExpense(ctxOf(context), input)),
  /** Change an expense from a month on; earlier months keep what they had. */
  update: can(permissions.SETTINGS_MANAGE)
    .input(MonthlyExpenseUpdateSchema)
    .handler(({ context, input }) => updateMonthlyExpense(ctxOf(context), input)),
  /** Delete an expense entered by mistake: it no longer counts in any month. */
  delete: can(permissions.SETTINGS_MANAGE)
    .input(MonthlyExpenseIdSchema)
    .handler(({ context, input }) => deleteMonthlyExpense(ctxOf(context), input)),
}
