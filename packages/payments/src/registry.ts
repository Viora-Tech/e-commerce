import type { PaymentProvider, PaymentProviderFactory } from './types'

/**
 * Adapters register a factory; the platform instantiates one provider per
 * store from that store's settings. This is the whole plugin mechanism for
 * payments: a factory in a package, a row in the store's settings.
 */
export class PaymentRegistry {
  private readonly factories = new Map<string, PaymentProviderFactory<unknown>>()

  register<C>(factory: PaymentProviderFactory<C>): this {
    this.factories.set(factory.id, factory as PaymentProviderFactory<unknown>)
    return this
  }

  ids(): string[] {
    return [...this.factories.keys()]
  }

  get(id: string): PaymentProviderFactory<unknown> | undefined {
    return this.factories.get(id)
  }

  /**
   * The raw config a factory is built from out of a store's saved provider
   * configs: its own, over the config it borrows (`credentialsFrom`).
   */
  configFor(id: string, saved: Record<string, Record<string, string>>): Record<string, string> {
    return providerConfig(this.factories.get(id), id, saved)
  }

  /** Build a provider from a store's raw config, or explain why it cannot. */
  create(
    id: string,
    rawConfig: unknown,
  ): { ok: true; provider: PaymentProvider } | { ok: false; errors: string[] } {
    const f = this.factories.get(id)
    if (!f) return { ok: false, errors: [`unknown payment provider: ${id}`] }
    const v = f.validateConfig(rawConfig)
    if (!v.ok) return v
    return { ok: true, provider: f.create(v.config) }
  }
}

/** `configFor` without a registry, for callers that only hold a factory. */
export function providerConfig(
  factory: Pick<PaymentProviderFactory<unknown>, 'credentialsFrom'> | undefined,
  id: string,
  saved: Record<string, Record<string, string>>,
): Record<string, string> {
  const from = factory?.credentialsFrom
  return from ? { ...(saved[from] ?? {}), ...(saved[id] ?? {}) } : { ...(saved[id] ?? {}) }
}
