'use client'

import { useEffect, useState } from 'react'
import { affiliateContent } from '@/data/affiliate'

type ShareButtonsProps = {
  /** What gets shared: a line with the link (and the code when there is one). */
  text: string
  url: string
}

const copy = affiliateContent.dashboard.share

const BUTTON =
  'flex! min-h-10 touch-manipulation items-center justify-center rounded-full border border-line px-4 text-small font-medium transition-[scale,background-color] duration-(--duration-press) ease-out active:scale-(--motion-press-scale)'

/** Where each app's share page takes the text. Instagram has none: it is copied instead. */
function shareUrl(app: 'whatsapp' | 'x' | 'telegram' | 'facebook', text: string, url: string) {
  const t = encodeURIComponent(text)
  const u = encodeURIComponent(url)
  if (app === 'whatsapp') return `https://wa.me/?text=${t}`
  if (app === 'x') return `https://x.com/intent/post?text=${t}`
  if (app === 'telegram') return `https://t.me/share/url?url=${u}&text=${t}`
  return `https://www.facebook.com/sharer/sharer.php?u=${u}`
}

/**
 * Share the link: the phone's own share sheet where there is one (it reaches Instagram too),
 * WhatsApp, X, Telegram and Facebook pages, and a copy for Instagram.
 */
export default function ShareButtons({ text, url }: ShareButtonsProps) {
  // Hooks
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
  }, [])

  // Event handlers
  const handleNative = async () => {
    try {
      await navigator.share({ text, url })
    } catch {
      // Closed the sheet: nothing to do.
    }
  }
  const handleInstagram = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 4000)
    } catch {
      setCopied(false)
    }
  }

  // Render logic
  const apps = [
    { id: 'whatsapp', label: copy.whatsapp },
    { id: 'x', label: copy.x },
    { id: 'telegram', label: copy.telegram },
    { id: 'facebook', label: copy.facebook },
  ] as const

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canShare ? (
          <button
            type="button"
            onClick={handleNative}
            className={`${BUTTON} border-ink bg-ink! text-bg!`}
          >
            {copy.native}
          </button>
        ) : null}
        {apps.map((a) => (
          <a
            key={a.id}
            className={BUTTON}
            href={shareUrl(a.id, text, url)}
            target="_blank"
            rel="noreferrer"
          >
            {a.label}
          </a>
        ))}
        <button type="button" onClick={handleInstagram} className={BUTTON}>
          {copy.instagram}
        </button>
      </div>
      {copied ? (
        <p className="text-small text-muted" role="status">
          {copy.instagramCopied}
        </p>
      ) : null}
    </div>
  )
}
