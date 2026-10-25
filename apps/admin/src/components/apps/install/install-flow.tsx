'use client'

import { Dialog, DialogContent } from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { appInstallContent } from '@/data/app-install'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { openHref } from '@/lib/app-access'
import type { AppSummary } from '@/lib/app-summary'
import InstallBuyStep from './install-buy-step'
import InstallConnectStep, { type ConnectForm, type TestState } from './install-connect-step'
import InstallDoneStep from './install-done-step'
import InstallPermissionsStep from './install-permissions-step'
import InstallSteps from './install-steps'

type InstallFlowProps = {
  /** The app to install; null keeps the flow closed. */
  appId: string | null
  /** The store's apps as `apps.list` reads them; null while they load. */
  apps: AppSummary[] | null
  onClose: () => void
  /** Called once the app is installed, before the Done step shows. */
  onInstalled: () => void
}

type Step = 'loading' | 'buy' | 'connect' | 'permissions' | 'done'

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * The install flow (Figma "Connect step 1–3"): a connection whose account can be typed here
 * connects first, then the permissions, then Done; any other app goes straight to permissions.
 * Installing and saving the account happen in one request, so nothing is left half connected.
 */
export default function InstallFlow({ appId, apps, onClose, onInstalled }: InstallFlowProps) {
  // Hooks
  const copy = useCopy(appInstallContent)
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [form, setForm] = useState<ConnectForm | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<AppSummary | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: starts once the app list is in
  useEffect(() => {
    if (!appId || apps === null) return
    const app = apps.find((a) => a.id === appId && !a.builtIn)
    if (!app) {
      toast.error(copy.unknownApp)
      onClose()
      return
    }
    // Already installed: there is nothing to install, so open it.
    if (app.installed) {
      onClose()
      router.push(openHref(app) ?? '/apps')
      return
    }
    setStep('loading')
    setForm(null)
    setValues({})
    setTest({ status: 'idle' })
    setDone(null)
    // A paid app the plan does not include is bought first; paying installs it.
    if (app.billing.state === 'buy') {
      setStep('buy')
      return
    }
    if (app.connectsIn !== 'flow') {
      setStep('permissions')
      return
    }
    api.apps
      .connectForm({ id: app.id })
      .then((f) => {
        setForm(f)
        setStep(f ? 'connect' : 'permissions')
      })
      .catch(() => {
        toast.error(copy.connect.loadFailed)
        setStep('permissions')
      })
  }, [appId, apps === null])

  // Helpers
  const currentApp = () => (appId ? (apps?.find((a) => a.id === appId) ?? null) : null)
  const runTest = async (): Promise<boolean> => {
    const app = currentApp()
    if (!app || !form) return false
    setTest({ status: 'testing' })
    try {
      const r = await api.apps.testConnection({
        id: app.id,
        providerId: form.providerId,
        fields: values,
      })
      setTest({ status: r.ok ? 'ok' : 'error', message: r.message })
      return r.ok
    } catch (err) {
      setTest({ status: 'error', message: errorText(err, copy.connect.testFailed) })
      return false
    }
  }

  // Event handlers
  const handleField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setTest({ status: 'idle' })
  }

  const handleContinue = async () => {
    if (test.status === 'ok' || (await runTest())) setStep('permissions')
  }

  const handleInstall = async () => {
    const app = currentApp()
    if (!app) return
    setBusy(true)
    try {
      await api.apps.install({
        id: app.id,
        ...(form && test.status === 'ok'
          ? { connect: { providerId: form.providerId, fields: values } }
          : {}),
      })
      const fresh = (await api.apps.list()).find((a) => a.id === app.id) ?? app
      toast.success(copy.installedToast(app.name))
      setDone(fresh)
      setStep('done')
      onInstalled()
    } catch (err) {
      toast.error(errorText(err, copy.permissions.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const app = currentApp()
  const steps = form
    ? [copy.steps.connect, copy.steps.permissions, copy.steps.done]
    : [copy.steps.permissions, copy.steps.done]
  const index = { loading: 0, buy: 0, connect: 0, permissions: form ? 1 : 0, done: form ? 2 : 1 }[
    step
  ]

  return (
    <Dialog open={app !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex flex-col gap-5 sm:max-w-[32.5rem]">
        {app ? (
          <>
            {step === 'buy' ? null : <InstallSteps steps={steps} current={index} />}
            {step === 'buy' && app.billing.state === 'buy' ? (
              <InstallBuyStep
                appId={app.id}
                appName={app.name}
                access={app.billing}
                onCancel={onClose}
              />
            ) : step === 'loading' ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : step === 'connect' && form ? (
              <InstallConnectStep
                appName={app.name}
                form={form}
                values={values}
                test={test}
                onField={handleField}
                onTest={() => void runTest()}
                onCancel={onClose}
                onContinue={() => void handleContinue()}
              />
            ) : step === 'permissions' ? (
              <InstallPermissionsStep
                app={app}
                connected={test.status === 'ok' ? (test.message ?? null) : null}
                busy={busy}
                onBack={form ? () => setStep('connect') : null}
                onCancel={onClose}
                onInstall={() => void handleInstall()}
              />
            ) : done ? (
              <InstallDoneStep app={done} onClose={onClose} />
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
