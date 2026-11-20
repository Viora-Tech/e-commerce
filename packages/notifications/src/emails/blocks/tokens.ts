import { theme } from '../theme'

/**
 * What a block's colour means (Figma "Emails" batches): `accent` the store's highlight (info,
 * "what changed"), `good` green (paid, delivered, accepted), `bad` red (failed, declined,
 * cannot be undone), `neutral` grey (plain facts).
 */
export type Tone = 'accent' | 'good' | 'bad' | 'neutral'

/** The strong colour and the soft background of a tone; `accent` uses the store's colour. */
export function toneColours(tone: Tone, accent: string): { ink: string; bg: string } {
  switch (tone) {
    case 'good':
      return { ink: theme.good, bg: theme.goodBg }
    case 'bad':
      return { ink: theme.bad, bg: theme.badBg }
    case 'neutral':
      return { ink: theme.body, bg: theme.soft }
    default:
      return { ink: accent, bg: '#f5f1fe' }
  }
}

/** The small spaced caps label used on tickets, facts and codes ("FROM", "PICKUP AWB"). */
export const CAPS = {
  margin: 0,
  fontSize: '10px',
  lineHeight: '14px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: theme.muted,
}

/** Every block sits in the card with the same side padding; phones narrow it (`k-pad`). */
export const BLOCK_PAD = { padding: '24px 48px 0' }
