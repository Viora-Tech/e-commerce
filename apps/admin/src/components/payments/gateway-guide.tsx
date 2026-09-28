import { CheckIcon, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { type GatewayGuide as Guide, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

type GatewayGuideProps = {
  guide: Guide
  /** Which steps are done, for the green ticks. */
  done: [boolean, boolean, boolean]
  onOpenDashboard: () => void
  /** Rendered under step 2 (the key boxes) and step 3 (webhook details). */
  stepTwo?: ReactNode
  stepThree?: ReactNode
}

type StepProps = { n: number; title: string; body: string; done: boolean; children?: ReactNode }

function Step({ n, title, body, done, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-caption font-semibold text-muted-foreground data-[done=true]:border-transparent data-[done=true]:bg-success-soft data-[done=true]:text-success"
        data-done={done}
      >
        {done ? <CheckIcon aria-hidden="true" className="size-4" /> : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-body font-semibold text-foreground">{title}</p>
        <p className="text-body text-muted-foreground">{body}</p>
        {children}
      </div>
    </li>
  )
}

/** The 3 numbered steps to connect with API keys: where to click, what to copy. */
export default function GatewayGuide({
  guide,
  done,
  onOpenDashboard,
  stepTwo,
  stepThree,
}: GatewayGuideProps) {
  // Hooks
  const copy = useCopy(paymentsSetupContent)

  // Render logic
  const [one, two, three] = guide.steps

  return (
    <ol className="flex flex-col gap-6">
      <Step n={1} title={one.title} body={one.body} done={done[0]}>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="w-fit gap-1.5"
            nativeButton={false}
            render={
              <a
                href={guide.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                onClick={onOpenDashboard}
              />
            }
          >
            {copy.connect.openDashboard}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Button>
          <span className="text-caption text-muted-foreground">
            {copy.connect.signUp}{' '}
            <a
              href={guide.signupUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              {copy.connect.signUpLink}
            </a>
          </span>
        </div>
      </Step>
      <Step n={2} title={two.title} body={two.body} done={done[1]}>
        {stepTwo}
      </Step>
      <Step n={3} title={three.title} body={three.body} done={done[2]}>
        {stepThree}
      </Step>
    </ol>
  )
}
