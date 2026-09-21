import type { ShippingProvider, ShippingProviderFactory } from './types'

/**
 * Adapters register a factory; the platform instantiates one provider per
 * store from that store's settings. Mirrors PaymentRegistry.
 */
export class ShippingRegistry {
  private readonly factories = new Map<string, ShippingProviderFactory<unknown>>()

  register<C>(factory: ShippingProviderFactory<C>): this {
    this.factories.set(factory.id, factory as ShippingProviderFactory<unknown>)
    return this
  }

  ids(): string[] {
    return [...this.factories.keys()]
  }

  get(id: string): ShippingProviderFactory<unknown> | undefined {
    return this.factories.get(id)
  }

  create(
    id: string,
    rawConfig: unknown,
  ): { ok: true; provider: ShippingProvider } | { ok: false; errors: string[] } {
    const f = this.factories.get(id)
    if (!f) return { ok: false, errors: [`unknown shipping provider: ${id}`] }
    const v = f.validateConfig(rawConfig)
    if (!v.ok) return v
    return { ok: true, provider: f.create(v.config) }
  }
}
