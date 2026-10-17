import { cn } from '@commerce/ui/lib/utils'
import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.gateways

export default function GatewaysTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      className="min-h-[18.75rem] lg:col-span-2"
    >
      <ul className="flex flex-wrap gap-3">
        {copy.items.map((gateway) => (
          <li
            key={gateway.name}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 pr-5"
          >
            <span className="grid size-10 place-items-center rounded-lg bg-muted text-sm font-semibold text-foreground">
              {gateway.initial}
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">{gateway.name}</span>
              <span
                className={cn(
                  'block text-xs',
                  gateway.connected ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {gateway.status}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </BentoTile>
  )
}
