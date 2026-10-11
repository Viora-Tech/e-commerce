// Pattern after common team grids (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import { focalStyle } from '../../../focal-point'
import type { Image } from '../../../sections/framed'
import Icon from '../../icon'
import Picture from '../../picture'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type TeamGridProps = {
  heading: ReactNode
  text: ReactNode
  people: { photo: Image; name: ReactNode; role: ReactNode; bio: ReactNode }[]
}

/** Initials for a person with no photo; a name being edited (a node) gets the person glyph. */
function personInitials(name: ReactNode): string {
  if (typeof name !== 'string') return ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** The people behind the shop: photo (or initials), name, role and one line about them. */
export default function TeamGrid({ heading, text, people }: TeamGridProps) {
  // Early returns
  if (!people?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <ul className="grid grid-cols-2 gap-x-[1rem] gap-y-[2rem] md:grid-cols-4">
        {people.map((person, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <li key={i} className="flex flex-col gap-[0.75rem] text-left">
            <span className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--color-brand)_10%,var(--color-surface))]">
              {person.photo?.url ? (
                <Picture
                  image={person.photo}
                  alt={person.photo.alt}
                  className="absolute inset-0 size-full object-cover"
                  style={focalStyle(person.photo.focal)}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                />
              ) : (
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-heading)] text-[2.5rem] text-[var(--color-brand)]"
                >
                  {personInitials(person.name) || <Icon name="user" size={40} />}
                </span>
              )}
            </span>
            <span className="flex flex-col gap-[0.125rem]">
              <span className="text-body font-semibold text-[var(--color-ink)]">{person.name}</span>
              {person.role ? (
                <span className="text-small text-[var(--color-brand)]">{person.role}</span>
              ) : null}
              {person.bio ? (
                <span className="text-small text-[var(--color-muted)]">{person.bio}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
