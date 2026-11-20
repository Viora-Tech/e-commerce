'use client'

import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { productFeedContent } from '@/data/product-feed'
import { useCopy } from '@/hooks/use-copy'

type ProductFeedCardProps = {
  checked: boolean
  /** The switch as saved: the addresses answer only once the switch is saved on. */
  saved: boolean
  onChange: (on: boolean) => void
  /** The storefront's address, for the feed links. */
  storefrontOrigin: string
}

/** The two feed files, in the order the card lists them. */
const FEEDS = [
  { key: 'xml', path: '/feeds/products.xml' },
  { key: 'csv', path: '/feeds/products.csv' },
] as const

/**
 * Online store › Preferences › Product feeds: the switch for the public product feeds
 * (`feeds.products`, off by default) and, while it is on, their addresses.
 */
export default function ProductFeedCard({
  checked,
  saved,
  onChange,
  storefrontOrigin,
}: ProductFeedCardProps) {
  // Hooks
  const copy = useCopy(productFeedContent)

  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      <SettingsToggleRow
        id="feeds-products"
        label={copy.toggle}
        description={copy.toggleHelp}
        checked={checked}
        onChange={onChange}
      />
      {checked ? (
        <div className="flex flex-col gap-3">
          <dl className="flex flex-col gap-3">
            {FEEDS.map((feed) => (
              <div key={feed.key} className="flex flex-col gap-0.5">
                <dt className="text-caption text-muted-foreground">{copy[feed.key]}</dt>
                <dd className="min-w-0 break-all text-body">
                  {saved ? (
                    <a
                      href={`${storefrontOrigin}${feed.path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {`${storefrontOrigin}${feed.path}`}
                    </a>
                  ) : (
                    `${storefrontOrigin}${feed.path}`
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {saved ? null : <p className="text-caption text-muted-foreground">{copy.saveFirst}</p>}
        </div>
      ) : null}
    </SettingsCard>
  )
}
