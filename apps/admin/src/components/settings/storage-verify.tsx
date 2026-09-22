'use client'

import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'

type Verify = Awaited<ReturnType<typeof api.store.verifyStorage>>

const copy = mediaContent.settings

/** "Test connection" for Settings › Files. Hits the saved settings, not the unsaved form. */
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
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.verifyHeading}</CardTitle>
        <CardDescription>{copy.verifyHelp}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
      </CardContent>
    </Card>
  )
}
