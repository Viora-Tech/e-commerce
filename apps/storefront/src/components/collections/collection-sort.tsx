'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { collectionsContent as copy, SORT_OPTIONS } from '@/data/collections'

type CollectionSortProps = { value: string }

/** Sort select; the choice lives in the URL so the page stays server rendered. */
export default function CollectionSort({ value }: CollectionSortProps) {
  // Hooks
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Event handlers
  const handleChange = (next: string) => {
    const query = new URLSearchParams(params.toString())
    query.set('sort', next)
    query.delete('page')
    router.push(`${pathname}?${query.toString()}`)
  }

  // Render logic
  return (
    <label className="collection__sort">
      <span className="text-caption">{copy.sortLabel}</span>
      <select
        className="field__input"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={copy.sortLabel}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
