'use client'

import { QUERY_WRITER_REQUEST_MAX } from '@commerce/ai/client'
import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type QueryAiInputProps = {
  /** `on`: the assistant is on for this store and member; `off`: say why it is not. */
  state: 'on' | 'off'
  /** The editor's text now, sent so the AI edits it rather than starting over. */
  current: string
  /** A parsed, formatted query from the server; the page puts it in the editor and runs it. */
  onAnswer: (source: string) => void
}

/**
 * "Refine with AI" under the editor: a plain-language request becomes query text. The server
 * returns text only after the query parser accepts it; it runs like any typed query.
 */
export default function QueryAiInput({ state, current, onAnswer }: QueryAiInputProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query.ai)
  const id = useId()
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ask = request.trim()
    if (!ask || busy) return
    setBusy(true)
    setProblem(null)
    try {
      const out = await api.analytics.refineQuery({ request: ask, current })
      if (out.ok) {
        onAnswer(out.source)
        toast.success(copy.done)
      } else {
        setProblem(copy.invalid(out.error.message))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (state === 'off') {
    return (
      <p className="flex items-center gap-2 border-border border-t px-3 py-2 text-caption text-muted-foreground">
        <AiIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {copy.off}
      </p>
    )
  }

  // Render logic
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-1.5 border-border border-t px-3 py-2"
    >
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground"
      >
        <AiIcon className="size-3.5" aria-hidden="true" />
        {copy.label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={request}
          maxLength={QUERY_WRITER_REQUEST_MAX}
          placeholder={copy.placeholder}
          onChange={(e) => setRequest(e.target.value)}
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" variant="outline" loading={busy} disabled={!request.trim()}>
          {copy.submit}
        </Button>
      </div>
      {problem ? (
        <p role="alert" className="text-caption text-danger">
          {problem}
        </p>
      ) : null}
    </form>
  )
}
