import { cn } from '@commerce/ui/lib/utils'
import { homeContent } from '@/data/home'
import BrandLogo from '../common/brand-logo'
import BentoTile from './bento-tile'

const copy = homeContent.india.gateways

export default function GatewaysTile() {
  return (
    <BentoTile eyebrow={copy.eyebrow} title={copy.title} body={copy.body} className="lg:col-span-2">
      <ul className="flex flex-wrap gap-3">
        {copy.items.map((gateway) => (
          <li
            key={gateway.name}
            className="group/logo flex flex-col gap-1 rounded-xl border border-border bg-background px-3 py-3 pr-5"
          >
            <BrandLogo brand={gateway.brand} className="-ml-2" />
            <span
              className={cn(
                'text-xs',
                gateway.connected ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {gateway.status}
            </span>
          </li>
        ))}
      </ul>
    </BentoTile>
  )
}
