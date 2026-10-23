'use client'

import type { TemplateSection } from '@commerce/core/theme'
import { AiIcon, Plus, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useGetPuck } from '@puckeditor/core'
import { useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type CustomizeDoc, MAIN_ZONE } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import { insertCopyActions, zoneItems } from '@/lib/customize-slots'

type Proposal = Awaited<ReturnType<typeof api.themes.proposeSection>>

type SectionProposerProps = {
  /** The template being edited ("Home page"), so the section fits the page. */
  page: string
}

/** The words a proposal card previews: the heading, then the first lines of its items. */
function previewLines(props: Record<string, unknown>): string[] {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const items = [props.columns, props.items].find(Array.isArray) as
    | Record<string, unknown>[]
    | undefined
  const lines = items ? items.map((i) => text(i.title) || text(i.question)) : [text(props.text)]
  return lines.filter(Boolean).slice(0, 4)
}

/**
 * "Build a section" (AI tab): the merchant describes a section, AI proposes one from the library
 * with its words written. Nothing touches the page until Add to page; it then goes after the
 * selected section (or at the end) like a pasted one, and is saved with the page.
 */
export default function SectionProposer({ page }: SectionProposerProps) {
  // Hooks
  const ai = useCopy(customizeContent.ai)
  const getPuck = useGetPuck()
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)

  // Event handlers
  const handlePropose = async () => {
    if (request.trim().length < 3 || busy) return
    setBusy(true)
    try {
      setProposal(await api.themes.proposeSection({ request: request.trim(), page }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ai.builder.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = () => {
    if (!proposal) return
    const puck = getPuck()
    const defaults = puck.config.components[proposal.type]?.defaultProps ?? {}
    const block = {
      type: proposal.type,
      props: { ...defaults, ...proposal.props, id: proposal.type },
    } as TemplateSection
    const data = puck.appState.data as unknown as CustomizeDoc
    const selector = puck.appState.ui.itemSelector
    // After the selected section when it is in the page body; header and footer take their own.
    const target =
      selector && (selector.zone ?? MAIN_ZONE) === MAIN_ZONE
        ? { zone: MAIN_ZONE, index: selector.index + 1 }
        : { zone: MAIN_ZONE, index: zoneItems(data, MAIN_ZONE).length }
    const count = zoneItems(data, MAIN_ZONE).length
    for (const action of insertCopyActions(target, block, count)) dispatch(action)
    toast.success(ai.builder.added(ai.builder.types[proposal.type]))
    setProposal(null)
    setRequest('')
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handlePropose()
    }
  }

  // Render logic
  return (
    <section className="flex flex-col gap-2.5 rounded-[0.625rem] border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <AiIcon aria-hidden weight="regular" className="size-3.5 text-primary" />
        <h3 className="text-[0.8125rem] font-semibold text-foreground">{ai.builder.title}</h3>
        <span className="ml-auto text-caption text-muted-foreground">{ai.builder.credits}</span>
      </div>
      {proposal ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/60 p-2.5">
            <span className="text-caption font-medium text-primary">
              {ai.builder.types[proposal.type]}
            </span>
            {typeof proposal.props.heading === 'string' ? (
              <p className="text-[0.8125rem] font-semibold text-foreground">
                {proposal.props.heading}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {previewLines(proposal.props).map((line) => (
                <li key={line} className="line-clamp-2 text-xs text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">{proposal.summary}</p>
          <p className="text-caption text-muted-foreground">{ai.builder.after}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAdd}>
              <Plus aria-hidden="true" />
              {ai.builder.add}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handlePropose()}
              disabled={busy}
            >
              {busy ? <Spinner /> : <RefreshCw aria-hidden="true" />}
              {ai.builder.again}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setProposal(null)} disabled={busy}>
              {ai.builder.dismiss}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{ai.builder.help}</p>
          <Textarea
            aria-label={ai.builder.label}
            value={request}
            maxLength={600}
            rows={3}
            placeholder={ai.builder.placeholder}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={handleKey}
            className="text-[0.8125rem]"
          />
          <Button
            size="sm"
            className="self-end"
            onClick={() => void handlePropose()}
            disabled={busy || request.trim().length < 3}
          >
            {busy ? <Spinner /> : <AiIcon aria-hidden="true" />}
            {busy ? ai.builder.proposing : ai.builder.propose}
          </Button>
        </>
      )}
    </section>
  )
}
