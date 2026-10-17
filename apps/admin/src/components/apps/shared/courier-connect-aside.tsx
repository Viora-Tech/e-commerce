'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CourierConnectAside
 * WHAT:  the side cards of a courier's Connect page: the connection at a glance with "Test again",
 *        what the account links, and where to find its key.
 * WHY:   Figma "Delhivery · Connect" right column, the same for every courier.
 * WHERE: the `aside` slot of ProviderConnectPage in the courier Connect wrappers.
 */

import { siteConfig } from '@commerce/config/site'
import { CheckIcon, CircleCheck, ExternalLink, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { connectAsideContent } from '@/data/connect-aside'
import { useCopy } from '@/hooks/use-copy'
import type { ModeSwitch } from './connect-mode-switch'
import type { ConnectContext, TestOutcome } from './provider-connect-page'

type CourierConnectAsideProps = {
  providerId: string
  ctx: ConnectContext<TestOutcome>
  /** The field holding the pickup location's name (couriers spell it differently). */
  pickupKey: string
  mode?: ModeSwitch | undefined
}

export default function CourierConnectAside({
  providerId,
  ctx,
  pickupKey,
  mode,
}: CourierConnectAsideProps) {
  // Hooks
  const copy = useCopy(connectAsideContent)

  // Render logic
  const saved = ctx.savedValues
  const about = copy.providers[providerId]
  const testing = ctx.testStatus === 'testing'
  const pin = (saved.originPincode ?? '').trim()
  const rows = [
    ...(mode
      ? [{ label: copy.mode, value: mode.read(saved) === 'test' ? copy.test : copy.live }]
      : []),
    {
      label: copy.originPin,
      value: pin ? (
        <span className="inline-flex items-center gap-1">
          {pin}
          {ctx.lastPassed ? (
            <CheckIcon aria-hidden="true" className="size-3.5 text-success" />
          ) : null}
        </span>
      ) : (
        '—'
      ),
    },
    { label: copy.pickup, value: (saved[pickupKey] ?? '').trim() || '—' },
    {
      label: copy.lastChecked,
      value: ctx.checkedAt ? <RelativeTime value={ctx.checkedAt} /> : copy.notChecked,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <DataCard
        title={
          <span className="inline-flex items-center gap-2">
            {copy.connection}
            <StatusChip tone={ctx.enabled ? 'success' : 'neutral'}>
              {ctx.enabled ? copy.connected : copy.notConnected}
            </StatusChip>
          </span>
        }
      >
        <div className="flex flex-col gap-3">
          <KeyValueList rows={rows} variant="grid" />
          <Button variant="outline" onClick={ctx.runTest} disabled={testing}>
            {testing ? <Spinner /> : <RefreshCw aria-hidden="true" />}
            {testing ? copy.testing : copy.testAgain}
          </Button>
        </div>
      </DataCard>
      {about ? (
        <>
          <DataCard title={copy.connectsTitle}>
            <ul className="flex flex-col gap-2">
              {about.connects.map((line) => (
                <li key={line} className="flex items-start gap-2 text-body text-foreground">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
          </DataCard>
          <DataCard title={about.helpTitle}>
            <div className="flex flex-col gap-3">
              <p className="text-body text-muted-foreground">{about.helpBody}</p>
              <Button
                variant="ghost"
                className="w-fit"
                nativeButton={false}
                render={<a href={siteConfig.urls.docs} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                {copy.guide}
              </Button>
            </div>
          </DataCard>
        </>
      ) : null}
    </div>
  )
}
