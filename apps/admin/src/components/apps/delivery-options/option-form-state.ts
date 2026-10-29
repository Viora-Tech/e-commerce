import {
  type DeliveryOption,
  type DeliveryOptionInput,
  DeliveryOptionInputSchema,
  type OptionRoutes,
  type RouteSelector,
} from '@commerce/core/delivery-options'
import { toNumber, toPaise, toRupees } from './format'

/** The option page as typed: numbers stay strings so "12." survives. */
export type OptionForm = {
  name: string
  description: string
  speed: DeliveryOptionInput['speed']
  strategy: DeliveryOptionInput['strategy']
  preferDirect: string
  routeMode: OptionRoutes['mode']
  selectors: RouteSelector[]
  priceSource: DeliveryOptionInput['price']['source']
  markup: string
  markupPercent: string
  freeAbove: string
  min: string
  max: string
  insurance: DeliveryOptionInput['insurance']['default']
  insuranceAbove: string
  etaSource: DeliveryOptionInput['eta']['source']
  fixedMin: string
  fixedMax: string
  buffer: string
  processing: string
  maxDays: string
  cod: DeliveryOptionInput['cod']['mode']
  enabled: boolean
}

const days = (n: number | null | undefined) => (n == null ? '' : String(n))

export function formOf(o: DeliveryOption | null): OptionForm {
  const x = o ?? { ...DeliveryOptionInputSchema.parse({ name: '-' }), name: '' }
  return {
    name: x.name,
    description: x.description ?? '',
    speed: x.speed,
    strategy: x.strategy,
    preferDirect: toRupees(x.preferDirectWithinPaise),
    routeMode: x.routes.mode,
    selectors: x.routes.mode === 'any' ? [] : x.routes.selectors,
    priceSource: x.price.source,
    markup: toRupees(x.price.markupPaise || null),
    markupPercent: x.price.markupPercent ? String(x.price.markupPercent) : '',
    freeAbove: toRupees(x.price.freeAbovePaise),
    min: toRupees(x.price.minPaise),
    max: toRupees(x.price.maxPaise),
    insurance: x.insurance.default,
    insuranceAbove: toRupees(x.insurance.onlyAbovePaise),
    etaSource: x.eta.source,
    fixedMin: days(x.eta.fixedMinDays),
    fixedMax: days(x.eta.fixedMaxDays),
    buffer: x.eta.bufferDays ? String(x.eta.bufferDays) : '',
    processing: x.eta.processingDays ? String(x.eta.processingDays) : '',
    maxDays: days(x.eta.maxDays),
    cod: x.cod.mode,
    enabled: x.enabled,
  }
}

const whole = (s: string) => {
  const n = toNumber(s)
  return n === null ? null : Math.round(n)
}

/** The form as the API takes it; express is always prepaid only. */
export function inputOf(f: OptionForm): DeliveryOptionInput {
  const routes: OptionRoutes =
    f.routeMode === 'any' || f.selectors.length === 0
      ? { mode: 'any' }
      : { mode: f.routeMode, selectors: f.selectors }
  return DeliveryOptionInputSchema.parse({
    name: f.name.trim(),
    description: f.description.trim() || null,
    speed: f.speed,
    strategy: f.strategy,
    preferDirectWithinPaise: toPaise(f.preferDirect),
    routes,
    price: {
      source: f.priceSource,
      markupPaise: toPaise(f.markup) ?? 0,
      markupPercent: toNumber(f.markupPercent) ?? 0,
      freeAbovePaise: toPaise(f.freeAbove),
      minPaise: toPaise(f.min),
      maxPaise: toPaise(f.max),
    },
    insurance: { default: f.insurance, onlyAbovePaise: toPaise(f.insuranceAbove) },
    eta: {
      source: f.etaSource,
      fixedMinDays: whole(f.fixedMin),
      fixedMaxDays: whole(f.fixedMax),
      bufferDays: whole(f.buffer) ?? 0,
      processingDays: whole(f.processing) ?? 0,
      maxDays: whole(f.maxDays),
    },
    cod: { mode: f.speed === 'express' ? 'prepaid_only' : f.cod },
    enabled: f.enabled,
  })
}
