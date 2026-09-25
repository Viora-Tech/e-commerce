'use client'

import { CheckIcon, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import { shiprocketAppContent as appCopy } from '@/data/shiprocket'

type ConnectGuideProps = {
  openedDashboard: boolean
  onOpenDashboard: () => void
  step2Done: boolean
  step3Done: boolean
}

type StepProps = { n: number; title: string; done: boolean; children: ReactNode }

const copy = appCopy.connect

function Step({ n, title, done, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-caption font-semibold text-muted-foreground data-[done=true]:border-transparent data-[done=true]:bg-success-soft data-[done=true]:text-success"
        data-done={done}
      >
        {done ? <CheckIcon aria-hidden="true" className="size-3.5" /> : n}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </li>
  )
}

/** The 3-step guide at the top of the Connect page: where to get each value, in plain words. */
export default function ConnectGuide({
  openedDashboard,
  onOpenDashboard,
  step2Done,
  step3Done,
}: ConnectGuideProps) {
  return (
    <Card size="form">
      <CardContent className="flex flex-col gap-5">
        <ol className="flex flex-col gap-5">
          <Step n={1} title={copy.steps.one.title} done={openedDashboard}>
            <p className="text-body text-muted-foreground">{copy.steps.one.body}</p>
            <Button
              variant="outline"
              className="w-fit gap-1.5"
              render={
                <a
                  href={copy.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onOpenDashboard}
                />
              }
            >
              {copy.openDashboard}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Button>
          </Step>
          <Step n={2} title={copy.steps.two.title} done={step2Done}>
            <p className="text-body text-muted-foreground">{copy.steps.two.body}</p>
            <p className="text-caption text-muted-foreground">
              {copy.noAccount}{' '}
              <a
                href={copy.signupUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-2"
              >
                {copy.signUp}
              </a>
            </p>
          </Step>
          <Step n={3} title={copy.steps.three.title} done={step3Done}>
            <p className="text-body text-muted-foreground">{copy.steps.three.body}</p>
          </Step>
        </ol>
      </CardContent>
    </Card>
  )
}
