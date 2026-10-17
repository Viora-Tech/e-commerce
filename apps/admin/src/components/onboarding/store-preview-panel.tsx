'use client'

import type { SellsOn, SellsWhat } from '@commerce/core/onboarding'
import KeyValueList from '@/components/layout/key-value-list'
import { COUNTRIES } from '@/data/countries'
import { onboardingContent } from '@/data/onboarding'
import { useCopy } from '@/hooks/use-copy'

type StorePreviewPanelProps = {
  name: string
  address: string
  sells: SellsWhat | null
  country: string
  state: string
  sellsOn: SellsOn | null
}

/** Figma "Creating your store": the store card filling in beside the questions as they are answered. */
export default function StorePreviewPanel({
  name,
  address,
  sells,
  country,
  state,
  sellsOn,
}: StorePreviewPanelProps) {
  // Hooks
  const copy = useCopy(onboardingContent)

  // Render logic
  const p = copy.preview
  const countryName = COUNTRIES.find((c) => c.code === country)?.name ?? country
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  return (
    <section className="relative hidden overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary-tint via-primary-soft to-primary/30 lg:flex lg:flex-col lg:gap-10 lg:p-10">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-muted-foreground">{p.eyebrow}</p>
        <h2 className="text-page-title text-ink-strong">{p.heading(name.trim())}</h2>
        <p className="text-body text-muted-foreground">{p.body}</p>
      </div>
      <div className="w-full max-w-sm rounded-xl surface-card p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-card text-body-strong text-ink-strong shadow-input">
            {initial}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body-strong text-ink-strong">{name || p.pending}</span>
            <span className="truncate text-caption text-muted-foreground">{address}</span>
          </div>
        </div>
        <KeyValueList
          variant="grid"
          rows={[
            { label: p.sells, value: sells ? copy.sellsWhat.options[sells] : p.pending },
            {
              label: p.based,
              value: state ? `${state}, ${countryName}` : country ? countryName : p.pending,
            },
            { label: p.sellsOn, value: sellsOn ? p.sellsOnShort[sellsOn] : p.pending },
          ]}
        />
      </div>
    </section>
  )
}
