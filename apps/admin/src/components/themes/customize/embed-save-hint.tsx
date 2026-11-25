'use client'

import { resolveAppEmbeds, type Theme } from '@commerce/core/theme'
import { ArrowUp } from '@commerce/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { editorAppEmbedSources } from '@/lib/customize-app-embeds'

type EmbedSaveHintProps = {
  installed: string[]
  theme: Theme
  onChange: (next: Theme) => void
}

/** The `?embed=<type>` an app's "Enable app embed" link asks for, read once. */
const askedEmbed = () =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('embed')

/**
 * Shopify's "Click Save to enable" step: Customize opened from an app's "Enable app embed" link
 * (`?panel=apps&embed=loyalty/Widget`) switches that embed on, unsaved, and dims the canvas with
 * a note pointing at Save until the merchant clicks it away. Nothing is saved for them.
 */
export default function EmbedSaveHint({ installed, theme, onChange }: EmbedSaveHintProps) {
  // Hooks
  const copy = useCopy(customizeContent.appEmbeds)
  const done = useRef(false)
  const [label, setLabel] = useState<string | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (done.current) return
    const type = askedEmbed()
    if (!type) return
    const embed = resolveAppEmbeds(editorAppEmbedSources(new Set(installed)), theme.appEmbeds).find(
      (e) => e.embed.type === type,
    )
    if (!embed) return
    done.current = true
    if (embed.enabled) return
    onChange({
      ...theme,
      appEmbeds: { ...theme.appEmbeds, [type]: { enabled: true, settings: embed.props } },
    })
    setLabel(embed.appName)
    setHost(document.getElementById('main'))
  }, [installed, theme, onChange])

  // Event handlers
  const handleDismiss = () => setLabel(null)

  // Early returns
  if (!label || !host) return null

  // Render logic
  return createPortal(
    <button
      type="button"
      onClick={handleDismiss}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white"
    >
      <ArrowUp aria-hidden="true" className="absolute top-4 right-8 size-12 rotate-45" />
      <span className="text-2xl font-semibold">{copy.saveHintTitle}</span>
      <span className="max-w-[22rem] text-body">{copy.saveHintBody(label)}</span>
    </button>,
    host,
  )
}
