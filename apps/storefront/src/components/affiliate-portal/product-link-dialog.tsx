'use client'

import { LinkIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useEffect, useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { referralLink } from '@/lib/portal-format'
import type { Suggestion } from '@/lib/suggestion'
import CopyField from './copy-field'

type ProductLinkDialogProps = {
  /** The store's own origin; only its pages can be linked. */
  origin: string
  code: string
}

const copy = affiliatePortalContent.dashboard.link

const isUrl = (v: string) => /^https?:\/\//i.test(v) || v.startsWith('/')

/** "Get product link": search a product (or paste a page of the store) and copy its referral link. */
export default function ProductLinkDialog({ origin, code }: ProductLinkDialogProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2 || isUrl(term)) {
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

  // Event handlers
  const handleQuery = (value: string) => {
    setQuery(value)
    setTarget(isUrl(value.trim()) ? value.trim() : null)
  }
  const handlePick = (s: Suggestion) => {
    setTarget(`/products/${s.handle}`)
    setQuery(s.title)
    setResults([])
  }

  // Render logic
  const link = target ? referralLink(origin, target, code) : null
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <LinkIcon />
        {copy.product}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>{copy.product}</DialogTitle>
          <DialogDescription>{copy.search}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="portal-product-search">{copy.search}</Label>
          <Input
            id="portal-product-search"
            value={query}
            autoComplete="off"
            onChange={(e) => handleQuery(e.target.value)}
          />
          {results.length > 0 ? (
            <ul className="flex max-h-[16rem] flex-col overflow-y-auto rounded-md border">
              {results.map((s) => (
                <li key={s.handle} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handlePick(s)}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {target && !link ? (
          <p className="text-sm text-destructive" role="alert">
            {copy.otherSite}
          </p>
        ) : null}
        {link ? (
          <div className="flex flex-col gap-2">
            <Label>{copy.productLink}</Label>
            <CopyField value={link} label={copy.productLink} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
