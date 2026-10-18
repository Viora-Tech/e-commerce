export type ScoreBand = 'good' | 'fair' | 'poor'

/** Score bands: 80+ is good, 50–79 fair, below 50 needs work. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}
