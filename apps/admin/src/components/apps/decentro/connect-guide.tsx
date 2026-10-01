'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import ConnectStep from '@/components/apps/shared/connect-step'
import { decentroAppContent as appCopy } from '@/data/decentro'

type ConnectGuideProps = {
  step1Done: boolean
  step2Done: boolean
  step3Done: boolean
  onOpenSignup: () => void
}

const copy = appCopy.connect

/** The 3-step guide at the top of the Connect page: where each value comes from, in plain words. */
export default function ConnectGuide({
  step1Done,
  step2Done,
  step3Done,
  onOpenSignup,
}: ConnectGuideProps) {
  return (
    <Card size="form">
      <CardContent className="flex flex-col gap-5">
        <ol className="flex flex-col gap-5">
          <ConnectStep n={1} title={copy.steps.one.title} done={step1Done}>
            <p className="text-body text-muted-foreground">{copy.steps.one.body}</p>
            <p className="text-caption text-muted-foreground">{copy.steps.one.note}</p>
            <Button
              variant="outline"
              className="w-fit gap-1.5"
              render={
                <a href={copy.signupUrl} target="_blank" rel="noreferrer" onClick={onOpenSignup} />
              }
            >
              {copy.openSignup}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Button>
          </ConnectStep>
          <ConnectStep n={2} title={copy.steps.two.title} done={step2Done}>
            <p className="text-body text-muted-foreground">{copy.steps.two.body}</p>
          </ConnectStep>
          <ConnectStep n={3} title={copy.steps.three.title} done={step3Done}>
            <p className="text-body text-muted-foreground">{copy.steps.three.body}</p>
            <a
              href={`mailto:${copy.supportEmail}`}
              className="w-fit text-body font-medium text-foreground underline underline-offset-2"
            >
              {copy.supportEmail}
            </a>
          </ConnectStep>
        </ol>
      </CardContent>
    </Card>
  )
}
