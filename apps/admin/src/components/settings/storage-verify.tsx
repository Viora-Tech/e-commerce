'use client'

import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import SettingsCard from './settings-card'

type Verify = Awaited<ReturnType<typeof api.store.verifyStorage>>

/** "Test connection" for Content › Files › Storage. Hits the saved settings, not the unsaved form. */
export default function StorageVerify() {
  // Hooks
  const copy = useCopy(mediaContent).settings
  const [result, setResult] = useState<Verify | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleVerify = async () => {
    setBusy(true)
    try {
      setResult(await api.store.verifyStorage())
    } catch (err) {
      setResult({ ok: false, message: errorText(err, 'Could not verify') })
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
        <Button
          loading={busy}
          type="button"
          variant="outline"
          onClick={handleVerify}
          disabled={busy}
        >
          <CircleCheck aria-hidden="true" />
          {copy.verify}
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
