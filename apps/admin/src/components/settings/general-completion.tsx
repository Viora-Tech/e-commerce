import type { StoreGeneral } from '@commerce/core/store-settings'
import { Progress } from '@commerce/ui/shadcn/progress'
import { settingsContent } from '@/data/settings'

type GeneralCompletionProps = {
  /** The saved details (not unsaved edits), so the count matches what customers see. */
  details: StoreGeneral
}

type DetailKey = keyof typeof copy.items

const copy = settingsContent.general.completion

const filled = (v: string) => v.trim().length > 0

/** Which of the four shop details are filled in (GSTIN lives on Taxes & GST). */
export function detailsDone(d: StoreGeneral): Record<DetailKey, boolean> {
  return {
    name: filled(d.name),
    email: filled(d.contactEmail),
    phone: filled(d.contactPhone),
    address: filled(d.address.line1) && filled(d.address.city) && filled(d.address.pincode),
  }
}

/** "3 of 4 details done", a bar, and what is still missing, in plain words. */
export default function GeneralCompletion({ details }: GeneralCompletionProps) {
  // Render logic
  const done = detailsDone(details)
  const keys = Object.keys(done) as DetailKey[]
  const count = keys.filter((k) => done[k]).length
  const missing = keys.filter((k) => !done[k]).map((k) => copy.items[k])

  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Progress
          value={Math.round((count / keys.length) * 100)}
          aria-label={copy.progress(count, keys.length)}
          className="flex-1"
        />
        <span className="shrink-0 text-body font-medium text-foreground">
          {copy.progress(count, keys.length)}
        </span>
      </div>
      <p className="text-caption text-muted-foreground">
        {missing.length === 0 ? copy.allDone : copy.missing(missing)}
      </p>
    </div>
  )
}
