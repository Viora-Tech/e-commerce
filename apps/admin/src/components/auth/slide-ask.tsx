import { AiIcon } from '@commerce/ui/icons'
import GlassCard from '@/components/auth/glass-card'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'

const WIDTHS = ['w-full', 'w-3/5', 'w-2/5']

export default function SlideAsk() {
  // Hooks
  const { panel } = useCopy(loginContent)

  return (
    <div className="flex h-72 w-80 flex-col justify-center gap-3" aria-hidden>
      <GlassCard className="ml-10 rounded-br-sm border-primary bg-primary text-primary-foreground">
        <span className="text-body">{panel.ai.question}</span>
      </GlassCard>
      <GlassCard className="mr-6 flex flex-col gap-3 rounded-bl-sm">
        <span className="flex items-start gap-2">
          <AiIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="text-body text-ink-strong">{panel.ai.answer}</span>
        </span>
        <span className="flex flex-col gap-2">
          {panel.ai.bars.map((name, i) => (
            <span key={name} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-caption text-helper">{name}</span>
              <span className="h-2 flex-1 rounded-full bg-primary-tint">
                <span className={`block h-2 rounded-full bg-primary ${WIDTHS[i]}`} />
              </span>
            </span>
          ))}
        </span>
      </GlassCard>
    </div>
  )
}
