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
