'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ProviderOverviewPage, OverviewCopy, OverviewList
 * WHAT:  a provider app's Overview (`/apps/<id>`): connected (and tested) status, what to do next,
 *        and the lists of what the app can and cannot do.
 * WHY:   one owner instead of four copies (Delhivery, Shiprocket, RapidShyp, Decentro); the
 *        "tested" badge reads the same cosmetic flag ProviderConnectPage sets.
 * WHERE: components/apps/{delhivery,shiprocket,rapidshyp,decentro}/overview-page.tsx.
 */

import { CircleCheck } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { routes } from '@/lib/routes'
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

export type OverviewList = { heading: string; items: string[]; bulleted?: boolean }

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
}: ProviderOverviewPageProps) {
  // Hooks
  const [status, setStatus] = useState<Status | null>(null)
  const [tested, setTested] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once per mount
  useEffect(() => {
    let cancelled = false
    loadProviderSettings(kind).then((r) => {
      const saved = r.settings.providers[providerId] ?? {}
      if (cancelled) return
      setStatus({
        connected: r.settings.enabled.includes(providerId) && isConnected(saved),
        saved,
      })
    })
    setTested(readTestedFlag(providerId))
    return () => {
      cancelled = true
    }
  }, [])

  // Render logic
  const extraBadges = status && badges ? badges(status.saved) : null
  const connectedBadge = (
    <Badge variant="outline" className="w-fit gap-1 text-success">
      <CircleCheck aria-hidden="true" className="size-3.5" />
      {tested ? copy.connectedAndTested : copy.connected}
    </Badge>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <DataCard title={copy.title} icon={icon}>
        {status === null ? null : status.connected ? (
          <div className="flex flex-col gap-3">
            {extraBadges ? (
              <div className="flex flex-wrap gap-2">
                {connectedBadge}
                {extraBadges}
              </div>
            ) : (
              connectedBadge
            )}
            {connectedBody(status.saved)}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-muted-foreground">{copy.notConnected}</p>
            <Button
              className="w-fit"
              render={<Link href={routes.apps.connect(providerId)} />}
              nativeButton={false}
            >
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
              <li key={item} className="text-body text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </DataCard>
      ))}
    </div>
  )
}
