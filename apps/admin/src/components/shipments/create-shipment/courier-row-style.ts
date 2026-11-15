/**
 * The courier list's row states, kept in one place so hover and picked never fight.
 *
 * Hover is only for rows that are neither picked nor blocked. A Tailwind `hover:` class beats a
 * plain one (`.hover\:x:hover` outweighs `.x`), so a picked row that also carried the hover
 * class lost its picked colour for as long as the pointer stayed on it: right after a click the
 * new pick looked unpicked, then "arrived" when the pointer left. Hover is instant (no
 * transition) on the table rows.
 */

/** A row of the Select courier drawer's table. */
export function courierRowClass(picked: boolean, blocked: boolean): string {
  if (blocked) return 'opacity-50'
  return picked ? 'cursor-pointer bg-primary-soft' : 'cursor-pointer hover:bg-row-hover'
}
