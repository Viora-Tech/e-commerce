'use client'

import { pageContextFor } from '@commerce/ai/client'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAssistant } from '@/hooks/use-assistant'
import { useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  isAssistantShortcut,
  OPEN_ASSISTANT_EVENT,
  type OpenAssistantDetail,
} from '@/lib/assistant-events'
import { instant } from '@/lib/motion'
import AssistantLauncher from './assistant-launcher'
import AssistantPanel from './assistant-panel'

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
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!storeId) return
    api.ai
      .status()
      .then((status) => setEnabled(status.assistant))
      .catch(() => setEnabled(false))
  }, [storeId])

  useEffect(() => {
    if (!enabled) return
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
  }, [enabled])

  // A suggestion picked elsewhere (Home) is sent once the panel is open.
  useEffect(() => {
    if (!pending || !open) return
    setPending(null)
    void assistant.send(pending, pageContextFor(pathname), locale)
  }, [pending, open, assistant, pathname, locale])

  // Event handlers
  const handleSend = (message: string) => {
    void assistant.send(message, pageContextFor(pathname), locale)
  }

  // Early returns
  if (!enabled) return null

  // Render logic
  const page = pageContextFor(pathname).page

  /* Desktop: the panel's column grows from 0 to 440px (and back) on the drawer curve, so the
     page beside it narrows smoothly; on phones the wrapper is `contents` and the sheet slides. */
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
            className="shrink-0 overflow-hidden max-md:contents"
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
