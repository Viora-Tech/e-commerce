/**
 * One assistant action = one slice: a `propose` tool the model calls (validates, resolves names
 * to the store's own rows under RLS, builds the preview card) and an `execute` step that runs
 * only after the merchant approves, through the same core services the admin pages use, with
 * the approving member's permission. `undo` reverses it where that is cheap. Adding an action
 * is a new file in this folder plus a line in `../registry.ts` (developer docs, AI assistant).
 */
import type { Permission } from '@commerce/core'
import type { AiStoreFacts } from '@commerce/core/ai-runtime'
import type { StoreTx } from '@commerce/db'
import type { z } from 'zod'
import type { ApiContext } from '../../../../context'

/** What every step runs with: the caller's store transaction (RLS) and who they are. */
export type ActionEnv = {
  tx: StoreTx
  storeId: string
  userId: string
  /** The approving member's email, for timelines (order notes). */
  email: string
  store: AiStoreFacts
  now: Date
  /**
   * The approving member's own request (approve in the admin), so `runAdminAction` can call the
   * admin procedure as them. Absent when nobody is signed in (an MCP call).
   */
  api?: ApiContext | undefined
}

/** One before/after row on the card ("Glide Mouse: ₹1,999 → ₹2,099"). */
export type PreviewRow = { label: string; before: string; after: string }

/** The card the merchant approves: a title, key facts, the change rows, and what Undo can do. */
export type ActionPreview = {
  title: string
  lines: { label: string; value: string }[]
  rows: PreviewRow[]
  /** Rows beyond those shown. */
  more: number
  /** Products, variants or orders the action touches. */
  count: number
  /**
   * Undo is available after it runs; `null` when the card cannot tell (an admin action run for
   * an MCP client or a role's approval), so it neither promises Undo nor says "cannot be undone".
   */
  undoable: boolean | null
  /** Things to check before approving (in plain words). */
  notes: string[]
}

/** A field the merchant may change before approving (Edit on the card). */
export type EditField = {
  key: string
  kind: 'text' | 'textarea' | 'number' | 'date'
  value: string | number | null
}

export type Proposal<Resolved> = {
  /** One plain line, e.g. "Create discount DIWALI10: 10% off collection Mice". */
  summary: string
  preview: ActionPreview
  /** What `execute` runs with: the store's own ids, resolved now. */
  resolved: Resolved
}

export type Executed = {
  /** Shown on the card and in Activity once it ran, e.g. "Discount DIWALI10 created". */
  message: string
  /** Admin link to what changed, e.g. `/discounts/<id>`. */
  href: string | null
  result: Record<string, unknown>
  /** What `undo` needs; null when there is nothing to undo. */
  undo: unknown
}

export type ActionDefinition<Raw = unknown, Resolved = unknown> = {
  /** The tool name the model sees, e.g. `proposeDiscount`. */
  tool: string
  /**
   * Checked when the tool is offered, when it is approved and when it is undone. Null only for
   * `runAdminAction`, whose admin procedure checks the approving member's role itself.
   */
  permission: Permission | null
  description: string
  input: z.ZodType<Raw>
  /** Fields the card's Edit form shows, from the model's input. */
  editFields: (raw: Raw) => EditField[]
  /** Validates and resolves; throws `ProposalProblem` with a message the model can act on. */
  propose: (env: ActionEnv, raw: Raw) => Promise<Proposal<Resolved>>
  execute: (env: ActionEnv, resolved: Resolved) => Promise<Executed>
  undo?: ((env: ActionEnv, undo: unknown) => Promise<string>) | undefined
}

/** Erases the generics so the registry can hold every action in one map. */
export function defineAction<Raw, Resolved>(
  definition: ActionDefinition<Raw, Resolved>,
): ActionDefinition {
  return definition as unknown as ActionDefinition
}
