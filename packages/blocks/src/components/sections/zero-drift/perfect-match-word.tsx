'use client'

// Port of assets/motion-extras.js (word rotate): the highlighted word cycles through a list,
// the old word rolling up and out as the new one rolls in. Server HTML shows the first word;
// reduced motion and the editor (where the word is an editable node) keep it still.
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { perfectMatchContent as copy } from '../../../data/zero-drift/perfect-match'
import { useReducedMotion } from '../../../use-reduced-motion'

type PerfectMatchWordProps = {
  /** The first word, as the section received it (a node while editing). */
  children: ReactNode
  /** The words that follow the first one. */
  words: string[]
}

export default function PerfectMatchWord({ children, words }: PerfectMatchWordProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [current, setCurrent] = useState(0)
  const index = useRef(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const [entering, setEntering] = useState(false)
  useEffect(() => {
    if (typeof children !== 'string' || words.length === 0 || reduce) return
    const total = words.length + 1
    let frame = 0
    let timer = 0
    const id = setInterval(() => {
      if (document.hidden) return
      const previous = index.current
      index.current = (previous + 1) % total
      setLeaving(previous)
      setCurrent(index.current)
      setEntering(true)
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setEntering(false))
      })
      clearTimeout(timer)
      timer = window.setTimeout(() => setLeaving(null), copy.rotateOutMs)
    }, copy.rotateMs)
    return () => {
      clearInterval(id)
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [children, words.length, reduce])

  // Helpers
  const wordAt = (i: number) => (i === 0 ? children : words[i - 1])

  return (
    <span className="word-rotate">
      {leaving !== null && leaving !== current ? (
        <span key={`w${leaving}`} className="word-rotate__word is-out">
          {wordAt(leaving)}
        </span>
      ) : null}
      <span key={`w${current}`} className={`word-rotate__word${entering ? ' is-in' : ''}`}>
        {wordAt(current)}
      </span>
    </span>
  )
}
