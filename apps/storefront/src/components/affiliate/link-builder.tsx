'use client'

import { toDataURL } from 'qrcode'
import { useEffect, useState } from 'react'
import CopyValue from '@/components/affiliate/copy-value'
import ShareButtons from '@/components/affiliate/share-buttons'
import { affiliateContent } from '@/data/affiliate'
import type { Suggestion } from '@/lib/suggestion'

type LinkBuilderProps = {
  /** The store's own origin, for links and to refuse other sites' URLs. */
  origin: string
  code: string
  /** Their discount code and what it saves, for the share text. */
  couponCode: string | null
  couponPercent: number | null
}

const copy = affiliateContent.dashboard

/** A store page as a referral link: the page with `ref` added, or null for another site. */
function referralLink(origin: string, raw: string, code: string): string | null {
  const base = origin.replace(/\/+$/, '')
  try {
    const url = new URL(raw.trim() || '/', `${base}/`)
    if (url.origin !== new URL(base).origin) return null
    url.searchParams.set('ref', code)
    return url.toString()
  } catch {
    return null
  }
}

/**
 * The dashboard's link card: their link (the home page, or any product they search or page they
 * paste), copy, share to WhatsApp, Instagram, X and more, and a QR code to download.
 */
export default function LinkBuilder({ origin, code, couponCode, couponPercent }: LinkBuilderProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [target, setTarget] = useState('/')
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    const term = query.trim()
    // A pasted URL is not a search.
    if (term.length < 2 || /^https?:\/\//i.test(term) || term.startsWith('/')) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<Suggestion[]>) : []))
        .then(setResults)
        .catch(() => undefined)
    }, 200)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  useEffect(() => {
    const link = referralLink(origin, target, code)
    if (!link) {
      setQr(null)
      return
    }
    let live = true
    toDataURL(link, { margin: 1, width: 512 })
      .then((src) => {
        if (live) setQr(src)
      })
      .catch(() => setQr(null))
    return () => {
      live = false
    }
  }, [origin, target, code])

  // Event handlers
  const handleQuery = (value: string) => {
    setQuery(value)
    const v = value.trim()
    if (/^https?:\/\//i.test(v) || v.startsWith('/')) setTarget(value)
    else if (!v) setTarget('/')
  }
  const handlePick = (s: Suggestion) => {
    setTarget(`/products/${s.handle}`)
    setQuery(s.title)
    setResults([])
  }
  const handleReset = () => {
    setTarget('/')
    setQuery('')
    setResults([])
  }

  // Render logic
  const link = referralLink(origin, target, code)
  const b = copy.builder

  return (
    <section className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="h3">{copy.share.title}</h2>
        <p className="text-small text-muted">{copy.share.help}</p>
      </div>
      {!link ? (
        <p className="text-small text-danger" role="alert">
          {b.otherSite}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <CopyValue label={b.link} value={link} />
            <ShareButtons url={link} text={copy.share.message(link, couponCode, couponPercent)} />
          </div>
          {qr ? (
            <div className="flex flex-col items-center gap-2 justify-self-center">
              {/* biome-ignore lint/performance/noImgElement: a generated data URL, not a remote image */}
              <img src={qr} alt={b.qrAlt} className="size-36 rounded-md bg-bg p-1" />
              <a className="text-small underline" href={qr} download={`${code}-qr.png`}>
                {b.download}
              </a>
            </div>
          ) : null}
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <label className="field relative">
          <span className="field__label text-small font-medium">{b.title}</span>
          <input
            className="field__input"
            value={query}
            placeholder={b.placeholder}
            aria-label={b.search}
            onChange={(e) => handleQuery(e.target.value)}
          />
          {results.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-bg">
              {results.map((s) => (
                <li key={s.handle}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-body hover:bg-surface"
                    onClick={() => handlePick(s)}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>
        <p className="text-small text-muted">{b.help}</p>
        {target !== '/' ? (
          <button type="button" className="w-fit text-small underline" onClick={handleReset}>
            {b.reset}
          </button>
        ) : null}
      </div>
    </section>
  )
}
