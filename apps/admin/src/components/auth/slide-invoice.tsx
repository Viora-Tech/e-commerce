import { FileText } from '@commerce/ui/icons'
import GlassCard from '@/components/auth/glass-card'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'

export default function SlideInvoice() {
  // Hooks
  const { panel } = useCopy(loginContent)

  return (
    <div className="relative h-72 w-80" aria-hidden>
      <GlassCard className="absolute top-0 left-0 w-60 -rotate-2 p-4">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-tint text-primary">
            <FileText className="size-4" />
          </span>
          <span className="flex-1 text-body-strong text-ink-strong">{panel.invoice.title}</span>
        </span>
        <span className="mt-3 flex flex-col gap-1.5">
          <span className="h-2 w-full rounded-full bg-border" />
          <span className="h-2 w-4/5 rounded-full bg-border" />
          <span className="h-2 w-3/5 rounded-full bg-border" />
        </span>
        <span className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-caption text-helper">{panel.invoice.gst}</span>
          <span className="font-display text-stat-sm text-ink-strong">{panel.invoice.total}</span>
          <span className="rounded-md border border-border px-2 py-0.5 text-caption text-helper">
            {panel.invoice.status}
          </span>
        </span>
      </GlassCard>
      <GlassCard className="absolute right-0 bottom-4 w-60 rotate-1 rounded-bl-sm bg-success/10">
        <span className="text-body text-ink-strong">{panel.whatsapp}</span>
      </GlassCard>
    </div>
  )
}
