'use client'

import { useEffect } from 'react'
import { api } from './api-client'
import { isBlankImage } from './blank-image'
import { captureThemeThumbnail } from './capture-theme-thumbnail'

/** Long enough for the canvas's fonts, images and enter motion to settle after it mounts. */
const SETTLE_MS = 2500

/**
 * Takes the picture and sends it; a picture is a nicety, so failures stay quiet (logged only).
 * With `forgetBlank`, a capture that comes out blank also drops the stored picture, which is
 * known to be blank: the Themes page then shows its placeholder instead of a white rectangle.
 */
export async function sendThumbnail(themeId: string, forgetBlank = false): Promise<void> {
  const image = await captureThemeThumbnail()
  if (!image) {
    console.warn('Theme picture: the canvas gave no usable picture', { themeId })
    if (!forgetBlank) return
  }
  await api.themes.thumbnail({ id: themeId, image }).catch((err: unknown) => {
    console.warn('Theme picture could not be saved:', err)
  })
}

/** Whether the theme needs a (new) picture: none yet, or the stored one is blank. */
async function storedState(picture: string | null): Promise<'none' | 'blank' | 'fine'> {
  if (!picture) return 'none'
  // A picture saved before blank pictures were caught (a white rectangle) is retaken.
  return (await isBlankImage(picture)) === true ? 'blank' : 'fine'
}

/**
 * The theme library's picture of this theme (Themes page). Customize retakes it after every Save
 * of the home page (`refresh`), and takes one when a theme opens on its saved home page with no
 * picture or a blank one, so existing themes get a good one just by being opened. A blank stored
 * picture that cannot be retaken is forgotten.
 */
export function useThemeThumbnail(input: {
  themeId: string
  /** The stored picture's address, null when the theme has none. */
  picture: string | null
  /** The canvas shows the default home template, saved (no unsaved edits). */
  onSavedHome: boolean
}): { refresh: () => void } {
  const { themeId, picture, onSavedHome } = input

  useEffect(() => {
    if (!onSavedHome) return
    let active = true
    const timer = window.setTimeout(async () => {
      if (!active) return
      const state = await storedState(picture)
      if (active && state !== 'fine') await sendThumbnail(themeId, state === 'blank')
    }, SETTLE_MS)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [themeId, picture, onSavedHome])

  return { refresh: () => void sendThumbnail(themeId) }
}
