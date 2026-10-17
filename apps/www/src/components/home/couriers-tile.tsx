import { cn } from '@commerce/ui/lib/utils'
import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.couriers

export default function CouriersTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      layout="side"
      className="lg:col-span-2 lg:min-h-[18.75rem]"
    >
      <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-foreground md:absolute md:top-7 md:left-7 md:mb-0">
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
        {copy.badge}
      </p>
      <ul className="flex flex-col gap-2">
        {copy.options.map((option) => (
          <li
            key={option.code}
            className={cn(
              'flex items-center gap-4 rounded-xl border bg-background px-4 py-3',
              option.selected ? 'border-foreground' : 'border-border',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-3.5 shrink-0 rounded-full border',
                option.selected ? 'border-foreground bg-foreground' : 'border-border-strong',
              )}
            />
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-medium text-foreground">
              {option.code}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {option.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{option.eta}</span>
            </span>
            <span className="text-right">
              <span className="block text-lg font-semibold text-foreground">{option.price}</span>
              <span className="block text-xs text-muted-foreground">{copy.inclGst}</span>
            </span>
          </li>
        ))}
      </ul>
    </BentoTile>
  )
}
