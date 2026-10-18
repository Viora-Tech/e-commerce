import { CheckIcon, WhatsappLogo_ as WhatsappLogo } from '@commerce/ui/icons'
import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.recovery

/** Abandoned-cart recovery on WhatsApp: the reminder lands, then the delivered ticks appear on hover. */
export default function CartRecoveryTile() {
  return (
    <BentoTile eyebrow={copy.eyebrow} title={copy.title} body={copy.body}>
      <div className="flex flex-col gap-3">
        <p className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          <WhatsappLogo aria-hidden className="size-3.5" />
          {copy.when}
        </p>
        <div className="flex max-w-[18.75rem] flex-col gap-2 rounded-xl bg-muted p-3.5 text-sm text-foreground">
          <p>{copy.message}</p>
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-background px-2 py-0.5 font-medium text-foreground">
              {copy.cta}
            </span>
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity delay-200 duration-500 group-hover:opacity-100 motion-reduce:opacity-100">
              <CheckIcon aria-hidden className="size-3.5" />
              <CheckIcon aria-hidden className="-ml-2 size-3.5" />
              {copy.delivered}
            </span>
          </p>
        </div>
      </div>
    </BentoTile>
  )
}
