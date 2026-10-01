'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { mainProductContent as copy } from '../data/glide/main-product'
import { hasCopy } from '../sections/main-product-settings'
import Icon, { type IconName } from './icon'

type ProductShareRowProps = {
  label: ReactNode
  title: string
  /** The product page's absolute URL (relative until the page has hydrated). */
  url: string
}

const ui = copy.ui.share

/** Each network's share flow, WhatsApp first: it is where this audience sends links. */
function networks(url: string, title: string): { icon: IconName; label: string; href: string }[] {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return [
    { icon: 'whatsapp', label: ui.whatsapp, href: `https://wa.me/?text=${t}%20${u}` },
    {
      icon: 'twitter',
      label: ui.twitter,
      href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    },
    { icon: 'facebook', label: ui.facebook, href: `https://www.facebook.com/sharer.php?u=${u}` },
    { icon: 'telegram', label: ui.telegram, href: `https://t.me/share/url?url=${u}&text=${t}` },
  ]
}

// The `share_row` block of sections/main-product.liquid (share-row.js): icon links that
// work without script, and a copy-link button once hydrated, with the readonly URL field as
// the fallback when the clipboard write fails.
export default function ProductShareRow({ label, title, url }: ProductShareRowProps) {
  // Hooks
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState(false)

  useEffect(() => setReady(true), [])

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFallback(true)
    }
  }

  return (
    <div className={`share-row${ready ? ' is-ready' : ''}${fallback ? ' is-copy-fallback' : ''}`}>
      {hasCopy(label) ? <span className="share-row__label">{label}</span> : null}
      {networks(url, title).map((n) => (
        <a
          key={n.icon}
          className="share-row__link"
          href={n.href}
          target="_blank"
          rel="noopener"
          aria-label={n.label}
        >
          <Icon name={n.icon} size={n.icon === 'whatsapp' || n.icon === 'telegram' ? 16 : 14} />
        </a>
      ))}
      <button type="button" className="share-row__copy" onClick={handleCopy}>
        {copied ? (
          <span className="share-row__copied" role="status">
            <Icon name="check" size={14} />
            {ui.copied}
          </span>
        ) : (
          <span>{ui.copy}</span>
        )}
      </button>
      <input
        className="share-row__fallback"
        type="text"
        readOnly
        value={url}
        aria-label={ui.urlLabel}
      />
    </div>
  )
}
