import type { ReactNode } from 'react'
import StoreMark from './store-mark'

type AuthFrameProps = {
  store: { name: string; iconUrl: string | null; email: string | null; origin: string }
  children: ReactNode
}

/**
 * shadcn's login-03 frame for the signed-out portal pages: a muted page, the store's mark and
 * name above one narrow card, and the store's support email in small type below.
 */
export default function AuthFrame({ store, children }: AuthFrameProps) {
  // Render logic
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href={store.origin} className="flex items-center gap-2 self-center font-medium">
          <StoreMark name={store.name} iconUrl={store.iconUrl} size="sm" />
          {store.name}
        </a>
        {children}
        {store.email ? (
          <p className="text-center text-xs text-balance text-muted-foreground">
            <a
              href={`mailto:${store.email}`}
              className="underline underline-offset-4 hover:text-primary"
            >
              {store.email}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  )
}
