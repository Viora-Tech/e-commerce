import type { Level } from './role-access'

/**
 * One colour per permission level, shared by the role page's radios, its summary bar and the
 * roles list: Allowed green, Ask first amber, Off muted. A filled dot is the level a row is on.
 */
export const LEVEL_FILL: Record<Level, string> = {
  allowed: 'border-success bg-success',
  ask: 'border-warning bg-warning',
  off: 'border-muted-foreground/70 bg-muted-foreground/70',
}

/** The summary's hollow dot for Off ("○ 20 off"): nothing granted. */
export const LEVEL_DOT: Record<Level, string> = {
  allowed: 'bg-success',
  ask: 'bg-warning',
  off: 'border border-muted-foreground/70',
}

/** Text beside a summary dot. */
export const LEVEL_TEXT: Record<Level, string> = {
  allowed: 'text-foreground',
  ask: 'text-warning-foreground dark:text-warning',
  off: 'text-muted-foreground',
}
