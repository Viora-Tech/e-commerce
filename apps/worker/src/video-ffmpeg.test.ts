import { describe, expect, it } from 'vitest'
import { ffmpegArgs, ffprobeArgs, parseProbe, runProgram } from './video-ffmpeg'

describe('ffmpegArgs', () => {
  it('keeps the settings #1783 tested: 1080p wide, CRF 26 capped at 3.5 Mbps, faststart, 2 threads', () => {
    const args = ffmpegArgs('/tmp/in', '/tmp/out.mp4')
    const after = (flag: string) => args[args.indexOf(flag) + 1]
    expect(after('-vf')).toBe("scale='min(1920,iw)':-2")
    expect(after('-crf')).toBe('26')
    expect(after('-maxrate')).toBe('3500k')
    expect(after('-b:a')).toBe('96k')
    expect(after('-movflags')).toBe('+faststart')
    expect(after('-threads')).toBe('2')
    expect(args.at(-1)).toBe('/tmp/out.mp4')
  })

  it('probes only the first video stream and the duration', () => {
    expect(ffprobeArgs('/tmp/in')).toContain('stream=width:format=duration')
  })
})

describe('parseProbe', () => {
  it('reads width and duration', () => {
    const json = JSON.stringify({ streams: [{ width: 1920 }], format: { duration: '20.04' } })
    expect(parseProbe(json)).toEqual({ width: 1920, durationSec: 20.04 })
  })

  it('gives nulls for a broken answer instead of throwing', () => {
    expect(parseProbe('not json')).toEqual({ width: null, durationSec: null })
    expect(parseProbe('{"format":{"duration":"N/A"}}')).toEqual({ width: null, durationSec: null })
  })
})

describe('runProgram', () => {
  const node = process.execPath

  it('keeps only a capped slice of a chatty program output', async () => {
    const run = await runProgram(node, ['-e', "process.stderr.write('x'.repeat(500000))"], {
      timeoutMs: 20_000,
    })
    expect(run.code).toBe(0)
    expect(run.stderr.length).toBe(64 * 1024)
  })

  it('stops a program that runs past its timeout', async () => {
    const run = await runProgram(node, ['-e', 'setTimeout(() => {}, 60000)'], { timeoutMs: 300 })
    expect(run.timedOut).toBe(true)
  })
})
