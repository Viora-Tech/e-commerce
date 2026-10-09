'use client'

import { AiIcon } from '@commerce/ui/icons'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'

type AssistantLauncherProps = {
  onOpen: () => void
}

/**
 * The closed AI button: a round button above the thumb on phones. On desktop the top bar's
 * "Ask AI" pill opens the assistant instead. Hidden while a floating bar is up, which sits in
 * the same spot. No entrance animation: it is always there.
 */
export default function AssistantLauncher({ onOpen }: AssistantLauncherProps) {
  // Hooks
  const copy = useCopy(assistantContent)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={copy.launcher.open}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex size-12 items-center justify-center rounded-full bg-action text-action-foreground shadow-popover transition-[scale] duration-150 ease-out active:scale-[0.96] md:hidden [body:has([data-save-bar])_&]:hidden"
    >
      <AiIcon className="size-5" aria-hidden="true" />
    </button>
  )
}
