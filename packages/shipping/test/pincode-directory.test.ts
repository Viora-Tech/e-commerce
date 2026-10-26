import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  buildPincodeDirectory,
  decodePincodeDirectory,
  type PincodeSourceRow,
} from '../src/pincode'
import { readPincodeDirectory } from '../src/pincode-directory'

/*
 * A hand-written fixture shaped like India Post's directory (one row per post
 * office). Not the real dataset: tests never download it.
 */
const ROWS: PincodeSourceRow[] = [
  { pincode: '110001', district: 'NEW DELHI', state: 'DELHI' },
  { pincode: '110001', district: 'NEW DELHI', state: 'DELHI' },
  { pincode: '110001', district: 'CENTRAL DELHI', state: 'DELHI' },
  { pincode: '122001', district: 'GURGAON', state: 'HARYANA' },
  { pincode: '560001', district: 'BANGALORE', state: 'KARNATAKA' },
  { pincode: '744101', district: 'SOUTH ANDAMAN', state: 'ANDAMAN AND NICOBAR ISLANDS' },
  { pincode: '012345', district: 'NOWHERE', state: 'DELHI' },
  { pincode: '400001', district: 'MUMBAI', state: 'ATLANTIS' },
]

const STATES: Record<string, string> = {
  delhi: 'DL',
  haryana: 'HR',
  karnataka: 'KA',
  'andaman and nicobar islands': 'AN',
}
const stateOf = (s: string) => STATES[s.toLowerCase()] ?? null

describe('PIN code directory', () => {
  const { file, skipped } = buildPincodeDirectory(ROWS, stateOf, 'fixture')

  it('keeps one row per PIN code, choosing the district most offices are in', () => {
    expect(skipped).toBe(2)
    expect(file.rows.map((r) => r[0])).toEqual([110001, 122001, 560001, 744101])
    const dir = decodePincodeDirectory(file)
    expect(dir.size).toBe(4)
    expect(dir.lookup('110001')).toEqual({ district: 'New Delhi', stateCode: 'DL' })
  })

  it('looks up what shoppers type, and nothing that is not a PIN code', () => {
    const dir = decodePincodeDirectory(file)
    expect(dir.lookup('122 001')).toEqual({ district: 'Gurgaon', stateCode: 'HR' })
    expect(dir.lookup('744-101')).toEqual({ district: 'South Andaman', stateCode: 'AN' })
    expect(dir.lookup('999999')).toBeNull()
    expect(dir.lookup('012345')).toBeNull()
    expect(dir.lookup('')).toBeNull()
  })

  it('stores each district name once', () => {
    expect(file.districts).toEqual(['New Delhi', 'Gurgaon', 'Bangalore', 'South Andaman'])
  })

  it('refuses a malformed file', () => {
    expect(() => decodePincodeDirectory({ v: 2 })).toThrow(/version 1/)
    expect(() =>
      decodePincodeDirectory({ v: 1, source: '', districts: [], rows: [[110001, 0, 'DL']] }),
    ).toThrow(/Malformed/)
  })

  it('reads a gzipped file from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pincodes-'))
    const path = join(dir, 'pincode-directory.json.gz')
    writeFileSync(path, gzipSync(JSON.stringify(file)))
    const loaded = readPincodeDirectory(path)
    expect(loaded.source).toBe('fixture')
    expect(loaded.lookup('560001')?.district).toBe('Bangalore')
  })

  it('title-cases place names', () => {
    const { file: f } = buildPincodeDirectory(
      [
        { pincode: '180001', district: '  JAMMU  AND KASHMIR ', state: 'DELHI' },
        { pincode: '700001', district: 'north 24 parganas', state: 'DELHI' },
      ],
      stateOf,
      'fixture',
    )
    expect(f.districts).toEqual(['Jammu and Kashmir', 'North 24 Parganas'])
  })
})

/*
 * The shipped file (scripts/build-pincode-directory.ts). If it goes missing,
 * checkout silently loses City/State autofill, so these fail instead.
 */
describe('installed PIN code directory', () => {
  const dir = readPincodeDirectory(
    fileURLToPath(new URL('../data/pincode-directory.json.gz', import.meta.url)),
  )

  it('covers every PIN code and credits its source', () => {
    expect(dir.size).toBeGreaterThan(19000)
    expect(dir.source).toMatch(/Department of Posts.*Government Open Data Licence - India/)
  })

  it.each([
    ['110001', 'Central Delhi', 'DL'],
    ['122001', 'Gurugram', 'HR'],
    ['400001', 'Mumbai', 'MH'],
    ['560001', 'Bengaluru', 'KA'],
    ['700001', 'Kolkata', 'WB'],
    ['682001', 'Ernakulam', 'KL'],
    ['500001', 'Hyderabad', 'TS'],
    ['194101', 'Leh', 'LA'],
    ['160017', 'Chandigarh', 'CH'],
    ['410206', 'Raigad', 'MH'],
    ['605001', 'Pondicherry', 'PY'],
    ['396210', 'Daman', 'DN'],
  ])('%s is %s, %s', (pin, district, stateCode) => {
    expect(dir.lookup(pin)).toEqual({ district, stateCode })
  })

  it('knows nothing of PIN codes India Post never issued', () => {
    expect(dir.lookup('999999')).toBeNull()
    expect(dir.lookup('100000')).toBeNull()
  })
})
