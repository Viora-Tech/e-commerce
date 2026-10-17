'use client'

import { useEffect, useEffectEvent, useRef } from 'react'
import { isCoarsePointer, prefersReducedMotion } from '@/lib/gsap'

type HeroShaderProps = { onReady: () => void }

const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'

// A slow, flowing monochrome aurora (two layers of domain-warped noise) plus fine film grain.
// Output is premultiplied grey so it sits over the page background without any tint.
const FRAGMENT = `precision mediump float;uniform vec2 R;uniform float T;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=vec2(uv.x*R.x/R.y,uv.y);
float t=T*.045;
vec2 w=vec2(fbm(p*1.6+vec2(t,-t*.6)),fbm(p*1.6+vec2(-t*.7,t)+4.1));
float f=fbm(p*vec2(1.1,2.4)+w*1.8+vec2(0.,-t*.8));
float band=smoothstep(.38,.78,f);
float top=smoothstep(.15,1.,uv.y);
float edge=1.-smoothstep(.0,.65,abs(uv.x-.5));
float i=band*(.35+.65*top)*(.5+.5*edge);
float g=(h(gl_FragCoord.xy+fract(T)*61.)-.5)*.05;
float a=clamp(i*.15+g*.5,0.,1.);
gl_FragColor=vec4(vec3(a),a);}`

const FRAME_MS = 1000 / 30
const SCROLL_PAUSE_MS = 140

/**
 * Hero backdrop: subtle grain and a slow monochrome aurora in a raw WebGL fragment shader.
 * Renders at reduced resolution, caps at 30 fps, pauses off-screen and in hidden tabs, and with
 * reduced motion draws a single still frame.
 */
export default function HeroShader({ onReady }: HeroShaderProps) {
  // Hooks
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reportReady = useEffectEvent(onReady)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!canvas || !gl) return
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vs = compile(gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    const activate = gl.useProgram.bind(gl)
    activate(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const attribute = gl.getAttribLocation(program, 'a')
    gl.enableVertexAttribArray(attribute)
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0)
    const resolution = gl.getUniformLocation(program, 'R')
    const time = gl.getUniformLocation(program, 'T')

    const reduced = prefersReducedMotion()
    // Quarter-ish resolution on phones; the aurora is smooth so nothing is lost.
    const scale = isCoarsePointer() ? 0.3 : 0.45
    let visible = true
    let rafId = 0
    let last = 0
    let reported = false
    let lastScroll = 0
    const onScroll = () => {
      lastScroll = performance.now()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const draw = (seconds: number) => {
      const width = Math.max(2, Math.round(canvas.clientWidth * scale))
      const height = Math.max(2, Math.round(canvas.clientHeight * scale))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      gl.uniform2f(resolution, width, height)
      gl.uniform1f(time, seconds)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reported) {
        reported = true
        reportReady()
      }
    }
    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      // Skip frames while the page is scrolling: the backdrop is slow and soft, nobody reads it then.
      if (!visible || document.visibilityState !== 'visible' || now - last < FRAME_MS) return
      if (now - lastScroll < SCROLL_PAUSE_MS) return
      last = now
      draw(now / 1000)
    }
    if (reduced) draw(7)
    else rafId = requestAnimationFrame(tick)

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
    })
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
      // Not loseContext(): a remounted effect (React strict mode) reuses this canvas's context.
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="size-full" />
}
