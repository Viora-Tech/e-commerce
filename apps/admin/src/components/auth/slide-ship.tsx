import { CheckIcon, Printer, Truck } from '@commerce/ui/icons'
import GlassCard from '@/components/auth/glass-card'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'

export default function SlideShip() {
  // Hooks
  const { panel } = useCopy(loginContent)

  return (
    <div className="flex h-72 w-80 flex-col justify-center gap-3" aria-hidden>
      {panel.couriers.map((courier, i) => (
        <GlassCard
          key={courier.name}
          className={`flex items-center gap-3 ${i === 0 ? 'border-primary/50' : ''}`}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
            <Truck className="size-4" />
          </span>
          <span className="flex-1">
            <span className="block text-body-strong text-ink-strong">{courier.name}</span>
            <span className="block text-caption text-helper">{courier.eta}</span>
          </span>
          <span className="font-display text-stat-sm text-ink-strong">{courier.price}</span>
        </GlassCard>
      ))}
      <GlassCard className="mt-1 flex items-center gap-2 self-center rounded-full py-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckIcon className="size-3.5" />
        </span>
        <Printer className="size-4 text-helper" />
        <span className="text-body-strong text-ink-strong">{panel.labelPrinted}</span>
      </GlassCard>
    </div>
  )
}
