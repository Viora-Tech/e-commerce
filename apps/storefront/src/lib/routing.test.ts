import { describe, expect, it } from 'vitest'
import { INTERNAL_PREFIX, PASSWORD_PREFIX, routeForStore } from './routing'

describe('routeForStore', () => {
  it('rewrites a public path onto the internal store segment', () => {
    expect(routeForStore('store-a', '/')).toEqual({ kind: 'rewrite', path: '/-s/store-a' })
    expect(routeForStore('store-a', '/products/mouse')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/products/mouse',
    })
  })

  it('refuses direct requests to the internal prefix so one store cannot address another', () => {
    expect(routeForStore('store-a', `${INTERNAL_PREFIX}/store-b/products/mouse`)).toEqual({
      kind: 'forbidden',
    })
    expect(routeForStore('store-a', `${INTERNAL_PREFIX}`)).toEqual({ kind: 'forbidden' })
    expect(routeForStore('store-a', `${PASSWORD_PREFIX}/store-b`)).toEqual({ kind: 'forbidden' })
  })

  it('leaves Next internals and API routes alone', () => {
    expect(routeForStore('store-a', '/_next/static/x.js')).toEqual({ kind: 'passthrough' })
    expect(routeForStore('store-a', '/api/health')).toEqual({ kind: 'passthrough' })
  })
})
