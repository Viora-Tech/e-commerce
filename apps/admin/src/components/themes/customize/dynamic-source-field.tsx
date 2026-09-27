'use client'

import { connect, disconnect, isBinding, type SourceOption } from '@commerce/core/dynamic-sources'
import { DynamicSource } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { dynamicSourcesContent as copy } from '@/data/dynamic-sources'
import { iconForField } from '@/lib/customize-field-icons'
import type { FieldLike } from '@/lib/customize-field-shape'
import {
  loadCatalog,
  settingKindOf,
  sourceName,
  useDynamicSourceScope,
} from '@/lib/dynamic-sources'
import DynamicSourceChip from './dynamic-source-chip'
import DynamicSourcePicker from './dynamic-source-picker'
import FieldFrame from './field-frame'

type DynamicSourceFieldProps = {
  field: FieldLike
  name: string
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean | undefined
  /** The field's own control, drawn while the setting is not connected. */
  children: ReactNode
}

/**
 * Wraps an inspector field with Shopify's "Connect dynamic source" (the small
 * database button beside the label). Connected, the control gives way to a chip
 * naming the source, with ✕ to disconnect, which puts the typed-in value back.
 * Fields that cannot be connected (choices, toggles, lists) render untouched.
 */
export default function DynamicSourceField({
  field,
  name,
  value,
  onChange,
  readOnly,
  children,
}: DynamicSourceFieldProps) {
  // Hooks
  const scope = useDynamicSourceScope()
  const [picking, setPicking] = useState(false)
  const [catalog, setCatalog] = useState<SourceOption[] | null>(null)

  // The chip names its source from the template's catalog (fetched once per template).
  useEffect(() => {
    const template = scope?.template
    if (!isBinding(value) || !template) return
    let active = true
    loadCatalog(template).then(
      (next) => active && setCatalog(next),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [value, scope?.template])

  // Event handlers
  const handlePick = (path: string) => {
    setPicking(false)
    const kind = settingKindOf(field, name)
    if (kind) onChange(connect(path, kind, value))
  }

  const handleDisconnect = () => {
    if (isBinding(value)) onChange(disconnect(value))
  }

  // Early returns
  const kind = settingKindOf(field, name)
  if (!kind || !scope) return <>{children}</>

  // Render logic
  const bound = isBinding(value)
  const picker = picking ? (
    <DynamicSourcePicker
      kind={kind}
      template={scope.template}
      current={bound ? value.$source : null}
      onPick={handlePick}
      onClose={() => setPicking(false)}
    />
  ) : null

  if (bound) {
    return (
      <FieldFrame icon={iconForField(field)} label={field.label ?? name}>
        <DynamicSourceChip
          name={sourceName(value.$source, catalog)}
          disabled={readOnly}
          onChange={() => setPicking(true)}
          onDisconnect={handleDisconnect}
        />
        <p className="text-caption text-muted-foreground">{copy.fallbackNote}</p>
        {picker}
      </FieldFrame>
    )
  }

  return (
    <div className="relative">
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => setPicking(true)}
        disabled={readOnly}
        aria-label={copy.connect}
        title={copy.connect}
        className="absolute -top-1 right-0 text-muted-foreground hover:text-primary"
      >
        <DynamicSource aria-hidden className="size-4" />
      </Button>
      {picker}
    </div>
  )
}
