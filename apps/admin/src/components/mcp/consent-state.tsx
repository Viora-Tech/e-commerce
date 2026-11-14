import { CircleAlert } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'

type ConsentStateProps = { title: string; body: string }

/** The consent page when it cannot ask: a bad sign-in link, or not a member of the store. */
export default function ConsentState({ title, body }: ConsentStateProps) {
  return (
    <main className="flex min-h-svh items-start justify-center px-4 pt-[12vh]">
      <Card className="flex w-full max-w-md flex-col items-center gap-3 p-6 text-center">
        <CircleAlert className="size-6 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-page-title text-ink-strong">{title}</h1>
        <p className="text-body text-muted-foreground">{body}</p>
      </Card>
    </main>
  )
}
