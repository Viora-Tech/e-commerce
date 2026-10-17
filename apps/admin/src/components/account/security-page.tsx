'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { accountContent } from '@/data/account'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'
import { deviceName, devicePlace } from '@/lib/device-label'
import ChangeEmailDialog from './change-email-dialog'
import GoogleLinkCard from './google-link-card'
import PasskeysCard from './passkeys-card'

type Security = Awaited<ReturnType<typeof api.account.security>>

/**
 * Account → Sign-in & security: the email codes go to (with Change email), the linked Google
 * account (when the admin offers Google or one is linked), passkeys, and the last sign-ins with
 * device, place and method.
 */
export default function SecurityPage() {
  // Hooks
  const content = useCopy(accountContent)
  const fmt = useFormat()
  const router = useRouter()
  const [security, setSecurity] = useState<Security | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [changing, setChanging] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change
  useEffect(() => {
    api.account
      .security()
      .then(setSecurity)
      .catch(() => setFailed(true))
  }, [version])

  // Event handlers
  const handleEmailChanged = async () => {
    setChanging(false)
    // The shell reads the email from Better Auth's cookie cache; a fresh read rewrites it.
    await authClient.getSession({ query: { disableCookieCache: true } })
    setVersion((n) => n + 1)
    router.refresh()
  }

  const handleRetry = () => {
    setFailed(false)
    setVersion((n) => n + 1)
  }

  // Early returns
  const copy = content.security
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} />
        <Card gap={3} inset={6} className="items-start">
          <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
          <Button variant="outline" onClick={handleRetry}>
            {copy.retry}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} />
      <SettingsCard id="email" title={copy.email.heading} description={copy.email.body}>
        <SettingsRow label={copy.email.label}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {security ? (
              <span className="min-w-0 truncate text-body text-ink-strong">{security.email}</span>
            ) : (
              <Skeleton className="h-5 w-48" />
            )}
            <Button variant="outline" onClick={() => setChanging(true)} disabled={!security}>
              {copy.email.change}
            </Button>
          </div>
        </SettingsRow>
      </SettingsCard>
      {security && (security.google.available || security.google.linkedAt) ? (
        <GoogleLinkCard linkedAt={security.google.linkedAt} />
      ) : null}
      <PasskeysCard />
      <SettingsCard id="recent" title={copy.recent.heading} description={copy.recent.body}>
        {security === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : security.recentSignIns.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.recent.empty}</p>
        ) : (
          <ul className="flex flex-col">
            {security.recentSignIns.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-1 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-body font-semibold text-ink-strong">
                      {deviceName(s.device, content)}
                    </span>
                    {s.current ? <StatusChip>{copy.recent.thisDevice}</StatusChip> : null}
                  </div>
                  <span className="truncate text-caption text-muted-foreground">
                    {devicePlace(s, content)}
                    {' · '}
                    {copy.recent.methods[s.method as keyof typeof copy.recent.methods] ??
                      copy.recent.methods.other}
                  </span>
                </div>
                <span
                  className="shrink-0 text-caption text-muted-foreground"
                  title={fmt.dateTime(s.at)}
                >
                  {fmt.when(s.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      <ChangeEmailDialog
        open={changing}
        onOpenChange={setChanging}
        onChanged={handleEmailChanged}
      />
    </div>
  )
}
