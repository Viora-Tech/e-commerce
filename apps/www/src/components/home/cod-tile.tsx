import { WhatsappLogo_ as WhatsappLogo } from '@commerce/ui/icons'
import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.cod

export default function CodTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      className="min-h-[18.75rem]"
    >
      <div className="flex flex-col gap-3">
        <div className="flex max-w-[18.75rem] flex-col gap-3 rounded-xl bg-muted p-3.5 text-sm text-foreground">
          <p>{copy.message}</p>
          <div className="flex gap-2">
            <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium">
              {copy.confirm}
            </span>
            <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium">
              {copy.cancel}
            </span>
          </div>
        </div>
        <p className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-success">
          <WhatsappLogo aria-hidden className="size-3.5" />
          {copy.confirmed}
        </p>
      </div>
    </BentoTile>
  )
}
