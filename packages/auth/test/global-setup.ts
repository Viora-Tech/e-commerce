import { prepareTestDatabases } from '@commerce/db/test/databases'
import type { TestProject } from 'vitest/node'

/** Migrate the template test database, then clone one copy per vitest worker. */
export default function setup(project: TestProject): Promise<void> {
  return prepareTestDatabases(project.config.maxWorkers)
}
