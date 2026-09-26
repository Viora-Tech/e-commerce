/**
 * Mailbox formatting for the From header, with no SDK import so pure callers
 * can use it. A merchant types the display name, so it is treated as hostile:
 * line breaks and angle brackets are dropped (no header injection), quotes are
 * escaped, and non-ASCII names ("वाइमर्स") are MIME encoded-words, which is
 * what SES v2 asks for in `FromEmailAddress`.
 */

/** RFC 5322 atext plus spaces: a phrase made only of these needs no quotes. */
const BARE_PHRASE = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~ ]+$/

/** Strip what could break out of the header, and squash whitespace. */
export function cleanDisplayName(name: string): string {
  return name
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

// Non-ASCII check without a control-character regex (Biome flags those).
const isAscii = (s: string) => [...s].every((ch) => (ch.codePointAt(0) ?? 0) < 128)

/** `Name <a@b.c>`, quoted or encoded as needed; the bare address when there is no name. */
export function formatMailbox(name: string | undefined, email: string): string {
  const clean = name ? cleanDisplayName(name) : ''
  if (!clean) return email
  if (!isAscii(clean)) {
    return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?= <${email}>`
  }
  if (BARE_PHRASE.test(clean)) return `${clean} <${email}>`
  return `"${clean.replace(/["\\]/g, (c) => `\\${c}`)}" <${email}>`
}
