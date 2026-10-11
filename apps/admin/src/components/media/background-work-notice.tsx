'use client'

import { useEffect, useState } from 'react'
import HealthLine from '@/components/settings/health-line'
import { backgroundWorkContent } from '@/data/background-work'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Work = Awaited<ReturnType<typeof api.media.backgroundWork>>

/** How often the notice asks again while the page is open. */
const POLL_MS = 30_000

/**
 * "Processing 240 images in the background: your store may be a little slower until it
 * finishes (about 8 min)." Shown while more than 50 images wait for the worker or a Shopify
 * import is writing (`backgroundWork` in core), on Home, Content → Files and the importer, so a
 * merchant who notices a slow store knows why and that it ends. Nothing for members who cannot
 * read content, or when the server cannot say.
 */
export default function BackgroundWorkNotice() {
  // Hooks
  const copy = useCopy(backgroundWorkContent)
  const fmt = useFormat()
  const [work, setWork] = useState<Work | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      api.media
        .backgroundWork()
        .then((next) => {
          if (live) setWork(next)
        })
        .catch(() => {})
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  // Early returns
  if (!work?.busy) return null

  // Render logic
  const showImages = work.images > 0 && work.minutesLeft !== null
  const title = showImages ? copy.images(fmt.number(work.images)) : copy.importing
  const slower =
    showImages && work.minutesLeft !== null ? copy.slowerFor(work.minutesLeft) : copy.slower
  const help = showImages && work.importing ? `${slower} ${copy.importingToo}` : slower

  return <HealthLine tone="warn" title={title} help={help} />
}
