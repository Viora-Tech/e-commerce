'use client'

import { ArrowLeft, CircleCheck, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Progress } from '@commerce/ui/shadcn/progress'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { gatewayGuides, paymentsSetupContent as setupCopy } from '@/data/payments-setup'
import { api } from '@/lib/api-client'
import { base, instant } from '@/lib/motion'
import GatewayConnectForm from './gateway-connect-form'
import HelpFooter from './help-footer'
import MethodsList from './methods-list'
import { openTestOrder } from './open-test-order'
import type { CheckoutMethodRow, GatewayId, PaymentsSetup } from './types'
import { isGatewayId } from './types'
import WhatsThis from './whats-this'
import WizardHowStep from './wizard-how-step'

type SetupWizardProps = {
  setup: PaymentsSetup
  /** Reload `payments.setup` (after connecting, so later steps see the new state). */
  onReload: () => Promise<void>
  /** Leave the guide for the full Payments page. */
  onDone: () => void
}

type Step = 'how' | 'connect' | 'methods' | 'test' | 'ready'

const STEPS: Step[] = ['how', 'connect', 'methods', 'test', 'ready']

const copy = setupCopy.wizard

/** COD only: every online method off, cash on delivery on. */
const codOnly = (methods: CheckoutMethodRow[]) => methods.map((m) => ({ ...m, on: m.id === 'cod' }))

/**
 * The first-time guide: one question per screen, a progress bar, and "Skip for
 * now" everywhere. How do you want to get paid? → Connect → Which payments? →
 * ₹1 test order → You're ready.
 */
export default function SetupWizard({ setup, onReload, onDone }: SetupWizardProps) {
  // Hooks
  const router = useRouter()
  const reduced = useReducedMotion()
  const [step, setStep] = useState<Step>('how')
  const [gateway, setGateway] = useState<GatewayId | 'cod' | null>(null)
  const [methods, setMethods] = useState<CheckoutMethodRow[]>(setup.methods)
  const [busy, setBusy] = useState<string | null>(null)
  const [testOpened, setTestOpened] = useState(false)

  // Helpers
  const go = (next: Step) => setStep(next)

  // Event handlers
  const handlePick = async (id: string) => {
    setBusy(id)
    try {
      if (id === 'cod') {
        await api.payments.saveMethods({ methods: codOnly(setup.methods) })
        setGateway('cod')
        await onReload()
        go('ready')
        return
      }
      if (!isGatewayId(id)) return
      if (!setup.gateways.find((g) => g.id === id)?.installed) {
        await api.apps.install({ id })
        // The new app's sidebar link comes from the server layout.
        router.refresh()
      }
      await onReload()
      setGateway(id)
      go('connect')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : setupCopy.add.installFailed)
    } finally {
      setBusy(null)
    }
  }

  const handleConnected = async () => {
    await onReload()
    go('methods')
  }

  const handleSaveMethods = async () => {
    setBusy('methods')
    try {
      await api.payments.saveMethods({ methods })
      await onReload()
      go('test')
    } catch {
      toast.error(setupCopy.methods.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  const handleTestOrder = async () => {
    if (await openTestOrder()) setTestOpened(true)
    else toast.error(setupCopy.testOrderFailed)
  }

  const handleBack = () => {
    const i = STEPS.indexOf(step)
    const prev = STEPS[i - 1]
    if (prev) go(prev)
  }

  const handleSkip = async () => {
    try {
      await api.payments.skipSetup()
    } finally {
      toast.info(copy.skipped)
      onDone()
    }
  }

  // Render logic
  const index = STEPS.indexOf(step)
  const gatewayName = gateway && gateway !== 'cod' ? gatewayGuides[gateway].name : ''
  const title =
    step === 'how'
      ? copy.how.title
      : step === 'connect'
        ? copy.connect.title(gatewayName)
        : step === 'methods'
          ? copy.methods.title
          : step === 'test'
            ? copy.test.title
            : copy.ready.title
  const body =
    step === 'how'
      ? copy.how.body
      : step === 'connect'
        ? copy.connect.body
        : step === 'methods'
          ? copy.methods.body
          : step === 'test'
            ? copy.test.body
            : gateway === 'cod'
              ? copy.ready.codBody
              : copy.ready.body

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-caption text-muted-foreground">
          <span>{copy.progress(index + 1, STEPS.length)}</span>
          {step === 'ready' ? null : (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              {copy.skip}
            </Button>
          )}
        </div>
        <Progress
          value={((index + 1) / STEPS.length) * 100}
          aria-label={copy.progress(index + 1, STEPS.length)}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={reduced ? instant : base}
        >
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                {step === 'ready' ? (
                  <CircleCheck aria-hidden="true" weight="fill" className="size-10 text-success" />
                ) : null}
                <h2 className="text-page font-semibold text-foreground">{title}</h2>
                <p className="text-body text-muted-foreground">{body}</p>
                {step === 'how' ? <WhatsThis /> : null}
              </div>

              {step === 'how' ? (
                <WizardHowStep gateways={setup.gateways} busy={busy} onPick={handlePick} />
              ) : null}

              {step === 'connect' && gateway && gateway !== 'cod' ? (
                <GatewayConnectForm
                  providerId={gateway}
                  setup={setup}
                  onConnected={handleConnected}
                />
              ) : null}

              {step === 'methods' ? (
                <>
                  <MethodsList methods={methods} hasGateway onChange={setMethods} />
                  <Button
                    size="lg"
                    className="w-full sm:w-fit"
                    onClick={handleSaveMethods}
                    disabled={busy !== null}
                  >
                    {copy.next}
                  </Button>
                </>
              ) : null}

              {step === 'test' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleTestOrder}
                    >
                      {copy.test.open}
                      <ExternalLink aria-hidden="true" className="size-4" />
                    </Button>
                    <Button size="lg" onClick={() => go('ready')}>
                      {copy.next}
                    </Button>
                  </div>
                  {testOpened ? (
                    <p className="text-caption text-success">{copy.test.opened}</p>
                  ) : null}
                </div>
              ) : null}

              {step === 'ready' ? (
                <Button size="lg" className="w-full sm:w-fit" onClick={onDone}>
                  {copy.ready.done}
                </Button>
              ) : null}

              {index > 0 && step !== 'ready' ? (
                <Button variant="ghost" className="w-fit gap-1.5 px-0" onClick={handleBack}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  {copy.back}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <HelpFooter />
    </div>
  )
}
