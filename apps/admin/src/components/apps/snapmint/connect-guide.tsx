'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import ConnectStep from '@/components/apps/shared/connect-step'
import { snapmintAppContent } from '@/data/snapmint'
import { useCopy } from '@/hooks/use-copy'

type ConnectGuideProps = {
  step1Done: boolean
  step2Done: boolean
  step3Done: boolean
  onOpenSignup: () => void
}

/** The 3-step guide on Snapmint's Connect page: the details, what Snapmint must set up, the form. */
export default function ConnectGuide({
  step1Done,
  step2Done,
  step3Done,
  onOpenSignup,
}: ConnectGuideProps) {
  // Hooks
  const { connect: copy } = useCopy(snapmintAppContent)

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
          </ConnectStep>
        </ol>
      </CardContent>
    </Card>
  )
}
