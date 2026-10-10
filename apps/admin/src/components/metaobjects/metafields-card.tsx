'use client'

import type { FieldValidations, MetafieldOwnerType } from '@commerce/core/metaobjects'
import { Plus } from '@commerce/ui/icons'
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
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { metafieldsCardContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import FieldInput from './field-input'
import { fieldErrorsOf } from './form-state'
import MetafieldDefinitionDialog from './metafield-definition-dialog'

type MetafieldsCardProps = {
  ownerType: MetafieldOwnerType
  /** Null while the product or collection is unsaved. */
  ownerId: string | null
}

type Loaded = Awaited<ReturnType<typeof api.metaobjects.metafields>>

const TAB: Record<MetafieldOwnerType, string> = { product: '', collection: '?tab=collections' }

/**
 * Metafields on a product or collection page: one input per definition from
 * Settings → Custom data. It saves on its own button, so the page's save bar
 * and its product write stay untouched.
 */
export default function MetafieldsCard({ ownerType, ownerId }: MetafieldsCardProps) {
  // Hooks
  const copy = useCopy(metafieldsCardContent)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [saved, setSaved] = useState('{}')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  /** Adding a field right here, so nobody leaves the product page to define one (#296). */
  const [adding, setAdding] = useState(false)
  const [targets, setTargets] = useState<{ id: string; name: string }[]>([])
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    const request = ownerId
      ? api.metaobjects.metafields({ ownerType, ownerId })
      : api.metaobjects
          .metafieldDefinitions({ ownerType })
          .then((definitions) => ({ definitions, values: {} }))
    request
      .then((r) => {
        if (!live) return
        setLoaded(r)
        setValues(r.values)
        setSaved(JSON.stringify(r.values))
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
    if (!ownerId || !loaded) return
    setBusy(true)
    try {
      const all = Object.fromEntries(loaded.definitions.map((d) => [d.id, values[d.id] ?? null]))
      await api.metaobjects.setMetafields({ ownerType, ownerId, values: all })
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

  // Render logic
  const dirty = JSON.stringify(values) !== saved
  const manageHref = `/settings/custom-data${TAB[ownerType]}`
  const definitions = loaded?.definitions ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        {loaded && definitions.length === 0 ? (
          <CardDescription>{copy.empty}</CardDescription>
        ) : null}
        <CardAction>
          {dirty ? (
            <Button onClick={handleSave} disabled={busy}>
              {busy ? copy.saving : copy.save}
            </Button>
          ) : (
            <Button variant="ghost" render={<Link href={manageHref} />} nativeButton={false}>
              {copy.manage}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {loaded === null ? (
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      ) : definitions.length === 0 ? (
        <CardContent>
          <Button variant="outline" onClick={handleAdd}>
            <Plus aria-hidden="true" />
            {copy.addField}
          </Button>
        </CardContent>
      ) : definitions.length > 0 ? (
        <CardContent>
          {ownerId ? (
            <FieldGroup>
              {definitions.map((d) => (
                <FieldInput
                  key={d.id}
                  rule={{ ...d, validations: d.validations as FieldValidations }}
                  value={values[d.id]}
                  error={errors[d.id]}
                  onChange={(value) => handleChange(d.id, value)}
                />
              ))}
            </FieldGroup>
          ) : (
            <p className="text-body text-muted-foreground">{copy.saveFirst}</p>
          )}
        </CardContent>
      ) : null}
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
