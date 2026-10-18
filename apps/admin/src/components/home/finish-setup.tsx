import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import SectionHead from '@/components/layout/section-head'
import { homePageContent } from '@/data/home'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import type { HomeSignals } from './home-signals'
import SetupTick from './setup-tick'

type FinishSetupProps = {
  productCount: number
  signals: HomeSignals
}

type Step = { key: string; title: string; body: string; done: boolean; href: string }

/**
 * Three set-up cards (products, payments, shipping), always shown; done ones are ticked.
 * A done card is ticked and quiet; an open one links to where it gets done.
 */
export default async function FinishSetup({ productCount, signals }: FinishSetupProps) {
  // Render logic
  const c = (await getCopy(homePageContent)).setup
  const steps: Step[] = [
    {
      key: 'products',
      title: c.products.title,
      body: productCount > 0 ? c.products.done(productCount) : c.products.todo,
      done: productCount > 0,
      href: routes.products.new(),
    },
    {
      key: 'payments',
      title: c.payments.title,
      body: signals.payments ? c.payments.done(signals.payments) : c.payments.todo,
      done: signals.payments !== null,
      href: routes.settings.payments(),
    },
    {
      key: 'shipping',
      title: c.shipping.title,
      body: signals.shipping ? c.shipping.done(signals.shipping) : c.shipping.todo,
      done: signals.shipping !== null,
      href: routes.apps.store(),
    },
  ]
  // Always shown (Figma 224:584); finished steps stay, ticked.
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHead title={c.title} aside={c.progress(doneCount, steps.length)} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={cn(
                'flex h-full min-h-[4.9375rem] items-start gap-3.5 rounded-lg p-4 surface-card card-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                /* Figma "Home · Polished": finished steps sit back, the next one is outlined. */
                step.done ? 'opacity-55 hover:opacity-100' : 'items-center ring-1 ring-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-[1.625rem] shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  // Figma 224:591 "Tick done": the key material (gradient, rim, lip, glow).
                  step.done ? 'key-primary' : 'border border-border text-muted-foreground',
                )}
              >
                {step.done ? <SetupTick /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink-strong">
                  {step.title}
                </span>
                <span className="mt-1 block truncate text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
                  {step.body}
                </span>
              </span>
              {step.done ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'sm' }),
                    'shrink-0 self-center',
                  )}
                >
                  {c.openCta}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
