'use client'

import type { NotifyMeWidget } from '@commerce/blocks'
import type { CardProduct } from '@commerce/blocks/puck'
import type { TemplateKey } from '@commerce/core/theme'
import { notifyWidgetOf } from '@commerce/plugin-back-in-stock/settings-schema'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { catalogCards } from './customize-config'
import type { PreviewContext, PreviewResource } from './customize-preview'
import {
  listResources,
  loadResource,
  type ResourceOption,
  resourceKindOf,
} from './customize-resource'

/**
 * Everything the Customize preview draws dynamic sections from: the store's menus,
 * its products, and the product, collection or page chosen in the resource picker.
 */
export function useCustomizePreview(template: TemplateKey, initialResource: string | null) {
  // Hooks
  const [context, setContext] = useState<PreviewContext | null>(null)
  const [cards, setCards] = useState<CardProduct[]>([])
  const [options, setOptions] = useState<ResourceOption[]>([])
  const [resourceId, setResourceId] = useState<string | null>(initialResource)
  const [resource, setResource] = useState<PreviewResource>(null)
  const [notifyMe, setNotifyMe] = useState<NotifyMeWidget | null>(null)
  const kind = resourceKindOf(template)

  useEffect(() => {
    api.themes.templates.previewContext().then(setContext, () => setContext(null))
    catalogCards().then(setCards)
    // The Back in stock campaign's button on sold-out products; nothing when the app is not
    // installed (the read fails) or its campaign is off.
    api.backInStock.settings.get().then(
      (s) => setNotifyMe(s.enabled ? notifyWidgetOf(s) : null),
      () => setNotifyMe(null),
    )
  }, [])

  useEffect(() => {
    setOptions([])
    setResource(null)
    if (!kind) return
    let active = true
    listResources(kind).then((next) => {
      if (!active) return
      setOptions(next)
      setResourceId((id) => (id && next.some((o) => o.id === id) ? id : (next[0]?.id ?? null)))
    })
    return () => {
      active = false
    }
  }, [kind])

  useEffect(() => {
    if (!kind || !resourceId) return
    let active = true
    loadResource(kind, resourceId).then(
      (next) => active && setResource(next),
      () => active && setResource(null),
    )
    return () => {
      active = false
    }
  }, [kind, resourceId])

  return { context, cards, kind, options, resourceId, setResourceId, resource, notifyMe }
}
