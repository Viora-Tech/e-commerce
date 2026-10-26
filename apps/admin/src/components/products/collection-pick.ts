type Option = { id: string }

/**
 * `ids` with `picked` added, when `picked` is one of the offered collections and not in yet;
 * otherwise `ids` itself. The picker's Select reports `null` when its item list changes, and
 * `String(null)` once reached the API as a collection id, so the save failed with "Input
 * validation failed" (#804).
 */
export function withCollection(
  ids: string[],
  options: readonly Option[],
  picked: unknown,
): string[] {
  if (typeof picked !== 'string' || ids.includes(picked)) return ids
  return options.some((o) => o.id === picked) ? [...ids, picked] : ids
}

/** The ids to save: offered collections only, each once, in the order they were picked. */
export function collectionIdsToSave(ids: readonly string[], options: readonly Option[]): string[] {
  const offered = new Set(options.map((o) => o.id))
  return [...new Set(ids)].filter((id) => offered.has(id))
}
