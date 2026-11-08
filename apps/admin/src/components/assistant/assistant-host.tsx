'use client'

import { pageContextFor } from '@commerce/ai/client'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAssistant } from '@/hooks/use-assistant'
import { useAssistantEnabled } from '@/hooks/use-assistant-enabled'
import { useLocale } from '@/hooks/use-copy'
import {
  isAssistantShortcut,
  OPEN_ASSISTANT_EVENT,
  type OpenAssistantDetail,
} from '@/lib/assistant-events'
import { listSelection } from '@/lib/list-selection'
import { instant } from '@/lib/motion'
import AssistantLauncher from './assistant-launcher'

/* The chat panel (composer, answers, action cards, sources) loads the first time it opens, not
   with every admin page; the bar alone is part of the page. */
const AssistantPanel = dynamic(() => import('./assistant-panel'), { ssr: false })

/** Opening and closing: 420ms on the drawer curve (owner: slower and smooth). */
const DRAWER = { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const }

type AssistantHostProps = {
  /** The active store, so each store keeps its own conversation in this tab. */
  storeId: string | null
}

/**
 * The AI assistant on every admin page, mounted once in the admin frame: the bar when closed,
 * the chat panel when open. ⌘J / Ctrl+J toggles it and Esc (inside it) closes it, with no animation;
 * `openAssistant(prompt)` (Home's suggestions) opens it and sends. Shown only when AI is on
 * for the store and the member's role allows at least one assistant tool.
 */
export default function AssistantHost({ storeId }: AssistantHostProps) {
  // Hooks
  const pathname = usePathname()
  const locale = useLocale()
  const assistant = useAssistant(storeId)
  // The same cached `ai.status` read the top bar and the palette use: one request per page load.
  const aiEnabled = useAssistantEnabled()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!aiEnabled || !storeId) return
    function onKey(e: KeyboardEvent) {
      if (isAssistantShortcut(e)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (
        e.key === 'Escape' &&
        (e.target as Element | null)?.closest?.('[data-assistant]')
      ) {
        setOpen(false)
      }
    }
    function onOpen(e: Event) {
      setOpen(true)
      const prompt = (e as CustomEvent<OpenAssistantDetail>).detail?.prompt
      if (prompt) setPending(prompt)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen)
    }
  }, [aiEnabled, storeId])

  // A suggestion picked elsewhere (Home) is sent once the panel is open.
  useEffect(() => {
    if (!pending || !open) return
    setPending(null)
    void assistant.send(pending, pageContextFor(pathname), locale)
  }, [pending, open, assistant, pathname, locale])

  // Event handlers
  const handleSend = (message: string) => {
    void assistant.send(
      message,
      { ...pageContextFor(pathname), selectedIds: listSelection(pathname) },
      locale,
    )
  }

  // Early returns
  if (!aiEnabled || !storeId) return null

  // Render logic
  const page = pageContextFor(pathname).page

  /* Wide screens (84rem+, room for a 440px column and a readable page): the panel's column grows
     from 0 to 440px (and back) on the drawer curve, so the page beside it narrows smoothly.
     Narrower (phones, laptops with the sidebar open) the wrapper is `contents` and the panel
     slides up as a sheet over the page, centred and at most 40rem wide, so the page is never
     squeezed into a thin column (#903). */
  return (
    <>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="assistant"
            initial={{ width: 0 }}
            animate={{ width: '27.5rem' }}
            exit={{ width: 0 }}
            transition={reduced ? instant : DRAWER}
            className="shrink-0 overflow-hidden max-[84rem]:contents"
          >
            <AssistantPanel
              page={page}
              turns={assistant.turns}
              busy={assistant.busy}
              onSend={handleSend}
              onStop={assistant.stop}
              onClear={assistant.clear}
              onClose={() => setOpen(false)}
              onAction={assistant.replaceAction}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {open ? null : <AssistantLauncher onOpen={() => setOpen(true)} />}
    </>
  )
}
