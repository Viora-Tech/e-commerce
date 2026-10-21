/**
 * The tools an MCP client sees: the AI assistant's own read tools and change proposals
 * (`services/ai/assistant`), filtered to what the grant and the member's role allow, plus
 * `customerDetails`, which only answers while "Let clients read customer details" is on, plus
 * `searchActions` / `describeAction` / `runAction`, which reach every other admin action
 * (`admin-actions.ts`).
 *
 * Reads run straight away. A change is proposed exactly as the AI bar proposes it: it waits in
 * AI approvals for the member who connected the client, or runs at once when "Changes need
 * approval" is off. Every call leaves a row in Settings → MCP & API → Activity.
 */
import type { AiRuntime, AiTool, AiToolSet } from '@commerce/ai'
import { settingsSecret } from '@commerce/config'
import { siteConfig } from '@commerce/config/site'
import {
  type ApiPrincipal,
  type McpSettings,
  permissions,
  recordApiActivity,
  recordApiRead,
} from '@commerce/core'
import { aiStoreFacts } from '@commerce/core/ai-runtime'
import { type Db, withStore } from '@commerce/db'
import { z } from 'zod'
import type { ApiContext } from '../context'
import type { StoreScope } from '../procedures'
import { ProposalProblem } from '../services/ai/assistant/actions/resolve'
import { readTools } from '../services/ai/assistant/read-tools'
import { ACTIONS, READ_TOOL_PERMISSION } from '../services/ai/assistant/registry'
import { approveAction, proposeAction } from '../services/ai/assistant/service'
import { freshTaint } from '../services/ai/assistant/taint'
import { type Fact, storeTools, type ToolEnv } from '../services/ai/store-tools'
import { findCustomerForMcp } from '../services/mcp.service'
import { adminActionTools, callAdminActionTool } from './admin-actions'

/** How a read reads in the activity log: "Claude read sales". */
const READ_LABELS: Record<string, string> = {
  salesSummary: 'read sales',
  topProducts: 'read top products',
  abandonedCheckouts: 'read abandoned checkouts',
  pendingOrders: 'read orders waiting to ship',
  orderDetails: 'read an order',
  lowStock: 'read low stock',
  findProducts: 'looked up products',
  productDetails: 'read a product',
  listCollections: 'read collections',
  customerDetails: 'read customer details',
}

export type McpTool = {
  name: string
  description: string
  input: z.ZodType
  readOnly: boolean
}

export type McpCallResult = { text: string; data: unknown; isError: boolean }

/** What `runAction` calls admin procedures with, minus the request and the caller. */
export type McpApiHost = () => Omit<ApiContext, 'headers' | 'apiPrincipal'>

export type McpEnv = {
  db: Db
  principal: ApiPrincipal
  settings: McpSettings
  now: () => Date
  /** The admin's public origin, for download links. */
  origin?: string | undefined
  /** Absent: `runAction` cannot call admin procedures (it says so). */
  api?: McpApiHost | undefined
}

const textOf = (facts: Fact[]): string => facts.map((f) => `${f.label}: ${f.value}`).join('\n')

const factsOf = (output: unknown): Fact[] | null => {
  const facts = (output as { facts?: unknown } | null)?.facts
  return Array.isArray(facts) ? (facts as Fact[]) : null
}

const can = (env: McpEnv, permission: string) =>
  env.principal.permissions.includes(permission as never)

const customerDetailsInput = z.object({
  email: z.string().email().max(200).optional(),
  order: z.number().int().positive().optional(),
})

/**
 * Name, email and phone for one customer, by email or by an order number. Answers only while
 * the store allows AI clients to read customer details.
 */
function customerDetailsTool(env: McpEnv): AiTool {
  return {
    description:
      'Look up one customer by email or by an order number: name, email, phone and how many orders they placed. Only works when the store allows AI clients to read customer details.',
    input: customerDetailsInput,
    risk: 'read',
    run: async (raw) => {
      const input = customerDetailsInput.parse(raw)
      if (!input.email && !input.order)
        return { facts: [{ label: 'Customer', value: 'give an email or an order number' }] }
      const found = await withStore(env.db, env.principal.storeId, (tx) =>
        findCustomerForMcp(tx, input, settingsSecret()),
      )
      if (!found) return { facts: [{ label: 'Customer', value: 'not found' }] }
      return {
        facts: [
          { label: 'Name', value: found.name ?? '—' },
          { label: 'Email', value: found.email ?? '—' },
          { label: 'Phone', value: found.phone ?? '—' },
          { label: 'Orders', value: String(found.orders) },
          ...(found.lastOrder ? [{ label: 'Last order', value: `#${found.lastOrder}` }] : []),
        ],
        shared: ['customer name, email and phone'],
      }
    },
  }
}

/** Read tools this grant may call, by name. */
function readToolsFor(env: McpEnv, toolEnv: ToolEnv): AiToolSet {
  const all: AiToolSet = { ...storeTools(toolEnv), ...readTools(toolEnv) }
  const allowed = Object.fromEntries(
    Object.entries(all).filter(([name]) => {
      const permission = READ_TOOL_PERMISSION[name]
      return permission ? can(env, permission) : false
    }),
  )
  if (can(env, permissions.CUSTOMERS_READ)) allowed.customerDetails = customerDetailsTool(env)
  return allowed
}

/** What `tools/list` answers. Change tools appear only while "Allow AI clients to make changes" is on. */
export function listMcpTools(env: McpEnv, toolEnv: ToolEnv): McpTool[] {
  const reads = Object.entries(readToolsFor(env, toolEnv)).map(([name, t]) => ({
    name,
    description: t.description,
    input: t.input,
    readOnly: true,
  }))
  const actions = adminActionTools(env)
  if (!env.settings.allowChanges) return [...reads, ...actions]
  const changes = Object.values(ACTIONS)
    .filter((a) => can(env, a.permission))
    .map((a) => ({
      name: a.tool,
      description: env.settings.requireApproval
        ? `${a.description} The change waits for the store's approval in ${siteConfig.brand.name} before it happens.`
        : a.description,
      input: a.input,
      readOnly: false,
    }))
  return [...reads, ...changes, ...actions]
}

/** A member scope for approving at once (`requireApproval` off): the grant's own permissions. */
function grantScope(p: ApiPrincipal): StoreScope {
  return {
    storeId: p.storeId,
    organizationId: p.organizationId,
    role: 'member',
    userId: p.userId,
    roleId: '',
    roleSlug: 'api',
    roleName: p.name,
    isOwner: false,
    permissions: p.permissions,
    can: (permission) => p.permissions.includes(permission),
  }
}

async function blocked(env: McpEnv, tool: string, summary: string, detail: string) {
  await withStore(env.db, env.principal.storeId, (tx) =>
    recordApiActivity(tx, env.principal.storeId, {
      grantId: env.principal.grantId,
      kind: 'blocked',
      tool,
      summary,
      detail,
      at: env.now(),
    }),
  )
  return { text: detail, data: null, isError: true }
}

/** `tools/call`: runs one tool for the grant, logging it. */
export async function callMcpTool(
  env: McpEnv,
  name: string,
  args: unknown,
): Promise<McpCallResult> {
  const generic = await callAdminActionTool(env, name, args)
  if (generic) return generic
  const p = env.principal
  const store = await withStore(env.db, p.storeId, (tx) => aiStoreFacts(tx, p.storeId))
  const taint = freshTaint()
  const toolEnv: ToolEnv = { db: env.db, store, now: env.now, taint }
  const runtime: AiRuntime = {
    storeId: p.storeId,
    userId: p.userId,
    plan: 'growth',
    feature: 'assistant',
  }

  if (name === 'customerDetails' && !env.settings.readCustomers) {
    return blocked(
      env,
      name,
      `${p.name} tried to read customer details → blocked`,
      '"Let clients read customer details" is off in Settings → MCP & API.',
    )
  }

  const reads = readToolsFor(env, toolEnv)
  const read = reads[name]
  if (read) {
    const parsed = read.input.safeParse(args ?? {})
    if (!parsed.success)
      return {
        text: parsed.error.issues.map((i) => i.message).join('. '),
        data: null,
        isError: true,
      }
    const output = await read.run(parsed.data, runtime)
    await withStore(env.db, p.storeId, (tx) =>
      recordApiRead(tx, p.storeId, {
        grantId: p.grantId,
        tool: name,
        summary: `${p.name} ${READ_LABELS[name] ?? `used ${name}`}`,
        detail: `${p.userName} · read only`,
        at: env.now(),
      }),
    )
    const facts = factsOf(output)
    return { text: facts ? textOf(facts) : JSON.stringify(output), data: output, isError: false }
  }

  const action = ACTIONS[name]
  if (!action || !can(env, action.permission)) {
    return {
      text: `There is no tool called ${name} for this connection.`,
      data: null,
      isError: true,
    }
  }
  if (!env.settings.allowChanges) {
    return blocked(
      env,
      name,
      `${p.name} tried to make a change → blocked`,
      '"Allow AI clients to make changes" is off in Settings → MCP & API.',
    )
  }

  try {
    return await withStore(env.db, p.storeId, async (tx) => {
      const actionEnv = {
        tx,
        storeId: p.storeId,
        userId: p.userId,
        email: p.email,
        store,
        now: env.now(),
      }
      const view = await proposeAction(actionEnv, name, args ?? {}, {
        flagged: taint.flagged,
        source: 'mcp',
      })
      if (!env.settings.requireApproval) {
        const done = await approveAction(actionEnv, grantScope(p), view.id)
        const ok = done.status === 'executed'
        await recordApiActivity(tx, p.storeId, {
          grantId: p.grantId,
          kind: ok ? 'change' : 'blocked',
          tool: name,
          summary: `${p.name}: ${ok ? (done.message ?? done.summary) : done.summary}`,
          detail: ok
            ? `${p.userName} · ran without approval`
            : (done.error ?? 'Nothing was changed'),
          aiActionId: done.id,
          at: env.now(),
        })
        return {
          text: ok ? (done.message ?? 'Done.') : (done.error ?? 'The change could not be made.'),
          data: { id: done.id, status: done.status },
          isError: !ok,
        }
      }
      await recordApiActivity(tx, p.storeId, {
        grantId: p.grantId,
        kind: 'approval',
        tool: name,
        summary: `${p.name} proposed: ${view.summary} → waiting approval`,
        detail: `${p.userName} · open AI approvals in ${siteConfig.brand.name} to approve it`,
        aiActionId: view.id,
        at: env.now(),
      })
      return {
        text: `Proposed: ${view.summary}. It waits for approval in ${siteConfig.brand.name} (AI approvals) and changes nothing until then.`,
        data: { id: view.id, status: view.status, preview: view.preview },
        isError: false,
      }
    })
  } catch (err) {
    if (err instanceof ProposalProblem) return { text: err.message, data: null, isError: true }
    if (err instanceof z.ZodError)
      return { text: err.issues.map((i) => i.message).join('. '), data: null, isError: true }
    throw err
  }
}
