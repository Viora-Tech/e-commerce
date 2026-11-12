'use client'

import { Button } from '@commerce/ui/shadcn/button'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { honoProductContent } from '@/data/hono-product'
import { useCopy } from '@/hooks/use-copy'

type HonoProductCardProps = {
  checked: boolean
  onChange: (on: boolean) => void
  /** The storefront link that previews it in this browser (`?hono=<signed token>`). */
  previewHref: string
  /** The storefront link that stops the preview in this browser (`?hono=clear`). */
  stopHref: string
}

/**
 * Online store › Preferences › Faster product pages (beta): the store owner's switch for product
 * pages drawn by the Bun + Hono service (`delivery.honoProduct`), and a link to try them in their
 * own browser first. The page renders it for the owner only; the API keeps the switch as stored
 * for anyone else's save.
 */
export default function HonoProductCard({
  checked,
  onChange,
  previewHref,
  stopHref,
}: HonoProductCardProps) {
  // Hooks
  const copy = useCopy(honoProductContent)

  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      <SettingsToggleRow
        id="delivery-hono-product"
        label={copy.toggle}
        description={copy.toggleHelp}
        checked={checked}
        onChange={onChange}
      />
      <p className="text-body text-muted-foreground">{copy.previewHelp}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          render={<a href={stopHref} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          {copy.previewOff}
        </Button>
        <Button
          variant="outline"
          render={<a href={previewHref} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          {copy.preview}
        </Button>
      </div>
    </SettingsCard>
  )
}
