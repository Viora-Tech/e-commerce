// k6 load test for the storefront pilot (docs/research/2026-11-storefront-hono-pilot.md).
//   k6 run -e BASE=http://localhost:3200 -e VUS=20 -e DURATION=45s -e HANDLES=claw-aquila-speed,... bench/product.js
// Each virtual user loads product pages back to back (no think time), cycling through HANDLES,
// with no cookies: a signed-out shopper with an empty cart, the page the render cache serves.

import { check } from 'k6'
import http from 'k6/http'

const BASE = __ENV.BASE || 'http://localhost:3200'
const HANDLES = (__ENV.HANDLES || 'claw-aquila-speed').split(',')

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '45s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: true,
}

export default function () {
  const handle = HANDLES[(__ITER + __VU) % HANDLES.length]
  const res = http.get(`${BASE}/products/${handle}`, { headers: { accept: 'text/html' } })
  check(res, { 'status is 200': (r) => r.status === 200 })
}
