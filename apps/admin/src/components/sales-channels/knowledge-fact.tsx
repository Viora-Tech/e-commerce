'use client'

import type {
  KnowledgeFact as Fact,
  KnowledgeKind,
  KnowledgeValueInput,
} from '@commerce/core/agent-knowledge'
import { AiIcon, Pencil, Plus, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { agentKnowledgeContent } from '@/data/agent-knowledge'
import { useCopy } from '@/hooks/use-copy'

type KnowledgeFactProps = {
  id: string
  label: string
  kind: KnowledgeKind
  fact: Fact | undefined
  busy: boolean
  onSave: (value: KnowledgeValueInput) => Promise<boolean>
  onPublish: (published: boolean) => void
}

type Draft = { text: string; tags: string; faq: { q: string; a: string }[] }

const draftOf = (fact: Fact | undefined): Draft => ({
  text: fact?.text ?? '',
  tags: (fact?.tags ?? []).join('\n'),
  faq: fact?.faq.length ? fact.faq.map((f) => ({ ...f })) : [{ q: '', a: '' }],
})

/** One fact in the Knowledge base: its value, Published or not, and an inline editor. */
export default function KnowledgeFact({
  id,
  label,
  kind,
  fact,
  busy,
  onSave,
  onPublish,
}: KnowledgeFactProps) {
  // Hooks
  const copy = useCopy(agentKnowledgeContent)
  const [draft, setDraft] = useState<Draft | null>(null)

  // Event handlers
  const handleSave = async () => {
    if (!draft) return
    const value: KnowledgeValueInput =
      kind === 'tags'
        ? {
            tags: draft.tags
              .split('\n')
              .map((t) => t.trim())
              .filter(Boolean),
          }
        : kind === 'faq'
          ? { faq: draft.faq.filter((f) => f.q.trim() && f.a.trim()) }
          : { text: draft.text }
    if (await onSave(value)) setDraft(null)
  }
  const handleFaq = (index: number, part: 'q' | 'a', value: string) =>
    setDraft((d) =>
      d ? { ...d, faq: d.faq.map((f, i) => (i === index ? { ...f, [part]: value } : f)) } : d,
    )

  // Render logic
  const published = fact?.published ?? false
  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 id={id} className="text-body font-semibold text-ink-strong">
            {label}
          </h3>
          {fact?.source === 'ai' ? (
            <span className="flex items-center gap-1 text-caption text-muted-foreground">
              <AiIcon aria-hidden className="size-3.5" />
              {copy.draftByAi}
            </span>
          ) : null}
        </div>
        {fact ? (
          <span
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-0.5 text-caption',
              published
                ? 'border-transparent bg-success-soft text-success'
                : 'border-dashed border-border text-muted-foreground',
            )}
          >
            {published ? copy.published : copy.unpublished}
          </span>
        ) : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-3">
          {kind === 'text' ? (
            <Textarea
              aria-labelledby={id}
              value={draft.text}
              maxLength={600}
              rows={3}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            />
          ) : kind === 'tags' ? (
            <>
              <Textarea
                aria-labelledby={id}
                value={draft.tags}
                rows={4}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              />
              <p className="text-caption text-muted-foreground">{copy.tagsHint}</p>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {draft.faq.map((f, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, never reordered
                <div key={i} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={copy.question}
                      placeholder={copy.question}
                      value={f.q}
                      maxLength={200}
                      onChange={(e) => handleFaq(i, 'q', e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.remove}
                      onClick={() =>
                        setDraft({ ...draft, faq: draft.faq.filter((_, j) => j !== i) })
                      }
                    >
                      <X />
                    </Button>
                  </div>
                  <Textarea
                    aria-label={copy.answer}
                    placeholder={copy.answer}
                    value={f.a}
                    rows={2}
                    maxLength={600}
                    onChange={(e) => handleFaq(i, 'a', e.target.value)}
                  />
                </div>
              ))}
              {draft.faq.length < 8 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setDraft({ ...draft, faq: [...draft.faq, { q: '', a: '' }] })}
                >
                  <Plus />
                  {copy.addQuestion}
                </Button>
              ) : null}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={handleSave}>
              {copy.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      ) : fact ? (
        <>
          {kind === 'tags' ? (
            <ul className="flex flex-wrap gap-1.5">
              {fact.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-caption text-foreground"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : kind === 'faq' ? (
            <dl className="flex flex-col gap-2 text-body">
              {fact.faq.map((f) => (
                <div key={f.q}>
                  <dt className="font-medium text-foreground">{f.q}</dt>
                  <dd className="text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-body text-foreground">{fact.text}</p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={published ? 'outline' : 'default'}
              disabled={busy}
              onClick={() => onPublish(!published)}
            >
              {published ? copy.unpublish : copy.publish}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(draftOf(fact))}>
              <Pencil />
              {copy.edit}
            </Button>
          </div>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setDraft(draftOf(undefined))}
        >
          <Plus />
          {copy.add}
        </Button>
      )}
    </li>
  )
}
