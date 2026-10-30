'use client'

import type { RolloutThemeOption } from '@commerce/core'
import { Copy, Palette, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type RolloutThemeChangeProps = {
  themeId: string
  themes: RolloutThemeOption[]
  disabled: boolean
  /** "Edit theme for this rollout" copies the live theme: Online store write. */
  canCopy: boolean
  onChange: (themeId: string) => void
  onRemove: () => void
}

/**
 * The theme the rollout publishes, from the library, or a copy of the live theme made here
 * (Shopify's "Edit theme for this rollout"), opened in Customize.
 */
export default function RolloutThemeChange({
  themeId,
  themes: initial,
  disabled,
  canCopy,
  onChange,
  onRemove,
}: RolloutThemeChangeProps) {
  // Hooks
  const {
    form: { theme: copy, changes },
  } = useCopy(rolloutsContent)
  const [themes, setThemes] = useState(initial)
  const [copying, setCopying] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    const live = themes.find((t) => t.live)
    if (!live) return
    setCopying(true)
    try {
      const made = await api.themes.duplicate({ id: live.id })
      setThemes((all) => [...all, { id: made.id, name: made.name, live: false }])
      onChange(made.id)
      toast.success(copy.copied)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCopying(false)
    }
  }

  // Render logic
  const items = themes.map((t) => ({
    value: t.id,
    label: t.live ? `${t.name} (${copy.live})` : t.name,
  }))
  const picked = themes.find((t) => t.id === themeId)
  const missing = themeId !== '' && !picked

  return (
    <DataCard
      title={copy.heading}
      icon={<Palette aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        disabled ? null : (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            {changes.remove}
          </Button>
        )
      }
      footer={
        disabled ? null : (
          <>
            {picked && !picked.live ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={routes.onlineStore.themeEditor(picked.id)} />}
              >
                {copy.customize}
              </Button>
            ) : null}
            {canCopy ? (
              <Button variant="outline" onClick={handleCopy} disabled={copying}>
                <Copy aria-hidden="true" />
                {copying ? copy.copying : copy.editCopy}
              </Button>
            ) : null}
          </>
        )
      }
    >
      <Field data-invalid={missing ? true : undefined}>
        <FieldLabel htmlFor="rollout-theme">{copy.pick}</FieldLabel>
        <Select
          items={items}
          value={picked ? themeId : null}
          disabled={disabled}
          onValueChange={(v) => {
            if (typeof v === 'string' && v) onChange(v)
          }}
        >
          <SelectTrigger id="rollout-theme" className="w-full sm:w-96">
            <SelectValue placeholder={copy.pickPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {missing ? (
          <FieldError>{copy.deleted}</FieldError>
        ) : canCopy && !disabled ? (
          <FieldDescription>{copy.editCopyHelp}</FieldDescription>
        ) : null}
      </Field>
    </DataCard>
  )
}
