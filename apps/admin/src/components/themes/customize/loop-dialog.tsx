'use client'

import {
  isCompatible,
  LOOP_MAX,
  type LoopSpec,
  type SettingKind,
} from '@commerce/core/dynamic-sources'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { dynamicSourcesContent } from '@/data/dynamic-sources'
import { guessMap, type LoopCatalog, loadLoopCatalog, sourceFields } from '@/lib/customize-loops'

type LoopDialogProps = {
  /** Each item field that can take a value, with its setting kind and label. */
  kinds: Record<string, SettingKind>
  labels: Record<string, string>
  /** The current loop when changing one; null when linking for the first time. */
  current: LoopSpec | null
  onCancel: () => void
  onConfirm: (spec: LoopSpec) => void
}

const copy = dynamicSourcesContent.loops
const NONE = '__none'

/**
 * "Use content from…": pick a content type or a collection's products, how many rows, and what
 * each row's fields show. The first map is guessed by name and meaning, and can be changed.
 */
export default function LoopDialog({
  kinds,
  labels,
  current,
  onCancel,
  onConfirm,
}: LoopDialogProps) {
  // Hooks
  const [catalog, setCatalog] = useState<LoopCatalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState(current?.source ?? '')
  const [limit, setLimit] = useState(String(current?.limit ?? 6))
  const [map, setMap] = useState<LoopSpec['map']>(current?.map ?? {})

  useEffect(() => {
    let active = true
    loadLoopCatalog().then(
      (next) => active && setCatalog(next),
      () => active && setFailed(true),
    )
    return () => {
      active = false
    }
  }, [])

  // Helpers
  const fieldsOf = (next: string) => sourceFields(next, catalog, copy.product)

  // Event handlers
  const handleSource = (next: unknown) => {
    if (typeof next !== 'string') return
    setSource(next)
    setMap(guessMap(kinds, fieldsOf(next)))
  }
  const handleMap = (field: string, from: unknown) => {
    if (typeof from !== 'string') return
    const kind = kinds[field]
    if (!kind) return
    setMap((m) => ({ ...m, [field]: { from: from === NONE ? '' : from, kind } }))
  }
  const handleConfirm = () => {
    const n = Math.max(1, Math.min(LOOP_MAX, Number.parseInt(limit, 10) || LOOP_MAX))
    // Every field this list can fill is in the map; "Nothing" (from '') empties it on each row.
    const full: LoopSpec['map'] = {}
    for (const [field, kind] of Object.entries(kinds)) {
      full[field] = map[field] ?? { from: '', kind }
    }
    onConfirm({ source, limit: n, map: full })
  }

  // Render logic
  const fields = source ? fieldsOf(source) : []
  const sourceItems = [
    ...(catalog?.types ?? []).map((t) => ({ value: `metaobject:${t.type}`, label: t.name })),
    ...(catalog?.collections ?? []).map((c) => ({
      value: `collection:${c.handle}.products`,
      label: copy.collectionProducts(c.title),
    })),
  ]
  const mapped = Object.values(map).filter((m) => m.from).length
  const empty = catalog && sourceItems.length === 0

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro}</DialogDescription>
        </DialogHeader>
        {failed ? <p className="text-body text-destructive">{copy.failed}</p> : null}
        {empty ? <p className="text-body text-muted-foreground">{copy.empty}</p> : null}
        {!catalog && !failed ? (
          <p className="text-body text-muted-foreground">{copy.loading}</p>
        ) : null}
        {catalog && !empty ? (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="loop-source">{copy.source}</FieldLabel>
              <Select items={sourceItems} value={source || null} onValueChange={handleSource}>
                <SelectTrigger id="loop-source" className="w-full">
                  <SelectValue placeholder={copy.sourcePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {catalog.types.length ? (
                    <SelectGroup>
                      <SelectLabel>{copy.types}</SelectLabel>
                      {catalog.types.map((t) => (
                        <SelectItem key={t.type} value={`metaobject:${t.type}`}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {catalog.collections.length ? (
                    <SelectGroup>
                      <SelectLabel>{copy.collections}</SelectLabel>
                      {catalog.collections.map((c) => (
                        <SelectItem key={c.handle} value={`collection:${c.handle}.products`}>
                          {copy.collectionProducts(c.title)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="loop-limit">{copy.limit}</FieldLabel>
              <Input
                id="loop-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={LOOP_MAX}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-28"
              />
              <FieldDescription>{copy.limitHelp}</FieldDescription>
            </Field>
            {source ? (
              <div className="flex flex-col gap-2">
                <p className="text-body font-medium text-foreground">{copy.map}</p>
                {Object.entries(kinds).map(([field, kind]) => {
                  const options = fields.filter((f) => isCompatible(kind, f.type))
                  const items = [
                    { value: NONE, label: copy.mapNone },
                    ...options.map((f) => ({ value: f.key, label: f.name })),
                  ]
                  return (
                    <div
                      key={field}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3"
                    >
                      <label
                        htmlFor={`loop-map-${field}`}
                        className="truncate text-body text-foreground"
                      >
                        {labels[field] ?? field}
                      </label>
                      <Select
                        items={items}
                        value={map[field]?.from || NONE}
                        onValueChange={(v) => handleMap(field, v)}
                      >
                        <SelectTrigger id={`loop-map-${field}`} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
                <p className="text-caption text-muted-foreground">
                  {fields.length ? copy.mapHelp : copy.noFields}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={!source || mapped === 0} onClick={handleConfirm}>
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
