'use client'

import {
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
  type WorkflowDetail,
} from '@commerce/core/automations'
import { useEffect, useState } from 'react'
import { automationApi } from '@/lib/automation-api'

/** `saved` once stored, `waiting` while the draft is unfinished (the API only stores valid drafts). */
export type DraftSaveState = 'saved' | 'saving' | 'failed' | 'waiting'

const AUTOSAVE_DELAY_MS = 800

const keyOf = (def: WorkflowDefinition, name: string) => JSON.stringify([name.trim(), def])

/**
 * The Automations editor's draft: the definition and name being edited, saved on their own a
 * moment after each change (the live version keeps running until Publish). `replace` takes a
 * fresh workflow from the API (after publish, restore or a status change).
 */
export function useWorkflowDraft(initial: WorkflowDetail, enabled: boolean) {
  const [workflow, setWorkflow] = useState(initial)
  const [def, setDef] = useState(initial.definition)
  const [name, setName] = useState(initial.name)
  const [saved, setSaved] = useState(() => keyOf(initial.definition, initial.name))
  const [saveState, setSaveState] = useState<DraftSaveState | null>(null)

  useEffect(() => {
    if (!enabled) return
    const key = keyOf(def, name)
    if (key === saved) return
    if (!name.trim() || !WorkflowDefinitionSchema.safeParse(def).success) {
      setSaveState('waiting')
      return
    }
    let live = true
    const timer = setTimeout(() => {
      setSaveState('saving')
      automationApi
        .update({ id: initial.id, name: name.trim(), draft: def })
        .then((next) => {
          if (!live) return
          setWorkflow(next)
          setSaved(key)
          setSaveState('saved')
        })
        .catch(() => live && setSaveState('failed'))
    }, AUTOSAVE_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [def, name, saved, enabled, initial.id])

  const replace = (next: WorkflowDetail) => {
    setWorkflow(next)
    setDef(next.definition)
    setName(next.name)
    setSaved(keyOf(next.definition, next.name))
    setSaveState(null)
  }

  /** Saves now (before publish or a test), when the draft is valid; true when nothing is left unsaved. */
  const flush = async (): Promise<boolean> => {
    const key = keyOf(def, name)
    if (key === saved) return true
    if (!name.trim() || !WorkflowDefinitionSchema.safeParse(def).success) return false
    const next = await automationApi.update({ id: initial.id, name: name.trim(), draft: def })
    setWorkflow(next)
    setSaved(key)
    setSaveState('saved')
    return true
  }

  return { workflow, def, setDef, name, setName, saveState, replace, flush }
}
