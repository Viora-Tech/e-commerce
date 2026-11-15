/**
 * SOURCE OF TRUTH: the AI's analytics query tool — WHAT `analyticsQuery`, which lets the
 * assistant and MCP clients answer any question about the store's numbers by writing one
 * custom query (Sidekick-style) / WHY one general tool instead of a lookup per question: the
 * model writes the query, our parser checks it, fixed SQL with bound values runs it read-only,
 * and the merchant sees the number, the table and the query that produced them.
 */
import { type AiToolSet, defineAiTool } from '@commerce/ai'
import { type QueryFieldType, queryLanguageReference } from '@commerce/core/analytics-query'
import { z } from 'zod'
import { runCustomQuery } from '../analytics-query.service'
import type { CustomerNames } from '../analytics-query-sql'
import { type AnswerColumn, answerTable } from './answer-table'
import { type Fact, money, read, safeTitle, type ToolEnv } from './store-tools'

/** Rows the model reads as facts; the merchant sees up to the table's own limit. */
const FACT_ROWS = 25

const MONEY = new Set<QueryFieldType>(['money'])
const SERIES = new Set(['day', 'week', 'month', 'year'])

const ANALYTICS_QUERY_DESCRIPTION = [
  "Answers any question about the store's numbers by running one read-only query: units sold of a product or variant, sales and orders by day, week, month or year, by channel, source, state, payment method, discount code or customer, refunds and returns, comparisons with the period or year before, over any range up to all time.",
  'Use it for every question about numbers, history or trends, especially when the merchant names a product, variant, collection, vendor, channel or customer, says "all time" or "ever", or asks for a range the other tools do not offer.',
  'Write the query in the language below. If the result is a query problem, fix the query and call again. The merchant sees the table and the query under your answer: lead with the number, say the dates it covers, do not repeat every row.',
  '',
  queryLanguageReference(),
].join('\n')

const cellText = (env: ToolEnv, type: QueryFieldType | undefined, v: unknown): string => {
  if (v == null) return 'none'
  if (typeof v === 'number')
    return type && MONEY.has(type) ? money(env, v) : v.toLocaleString('en-IN')
  return safeTitle(env, String(v)) || '(none)'
}

/** `analyticsQuery`; customer names show as first names, or not at all without customer access. */
export function queryTools(env: ToolEnv, opts: { readCustomers: boolean }): AiToolSet {
  const customerNames: CustomerNames = opts.readCustomers ? 'first' : 'hidden'
  return {
    analyticsQuery: defineAiTool({
      description: ANALYTICS_QUERY_DESCRIPTION,
      input: z.object({
        query: z
          .string()
          .min(1)
          .max(4000)
          .describe('One query, one clause per line, e.g. FROM products SHOW net_quantity …'),
      }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx) => {
          const out = await runCustomQuery(tx, input.query, { now: env.now(), customerNames })
          if (!out.ok) {
            const hint = out.error.suggestion ? ` Did you mean ${out.error.suggestion}?` : ''
            return {
              facts: [
                {
                  label: 'Query problem',
                  value: `Line ${out.error.line}: ${out.error.message}${hint} Fix the query and call analyticsQuery again.`,
                },
              ],
            }
          }
          const { report, result, days } = out
          const types = new Map(report.columns.map((c) => [c.id, c.kind]))
          const fieldType = (id: string): QueryFieldType | undefined =>
            types.get(id) === 'money' ? 'money' : undefined
          const dims = report.columns.filter((c) => !(c.id in result.totals)).map((c) => c.id)
          const metrics = Object.keys(result.totals)
          const prev = result.previousTotals
          const allTime = /DURING all_time/.test(out.query)
          // Totals cover every row WHERE keeps, also the groups HAVING drops: say so.
          const beforeHaving = /^\s*HAVING /m.test(out.query) ? ' (all groups, before HAVING)' : ''
          const facts: Fact[] = [
            { label: 'Query', value: out.query },
            {
              label: 'Dates covered',
              value: `${days.from} to ${days.to}${allTime ? " (all time, from the store's first order)" : ''}${result.previousRange ? `; compared with ${result.previousRange.from} to ${result.previousRange.to}` : ''}`,
            },
            ...metrics.map((m) => ({
              label: `Total ${m}${beforeHaving}`,
              value: `${cellText(env, fieldType(m), result.totals[m])}${prev ? ` (before: ${cellText(env, fieldType(m), prev[m])})` : ''}`,
            })),
          ]
          if (dims.length) {
            facts.push({ label: 'Rows', value: String(result.rows.length) })
            for (const row of result.rows.slice(0, FACT_ROWS)) {
              facts.push({
                label: dims.map((d) => cellText(env, undefined, row.values[d])).join(' · '),
                value: metrics
                  .map((m) => `${m} ${cellText(env, fieldType(m), row.values[m])}`)
                  .join(', '),
              })
            }
            if (result.rows.length > FACT_ROWS) {
              facts.push({
                label: 'More rows',
                value: `${result.rows.length - FACT_ROWS} more in the table the merchant sees`,
              })
            }
          }
          const columns: AnswerColumn[] = report.columns.map((c) => ({ id: c.id, kind: c.kind }))
          const x = dims[0]
          const y = report.metric
          const table = answerTable({
            columns,
            rows: result.rows.map((r) => ({
              key: r.key,
              values: Object.fromEntries(
                columns.map((c) => {
                  const v = r.values[c.id]
                  return [c.id, typeof v === 'string' ? safeTitle(env, v) : (v ?? null)]
                }),
              ),
            })),
            chart: x && dims.length === 1 ? { kind: SERIES.has(x) ? 'line' : 'bar', x, y } : null,
            query: out.query,
            range: days,
          })
          // First names only (as orderDetails shares them), and the answer says it used them.
          const shared = out.query.includes('customer_name') ? ['customer first names'] : []
          return { facts, table, ...(shared.length ? { shared } : {}) }
        }),
    }),
  }
}
