'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type PoliciesSourceNoteProps = {
  /** The block or section's type and name; the note shows when they speak of policies. */
  names: (string | null | undefined)[]
}

const POLICIES = /polic/i

/**
 * On an imported footer's policy links (Horizon's "Policies and links"): where those links come
 * from, with a way there. They list the published policies, so a store with none shows nothing
 * and the block itself has no list to edit (#1486).
 */
export default function PoliciesSourceNote({ names }: PoliciesSourceNoteProps) {
  // Hooks
  const copy = useCopy(themeImportContent.inspector)

  // Early returns
  if (!names.some((n) => n && POLICIES.test(n))) return null

  // Render logic
  return (
    <div className="flex shrink-0 flex-col items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-[1.0625rem] text-muted-foreground">
      <p>{copy.policies}</p>
      <Button
        variant="secondary"
        size="sm"
        nativeButton={false}
        render={<Link href={routes.settings.policies()} />}
      >
        {copy.openPolicies}
      </Button>
    </div>
  )
}
