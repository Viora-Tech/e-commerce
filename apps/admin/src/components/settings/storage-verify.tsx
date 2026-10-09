'use client'

import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'
import SettingsCard from './settings-card'

type Verify = Awaited<ReturnType<typeof api.store.verifyStorage>>

const copy = mediaContent.settings

/** "Test connection" for Content › Files › Storage. Hits the saved settings, not the unsaved form. */
export default function StorageVerify() {
  // Hooks
  const [result, setResult] = useState<Verify | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleVerify = async () => {
    setBusy(true)
    try {
      setResult(await api.store.verifyStorage())
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Could not verify' })
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const Icon = result?.ok ? CircleCheck : CircleAlert

  return (
    <SettingsCard
      title={copy.verifyHeading}
      description={copy.verifyHelp}
      bodyClassName="flex flex-col gap-4"
    >
      <div>
        <Button type="button" variant="outline" onClick={handleVerify} disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? copy.verifying : copy.verify}
        </Button>
      </div>
      {result ? (
        <Alert
          className={
            result.ok
              ? 'text-success [&_svg]:text-success'
              : 'text-destructive [&_svg]:text-destructive'
          }
        >
          <Icon />
          <AlertDescription className="text-foreground">{result.message}</AlertDescription>
        </Alert>
      ) : null}
    </SettingsCard>
  )
}
