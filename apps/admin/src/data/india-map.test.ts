import { describe, expect, it } from 'vitest'
import { INDIAN_STATES } from './india'
import { INDIA_MAP_LOCATIONS, MAP_ID_CENTER, STATE_CODE_TO_MAP_ID } from './india-map'

describe('india-map', () => {
  it('gives every shipping-address state a map path and a dot position', () => {
    const mapIds = new Set(INDIA_MAP_LOCATIONS.map((l) => l.id))
    for (const { code } of INDIAN_STATES) {
      const mapId = STATE_CODE_TO_MAP_ID[code]
      expect(mapId, `${code} has no map id`).toBeDefined()
      expect(mapIds.has(mapId as string), `${code} -> ${mapId} is not a real map path`).toBe(true)
      expect(
        MAP_ID_CENTER[mapId as string],
        `${code} -> ${mapId} has no dot position`,
      ).toBeDefined()
    }
  })

  it('folds Ladakh into the same path as Jammu and Kashmir (no separate outline in this source)', () => {
    expect(STATE_CODE_TO_MAP_ID.LA).toBe(STATE_CODE_TO_MAP_ID.JK)
  })

  it('every dot position sits inside the map viewBox', () => {
    for (const [id, pos] of Object.entries(MAP_ID_CENTER)) {
      expect(pos.x, id).toBeGreaterThanOrEqual(0)
      expect(pos.x, id).toBeLessThanOrEqual(612)
      expect(pos.y, id).toBeGreaterThanOrEqual(0)
      expect(pos.y, id).toBeLessThanOrEqual(696)
    }
  })
})
