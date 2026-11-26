'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import LoyaltyPageCard from '@/components/apps/loyalty/loyalty-page-card'
import PlacementArt from '@/components/apps/loyalty/placement-art'
import SetupBar from '@/components/apps/loyalty/setup-bar'
import { loadSetupData } from '@/components/apps/loyalty/setup-state'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SectionHead from '@/components/layout/section-head'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyPlacementsContent } from '@/data/loyalty-placements'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import {
  customizeHref,
  LOYALTY_PAGES,
  LOYALTY_PLACEMENTS,
  type Placement,
  placementEmbedType,
} from '@/lib/loyalty-placements'

type CardStatus = 'live' | 'disabled' | 'ready'

/** The chip tone for each status. */
const TONE = { live: 'success', disabled: 'neutral', ready: 'info' } as const

/**
 * Essential's three words: an embed switched on is Live, switched off (or no live theme) is
 * Disabled. The product line and cart box follow the widget embed that injects them; the card
 * points block is Ready, since whether a template holds it is not read here.
 */
function cardStatus(
  p: Placement,
  appEmbeds: Record<string, { enabled: boolean }> | null,
): CardStatus {
  const embed = placementEmbedType(p)
  if (!embed) return 'ready'
  return appEmbeds?.[embed]?.enabled ? 'live' : 'disabled'
}

/** Where a card's Customize button opens: the widget embed for what it injects. */
function placementHref(editor: string, p: Placement): string {
  const embed = placementEmbedType(p)
  return embed ? customizeHref(editor, 'embed', embed) : customizeHref(editor, p.kind, p.type)
}

/**
 * Onsite elements (Essential Loyalty's Placements layout): the setup bar with "Enable app
 * embed", then the onsite content cards: the floating widget and the referral pop-up (app
 * embeds, Live or Disabled from the live theme), the product line and cart box (they come with
 * the widget) and the card points (an app block, Ready); each opens Customize. Then the pages
 * the program adds, switched on and off here: the landing page (Embedded content) and the
 * account's Points section and status card (Customer accounts).
 */
export default function LoyaltyPlacementsPage() {
  // Hooks
  const copy = useCopy(loyaltyPlacementsContent)
  const { data, failed, retry } = useLoad(loadSetupData)
  const [saved, setSaved] = useState<LoyaltySettings | null>(null)

  // Early returns
  // This page is about the theme: a failed theme read is the page's error.
  if (failed || (data && data.theme === undefined)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} summary={copy.subtitle} />
        <LoadFailedState
          size="page"
          heading={copy.loadFailed}
          failed={failed || undefined}
          onRetry={retry}
        />
      </div>
    )
  }
  if (!data) {
    return <SectionPageSkeleton cards={5} title={copy.title} subtitle={copy.subtitle} />
  }

  // Render logic
  const editor = data.theme?.editor ?? null
  const embeds = data.theme?.appEmbeds ?? null
  const settings = saved ?? data.settings
  const pageSections = (['embedded', 'accounts'] as const).map((section) => ({
    section,
    pages: LOYALTY_PAGES.filter((p) => p.section === section),
  }))

  return (
    // Essential Loyalty's column: about 50rem, centred (tables stay full width).
    <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      {editor ? null : (
        <p className="rounded-lg border border-line bg-muted px-4 py-3 text-body text-muted-foreground">
          {copy.noTheme}
        </p>
      )}
      <SetupBar
        live={data.settings.programStatus === 'live'}
        placementsOn={data.placementsOn}
        ratePercent={data.ratePercent}
        action={
          editor ? (
            <Button
              nativeButton={false}
              render={<Link href={customizeHref(editor, 'embed', 'loyalty/Widget')} />}
            >
              {copy.enableEmbed}
            </Button>
          ) : null
        }
      />
      <section className="flex flex-col gap-3">
        <SectionHead title={copy.section} />
        <div className="grid gap-5 md:grid-cols-2">
          {LOYALTY_PLACEMENTS.map((p) => {
            const status = cardStatus(p, embeds)
            const item = copy.items[p.id]
            return (
              <DataCard
                key={p.id}
                title={item.title}
                action={<StatusChip tone={TONE[status]}>{copy.status[status]}</StatusChip>}
              >
                <div className="flex items-end gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <p className="text-body text-foreground">{item.body}</p>
                    <p className="text-caption text-muted-foreground">
                      {copy.where[p.kind === 'block' && placementEmbedType(p) ? 'widget' : p.kind]}
                    </p>
                    {editor ? (
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={placementHref(editor, p)} />}
                        >
                          {copy.open}
                          <ExternalLink />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <PlacementArt id={p.id} />
                </div>
              </DataCard>
            )
          })}
        </div>
      </section>
      {pageSections.map(({ section, pages }) => (
        <section key={section} className="flex flex-col gap-3">
          <SectionHead title={copy.pages[section]} />
          <div className="grid gap-5 md:grid-cols-2">
            {pages.map((p) => (
              <LoyaltyPageCard
                key={p.id}
                page={p}
                settings={settings}
                origin={data.origin}
                onSaved={setSaved}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
