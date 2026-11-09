'use client'

import { type FieldValidations, METAFIELD_OWNER_PERMISSIONS } from '@commerce/core/metaobjects'
import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { type RefObject, useEffect, useState } from 'react'
import { toast } from 'sonner'
import FieldInput from '@/components/metaobjects/field-input'
import { fieldErrorsOf } from '@/components/metaobjects/form-state'
import { CUSTOM_DATA_OWNERS } from '@/data/custom-data'
import { metafieldsCardContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Definition = Awaited<ReturnType<typeof api.metaobjects.metafields>>['definitions'][number]
/** Field values by variant id, then by definition id. */
type Values = Record<string, Record<string, unknown>>

type VariantMetafieldsCardProps = {
  /** Saved variants only: a variant needs an id before its fields can be stored. */
  variants: { id: string; label: string }[]
  /** The saved variants' ids joined (`a,b`): the grid reloads only when they change. */
  variantKey: string
  /** Some variants are new (not saved yet): they get a row after the product is saved. */
  hasUnsaved: boolean
  /** The product form calls this from its Save: writes every variant whose fields changed. */
  saveRef: RefObject<(() => Promise<boolean>) | null>
  /** Tells the product form whether any variant field has unsaved changes (its save bar). */
  onDirtyChange: (dirty: boolean) => void
  /** Bumped by the page's Discard: the grid goes back to its saved values. */
  resetSignal: number
}

const changed = (a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) =>
  JSON.stringify(a ?? {}) !== JSON.stringify(b ?? {})

/** The variants whose fields differ from what is saved. */
const dirtyIdsOf = (variants: { id: string }[], values: Values, saved: Values): string[] =>
  variants.filter((v) => changed(values[v.id], saved[v.id])).map((v) => v.id)

/**
 * Variant metafields as a grid (#894): one row per variant, one column per variant field from
 * Settings → Custom data → Variants, so every variant is filled in without switching between
 * them, and nothing typed is lost. Saved with the product page's Save changes. Hidden until the
 * store has a variant field.
 */
export default function VariantMetafieldsCard({
  variants,
  variantKey,
  hasUnsaved,
  saveRef,
  onDirtyChange,
  resetSignal,
}: VariantMetafieldsCardProps) {
  // Hooks
  const copy = useCopy(metafieldsCardContent)
  const { hasPermission } = usePermissions()
  const [definitions, setDefinitions] = useState<Definition[] | null>(null)
  const [values, setValues] = useState<Values>({})
  const [saved, setSaved] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({})

  useEffect(() => {
    let live = true
    const list = variantKey ? variantKey.split(',') : []
    if (list.length === 0) {
      setDefinitions([])
      return
    }
    // Every variant in one call (it used to be one request per variant).
    api.metaobjects
      .variantMetafields({ variantIds: list })
      .then((res) => {
        if (!live) return
        const loaded = Object.fromEntries(list.map((id) => [id, res.values[id] ?? {}]))
        setDefinitions(res.definitions)
        setValues(loaded)
        setSaved(loaded)
        setErrors({})
      })
      .catch(() => live && setDefinitions([]))
    return () => {
      live = false
    }
  }, [variantKey])

  // The page's Discard: back to the saved values (the first run, at 0, changes nothing).
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on the Discard signal only.
  useEffect(() => {
    if (resetSignal === 0) return
    setValues(saved)
    setErrors({})
  }, [resetSignal])

  // The page's save bar: any variant with unsaved fields. The parent ignores a repeated value.
  useEffect(() => {
    onDirtyChange(dirtyIdsOf(variants, values, saved).length > 0)
  })

  // The product form's Save calls this; it writes only the variants that changed.
  useEffect(() => {
    saveRef.current = async () => {
      const dirtyIds = dirtyIdsOf(variants, values, saved)
      if (!definitions || dirtyIds.length === 0) return true
      let ok = true
      for (const ownerId of dirtyIds) {
        const own = values[ownerId] ?? {}
        try {
          await api.metaobjects.setMetafields({
            ownerType: 'variant',
            ownerId,
            values: Object.fromEntries(definitions.map((d) => [d.id, own[d.id] ?? null])),
          })
          setSaved((s) => ({ ...s, [ownerId]: own }))
          setErrors(({ [ownerId]: _done, ...rest }) => rest)
        } catch (err) {
          ok = false
          setErrors((e) => ({ ...e, [ownerId]: fieldErrorsOf(err) }))
          const label = variants.find((v) => v.id === ownerId)?.label ?? ''
          toast.error(copy.variantSaveFailed(label))
        }
      }
      return ok
    }
    return () => {
      saveRef.current = null
    }
  })

  // Event handlers
  const handleChange = (variantId: string, definitionId: string, value: unknown) => {
    setValues((v) => ({ ...v, [variantId]: { ...v[variantId], [definitionId]: value } }))
    setErrors(({ [variantId]: own, ...rest }) => {
      if (!own) return rest
      const { [definitionId]: _gone, ...left } = own
      return { ...rest, [variantId]: left }
    })
  }

  // Early returns
  if (definitions !== null && definitions.length === 0) return null

  // Render logic
  const canWrite = hasPermission(METAFIELD_OWNER_PERMISSIONS.variant.write)
  const canManage = hasPermission(permissions.CONTENT_MANAGE_TYPES)
  const manageHref = routes.settings.customDataOwner(
    CUSTOM_DATA_OWNERS.find((o) => o.owner === 'variant')?.slug ?? '',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.variantHeading}</CardTitle>
        <CardDescription>{copy.variantHelp}</CardDescription>
        {canManage ? (
          <CardAction>
            <Button variant="ghost" render={<Link href={manageHref} />} nativeButton={false}>
              {copy.manage}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {definitions === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max border-separate border-spacing-0 text-body">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-normal text-muted-foreground"
                  >
                    {copy.variant}
                  </th>
                  {definitions.map((d) => (
                    <th
                      key={d.id}
                      scope="col"
                      className="min-w-48 px-3 py-2 text-left text-xs font-normal text-muted-foreground"
                    >
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-48 truncate border-border border-t bg-card px-3 py-2 text-left font-medium text-ink-strong"
                    >
                      {v.label}
                    </th>
                    {definitions.map((d) => (
                      <td key={d.id} className="border-border border-t px-3 py-2 align-top">
                        <fieldset disabled={!canWrite} className="contents">
                          <FieldInput
                            hideLabel
                            rule={{
                              ...d,
                              name: `${d.name} · ${v.label}`,
                              validations: d.validations as FieldValidations,
                            }}
                            value={values[v.id]?.[d.id]}
                            error={errors[v.id]?.[d.id]}
                            onChange={(value) => handleChange(v.id, d.id, value)}
                          />
                        </fieldset>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasUnsaved ? (
          <p className="text-xs text-muted-foreground">{copy.variantNewLater}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
