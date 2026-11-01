'use client'

import type { StorePreferences } from '@commerce/core/preferences'
import DataCard from '@/components/layout/data-card'
import FallbackImage from '@/components/layout/fallback-image'
import { preferencesContent as copy } from '@/data/preferences'

type PreferencesPreviewsProps = {
  seo: StorePreferences['seo']
  /** The storefront's address, e.g. https://waimers.in. */
  origin: string
  /** Stands in for a blank title, as it does on the storefront. */
  storeName: string
}

/** Figma Preferences side column: how the home page shows on Google and when shared on WhatsApp. */
export default function PreferencesPreviews({ seo, origin, storeName }: PreferencesPreviewsProps) {
  // Render logic
  const host = origin.replace(/^https?:\/\//, '')
  const title = seo.title || storeName || host
  const brand = host.split('.')[0] ?? host

  return (
    <>
      <DataCard title={copy.seo.preview}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full border border-border text-caption text-ink-strong uppercase">
              {brand.charAt(0)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-caption text-ink-strong">{brand}</span>
              <span className="truncate text-caption text-muted-foreground">{origin}</span>
            </span>
          </div>
          <p className="text-[1.125rem] leading-snug text-info">{title}</p>
          <p className="line-clamp-3 text-caption text-muted-foreground">
            {seo.description || copy.share.noDescription}
          </p>
        </div>
      </DataCard>
      <DataCard title={copy.share.heading} subtitle={copy.share.body}>
        <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
          <FallbackImage
            src={seo.image?.url}
            className="aspect-[1200/628] w-full object-cover"
            fallback={
              <span className="flex aspect-[1200/628] w-full items-center justify-center text-body font-semibold tracking-[0.2em] text-ink-strong uppercase">
                {brand}
              </span>
            }
          />
          <div className="flex flex-col gap-0.5 p-3">
            <p className="line-clamp-1 text-body text-ink-strong">{title}</p>
            {seo.description ? (
              <p className="line-clamp-2 text-caption text-muted-foreground">{seo.description}</p>
            ) : null}
            <p className="text-caption text-muted-foreground">{host}</p>
          </div>
        </div>
      </DataCard>
    </>
  )
}
