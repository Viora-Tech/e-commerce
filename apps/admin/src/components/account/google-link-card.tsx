'use client'

import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { accountContent } from '@/data/account'
import { useCopy, useFormat } from '@/hooks/use-copy'

type GoogleLinkCardProps = {
  /** When their Google account was linked (first Google sign-in); null when it is not. */
  linkedAt: Date | null
}

/**
 * Account → Sign-in & security → Google: whether the member's Google account is linked.
 * Read-only: it links by signing in with Google on the login page (same verified email), and
 * there is no unlink, so a stolen session cannot swap the Google account behind it.
 */
export default function GoogleLinkCard({ linkedAt }: GoogleLinkCardProps) {
  // Hooks
  const { security } = useCopy(accountContent)
  const fmt = useFormat()

  // Render logic
  const copy = security.google

  return (
    <SettingsCard id="google" title={copy.heading} description={copy.body}>
      <div className="flex items-center gap-3">
        {/* biome-ignore lint/performance/noImgElement: Google's own mark, unaltered (sign-in branding guidelines) */}
        <img src="/brand/google-g.svg" alt="" aria-hidden="true" className="size-5 shrink-0" />
        {linkedAt ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusChip tone="success">{copy.linked}</StatusChip>
            <span className="text-caption text-muted-foreground">
              {copy.linkedOn(fmt.date(linkedAt))}
            </span>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{copy.notLinked}</p>
        )}
      </div>
    </SettingsCard>
  )
}
