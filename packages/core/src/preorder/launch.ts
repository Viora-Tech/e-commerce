/**
 * Launch countdown. `launchAt` is stored timezone-aware (UTC in the column,
 * Asia/Kolkata is only how the admin form and storefront display it), so the
 * check itself is a plain instant comparison; no timezone math needed here.
 */
export function isLaunched(launchAt: Date | null, now: Date = new Date()): boolean {
  if (!launchAt) return true
  return now.getTime() >= launchAt.getTime()
}

export function msUntilLaunch(launchAt: Date | null, now: Date = new Date()): number {
  if (!launchAt) return 0
  return Math.max(0, launchAt.getTime() - now.getTime())
}
