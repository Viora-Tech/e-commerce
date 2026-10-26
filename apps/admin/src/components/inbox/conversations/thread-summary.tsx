'use client'

import { AiIcon, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Locale } from '@/lib/i18n'

type Summary = { about: string; pending: string }

type ThreadSummaryProps = {
  conversationId: string
  /** The newest message's id: a summary written before it is marked for a refresh. */
  latestId: string
}

/** Summaries written this session, by conversation, with the message they were written at. */
const written = new Map<string, { at: string; summary: Summary }>()
/** Conversations whose first summary is on its way, so a re-render never asks twice. */
const asking = new Set<string>()

const messageOf = (err: unknown) => (err instanceof Error && err.message ? err.message : null)

async function summarise(conversationId: string, latestId: string, language: Locale) {
  const summary = await api.inbox.summarise({ id: conversationId, language })
  written.set(conversationId, { at: latestId, summary })
  return summary
}

/**
 * Above a long thread: what the chat is about and what the shopper still waits for, written
 * by AI in the member's language. Written once when the chat opens (kept for the session),
 * and again on Refresh.
 */
export default function ThreadSummary({ conversationId, latestId }: ThreadSummaryProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const locale = useLocale()
  const [summary, setSummary] = useState<Summary | null>(
    written.get(conversationId)?.summary ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (written.has(conversationId) || asking.has(conversationId)) return
    asking.add(conversationId)
    setBusy(true)
    summarise(conversationId, latestId, locale)
      .then((next) => {
        setSummary(next)
      })
      .catch((err: unknown) => {
        setError(messageOf(err) ?? copy.failed)
      })
      .finally(() => {
        asking.delete(conversationId)
        setBusy(false)
      })
  }, [conversationId, latestId, locale, copy.failed])

  // Event handlers
  const handleRefresh = async () => {
    setBusy(true)
    setError(null)
    try {
      setSummary(await summarise(conversationId, latestId, locale))
    } catch (err) {
      setError(messageOf(err) ?? copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const a = copy.assist
  const stale = summary !== null && written.get(conversationId)?.at !== latestId

  return (
    <section
      aria-label={a.summary}
      className="flex items-start gap-2.5 border-b border-hairline bg-muted/40 px-4 py-3"
    >
      <AiIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body-strong">{a.summary}</p>
        {busy && !summary ? (
          <div className="flex flex-col gap-1.5" role="status" aria-label={a.summarising}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : summary ? (
          <>
            <p className="text-body text-muted-foreground">{summary.about}</p>
            {summary.pending ? (
              <p className="text-body">
                <span className="font-medium">{a.pending}: </span>
                {summary.pending}
              </p>
            ) : null}
            <p className="text-caption text-muted-foreground">{a.byAi}</p>
          </>
        ) : null}
        {error ? <p className="text-caption text-muted-foreground">{error}</p> : null}
      </div>
      <Button
        variant={stale ? 'outline' : 'ghost'}
        size="icon-sm"
        aria-label={summary ? a.refresh : a.summarise}
        title={summary ? a.refresh : a.summarise}
        loading={busy}
        onClick={handleRefresh}
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
      </Button>
    </section>
  )
}
