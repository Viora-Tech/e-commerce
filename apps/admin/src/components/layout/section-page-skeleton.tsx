import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'

const CARDS = 2
const FIELDS = 3

/**
 * Shape of a Settings or Account page while it loads, inside the section's own layout (its nav
 * rail stays): title and subtitle, then two form cards. Moving between pages of one section
 * shows this at once instead of holding the old page until the server answers.
 */
export default function SectionPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {Array.from({ length: CARDS }, (_, card) => (
        <Card key={card.toString()} gap={4} inset={5}>
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: FIELDS }, (_, field) => (
            <Skeleton key={field.toString()} className="h-9 w-full" />
          ))}
        </Card>
      ))}
    </div>
  )
}
