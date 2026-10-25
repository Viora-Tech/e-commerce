import { cn } from '@commerce/ui/lib/utils'
import { homeContent } from '@/data/home'
import { BRANDS } from '@/data/logos'
import BrandLogo from '../common/brand-logo'
import BentoTile from './bento-tile'

const copy = homeContent.india.gateways

/** The gateways card: one panel per gateway with what it takes, and which one is switched on. */
export default function GatewaysTile() {
  return (
    <BentoTile eyebrow={copy.eyebrow} title={copy.title} body={copy.body} className="lg:col-span-2">
      <div className="flex flex-col gap-3">
        <ul className="grid gap-3 sm:grid-cols-3">
          {copy.items.map((gateway) => (
            <li
              key={gateway.name}
              className={cn(
                'group/logo flex flex-col gap-4 rounded-2xl border bg-background p-4',
                gateway.connected ? 'border-success/40' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center">
                  <BrandLogo brand={gateway.brand} className="-ml-2" />
                  {/* An icon-only mark (Razorpay) gets its name; wordmarks already show it. */}
                  {BRANDS[gateway.brand].ratio <= 1 && (
                    <span className="text-sm font-semibold text-foreground">{gateway.name}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
                    gateway.connected
                      ? 'bg-success/10 text-success'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 rounded-full',
                      gateway.connected ? 'bg-success' : 'bg-muted-foreground/50',
                    )}
                  />
                  {gateway.status}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label={`${gateway.name} takes`}>
                {gateway.methods.map((method) => (
                  <li
                    key={method}
                    className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {method}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{copy.note}</p>
      </div>
    </BentoTile>
  )
}
