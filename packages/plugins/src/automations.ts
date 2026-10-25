/** SOURCE OF TRUTH: plugin automation connectors — WHAT: the manifest's `automations` block (triggers, actions, templates an app adds to Automations) and the event an app fires with `ctx.triggerAutomation` / WHY: apps contribute Flow-style connectors through plain, serialisable manifest data, checked by `definePlugin` and resolved by the engine's registry (design §8.9). */
import type { AppHookContext } from './types'

/** One firing of a plugin trigger (see `AppHookContext.triggerAutomation`). */
export type AppAutomationEvent = {
  /** `<pluginId>/<name>`, declared in the manifest's `automations.triggers`. */
  trigger: string
  /** Unique per real-world event within the app (a lead id, a webhook delivery id). */
  key: string
  /** The record it is about, when there is one (`order`, `customer`, `product`). */
  subject?: { type: string; id: string } | undefined
  /** Small JSON the workflow's conditions and merge tags can read as `trigger.*`. */
  data?: Record<string, unknown> | undefined
}

/** Copy a plugin ships with its automation pieces. */
export type AppAutomationText = { en: string; hi?: string | undefined }

/**
 * A trigger an app adds to the Automations editor (Shopify Flow connector triggers). Fired with
 * `ctx.triggerAutomation`. `fields` are what conditions can read from the event's `data`.
 */
export type AppAutomationTrigger = {
  /** `<pluginId>/<name>`, lowercase. */
  id: string
  label: AppAutomationText
  description?: AppAutomationText | undefined
  /** `order`, `customer`, `product`, or `none` when the event has no store record. */
  subject: string
  /** `{ path: 'trigger.lead.email', type: 'text', label }`; types as the condition builder's. */
  fields?:
    | {
        path: string
        type: 'number' | 'money' | 'text' | 'tags' | 'boolean' | 'date' | 'enum'
        label: AppAutomationText
        options?: string[] | undefined
      }[]
    | undefined
}

/** What a plugin action gets each time a step runs. */
export type AppAutomationActionInput = {
  /** Idempotency key for the side effect: the same step retried keeps it. */
  stepRunId: string
  subject: { type: string; id: string | null }
  config: Record<string, unknown>
  /** The subject data conditions saw, for merge tags the action renders itself. */
  data: Record<string, unknown>
}

/** Throw this shape (`{ retryable, message }`) from an app action to choose retry or fail. */
export type AppAutomationActionError = Error & { retryable: boolean }

/** An action an app adds to the Automations editor (Shopify Flow connector actions). */
export type AppAutomationAction = {
  /** `<pluginId>/<name>`, lowercase. */
  id: string
  label: AppAutomationText
  description?: AppAutomationText | undefined
  /** The editor's form, as the engine's `FieldSpec` (serialisable; checked when loaded). */
  configFields: Record<string, unknown>[]
  risk: 'safe' | 'customer' | 'sensitive'
  /** A statement permission (`orders.write`) the publisher must hold. Default `settings.manage`. */
  permission?: string | undefined
  /** Subjects it works on; omitted = any. */
  subjects?: string[] | undefined
  run(ctx: AppHookContext, input: AppAutomationActionInput): Promise<{ output?: unknown }>
  /** "Test with a record": what it would do, in a sentence. Omitted = "Would run <label>". */
  preview?: ((ctx: AppHookContext, input: AppAutomationActionInput) => Promise<string>) | undefined
}

/** A prefilled workflow an app adds to the template gallery (a `WorkflowDefinition` JSON). */
export type AppAutomationTemplate = {
  id: string
  name: AppAutomationText
  description: AppAutomationText
  category: 'orders' | 'customers' | 'inventory' | 'marketing' | 'operations'
  definition: Record<string, unknown>
}

/** What an app contributes to Automations. Shown only while the app is installed. */
export type AppAutomations = {
  triggers?: AppAutomationTrigger[] | undefined
  actions?: AppAutomationAction[] | undefined
  templates?: AppAutomationTemplate[] | undefined
}
