'use client'

import { useState } from 'react'
import { affiliateContent } from '@/data/affiliate'

type CreativesListProps = {
  creatives: {
    id: string
    url: string
    contentType: string | null
    title: string
    caption: string
  }[]
}

const copy = affiliateContent.dashboard.creatives

/** The store's ready-made posts: save the image, copy the caption. */
export default function CreativesList({ creatives }: CreativesListProps) {
  // Hooks
  const [copied, setCopied] = useState<string | null>(null)

  // Event handlers
  const handleCopy = async (id: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  // Early returns
  if (creatives.length === 0) return null

  // Render logic
  return (
    <section className="flex max-w-[48rem] flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="h3">{copy.title}</h2>
        <p className="text-small text-muted">{copy.help}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {creatives.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-3"
          >
            {c.contentType?.startsWith('video/') ? (
              // biome-ignore lint/a11y/useMediaCaption: a store's promo clip without speech
              <video
                src={c.url}
                controls
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              // biome-ignore lint/performance/noImgElement: media from the store's storage host
              <img
                src={c.url}
                alt={c.title}
                loading="lazy"
                className="aspect-square w-full rounded-md object-cover"
              />
            )}
            {c.title ? <p className="text-body font-medium">{c.title}</p> : null}
            {c.caption ? (
              <p className="line-clamp-3 whitespace-pre-wrap text-small text-muted">{c.caption}</p>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-3 text-small">
              <a href={c.url} download target="_blank" rel="noreferrer" className="underline">
                {copy.download}
              </a>
              {c.caption ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => handleCopy(c.id, c.caption)}
                >
                  {copied === c.id ? affiliateContent.dashboard.copied : copy.copyCaption}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
