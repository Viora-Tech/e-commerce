'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'
import { modKey } from '@/lib/assistant-events'

type AssistantLauncherProps = {
  onOpen: () => void
}

/**
 * The closed AI bar: a quiet pill at the bottom centre of the page panel on desktop (offset by
 * the sidebar), a round button above the thumb on phones. Hidden while a save bar is up, which
 * sits in the same spot. No entrance animation: it is always there.
 */
export default function AssistantLauncher({ onOpen }: AssistantLauncherProps) {
  // Hooks
  const copy = useCopy(assistantContent)

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={copy.launcher.open}
        className="group fixed bottom-5 left-1/2 z-30 hidden h-11 w-[min(30rem,calc(100vw-var(--sidebar-width,0rem)-4rem))] -translate-x-1/2 items-center gap-2.5 rounded-full border border-border bg-popover/95 pr-2 pl-4 text-left shadow-popover backdrop-blur transition-[border-color,box-shadow,scale] duration-150 ease-out hover:border-border-strong active:scale-[0.99] md:ml-[calc(var(--sidebar-width,0rem)/2)] md:flex [body:has([data-save-bar])_&]:hidden"
      >
        <AiIcon className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-body text-muted-foreground group-hover:text-foreground">
          {copy.launcher.placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          <Kbd>{modKey()}</Kbd>
          <Kbd>J</Kbd>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={copy.launcher.open}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex size-12 items-center justify-center rounded-full bg-action text-action-foreground shadow-popover transition-[scale] duration-150 ease-out active:scale-[0.96] md:hidden [body:has([data-save-bar])_&]:hidden"
      >
        <AiIcon className="size-5" aria-hidden="true" />
      </button>
    </>
  )
}
