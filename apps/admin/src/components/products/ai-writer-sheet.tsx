'use client'

import type { WriterLanguage, WriterTone } from '@commerce/ai/client'
import { richTextToPlainText } from '@commerce/richtext'
import { AiIcon, CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import { aiContent } from '@/data/ai'
import { seoKeywordsContent } from '@/data/seo-keywords'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { type ApplyPicks, type CopyPatch, patchFromCopy } from '@/lib/ai-product-copy'
import { api } from '@/lib/api-client'
import AiWriterOptions from './ai-writer-options'
import AiWriterPreview from './ai-writer-preview'
import type { ProductFormState } from './form-state'

type AiWriterSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: ProductFormState
  onApply: (patch: CopyPatch) => void
}

type Result = Awaited<ReturnType<typeof api.ai.writeProduct>>

const ALL_PICKS: ApplyPicks = {
  description: true,
  specs: true,
  seoTitle: true,
  seoDescription: true,
  tags: true,
}

function isImage(contentType: string | null): boolean {
  return !contentType || contentType.startsWith('image/')
}

/**
 * "Write with AI" on the product page: pick a tone and language, optionally add notes, and
 * the AI writes a description, search text, tags and key specs from the photos. The result
 * shows next to what the product has now; Apply puts the ticked parts in the form (the save
 * bar then asks to save). Nothing is saved by this sheet.
 */
export default function AiWriterSheet({ open, onOpenChange, form, onApply }: AiWriterSheetProps) {
  // Hooks
  const copy = useCopy(aiContent)
  const keywordCopy = useCopy(seoKeywordsContent.writer)
  const locale = useLocale()
  const [tone, setTone] = useState<WriterTone>('friendly')
  const [language, setLanguage] = useState<WriterLanguage>(locale === 'hi' ? 'hi' : 'en')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [picks, setPicks] = useState<ApplyPicks>(ALL_PICKS)
  /* Options stay open until the first result, then fold into one line so the result leads. */
  const [editing, setEditing] = useState(true)

  // Event handlers
  const handleGenerate = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await api.ai.writeProduct({
        title: form.title,
        productType: form.productType,
        vendor: form.vendor,
        notes,
        existingDescription: richTextToPlainText(form.description).slice(0, 5000),
        existingTags: form.tags.slice(0, 50),
        keywords: form.seoKeywords,
        mediaIds: form.media.filter((m) => isImage(m.contentType)).map((m) => m.id),
        tone,
        language,
      })
      setResult(next)
      setPicks(ALL_PICKS)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.writer.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleApply = () => {
    if (!result) return
    const patch = patchFromCopy(result.copy, picks, {
      description: form.description,
      tags: form.tags,
    })
    if (Object.keys(patch).length === 0) {
      toast.error(copy.writer.nothingPicked)
      return
    }
    onApply(patch)
    toast.success(copy.writer.applied)
    onOpenChange(false)
  }

  // Render logic
  const photoCount = form.media.filter((m) => isImage(m.contentType)).length
  const needsTitle = form.title.trim().length === 0
  const primaryKeyword = form.seoKeywords[0] ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-line border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <AiIcon className="size-5 text-primary" aria-hidden="true" />
            {copy.writer.title}
          </SheetTitle>
          <SheetDescription>{copy.writer.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-5">
          {editing || !result ? (
            <AiWriterOptions
              tone={tone}
              language={language}
              notes={notes}
              photoCount={photoCount}
              disabled={busy}
              onTone={setTone}
              onLanguage={setLanguage}
              onNotes={setNotes}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
              <span className="text-body text-muted-foreground">
                {copy.writer.optionsSummary(
                  copy.writer.tones[tone],
                  copy.writer.languages[language],
                )}
              </span>
              <KitButton variant="linkSm" onClick={() => setEditing(true)}>
                {copy.writer.change}
              </KitButton>
            </div>
          )}
          <p className="text-caption text-muted-foreground">
            {primaryKeyword ? keywordCopy.steering(primaryKeyword) : keywordCopy.none}
          </p>
          {needsTitle ? (
            <p className="text-body text-warning-foreground dark:text-warning">
              {copy.writer.needTitle}
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {busy ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="text-body text-muted-foreground">{copy.writer.workingHint}</p>
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : result ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-body-strong text-ink-strong">{copy.writer.resultHeading}</h3>
                <p className="text-caption text-muted-foreground">{copy.writer.resultHint}</p>
              </div>
              <AiWriterPreview
                copy={result.copy}
                picks={picks}
                current={{
                  description: form.description,
                  seoTitle: form.seoTitle,
                  seoDescription: form.seoDescription,
                  tags: form.tags,
                }}
                primaryKeyword={primaryKeyword}
                onPicks={setPicks}
              />
            </div>
          ) : null}
          <p className="text-caption text-muted-foreground">{copy.disclaimer}</p>
        </div>
        <SheetFooter className="flex-row flex-wrap justify-end border-line border-t">
          {result ? (
            <>
              <KitButton variant="secondary" onClick={() => void handleGenerate()} disabled={busy}>
                {busy ? <Spinner /> : null}
                {copy.writer.regenerate}
              </KitButton>
              <KitButton variant="primary" onClick={handleApply} disabled={busy}>
                {copy.writer.apply}
              </KitButton>
            </>
          ) : (
            <>
              <KitButton variant="secondary" onClick={() => onOpenChange(false)}>
                {copy.writer.cancel}
              </KitButton>
              <KitButton
                variant="primary"
                onClick={() => void handleGenerate()}
                disabled={busy || needsTitle}
              >
                {busy ? <Spinner /> : <AiIcon className="size-4" aria-hidden="true" />}
                {busy ? copy.writer.working : copy.writer.generate}
              </KitButton>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
