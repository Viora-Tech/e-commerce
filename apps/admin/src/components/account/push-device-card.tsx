'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { usePushDevice } from '@/hooks/use-push-device'
import { api } from '@/lib/api-client'

type PushDeviceCardProps = {
  /** Null: the server has no VAPID keys, so push cannot be turned on here. */
  publicKey: string | null
  /** The member's devices with push on in this store, when the page loaded. */
  devices: number
}

/**
 * Account → Notifications, "Push on this device": turns browser push on or off for the phone or
 * computer the member is on, sends a test, and says plainly why it cannot (blocked, iPhone not
 * on the Home Screen, old browser). Which alerts arrive by push is the Push column below.
 */
export default function PushDeviceCard({
  publicKey,
  devices: initialDevices,
}: PushDeviceCardProps) {
  // Hooks
  const {
    notifications: { push: copy },
  } = useCopy(accountContent)
  const [devices, setDevices] = useState(initialDevices)
  const [testing, setTesting] = useState(false)
  const { state, busy, turnOn, turnOff } = usePushDevice(publicKey, setDevices)

  // Event handlers
  const handleTurnOn = () => {
    turnOn().catch((err: unknown) =>
      toast.error(err instanceof Error && err.message ? err.message : copy.failed),
    )
  }

  const handleTurnOff = () => {
    turnOff().catch((err: unknown) =>
      toast.error(err instanceof Error && err.message ? err.message : copy.failed),
    )
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      await api.account.sendPushTest()
      toast.success(copy.testSent)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setTesting(false)
    }
  }

  // Render logic
  const note =
    publicKey === null
      ? copy.notSetUp
      : state === 'blocked'
        ? copy.blocked
        : state === 'install'
          ? copy.install
          : state === 'unsupported'
            ? copy.unsupported
            : null

  return (
    <SettingsCard title={copy.title} description={copy.body}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <StatusChip tone={state === 'on' ? 'success' : 'neutral'}>
              {state === 'on' ? copy.on : copy.off}
            </StatusChip>
            <span className="text-caption text-muted-foreground">{copy.devices(devices)}</span>
          </div>
          {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {devices > 0 ? (
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {copy.test}
            </Button>
          ) : null}
          {state === 'on' ? (
            <Button variant="outline" onClick={handleTurnOff} disabled={busy}>
              {copy.turnOff}
            </Button>
          ) : state === 'off' ? (
            <Button onClick={handleTurnOn} disabled={busy}>
              {copy.turnOn}
            </Button>
          ) : null}
        </div>
      </div>
    </SettingsCard>
  )
}
