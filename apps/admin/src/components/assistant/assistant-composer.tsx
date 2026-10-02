'use client'

import { ASSISTANT_MAX_MESSAGE } from '@commerce/ai/client'
import { ArrowUp } from '@commerce/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'

type AssistantComposerProps = {
  busy: boolean
  onSend: (message: string) => void
  onStop: () => void
}

/** The message box: grows with the text, Enter sends, Shift+Enter breaks the line. */
export default function AssistantComposer({ busy, onSend, onStop }: AssistantComposerProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    field.current?.focus()
  }, [])

  // Helpers
  const submit = () => {
    if (!draft.trim() || busy) return
    onSend(draft)
    setDraft('')
  }

  // Event handlers
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    submit()
  }

  // Render logic
  const canSend = draft.trim().length > 0 && !busy

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-xl border border-input bg-card p-1.5 pl-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
    >
      <textarea
        ref={field}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={copy.panel.placeholder}
        aria-label={copy.panel.placeholder}
        maxLength={ASSISTANT_MAX_MESSAGE}
        rows={1}
        className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-body"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          className="flex h-9 shrink-0 items-center rounded-lg border border-input bg-card px-3 text-caption font-medium text-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-muted active:scale-[0.97]"
        >
          {copy.panel.stop}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label={copy.panel.send}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-action text-action-foreground transition-[background-color,opacity,scale] duration-150 ease-out hover:bg-action/85 active:scale-[0.96] disabled:bg-muted disabled:text-muted-foreground"
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
      )}
    </form>
  )
}
