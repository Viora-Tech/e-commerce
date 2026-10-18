import { initLogger } from 'evlog'

// Every procedure call emits a wide event (`procedureLog`); the suites make thousands of calls,
// so the logger stays off here. Tests that need a log line spy on `logger` instead.
initLogger({ enabled: false })
