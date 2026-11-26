/**
 * The ffmpeg side of a video's smaller copy (`./video-compact.ts` runs the job). Landscape
 * settings are the ones #1783 tested on Waimers' hero clips (34 MB → 9 MB, 17 Nov 2026): H.264 at
 * most 1080p wide, CRF 26 capped near 3.5 Mbps, AAC 96 kbps, `+faststart`, two threads. A
 * portrait video (a phone's hero source) gets the phone settings (`PORTRAIT_COPY` in core: 720
 * wide, CRF 28, about 1 Mbps). A silent sound track (a muted hero clip) is left out.
 *
 * Memory: ffmpeg and ffprobe run as their own programs, file to file, so the worker never holds
 * the video. Only a capped slice of their output is kept (`OUTPUT_CAP_BYTES`). ffmpeg (LGPL/GPL,
 * never linked) comes from Alpine in the worker image; `FFMPEG_PATH` / `FFPROBE_PATH` override it.
 */
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { setPriority } from 'node:os'
import { type CopyShape, LANDSCAPE_COPY } from '@commerce/core'

/** An encode taking longer than this is stopped (a broken file, a very long upload). */
export const ENCODE_TIMEOUT_MS = 15 * 60_000

/** ffprobe reads only the headers; anything longer is a broken file. */
const PROBE_TIMEOUT_MS = 60_000

/** stdout/stderr kept from one run: enough for ffprobe's JSON and an error line, never more. */
const OUTPUT_CAP_BYTES = 64 * 1024

/** ffmpeg runs below the storefront and admin on the shared box (0 normal, 19 lowest). */
const ENCODE_NICE = 10

/** How the copy is encoded: its shape (core's `copyShapeFor`) and whether it keeps sound. */
export type EncodeOptions = { shape?: CopyShape; audio?: boolean }

/** ffmpeg's arguments for the copy: `input` and `output` are file paths. */
export function ffmpegArgs(input: string, output: string, opts: EncodeOptions = {}): string[] {
  const shape = opts.shape ?? LANDSCAPE_COPY
  const audio = opts.audio ?? true
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-map',
    '0:v:0',
    ...(audio ? ['-map', '0:a:0?'] : []),
    '-vf',
    `scale='min(${shape.maxWidth},iw)':-2`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(shape.crf),
    '-maxrate',
    `${shape.maxrateKbps}k`,
    '-bufsize',
    `${shape.maxrateKbps * 2}k`,
    '-rc-lookahead',
    '20',
    '-pix_fmt',
    'yuv420p',
    ...(audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
    '-movflags',
    '+faststart',
    '-threads',
    '2',
    output,
  ]
}

/** The poster is taken this far in (seconds): many hero clips open on black or fade in. */
export const POSTER_AT_SEC = 1

/** Frames the poster is picked from (ffmpeg's `thumbnail` filter: the most typical one). */
export const POSTER_PICK_FRAMES = 12

/**
 * ffmpeg's arguments for the poster frame as a lossless PNG (the poster, `./video-poster.ts`, is
 * sized and encoded from it by sharp). Frame 0 was black for Waimers' hero (it fades in), so the
 * frame comes from `POSTER_AT_SEC` in: the most typical of the next `POSTER_PICK_FRAMES` frames
 * (`thumbnail`, which passes over a black or flash frame), scaled to at most 1280 wide first so
 * the frames it compares stay small in memory. `fromStart` grabs frame 0 as before, for a clip
 * shorter than that. Reads only the start of the file.
 */
export function posterFrameArgs(input: string, output: string, fromStart = false): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...(fromStart ? [] : ['-ss', String(POSTER_AT_SEC)]),
    '-i',
    input,
    '-map',
    '0:v:0',
    ...(fromStart ? [] : ['-vf', `scale='min(1280,iw)':-2,thumbnail=${POSTER_PICK_FRAMES}`]),
    '-frames:v',
    '1',
    '-an',
    '-threads',
    '1',
    output,
  ]
}

/** ffmpeg's arguments to measure the first sound track's loudness (`volumedetect`, no output). */
export function volumeArgs(input: string): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    input,
    '-map',
    '0:a:0',
    '-vn',
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]
}

/** A sound track whose loudest moment is at or under this (dBFS) is silence. */
export const SILENT_DB = -60

/** The loudest moment (dBFS) from `volumedetect`'s report, or null when it gave none. */
export function parseMaxVolume(stderr: string): number | null {
  const m = /max_volume:\s*(-inf|-?\d+(?:\.\d+)?)\s*dB/.exec(stderr)
  if (!m?.[1]) return null
  return m[1] === '-inf' ? Number.NEGATIVE_INFINITY : Number(m[1])
}

/** ffprobe's arguments: the first video stream's size and the file's duration, as JSON. */
export function ffprobeArgs(input: string): string[] {
  return [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    input,
  ]
}

/** What ffprobe tells about a video. */
export type VideoFacts = { width: number | null; height: number | null; durationSec: number | null }

const NO_FACTS: VideoFacts = { width: null, height: null, durationSec: null }

/** Size and duration from ffprobe's JSON; missing or odd values come back null. */
export function parseProbe(json: string): VideoFacts {
  try {
    const out = JSON.parse(json) as {
      streams?: { width?: unknown; height?: unknown }[]
      format?: { duration?: unknown }
    }
    const width = Number(out.streams?.[0]?.width)
    const height = Number(out.streams?.[0]?.height)
    const duration = Number(out.format?.duration)
    return {
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null,
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
    }
  } catch {
    return NO_FACTS
  }
}

export type RunResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean }

/** Appends `chunk` to `kept` up to the cap; the rest is dropped. */
function capped(kept: string, chunk: Buffer): string {
  return kept.length >= OUTPUT_CAP_BYTES
    ? kept
    : (kept + chunk.toString()).slice(0, OUTPUT_CAP_BYTES)
}

/** Runs a program to the end (or the timeout), keeping only a capped slice of its output. */
export function runProgram(
  command: string,
  args: string[],
  opts: { timeoutMs: number; nice?: number | undefined },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    if (opts.nice !== undefined && child.pid) {
      try {
        setPriority(child.pid, opts.nice)
      } catch {
        // Not allowed here (some containers): it simply runs at normal priority.
      }
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout?.on('data', (c: Buffer) => {
      stdout = capped(stdout, c)
    })
    child.stderr?.on('data', (c: Buffer) => {
      stderr = capped(stderr, c)
    })
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

const ffmpegBin = () => process.env.FFMPEG_PATH || 'ffmpeg'
const ffprobeBin = () => process.env.FFPROBE_PATH || 'ffprobe'

/** Size and duration of the video at `input`; nulls when ffprobe cannot tell (the encode decides). */
export async function probeVideo(input: string): Promise<VideoFacts> {
  try {
    const run = await runProgram(ffprobeBin(), ffprobeArgs(input), { timeoutMs: PROBE_TIMEOUT_MS })
    return run.code === 0 ? parseProbe(run.stdout) : NO_FACTS
  } catch {
    return NO_FACTS
  }
}

/**
 * Whether the video's sound track is silence (a muted hero clip exported with an empty track):
 * its copy then leaves the track out. No sound track, or ffmpeg could not tell: false, and the
 * copy maps the track if there is one, as before.
 */
export async function silentAudio(input: string): Promise<boolean> {
  try {
    const run = await runProgram(ffmpegBin(), volumeArgs(input), {
      timeoutMs: ENCODE_TIMEOUT_MS,
      nice: ENCODE_NICE,
    })
    if (run.code !== 0) return false
    const max = parseMaxVolume(run.stderr)
    return max !== null && max <= SILENT_DB
  } catch {
    return false
  }
}

/** A frame grab reads a few megabytes at most; longer is a broken file. */
const FRAME_TIMEOUT_MS = 2 * 60_000

/** The poster frame of `input` as a PNG at `output`, or throws with ffmpeg's error text. */
export async function firstFrameFile(input: string, output: string): Promise<void> {
  const grab = (fromStart: boolean) =>
    runProgram(ffmpegBin(), posterFrameArgs(input, output, fromStart), {
      timeoutMs: FRAME_TIMEOUT_MS,
      nice: ENCODE_NICE,
    })
  let run = await grab(false)
  // A clip shorter than `POSTER_AT_SEC` has no frame there (ffmpeg writes nothing): frame 0.
  if (run.code !== 0 || !(await written(output))) run = await grab(true)
  if (run.timedOut) throw new Error('ffmpeg frame grab timed out')
  if (run.code !== 0)
    throw new Error(`ffmpeg exited ${run.code}: ${run.stderr.trim().slice(0, 500)}`)
}

/** Whether ffmpeg left a non-empty file at `path`. */
async function written(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

/** Encodes `input` into the smaller copy at `output`, or throws with ffmpeg's error text. */
export async function encodeVideoFile(
  input: string,
  output: string,
  opts: EncodeOptions = {},
): Promise<void> {
  const run = await runProgram(ffmpegBin(), ffmpegArgs(input, output, opts), {
    timeoutMs: ENCODE_TIMEOUT_MS,
    nice: ENCODE_NICE,
  })
  if (run.timedOut) throw new Error(`ffmpeg stopped after ${ENCODE_TIMEOUT_MS / 60_000} minutes`)
  if (run.code !== 0)
    throw new Error(`ffmpeg exited ${run.code}: ${run.stderr.trim().slice(0, 500)}`)
}
