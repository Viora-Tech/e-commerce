import { ArrowUp, ShoppingBag, Truck } from '@commerce/ui/icons'
import GlassCard from '@/components/auth/glass-card'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'

const SPARK = '0,34 14,28 28,31 42,22 56,25 70,15 84,18 98,8 112,12 126,3'

export default function SlideOrders() {
  // Hooks
  const { panel } = useCopy(loginContent)

  return (
    <div className="relative h-72 w-80" aria-hidden>
      <GlassCard className="absolute top-0 left-0 flex w-72 -rotate-3 items-center gap-3 whitespace-nowrap">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
          <ShoppingBag className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block text-body-strong text-ink-strong">{panel.order.title}</span>
          <span className="block text-caption text-helper">{panel.order.meta}</span>
        </span>
        <span className="rounded-md border border-border px-2 py-0.5 text-caption text-helper">
          {panel.order.paid}
        </span>
      </GlassCard>
      <GlassCard className="absolute top-20 right-0 w-64 rotate-2 p-4">
        <span className="flex items-center justify-between">
          <span className="text-caption text-helper">{panel.sales.label}</span>
          <span className="flex items-center gap-0.5 rounded-md bg-success/10 px-1.5 py-0.5 text-caption text-success">
            <ArrowUp className="size-3" />
            {panel.sales.change}
          </span>
        </span>
        <span className="mt-1 block font-display text-stat text-ink-strong">
          {panel.sales.value}
        </span>
        <svg viewBox="0 0 126 38" className="mt-2 h-10 w-full" fill="none" aria-hidden>
          <polyline
            points={SPARK}
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </GlassCard>
      <GlassCard className="absolute bottom-2 left-6 flex w-60 -rotate-1 items-center gap-3 rounded-full py-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-success/10 text-success">
          <Truck className="size-4" />
        </span>
        <span>
          <span className="block text-body-strong text-ink-strong">{panel.shipped.title}</span>
          <span className="block text-caption text-helper">{panel.shipped.meta}</span>
        </span>
      </GlassCard>
    </div>
  )
}
