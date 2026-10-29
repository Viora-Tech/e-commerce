import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { platformContent } from '@/data/platform'
import { getCopy } from '@/lib/copy-server'

type FilterField = {
  name: string
  value?: string | undefined
  placeholder?: string | undefined
  /** Shown before a date field. */
  label?: string | undefined
  type?: 'search' | 'date'
}

type PlatformFiltersProps = {
  /** The page the form submits to (GET). */
  action: string
  fields: FilterField[]
  /** Params the form keeps (the selected tab), sent as hidden fields. */
  keep?: Record<string, string | undefined>
  /** Where "Clear" leads: the page with only the kept params. */
  clearHref: string
}

/** The console's filter row: a plain GET form, so it works before any script loads. */
export default async function PlatformFilters({
  action,
  fields,
  keep = {},
  clearHref,
}: PlatformFiltersProps) {
  const copy = await getCopy(platformContent)
  // Render logic
  const hidden = Object.entries(keep).filter(([, v]) => v !== undefined && v !== '')
  const filtered = fields.some((f) => f.value)

  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2 px-4 py-3">
      {hidden.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) =>
        f.type === 'date' ? (
          <label
            key={f.name}
            htmlFor={`platform-filter-${f.name}`}
            className="flex items-center gap-2 text-caption text-muted-foreground"
          >
            {f.label}
            <Input
              id={`platform-filter-${f.name}`}
              type="date"
              name={f.name}
              defaultValue={f.value}
              className="h-8 w-40"
            />
          </label>
        ) : (
          <label
            key={f.name}
            htmlFor={`platform-filter-${f.name}`}
            className="relative min-w-0 flex-1 basis-56"
          >
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={`platform-filter-${f.name}`}
              type="search"
              name={f.name}
              defaultValue={f.value}
              placeholder={f.placeholder}
              aria-label={f.placeholder}
              className="h-8 pl-8"
            />
          </label>
        ),
      )}
      <Button type="submit" size="sm">
        {copy.search.button}
      </Button>
      {filtered ? (
        <Link
          href={clearHref}
          className="text-body text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {copy.search.clear}
        </Link>
      ) : null}
    </form>
  )
}
