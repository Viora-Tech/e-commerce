import { Search } from 'nextra/components'
import { brand } from '../data/home'

/** Home-page opener: the title, one line of help and a large search box. */
export default function HomeHero() {
  return (
    <div className="not-prose flex flex-col gap-4 pt-4 pb-2">
      <h1 className="text-4xl font-bold tracking-tight text-(--docs-fg) sm:text-5xl">
        How can we help?
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-(--docs-muted)">
        Guides for running your {brand.name} store in plain words, and docs for building on it.
        Search, or pick what you want to do.
      </p>
      <Search
        className="docs-hero-search mt-2 w-full max-w-xl"
        placeholder="Search guides, for example: GST invoice"
      />
    </div>
  )
}
