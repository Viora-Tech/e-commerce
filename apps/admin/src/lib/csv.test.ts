import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('defuses spreadsheet formulas in text cells', () => {
    const csv = toCsv(
      ['a'],
      [['=HYPERLINK("https://evil/","x")'], ['@SUM(A1)'], ['+1'], ['-2'], ['\tx']],
    )
    expect(csv.split('\r\n').slice(1)).toEqual([
      `"'=HYPERLINK(""https://evil/"",""x"")"`,
      "'@SUM(A1)",
      "'+1",
      "'-2",
      "'\tx",
    ])
  })

  it('leaves numbers and ordinary text alone', () => {
    expect(toCsv(['n', 't'], [[-2, 'Pune']])).toBe('n,t\r\n-2,Pune')
  })

  it('quotes carriage returns', () => {
    expect(toCsv(['a'], [['x\ry']])).toBe('a\r\n"x\ry"')
  })
})
