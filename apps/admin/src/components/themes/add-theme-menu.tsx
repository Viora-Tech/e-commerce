'use client'

import { Copy, Palette, Upload } from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type AddThemeMenuProps = {
  disabled?: boolean
  onAddPreset: () => void
  /** Copies the live theme; absent when there is none. */
  onDuplicateLive?: (() => void) | undefined
}

/**
 * Figma "Add theme" (683:79822): one dropdown button for every way a theme arrives - upload a
 * Shopify theme zip, start from a preset, or copy the live theme.
 */
export default function AddThemeMenu({
  disabled,
  onAddPreset,
  onDuplicateLive,
}: AddThemeMenuProps) {
  // Hooks
  const copy = useCopy(themesContent.library)

  // Render logic
  return (
    <ActionMenu
      label={copy.add}
      trigger="button"
      align="end"
      disabled={disabled}
      items={[
        { label: copy.uploadZip, icon: Upload, href: routes.onlineStore.themeImportNew() },
        { label: copy.addFromPreset, icon: Palette, onSelect: onAddPreset },
        {
          label: copy.duplicateCurrent,
          icon: Copy,
          onSelect: onDuplicateLive,
          hidden: !onDuplicateLive,
        },
      ]}
    />
  )
}
