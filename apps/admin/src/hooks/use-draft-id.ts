import { useCallback, useId, useRef } from 'react'

/** Stable across SSR + hydration; ref counter disambiguates siblings. */
export function useDraftId(prefix = 'draft') {
  const reactId = useId()
  const seq = useRef(0)
  return useCallback(() => {
    seq.current += 1
    return `${reactId}-${prefix}-${seq.current}`.replace(/:/g, '')
  }, [reactId, prefix])
}
