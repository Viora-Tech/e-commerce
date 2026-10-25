/**
 * Vitest `setupFiles` entry for database-backed packages (see `parallelDbTests`):
 * moves this worker onto its own copy of the test database before any test file
 * module reads `DATABASE_URL`.
 */
import { useWorkerDatabase } from './test-env'

useWorkerDatabase()
