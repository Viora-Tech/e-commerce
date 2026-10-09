'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { assistantContent } from '@/data/assistant'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import { openAssistant } from '@/lib/assistant-events'
import { routes } from '@/lib/routes'

type AskAiCardProps = {
  /** The assistant is on for this store and member; when off, asking leads to AI settings. */
  enabled: boolean
}

/**
 * Home's way into the AI assistant: one ask box and three example questions. Both open the
 * AI bar and send; the conversation itself lives in the bar, on every page. Always shown
 * (Figma 224:610); while AI is off, asking opens the AI settings instead.
 */
export default function AskAiCard({ enabled }: AskAiCardProps) {
  // Hooks
  const copy = useCopy(homePageContent)
  const assistant = useCopy(assistantContent)
  const router = useRouter()
  const [question, setQuestion] = useState('')

  // Handlers
  const handleAsk = (text?: string) => {
    if (!enabled) {
      router.push(routes.settings.ai())
      return
    }
    openAssistant(text)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    handleAsk(question.trim() || undefined)
    setQuestion('')
  }

  // Render logic
  const chips = (assistant.chips.home ?? []).slice(0, 3)

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={handleSubmit}
        className="flex h-[3.75rem] items-center gap-3 rounded-xl surface-card pr-2.5 pl-[1.1875rem]"
      >
        <AiIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={copy.ask.placeholder}
          aria-label={copy.ask.label}
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit">{copy.ask.button}</Button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip}>
            <button
              type="button"
              onClick={() => handleAsk(chip)}
              className="h-[2.0625rem] rounded-full border border-border bg-card px-3.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {chip}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
