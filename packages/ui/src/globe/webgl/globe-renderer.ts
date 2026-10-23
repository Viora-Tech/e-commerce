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

/** Which layers the sphere shader draws; independent of `style` (solid vs dotted land). */
export type GlobeLayerFlags = {
  borders: boolean
  coastlines: boolean
  grid: boolean
  /** Halo outside the disc plus the rim light along its edge. */
  glow: boolean
}

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
  /** Land colour. */
  base: Rgb
  /** Ocean colour. Equal to `base` for the original look (the shader shades one colour into
   * both), a separate colour for the other theme presets. */
  ocean: Rgb
  glow: Rgb
  layers: GlobeLayerFlags
  /** "Dotted" draws land as dots straight from the land map's texel, in even rows of latitude
   * (see `webgl/dot-layout.ts`); "solid" is the original filled-continent look. */
  style: 'solid' | 'dotted'
  /** Row count and per-dot radius (device px) for the dotted look; ignored otherwise. */
  dotRows: number
  dotRadiusPx: number
  /** cobe's own dotted look instead of the rows above (with `style: 'dotted'`): `samples` dots
   * spread evenly over the sphere on a Fibonacci lattice, each a soft round dot lit by the land
   * map at its centre, `brightness` (cobe's `mapBrightness`) times `pow(facing, diffuse)`. In
   * dark mode a dot is `color` times that (so a deep `color` reads as a bright, saturated dot,
   * as on the Home card); in light mode it shades from the sea towards `color` (an ink). */
  cobeDots?: { samples: number; brightness: number; diffuse: number; color: Rgb }
  /** Subsolar point as a unit vector in the globe's own axes (`toVector`), or `null` to turn
   * the day/night shadow off. */
  sun: Vec3 | null
  /** The border-stroke layer's dash period, device px (see `webgl/border-dash.ts`); the dash
   * on/off pattern itself is computed in the shader from this and `radius`, every frame, so it
   * keeps the same on-screen length at any zoom without ever rebuilding the point buffer. */
  dashPeriodPx: number
}

export type GlobeRenderer = {
  /** The land map (white land on black sea, equirectangular, north up, -180 at the left). */
  setLandMap: (image: TexImageSource) => void
  /** Arcs, markers or border-stroke points (drawn in that order, layer 2 last): `x, y, z, size
   * (share of the radius), r, g, b, arc` per point (`arc` is the border layer's distance along
   * its run, radians; markers and arcs pass 0). Arcs and border points change only when their
   * source data does (new orders; the border file, once loaded); markers every frame, for the
   * pulse. */
  setPoints: (layer: 0 | 1 | 2, points: Float32Array) => void
  draw: (frame: GlobeFrame) => void
  destroy: () => void
}

const SPHERE_VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}'

// cobe's nearest-dot lookup (MIT, shuding/cobe 2.0.1, `B` in its sphere shader), ported as is
// apart from names: of `k` points on a Fibonacci sphere (pole along y), the one nearest the
// unit vector `c`; `dist` is the straight-line distance to it. The chain of `if`s adds up
// `fract(n * golden ratio)` bit by bit, which keeps float precision up to 32767 points.
const FIBONACCI_DOT = `vec3 fibDot(vec3 c,float k,out float dist){c=c.xzy;float iv=1./k;
float lv=max(2.,floor(log2(2.236068*k*3.141593*(1.-c.z*c.z))*.72021));
vec2 fg=floor(pow(1.618034,lv)/2.236068*vec2(1,1.618034)+.5),fd=fract((fg+1.)*.618034)*6.283185-3.883222,
fe=-2.*fg,ff=vec2(atan(c.y,c.x),c.z-1.),
fr=floor(vec2(fe.y*ff.x-fd.y*(ff.y*k+1.),-fe.x*ff.x+fd.x*(ff.y*k+1.))/(fd.x*fe.y-fe.x*fd.y));
float best=3.141593;vec3 near=vec3(0,0,1);
for(float h=0.;h<4.;h+=1.){float j=dot(fg,fr+vec2(mod(h,2.),floor(h*.5)));if(j>k)continue;
float a=j,b=0.;
if(a>=16384.){a-=16384.;b+=.868872;}if(a>=8192.){a-=8192.;b+=.934436;}
if(a>=4096.){a-=4096.;b+=.467218;}if(a>=2048.){a-=2048.;b+=.733609;}
if(a>=1024.){a-=1024.;b+=.866804;}if(a>=512.){a-=512.;b+=.433402;}
if(a>=256.){a-=256.;b+=.216701;}if(a>=128.){a-=128.;b+=.108351;}
if(a>=64.){a-=64.;b+=.554175;}if(a>=32.){a-=32.;b+=.777088;}
if(a>=16.){a-=16.;b+=.888544;}if(a>=8.){a-=8.;b+=.944272;}
if(a>=4.){a-=4.;b+=.472136;}if(a>=2.){a-=2.;b+=.236068;}
if(a>=1.){a-=1.;b+=.618034;}
float lng=fract(b)*6.283185,z=1.-2.*j*iv,rr=sqrt(max(0.,1.-z*z));
vec3 p=vec3(cos(lng)*rr,sin(lng)*rr,z);float e=length(c-p);if(e<best){best=e;near=p;}}
dist=best;return near.xzy;}`

// V = centre xy (GL pixels, y up), radius, dark. M turns a view vector back to the globe's own
// axes (y north, z at longitude 0, x at 90 E). T = land map, H = 1 once it has loaded.
// L = layer toggles (borders, coastlines, grid, glow), each 0 or 1. D = style (0 solid / 1
// dotted rows / 2 cobe's dots), row count. R = dot radius, device px. K = cobe's dots: sample
// count, brightness, diffuse; DC their colour. SUN = subsolar point, or the zero vector to
// turn the day/night shadow off.
// The longitude seam: atan jumps from +pi to -pi at 180°, which would make the mipmap pick its
// blurriest level along that meridian. Two u's with seams half a turn apart are computed and
// the one that is smooth at this pixel is used (Tarini's trick).
const SPHERE_FS = `#extension GL_OES_standard_derivatives : enable
precision highp float;uniform vec4 V;uniform vec3 C,O,G,SUN,DC;uniform mat3 M;uniform sampler2D T;
uniform float H;uniform vec4 L,K;uniform vec2 D;uniform float R;
float grid(float x){float w=fwidth(x);return 1.-min(abs(fract(x-.5)-.5)/max(w,1e-4),1.);}
${FIBONACCI_DOT}
void main(){vec2 b=(gl_FragCoord.xy-V.xy)/V.z;float a=dot(b,b);
if(a>1.){float f=0.;if(L.w>.5){float r=sqrt(.3125/(a-1.));f=smoothstep(.5,1.,r/(r+1.));}
gl_FragColor=vec4(f*G,f);return;}
float i=sqrt(1.-a);vec3 w=M*vec3(b,i);
float lat=asin(clamp(w.y,-1.,1.));float t=atan(w.x,w.z)/6.2831853;
float u1=t+.5,u2=fract(t)+.5;float u=fwidth(u1)<=fwidth(u2)+1e-6?u1:u2;
vec2 st=vec2(u,.5-lat/3.1415927);vec4 m=texture2D(T,st);
vec3 glow=L.w*pow(1.-i,4.)*G;vec3 sea=O*(pow(i,.4)*(1.-V.w)+.1);vec3 col;
if(D.x>1.5){
float g;vec3 d=fibDot(w,K.x,g);
vec2 ds=vec2(atan(d.x,d.z)/6.2831853+.5,.5-asin(clamp(d.y,-1.,1.))/3.1415927);
float q=H*texture2D(T,ds,-8.).r*smoothstep(8e-3,0.,g)*pow(i,K.z)*K.y;
col=(V.w>.5?sea+DC*q:mix(sea,DC,min(q,1.)))+glow;
}else{
float land;
if(D.x>.5){
float rows=max(D.y,1.);float rowIdx=floor(st.y*rows);float rowV=(rowIdx+.5)/rows;
float rowLat=(.5-rowV)*3.1415927;float ring=max(cos(rowLat),1e-3);
float count=max(1.,floor(ring*rows*2.+.5));float offset=mod(rowIdx,2.)*.5/count;
float slot=floor((u-offset)*count+.5);float nearestU=slot/count+offset;
vec4 dm=texture2D(T,vec2(nearestU,rowV));float dotLand=H*smoothstep(.3,.7,dm.r);
float du=u-nearestU;du-=floor(du+.5);float dv=st.y-rowV;
float pxU=max(fwidth(u),1e-5);float pxV=max(fwidth(st.y),1e-5);
float distPx=length(vec2(du/pxU,dv/pxV));
land=dotLand*(1.-smoothstep(R-1.,R+1.,distPx));
}else{land=H*smoothstep(.3,.7,m.r);}
vec3 ground=mix(C*.42,C*1.9+.08,V.w)*(pow(i,.5)*.85+.15)+glow;
col=mix(sea+glow,ground,land*smoothstep(0.,.18,i));
}
float coast=L.y*H*(1.-smoothstep(.4,1.8,abs(m.r-.5)/max(fwidth(m.r),1e-4)));
float px=max(fwidth(st.x*2048.),1e-4);float bd=1.4*sqrt(-2.*log(max(m.g,1e-3)))/px;
float border=L.x*H*step(.03,m.g)*(1.-smoothstep(.05,1.2,bd));
vec3 line=mix(C*1.1+.07,C*1.9+.14,V.w);float rim=smoothstep(0.,.3,i);
col=mix(col,line,coast*rim*.65);col=mix(col,line,border*rim*.35);
float g1=grid(degrees(lat)/15.);float lx=u*24.;float g2=grid(lx)*smoothstep(.97,.88,abs(w.y));
float g=L.z*max(g1,g2)*smoothstep(0.,.25,i)*(.1+.08*V.w);
col=mix(col,G*.9+C*.3,g);
if(dot(SUN,SUN)>.01){float sun=dot(w,SUN);float night=smoothstep(-.12,.12,-sun);col*=mix(1.,.42,night);}
gl_FragColor=vec4(col,1)*.97;}`

// Marker/arc/border points carry their size as a share of the radius (p.w) and Z is the
// radius. `g` is a border point's distance (radians) along its own run; markers and arcs pass
// 0, unused.
const POINT_VS = `attribute vec4 p,c;attribute float g;uniform mat3 M;uniform vec2 S,R;uniform float Z;
varying vec4 v;varying float f,arc;
void main(){vec3 q=p.xyz*M;v=c;f=q.z;arc=g;
if(q.z<0.&&dot(q.xy,q.xy)<1.){gl_Position=vec4(2,2,2,1);gl_PointSize=0.;return;}
gl_Position=vec4(S+q.xy*R,0,1);gl_PointSize=p.w*Z;}`

// Flat round sprites with a one-pixel-ish soft edge, fading out as they approach the globe's
// own rim (f, the view-space depth from POINT_VS) rather than popping out of view at it — most
// noticeable for the border dashes, which run along the whole visible edge of a country.
// DASH (0/1) is set once per draw call, true only for the border-stroke layer: when on, most
// points are discarded so the ones left read as a dashed line rather than a solid one. DP.x is
// the globe's current on-screen radius, DP.y the dash period, both device px, so the dash
// keeps the same on-screen length at any zoom (see `webgl/border-dash.ts`, which mirrors this
// same maths for its unit tests; the shader fades each dash out between 0.48 and 0.62 of the period so its ends don't pop, averaging the 0.55 duty cycle kept there).
const POINT_FS = `precision highp float;varying vec4 v;varying float f,arc;
uniform float DASH;uniform vec2 DP;
void main(){float d=length(gl_PointCoord*2.-1.);if(d>1.)discard;
float a=1.-smoothstep(.35,1.,d);
// Dashes: a soft round falloff over a sprite big enough to cover whole pixels, at low
// opacity, so sub-pixel motion while the globe turns does not make them flicker.
if(DASH>.5){float phase=fract(arc*DP.x/DP.y);if(phase>.62)discard;
a=exp(-d*d*2.5)*.8*(1.-smoothstep(.48,.62,phase))*smoothstep(-.04,.1,f);
gl_FragColor=vec4(v.rgb*a,1);return;}
float rim=smoothstep(-.04,.1,f);
gl_FragColor=vec4(v.rgb,a*rim);}`

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
  // Border dashes are many overlapping soft sprites; drawing them with MAX blending keeps each
  // pixel at the brightest sprite instead of adding them up (which read as a glowing, shiny
  // line). Supported everywhere WebGL 1 is; without it dashes fall back to normal blending.
  const minmax = gl?.getExtension('EXT_blend_minmax') ?? null
  const sphere = gl && program(gl, SPHERE_VS, SPHERE_FS)
  const dots = gl && program(gl, POINT_VS, POINT_FS)
  if (!gl || !sphere || !dots) return null

  const tri = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, tri)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const layers = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer()] as const
  const counts: [number, number, number] = [0, 0, 0]
  const landMap = gl.createTexture()
  let hasLand = false
  const aPos = dots.a('p')
  const aColor = dots.a('c')
  const aArc = dots.a('g')

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
      counts[layer] = data.length / 8
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
      gl.uniform3fv(sphere.u('O'), f.ocean)
      gl.uniform3fv(sphere.u('G'), f.glow)
      gl.uniform4f(
        sphere.u('L'),
        f.layers.borders ? 1 : 0,
        f.layers.coastlines ? 1 : 0,
        f.layers.grid ? 1 : 0,
        f.layers.glow ? 1 : 0,
      )
      const cobeDots = f.style === 'dotted' ? f.cobeDots : undefined
      gl.uniform2f(sphere.u('D'), cobeDots ? 2 : f.style === 'dotted' ? 1 : 0, f.dotRows)
      gl.uniform1f(sphere.u('R'), f.dotRadiusPx)
      gl.uniform4f(
        sphere.u('K'),
        cobeDots?.samples ?? 0,
        cobeDots?.brightness ?? 0,
        cobeDots?.diffuse ?? 1,
        0,
      )
      gl.uniform3fv(sphere.u('DC'), cobeDots?.color ?? f.base)
      gl.uniform3fv(sphere.u('SUN'), f.sun ?? [0, 0, 0])
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
      gl.uniform2f(dots.u('DP'), f.radius, f.dashPeriodPx)
      for (const layer of [0, 1, 2] as const) {
        if (counts[layer] === 0) continue
        gl.uniform1f(dots.u('DASH'), layer === 2 ? 1 : 0)
        if (layer === 2 && minmax) gl.blendEquation(minmax.MAX_EXT)
        gl.bindBuffer(gl.ARRAY_BUFFER, layers[layer])
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, 32, 0)
        gl.enableVertexAttribArray(aColor)
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 32, 16)
        gl.enableVertexAttribArray(aArc)
        gl.vertexAttribPointer(aArc, 1, gl.FLOAT, false, 32, 28)
        gl.drawArrays(gl.POINTS, 0, counts[layer])
        if (layer === 2 && minmax) gl.blendEquation(gl.FUNC_ADD)
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
