/**
 * The courier list's row states, kept in one place so hover and picked never fight.
 *
 * Hover is only for rows that are neither picked nor blocked. A Tailwind `hover:` class beats a
 * plain one (`.hover\:x:hover` outweighs `.x`), so a picked row that also carried the hover
 * class lost its picked colour (table) or border (cards) for as long as the pointer stayed on
 * it: right after a click the new pick looked unpicked, then "arrived" when the pointer left.
 * Hover is instant (no transition) on the table rows; the cards keep `motion-press`'s short
 * colour fade, dropped for reduced motion.
 */

/** A row of the Select courier drawer's table. */
export function courierRowClass(picked: boolean, blocked: boolean): string {
  if (blocked) return 'opacity-50'
  return picked ? 'cursor-pointer bg-primary-soft' : 'cursor-pointer hover:bg-row-hover'
}

/** A courier card in step 2 (the button inside `CourierOption`). */
export function courierCardClass(selected: boolean, blocked: boolean): string {
  if (selected) return 'border-primary ring-1 ring-primary'
  return blocked
    ? 'border-hairline cursor-not-allowed opacity-60'
    : 'border-hairline hover:border-border-strong'
}
