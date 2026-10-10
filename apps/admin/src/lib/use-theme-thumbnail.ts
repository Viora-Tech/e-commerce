'use client'

import { useEffect } from 'react'
import { api } from './api-client'
import { captureThemeThumbnail } from './capture-theme-thumbnail'

/** Long enough for the canvas's fonts, images and enter motion to settle after it mounts. */
const SETTLE_MS = 2500

/** Takes the picture and sends it; a picture is a nicety, so failures stay quiet. */
async function sendThumbnail(themeId: string): Promise<void> {
  const image = await captureThemeThumbnail()
  if (!image) return
  await api.themes.thumbnail({ id: themeId, image }).catch(() => undefined)
}

/**
 * The theme library's picture of this theme (Themes page). Customize retakes it after every Save
 * of the home page (`refresh`), and takes a first one when a theme with no picture opens on its
 * saved home page, so existing themes get one just by being opened.
 */
export function useThemeThumbnail(input: {
  themeId: string
  hasPicture: boolean
  /** The canvas shows the default home template, saved (no unsaved edits). */
  onSavedHome: boolean
}): { refresh: () => void } {
  const { themeId, hasPicture, onSavedHome } = input

  useEffect(() => {
    if (hasPicture || !onSavedHome) return
    const timer = window.setTimeout(() => void sendThumbnail(themeId), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [themeId, hasPicture, onSavedHome])

  return { refresh: () => void sendThumbnail(themeId) }
}
