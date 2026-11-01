'use client'

import {
  type FieldValidations,
  METAFIELD_OWNER_PERMISSIONS,
  type MetafieldOwnerType,
} from '@commerce/core/metaobjects'
import { permissions } from '@commerce/core/permissions'
import { Plus, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CUSTOM_DATA_OWNERS } from '@/data/custom-data'
import { metafieldsCardContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import FieldInput from './field-input'
import { fieldErrorsOf } from './form-state'
import MetafieldDefinitionDialog from './metafield-definition-dialog'

type MetafieldsCardProps = {
  ownerType: MetafieldOwnerType
  /** Null while the record is unsaved. Ignored for `shop`: the store's own fields. */
  ownerId: string | null
  /** Replaces the "Extra fields" heading, e.g. on the Store tab of Settings → Custom data. */
  title?: string | undefined
  /** Above the fields, e.g. the variant picker on a product page. */
  children?: ReactNode
  /** Render nothing while this owner type has no extra fields (secondary cards). */
  hideWhenEmpty?: boolean | undefined
  /**
   * Show only the fields this record has a value in, with "Show N empty fields" for the rest.
   * Products imported from Shopify carry every category's fields (keyboard layout, fabric…),
   * about 60 empty boxes on a mouse (audit #51, #177).
   */
  collapseEmpty?: boolean | undefined
}

/** A value worth showing: not blank, not an empty list. */
const hasValue = (v: unknown) =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

type Loaded = Awaited<ReturnType<typeof api.metaobjects.metafields>>

/** The Settings → Custom data tab that lists this owner's fields. */

/** The id the API takes: none for the shop (the server uses the store), else the record's. */
const apiOwnerId = (ownerType: MetafieldOwnerType, ownerId: string | null) =>
  ownerType === 'shop' ? undefined : (ownerId ?? undefined)

/**
 * Extra fields on a record's page (product, variant, collection, customer, order, page, blog
 * post, or the store itself): one input per definition from Settings → Custom data. It saves on
 * its own button, so the page's save bar and its own write stay untouched. Save shows only to
 * members who may edit that kind of record; adding a field only to those who manage types.
 */
export default function MetafieldsCard({
  ownerType,
  ownerId,
  title,
  children,
  hideWhenEmpty,
  collapseEmpty,
}: MetafieldsCardProps) {
  // Hooks
  const copy = useCopy(metafieldsCardContent)
  const { hasPermission } = usePermissions()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [saved, setSaved] = useState('{}')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  /** Adding a field right here, so nobody leaves the product page to define one (#296). */
  const [adding, setAdding] = useState(false)
  const [targets, setTargets] = useState<{ id: string; name: string }[]>([])
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the fetch after a field is added here.
  useEffect(() => {
    let live = true
    const request =
      ownerType === 'shop' || ownerId
        ? api.metaobjects.metafields({ ownerType, ownerId: apiOwnerId(ownerType, ownerId) })
        : api.metaobjects
            .metafieldDefinitions({ ownerType })
            .then((definitions) => ({ definitions, values: {} }))
    setLoaded(null)
    request
      .then((r) => {
        if (!live) return
        setLoaded(r)
        setValues(r.values)
        setSaved(JSON.stringify(r.values))
        setErrors({})
      })
      .catch(() => live && setLoaded({ definitions: [], values: {} }))
    return () => {
      live = false
    }
  }, [ownerType, ownerId, reload])

  // Event handlers
  const handleChange = (id: string, value: unknown) => {
    setValues((v) => ({ ...v, [id]: value }))
    setErrors(({ [id]: _gone, ...rest }) => rest)
  }

  const handleAdd = () => {
    setAdding(true)
    // Reference fields pick a content type; the list is only needed once the dialog opens.
    api.metaobjects
      .definitions()
      .then((d) => setTargets(d.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => setTargets([]))
  }

  const handleSave = async () => {
    if (!loaded || (ownerType !== 'shop' && !ownerId)) return
    setBusy(true)
    try {
      const all = Object.fromEntries(loaded.definitions.map((d) => [d.id, values[d.id] ?? null]))
      await api.metaobjects.setMetafields({
        ownerType,
        ownerId: apiOwnerId(ownerType, ownerId),
        values: all,
      })
      setSaved(JSON.stringify(values))
      setErrors({})
      toast.success(copy.saved)
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (hideWhenEmpty && loaded?.definitions.length === 0) return null

  // Render logic
  const ready = ownerType === 'shop' || ownerId !== null
  const canWrite = hasPermission(METAFIELD_OWNER_PERMISSIONS[ownerType].write)
  const canManage = hasPermission(permissions.CONTENT_MANAGE_TYPES)
  const dirty = JSON.stringify(values) !== saved
  const manageHref = routes.settings.customDataOwner(
    CUSTOM_DATA_OWNERS.find((o) => o.owner === ownerType)?.slug ?? '',
  )
  const definitions = loaded?.definitions ?? []
  // Judged on what is saved, so a field does not vanish while it is being typed in.
  const savedValues = JSON.parse(saved) as Record<string, unknown>
  const emptyCount = collapseEmpty
    ? definitions.filter((d) => !hasValue(savedValues[d.id])).length
    : 0
  const visible =
    collapseEmpty && !showEmpty
      ? definitions.filter((d) => hasValue(savedValues[d.id]))
      : definitions

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? copy.heading}</CardTitle>
        {loaded && definitions.length === 0 ? (
          <CardDescription>{copy.empty}</CardDescription>
        ) : null}
        <CardAction>
          {dirty && canWrite ? (
            <Button onClick={handleSave} disabled={busy}>
              <Save aria-hidden="true" />
              {busy ? copy.saving : copy.save}
            </Button>
          ) : canManage ? (
            <Button variant="ghost" render={<Link href={manageHref} />} nativeButton={false}>
              {copy.manage}
            </Button>
          ) : null}
        </CardAction>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
      {loaded === null ? (
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      ) : definitions.length === 0 ? (
        canManage ? (
          <CardContent className="flex justify-end">
            <Button variant="outline" onClick={handleAdd}>
              <Plus aria-hidden="true" />
              {copy.addField}
            </Button>
          </CardContent>
        ) : null
      ) : (
        <CardContent>
          {ready ? (
            <FieldGroup>
              {visible.map((d) => (
                <FieldInput
                  key={d.id}
                  rule={{ ...d, validations: d.validations as FieldValidations }}
                  value={values[d.id]}
                  error={errors[d.id]}
                  onChange={(value) => handleChange(d.id, value)}
                />
              ))}
              {emptyCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setShowEmpty((v) => !v)}
                >
                  {showEmpty ? copy.hideEmpty : copy.showEmpty(emptyCount)}
                </Button>
              ) : null}
            </FieldGroup>
          ) : (
            <p className="text-body text-muted-foreground">{copy.saveFirst}</p>
          )}
        </CardContent>
      )}
      <MetafieldDefinitionDialog
        open={adding}
        ownerType={ownerType}
        definition={null}
        targets={targets}
        onClose={() => setAdding(false)}
        onSaved={() => setReload((n) => n + 1)}
      />
    </Card>
  )
}
