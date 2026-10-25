'use client'

import { toDataURL } from 'qrcode'
import { useEffect, useState } from 'react'
import CopyValue from '@/components/affiliate/copy-value'
import { affiliateContent } from '@/data/affiliate'
import type { Suggestion } from '@/lib/suggestion'

type LinkBuilderProps = {
  /** The store's own origin, for links and to refuse other sites' URLs. */
  origin: string
  code: string
}

const copy = affiliateContent.dashboard.builder

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
 * The portal's link builder: search a product or paste a page of this store, get the referral
 * link with a QR code (PNG download) and a WhatsApp share.
 */
export default function LinkBuilder({ origin, code }: LinkBuilderProps) {
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
    if (/^https?:\/\//i.test(value.trim()) || value.trim().startsWith('/')) setTarget(value)
  }
  const handlePick = (s: Suggestion) => {
    setTarget(`/products/${s.handle}`)
    setQuery(s.title)
    setResults([])
  }

  // Render logic
  const link = referralLink(origin, target, code)

  return (
    <section className="flex max-w-[48rem] flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="h3">{copy.title}</h2>
        <p className="text-small text-muted">{copy.help}</p>
      </div>
      <label className="field relative">
        <span className="field__label text-small">{copy.search}</span>
        <input
          className="field__input"
          value={query}
          placeholder={copy.placeholder}
          onChange={(e) => handleQuery(e.target.value)}
        />
        {results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-background">
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
      {!link ? (
        <p className="text-small text-danger" role="alert">
          {copy.otherSite}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex flex-col gap-3">
            <CopyValue label={copy.link} value={link} />
            <a
              className="btn btn--secondary w-fit"
              href={`https://wa.me/?text=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="btn__label">{copy.whatsapp}</span>
            </a>
          </div>
          {qr ? (
            <div className="flex flex-col items-center gap-2">
              {/* biome-ignore lint/performance/noImgElement: a generated data URL, not a remote image */}
              <img src={qr} alt={copy.qrAlt} className="size-36 rounded-md bg-white p-1" />
              <a className="text-small underline" href={qr} download={`${code}-qr.png`}>
                {copy.download}
              </a>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
