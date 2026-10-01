'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CourierConnectGuide, CourierGuideCopy
 * WHAT:  the 3-step guide at the top of a courier's Connect page: where to get each value, in plain words.
 * WHY:   one owner instead of three near-identical copies (Delhivery, Shiprocket, RapidShyp);
 *        the only per-courier difference is the optional step-two warning.
 * WHERE: the courier Connect wrappers (components/apps/{delhivery,shiprocket,rapidshyp}/connect-page.tsx).
 */

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import ConnectStep from './connect-step'

export type CourierGuideCopy = {
  dashboardUrl: string
  signupUrl: string
  openDashboard: string
  noAccount: string
  signUp: string
  steps: {
    one: { title: string; body: string }
    two: { title: string; body: string; warning?: string }
    three: { title: string; body: string }
  }
}

type CourierConnectGuideProps = {
  copy: CourierGuideCopy
  openedDashboard: boolean
  onOpenDashboard: () => void
  step2Done: boolean
  step3Done: boolean
}

export default function CourierConnectGuide({
  copy,
  openedDashboard,
  onOpenDashboard,
  step2Done,
  step3Done,
}: CourierConnectGuideProps) {
  return (
    <Card size="form">
      <CardContent className="flex flex-col gap-5">
        <ol className="flex flex-col gap-5">
          <ConnectStep n={1} title={copy.steps.one.title} done={openedDashboard}>
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
          </ConnectStep>
          <ConnectStep n={2} title={copy.steps.two.title} done={step2Done}>
            <p className="text-body text-muted-foreground">{copy.steps.two.body}</p>
            {copy.steps.two.warning ? (
              <p className="text-caption text-warning-foreground dark:text-warning">
                {copy.steps.two.warning}
              </p>
            ) : null}
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
          </ConnectStep>
          <ConnectStep n={3} title={copy.steps.three.title} done={step3Done}>
            <p className="text-body text-muted-foreground">{copy.steps.three.body}</p>
          </ConnectStep>
        </ol>
      </CardContent>
    </Card>
  )
}
