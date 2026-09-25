'use client'

import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { useState } from 'react'
import { feedbackCopy } from '../data/sections'

/** "Was this helpful?" at the foot of each page. Client-only; nothing is sent anywhere. */
export default function PageFeedback() {
  const [sent, setSent] = useState(false)

  const handleVote = () => {
    setSent(true)
  }

  return (
    <div
      data-pagefind-ignore="all"
      className="docs-feedback mt-16 flex h-10 items-center gap-3 text-sm text-(--docs-muted)"
    >
      {sent ? (
        <span role="status" className="text-(--docs-fg)">
          {feedbackCopy.thanks}
        </span>
      ) : (
        <>
          <span>{feedbackCopy.question}</span>
          <button
            type="button"
            aria-label={feedbackCopy.yes}
            onClick={handleVote}
            className="docs-feedback-button inline-flex size-8 items-center justify-center rounded-full border"
          >
            <ThumbsUp size={16} weight="light" />
          </button>
          <button
            type="button"
            aria-label={feedbackCopy.no}
            onClick={handleVote}
            className="docs-feedback-button inline-flex size-8 items-center justify-center rounded-full border"
          >
            <ThumbsDown size={16} weight="light" />
          </button>
        </>
      )}
    </div>
  )
}
