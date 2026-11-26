'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { affiliateContent } from '@/data/affiliate'

type ShareRowProps = {
  /** The line to share, with the link (and the code when there is one). */
  text: string
  url: string
}

const copy = affiliateContent.dashboard.share

type App = 'whatsapp' | 'x' | 'telegram' | 'facebook'

/** Where each app's share page takes the text. */
function shareUrl(app: App, text: string, url: string): string {
  const t = encodeURIComponent(text)
  const u = encodeURIComponent(url)
  if (app === 'whatsapp') return `https://wa.me/?text=${t}`
  if (app === 'x') return `https://x.com/intent/post?text=${t}`
  if (app === 'telegram') return `https://t.me/share/url?url=${u}&text=${t}`
  return `https://www.facebook.com/sharer/sharer.php?u=${u}`
}

const APPS: { id: App; label: string }[] = [
  { id: 'whatsapp', label: copy.whatsapp },
  { id: 'facebook', label: copy.facebook },
  { id: 'x', label: copy.x },
  { id: 'telegram', label: copy.telegram },
]

/** Share buttons: the phone's own share sheet where there is one, then each app's share page. */
export default function ShareRow({ text, url }: ShareRowProps) {
  // Hooks
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
  }, [])

  // Event handlers
  const handleNative = async () => {
    try {
      await navigator.share({ text, url })
    } catch {
      // The sheet was closed.
    }
  }

  // Render logic
  return (
    <div className="flex flex-wrap gap-2">
      {canShare ? (
        <Button type="button" size="sm" onClick={handleNative}>
          {copy.native}
        </Button>
      ) : null}
      {APPS.map((a) => (
        <Button
          key={a.id}
          size="sm"
          variant="outline"
          render={<a href={shareUrl(a.id, text, url)} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          {a.label}
        </Button>
      ))}
    </div>
  )
}
