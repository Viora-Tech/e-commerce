'use client'

import { useEffect, useState } from 'react'
import { fieldErrorsOf } from '@/components/metaobjects/form-state'
import { api } from '@/lib/api-client'

export type VariantMetafieldDefinition = Awaited<
  ReturnType<typeof api.metaobjects.metafields>
>['definitions'][number]

/**
 * One variant's metafields for its page: loads the store's variant fields and this variant's
 * values, tracks edits for the page's save bar, and writes them when the page saves (#894: one
 * Save for the variant and its fields).
 */
export function useVariantMetafields(variantId: string) {
  const [definitions, setDefinitions] = useState<VariantMetafieldDefinition[] | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [saved, setSaved] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let live = true
    api.metaobjects
      .metafields({ ownerType: 'variant', ownerId: variantId })
      .then((res) => {
        if (!live) return
        setDefinitions(res.definitions)
        setValues(res.values)
        setSaved(res.values)
        setErrors({})
      })
      .catch(() => live && setDefinitions([]))
    return () => {
      live = false
    }
  }, [variantId])

  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  const change = (definitionId: string, value: unknown) => {
    setValues((v) => ({ ...v, [definitionId]: value }))
    setErrors(({ [definitionId]: _gone, ...rest }) => rest)
  }

  /** Writes the fields when they changed; false (with the field errors shown) when it failed. */
  const save = async (): Promise<boolean> => {
    if (!definitions || !dirty) return true
    try {
      await api.metaobjects.setMetafields({
        ownerType: 'variant',
        ownerId: variantId,
        values: Object.fromEntries(definitions.map((d) => [d.id, values[d.id] ?? null])),
      })
      setSaved(values)
      setErrors({})
      return true
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      return false
    }
  }

  const reset = () => {
    setValues(saved)
    setErrors({})
  }

  return { definitions, values, errors, dirty, change, save, reset }
}
