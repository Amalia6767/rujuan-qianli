import * as THREE from './vendor/three.module.js';

// 「流光螺钿玉」材质：从 style-lab/lab.js 移植进游戏。
// 所有质感都是程序化着色；配方（RECIPE）由开卷三问决定：山的质地、水的质地、时辰。

// ---------- 噪声 ----------
function hash2(ix, iz, seed = 0) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function ridged(x, z, seed) {
  let sum = 0, amp = 0.6, f = 1;
  for (let o = 0; o < 3; o++) {
    sum += amp * (1 - Math.abs(2 * vnoise(x * f, z * f, seed + o) - 1));
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / 1.05;
}
function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 共享 uniform ----------
const col = () => ({ value: new THREE.Color() });
export const U = {
  uTime: { value: 0 },
  uGrain: { value: 0.05 },
  uFogNear: { value: 45 },
  uFogFar: { value: 220 },
  uLightDir: { value: new THREE.Vector3(0.4, 0.55, -0.7).normalize() },
  uFogColor: col(),
  uBase: col(), uMid: col(), uTop: col(), uRim: col(), uCoreCol: col(), uInkCol: col(),
  uGlow: col(), uFlow: { value: 0.35 },
  uNacre: { value: 0.2 }, uBack: { value: 0.7 }, uMtInk: { value: 0.2 }, uCoreMix: { value: 0.8 },
  uSheenCol: col(), uSpecCol: col(), uSheen: { value: 0.8 }, uGlitter: { value: 0.25 },
  river0: col(), river1: col(), river2: col(), mistCol: col(),
  uGround: col(), uWet: col(), uPath: col(), uInk: { value: 0.75 },
  bridgeCol: col(), roofCol: col(), houseCol: col(), bedCol: col(),
  uSkyTop: col(), uSkyHorizon: col(), uSun: col(),
  // v0.9 the unfinished summit: colour fades to bare silk and ink contours around this point.
  uBlankAt: { value: new THREE.Vector3(0, -999, 0) }, uBlankR: { value: 1 },
  // v0.9 ink tree sprites: tint by the hour, and the point they thin out in front of.
  uTreeTint: { value: new THREE.Color(1, 1, 1) }, uFocus: { value: new THREE.Vector3() },
};
const COMMON_KEYS = ['uTime', 'uGrain', 'uFogNear', 'uFogFar', 'uLightDir', 'uFogColor'];
const pick = (...keys) => Object.fromEntries(keys.map(k => [k, U[k]]));

const COMMON = /* glsl */ `
uniform float uTime, uGrain, uFogNear, uFogFar;
uniform vec3 uLightDir, uFogColor;
float hash3(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 applyFog(vec3 c, float d) { return mix(c, uFogColor, smoothstep(uFogNear, uFogFar, d)); }
// 青绿 over 赭石: ochre body, malachite washes, azurite caps.
// Raw pigment values (they print light, the airy v0.9 scroll look): 石绿, 石青, 赭石.
const vec3 MALACHITE = vec3(.36, .66, .5), AZURITE = vec3(.2, .42, .78), OCHRE = vec3(.66, .54, .32), OCHRE_DK = vec3(.42, .33, .2);
float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mh(i), mh(i + vec2(1, 0)), f.x), mix(mh(i + vec2(0, 1)), mh(i + vec2(1, 1)), f.x), f.y); }
// 青绿 over 赭石: ochre body, 石绿 washes on the upper slopes, 石青 in patches on the caps.
vec3 qinglu(vec3 n, float h, vec3 w, float hue) {
  float patchN = mn(w.xz * .11 + w.y * .07) * .6 + mn(w.xz * .37 + 3.) * .4;
  float cap = h * .55 + max(n.y, 0.) * .45 + (patchN - .5) * .5 + (hue - .5) * .3;
  vec3 m = mix(OCHRE_DK, OCHRE, smoothstep(.0, .4, h) * (.6 + .4 * patchN));
  m = mix(m, MALACHITE, smoothstep(.42, .62, cap));
  return mix(m, AZURITE, smoothstep(.68, .84, cap) * smoothstep(.4, .65, patchN + h * .25) * .9);
}
float grain(vec3 w, float d) { return (hash3(floor(w * 48.)) - .5) * uGrain * (1. - smoothstep(12., 50., d)); }
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float a = hash3(vec3(i, 1.)), b = hash3(vec3(i + vec2(1., 0.), 1.));
  float c = hash3(vec3(i + vec2(0., 1.), 1.)), d = hash3(vec3(i + 1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

const BASIC_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const MOUNTAIN_VERT = /* glsl */ `
uniform float uOffset;
varying vec3 vW; varying vec3 vN; varying float vH;
void main() {
  vec3 p = position + normal * uOffset;
  vec4 w = modelMatrix * vec4(p, 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vH = position.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const MOUNTAIN_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uBase, uMid, uTop, uRim, uCoreCol, uInkCol, uGlow;
uniform float uOpacity, uRimAlpha, uHeight, uNacre, uBack, uIsCore, uMtInk, uCoreMix, uWhite, uFlow, uHue;
varying vec3 vW; varying vec3 vN; varying float vH;
vec3 nacre(float t) { return .6 + .4 * cos(6.28318 * (t + vec3(.0, .2, .45))); }
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 v = toCam / dist;
  float h = clamp(vH / uHeight, 0., 1.);
  float ndv = clamp(dot(n, v), 0., 1.);
  float fres = pow(1. - ndv, mix(4., 2.5, uIsCore));
  float wrap = clamp(dot(n, uLightDir) * .5 + .5, 0., 1.);
  vec3 c = mix(uBase, uMid, smoothstep(0., .55, h));
  c = mix(c, uTop, smoothstep(.55, 1., h));
  c = mix(c, uCoreCol, uIsCore * uCoreMix * (1. - h * .6) * (.4 + .6 * ndv));
  // Halfway (Xingyi): the lab's deep jade under a lighter 青绿-on-赭石 pigment wash.
  c = mix(c, qinglu(n, h, vW, uHue), mix(.32, .5, uIsCore));
  c = mix(c, uRim, uWhite * .65);
  c *= .45 + .75 * wrap;
  float thin = pow(1. - ndv, 1.5);
  float back = pow(clamp(dot(v, -uLightDir) * .5 + .5, 0., 1.), 3.);
  c = mix(c, uGlow, clamp(thin * uBack * (.35 + .65 * back) * uIsCore, 0., 1.));
  c += uGlow * back * uBack * .25 * (1. - uIsCore) * fres;
  float f = fract(vW.x * .035 + vW.y * .09 - uTime * .045);
  c += uGlow * exp(-pow((f - .5) * 16., 2.)) * uFlow * (.35 + .65 * fres) * .25; // 流光 kept faint (Xingyi)
  float steep = 1. - abs(n.y);
  float ridge = smoothstep(.15, .55, steep) * smoothstep(.1, .7, h);
  c = mix(c, nacre(ndv * 1.4 + h * 1.1 + vW.x * .02), clamp(uNacre * ridge * (.5 + .5 * fres) * 1.2, 0., 1.));
  c = mix(c, uRim, fres * .5);
  // 石青 along the silhouette and on the very tips only (Xingyi: a little blue at the edges, not whole tops).
  float blueEdge = pow(1. - ndv, 1.8) * smoothstep(.25, .7, h) + smoothstep(.82, .98, h) * .75;
  c = mix(c, AZURITE, clamp(blueEdge, 0., 1.) * .9);
  c += grain(vW, dist);
  float edge = 1. - smoothstep(0., fwidth(ndv) * 2.5 + .03, ndv);
  c = mix(c, uInkCol, edge * uMtInk * uIsCore);
  float a = uOpacity * mix(.26, 1., uIsCore) + fres * uRimAlpha * .75;
  // Soft feet (Xingyi: the base line was hard): the lowest part fades into the haze and out.
  float foot = smoothstep(0., .16, h);
  c = mix(uFogColor, c, .3 + .7 * foot);
  a *= .12 + .88 * foot;
  // Aerial perspective: distant peaks turn a paler 石青 before the warm haze takes them.
  c = mix(c, vec3(.55, .7, .72), smoothstep(110., 400., dist) * .38);
  gl_FragColor = vec4(applyFog(c, dist * .78), clamp(a, 0., 1.));
  #include <colorspace_fragment>
}`;

const ORGANZA_VERT = /* glsl */ `
uniform float uTime, uAmp, uFreq, uPhase, uLen, uWid;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec2 vP;
float W(vec2 p) {
  return .6 * sin(p.x * uFreq + uTime * .6 + uPhase)
       + .8 * sin(p.x * uFreq * .37 - p.y * 1.1 + uTime * .35 + uPhase * 2.)
       + .25 * sin((p.x + p.y) * uFreq * 1.9 + uTime * .9);
}
void main() {
  vec2 p = vec2(uv.x * uLen, uv.y * uWid);
  float e = .05;
  float dx = (W(p + vec2(e, 0.)) - W(p - vec2(e, 0.))) / (2. * e) * uAmp;
  float dz = (W(p + vec2(0., e)) - W(p - vec2(0., e))) / (2. * e) * uAmp;
  vec4 w = modelMatrix * vec4(position + vec3(0., W(p) * uAmp, 0.), 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * vec3(-dx, 1., -dz)); vUv = uv; vP = p;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ORGANZA_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uColor, uSheenCol, uSpecCol;
uniform float uOpacity, uSheen, uGlitter, uFiberAngle, uEdgeFade, uLayer;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec2 vP;
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 v = toCam / dist;
  float ndv = abs(dot(n, v));
  float sheen = pow(1. - ndv, 2.);
  float nh = max(dot(n, normalize(uLightDir + v)), 0.);
  float spec = pow(nh, 70.), broad = pow(nh, 10.);
  float ph = dot(vP, vec2(cos(uFiberAngle), sin(uFiberAngle))) * 60.;
  float fiber = mix(.5, .5 + .5 * sin(ph), 1. - smoothstep(.3, 1.2, fwidth(ph)));
  vec3 c = uColor * (.85 + .2 * fiber);
  c += uSheenCol * (sheen * .3 + broad * .15) * uSheen;
  c += uSpecCol * spec * uSheen * 1.2;
  vec2 cell = floor(vP * 9.);
  float r = hash3(vec3(cell, uLayer));
  float dot_ = 1. - smoothstep(.1, .25, length(fract(vP * 9.) - .5));
  float spark = step(1. - uGlitter * .035, r) * (.5 + .5 * sin(uTime * 2.5 + r * 60.)) * dot_ * (1. - smoothstep(8., 40., dist));
  c += vec3(1., .97, .85) * spark * 1.5;
  c += grain(vW, dist) * .6;
  float edge = smoothstep(0., uEdgeFade, vUv.y) * smoothstep(1., 1. - uEdgeFade, vUv.y)
             * smoothstep(0., .04, vUv.x) * smoothstep(1., .96, vUv.x);
  float a = (uOpacity * (.85 + .15 * fiber) + sheen * .12 * uSheen + spec * .3 + spark * .8) * edge;
  gl_FragColor = vec4(applyFog(c, dist), clamp(a, 0., 1.));
  #include <colorspace_fragment>
}`;

// 岸：哑光石面，入水处变湿变暗；水线用固定像素宽的墨线勾出
const GROUND_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uGround, uWet, uInkCol, uMid, uBlankAt, uBase, uTop, uRim, uCoreCol, uGlow;
uniform float uInk, uBlankR, uNacre, uBack, uMtInk, uCoreMix, uFlow;
uniform sampler2D uEarthMap;
varying vec3 vW; varying vec3 vN;
vec3 nacre(float t) { return .6 + .4 * cos(6.28318 * (t + vec3(.0, .2, .45))); }
// The recipe's jade, as on the jade mountains' core (MOUNTAIN_FRAG with uIsCore = 1), so the
// walkable hills are the same material the player chose at the start.
vec3 jade(vec3 n, vec3 v, float h, float dist) {
  float ndv = clamp(dot(n, v), 0., 1.);
  float fres = pow(1. - ndv, 2.5);
  float wrap = clamp(dot(n, uLightDir) * .5 + .5, 0., 1.);
  vec3 c = mix(uBase, uMid, smoothstep(0., .55, h));
  c = mix(c, uTop, smoothstep(.55, 1., h));
  c = mix(c, uCoreCol, uCoreMix * (1. - h * .6) * (.4 + .6 * ndv));
  c = mix(c, qinglu(n, h * 1.15, vW, .35), .5);
  c *= .45 + .75 * wrap;
  float thin = pow(1. - ndv, 1.5);
  float back = pow(clamp(dot(v, -uLightDir) * .5 + .5, 0., 1.), 3.);
  c = mix(c, uGlow, clamp(thin * uBack * (.35 + .65 * back), 0., 1.) * .6);
  float f = fract(vW.x * .035 + vW.y * .09 - uTime * .045);
  c += uGlow * exp(-pow((f - .5) * 16., 2.)) * uFlow * (.35 + .65 * fres) * .25; // 流光 kept faint (Xingyi)
  float steep = 1. - abs(n.y);
  float ridge = smoothstep(.15, .55, steep) * smoothstep(.1, .7, h);
  c = mix(c, nacre(ndv * 1.4 + h * 1.1 + vW.x * .02), clamp(uNacre * ridge * (.5 + .5 * fres) * 1.2, 0., 1.));
  c = mix(c, uRim, fres * .5);
  float edge = 1. - smoothstep(0., fwidth(ndv) * 2.5 + .03, ndv);
  return mix(c, uInkCol, edge * uMtInk);
}
void main() {
  vec3 n = normalize(vN);
  float dist = length(cameraPosition - vW);
  float y = vW.y;
  // 大块浅绿苔色与石色交错，免得岸面成一整块平板
  float moss = smoothstep(.35, .75, vnoise2(vW.xz * .09) * .65 + vnoise2(vW.xz * .31) * .35);
  // 草坡 (Xingyi, from the scroll's banks): a green lawn from the palette's own greens, moss-mottled.
  vec3 lawn = mix(uGround, uMid, .4 + .25 * moss);
  lawn = mix(lawn, uTop, .16 * vnoise2(vW.xz * .45 + 4.));
  vec3 land = lawn * (.92 + .14 * vnoise2(vW.xz * 1.3)) * (.95 + .08 * vnoise2(vW.xz * 5.));
  // 点苔：ink moss dots scattered on the flats, as the painting dots its banks.
  float tuft = smoothstep(.86, .93, vnoise2(vW.xz * 2.6)) * smoothstep(.75, .95, clamp(n.y, 0., 1.)) * (1. - smoothstep(1.4, 3., y));
  land = mix(land, uInkCol * 1.4 + uMid * .3, tuft * .55);
  // 土岸: the banks' cut faces show their earth, in the bridge's tan, in strata.
  // The triangle's own facing (smoothed normals average a riser away into the tiers beside it).
  float steep = 1. - abs(normalize(cross(dFdx(vW), dFdy(vW))).y);
  // Only the raised banks' near-vertical side faces are earth; every top surface stays lawn.
  float face = smoothstep(.32, .5, steep) * (1. - smoothstep(3.4, 4.6, y));
  // Xingyi's earth swatch, wrapped round the cut faces (about 7 units per tile, so its mottling,
  // moss flecks and drips stay visible instead of averaging to a flat brown).
  vec3 earth = texture2D(uEarthMap, vec2((vW.x + vW.z) * .14, vW.y * .14)).rgb;
  vec3 c = mix(uWet, land, smoothstep(-.75, -.3, y));
  c *= .7 + .4 * clamp(dot(n, uLightDir) * .5 + .5, 0., 1.);
  // Raised ground (hills, the walkable peak) turns into the recipe's jade.
  vec3 v = (cameraPosition - vW) / dist;
  c = mix(c, jade(n, v, clamp(y / 26., 0., 1.), dist), smoothstep(3.2, 5.5, y)); // above the lawn tiers
  c += grain(vW, dist);
  float fw = max(fwidth(y), 1e-4);
  float shore = (1. - smoothstep(fw * .8, fw * 2., abs(y + .35))) * step(.002, fw); // the waterline
  c = mix(c, uInkCol, shore * uInk);
  // 山顶未上色：越近越高，青绿越褪，只剩绢底与等高的墨线
  float blank = smoothstep(uBlankAt.y - 10., uBlankAt.y - 2., y) * (1. - smoothstep(uBlankR * .45, uBlankR, length(vW.xz - uBlankAt.xz)));
  float fy = max(fwidth(y * .9), 1e-4);
  float band = .5 - abs(fract(y * .9) - .5); // distance to the nearest contour
  float contour = 1. - smoothstep(fy * .5, fy * 1.6, band);
  vec3 silk = vec3(.91, .87, .78) * (.96 + .06 * vnoise2(vW.xz * 2.1)) - contour * .35;
  c = mix(c, silk, blank);
  c = applyFog(c, dist);
  // Earth faces show Xingyi's swatch exactly as the image: drawn last, so no light, grain or warm
  // haze tints it (only distant banks take some haze), with a crisp edge against the lawn.
  // Solid earth on every steep face; only the lawn line around it is soft (Xingyi: no straight,
  // hard edge, but no lawn colour inside the earth either). Beyond the solid core the earth fades
  // out along the smoothed normal, over a band whose width wavers along the bank.
  // No triangle-edge core at all (it follows the mesh rows: ruler-straight). The mask is the smoothed
  // normal alone, pushed up and down by a wavering noise, so every lawn–earth line meanders and blurs.
  float wobble = (vnoise2(vec2(vW.x + vW.z, vW.y * 1.5) * .9) - .5) * .3 + (vnoise2(vW.xz * 3.2 + 5.) - .5) * .12;
  float faceW = smoothstep(.03, .36, 1. - clamp(n.y, 0., 1.) + wobble) * (1. - smoothstep(3.4, 4.6, y)) * smoothstep(-.6, -.3, y);
  c = mix(c, mix(earth, uFogColor, smoothstep(uFogNear, uFogFar, dist) * .8), faceW);
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;

// 路：纸白色带，两缘一道细墨线
const PATH_VERT = /* glsl */ `
attribute float aSide;
varying vec3 vW; varying vec3 vN; varying float vSide;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const PATH_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uGround, uPath, uInkCol;
uniform float uInk;
varying vec3 vW; varying vec3 vN; varying float vSide;
void main() {
  vec3 n = normalize(vN); if (n.y < 0.) n = -n;
  float dist = length(cameraPosition - vW);
  float s = abs(vSide);
  // 土路：夯土的赭黄，顺路的车辙与踩痕，零星碎石；路缘渐入草地。
  // Xingyi: the lane should read as a lane but not shout — a trodden earth only a little paler than the lawn.
  vec3 earth = mix(vec3(.4, .32, .2), mix(uGround, uMid, .3), .45) * (.92 + .14 * vnoise2(vW.xz * .35));
  float ruts = smoothstep(.55, .95, vnoise2(vec2(vSide * 9., dot(vW.xz, vec2(.07, .05)))));
  earth = mix(earth, earth * .82, ruts * .6 * (1. - smoothstep(.15, .5, abs(s - .32))));
  float pebble = smoothstep(.82, .9, vnoise2(vW.xz * 4.3)) * (1. - smoothstep(.5, .8, s));
  earth = mix(earth, vec3(.55, .52, .46), pebble * .7);
  vec3 c = mix(earth, mix(uGround, uMid, .4), smoothstep(.45, .95, s));
  c *= .7 + .4 * clamp(dot(n, uLightDir) * .5 + .5, 0., 1.);
  c += grain(vW, dist);
  float fs = max(fwidth(s), 1e-4);
  float edge = 1. - smoothstep(0., fs * 1.5, abs(s - .7));
  c = mix(c, uInkCol, edge * uInk * .12);
  float a = .8 * (1. - smoothstep(.5, 1., s)); // soft, feathered edges into the grass
  gl_FragColor = vec4(applyFog(c, dist), a);
  #include <colorspace_fragment>
}`;

// 桥、屋：不透明青瓷，形边清楚
const CELADON_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uColor;
varying vec3 vW; varying vec3 vN;
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 toCam = cameraPosition - vW; float dist = length(toCam);
  float ndv = clamp(dot(n, toCam / dist), 0., 1.);
  vec3 c = uColor * (.62 + .45 * clamp(dot(n, uLightDir) * .5 + .5, 0., 1.));
  c += pow(1. - ndv, 3.) * .12;
  c += grain(vW, dist) * .7;
  gl_FragColor = vec4(applyFog(c, dist), 1.);
  #include <colorspace_fragment>
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSkyTop, uSkyHorizon, uSun, uLightDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = mix(uSkyHorizon, uSkyTop, smoothstep(-.02, .45, d.y));
  // The painting's sky is warm silk, not blue air; warm it by day, leave night alone.
  c = mix(c, vec3(.87, .8, .64), .38 * smoothstep(.45, .8, dot(uSkyHorizon, vec3(.333))) * (1. - smoothstep(.2, .7, d.y) * .4));
  c += uSun * pow(max(dot(d, uLightDir), 0.), 12.) * .35;
  // Long silk-cloud streaks low in the sky (v0.9 gold grade), like the reference's banded clouds.
  vec2 q = vec2(atan(d.z, d.x) * 3.2, d.y * 26.);
  float n = fract(sin(dot(floor(q * vec2(1., 1.)), vec2(127.1, 311.7))) * 43758.5);
  float band = sin(q.y + sin(q.x * 1.7) * .8) * .5 + .5;
  float streak = smoothstep(.72, .95, band * (.6 + .4 * sin(q.x * 2.3 + q.y * .4))) * smoothstep(.02, .1, d.y) * (1. - smoothstep(.22, .4, d.y));
  c = mix(c, vec3(.99, .96, .88), streak * .55 + n * 0.);
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;

const shader = (vertexShader, fragmentShader, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { ...pick(...COMMON_KEYS), ...uniforms }, ...extra });

// ---------- 构件 ----------
export function makeSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(160, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: SKY_FRAG,
      uniforms: pick('uSkyTop', 'uSkyHorizon', 'uSun', 'uLightDir'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

// Xingyi's earth swatch (Codex image) for the banks' cut faces.
const earthMap = new THREE.TextureLoader().load('./assets/earth_bank.jpg?v=1');
earthMap.wrapS = earthMap.wrapT = THREE.RepeatWrapping;
earthMap.colorSpace = THREE.SRGBColorSpace;
earthMap.anisotropy = 4;
export const groundMaterial = () => shader(BASIC_VERT, GROUND_FRAG, { uEarthMap: { value: earthMap }, ...pick('uGround', 'uWet', 'uInkCol', 'uInk', 'uMid', 'uBlankAt', 'uBlankR',
  'uBase', 'uTop', 'uRim', 'uCoreCol', 'uGlow', 'uNacre', 'uBack', 'uMtInk', 'uCoreMix', 'uFlow') });
export const pathMaterial = () => shader(PATH_VERT, PATH_FRAG, pick('uGround', 'uPath', 'uInkCol', 'uInk'),
  { transparent: true, depthWrite: false, side: THREE.DoubleSide });
export const celadon = uniformKey => shader(BASIC_VERT, CELADON_FRAG, { uColor: U[uniformKey] }, { side: THREE.DoubleSide });

export function organza(geo, { color, opacity, amp, freq, phase, len, wid, angle, edgeFade, layer }) {
  const mat = shader(ORGANZA_VERT, ORGANZA_FRAG, {
    ...pick('uSheenCol', 'uSpecCol', 'uSheen', 'uGlitter'),
    uColor: color,
    uOpacity: { value: opacity },
    uAmp: { value: amp }, uFreq: { value: freq }, uPhase: { value: phase },
    uLen: { value: len }, uWid: { value: wid },
    uFiberAngle: { value: angle }, uEdgeFade: { value: edgeFade }, uLayer: { value: layer },
  }, { transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.baseOpacity = opacity;
  return mesh;
}

export function ribbonGeo(points, width, segments = 220) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const pos = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const side = new THREE.Vector3().crossVectors(curve.getTangentAt(t), up).normalize().multiplyScalar(width / 2);
    pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
    uv.push(t, 0, t, 1);
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return { geo, length: curve.getLength(), center: curve.getPointAt(0.5) };
}

// 玉山：每座山 = 一个玉芯 + 最多 6 层沿法线外扩的透光壳
export const MAX_SHELLS = 6;
function clusterGeo({ h, seed, seg = 120, round = false }) { // round: low domed shore stones
  const r = mulberry(seed * 9301);
  const peaks = [{ x: 0, z: 0, h, r: h * (round ? 1.1 : 0.75), p: round ? 0.55 : 1.5 }];
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = h * (0.3 + 0.55 * r()), ph = h * (0.3 + 0.45 * r());
    const p = 1.4 + 0.8 * r();
    peaks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d * 0.7, h: ph, r: ph * (round ? 1 : 0.7), p: round ? 0.5 : p });
  }
  const R = h * 1.7;
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, seg, seg).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = 0;
    for (const pk of peaks) {
      const d = Math.hypot(x - pk.x, z - pk.z) / pk.r;
      if (d < 1) y = Math.max(y, pk.h * Math.pow(1 - d, pk.p));
    }
    pos.setY(i, y > 0.02 ? y * (round ? 0.85 + 0.3 * ridged(x * 0.5 + seed * 13, z * 0.5, seed) : 0.65 + 0.7 * ridged(x * 0.22 + seed * 13, z * 0.22, seed)) : -3);
  }
  geo.computeVertexNormals();
  return geo;
}
const MT_SHARED = pick('uBase', 'uMid', 'uTop', 'uRim', 'uCoreCol', 'uInkCol', 'uGlow', 'uFlow', 'uNacre', 'uBack', 'uMtInk', 'uCoreMix');
// ---------- 远山层：一圈圈山脊剪影，越远越淡，峰青腰绿、脚没入雾，脊上一道墨线 ----------
// The painting's depth is built from overlapping ranges, not one far wall; each ring is a
// cheap two-row band (silhouette only), so five of them cost less than one jade cluster.
const RANGE_VERT = /* glsl */ `
attribute float aV; attribute float aAng;
varying float vV; varying float vAng; varying vec3 vW;
void main() {
  vV = aV; vAng = aAng;
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const RANGE_FRAG = /* glsl */ `
uniform vec3 uBase, uMid, uTop, uRim, uInkCol, uFogColor, mistCol;
uniform float uHaze, uTime, uSeed;
varying float vV; varying float vAng; varying vec3 vW;
void main() {
  // vV: 0 at the mist line, 1 at this column's ridge (so every peak gets the full gradient).
  vec3 c = mix(uBase, uMid, smoothstep(.05, .55, vV));
  c = mix(c, uTop, smoothstep(.5, .95, vV));
  // 石青 on the ridges, as the painting's peaks turn mineral blue at the top.
  c = mix(c, vec3(.16, .42, .62), smoothstep(.7, .98, vV) * .45);
  // Texture strokes (皴) running down the slopes, and a soft rim of light on the ridge.
  float streak = .5 + .5 * sin(vAng * 620. + sin(vAng * 97. + uSeed) * 6. + sin(vAng * 23. + uSeed * 2.) * 9. + vV * 7.);
  float blotch = .5 + .5 * sin(vAng * 41. + uSeed * 3.) * sin(vV * 5. + vAng * 17.);
  c *= .93 + .1 * streak * blotch;
  c = mix(c, uRim, smoothstep(.86, .97, vV) * .35);
  c = mix(c, uInkCol, smoothstep(.965, 1., vV) * .55);
  // Aerial perspective: far rings pale into the sky colour; the foot dissolves into mist.
  c = mix(c, uFogColor, uHaze);
  c = mix(mistCol, c, smoothstep(.0, .26, vV));
  float a = smoothstep(.0, .12, vV);
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;
// ---------- 最远层：从原作取天际线，用我们的玉色画出来 ----------
// Pasting the scroll itself on the horizon read as collage (ochre blocks against jade), so
// only its skyline is taken: per column, the first pixel from the top that is clearly
// mineral paint (green or blue over red). The far ranges are then drawn with that outline
// in our own material: Wang Ximeng's peaks, in this game's jade.
export function skylineProfile(image) {
  const w = image.naturalWidth, h = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  // Per column, the first pixel from the top that is mineral paint (green or blue over red).
  // The peaks of this painting are capped with malachite and azurite, so their caps mark the
  // skyline; the silk (aged darker at the top, paler below) is red over blue throughout.
  const raw = new Float32Array(w);
  const at = (x, y) => (y * w + x) * 4;
  for (let x = 0; x < w; x++) {
    let found = h * .66;
    for (let y = Math.round(h * .12); y < h * .9; y++) {
      const i = at(x, y), j = at(x, y + 2);
      if (Math.max(px[i + 1], px[i + 2]) - px[i] > 10 && Math.max(px[j + 1], px[j + 2]) - px[j] > 10) { found = y; break; }
    }
    raw[x] = found;
  }
  // Soften into brush-like ridges: a median of neighbours, then a wide blur.
  const med = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const win = [];
    for (let k = -6; k <= 6; k++) win.push(raw[Math.min(w - 1, Math.max(0, x + k))]);
    win.sort((p, q) => p - q);
    med[x] = win[6];
  }
  const profile = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0, wt = 0;
    for (let k = -14; k <= 14; k++) { const g = Math.exp(-(k * k) / 60); sum += med[Math.min(w - 1, Math.max(0, x + k))] * g; wt += g; }
    profile[x] = 1 - (sum / wt) / h; // 0 = bottom of the scroll, 1 = top
  }
  return profile;
}

// One arc of far range whose ridge follows a profile; shaded like the other far ranges.
export function profileRange(profile, { cx = 0, cz = 0, radius, a0, a1, height, base, flip = false, haze, seed = 1 }) {
  const N = 900;
  const positions = [], vs = [], angs = [], index = [];
  const lo = Math.min(...profile), hi = Math.max(...profile);
  for (let i = 0; i <= N; i++) {
    const a = a0 + (a1 - a0) * i / N;
    const u = flip ? i / N : 1 - i / N;
    // Sharpen: the painting's peaks rise steeply from lower shoulders, so push the shoulders down.
    const p = Math.pow((profile[Math.round(u * (profile.length - 1))] - lo) / (hi - lo), 1.8);
    const edge = Math.min(1, i / 40, (N - i) / 40); // taper into the neighbouring arcs
    const top = base + height * (.12 + .88 * p * edge);
    const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
    positions.push(x, base - 8, z, x, top, z);
    vs.push(0, 1);
    angs.push(a, a);
    if (i) { const k = (i - 1) * 2; index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(vs, 1));
  geo.setAttribute('aAng', new THREE.Float32BufferAttribute(angs, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: RANGE_VERT, fragmentShader: RANGE_FRAG,
    uniforms: { ...pick('uBase', 'uMid', 'uTop', 'uRim', 'uInkCol', 'uFogColor', 'mistCol', 'uTime'), uHaze: { value: haze }, uSeed: { value: seed } },
    transparent: true, side: THREE.DoubleSide, depthWrite: true, fog: false,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- 云海留白：一圈横向的云把山脚与远水断开（云断山腰） ----------
const CLOUD_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const CLOUD_FRAG = /* glsl */ `
uniform vec3 mistCol, uFogColor; uniform float uTime, uInner, uOuter, uOpacity; uniform vec2 uCentre;
varying vec3 vW;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vW.xz;
  float r = length(p - uCentre);
  // Long horizontal bands drifting slowly, the way the painting lays cloud across a valley.
  vec2 q = vec2(p.x * .012 + uTime * .004, p.y * .03);
  float n = vn(q * 2.) * .55 + vn(q * 5.3 + 7.) * .3 + vn(q * 11. + 3.) * .15;
  float a = smoothstep(.42, .72, n) * smoothstep(uInner, uInner + 40., r) * (1. - smoothstep(uOuter - 60., uOuter, r));
  vec3 c = mix(mistCol, vec3(.97, .95, .9), .55);
  c = mix(c, uFogColor, smoothstep(120., 320., r) * .4);
  gl_FragColor = vec4(c, a * uOpacity);
  #include <colorspace_fragment>
}`;
export function cloudSea({ cx = 0, cz = 0, y, inner, outer, opacity = .85 }) {
  const geo = new THREE.RingGeometry(inner, outer, 160, 8).rotateX(-Math.PI / 2).translate(cx, y, cz);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
    uniforms: { ...pick('mistCol', 'uFogColor', 'uTime'), uInner: { value: inner }, uOuter: { value: outer }, uOpacity: { value: opacity }, uCentre: { value: new THREE.Vector2(cx, cz) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- 点景树：Xingyi 的墨线树贴片（billboard，绕竖轴朝向镜头） ----------
// All trees are one mesh. A tree standing between the camera and the traveller thins out
// with a dither (no transparency sorting needed); otherwise alpha is cut, like ink on silk.
const TREE_VERT = /* glsl */ `
attribute vec3 aCenter; attribute vec2 aCorner; attribute vec2 aSize;
uniform vec3 uFocus;
varying vec2 vUv; varying float vFade; varying vec3 vW;
void main() {
  vec3 toCam = cameraPosition - aCenter; toCam.y = 0.;
  vec3 right = normalize(vec3(toCam.z, 0., -toCam.x) + vec3(1e-4, 0., 0.));
  vec3 p = aCenter + right * aCorner.x * aSize.x + vec3(0., aCorner.y * aSize.y - .15, 0.);
  // Thin out when this tree stands on the sightline from the camera to the traveller.
  vec3 seg = uFocus - cameraPosition;
  float t = clamp(dot(aCenter - cameraPosition, seg) / max(dot(seg, seg), 1e-3), 0., 1.);
  vec3 near = cameraPosition + seg * t;
  float off = length((aCenter - near).xz);
  vFade = (t < .985 && off < aSize.x * .45 + .8) ? .28 : 1.;
  vUv = uv; vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const TREE_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uAtlas; uniform vec3 uTreeTint, uMid, uTop; uniform float uGhost;
varying vec2 vUv; varying float vFade; varying vec3 vW;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < .42) discard;
  // Screen-door thinning for trees in the way.
  if (vFade < 1. && uGhost < .5) discard; // a tree in the way steps aside entirely (a dither read as grey noise)
  float dist = length(cameraPosition - vW);
  vec3 c = t.rgb * uTreeTint;
  // The far-wood layer keeps the trees' own colour (a jade tint read as lace) and is only a little
  // see-through, so the woods sit back behind the near trees.
  // uGhost: 0 near trees (solid), 1 the peak's woods (a little see-through), ~2.5 the distant
  // scenery woods (faint, slightly hazed): solid where you can go, half-seen where you only look.
  c = mix(c, mix(uMid, uTop, .5), uGhost * .12);
  gl_FragColor = vec4(applyFog(c, dist), 1. - .22 * uGhost);
  #include <colorspace_fragment>
}`;
// plants: [{ x, y, z, w, h, rect }] with rect in atlas pixels.
export function treeSprites(atlas, atlasSize, plants, ghost = 0) {
  const centers = [], corners = [], sizes = [], uvs = [], index = [];
  plants.forEach(({ x, y, z, w, h, rect }, n) => {
    const u0 = rect.x / atlasSize.width, u1 = (rect.x + rect.w) / atlasSize.width;
    const v0 = 1 - (rect.y + rect.h) / atlasSize.height, v1 = 1 - rect.y / atlasSize.height;
    for (const [cx, cy, u, v] of [[-.5, 0, u0, v0], [.5, 0, u1, v0], [.5, 1, u1, v1], [-.5, 1, u0, v1]]) {
      centers.push(x, y, z);
      corners.push(cx, cy);
      sizes.push(w, h);
      uvs.push(u, v);
    }
    const k = n * 4;
    index.push(k, k + 1, k + 2, k, k + 2, k + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(centers, 3)); // for bounds only
  geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(centers, 3));
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(corners, 2));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 2));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, shader(TREE_VERT, TREE_FRAG, { uAtlas: { value: atlas }, uGhost: { value: +ghost }, ...pick('uTreeTint', 'uFocus', 'uMid', 'uTop') },
    { side: THREE.DoubleSide, transparent: !!ghost, depthWrite: !ghost }));
  mesh.frustumCulled = false;
  return mesh;
}

export function farRange({ cx = 0, cz = 0, radius, height, seed, haze, base = -1 }) {
  const N = 900;
  const r = mulberry(seed * 7919);
  const waves = Array.from({ length: 5 }, (_, i) => ({ f: 3 + i * 4 + Math.floor(r() * 5), p: r() * 6.28, w: 1 / (1 + i * .7) }));
  // Many narrow spires: the painting's ranges are clusters of steep peaks, not rolling hills.
  const spires = Array.from({ length: 46 }, () => ({ a: r() * Math.PI * 2, w: .012 + r() * .03, h: .45 + r() * .55 }));
  const positions = [], vs = [], angs = [], index = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    let n = 0, total = 0;
    for (const wv of waves) { n += wv.w * (.5 + .5 * Math.sin(a * wv.f + wv.p)); total += wv.w; }
    let h = .7 * Math.pow(n / total, 2.4);
    for (const sp of spires) {
      const d = Math.abs(Math.atan2(Math.sin(a - sp.a), Math.cos(a - sp.a))) / sp.w;
      if (d < 1) h = Math.max(h, sp.h * Math.pow(1 - d, 1.25));
    }
    const top = base + height * (.18 + .82 * h);
    const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
    positions.push(x, base - 6, z, x, top, z);
    vs.push(0, 1);
    angs.push(a, a);
    if (i) { const k = (i - 1) * 2; index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(vs, 1));
  geo.setAttribute('aAng', new THREE.Float32BufferAttribute(angs, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: RANGE_VERT, fragmentShader: RANGE_FRAG,
    uniforms: { ...pick('uBase', 'uMid', 'uTop', 'uRim', 'uInkCol', 'uFogColor', 'mistCol', 'uTime'), uHaze: { value: haze }, uSeed: { value: seed } },
    transparent: true, side: THREE.DoubleSide, depthWrite: true, fog: false,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// c.look (one of the three jade recipes' settings) gives this mountain its own material,
// so a scene can be assembled from 温玉, 冰玉 and 螺钿 side by side.
export function jadeMountain(c, groundY = 0) {
  const geo = clusterGeo(c);
  const group = new THREE.Group();
  group.position.set(c.x, groundY - 0.2, c.z);
  const own = c.look ? {
    uNacre: { value: c.look.nacre }, uBack: { value: c.look.back }, uFlow: { value: c.look.flow },
    uMtInk: { value: c.look.mtInk }, uCoreMix: { value: c.look.core },
  } : {};
  own.uHue = { value: c.hue ?? (Math.sin((c.seed ?? 1) * 12.9898) * 43758.5453 % 1 + 1) % 1 };
  const make = (isCore, i) => {
    const m = new THREE.Mesh(geo, shader(MOUNTAIN_VERT, MOUNTAIN_FRAG, {
      ...MT_SHARED, ...own,
      uOffset: { value: 0 },
      uOpacity: { value: 1 },
      uRimAlpha: { value: isCore ? 0.15 : 0.6 },
      uHeight: { value: c.h },
      uIsCore: { value: isCore ? 1 : 0 },
      uWhite: { value: isCore ? 0 : 0.2 + i * 0.08 },
    }, { transparent: true, depthWrite: isCore }));
    group.add(m);
    return m;
  };
  const core = make(true, 0);
  const shells = Array.from({ length: MAX_SHELLS }, (_, i) => make(false, i));
  return { ...c, group, core, shells };
}

// ---------- 配色（时辰） ----------
export const PALETTES = {
  dawn: {
    uSkyTop: '#c9b98c', uSkyHorizon: '#eedcae', uSun: '#fff0c4', uFogColor: '#e6d5a8',
    uBase: '#0a3329', uMid: '#16784b', uTop: '#6fcf98', uRim: '#effaf3', uCoreCol: '#1fae5c', uInkCol: '#1b2a26', uGlow: '#a6f7c8',
    bedCol: '#0b2c27', river0: '#0f4a40', river1: '#2a8a6e', river2: '#b9d9b8', mistCol: '#f3ead2',
    uSheenCol: '#e8f3e8', uSpecCol: '#f3e3a8',
    uGround: '#c8cda4', uWet: '#86a387', uPath: '#efe2c2',
    bridgeCol: '#d2e2d4', roofCol: '#2f6b5b', houseCol: '#e7e3d3', gold: '#c8a55a', fog: [60, 430],
    hemi: ['#fff0cf', '#6d8a76', 2.0], sunLight: ['#ffd99a', 2.3],
  },
  dusk: {
    uSkyTop: '#4f7a84', uSkyHorizon: '#f2cf9e', uSun: '#ffd39a', uFogColor: '#e6d2b2',
    uBase: '#08302a', uMid: '#167252', uTop: '#5dbb86', uRim: '#f4e4c6', uCoreCol: '#1ea862', uInkCol: '#211c14', uGlow: '#ffcf86',
    bedCol: '#10282a', river0: '#173f3c', river1: '#3c7f6c', river2: '#ecc99c', mistCol: '#f6e2c4',
    uSheenCol: '#ffe6c4', uSpecCol: '#ffd27a',
    uGround: '#c9c9a9', uWet: '#6f8b7a', uPath: '#f3e7cf',
    bridgeCol: '#d6dccb', roofCol: '#2e5e50', houseCol: '#eadcc2', gold: '#d4a54f', fog: [70, 330],
    hemi: ['#ffdcb5', '#4a5f58', 1.7], sunLight: ['#ffbd80', 2.1],
  },
  night: {
    uSkyTop: '#050f0c', uSkyHorizon: '#123a2f', uSun: '#9fe3c0', uFogColor: '#0f3028',
    uBase: '#06261f', uMid: '#1d6e4a', uTop: '#8fdcb3', uRim: '#b9f2d6', uCoreCol: '#39d97c', uInkCol: '#04110d', uGlow: '#6dffab',
    bedCol: '#020c0a', river0: '#0b3a31', river1: '#1f7a5c', river2: '#7fd1a8', mistCol: '#6fc79e',
    uSheenCol: '#b6f0cf', uSpecCol: '#f0d88a',
    uGround: '#2b4a3f', uWet: '#183a31', uPath: '#6f8f7c',
    bridgeCol: '#5f8a78', roofCol: '#0f3a2f', houseCol: '#46685a', gold: '#d9b45c', fog: [20, 120],
    hemi: ['#9fd8c0', '#0b2a22', 0.75], sunLight: ['#c4f0dc', 0.6],
  },
};

// ---------- 开卷三问：每问三个选项，每个选项只改自己那一组参数 ----------
export const QUESTIONS = [
  {
    key: 'mountain', ask: '山，是什么做的？', suffix: '山', options: [
      { id: 'warm', name: '温玉', hint: '玉芯浓，少透', set: { shellOpacity: 0.08, layers: 2, spacing: 0.3, core: 0.95, nacre: 0.1, back: 0.6, flow: 0.25, mtInk: 0.25 } },
      { id: 'ice', name: '冰玉', hint: '层层通透，逆光发亮', set: { shellOpacity: 0.14, layers: 5, spacing: 0.3, core: 0.55, nacre: 0.15, back: 1.15, flow: 0.45, mtInk: 0.12 } },
      { id: 'nacre', name: '螺钿', hint: '山脊泛贝光', set: { shellOpacity: 0.12, layers: 4, spacing: 0.25, core: 0.65, nacre: 0.38, back: 0.8, flow: 0.3, mtInk: 0.2, goldBoost: 0.2 } },
    ],
  },
  {
    key: 'water', ask: '水，是什么做的？', suffix: '水', options: [
      { id: 'thin', name: '薄纱', hint: '清浅见底', set: { sheen: 0.7, mist: 0.2, glitter: 0.1, river: 0.8 } },
      { id: 'thick', name: '浓纱', hint: '雾重，层叠', set: { sheen: 0.9, mist: 0.6, glitter: 0.2, river: 1.25 } },
      { id: 'glint', name: '闪纱', hint: '水面有碎光', set: { sheen: 1.0, mist: 0.3, glitter: 0.75, river: 1.0 } },
    ],
  },
  {
    key: 'time', ask: '什么时辰入画？', suffix: '', options: [
      { id: 'dawn', name: '晨', hint: '清光，雾白', set: { palette: 'dawn', sun: 215, grain: 0.05, ink: 0.75, gold: 0.35 } },
      { id: 'dusk', name: '昏', hint: '暖光，背光透玉', set: { palette: 'dusk', sun: 200, grain: 0.05, ink: 0.7, gold: 0.55 } },
      { id: 'night', name: '夜', hint: '玉自己发光', set: { palette: 'night', sun: 160, grain: 0.04, ink: 0.55, gold: 0.6 } },
    ],
  },
];
export const DEFAULT_CHOICE = { mountain: 'warm', water: 'thin', time: 'dawn' };

export function optionOf(key, id) {
  return QUESTIONS.find(q => q.key === key).options.find(o => o.id === id);
}

// 配方名：「晨 · 冰玉山 · 浓纱水」
export function recipeName(choice) {
  return ['time', 'mountain', 'water'].map(key => {
    const q = QUESTIONS.find(item => item.key === key);
    return optionOf(key, choice[key]).name + q.suffix;
  }).join(' · ');
}

export function settingsOf(choice) {
  const s = {};
  for (const q of QUESTIONS) Object.assign(s, optionOf(q.key, choice[q.key]).set);
  s.gold = Math.min(1, s.gold + (s.goldBoost || 0));
  return s;
}
