import type { ReactNode } from 'react'

type AdminTemplateProps = { children: ReactNode }

/**
 * Re-mounts on every navigation: page content fades in with a 4px rise. This is the only
 * page-enter fade in the admin shell (admin-frame.tsx used to have a second, nested one at
 * 220ms; opacity roughly multiplies when two fades stack, so content read as faint for much
 * longer than either duration alone). Kept short (150ms) so real content, not a fade, is what
 * the merchant waits on.
 *
 * A CSS animation (tw-animate-css), not a JS one: a page opened in a background tab got no
 * animation frames, so the JS fade sat at opacity 0 and the page looked blank. CSS also skips
 * it under "reduce motion".
 */
export default function AdminTemplate({ children }: AdminTemplateProps) {
  return (
    <div className="min-h-full animate-in fade-in-0 slide-in-from-bottom-1 duration-150 ease-out motion-reduce:animate-none">
      {children}
    </div>
  )
}
