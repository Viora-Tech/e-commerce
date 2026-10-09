'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { assistantContent } from '@/data/assistant'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import { openAssistant } from '@/lib/assistant-events'

/**
 * Home's way into the AI assistant: one ask box and three example questions. Both open the
 * AI bar and send; the conversation itself lives in the bar, on every page.
 */
export default function AskAiCard() {
  // Hooks
  const copy = useCopy(homePageContent)
  const assistant = useCopy(assistantContent)
  const [question, setQuestion] = useState('')

  // Handlers
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    openAssistant(question.trim() || undefined)
    setQuestion('')
  }

  // Render logic
  const chips = (assistant.chips.home ?? []).slice(0, 3)

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={handleSubmit}
        className="flex h-12 items-center gap-2.5 rounded-2xl surface-card pr-1.5 pl-4"
      >
        <AiIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={copy.ask.placeholder}
          aria-label={copy.ask.label}
          className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit">{copy.ask.button}</Button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip}>
            <button
              type="button"
              onClick={() => openAssistant(chip)}
              className="h-8 rounded-full border border-hairline bg-card px-3 text-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {chip}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
