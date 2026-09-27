import type { TranslationPair } from '@/lib/i18n'
import account from './account'
import onboarding from './onboarding'

/**
 * Every Hindi translation, as [English export, Hindi overlay] pairs. A `data/<feature>.ts`
 * with no entry here stays English. Add a feature: write `data/hi/<feature>.ts` (default
 * export: an array of `translation(...)` pairs) and spread it in below.
 */
export const hindiCopy: readonly TranslationPair[] = [...account, ...onboarding]
