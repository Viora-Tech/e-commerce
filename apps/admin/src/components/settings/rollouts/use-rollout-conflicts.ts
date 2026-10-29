'use client'

import type { RolloutConflict, RolloutView } from '@commerce/core'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { type RolloutFormState, toRolloutInput } from './rollout-form-state'

/** Waits this long after the last edit before asking the server about clashes. */
const CONFLICT_DELAY_MS = 400

/**
 * Clashes of the rollout being edited with the store's other rollouts, asked again a moment
 * after each edit. Only a draft or scheduled rollout that the member can change is checked.
 */
export function useRolloutConflicts(
  form: RolloutFormState,
  rollout: RolloutView | null,
  canManage: boolean,
): RolloutConflict[] {
  const [conflicts, setConflicts] = useState<RolloutConflict[]>([])
  const status = rollout?.status ?? 'draft'
  const enabled = canManage && (status === 'draft' || status === 'scheduled')
  const id = rollout?.id ?? null
  const inputKey = JSON.stringify(toRolloutInput(form))

  useEffect(() => {
    if (!enabled) return
    let live = true
    const timer = setTimeout(() => {
      const body = JSON.parse(inputKey) as ReturnType<typeof toRolloutInput>
      api.rollouts
        // The name does not take part in clashes; a blank one would only fail validation.
        .checkConflicts({ ...body, name: body.name || '-', id })
        .then((found) => {
          if (live) setConflicts(found)
        })
        // A discount deleted meanwhile is reported by Save; the banner just stays as it was.
        .catch(() => undefined)
    }, CONFLICT_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [inputKey, enabled, id])

  return enabled ? conflicts : []
}
