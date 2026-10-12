import { addTranslations } from './copy'

let loading: Promise<void> | null = null
let loaded = false

/**
 * Loads every Hindi overlay (`data/hi`) the first time something renders in Hindi: its own
 * chunk, fetched once and kept. `getLocale()` awaits it on the server; `LocaleProvider` waits
 * for it in the browser (Hindi members only) before its children render.
 */
export function loadHindi(): Promise<void> {
  loading ??= import('@/data/hi').then(({ hindiCopy }) => {
    addTranslations(hindiCopy)
    loaded = true
  })
  return loading
}

/** True once `loadHindi()` has finished, so `localize` can answer in Hindi. */
export function hindiLoaded(): boolean {
  return loaded
}
