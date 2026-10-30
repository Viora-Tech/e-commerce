/**
 * The AI assistant (the admin's AI bar): a message in, a streamed answer out. The model may
 * look things up with read tools and draft changes with propose tools; each tool is offered
 * only when the member's role holds its permission. A propose tool stores a proposal and the
 * browser gets a `proposal` event with the card; nothing changes until the merchant approves
 * it (`service.ts`). Errors become one plain `error` event; prompts are never logged.
 */

import { randomUUID } from 'node:crypto'
import {
  type AiMessage,
  type AiToolSet,
  ASSISTANT_LIMITS,
  type AssistantLanguage,
  type AssistantPageContext,
  assistantInstructions,
  defineAiTool,
  fitOutline,
  streamAnswer,
  ThemeEditInput,
  type ThemeEditRequest,
  type ThemeEditView,
  type ThemeOutline,
  themeOutlineForPrompt,
  validateThemeEdits,
} from '@commerce/ai'
import { permissions } from '@commerce/core'
import { formatInZone } from '@commerce/dates'
import { withStore } from '@commerce/db'
import { z } from 'zod'
import { type AnswerTable, type CallInput, callInputs, detachTable } from '../answer-table'
import { type AiCallContext, finishAiCall, type StartedAiCall, startAiCall } from '../guard'
import { type Fact, storeTools, type ToolEnv } from '../store-tools'
import { ProposalProblem } from './actions/resolve'
import { type FoundImage, findImages } from './find-images'
import { pageLine } from './page-context'
import { readTools } from './read-tools'
import { ACTIONS, READ_TOOL_PERMISSION } from './registry'
import { proposeAction } from './service'
import { freshTaint, type Taint } from './taint'
import type { ActionView } from './views'

export type AssistantInput = {
  message: string
  history: AiMessage[]
  page: AssistantPageContext
  language: AssistantLanguage
  /** The theme editor's outline of the open page; only with `page.page === 'theme-editor'`. */
  theme?: ThemeOutline | undefined
}

export type AssistantEvent =
  | { type: 'text'; delta: string }
  | {
      type: 'source'
      id: string
      tool: string
      status: 'running' | 'done' | 'failed'
      facts: Fact[]
      /** Personal details the tool sent to the AI (only `orderDetails`: a first name). */
      shared: string[]
      /** What the model asked the tool, for "Show query". */
      inputs: CallInput[]
      /** The tool's rows, straight from the tool (never written by the model). */
      table: AnswerTable | null
    }
  | { type: 'proposal'; action: ActionView }
  /** A drafted theme edit for the open editor page; the browser applies it, the API never writes it. */
  | { type: 'themeEdit'; edit: ThemeEditView }
  | { type: 'error'; message: string }
  | { type: 'done' }

type Session = AiCallContext & { email: string }

/** One read tool call: what it was asked and the table it kept back from the model. */
type ReadCall = { input: unknown; table: AnswerTable | null }

const FAILED = 'Sorry, I could not answer that just now. Please try again in a moment.'

function factsOf(output: unknown): { facts: Fact[]; shared: string[] } {
  const value = output as { facts?: unknown; shared?: unknown } | null
  const facts = Array.isArray(value?.facts)
    ? value.facts.filter(
        (f): f is Fact => typeof f?.label === 'string' && typeof f?.value === 'string',
      )
    : []
  const shared = Array.isArray(value?.shared)
    ? value.shared.filter((s) => typeof s === 'string')
    : []
  return { facts, shared }
}

/**
 * A read tool whose table goes to the admin, not the model: the output keeps its facts and a
 * `ref` to find the call again in the answer's events.
 */
function keepingTables(tools: AiToolSet, calls: Map<string, ReadCall>): AiToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [
      name,
      {
        ...t,
        run: async (input: unknown, runtime: Parameters<typeof t.run>[1]) => {
          const ref = randomUUID().slice(0, 8)
          const { modelOutput, table } = detachTable(await t.run(input, runtime), ref)
          calls.set(ref, { input, table })
          return modelOutput
        },
      },
    ]),
  )
}

/** The member's tools: read tools and propose tools their role allows. */
function toolsFor(
  context: Session,
  call: StartedAiCall,
  taint: Taint,
  proposals: Map<string, ActionView>,
  calls: Map<string, ReadCall>,
): AiToolSet {
  const env: ToolEnv = { db: context.db, store: call.store, now: () => new Date(), taint }
  const reads = { ...storeTools(env), ...readTools(env) }
  const allowedReads = Object.fromEntries(
    Object.entries(reads).filter(([name]) => {
      const permission = READ_TOOL_PERMISSION[name]
      return permission ? context.scope.can(permission) : false
    }),
  )
  const proposes = Object.fromEntries(
    Object.values(ACTIONS)
      .filter((action) => context.scope.can(action.permission))
      .map((action) => [
        action.tool,
        defineAiTool({
          description: action.description,
          input: action.input,
          risk: 'propose',
          run: async (input, runtime) => {
            if (taint.proposals >= ASSISTANT_LIMITS.maxProposalsPerTurn) {
              return {
                error: `At most ${ASSISTANT_LIMITS.maxProposalsPerTurn} changes per message.`,
              }
            }
            try {
              const view = await withStore(context.db, runtime.storeId, (tx) =>
                proposeAction(
                  {
                    tx,
                    storeId: runtime.storeId,
                    userId: runtime.userId,
                    email: context.email,
                    store: call.store,
                    now: new Date(),
                  },
                  action.tool,
                  input,
                  { flagged: taint.flagged },
                ),
              )
              taint.proposals += 1
              proposals.set(view.id, view)
              return { proposal: { id: view.id, summary: view.summary } }
            } catch (err) {
              if (err instanceof ProposalProblem) return { error: err.message }
              throw err
            }
          },
        }),
      ]),
  )
  return { ...keepingTables(allowedReads, calls), ...proposes }
}

const SectionSettingsInput = z.object({
  sectionId: z.string().min(1).max(120).describe('The section id, exactly as in the page outline.'),
})

const FindImagesInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe(
      'A product or collection name, or a word in it, e.g. "Dysphoria Maki" or "glasspad".',
    ),
})

/**
 * The theme editor's tools: `findImages` looks up the store's own pictures and links, and
 * `proposeThemeEdit` checks an edit against this message's outline and drafts it.
 */
function themeEditTool(
  outline: ThemeOutline,
  taint: Taint,
  edits: Map<string, ThemeEditView>,
  lookup: (query: string) => Promise<FoundImage[]>,
): AiToolSet {
  return {
    sectionSettings: defineAiTool({
      description:
        'Read one section of the open page in full: all its settings and its blocks with their current values. Use it when the page outline is partial and a section you need to change shows no settings there.',
      input: SectionSettingsInput,
      risk: 'read',
      run: async (input: z.infer<typeof SectionSettingsInput>) => {
        const section = outline.sections.find((s) => s.id === input.sectionId)
        if (!section) return { error: `No section "${input.sectionId}" on this page.` }
        // Page text goes through the same guard as the outline in the prompt.
        const one = themeOutlineForPrompt({ ...outline, partial: false, sections: [section] })
        if (one.flagged) taint.flagged = true
        return { section: JSON.parse(one.text).sections[0] }
      },
    }),
    findImages: defineAiTool({
      description:
        "Find the store's products and collections by name, each with its main picture (imageUrl) and its storefront link. Use the imageUrl for an image setting and the link for a button or url setting in proposeThemeEdit.",
      input: FindImagesInput,
      risk: 'read',
      run: async (input: z.infer<typeof FindImagesInput>) => {
        const found = await lookup(input.query)
        return found.length ? { results: found } : { results: [], note: 'Nothing by that name.' }
      },
    }),
    proposeThemeEdit: defineAiTool({
      description:
        'Draft a change to settings of sections or blocks on the page open in the theme editor (text, links, checkboxes, numbers, choices). Use the ids and setting keys from the page outline. Nothing changes until the merchant applies it in the editor.',
      input: ThemeEditInput,
      risk: 'propose',
      run: async (input: ThemeEditRequest) => {
        if (taint.proposals >= ASSISTANT_LIMITS.maxProposalsPerTurn) {
          return { error: `At most ${ASSISTANT_LIMITS.maxProposalsPerTurn} changes per message.` }
        }
        const checked = validateThemeEdits(outline, input)
        if (!checked.ok) return { error: checked.error }
        const view: ThemeEditView = {
          id: randomUUID(),
          summary: input.summary,
          changes: checked.changes,
          flagged: taint.flagged,
        }
        taint.proposals += 1
        edits.set(view.id, view)
        return { themeEdit: { id: view.id, summary: view.summary } }
      },
    }),
  }
}

/** Starts the call (gate, quota, metering) before the first byte, then streams the answer. */
export async function runAssistant(
  context: Session,
  input: AssistantInput,
  signal?: AbortSignal,
): Promise<AsyncGenerator<AssistantEvent>> {
  const call = await startAiCall(context, 'assistant')
  const taint = freshTaint()
  const proposals = new Map<string, ActionView>()
  const themeEdits = new Map<string, ThemeEditView>()
  const calls = new Map<string, ReadCall>()
  const outline = input.page.page === 'theme-editor' ? input.theme : undefined
  const canEditTheme = Boolean(outline) && context.scope.can(permissions.ONLINE_STORE_WRITE)
  const tools = {
    ...toolsFor(context, call, taint, proposals, calls),
    ...(outline && canEditTheme
      ? themeEditTool(outline, taint, themeEdits, (query) =>
          withStore(context.db, call.runtime.storeId, (tx) => findImages(tx, query)),
        )
      : {}),
  }
  // The prompt gets the page cut to size; the whole outline stays for checks and sectionSettings.
  const guarded = outline ? themeOutlineForPrompt(fitOutline(outline)) : null
  // Page text that read like orders to the AI was hidden; later proposals carry the warning.
  if (guarded?.flagged) taint.flagged = true
  const page = await withStore(context.db, call.runtime.storeId, (tx) => pageLine(tx, input.page))
  const today = formatInZone(
    new Date(),
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    { timeZone: call.store.timezone },
  )
  const events = streamAnswer({
    runtime: call.runtime,
    model: call.model,
    instructions: assistantInstructions({
      storeName: call.store.name,
      today,
      language: input.language,
      page,
      canPropose: Object.keys(tools).filter((name) => name in ACTIONS),
      themeEditor: guarded ? { outline: guarded.text, canEdit: canEditTheme } : undefined,
    }),
    messages: [...input.history, { role: 'user', content: input.message }],
    tools,
    abortSignal: signal,
    onUsage: (usage) => finishAiCall(context.db, call, usage),
  })
  return (async function* () {
    try {
      for await (const event of events) {
        if (event.type === 'text') yield { type: 'text', delta: event.delta }
        else if (event.type === 'tool') {
          const proposalId = (event.output as { proposal?: { id?: string } } | null)?.proposal?.id
          const view = proposalId ? proposals.get(proposalId) : undefined
          if (view && event.status === 'done') {
            yield { type: 'proposal', action: view }
            continue
          }
          const editId = (event.output as { themeEdit?: { id?: string } } | null)?.themeEdit?.id
          const edit = editId ? themeEdits.get(editId) : undefined
          if (edit && event.status === 'done') {
            yield { type: 'themeEdit', edit }
            continue
          }
          if (event.name in ACTIONS || event.name === 'proposeThemeEdit') continue
          const { facts, shared } =
            event.status === 'done' ? factsOf(event.output) : { facts: [], shared: [] }
          const ref = (event.output as { ref?: unknown } | null)?.ref
          const read = typeof ref === 'string' ? calls.get(ref) : undefined
          yield {
            type: 'source',
            id: event.id,
            tool: event.name,
            status: event.status,
            facts,
            shared,
            inputs: callInputs(read?.input),
            table: event.status === 'done' ? (read?.table ?? null) : null,
          }
        } else if (event.type === 'error') yield { type: 'error', message: FAILED }
      }
      yield { type: 'done' }
    } catch {
      yield { type: 'error', message: FAILED }
    }
  })()
}
