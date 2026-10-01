/**
 * SOURCE OF TRUTH KEYWORDS: initials, avatar letters
 * WHAT:  Two letters for an avatar disc: first letters of the first two words of the name,
 *        else the first two letters of the name or email, else "?".
 * WHY:   The customer avatar, staff table and top bar each had their own rule, so one
 *        person showed different letters in different places.
 * WHERE: customer-avatar, staff members-card, layout top-bar.
 */
export function initials(name: string | null, email: string | null = null): string {
  const source = name?.trim() || email?.trim() || ''
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}
