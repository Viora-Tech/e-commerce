'use client'

import { ArrowRight } from '@commerce/ui/icons'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { demoStoreContent as copy, DEMO_EXAMPLES } from '@/data/demo-store'
import { ctaClass } from '@/lib/cta'
import { useHeroDemo } from './hero-demo-context'

const IDLE_BEFORE_AUTO_MS = 2000
const TYPE_MS = 55
const TYPED_PAUSE_MS = 500
const DEBOUNCE_MS = 900
const ROLL_MS = 2600
const MIN_CHARS = 3

/**
 * The hero's main input: "What do you sell?" with a placeholder that rolls through examples. Typing
 * (after a short pause), Enter or the button builds a demo store for what was typed. If nobody
 * touches it for two seconds an example types itself in, so the page shows what it does.
 */
export default function HeroPrompt() {
  // Hooks
  const { run, reducedMotion } = useHeroDemo()
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [example, setExample] = useState(0)
  const touched = useRef(false)
  const runDemo = useEffectEvent(run)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // A debounced run still waiting when the page is left must not start the demo.
  useEffect(() => () => clearTimeout(debounce.current), [])

  useEffect(() => {
    if (reducedMotion || value || focused) return
    const timer = setInterval(
      () => setExample((index) => (index + 1) % DEMO_EXAMPLES.length),
      ROLL_MS,
    )
    return () => clearInterval(timer)
  }, [reducedMotion, value, focused])

  useEffect(() => {
    const first = DEMO_EXAMPLES[0]
    if (reducedMotion) {
      // Reduced motion: show the finished store straight away, no typing and no sequence.
      setValue(first)
      runDemo(first)
      return
    }
    let typer: ReturnType<typeof setInterval> | undefined
    let after: ReturnType<typeof setTimeout> | undefined
    const start = setTimeout(() => {
      if (touched.current) return
      let length = 0
      typer = setInterval(() => {
        if (touched.current) {
          clearInterval(typer)
          return
        }
        length += 1
        setValue(first.slice(0, length))
        if (length >= first.length) {
          clearInterval(typer)
          after = setTimeout(() => {
            if (!touched.current) runDemo(first)
          }, TYPED_PAUSE_MS)
        }
      }, TYPE_MS)
    }, IDLE_BEFORE_AUTO_MS)
    return () => {
      clearTimeout(start)
      clearTimeout(after)
      clearInterval(typer)
    }
  }, [reducedMotion])

  // Event handlers
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    touched.current = true
    const next = event.target.value
    setValue(next)
    clearTimeout(debounce.current)
    if (next.trim().length >= MIN_CHARS) {
      debounce.current = setTimeout(() => run(next.trim()), DEBOUNCE_MS)
    }
  }
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    touched.current = true
    clearTimeout(debounce.current)
    run(value.trim() || DEMO_EXAMPLES[example] || DEMO_EXAMPLES[0])
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel flex w-full max-w-[36rem] items-center gap-2 rounded-full p-1.5 pl-5"
    >
      <div className="relative min-w-0 flex-1">
        <label htmlFor="hero-prompt" className="sr-only">
          {copy.promptLabel}
        </label>
        <input
          id="hero-prompt"
          value={value}
          onChange={handleChange}
          onFocus={() => {
            touched.current = true
            setFocused(true)
          }}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          placeholder={reducedMotion || focused ? copy.promptLabel : ''}
          className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        {!value && !focused && !reducedMotion ? (
          <span
            key={example}
            aria-hidden
            className="animate-tour-in pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-base text-muted-foreground"
          >
            {copy.promptLabel} {DEMO_EXAMPLES[example]}
          </span>
        ) : null}
      </div>
      <button type="submit" className={ctaClass('lg')}>
        <span className="max-sm:hidden">{copy.build}</span>
        <span className="sm:hidden">{copy.buildShort}</span>
        <ArrowRight aria-hidden />
      </button>
    </form>
  )
}
