import type { ChipTone } from '@/components/status/tone'

/** A store plan's status as a chip tone on the platform console (billing `StorePlanStatus`). */
export function planTone(status: string | null): ChipTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'trialing':
      return 'info'
    case 'due':
      return 'attention'
    case 'paused':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** `https://<host>` for a store's primary domain; null when it has none. */
export function storefrontHref(hostname: string | null | undefined): string | null {
  return hostname ? `https://${hostname}` : null
}
