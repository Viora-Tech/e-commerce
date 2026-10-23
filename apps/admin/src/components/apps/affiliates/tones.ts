import type { ChipTone } from '@/components/status/tone'

/** The chip colour for an affiliate's status: waiting is attention, paused or rejected quiet. */
export function statusTone(status: string): ChipTone {
  if (status === 'approved') return 'success'
  if (status === 'pending') return 'attention'
  return 'neutral'
}

/** The chip colour for a commission: on hold is info, owed attention, paid success. */
export function commissionTone(status: string): ChipTone {
  if (status === 'pending') return 'info'
  if (status === 'approved') return 'attention'
  if (status === 'paid') return 'success'
  return 'danger'
}
