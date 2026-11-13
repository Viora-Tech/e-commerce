import 'server-only'
import { registerSearchEngine } from './search-engine-register'

/**
 * Imported for its effect by the search page, the predictive search route and the Liquid theme.
 * The engine is already registered at boot (`instrumentation.ts`); this only covers a process
 * where instrumentation did not run, and never replaces the boot's choice.
 */
registerSearchEngine()
