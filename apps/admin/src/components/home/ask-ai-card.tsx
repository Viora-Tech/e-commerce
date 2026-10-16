'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { assistantContent } from '@/data/assistant'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import { openAssistant } from '@/lib/assistant-events'
import { enter, instant, MOTION_MS } from '@/lib/motion'
import { routes } from '@/lib/routes'

type AskAiCardProps = {
  /** The assistant is on for this store and member; when off, asking leads to AI settings. */
  enabled: boolean
  /** Another page's wording (Reports): the box's placeholder and label, the example questions. */
  placeholder?: string | undefined
  label?: string | undefined
  chips?: readonly string[] | undefined
  /** A word before the example questions ("Try"). */
  chipsLabel?: string | undefined
  /** A quiet line under the questions ("Read-only…"). */
  note?: string | undefined
}

/**
 * Home's way into the AI assistant: one ask box and three example questions. Both open the
 * AI bar and send; the conversation itself lives in the bar, on every page. Always shown
 * (Figma 224:610); while AI is off, asking opens the AI settings instead. The hint inside
 * the box cycles the real example questions until the merchant hovers, focuses or types.
 */
export default function AskAiCard({
  enabled,
  placeholder,
  label,
  chips: pageChips,
  chipsLabel,
  note,
}: AskAiCardProps) {
  // Hooks
  const copy = useCopy(homePageContent)
  const assistant = useCopy(assistantContent)
  const router = useRouter()
  const reduced = useReducedMotion()
  const [question, setQuestion] = useState('')
  const [hint, setHint] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduced || paused) return
    let every: ReturnType<typeof setInterval> | null = null
    const first = setTimeout(() => {
      setHint((h) => h + 1)
      every = setInterval(() => {
        setHint((h) => h + 1)
      }, MOTION_MS.askRotateEvery)
    }, MOTION_MS.rotateFirst)
    return () => {
      clearTimeout(first)
      if (every) clearInterval(every)
    }
  }, [reduced, paused])

  // Event handlers
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

  const handlePause = () => {
    setPaused(true)
  }

  const handleResume = () => {
    setPaused(false)
  }

  // Render logic
  const chips = pageChips ?? (assistant.chips.home ?? []).slice(0, 3)
  const cycling = !reduced && chips.length > 0
  const showHint = cycling && question === '' && !paused
  const fade = reduced ? instant : enter

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={handleSubmit}
        onMouseEnter={handlePause}
        onMouseLeave={handleResume}
        className="flex h-15 items-center gap-3 rounded-lg border border-ai/25 bg-card pr-2.5 pl-5 shadow-ai transition-shadow duration-200 ease-out focus-within:ring-2 focus-within:ring-ai/30 motion-reduce:transition-none"
      >
        <AiIcon className="size-5 shrink-0 text-ai" aria-hidden="true" />
        <span className="relative min-w-0 flex-1 self-stretch">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onFocus={handlePause}
            onBlur={handleResume}
            placeholder={showHint ? '' : (placeholder ?? copy.ask.placeholder)}
            aria-label={label ?? copy.ask.label}
            className="h-full w-full bg-transparent text-[0.9375rem] leading-5 text-foreground outline-none placeholder:text-muted-foreground"
          />
          {showHint ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[0.9375rem] leading-5 text-muted-foreground"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={hint}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                  className="truncate"
                >
                  {chips[hint % chips.length]}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}
        </span>
        <Kbd className="hidden shrink-0 sm:inline-flex">{copy.ask.shortcut}</Kbd>
        <Button type="submit">{copy.ask.button}</Button>
      </form>
      <ul className="flex flex-wrap items-center gap-2">
        {chipsLabel ? (
          <li className="text-[0.8125rem] text-muted-foreground">{chipsLabel}</li>
        ) : null}
        {chips.map((chip) => (
          <li key={chip}>
            <button
              type="button"
              onClick={() => handleAsk(chip)}
              className="h-[2.0625rem] rounded-full border border-border bg-background px-3.5 text-[0.8125rem] leading-[1.1875rem] text-muted-foreground shadow-lift transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {chip}
            </button>
          </li>
        ))}
      </ul>
      {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
    </div>
  )
}
