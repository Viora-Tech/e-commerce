import { Spinner } from '@commerce/ui/shadcn/spinner'

/** The code editor has no skeleton of its own yet: a centred spinner instead of a blank screen. */
export default function Loading() {
  return (
    <div className="flex h-svh items-center justify-center bg-sidebar">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}
