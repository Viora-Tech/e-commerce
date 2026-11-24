'use client'

import { AutoField, type Field } from '@puckeditor/core'
import { useEffect, useRef } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import FieldFrame from './field-frame'
import ImageField from './image-field'

type VideoValue = {
  url?: string
  mobileUrl?: string
  poster?: { url?: string } & Record<string, unknown>
} & Record<string, unknown>

type VideoSettingFieldProps = {
  label: string
  objectFields: Record<string, Field>
  value: unknown
  onChange: (value: unknown) => void
}

const asVideo = (value: unknown) => (value ?? {}) as VideoValue

/**
 * A theme video setting: its video links as typed fields and the poster through the image picker.
 * A video with no poster yet takes the one Files made for it when it was uploaded (the frame about
 * 2 s in, `lib/video-poster.ts`), so a hero never shows a black first frame before it plays.
 */
export default function VideoSettingField({
  label,
  objectFields,
  value,
  onChange,
}: VideoSettingFieldProps) {
  // Hooks
  const copy = useCopy(customizeContent.video)
  /** The value as last rendered: a poster lookup that answers late merges into it, not a stale copy. */
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])

  // Event handlers
  const handleUrl = async (next: unknown) => {
    const current = asVideo(value)
    const url = typeof next === 'string' ? next.trim() : ''
    const changed = { ...current, url: typeof next === 'string' ? next : '' }
    latest.current = changed
    onChange(changed)
    if (!url || current.poster?.url) return
    const poster = await api.media.posterFor({ url }).catch(() => null)
    const now = asVideo(latest.current)
    // Meanwhile the link changed again, or a poster was picked: this answer is no longer wanted.
    if (!poster || now.url?.trim() !== url || now.poster?.url) return
    const withPoster = { ...now, poster: { url: poster.url, alt: '' } }
    latest.current = withPoster
    onChange(withPoster)
  }

  const handleSub = (key: string) => (next: unknown) => {
    const changed = { ...asVideo(value), [key]: next }
    latest.current = changed
    onChange(changed)
  }

  // Render logic
  const video = asVideo(value)
  const links = Object.entries(objectFields).filter(([key]) => key !== 'poster')

  return (
    <FieldFrame label={label}>
      <div className="flex flex-col gap-3 rounded-lg border border-border p-2.5">
        {links.map(([key, sub]) => (
          <AutoField
            key={key}
            field={sub}
            value={video[key]}
            onChange={key === 'url' ? handleUrl : handleSub(key)}
          />
        ))}
        <FieldFrame label={copy.poster}>
          <ImageField value={video.poster} onChange={handleSub('poster')} />
          <p className="text-caption text-muted-foreground">{copy.posterHint}</p>
        </FieldFrame>
      </div>
    </FieldFrame>
  )
}
