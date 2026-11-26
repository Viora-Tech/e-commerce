'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { usePathname, useRouter } from 'next/navigation'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type Filters = { source?: string | undefined; from?: string | undefined; to?: string | undefined }

type CommissionFiltersProps = { value: Filters }

const copy = affiliatePortalContent.commissions.filters
const sources = affiliateContent.dashboard.sale.source

/**
 * The Commission table's toolbar filters: source and dates, small controls in one row like
 * dashboard-01's. They live in the URL, so the page loads those rows and Export follows them.
 */
export default function CommissionFilters({ value }: CommissionFiltersProps) {
  // Hooks
  const router = useRouter()
  const pathname = usePathname()

  // Helpers
  const go = (next: Filters) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v)
    const s = qs.toString()
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false })
  }

  // Event handlers
  const handleChange = (key: keyof Filters, v: string) => go({ ...value, [key]: v || undefined })
  const handleClear = () => go({})

  // Render logic
  const any = Boolean(value.source || value.from || value.to)
  return (
    <>
      <NativeSelect
        size="sm"
        aria-label={copy.source}
        className="w-36"
        value={value.source ?? ''}
        onChange={(e) => handleChange('source', e.target.value)}
      >
        <NativeSelectOption value="">{copy.any}</NativeSelectOption>
        {Object.entries(sources).map(([k, label]) => (
          <NativeSelectOption key={k} value={k}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input
        type="date"
        aria-label={copy.from}
        title={copy.from}
        className="h-8 w-36"
        value={value.from ?? ''}
        max={value.to}
        onChange={(e) => handleChange('from', e.target.value)}
      />
      <Input
        type="date"
        aria-label={copy.to}
        title={copy.to}
        className="h-8 w-36"
        value={value.to ?? ''}
        min={value.from}
        onChange={(e) => handleChange('to', e.target.value)}
      />
      {any ? (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          {copy.clear}
        </Button>
      ) : null}
    </>
  )
}
