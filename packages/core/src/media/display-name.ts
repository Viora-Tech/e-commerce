/** SOURCE OF TRUTH: a file's display name at upload (#91) — WHAT the merchant's own file name, tidied, kept on `media.name` / WHY the storage key carries an id and a slug, which Files used to show as the name */

/** Longest name kept; a name is for reading in a list, not a description. */
const NAME_MAX = 120

/** "Mouse pad_final.JPG" → "Mouse pad_final": the uploaded file's name without its extension. */
export function uploadedName(filename: string): string | null {
  const base = filename
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[a-z0-9]{1,5}$/i, '')
    .trim()
  return base ? base.slice(0, NAME_MAX) : null
}
