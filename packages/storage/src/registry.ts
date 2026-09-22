import type { StorageProvider, StorageProviderFactory } from './types'

/**
 * Adapters register a factory; the platform instantiates one provider per
 * store from that store's settings. Mirrors PaymentRegistry and ShippingRegistry.
 */
export class StorageRegistry {
  private readonly factories = new Map<string, StorageProviderFactory<unknown>>()

  register<C>(factory: StorageProviderFactory<C>): this {
    this.factories.set(factory.id, factory as StorageProviderFactory<unknown>)
    return this
  }

  ids(): string[] {
    return [...this.factories.keys()]
  }

  get(id: string): StorageProviderFactory<unknown> | undefined {
    return this.factories.get(id)
  }

  create(
    id: string,
    rawConfig: unknown,
  ): { ok: true; provider: StorageProvider } | { ok: false; errors: string[] } {
    const f = this.factories.get(id)
    if (!f) return { ok: false, errors: [`unknown storage provider: ${id}`] }
    const v = f.validateConfig(rawConfig)
    if (!v.ok) return v
    return { ok: true, provider: f.create(v.config) }
  }
}
