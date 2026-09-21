import type { NotificationChannel, NotificationChannelFactory } from './types'

/**
 * Adapters register a factory; the platform instantiates one channel per
 * store from that store's settings. Mirrors PaymentRegistry.
 */
export class NotificationRegistry {
  private readonly factories = new Map<string, NotificationChannelFactory<unknown>>()

  register<C>(factory: NotificationChannelFactory<C>): this {
    this.factories.set(factory.id, factory as NotificationChannelFactory<unknown>)
    return this
  }

  ids(): string[] {
    return [...this.factories.keys()]
  }

  get(id: string): NotificationChannelFactory<unknown> | undefined {
    return this.factories.get(id)
  }

  create(
    id: string,
    rawConfig: unknown,
  ): { ok: true; channel: NotificationChannel } | { ok: false; errors: string[] } {
    const f = this.factories.get(id)
    if (!f) return { ok: false, errors: [`unknown notification channel: ${id}`] }
    const v = f.validateConfig(rawConfig)
    if (!v.ok) return v
    return { ok: true, channel: f.create(v.config) }
  }
}
