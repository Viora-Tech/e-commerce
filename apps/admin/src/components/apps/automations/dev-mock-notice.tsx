'use client'

import { InfoIcon } from '@commerce/ui/icons'
import { useSyncExternalStore } from 'react'
import { automationsContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { subscribeDevMock, usedDevMock } from '@/lib/automation-api'

/** DEV ONLY: says the page shows sample data because the engine's handlers are not in yet. */
export default function DevMockNotice() {
  // Hooks
  const copy = useCopy(automationsContent)
  const mocked = useSyncExternalStore(subscribeDevMock, usedDevMock, () => false)

  // Early returns
  if (!mocked) return null

  // Render logic
  return (
    <p className="flex items-center gap-2 rounded-md border border-info/30 bg-info-soft px-3 py-2 text-body text-info">
      <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
      {copy.devMock}
    </p>
  )
}
