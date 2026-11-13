'use client'

import { Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { whatsappAppContent } from '@/data/whatsapp-app'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Template = Awaited<ReturnType<typeof api.platformApps.whatsappTemplates>>['templates'][number]

type TemplateCardProps = {
  template: Template
  /** The message's name in Settings → Notifications ("Order confirmation"). */
  label: string
  /** Whether "Not submitted" is Meta's answer (false: we could not ask). */
  statusKnown: boolean
  /** Shown when this member may submit and the saved access can. */
  onSubmit?: (() => void) | undefined
  submitting: boolean
}

const TONE: Record<string, ChipTone> = {
  approved: 'success',
  pending: 'attention',
  rejected: 'danger',
  not_submitted: 'neutral',
}

/**
 * One message's WhatsApp template on Apps → WhatsApp → Templates: the exact name, category and
 * body to submit, its parameters in the order the sender fills them with an example each, and
 * Meta's review status.
 */
export default function TemplateCard({
  template,
  label,
  statusKnown,
  onSubmit,
  submitting,
}: TemplateCardProps) {
  // Hooks
  const appCopy = useCopy(whatsappAppContent)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.body)
      toast.success(appCopy.templates.copied)
    } catch {
      toast.error(template.body)
    }
  }

  // Render logic
  const copy = appCopy.templates
  const auth = template.category === 'AUTHENTICATION'
  const params = template.examples.map((example, i) => ({ placeholder: `{{${i + 1}}}`, example }))
  const showStatus = statusKnown || template.status !== 'not_submitted'

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-panel-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-body font-semibold text-ink-strong">{label}</p>
          <p className="text-caption text-muted-foreground">
            {copy.name}: <code className="font-mono text-foreground">{template.name}</code> ·{' '}
            {copy.category}: {auth ? copy.authentication : copy.utility} · {copy.language}:{' '}
            {template.language}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showStatus ? (
            <StatusChip tone={TONE[template.status] ?? 'neutral'}>
              {copy.status[template.status] ?? template.status}
            </StatusChip>
          ) : null}
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy aria-hidden="true" className="size-3.5" />
            {copy.copy}
          </Button>
          {onSubmit && !auth && template.status === 'not_submitted' ? (
            <Button variant="outline" size="sm" onClick={onSubmit} disabled={submitting}>
              {submitting ? <Spinner /> : null}
              {copy.submit}
            </Button>
          ) : null}
        </div>
      </div>
      {template.rejectedReason ? (
        <p className="text-caption text-destructive">{copy.reason(template.rejectedReason)}</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-1">
          <p className="text-caption text-muted-foreground">{copy.body}</p>
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-caption break-words whitespace-pre-wrap text-foreground">
            {template.body}
          </p>
          {auth ? <p className="text-caption text-muted-foreground">{copy.authNote}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-caption text-muted-foreground">{copy.params}</p>
          <ol className="flex flex-col gap-0.5 text-caption">
            {params.map(({ placeholder, example }) => (
              <li key={placeholder} className="flex min-w-0 gap-2">
                <code className="shrink-0 font-mono text-muted-foreground">{placeholder}</code>
                <span className="min-w-0 truncate text-foreground" title={example}>
                  {example}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </li>
  )
}
