'use client'

import type { FieldValidations, MetafieldOwnerType } from '@commerce/core/metaobjects'
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
  }, [ownerType, ownerId])

  // Event handlers
  const handleChange = (id: string, value: unknown) => {
    setValues((v) => ({ ...v, [id]: value }))
    setErrors(({ [id]: _gone, ...rest }) => rest)
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
    </Card>
  )
}
