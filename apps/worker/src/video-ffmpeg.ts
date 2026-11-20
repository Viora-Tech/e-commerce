/**
 * The ffmpeg side of a video's smaller copy (`./video-compact.ts` runs the job). Settings are
 * the ones #1783 tested on Waimers' hero clips (34 MB → 9 MB, 17 Nov 2026): H.264 at most 1080p
 * wide, CRF 26 capped near 3.5 Mbps, AAC 96 kbps, `+faststart`, two threads.
 *
 * Memory: ffmpeg and ffprobe run as their own programs, file to file, so the worker never holds
 * the video. Only a capped slice of their output is kept (`OUTPUT_CAP_BYTES`). ffmpeg (LGPL/GPL,
 * never linked) comes from Alpine in the worker image; `FFMPEG_PATH` / `FFPROBE_PATH` override it.
 */
import { spawn } from 'node:child_process'
import { setPriority } from 'node:os'

/** An encode taking longer than this is stopped (a broken file, a very long upload). */
export const ENCODE_TIMEOUT_MS = 15 * 60_000

/** ffprobe reads only the headers; anything longer is a broken file. */
const PROBE_TIMEOUT_MS = 60_000

/** stdout/stderr kept from one run: enough for ffprobe's JSON and an error line, never more. */
const OUTPUT_CAP_BYTES = 64 * 1024

/** ffmpeg runs below the storefront and admin on the shared box (0 normal, 19 lowest). */
const ENCODE_NICE = 10

/** ffmpeg's arguments for the copy: `input` and `output` are file paths. Unchanged from #1783. */
export function ffmpegArgs(input: string, output: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    "scale='min(1920,iw)':-2",
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '26',
    '-maxrate',
    '3500k',
    '-bufsize',
    '7000k',
    '-rc-lookahead',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    '-threads',
    '2',
    output,
  ]
}

/** ffprobe's arguments: the first video stream's width and the file's duration, as JSON. */
export function ffprobeArgs(input: string): string[] {
  return [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width:format=duration',
    '-of',
    'json',
    input,
  ]
}

/** Width and duration from ffprobe's JSON; missing or odd values come back null. */
export function parseProbe(json: string): { width: number | null; durationSec: number | null } {
  try {
    const out = JSON.parse(json) as {
      streams?: { width?: unknown }[]
      format?: { duration?: unknown }
    }
    const width = Number(out.streams?.[0]?.width)
    const duration = Number(out.format?.duration)
    return {
      width: Number.isFinite(width) && width > 0 ? width : null,
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
    }
  } catch {
    return { width: null, durationSec: null }
  }
}

export type RunResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean }

/** Appends `chunk` to `kept` up to the cap; the rest is dropped. */
function capped(kept: string, chunk: Buffer): string {
  return kept.length >= OUTPUT_CAP_BYTES ? kept : (kept + chunk.toString()).slice(0, OUTPUT_CAP_BYTES)
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

/** Width and duration of the video at `input`; nulls when ffprobe cannot tell (the encode decides). */
export async function probeVideo(
  input: string,
): Promise<{ width: number | null; durationSec: number | null }> {
  try {
    const run = await runProgram(ffprobeBin(), ffprobeArgs(input), { timeoutMs: PROBE_TIMEOUT_MS })
    return run.code === 0 ? parseProbe(run.stdout) : { width: null, durationSec: null }
  } catch {
    return { width: null, durationSec: null }
  }
}

/** Encodes `input` into the smaller copy at `output`, or throws with ffmpeg's error text. */
export async function encodeVideoFile(input: string, output: string): Promise<void> {
  const run = await runProgram(ffmpegBin(), ffmpegArgs(input, output), {
    timeoutMs: ENCODE_TIMEOUT_MS,
    nice: ENCODE_NICE,
  })
  if (run.timedOut) throw new Error(`ffmpeg stopped after ${ENCODE_TIMEOUT_MS / 60_000} minutes`)
  if (run.code !== 0) throw new Error(`ffmpeg exited ${run.code}: ${run.stderr.trim().slice(0, 500)}`)
}
