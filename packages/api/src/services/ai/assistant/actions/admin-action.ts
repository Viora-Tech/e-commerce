/**
 * `runAdminAction`: an admin procedure an MCP client asked to run (`runAction`) that waits for
 * approval, either a change while "Changes need approval" is on or a sensitive action, which
 * always waits. The card shows the action's name, what it does and its input as plain rows.
 * Approve calls the procedure as the approving member through the admin's own middleware, so
 * their role decides exactly as if they had clicked it in the admin. No undo.
 */
import { call, ORPCError } from '@orpc/server'
import { z } from 'zod'
import {
  describePath,
  humanName,
  kindForInput,
  procedureAt,
  sensitiveNote,
} from '../../../../mcp/action-catalogue'
import { ApproverNotAllowed, ProposalProblem } from './resolve'
import { defineAction, type PreviewRow } from './types'

const Input = z.object({
  path: z.string().min(1).max(120),
  input: z.unknown(),
})
type Raw = z.infer<typeof Input>
type Resolved = { path: string; input: unknown }

/** Rows the card shows; the rest are counted. */
const MAX_ROWS = 30
const MAX_VALUE = 300
/** What the action log keeps of a procedure's answer. */
const MAX_RESULT = 2000

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/** `orderId` → "Order id". */
const labelOf = (key: string) => {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function flatten(value: unknown, label: string, out: PreviewRow[]) {
  if (value === undefined) return
  if (value === null || typeof value !== 'object') {
    out.push({ label: label || 'Input', before: '', after: clip(String(value), MAX_VALUE) })
    return
  }
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) {
      const list = value.length ? value.map(String).join(', ') : '(none)'
      out.push({ label: label || 'Input', before: '', after: clip(list, MAX_VALUE) })
      return
    }
    value.forEach((item, i) => {
      flatten(item, `${label || 'Item'} ${i + 1}`, out)
    })
    return
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, label ? `${label} › ${labelOf(key)}` : labelOf(key), out)
  }
}

/** The input as label/value rows, nested keys joined with ›. */
function inputRows(input: unknown): { rows: PreviewRow[]; more: number } {
  const rows: PreviewRow[] = []
  flatten(input, '', rows)
  return { rows: rows.slice(0, MAX_ROWS), more: Math.max(0, rows.length - MAX_ROWS) }
}

/** A short record of what the procedure answered, for the action log. */
function brief(output: unknown): unknown {
  if (output instanceof Blob) return { file: output instanceof File ? output.name : 'file' }
  if (output === undefined) return null
  const text = JSON.stringify(output) ?? ''
  return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}…` : output
}

export const adminAction = defineAction<Raw, Resolved>({
  tool: 'runAdminAction',
  permission: null,
  description: 'Run one admin action an MCP client asked for, as the member who approves it.',
  input: Input,
  editFields: () => [],
  propose: async (_env, raw) => {
    const kind = kindForInput(raw.path, raw.input)
    if (!kind) throw new ProposalProblem(`There is no admin action called ${raw.path}.`)
    const name = humanName(raw.path)
    const { rows, more } = inputRows(raw.input)
    const note = kind === 'sensitive' ? sensitiveNote(raw.path) : null
    return {
      summary: name,
      resolved: { path: raw.path, input: raw.input },
      preview: {
        title: name,
        lines: [
          { label: 'Action', value: raw.path },
          { label: 'What it does', value: describePath(raw.path) },
        ],
        rows,
        more,
        count: 1,
        undoable: false,
        notes: [
          'Runs as you, with what your role allows, when you approve.',
          ...(note ? [`Sensitive (${note}): always waits for approval.`] : []),
        ],
      },
    }
  },
  execute: async (env, resolved) => {
    if (!env.api) throw new ProposalProblem('Approve this in the admin while signed in.')
    // Imported here: the router imports this registry, so a static import would be a cycle.
    const { appRouter } = await import('../../../../routers/_app')
    const procedure = procedureAt(appRouter, resolved.path)
    if (!procedure || !kindForInput(resolved.path, resolved.input))
      throw new ProposalProblem('That admin action is no longer available.')
    try {
      const output = await call(procedure, resolved.input, {
        context: { ...env.api, apiPrincipal: undefined },
        path: resolved.path.split('.'),
      })
      return {
        message: `${humanName(resolved.path)}: done`,
        href: null,
        result: { path: resolved.path, output: brief(output) },
        undo: null,
      }
    } catch (err) {
      if (err instanceof ORPCError && err.code === 'FORBIDDEN') {
        throw new ApproverNotAllowed(err.message)
      }
      if (err instanceof ORPCError) throw new ProposalProblem(err.message)
      throw err
    }
  },
})
