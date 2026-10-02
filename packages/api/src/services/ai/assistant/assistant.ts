/**
 * The AI assistant (the admin's AI bar): a message in, a streamed answer out. The model may
 * look things up with read tools and draft changes with propose tools; each tool is offered
 * only when the member's role holds its permission. A propose tool stores a proposal and the
 * browser gets a `proposal` event with the card; nothing changes until the merchant approves
 * it (`service.ts`). Errors become one plain `error` event; prompts are never logged.
 */
import {
  type AiMessage,
  type AiToolSet,
  ASSISTANT_LIMITS,
  type AssistantLanguage,
  type AssistantPageContext,
  assistantInstructions,
  defineAiTool,
  streamAnswer,
} from '@commerce/ai'
import { formatInZone } from '@commerce/dates'
import { withStore } from '@commerce/db'
import { type AiCallContext, finishAiCall, type StartedAiCall, startAiCall } from '../guard'
import { type Fact, storeTools, type ToolEnv } from '../store-tools'
import { ProposalProblem } from './actions/resolve'
import { pageLine } from './page-context'
import { readTools } from './read-tools'
import { ACTIONS, READ_TOOL_PERMISSION } from './registry'
import { type ActionView, proposeAction } from './service'
import { freshTaint, type Taint } from './taint'

export type AssistantInput = {
  message: string
  history: AiMessage[]
  page: AssistantPageContext
  language: AssistantLanguage
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
    }
  | { type: 'proposal'; action: ActionView }
  | { type: 'error'; message: string }
  | { type: 'done' }

type Session = AiCallContext & { email: string }

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

/** The member's tools: read tools and propose tools their role allows. */
function toolsFor(
  context: Session,
  call: StartedAiCall,
  taint: Taint,
  proposals: Map<string, ActionView>,
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
  return { ...allowedReads, ...proposes }
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
  const tools = toolsFor(context, call, taint, proposals)
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
          if (event.name in ACTIONS) continue
          const { facts, shared } =
            event.status === 'done' ? factsOf(event.output) : { facts: [], shared: [] }
          yield {
            type: 'source',
            id: event.id,
            tool: event.name,
            status: event.status,
            facts,
            shared,
          }
        } else if (event.type === 'error') yield { type: 'error', message: FAILED }
      }
      yield { type: 'done' }
    } catch {
      yield { type: 'error', message: FAILED }
    }
  })()
}
