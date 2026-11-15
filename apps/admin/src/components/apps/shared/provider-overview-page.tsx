'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ProviderOverviewPage, OverviewCopy, OverviewList
 * WHAT:  a provider app's Overview (`/apps/<id>`): connected (and tested) status, what to do next,
 *        and the lists of what the app can and cannot do.
 * WHY:   one owner instead of four copies (Delhivery, Shiprocket, RapidShyp, Decentro); the
 *        "tested" badge reads the same cosmetic flag ProviderConnectPage sets.
 * WHERE: components/apps/{delhivery,shiprocket,rapidshyp,decentro}/overview-page.tsx.
 */

import { CircleCheck, InfoIcon, PlugConnect } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { routes } from '@/lib/routes'
import { useStorageScope } from '@/lib/storage-scope'
import LoadFailedState from './load-failed-state'
import {
  type FieldValues,
  loadProviderSettings,
  readTestedFlag,
  type SettingsKind,
} from './provider-settings'

export type OverviewCopy = {
  title: string
  subtitle: string
  notConnected: string
  connectCta: string
  connected: string
  connectedAndTested: string
}

export type OverviewList = {
  heading: string
  items: string[]
  bulleted?: boolean
  /** Every item is something the app cannot do yet: an info mark, muted, never a green tick. */
  unavailable?: boolean | undefined
  /** What the provider cannot do yet, under the list with an info mark (Figma "Delhivery · Overview"). */
  notAvailable?: string[] | undefined
}

type ProviderOverviewPageProps = {
  providerId: string
  kind: SettingsKind
  icon: ReactNode
  copy: OverviewCopy
  /** Extra condition, on top of being enabled, for "connected" (e.g. keys saved). */
  isConnected?: (saved: FieldValues) => boolean
  /** Badges shown next to "Connected". */
  badges?: (saved: FieldValues) => ReactNode
  /** Under the badges when connected: where to go next. */
  connectedBody: (saved: FieldValues) => ReactNode
  lists: OverviewList[]
  /** Cards after the lists (a courier's tracking webhook address). */
  footer?: ReactNode
}

type Status = { connected: boolean; saved: FieldValues }

const always = () => true

export default function ProviderOverviewPage({
  providerId,
  kind,
  icon,
  copy,
  isConnected = always,
  badges,
  connectedBody,
  lists,
  footer,
}: ProviderOverviewPageProps) {
  // Hooks
  const storageScope = useStorageScope()
  const apps = useCopy(appsContent)
  const {
    data: status,
    failed,
    retry,
  } = useLoad<Status>(async () => {
    const r = await loadProviderSettings(kind)
    const saved = r.settings.providers[providerId] ?? {}
    return { connected: r.settings.enabled.includes(providerId) && isConnected(saved), saved }
  })
  const [tested, setTested] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: read once per mount
  useEffect(() => {
    setTested(readTestedFlag(storageScope, providerId))
  }, [])

  // Render logic
  const extraBadges = status && badges ? badges(status.saved) : null
  const connectedBadge = (
    <StatusChip tone="success" className="w-fit">
      {tested ? copy.connectedAndTested : copy.connected}
    </StatusChip>
  )

  return (
    <div className="flex flex-col gap-4">
      <DataCard
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {copy.title}
            {status?.connected ? connectedBadge : null}
            {status?.connected ? extraBadges : null}
          </span>
        }
        icon={status?.connected ? undefined : icon}
      >
        {failed ? (
          <LoadFailedState heading={apps.couldNotLoad.connection} failed={failed} onRetry={retry} />
        ) : status === null ? (
          // The not-connected line and its button, so the card keeps its height.
          <div className="flex flex-col gap-3" aria-hidden="true">
            <span className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-2/3" />
            </span>
            <Skeleton className="h-9 w-32 rounded-sm" />
          </div>
        ) : status.connected ? (
          <div className="flex flex-col items-start gap-3">{connectedBody(status.saved)}</div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-muted-foreground">{copy.notConnected}</p>
            <Button
              className="w-fit"
              render={<Link href={routes.apps.connect(providerId)} />}
              nativeButton={false}
            >
              <PlugConnect aria-hidden="true" />
              {copy.connectCta}
            </Button>
          </div>
        )}
      </DataCard>

      {lists.map((list) => (
        <DataCard key={list.heading} title={list.heading}>
          <ul
            className={list.bulleted ? 'flex list-disc flex-col gap-2 pl-5' : 'flex flex-col gap-2'}
          >
            {list.items.map((item) => (
              <li
                key={item}
                className={
                  list.bulleted
                    ? 'text-body text-muted-foreground'
                    : list.unavailable
                      ? 'flex items-start gap-2 text-body text-muted-foreground'
                      : 'flex items-start gap-2 text-body text-foreground'
                }
              >
                {list.bulleted ? null : list.unavailable ? (
                  <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                )}
                {item}
              </li>
            ))}
            {(list.notAvailable ?? []).map((item) => (
              <li key={item} className="flex items-start gap-2 text-body text-muted-foreground">
                <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </DataCard>
      ))}
      {footer}
    </div>
  )
}
