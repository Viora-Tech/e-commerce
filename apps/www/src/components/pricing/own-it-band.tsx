import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { pricingContent } from '@/data/pricing'

const copy = pricingContent.page.ownIt

/** Own it under the plan cards: the self-hosted licence, sold by talking to us, never self-serve. */
export default function OwnItBand() {
  return (
    <section className="surface-card mt-6 flex flex-col gap-4 rounded-3xl p-7 md:flex-row md:items-center md:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">{copy.title}</h3>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <p className="text-sm font-medium text-foreground">{copy.price}</p>
        <p className="text-xs text-muted-foreground">{copy.setup}</p>
      </div>
      <Link href={copy.href} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        {copy.action}
      </Link>
    </section>
  )
}
