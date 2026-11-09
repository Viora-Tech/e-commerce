/** SPIKE shim for `@sentry/nextjs` in the browser: a real port would use `@sentry/react`. */
export function captureException(_err: unknown): string {
  return ''
}
export function captureMessage(_msg: string): string {
  return ''
}
export function addBreadcrumb(_b: unknown): void {}
export function setUser(_u: unknown): void {}
export function setTag(_k: string, _v: unknown): void {}
export function withScope(fn: (scope: { setExtra: () => void; setTag: () => void }) => void): void {
  fn({ setExtra: () => undefined, setTag: () => undefined })
}

// Names `@/lib/browser-errors` imports (the admin's bare BrowserClient setup).
const noopIntegration = () => ({ name: 'noop' })
export class BrowserClient {
  constructor(readonly options?: unknown) {}
  init(): void {}
}
export const breadcrumbsIntegration = noopIntegration
export const browserApiErrorsIntegration = noopIntegration
export const dedupeIntegration = noopIntegration
export const functionToStringIntegration = noopIntegration
export const globalHandlersIntegration = noopIntegration
export const httpContextIntegration = noopIntegration
export const linkedErrorsIntegration = noopIntegration
export const defaultStackParser = () => []
export const makeFetchTransport = () => ({})
export function setCurrentClient(_client: unknown): void {}
