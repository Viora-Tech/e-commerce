'use client'

import { AiIcon } from '@commerce/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { mockAdminContent } from '@/data/mock-admin'

const copy = mockAdminContent.ai
const TYPE_MS = 24

/** A mock "Ask AI" box: pick or type a question and a canned answer types out. */
export default function MockAiBox() {
  // Hooks
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const textRef = useRef<HTMLSpanElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)

  // The answer types out by writing the text node directly: no React state per character.
  useEffect(() => {
    const text = textRef.current
    const cursor = cursorRef.current
    if (!answer || !text || !cursor) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      text.textContent = answer
      cursor.hidden = true
      return
    }
    let count = 0
    cursor.hidden = false
    text.textContent = ''
    const timer = setInterval(() => {
      count += 1
      text.textContent = answer.slice(0, count)
      if (count >= answer.length) {
        cursor.hidden = true
        clearInterval(timer)
      }
    }, TYPE_MS)
    return () => clearInterval(timer)
  }, [answer])

  // Event handlers
  const ask = (text: string) => {
    const match = copy.questions.find((item) => item.q.toLowerCase() === text.trim().toLowerCase())
    setQuestion(text)
    setAnswer(match ? match.a : (copy.questions[0]?.a ?? ''))
  }
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (question.trim()) ask(question)
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card/60 p-3">
      <div className="flex flex-wrap gap-1.5">
        {copy.questions.map((item) => (
          <button
            key={item.q}
            type="button"
            onClick={() => ask(item.q)}
            className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {item.q}
          </button>
        ))}
      </div>
      {answer ? (
        <p
          aria-live="polite"
          className="min-h-12 rounded-lg bg-muted/60 p-2.5 text-xs text-foreground"
        >
          <span ref={textRef} />
          <span
            ref={cursorRef}
            aria-hidden
            className="ml-0.5 inline-block h-3 w-px animate-pulse bg-foreground"
          />
        </p>
      ) : (
        <p className="text-[0.6875rem] text-muted-foreground">{copy.hint}</p>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <AiIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <label htmlFor="mock-ai-input" className="sr-only">
          {copy.label}
        </label>
        <input
          id="mock-ai-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={copy.placeholder}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-input-surface px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          className="h-8 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground outline-none transition-[scale] duration-(--duration-press) ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-(--motion-press-scale)"
        >
          {copy.send}
        </button>
      </form>
    </div>
  )
}
