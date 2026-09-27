/**
 * A small WebGL 1 globe renderer, no three.js. Two programs:
 *
 * 1. Sphere: one full-screen triangle whose fragment shader shades the disc (lit from the
 *    front, rim glow) and the soft halo around it, after cobe's look (MIT, shuding/cobe). Each
 *    pixel is turned back into latitude/longitude and the land map is read as a mipmapped
 *    texture, so continents are smooth filled shapes, outlined at the coast, with thin country
 *    borders (India's official boundary, see scripts/globe/make-globe-map.py) and faint 15°
 *    grid lines. Coast and borders are turned back into a distance on screen, so they stay
 *    about one pixel wide at any zoom. No repeating dot pattern, so nothing beats against the screen's pixel grid (moiré).
 * 2. Points: the markers and arcs (a small buffer rebuilt each frame), flat round sprites.
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
  /** What marker and arc sizes (shares of the radius) are multiplied by, in device pixels.
   * The radius itself at zoom 1; held there when zoomed in so markers do not balloon. */
  pointScale: number
  dark: boolean
  base: Rgb
  glow: Rgb
}

export type GlobeRenderer = {
  /** The land map (white land on black sea, equirectangular, north up, -180 at the left). */
  setLandMap: (image: TexImageSource) => void
  /** Arcs or markers (drawn in that order): `x, y, z, size (share of the radius), r, g, b`
   * per point. Arcs change only with new orders; markers every frame, for the pulse. */
  setPoints: (layer: 0 | 1, points: Float32Array) => void
  draw: (frame: GlobeFrame) => void
  destroy: () => void
}

const SPHERE_VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}'

// V = centre xy (GL pixels, y up), radius, dark. M turns a view vector back to the globe's own
// axes (y north, z at longitude 0, x at 90 E). T = land map, H = 1 once it has loaded.
// The longitude seam: atan jumps from +pi to -pi at 180°, which would make the mipmap pick its
// blurriest level along that meridian. Two u's with seams half a turn apart are computed and
// the one that is smooth at this pixel is used (Tarini's trick).
const SPHERE_FS = `#extension GL_OES_standard_derivatives : enable
precision highp float;uniform vec4 V;uniform vec3 C,G;uniform mat3 M;uniform sampler2D T;uniform float H;
float grid(float x){float w=fwidth(x);return 1.-min(abs(fract(x-.5)-.5)/max(w,1e-4),1.);}
void main(){vec2 b=(gl_FragCoord.xy-V.xy)/V.z;float a=dot(b,b);
if(a>1.){float r=sqrt(.3125/(a-1.));float f=smoothstep(.5,1.,r/(r+1.));gl_FragColor=vec4(f*G,f);return;}
float i=sqrt(1.-a);vec3 w=M*vec3(b,i);
float lat=asin(clamp(w.y,-1.,1.));float t=atan(w.x,w.z)/6.2831853;
float u1=t+.5,u2=fract(t)+.5;float u=fwidth(u1)<=fwidth(u2)+1e-6?u1:u2;
vec2 st=vec2(u,.5-lat/3.1415927);vec4 m=texture2D(T,st);
float land=H*smoothstep(.3,.7,m.r);
float coast=H*(1.-smoothstep(.6,1.4,abs(m.r-.5)/max(fwidth(m.r),1e-4)));
float px=max(fwidth(st.x*2048.),1e-4);float bd=1.4*sqrt(-2.*log(max(m.g,1e-3)))/px;
float border=H*step(.03,m.g)*(1.-smoothstep(.55,1.3,bd));
vec3 ocean=C*(pow(i,.4)*(1.-V.w)+.1)+pow(1.-i,4.)*G;
vec3 ground=mix(C*.42,C*1.9+.08,V.w)*(pow(i,.5)*.85+.15)+pow(1.-i,4.)*G;
vec3 col=mix(ocean,ground,land*smoothstep(0.,.18,i));
vec3 line=mix(C*1.25+.12,C*2.3+.2,V.w);float rim=smoothstep(0.,.3,i);
col=mix(col,line,coast*rim*.8);col=mix(col,line,border*rim*.75);
float g1=grid(degrees(lat)/15.);float lx=u*24.;float g2=grid(lx)*smoothstep(.97,.88,abs(w.y));
float g=max(g1,g2)*smoothstep(0.,.25,i)*(.1+.08*V.w);
col=mix(col,G*.9+C*.3,g);
gl_FragColor=vec4(col,1)*.97;}`

// Marker/arc points carry their size as a share of the radius (p.w) and Z is the radius.
const POINT_VS = `attribute vec4 p,c;uniform mat3 M;uniform vec2 S,R;uniform float Z;
varying vec4 v;varying float f;
void main(){vec3 q=p.xyz*M;v=c;f=q.z;
if(q.z<0.&&dot(q.xy,q.xy)<1.){gl_Position=vec4(2,2,2,1);gl_PointSize=0.;return;}
gl_Position=vec4(S+q.xy*R,0,1);gl_PointSize=p.w*Z;}`

// Flat round sprites with a one-pixel-ish soft edge.
const POINT_FS = `precision highp float;varying vec4 v;varying float f;
void main(){float d=length(gl_PointCoord*2.-1.);if(d>1.)discard;
gl_FragColor=vec4(v.rgb,1.-smoothstep(.8,1.,d));}`

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
  // fwidth() for the soft coast, grid lines and the seam fix; supported on all current GPUs.
  if (gl && !gl.getExtension('OES_standard_derivatives')) return null
  const sphere = gl && program(gl, SPHERE_VS, SPHERE_FS)
  const dots = gl && program(gl, POINT_VS, POINT_FS)
  if (!gl || !sphere || !dots) return null

  const tri = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, tri)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const layers = [gl.createBuffer(), gl.createBuffer()] as const
  const counts: [number, number] = [0, 0]
  const landMap = gl.createTexture()
  let hasLand = false
  const aPos = dots.a('p')
  const aColor = dots.a('c')

  const upload = (buffer: WebGLBuffer | null, data: Float32Array, usage: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, usage)
  }

  return {
    setLandMap: (image) => {
      gl.bindTexture(gl.TEXTURE_2D, landMap)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
      // 2048x1024 is a power of two, so WebGL 1 can mipmap it: smooth coasts at every size.
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      hasLand = true
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
      // Row-major upload read as column-major is the transpose: the inverse rotation.
      gl.uniformMatrix3fv(sphere.u('M'), false, f.rotation)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, landMap)
      gl.uniform1i(sphere.u('T'), 0)
      gl.uniform1f(sphere.u('H'), hasLand ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.useProgram(dots.p)
      // Row-major upload read as column-major is the transpose, so `p * M` in GLSL is `M p`.
      gl.uniformMatrix3fv(dots.u('M'), false, f.rotation)
      gl.uniform2f(dots.u('S'), (2 * f.cx) / w - 1, 1 - (2 * f.cy) / h)
      gl.uniform2f(dots.u('R'), (2 * f.radius) / w, (2 * f.radius) / h)
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
      for (const b of [tri, ...layers]) gl.deleteBuffer(b)
      gl.deleteTexture(landMap)
      gl.deleteProgram(sphere.p)
      gl.deleteProgram(dots.p)
    },
  }
}
