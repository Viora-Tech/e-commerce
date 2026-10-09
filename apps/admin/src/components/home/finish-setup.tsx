import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { homePageContent } from '@/data/home'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import type { HomeSignals } from './home-signals'
import SectionHead from './section-head'

type FinishSetupProps = {
  productCount: number
  signals: HomeSignals
}

type Step = { key: string; title: string; body: string; done: boolean; href: string }

/**
 * Three set-up cards (products, payments, shipping), shown only while one is still open.
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
      href: routes.apps.list(),
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHead title={c.title} aside={c.progress(doneCount, steps.length)} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="flex h-full items-center gap-3 rounded-xl surface-card p-4 transition-shadow duration-150 ease-out hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-caption',
                  step.done
                    ? 'bg-primary-soft text-primary'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {step.done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body-strong text-ink-strong">
                  {step.title}
                </span>
                <span className="block truncate text-caption font-normal text-muted-foreground">
                  {step.body}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
