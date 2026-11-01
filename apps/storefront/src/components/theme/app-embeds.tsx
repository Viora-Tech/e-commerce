import { appEmbedSourcesForStore } from '@commerce/core/registries'
import { resolveAppEmbeds, type Theme } from '@commerce/core/theme'
import { Fragment, type ReactNode } from 'react'
import { appEmbedData } from '@/lib/app-embed-data'
import { storeRead } from '@/lib/store-cache'

type AppEmbedsProps = {
  storeId: string
  /** The theme this page draws with (live, or the one being previewed). */
  appEmbeds: Theme['appEmbeds']
}

/**
 * Every app embed that is on in this theme (theme editor → Apps): an installed app's site-wide
 * widget, drawn once per page with the merchant's settings and any store data it reads
 * (`appEmbedData`, e.g. the floating reviews tab's latest reviews).
 */
export default async function AppEmbeds({ storeId, appEmbeds }: AppEmbedsProps) {
  // Render logic
  // Manifests hold React components: charge the cache a nominal size, never walk them.
  const sources = await storeRead(
    storeId,
    'app-embed-sources',
    (tx) => appEmbedSourcesForStore(tx, storeId),
    { size: 4096 },
  )
  const on = resolveAppEmbeds(sources, appEmbeds).filter((e) => e.enabled)
  if (on.length === 0) return null
  const data = await Promise.all(on.map((e) => appEmbedData(storeId, e.embed.type, e.props)))

  return (
    <>
      {on.map((e, i) => (
        <Fragment key={e.embed.type}>
          {
            e.embed.render(
              data[i] === undefined ? e.props : { ...e.props, data: data[i] },
            ) as ReactNode
          }
        </Fragment>
      ))}
    </>
  )
}
