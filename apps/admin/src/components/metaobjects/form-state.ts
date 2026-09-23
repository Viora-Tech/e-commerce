import type { FieldDefinition, MetaobjectStatus } from '@commerce/core/metaobjects'
import type { api } from '@/lib/api-client'

export type LoadedDefinition = Awaited<ReturnType<typeof api.metaobjects.definition>>
export type DefinitionSummary = Awaited<ReturnType<typeof api.metaobjects.definitions>>[number]
export type LoadedEntry = Awaited<ReturnType<typeof api.metaobjects.entry>>

export type DefinitionFormState = {
  name: string
  type: string
  description: string
  displayNameKey: string | null
  storefrontAccess: boolean
  fields: FieldDefinition[]
}

export function definitionForm(def: LoadedDefinition | null): DefinitionFormState {
  return {
    name: def?.name ?? '',
    type: def?.type ?? '',
    description: def?.description ?? '',
    displayNameKey: def?.displayNameKey ?? null,
    storefrontAccess: def?.storefrontAccess ?? true,
    fields: (def?.fields as FieldDefinition[] | undefined) ?? [],
  }
}

export function definitionWrite(form: DefinitionFormState) {
  const displayNameKey = form.fields.some((f) => f.key === form.displayNameKey)
    ? form.displayNameKey
    : null
  return {
    name: form.name.trim(),
    ...(form.type.trim() ? { type: form.type.trim() } : {}),
    description: form.description.trim() || null,
    displayNameKey,
    storefrontAccess: form.storefrontAccess,
    fields: form.fields,
  }
}

export type EntryFormState = {
  handle: string
  status: MetaobjectStatus
  fields: Record<string, unknown>
}

export function entryForm(entry: LoadedEntry | null): EntryFormState {
  return {
    handle: entry?.handle ?? '',
    status: (entry?.status as MetaobjectStatus | undefined) ?? 'active',
    fields: entry?.fields ?? {},
  }
}

/** The per-field messages the API attaches to a 400, if any. */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const data = (err as { data?: { fieldErrors?: unknown } } | null)?.data
  const errors = data?.fieldErrors
  return errors && typeof errors === 'object' ? (errors as Record<string, string>) : {}
}

/** Admin path of a definition's entries. */
export const entriesPath = (type: string) => `/content/metaobjects/${type}`
