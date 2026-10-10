import type { DeviceDescription } from '@commerce/core/member-account'
import type { accountContent } from '@/data/account'

type Copy = typeof accountContent

/** "Chrome on Windows", or whatever part of it is known. */
export function deviceName(device: DeviceDescription, copy: Copy): string {
  return copy.device.label(device.browser, device.os)
}

/** "Bengaluru, IN" when the proxy told us, else the masked IP, else "Place unknown". */
export function devicePlace(
  place: { city: string | null; country: string | null; ipMasked: string | null },
  copy: Copy,
): string {
  const where = [place.city, place.country].filter(Boolean).join(', ')
  if (where) return where
  return place.ipMasked ? copy.device.ip(place.ipMasked) : copy.device.unknownPlace
}
