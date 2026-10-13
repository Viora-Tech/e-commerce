'use client'

import {
  addKeyword,
  makePrimary,
  mergeKeywords,
  SEO_KEYWORD_LENGTH_MAX,
  SEO_KEYWORDS_MAX,
  type SuggestedKeyword,
} from '@commerce/ai/client'
import { richTextToPlainText } from '@commerce/richtext'
import { AiIcon, CircleAlert, StarIcon, XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { type KeyboardEvent, useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import { rupees } from '@/data/products'
import { seoKeywordsContent } from '@/data/seo-keywords'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { ProductFormState } from './form-state'
import SeoKeywordSuggestions from './seo-keyword-suggestions'

type SeoKeywordsCardProps = {
  /** The saved product, so suggestions can use its Search Console queries; null while new. */
  productId: string | null
  form: ProductFormState
  /** Write with AI is on for the store and allowed for this member. */
  aiOn: boolean
  onChange: (seoKeywords: string[]) => void
}

type Suggestions = { keywords: SuggestedKeyword[]; searchQueries: number }

/** Lowest and highest variant price in paise, or nulls when no price is filled in. */
function priceRange(form: ProductFormState): { min: number | null; max: number | null } {
  const prices = form.variants
    .map((v) => rupees.toPaise(v.price))
    .filter((p): p is number => p !== null && p > 0)
  return prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : { min: null, max: null }
}

/**
 * The SEO tab's Search keywords card: the keywords Write with AI builds the search title and
 * description around, primary first. Suggest with AI, pick the primary, remove, or add your
 * own; the save bar keeps them with the product. The storefront never prints them.
 */
export default function SeoKeywordsCard({ productId, form, aiOn, onChange }: SeoKeywordsCardProps) {
  // Hooks
  const copy = useCopy(seoKeywordsContent)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)

  // Event handlers
  const handleSuggest = async () => {
    setBusy(true)
    setError(null)
    try {
      const price = priceRange(form)
      setSuggestions(
        await api.ai.suggestKeywords({
          productId,
          title: form.title,
          productType: form.productType,
          vendor: form.vendor,
          categoryId: form.categoryId,
          description: richTextToPlainText(form.description).slice(0, 5000),
          minPricePaise: price.min,
          maxPricePaise: price.max,
          current: form.seoKeywords,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleUse = (picked: SuggestedKeyword[]) => {
    onChange(mergeKeywords(form.seoKeywords, picked))
    setSuggestions(null)
    toast.success(copy.suggestions.added)
  }

  const handleAdd = () => {
    onChange(addKeyword(form.seoKeywords, draft))
    setDraft('')
  }

  /* Enter adds the keyword instead of submitting anything around the card. */
  const handleDraftKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAdd()
  }

  // Render logic
  const keywords = form.seoKeywords
  const full = keywords.length >= SEO_KEYWORDS_MAX
  const needsTitle = form.title.trim().length === 0

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.intro}</CardDescription>
        {aiOn ? (
          <CardAction>
            <KitButton
              variant="chip"
              onClick={() => void handleSuggest()}
              disabled={busy || needsTitle}
              title={needsTitle ? copy.needTitle : undefined}
            >
              {busy ? <Spinner /> : <AiIcon className="text-primary" aria-hidden="true" />}
              {suggestions ? copy.suggestAgain : copy.suggest}
            </KitButton>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {busy ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-body text-muted-foreground">{copy.suggesting}</p>
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : suggestions ? (
          <SeoKeywordSuggestions
            suggestions={suggestions.keywords}
            searchQueries={suggestions.searchQueries}
            current={keywords}
            onUse={handleUse}
            onDismiss={() => setSuggestions(null)}
          />
        ) : null}
        {keywords.length ? (
          <ul className="flex flex-col gap-1.5">
            {keywords.map((keyword, i) => (
              <li
                key={keyword}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2',
                  i === 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
                )}
              >
                <button
                  type="button"
                  onClick={() => onChange(makePrimary(keywords, keyword))}
                  disabled={i === 0}
                  title={i === 0 ? copy.primaryHint : copy.makePrimary}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:text-primary"
                >
                  <StarIcon weight={i === 0 ? 'fill' : 'regular'} className="size-4" />
                  <span className="sr-only">{i === 0 ? copy.primary : copy.makePrimary}</span>
                </button>
                <span className="min-w-0 flex-1 truncate text-body text-foreground">{keyword}</span>
                {i === 0 ? <Badge variant="info">{copy.primary}</Badge> : null}
                <button
                  type="button"
                  onClick={() => onChange(keywords.filter((k) => k !== keyword))}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-4" />
                  <span className="sr-only">{copy.remove(keyword)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">{aiOn ? copy.empty : copy.emptyNoAi}</p>
        )}
        <Field>
          <FieldLabel htmlFor="seo-keyword-add">{copy.addLabel}</FieldLabel>
          <div className="flex gap-2">
            <Input
              size="lg"
              id="seo-keyword-add"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleDraftKey}
              placeholder={copy.addPlaceholder}
              maxLength={SEO_KEYWORD_LENGTH_MAX}
              disabled={full}
              autoComplete="off"
            />
            <KitButton variant="secondary" onClick={handleAdd} disabled={full || !draft.trim()}>
              {copy.add}
            </KitButton>
          </div>
          {full ? <FieldDescription>{copy.full(SEO_KEYWORDS_MAX)}</FieldDescription> : null}
        </Field>
      </CardContent>
    </Card>
  )
}
