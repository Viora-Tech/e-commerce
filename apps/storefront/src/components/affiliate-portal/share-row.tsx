'use client'

import { ChevronDown, SocialMedia } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useEffect, useState } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'

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

/**
 * One "Share" button with a menu: each app's share page, then the phone's own share sheet
 * where there is one. One button instead of a row of five keeps the link card's footer tidy.
 */
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
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        <SocialMedia />
        {affiliatePortalContent.dashboard.link.share}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {APPS.map((a) => (
          <DropdownMenuItem
            key={a.id}
            render={<a href={shareUrl(a.id, text, url)} target="_blank" rel="noreferrer" />}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
        {canShare ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNative}>
              {affiliatePortalContent.dashboard.link.shareNative}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
