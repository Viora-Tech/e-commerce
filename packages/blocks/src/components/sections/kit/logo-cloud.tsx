// Pattern after common logo-cloud layouts (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import { linkTarget } from '../../../link'
import type { Image } from '../../../sections/framed'
import { cx, safeHref } from '../../../slot-types'
import Picture from '../../picture'

/** Copy is a string in storage, a React node while edited on the canvas (names stay strings). */
type LogoCloudProps = {
  heading: ReactNode
  columns: 3 | 4 | 6
  logos: { image: Image; name: string; href: string }[]
}

const COLUMNS = {
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
} as const

/**
 * Press or partner logos in a hairline grid, quiet grey until hovered. A logo with no picture
 * shows its name as a wordmark, so the section reads well before any upload.
 */
export default function LogoCloud({ heading, columns, logos }: LogoCloudProps) {
  // Early returns
  if (!logos?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col items-center gap-[1.5rem]">
      {heading ? (
        <p className="text-caption uppercase tracking-[0.08em] text-[var(--color-muted)]">
          {heading}
        </p>
      ) : null}
      <ul
        className={cx(
          'grid w-full gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-line)]',
          COLUMNS[columns] ?? COLUMNS[6],
        )}
      >
        {logos.map((logo, i) => {
          const mark = logo.image?.url ? (
            <Picture
              image={logo.image}
              alt={logo.name || logo.image.alt}
              className="h-[2rem] w-auto max-w-[8rem] object-contain opacity-60 grayscale transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:grayscale-0"
              placeholder={false}
            />
          ) : (
            <span className="font-[family-name:var(--font-heading)] text-[1.125rem] font-semibold tracking-tight text-[var(--color-muted)] transition-colors duration-200 group-hover:text-[var(--color-ink)]">
              {logo.name}
            </span>
          )
          const href = safeHref(logo.href)
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
              key={i}
              className="group flex h-[6rem] items-center justify-center bg-[var(--color-bg)] px-[1rem]"
            >
              {href ? (
                <a href={href} {...linkTarget({ label: logo.name, href })} aria-label={logo.name}>
                  {mark}
                </a>
              ) : (
                mark
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
