import { copyShapeFor } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import {
  ffmpegArgs,
  ffprobeArgs,
  POSTER_AT_SEC,
  parseMaxVolume,
  parseProbe,
  posterFrameArgs,
  runProgram,
  volumeArgs,
} from './video-ffmpeg'

describe('ffmpegArgs', () => {
  it('keeps the settings #1783 tested: 1080p wide, CRF 26 capped at 3.5 Mbps, faststart, 2 threads', () => {
    const args = ffmpegArgs('/tmp/in', '/tmp/out.mp4')
    const arg = (flag: string) => args[args.indexOf(flag) + 1]
    expect(arg('-vf')).toBe("scale='min(1920,iw)':-2")
    expect(arg('-crf')).toBe('26')
    expect(arg('-maxrate')).toBe('3500k')
    expect(arg('-b:a')).toBe('96k')
    expect(arg('-movflags')).toBe('+faststart')
    expect(arg('-threads')).toBe('2')
    expect(args.at(-1)).toBe('/tmp/out.mp4')
  })

  it('encodes a phone copy at 720 wide, about 1 Mbps, and leaves out a silent track', () => {
    const args = ffmpegArgs('/tmp/in', '/tmp/out.mp4', {
      shape: copyShapeFor({ width: 1080, height: 1920 }),
      audio: false,
    })
    const arg = (flag: string) => args[args.indexOf(flag) + 1]
    expect(arg('-vf')).toBe("scale='min(720,iw)':-2")
    expect(arg('-crf')).toBe('28')
    expect(arg('-maxrate')).toBe('1000k')
    expect(arg('-bufsize')).toBe('2000k')
    expect(args).toContain('-an')
    expect(args).not.toContain('0:a:0?')
    expect(args).not.toContain('-c:a')
  })

  it('probes only the first video stream size and the duration', () => {
    expect(ffprobeArgs('/tmp/in')).toContain('stream=width,height:format=duration')
  })
})

describe('posterFrameArgs', () => {
  it('takes the most typical frame from a second in, not frame 0 (black on a fade-in)', () => {
    const args = posterFrameArgs('/tmp/in', '/tmp/frame.png')
    expect(args[args.indexOf('-ss') + 1]).toBe(String(POSTER_AT_SEC))
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args[args.indexOf('-vf') + 1]).toMatch(/thumbnail=\d+$/)
    expect(args[args.indexOf('-frames:v') + 1]).toBe('1')
  })

  it('grabs frame 0 for a clip shorter than that', () => {
    const args = posterFrameArgs('/tmp/in', '/tmp/frame.png', true)
    expect(args).not.toContain('-ss')
    expect(args).not.toContain('-vf')
  })
})

describe('silence', () => {
  it('measures only the first sound track, with no output file', () => {
    const args = volumeArgs('/tmp/in')
    expect(args).toContain('volumedetect')
    expect(args.slice(-3)).toEqual(['-f', 'null', '-'])
  })

  it("reads volumedetect's loudest moment", () => {
    expect(parseMaxVolume('[Parsed_volumedetect_0 @ 0x1] max_volume: -91.0 dB')).toBe(-91)
    expect(parseMaxVolume('[Parsed_volumedetect_0 @ 0x1] max_volume: -inf dB')).toBe(
      Number.NEGATIVE_INFINITY,
    )
    expect(parseMaxVolume('max_volume: 0.0 dB')).toBe(0)
    expect(parseMaxVolume('no audio')).toBeNull()
  })
})

describe('parseProbe', () => {
  it('reads width and duration', () => {
    const json = JSON.stringify({
      streams: [{ width: 1080, height: 1920 }],
      format: { duration: '20.04' },
    })
    expect(parseProbe(json)).toEqual({ width: 1080, height: 1920, durationSec: 20.04 })
  })

  it('gives nulls for a broken answer instead of throwing', () => {
    const none = { width: null, height: null, durationSec: null }
    expect(parseProbe('not json')).toEqual(none)
    expect(parseProbe('{"format":{"duration":"N/A"}}')).toEqual(none)
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
