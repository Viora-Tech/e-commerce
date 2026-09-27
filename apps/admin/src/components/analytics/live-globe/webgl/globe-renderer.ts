/**
 * A small WebGL 1 globe renderer, no three.js. Two programs:
 *
 * 1. Sphere: one full-screen triangle whose fragment shader shades the disc (lit from the
 *    front, rim glow) and the soft halo around it, after cobe's look (MIT, shuding/cobe).
 * 2. Points: round point sprites for the land dots (a static buffer per level of detail from
 *    `land-dots.ts`), then the markers and arcs (a small buffer rebuilt each frame). Land dots
 *    take the sphere's shading so they fade into it towards the rim; markers and arcs are flat.
 *
 * Projection is orthographic: a unit-sphere point is turned by the globe's spin (`phi`, about
 * the north axis) and tilt (`theta`), then scaled by the radius. Anything behind the globe's
 * disc is dropped in the vertex shader.
 */

export type Rgb = [number, number, number]
export type Vec3 = [number, number, number]
/** A 3x3 matrix, row-major. */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

export type GlobeFrame = {
  /** Centre and radius of the globe, in canvas (device) pixels from the top-left. */
  cx: number
  cy: number
  radius: number
  /** Row-major rotation from `rotation(phi, theta)`. */
  rotation: Mat3
  /** Diameter of one land dot, in device pixels. */
  dotSize: number
  /** What marker and arc sizes (shares of the radius) are multiplied by, in device pixels.
   * The radius itself at zoom 1; held there when zoomed in so markers do not balloon. */
  pointScale: number
  dark: boolean
  base: Rgb
  glow: Rgb
}

export type GlobeRenderer = {
  setLand: (dots: Float32Array) => void
  /** Arcs or markers (drawn in that order): `x, y, z, size (share of the radius), r, g, b`
   * per point. Arcs change only with new orders; markers every frame, for the pulse. */
  setPoints: (layer: 0 | 1, points: Float32Array) => void
  draw: (frame: GlobeFrame) => void
  destroy: () => void
}

const SPHERE_VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}'

// V = centre xy (GL pixels, y up), radius, dark. K = cobe's (1 + opacity) / 2 at opacity .94.
const SPHERE_FS = `precision highp float;uniform vec4 V;uniform vec3 C,G;
void main(){vec2 b=(gl_FragCoord.xy-V.xy)/V.z;float a=dot(b,b);
if(a<=1.){float i=sqrt(1.-a);gl_FragColor=vec4(C*(pow(i,.4)*(1.-V.w)+.1)+pow(1.-i,4.)*G,1)*.97;}
else{float r=sqrt(.3125/(a-1.));float f=smoothstep(.5,1.,r/(r+1.));gl_FragColor=vec4(f*G,f);}}`

// p.w: land buffers give 3 components, so w = 1 and Z is the dot size; marker/arc points
// carry their size as a share of the radius and Z is the radius. c.a = 0 marks a land dot.
const POINT_VS = `attribute vec4 p,c;uniform mat3 M;uniform vec2 S,R;uniform float Z;
varying vec4 v;varying float f;
void main(){vec3 q=p.xyz*M;v=c;f=q.z;
if(q.z<0.&&dot(q.xy,q.xy)<1.){gl_Position=vec4(2,2,2,1);gl_PointSize=0.;return;}
gl_Position=vec4(S+q.xy*R,0,1);gl_PointSize=p.w*Z;}`

// L = map brightness, diffuse, dark. cobe's dot shading: strength q falls off towards the rim
// (so dots melt into the sphere) and the dot's edge fades out, saturating early like cobe's.
const POINT_FS = `precision highp float;uniform vec3 C,G,L;varying vec4 v;varying float f;
void main(){float d=length(gl_PointCoord*2.-1.);if(d>1.)discard;
if(v.a>.5){gl_FragColor=vec4(v.rgb,1);return;}
float i=max(f,0.),q=pow(i,L.y)*L.x,a=min(1.,(1.-smoothstep(0.,1.,d))*max(q,1.));
gl_FragColor=vec4((C*(mix(max(1.-q,0.)*pow(i,.4),q,L.z)+.1)+pow(1.-i,4.)*G)*.97,a*.97);}`

/** Rotation for spin `phi` then tilt `theta`, row-major. */
export function rotation(phi: number, theta: number): Mat3 {
  const [cp, sp, ct, st] = [Math.cos(phi), Math.sin(phi), Math.cos(theta), Math.sin(theta)]
  return [cp, 0, sp, sp * st, ct, -cp * st, -sp * ct, st, cp * ct]
}

/** Applies a `rotation()` to a point: `[x, y, z]` with x right, y up, z towards the viewer. */
export function rotate(m: Mat3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ]
}

/** The unit vector for `lat`/`lng`, in the same axes as the land dots. */
export function toVector(lat: number, lng: number): Vec3 {
  const [la, ln] = [(lat * Math.PI) / 180, (lng * Math.PI) / 180]
  return [Math.cos(la) * Math.sin(ln), Math.sin(la), Math.cos(la) * Math.cos(ln)]
}

/** The `phi`/`theta` that turn `lat`/`lng` to face the viewer. */
export function anglesFor(lat: number, lng: number): [phi: number, theta: number] {
  return [(-lng * Math.PI) / 180, (lat * Math.PI) / 180]
}

function program(gl: WebGLRenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type)
    if (!p || !shader) return null
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    gl.attachShader(p, shader)
    gl.deleteShader(shader)
  }
  if (!p) return null
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null
  const u = (name: string) => gl.getUniformLocation(p, name)
  return { p, u, a: (name: string) => gl.getAttribLocation(p, name) }
}

export function createGlobeRenderer(canvas: HTMLCanvasElement): GlobeRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false })
  const sphere = gl && program(gl, SPHERE_VS, SPHERE_FS)
  const dots = gl && program(gl, POINT_VS, POINT_FS)
  if (!gl || !sphere || !dots) return null

  const tri = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, tri)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const land = gl.createBuffer()
  const layers = [gl.createBuffer(), gl.createBuffer()] as const
  const counts: [number, number] = [0, 0]
  let landCount = 0
  const aPos = dots.a('p')
  const aColor = dots.a('c')

  const upload = (buffer: WebGLBuffer | null, data: Float32Array, usage: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, usage)
  }

  return {
    setLand: (data) => {
      upload(land, data, gl.STATIC_DRAW)
      landCount = data.length / 3
    },
    setPoints: (layer, data) => {
      upload(layers[layer], data, gl.DYNAMIC_DRAW)
      counts[layer] = data.length / 7
    },
    draw: (f) => {
      const { width: w, height: h } = canvas
      gl.viewport(0, 0, w, h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      gl.useProgram(sphere.p)
      gl.bindBuffer(gl.ARRAY_BUFFER, tri)
      gl.enableVertexAttribArray(sphere.a('a'))
      gl.vertexAttribPointer(sphere.a('a'), 2, gl.FLOAT, false, 0, 0)
      gl.uniform4f(sphere.u('V'), f.cx, h - f.cy, f.radius, f.dark ? 1 : 0)
      gl.uniform3fv(sphere.u('C'), f.base)
      gl.uniform3fv(sphere.u('G'), f.glow)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.useProgram(dots.p)
      // Row-major upload read as column-major is the transpose, so `p * M` in GLSL is `M p`.
      gl.uniformMatrix3fv(dots.u('M'), false, f.rotation)
      gl.uniform2f(dots.u('S'), (2 * f.cx) / w - 1, 1 - (2 * f.cy) / h)
      gl.uniform2f(dots.u('R'), (2 * f.radius) / w, (2 * f.radius) / h)
      gl.uniform3fv(dots.u('C'), f.base)
      gl.uniform3fv(dots.u('G'), f.glow)
      gl.uniform3f(dots.u('L'), f.dark ? 4.5 : 5.5, 1.15, f.dark ? 1 : 0)
      if (landCount > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, land)
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)
        gl.disableVertexAttribArray(aColor)
        gl.vertexAttrib4f(aColor, 0, 0, 0, 0)
        gl.uniform1f(dots.u('Z'), f.dotSize)
        gl.drawArrays(gl.POINTS, 0, landCount)
      }
      gl.uniform1f(dots.u('Z'), f.pointScale)
      for (const layer of [0, 1] as const) {
        if (counts[layer] === 0) continue
        gl.bindBuffer(gl.ARRAY_BUFFER, layers[layer])
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, 28, 0)
        gl.enableVertexAttribArray(aColor)
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 28, 16)
        gl.drawArrays(gl.POINTS, 0, counts[layer])
      }
    },
    destroy: () => {
      for (const b of [tri, land, ...layers]) gl.deleteBuffer(b)
      gl.deleteProgram(sphere.p)
      gl.deleteProgram(dots.p)
    },
  }
}
