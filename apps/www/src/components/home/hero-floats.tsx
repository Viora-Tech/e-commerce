import { CircleCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { homeContent } from '@/data/home'
import CountUp from '../common/count-up'

const { floats } = homeContent.hero

const FLOAT_CLASS =
  'glass-panel absolute rounded-2xl p-4 text-left [translate:calc(var(--px,0)*0.9rem)_calc(var(--py,0)*0.5rem)] transition-[translate,opacity] duration-500 ease-(--ease-out) motion-reduce:transition-none'

/** Three glass cards floating over the globe: decorative proof of what the product does. */
export default function HeroFloats() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto max-w-page">
      <div className={`${FLOAT_CLASS} top-[38.125rem] left-5 animate-float hidden w-72 lg:block`}>
        <p className="text-eyebrow">{floats.ai.label}</p>
        <p className="mt-3 text-sm font-medium text-foreground">{floats.ai.title}</p>
        <p className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-danger line-through">{floats.ai.from}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-success">{floats.ai.to}</span>
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" tabIndex={-1}>
            {floats.ai.approve}
          </Button>
          <Button variant="ghost" size="sm" tabIndex={-1}>
            {floats.ai.edit}
          </Button>
        </div>
      </div>
      <div
        className={`${FLOAT_CLASS} bottom-24 left-4 w-64 sm:w-72 animate-float group-data-[demo=true]/hero:opacity-0 [animation-delay:-2s] lg:top-[35rem] lg:right-5 lg:bottom-auto lg:left-auto`}
      >
        <p className="flex items-center gap-2 text-eyebrow text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {floats.order.label}
        </p>
        <p className="mt-3 text-sm font-medium text-foreground">{floats.order.title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{floats.order.meta}</p>
      </div>
      <div
        className={`${FLOAT_CLASS} top-[48.75rem] -right-3 animate-float group-data-[demo=true]/hero:opacity-0 [animation-delay:-4s] hidden w-64 lg:block`}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CircleCheck className="size-4 text-success" />
          {floats.upi.title}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <CountUp value={floats.upi.amount} currency />
          {floats.upi.meta}
        </p>
      </div>
    </div>
  )
}
