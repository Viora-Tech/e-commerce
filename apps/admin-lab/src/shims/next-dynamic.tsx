/** SPIKE shim for `next/dynamic`: React.lazy plus Suspense with the optional loading fallback. */
import { type ComponentType, type JSX, lazy, type ReactNode, Suspense } from 'react'

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>

export default function dynamic<P extends object>(
  load: Loader<P>,
  options?: { loading?: () => ReactNode; ssr?: boolean },
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const m = await load()
    return 'default' in m ? m : { default: m }
  })
  const fallback = options?.loading?.() ?? null
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...(props as P & JSX.IntrinsicAttributes)} />
      </Suspense>
    )
  }
}
