/**
 * Every admin action over MCP, as three tools: `searchActions` finds procedures in the admin
 * router, `describeAction` gives one's input schema and whether it will wait for approval, and
 * `runAction` calls it.
 *
 * A call runs as the member who connected the client, through the admin's own middleware
 * (`apiPrincipal` on the context): their role, capped to the grant's areas, decides. Reads run
 * at once; changes run with the member's role (a role's "Needs approval" tick queues them in
 * Approvals); sensitive actions always wait in AI approvals as a `runAdminAction`, even for the
 * owner, and run as the member who approves them. What counts as which, and what
 * is never offered, is `action-catalogue.ts`.
 */
import { siteConfig } from '@commerce/config/site'
import { API_AREAS, type ApiArea, recordApiActivity, recordApiRead } from '@commerce/core'
import { aiStoreFacts } from '@commerce/core/ai-runtime'
import { withStore } from '@commerce/db'
import { type AnyProcedure, call, ORPCError } from '@orpc/server'
import { z } from 'zod'
import { APPROVAL_QUEUED } from '../procedures'
import { appRouter } from '../routers/_app'
import { ProposalProblem } from '../services/ai/assistant/actions/resolve'
import { proposeAction } from '../services/ai/assistant/service'
import {
  type ActionKind,
  areaOf,
  classifyAction,
  describePath,
  exclusionReason,
  humanName,
  kindForInput,
  routerProcedures,
  sensitiveNote,
} from './action-catalogue'
import { DOWNLOAD_TTL_MS, downloadUrl } from './download-link'
import type { McpCallResult, McpEnv, McpTool } from './tools'

const brand = siteConfig.brand.name
const SEARCH_LIMIT = 20
/** Largest `input` a client may send, as JSON. */
const MAX_INPUT_CHARS = 32_000
/** Longest answer text; the rest is cut with a note. */
const MAX_RESULT_CHARS = 20_000
/** A call that takes longer answers with a timeout (it may still finish). */
const CALL_TIMEOUT_MS = 30_000

type Entry = {
  path: string
  kind: ActionKind
  area: ApiArea
  name: string
  description: string
  procedure: AnyProcedure
}

let cached: Map<string, Entry> | null = null

/** Every procedure a client may reach, by path, walked from the live router once. */
function adminActionCatalogue(): Map<string, Entry> {
  if (cached) return cached
  const entries = new Map<string, Entry>()
  for (const { path, procedure } of routerProcedures(appRouter)) {
    const kind = classifyAction(path)
    const area = areaOf(path)
    if (!kind || !area) continue
    const description = describePath(path)
    entries.set(path, { path, kind, area, name: humanName(path), description, procedure })
  }
  cached = entries
  return entries
}

const SearchInput = z.object({
  query: z.string().trim().max(200).default('').describe('Words to look for, e.g. "fulfil order".'),
  area: z.enum(API_AREAS).optional().describe('Only actions in this area.'),
})
const DescribeInput = z.object({
  path: z.string().max(120).describe('The action path from searchActions, e.g. orders.fulfil.'),
})
const RunInput = z.object({
  path: z.string().max(120).describe('The action path, e.g. orders.fulfil.'),
  input: z.unknown().optional().describe("The action's input, shaped by describeAction."),
})

/** The three tools, always listed: reads work even while changes are off. */
export function adminActionTools(env: McpEnv): McpTool[] {
  const changes = !env.settings.allowChanges
    ? 'Changes are off for this store, so only reads run.'
    : `Changes run at once with the member's role, unless their role needs approval for one (then it waits in Approvals in ${brand}). Sensitive ones (refunds, cancellations, deletes, payment, staff, billing and domain settings) always wait for a person in ${brand}.`
  return [
    {
      name: 'searchActions',
      description: `Find any action the ${brand} admin can do (orders, shipping, products, themes, settings…). Returns up to ${SEARCH_LIMIT} matches with their path, what they do, and whether each reads, changes or is sensitive. Use describeAction next, then runAction.`,
      input: SearchInput,
      readOnly: true,
    },
    {
      name: 'describeAction',
      description:
        "An action's input as JSON Schema, what it returns, and whether running it will wait for approval.",
      input: DescribeInput,
      readOnly: true,
    },
    {
      name: 'runAction',
      description: `Run one admin action by path, as the member who connected you and never beyond their role or this connection's areas. Reads answer at once. ${changes} Files come back as a download link.`,
      input: RunInput,
      readOnly: false,
    },
  ]
}

const fail = (text: string): McpCallResult => ({ text, data: null, isError: true })

/** What a client needs to know before running: will it wait, or is it blocked? */
function approvalOf(env: McpEnv, kind: ActionKind): 'no' | 'always' | 'blocked' {
  if (kind === 'read') return 'no'
  if (!env.settings.allowChanges) return 'blocked'
  if (kind === 'sensitive') return 'always'
  return 'no'
}

/** Null when the grant reaches this entry for this kind of call, else why not. */
function outsideGrant(env: McpEnv, entry: Entry, kind: ActionKind): string | null {
  const access = env.principal.scopes[entry.area]
  if (!access) return `This connection was not given access to ${entry.area.replace('_', ' ')}.`
  if (kind !== 'read' && access !== 'write')
    return `This connection can only read ${entry.area.replace('_', ' ')}.`
  return null
}

async function log(
  env: McpEnv,
  row: { kind: 'read' | 'blocked'; tool: string; summary: string; detail: string },
) {
  await withStore(env.db, env.principal.storeId, (tx) => {
    const input = { grantId: env.principal.grantId, ...row, at: env.now() }
    return row.kind === 'read'
      ? recordApiRead(tx, env.principal.storeId, input)
      : recordApiActivity(tx, env.principal.storeId, { ...input, kind: row.kind })
  })
}

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

function search(env: McpEnv, args: unknown): McpCallResult {
  const input = SearchInput.parse(args ?? {})
  const terms = words(input.query)
  const scored = [...adminActionCatalogue().values()]
    .filter((e) => env.principal.scopes[e.area] && (!input.area || e.area === input.area))
    .map((e) => {
      const name = words(`${e.path.replace(/([a-z])([A-Z])/g, '$1 $2')} ${e.name}`).join(' ')
      const about = e.description.toLowerCase()
      const score = terms.reduce(
        (sum, t) => sum + (name.includes(t) ? 3 : 0) + (about.includes(t) ? 1 : 0),
        0,
      )
      return { e, score }
    })
    .filter((s) => !terms.length || s.score > 0)
    .sort((a, b) => b.score - a.score || a.e.path.localeCompare(b.e.path))
    .slice(0, SEARCH_LIMIT)
  const actions = scored.map(({ e }) => ({
    path: e.path,
    description: e.description,
    kind: e.kind,
    area: e.area,
  }))
  const text = actions.length
    ? actions.map((a) => `${a.path} (${a.kind}, ${a.area}): ${a.description}`).join('\n')
    : 'No matching actions in the areas this connection can reach. Try other words.'
  return { text, data: { actions }, isError: false }
}

function describe(env: McpEnv, args: unknown): McpCallResult {
  const { path } = DescribeInput.parse(args ?? {})
  const entry = adminActionCatalogue().get(path)
  if (!entry) return fail(`There is no action called ${path}. Use searchActions to find one.`)
  const schema = entry.procedure['~orpc'].inputSchema
  const approval = approvalOf(env, entry.kind)
  const data = {
    path: entry.path,
    name: entry.name,
    description: entry.description,
    kind: entry.kind,
    area: entry.area,
    sensitive: sensitiveNote(entry.path),
    needsApproval: approval,
    reachable: outsideGrant(env, entry, entry.kind) ?? 'yes',
    inputSchema: schema
      ? z.toJSONSchema(schema as z.ZodType, { io: 'input', unrepresentable: 'any' })
      : null,
    output: `JSON. A file (label, invoice, export) comes back as a download link valid for ${DOWNLOAD_TTL_MS / 60_000} minutes.`,
  }
  const waits = {
    no: 'Runs at once.',
    yes: `Waits for approval in ${brand}.`,
    always: `Sensitive: always waits for approval in ${brand}.`,
    blocked: 'Changes are off for this store, so this will be refused.',
  }[approval]
  return { text: `${entry.name}: ${entry.description} ${waits}`, data, isError: false }
}

/** The procedure's answer as text a model can read, cut at the limit; files become a link. */
function shape(env: McpEnv, entry: Entry, input: unknown, output: unknown): McpCallResult {
  if (output instanceof Blob) {
    const name = output instanceof File ? output.name : 'file'
    const url =
      entry.kind === 'read' && env.origin
        ? downloadUrl(
            env.origin,
            env.principal.storeSlug,
            { g: env.principal.grantId, s: env.principal.storeId, p: entry.path, i: input },
            env.now(),
          )
        : null
    const file = { name, type: output.type, size: output.size, url }
    return {
      text: url
        ? `File ready: ${name}. Download it within ${DOWNLOAD_TTL_MS / 60_000} minutes: ${url}`
        : `Done. It produced the file ${name}; open it from the ${brand} admin.`,
      data: { file },
      isError: false,
    }
  }
  const json = output === undefined ? 'Done.' : JSON.stringify(output)
  if (json.length > MAX_RESULT_CHARS) {
    const rest = json.length - MAX_RESULT_CHARS
    return {
      text: `${json.slice(0, MAX_RESULT_CHARS)}\n… [truncated: ${rest} more characters. Ask for less (filters, a smaller page) to see the rest.]`,
      data: null,
      isError: false,
    }
  }
  const data = output && typeof output === 'object' && !Array.isArray(output) ? output : null
  return {
    text: json,
    data: data ?? (Array.isArray(output) ? { items: output } : null),
    isError: false,
  }
}

async function runNow(env: McpEnv, entry: Entry, input: unknown): Promise<McpCallResult> {
  if (!env.api) return fail('This server cannot run admin actions right now.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)
  const timedOut = new Promise<never>((_, reject) =>
    controller.signal.addEventListener('abort', () => reject(new Error('timeout'))),
  )
  try {
    const context = { ...env.api(), headers: new Headers(), apiPrincipal: env.principal }
    const output = await Promise.race([
      call(entry.procedure, input, {
        context,
        path: entry.path.split('.'),
        signal: controller.signal,
      }),
      timedOut,
    ])
    return shape(env, entry, input, output)
  } catch (err) {
    // The member's role needs approval for it: the store procedure queued it and logged it.
    if (err instanceof ORPCError && err.code === APPROVAL_QUEUED) {
      const id = (err.data as { approvalId?: string | null } | undefined)?.approvalId ?? null
      return {
        text: `Waiting for approval: ${entry.name}. The member's role needs approval for this, so it runs once a different member approves it in ${brand} (Settings → Approvals), and changes nothing until then.`,
        data: { id, status: 'proposed', path: entry.path },
        isError: false,
      }
    }
    const message =
      err instanceof ORPCError
        ? err.message
        : controller.signal.aborted
          ? `It took longer than ${CALL_TIMEOUT_MS / 1000} seconds. It may still finish; check before trying again.`
          : 'The action failed.'
    await log(env, {
      kind: 'blocked',
      tool: entry.path,
      summary: `${env.principal.name} tried ${entry.path} → refused`,
      detail: `${env.principal.userName} · ${message}`,
    })
    if (!(err instanceof ORPCError) && !controller.signal.aborted) throw err
    return fail(message)
  } finally {
    clearTimeout(timer)
  }
}

async function queue(env: McpEnv, entry: Entry, kind: ActionKind, input: unknown) {
  const p = env.principal
  return withStore(env.db, p.storeId, async (tx) => {
    const store = await aiStoreFacts(tx, p.storeId)
    const actionEnv = {
      tx,
      storeId: p.storeId,
      userId: p.userId,
      email: p.email,
      store,
      now: env.now(),
    }
    const view = await proposeAction(
      actionEnv,
      'runAdminAction',
      { path: entry.path, input },
      { flagged: false, source: 'mcp' },
    )
    await recordApiActivity(tx, p.storeId, {
      grantId: p.grantId,
      kind: 'approval',
      tool: entry.path,
      summary: `${p.name} asked to run ${entry.path} → waiting approval`,
      detail: `${p.userName} · ${kind === 'sensitive' ? 'sensitive, always needs approval' : `open AI approvals in ${brand} to approve it`}`,
      aiActionId: view.id,
      at: env.now(),
    })
    return {
      text: `Waiting for approval: ${entry.name}. It runs in ${brand} once the member approves it in AI approvals, and changes nothing until then.${kind === 'sensitive' ? ' Sensitive actions always wait for approval.' : ''}`,
      data: { id: view.id, status: view.status, path: entry.path },
      isError: false,
    }
  })
}

async function run(env: McpEnv, args: unknown): Promise<McpCallResult> {
  const { path, input } = RunInput.parse(args ?? {})
  const p = env.principal
  const entry = adminActionCatalogue().get(path)
  if (!entry) {
    await log(env, {
      kind: 'blocked',
      tool: path,
      summary: `${p.name} tried ${path} → not available`,
      detail: `${p.userName} · not available to MCP clients: ${exclusionReason(path) ?? 'no such action'}`,
    })
    return fail(`There is no action called ${path}. Use searchActions to find one.`)
  }
  const size = JSON.stringify(input ?? null).length
  if (size > MAX_INPUT_CHARS)
    return fail(`The input is too large (${size} characters, at most ${MAX_INPUT_CHARS}).`)
  const kind = kindForInput(path, input) ?? entry.kind
  const refusal =
    outsideGrant(env, entry, kind) ??
    (approvalOf(env, kind) === 'blocked'
      ? '"Allow AI clients to make changes" is off in Settings → MCP & API.'
      : null)
  if (refusal) {
    await log(env, {
      kind: 'blocked',
      tool: path,
      summary: `${p.name} tried ${path} → blocked`,
      detail: `${p.userName} · ${refusal}`,
    })
    return fail(refusal)
  }
  const schema = entry.procedure['~orpc'].inputSchema as z.ZodType | undefined
  const parsed = schema?.safeParse(input)
  if (parsed && !parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
    return fail(`The input does not fit ${path}: ${issues.join('; ')}. See describeAction.`)
  }
  const approval = approvalOf(env, kind)
  if (approval === 'no') return runNow(env, entry, input)
  try {
    return await queue(env, entry, kind, input)
  } catch (err) {
    if (err instanceof ProposalProblem) return fail(err.message)
    throw err
  }
}

/** `tools/call` for the three tools; null when `name` is not one of them. */
export async function callAdminActionTool(
  env: McpEnv,
  name: string,
  args: unknown,
): Promise<McpCallResult | null> {
  if (name !== 'searchActions' && name !== 'describeAction' && name !== 'runAction') return null
  try {
    if (name === 'runAction') return await run(env, args)
    const result = name === 'searchActions' ? search(env, args) : describe(env, args)
    await log(env, {
      kind: 'read',
      tool: name,
      summary: `${env.principal.name} ${name === 'searchActions' ? 'searched admin actions' : 'read how an admin action works'}`,
      detail: `${env.principal.userName} · read only`,
    })
    return result
  } catch (err) {
    if (err instanceof z.ZodError)
      return fail(err.issues.map((i) => `${i.path.join('.') || name}: ${i.message}`).join('; '))
    throw err
  }
}
