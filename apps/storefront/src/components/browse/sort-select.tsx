'use client'

import type { BrowseSort } from '@commerce/core/browse'
import { useRouter } from 'next/navigation'
import { browseContent as copy, SORT_LABELS } from '@/data/browse'

type SortSelectProps = {
  action: string
  value: BrowseSort
  options: BrowseSort[]
  /** The current query and filters, carried as hidden fields so sorting keeps them. */
  keep: [string, string][]
}

/** Sort as a GET form: without JavaScript the Apply button submits it; with it, changing navigates. */
export default function SortSelect({ action, value, options, keep }: SortSelectProps) {
  // Hooks
  const router = useRouter()

  // Event handlers
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(keep)
    params.set('sort_by', e.target.value)
    router.push(`${action}?${params.toString()}`, { scroll: false })
  }

  // Render logic
  return (
    <form action={action} method="get" className="flex items-center gap-2">
      {keep.map(([k, v]) => (
        <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="sort-by" className="text-small text-muted whitespace-nowrap">
        {copy.sortLabel}
      </label>
      <select
        id="sort-by"
        name="sort_by"
        className="field__input !w-auto py-2"
        defaultValue={value}
        onChange={handleChange}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {SORT_LABELS[o]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn btn--secondary btn--small">
          {copy.apply}
        </button>
      </noscript>
    </form>
  )
}
