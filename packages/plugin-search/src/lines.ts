/** Synonym groups as the admin's textarea shows them: one group per line, words split by commas. */
export function synonymLines(groups: string[][]): string {
  return groups.map((g) => g.join(', ')).join('\n')
}

/** The textarea's lines back into groups: lower case, no repeats, two or more words each. */
export function parseSynonymLines(text: string): string[][] {
  const groups: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    const words = [
      ...new Set(
        line
          .split(',')
          .map((w) => w.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60))
          .filter(Boolean),
      ),
    ]
    if (words.length >= 2) groups.push(words)
  }
  return groups
}
