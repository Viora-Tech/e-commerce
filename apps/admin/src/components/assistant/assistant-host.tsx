'use client'

import { pageContextFor } from '@commerce/ai/client'
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
import AssistantLauncher from './assistant-launcher'
import AssistantPanel from './assistant-panel'

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

  return open ? (
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
  ) : (
    <AssistantLauncher onOpen={() => setOpen(true)} />
  )
}
