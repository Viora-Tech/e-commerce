'use client'

import { useEffect, useState } from 'react'
import { isBlankImage } from './blank-image'

/**
 * A stored theme picture as the Themes page may show it: the address, or null once it is known
 * to be blank (one flat colour, a capture that never painted), so the card draws its placeholder
 * instead of a white rectangle. An unreadable picture (network, CORS) is shown: the check exists
 * to hide blanks, not to hide pictures.
 */
export function useShownPicture(picture: string | null): string | null {
  const [blank, setBlank] = useState<string | null>(null)

  useEffect(() => {
    if (!picture) return
    let active = true
    isBlankImage(picture).then((result) => {
      if (!active || result !== true) return
      console.warn('Theme picture is blank, showing the placeholder:', picture)
      setBlank(picture)
    })
    return () => {
      active = false
    }
  }, [picture])

  return picture && picture !== blank ? picture : null
}
