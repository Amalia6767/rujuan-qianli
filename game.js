import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { startAudio, setMuted, isMuted, cueUnroll, cueCapture, cueArrival, cueRope, cueSummit, cueStep, cuePickup, playEndingMusic, playTravelMusic } from './sound.js?v=119';
import {
  U, PALETTES, QUESTIONS, MAX_SHELLS, optionOf, recipeName, settingsOf,
  makeSky, groundMaterial, pathMaterial, celadon, organza, ribbonGeo, jadeMountain, cloudSea, treeSprites,
} from './look.js?v=119';

const canvas = document.getElementById('world');
const startScreen = document.getElementById('start-screen');
const coverDip = startScreen.querySelector('.cover-dip');
const yuanBox = startScreen.querySelector('.cover-yuan');
const yuanName = document.getElementById('yuan-name');
const yuanLine = document.getElementById('yuan-line');
// Cover lettering appears stroke by stroke: each character inks in after the one before.
{
  let delay = .5;
  startScreen.querySelectorAll('[data-ink]').forEach(el => {
    el.innerHTML = [...el.textContent].map(ch => {
      const span = `<span class="ink-ch" style="animation-delay:${delay.toFixed(2)}s">${ch}</span>`;
      delay += ch === '，' || ch === '。' ? .35 : .16;
      return span;
    }).join('');
    delay += .3;
  });
}
const startButton = document.getElementById('start-button');
const hud = document.getElementById('hud');
const goalList = document.getElementById('goal-list');
const coach = document.getElementById('coach');
const coachKeys = document.getElementById('coach-keys');
const coachText = document.getElementById('coach-text');
const scrollScreen = document.getElementById('scroll-screen');
const scrollToggle = document.getElementById('scroll-toggle');
const soundToggle = document.getElementById('sound-toggle');
const frameToggle = document.getElementById('frame-toggle');
const frameButtonText = document.getElementById('frame-button-text');
const closeScroll = document.getElementById('close-scroll');
const handscroll = document.getElementById('handscroll');
const originalScroll = document.getElementById('original-scroll');
const originalTab = document.getElementById('original-tab');
const routeTab = document.getElementById('route-tab');
const originalPanel = document.getElementById('original-panel');
const routePanel = document.getElementById('route-panel');
const scrollNote = document.getElementById('scroll-note');
const unrollLeft = document.getElementById('unroll-left');
const unrollRight = document.getElementById('unroll-right');
const scrollPosition = document.getElementById('scroll-position');
const bridgeCaption = document.getElementById('bridge-caption');
const scrollHint = document.getElementById('scroll-hint');
const travelViews = document.getElementById('travel-views');
const scrollNearShot = document.getElementById('scroll-near-shot');
const scrollFarShot = document.getElementById('scroll-far-shot');
const scrollNearEmpty = document.getElementById('scroll-near-empty');
const scrollFarEmpty = document.getElementById('scroll-far-empty');
const frameUI = document.getElementById('frame-ui');
const frameBankLabel = document.getElementById('frame-bank');
const frameStatus = document.getElementById('frame-status');
const frameChecklist = document.getElementById('frame-checklist');
const takeFrame = document.getElementById('take-frame');
const leaveFrame = document.getElementById('leave-frame');
const pauseScreen = document.getElementById('pause-screen');
const resumeButton = document.getElementById('resume-button');
const pauseRestartButton = document.getElementById('pause-restart-button');
const endScreen = document.getElementById('end-screen');
const inscribeScreen = document.getElementById('inscribe-screen');
const endRestartButton = document.getElementById('end-restart-button');
const elapsedTime = document.getElementById('elapsed-time');
const keepLine = document.getElementById('keep-line');
const endReturnButton = document.getElementById('end-return-button');
const rujuan = document.getElementById('rujuan');
const rujuanTrack = rujuan.querySelector('.rujuan-track');
const rujuanFigure = rujuan.querySelector('.rujuan-figure');
const rujuanSilk = rujuan.querySelector('.rujuan-silk');
const playLogText = document.getElementById('play-log-text');
const copyLogButton = document.getElementById('copy-log-button');
const actToggle = document.getElementById('act-toggle');
const actText = document.getElementById('act-text');
const toast = document.getElementById('toast');
const errorBox = document.getElementById('error');
const recipeScreen = document.getElementById('recipe-screen');
const recipeQuestions = document.getElementById('recipe-questions');
const recipeNameText = document.getElementById('recipe-name');
const recipeGo = document.getElementById('recipe-go');
const myScroll = document.getElementById('my-scroll');
const myScrollImg = document.getElementById('my-scroll-img');
const saveScroll = document.getElementById('save-scroll');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
} catch (error) {
  errorBox.hidden = false;
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xeef0e6, 45, 220);
const sky = makeSky();
scene.add(sky);

// ④ Still-water reflection: a mirror camera renders the scene (cut at the water by an oblique
// near plane, as three's Reflector does) into a small target; a thin, Fresnel-weighted sheet
// over the gauze river shows it, rippled. Banks, bridge, peaks and sky all double in the water.
const MIRROR_Y = -.35; // water surface, 0.3 below the bank tops so the earth banks show
const mirror = (() => {
  const target = new THREE.WebGLRenderTarget(512, 256, { type: THREE.HalfFloatType });
  const cam = new THREE.PerspectiveCamera();
  const texMat = new THREE.Matrix4();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(440, 43).rotateX(-Math.PI / 2).translate(0, MIRROR_Y, -15.8),
    new THREE.ShaderMaterial({
      uniforms: { tMirror: { value: target.texture }, uTexMat: { value: texMat }, uTime: U.uTime },
      vertexShader: `uniform mat4 uTexMat; varying vec4 vUv; varying vec3 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vUv = uTexMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D tMirror; uniform float uTime; varying vec4 vUv; varying vec3 vW;
        void main() {
          vec2 rip = vec2(sin(vW.x * .55 + uTime * 1.2) + sin(vW.z * 1.6 - uTime * .9), cos(vW.z * .8 + uTime * 1.05)) * .0045 * vUv.w;
          vec3 r = texture2DProj(tMirror, vUv + vec4(rip, 0., 0.)).rgb;
          vec3 v = normalize(cameraPosition - vW);
          float fres = .3 + .6 * pow(1. - clamp(v.y, 0., 1.), 3.);
          // Water body: deeper teal mid-channel, lighter shallows by the banks, slow drifting sheen.
          float shallow = smoothstep(12., 21., abs(vW.z + 15.8));
          vec3 body = mix(vec3(.07, .24, .22), vec3(.32, .5, .42), shallow);
          float sheen = smoothstep(.9, 1., sin(vW.x * .11 + sin(vW.z * .5 + uTime * .25) * 2.2 + uTime * .35)) * (1. - shallow * .6);
          vec3 col = mix(r * vec3(.84, .95, .92), body, .28) + vec3(.9, .95, .9) * sheen * .12;
          // Fade out toward the sheet's far ends, so no straight edge shows where it stops.
          float ends = 1. - smoothstep(120., 210., abs(vW.x));
          gl_FragColor = vec4(col, (fres * .72 + sheen * .08) * ends);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const n = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(0, MIRROR_Y, 0), eye = new THREE.Vector3();
  const look = new THREE.Vector3(), rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
  const render = () => {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2()).multiplyScalar(.32).floor();
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
    eye.setFromMatrixPosition(camera.matrixWorld);
    if (eye.y < MIRROR_Y + .05) return;
    at.set(eye.x, MIRROR_Y, eye.z);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(eye);
    cam.position.set(eye.x, 2 * MIRROR_Y - eye.y, eye.z);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    cam.lookAt(look.x, 2 * MIRROR_Y - look.y, look.z);
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    texMat.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(n, at).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = cam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - .003; e[14] = clip.w;
    mesh.visible = false;
    sky.position.copy(cam.position);
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    mesh.visible = true;
    sky.position.copy(camera.position);
  };
  render.mesh = mesh;
  return render;
})();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
camera.position.set(-18, 7, 22);

const ambient = new THREE.HemisphereLight(0xfff5dc, 0x5c8782, 2.0);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffdfac, 2.25);
sun.position.set(-16, 31, -19);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100;
sun.shadow.bias = -0.0004;
scene.add(sun);

// v0.6: the built world (bridge, houses, roofs) is opaque celadon with ink edges and
// gold trim; trees, figures and the boat stay lit standard materials tinted per recipe.
const mats = {
  rockBlue: new THREE.MeshStandardMaterial({ color: 0x2e6683, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x394c43, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2f6663, roughness: 1 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x648b72, roughness: 1 }),
  leafBlue: new THREE.MeshStandardMaterial({ color: 0x3d777a, roughness: 1 }),
  bridge: celadon('bridgeCol'),
  bridgeLight: celadon('bridgeCol'),
  roof: celadon('roofCol'),
  wall: celadon('houseCol'),
  eave: new THREE.MeshBasicMaterial({ color: 0xc8a55a }),
  robe: new THREE.MeshStandardMaterial({ color: 0x2f6170, roughness: 1 }),
  face: new THREE.MeshStandardMaterial({ color: 0xe2bd91, roughness: 1 }),
  ink: new THREE.MeshStandardMaterial({ color: 0x253f42, roughness: 1 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd6aa63, emissive: 0x654516, emissiveIntensity: .45 }),
  hull: new THREE.MeshStandardMaterial({ color: 0x5b4836, roughness: 1 }),
  boatman: new THREE.MeshStandardMaterial({ color: 0x8c7a57, roughness: 1 }),
  straw: new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 1 }),
  cargo: new THREE.MeshStandardMaterial({ color: 0xa88f62, roughness: 1 }),
};
// Trees are cloned per tree for fading, so the recipe tint key must be set before cloning.
for (const key of ['leaf', 'leafLight', 'leafBlue', 'trunk', 'rockBlue']) mats[key].userData.tint = key;
const inkLine = new THREE.LineBasicMaterial({ color: 0x1b2a26, transparent: true, opacity: .75 });
const INKED = new Set([mats.bridge, mats.bridgeLight, mats.wall, mats.roof]);

function box(w, h, d, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  if (INKED.has(material)) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), inkLine));
  parent.add(mesh);
  return mesh;
}

// v0.5 grey-box landform (route map v0.2): the near bank has a high terrace the
// player starts on, sloping down to a waterside lane; the far bank rises to houses.
function smooth(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// v0.9: the river is ~41 wide (near shore z 4.95, far shore z -36.5) so the 45-long bridge
// stands in water end to end, as in the painting. The near bank keeps its playtested layout;
// the bridge and everything beyond it moved 16 units further.
const RIVER = { near: 4.95, far: -36.5 };
const inRiver = z => z < RIVER.near && z > RIVER.far;
function slopeAt(x, z) {
  if (z > 5) return 2.8 * smooth(9, 14, z) * (1 - smooth(-1, 6, x));
  if (z < RIVER.far) return 2.2 * smooth(41, 48, -z) * (1 - smooth(18, 26, Math.abs(x - 12)));
  return 0;
}

// v0.8 far-bank village (Tripo), after the painting's cluster beyond the bridge: the long
// stilted house runs up the slope (open end uphill, posts showing downhill), the hall sits
// on a terrace facing the river, two cottages fill the hillside. Hall and long house can
// be walked into; all four block by their own walls (see houseStep).
const HOUSE_SITES = [
  // Xingyi 11/4: the hall and the cottage before it stand back together as a pair, the hall
  // a step behind and to the left, higher; the furnished interior is now the long house.
  { name: 'house_hall', label: '主屋', x: 1.5, z: -60, rotation: 0, scale: 6, pad: 3.8, y: 5.4 },
  { name: 'house_shelter', label: '长屋', x: 15, z: -43.4, rotation: -Math.PI / 2, scale: 12, baseY: .1,
    hint: '廊下摆着织机，案头搁着书卷和茶盏。山水深处，原来也住着寻常人家。' },
  { name: 'house_cottage', label: '小屋', x: 23, z: -47, rotation: -.45, scale: 6.2, pad: 3.6 },
  { name: 'house_cottage', label: '小屋', x: 7, z: -55, rotation: .1, scale: 5.4, pad: 3.2, y: 3.6 },
];
// Copies that only dress the scene (Xingyi: "pavilions and houses can all be copied"):
// drawn and, where they stand on walkable ground, solid; no terrace pads.
// v0.9 (Xingyi: "像原作一样集群"): houses gather into hamlets, never strung along the bank —
// one hamlet on the near bank behind the start. The far village climbs the slope in raised
// terraces (pads with their own height), roofs stepping up behind the hall and the long house.
const DECOR_SITES = [
  { name: 'house_hall', x: -30, z: 30, rotation: .35, scale: 6.4 },
  { name: 'house_cottage', x: -36.5, z: 34, rotation: .6, scale: 5.2 },
  { name: 'house_cottage', x: -24, z: 35.5, rotation: -.15, scale: 5 },
  { name: 'house_cottage', x: 21, z: -54.5, rotation: -.35, scale: 5, pad: 3, y: 4.6 },
];
// Flat terraces under the houses; the slope blends back in over 3.5 units.
const PADS = [...HOUSE_SITES, ...DECOR_SITES].filter(site => site.pad)
  .map(site => ({ x: site.x, z: site.z, r: site.pad, y: site.y ?? slopeAt(site.x, site.z + site.pad * .45) }));
// A little raised earth on each bank over the bridge's cut ends, burying them.
PADS.push({ x: 8, z: 6.7, r: 1.9, blend: 1.6, y: .27 }, { x: 8, z: -38.7, r: 1.9, blend: 1.6, y: .27 });

// v0.9 the walkable main peak behind the village (the painting's 主峰): a broad summit
// with two shoulders, and a switchback path carved into it from the hall's side up past
// the waterfall and the half-way pavilion to the summit. Off the path the slope is closed.
function peakMass(x, z) {
  const bump = (cx, cz, h, r) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
  return bump(-17, -84, 26, 11) + bump(-25, -66, 12, 6) + bump(-8, -60, 8, 5.5);
}
// [x, z, path height]; the first height is taken from the ground where the path leaves the village.
// The last point is the crest itself (height from the ground), so the summit view falls away on every side.
// The last leg winds round the back of the crest and ends on it; the painter sits on a ledge to the east.
const PEAK_PATH = [[-7, -50, null], [-9, -57.5, 5.5], [-17, -62, 8.5], [-24, -66, 11.5], [-14, -71, 15], [-24, -77, 19.5], [-24.5, -84.5, 21.8], [-21.6, -84.4, 24.2], [-17, -84, null]];
const PEAK_SPOTS = { waterfall: new THREE.Vector3(-10.4, 0, -62.3), pavilion: new THREE.Vector3(-27.6, 0, -66.4), summit: new THREE.Vector3(-17, 0, -84) };
PADS.push({ x: -27.6, z: -66.4, r: 3.9, y: 11.5 }); // a level terrace for the half-way pavilion, at the path's height
// The painter's ledge sits to one side of the summit viewpoint (Xingyi's first run: sitting
// straight ahead, he and his stone hid the bridge and boat from the summit view).
// v0.9 (Xingyi's second run: she could not reach him on a side ledge): the summit is a wide
// level terrace at crest height. The path climbs onto it from the west; the viewpoint is its
// north edge, facing the bridge; behind it, to the south, a pavilion where he sits and paints.
const SUMMIT_FACING = new THREE.Vector3(25, 0, 68).normalize(); // toward the bridge
const SUMMIT_SIDE = new THREE.Vector3(-SUMMIT_FACING.z, 0, SUMMIT_FACING.x); // west-north-west
const SUMMIT_PAVILION = new THREE.Vector3(-17.25, 0, -88.2);
const SUMMIT_TERRACE = { x: -17.1, z: -86.2, r: 6.5 };
PADS.push({ x: SUMMIT_TERRACE.x, z: SUMMIT_TERRACE.z, r: SUMMIT_TERRACE.r, blend: 3, y: slopeAt(-17, -84) + peakMass(-17, -84) });
// (The unpainted-silk summit is retired: Xingyi wants the peak in the jades like the rest.)
// Distance from (x, z) to the peak path and the path's height at the nearest point.
const peakNearest = { distance: Infinity, height: 0 };
function nearestOnPeakPath(x, z) {
  peakNearest.distance = Infinity;
  for (let i = 1; i < PEAK_PATH.length; i++) {
    const [ax, az, ah] = PEAK_PATH[i - 1], [bx, bz, bh] = PEAK_PATH[i];
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < peakNearest.distance) {
      peakNearest.distance = d;
      peakNearest.height = THREE.MathUtils.lerp(ah, bh, t);
    }
  }
  return peakNearest;
}

// 层层抬升 (Xingyi, from the scroll's banks): the bank slopes rise in flat lawn tiers with steep
// earth risers between them; the tier edges wander so they read as drawn, not ruled.
// The bank lanes (drawn in createEnvironment); under them the tiers give way to a smooth ramp.
const LANES = [
  // v0.9 (Xingyi): one route, not a fork — up to the lookout, down to the landing, along to the bridge.
  // From the lookout's foot (the hill itself has no drawn lane) along the shore to the bridge.
  [[-16, 9.6], [-11.5, 7.6], [-5, 7.2], [2, 7], [8, 6.6], [8, 5.6]], // runs onto the bridge's end
  [],
  [[8, -37.6], [8, -39.1], [5.6, -40.5], [2.4, -41.5], [-.9, -42.2]],
  [[8, -37.6], [8, -39.1], [10.6, -41.6], [11, -46.5], [12.6, -50.6], [15, -51]],
  [[-.9, -42.2], [-5, -43.2], [-7.3, -46.5], [-7, -50]],
];
function laneDistance(x, z) {
  let best = Infinity;
  for (const lane of LANES) for (let i = 1; i < lane.length; i++) {
    const [ax, az] = lane[i - 1], [bx, bz] = lane[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function terrace(h, x, z) {
  if (h <= .05) return h;
  const step = 1.05;
  // Rounded lobes, as the scroll's earth banks swell in arcs: |sin| scallops bend every tier edge
  // into a row of curves, a slower wave varies their size, and a little noise keeps them hand-drawn.
  const lobes = .9 * (Math.abs(Math.sin(x * .36 + z * .09 + .9 * Math.sin(z * .23))) - .6) + .3 * Math.sin(x * .07 - z * .13);
  const q = h / step + lobes + .1 * Math.sin(x * .53 + z * .4);
  const i = Math.floor(q);
  // Only every other tier keeps its earth riser (Xingyi: fewer banks, same heights); the rest
  // climb as a smooth lawn slope.
  const rise = i % 2 ? q - i : smooth(.8, 1, q - i);
  const stepped = Math.max(0, (i + rise) * step);
  return THREE.MathUtils.lerp(h, stepped, smooth(1.5, 2.5, laneDistance(x, z)));
}
// 高岸 lookout (Xingyi: give the climb a reason): a tall bank west of the start, off the line to
// the bridge, so the opening view stays open. From its level top the bridge, the boat at the
// landing, the far village and the peak lie in one view — the 此岸 frame is taken here — and the
// boatperson can be seen calling from the landing below, where the lane leads down next.
const LOOKOUT = new THREE.Vector3(-21, 0, 16.5);
function lookoutMound(x, z) {
  const d2 = (x - LOOKOUT.x) ** 2 + (z - LOOKOUT.z) ** 2;
  return 9 * Math.exp(-d2 / (2 * 4.6 * 4.6));
}
function groundBeforePath(x, z) {
  let height = terrace(slopeAt(x, z), x, z) + peakMass(x, z) + lookoutMound(x, z);
  for (const pad of PADS) {
    const w = 1 - smooth(pad.r, pad.r + (pad.blend ?? 3.5), Math.hypot(x - pad.x, z - pad.z));
    if (w > 0) height = THREE.MathUtils.lerp(height, pad.y, w);
  }
  return height;
}
PEAK_PATH[0][2] = groundBeforePath(PEAK_PATH[0][0], PEAK_PATH[0][1]);
PEAK_PATH[PEAK_PATH.length - 1][2] = groundBeforePath(-17, -84) + .1; // the crest itself: the view falls away on all sides
function heightAt(x, z) {
  let height = groundBeforePath(x, z);
  if (z < -46) {
    const { distance, height: pathHeight } = nearestOnPeakPath(x, z);
    const w = 1 - smooth(1.7, 3.8, distance);
    if (w > 0) height = THREE.MathUtils.lerp(height, pathHeight, w);
  }
  return height;
}
// Off the path the peak is closed: steep ground, and nothing past the village edge.
function peakBlocks(x, z) {
  if (z > -49.5) return false;
  if (Math.hypot(x - PEAK_SPOTS.pavilion.x, z - PEAK_SPOTS.pavilion.z) < 3.6) return false; // the pavilion's terrace
  if (Math.hypot(x - SUMMIT_TERRACE.x, z - SUMMIT_TERRACE.z) < SUMMIT_TERRACE.r) return false; // the summit terrace
  return nearestOnPeakPath(x, z).distance > 1.8 && (peakMass(x, z) > 1.5 || z < -53);
}

// v0.8 long bridge (Tripo, rails cut at the ends): 45 units along z, centred on x = 8; ends land at z = ±22.5.
// Long enough (45) that the hall's eaves clear the traveller without editing the roof.
// v0.9: centred at z -16 so it spans the widened river; ends at z 6.5 and -38.5.
// v0.9 (Xingyi): the torn last spans are cut off (tools/edit_bridge.py v7, at the rail post
// x = ±0.416 model units); the rest is stretched lengthways so its clean ends rest on the banks,
// where a little raised earth buries them. Height and width keep the old scale.
const BRIDGE = { x: 8, z: -16, half: 22, halfWidth: 1.6, deck: null };
// The pavilion's west stair runs down to a low landing over the water (measured from the model).
const SIDE_STAIR = { z: -16, half: 1.0, x0: .95, steps: null };
const onSideStair = position => state.onBridge && SIDE_STAIR.steps && position.x < BRIDGE.x - BRIDGE.halfWidth - .01;
function stairHeight(x) {
  const t = SIDE_STAIR.steps, x1 = BRIDGE.x - BRIDGE.halfWidth;
  const i = THREE.MathUtils.clamp((x - SIDE_STAIR.x0) / (x1 - SIDE_STAIR.x0) * (t.length - 1), 0, t.length - 1);
  const a = Math.floor(i), b = Math.min(t.length - 1, a + 1);
  return THREE.MathUtils.lerp(t[a], t[b], i - a);
}
const BRIDGE_SCALE = 45 / 0.9818, BRIDGE_LENGTH_SCALE = 22 / .416;
function deckHeight(z) {
  const t = BRIDGE.deck;
  const i = THREE.MathUtils.clamp((z - BRIDGE.z + BRIDGE.half) / (2 * BRIDGE.half) * (t.length - 1), 0, t.length - 1);
  const a = Math.floor(i), b = Math.min(t.length - 1, a + 1);
  return THREE.MathUtils.lerp(t[a], t[b], i - a);
}
function groundUnder(position) {
  if (onSideStair(position)) return stairHeight(position.x);
  if (state.onBridge && BRIDGE.deck) return deckHeight(position.z);
  if (state.floor != null) return state.floor; // inside a house, on its raised floor
  return heightAt(position.x, position.z);
}

// Visible banks dip under the gauze river; the walkable edges stay at RIVER.near / RIVER.far.
function shoreEdge(x, sign) { // distance of the drawn shore from z = 0 on that side
  // The bank line swells in rounded arcs too, like the scroll's shores.
  return (sign > 0 ? 4.72 : 36.27) + .16 * Math.sin(x * .24 + (sign > 0 ? 0 : 2)) + .55 * (Math.abs(Math.sin(x * .3 + (sign > 0 ? .4 : 1.9))) - .6);
}
// Beyond the play area (|x| > 48) the banks break up into low islands in open water, as in
// the painting's wide-water passages; only drawn, never walked.
function islandAt(x, z) {
  const n = (.5 + .5 * Math.sin(x * .061 + z * .043 + 1.1) * Math.sin(x * .037 - z * .071 + 2.3))
    * (.75 + .25 * Math.sin(x * .19 + z * .13));
  return -1.4 + 3.4 * Math.max(0, n - .5) / .5;
}
function visibleGround(x, z) {
  const sign = z >= (RIVER.near + RIVER.far) / 2 ? 1 : -1;
  const t = sign * z - shoreEdge(x, sign);
  // A cut earth bank: a near-vertical face down into the water, then the bed.
  const ground = t < 0 ? Math.max(-1.3, -Math.min(.62, -t * 3) + t * .3) : heightAt(x, z);
  const away = smooth(48, 80, Math.abs(x));
  return away > 0 ? THREE.MathUtils.lerp(ground, islandAt(x, z), away) : ground;
}

const pathSamples = [];
function nearPath(x, z, margin) {
  return pathSamples.some(([px, pz, half]) => Math.hypot(x - px, z - pz) < half + margin);
}

// Key places of the long-bridge chapter, in world units.
const START = LOOKOUT.clone(); // v0.9 (Xingyi): the journey opens on the lookout top, the whole view at once
const MOORING_POST = new THREE.Vector3(1.4, 0, 6.0);
const BOAT_DOCK = new THREE.Vector3(-5.6, 0, 3.75);

// v0.9 trees are Xingyi's ink-line tree sheets (tools/tree_sprites.py → trees_atlas), drawn
// as billboards in one mesh once the atlas loads; plant() only records where they go.
// kind: pine (cliffs, the peak), cluster (houses, paths), willow (water), strip (distant rows).
const TREE_HEIGHT = { pine: 5.4, cluster: 4.6, willow: 5, strip: 1.7 };
const plants = [];
function plant(kind, x, z, scale = 1, y = null, sprite = false) {
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 6.5) return; // the lookout hill is bare: just the hilltop
  // Never on or over the bridge ends (Xingyi: a willow grew through the landing).
  if (Math.abs(x - BRIDGE.x) < 5.5 && (Math.abs(z - (BRIDGE.z + BRIDGE.half)) < 4.5 || Math.abs(z - (BRIDGE.z - BRIDGE.half)) < 4.5)) return;
  if (y == null) {
    const h = heightAt(x, z), around = [heightAt(x + .7, z), heightAt(x - .7, z), heightAt(x, z + .7), heightAt(x, z - .7)];
    // No trees stuck into steep hillsides (Xingyi): beyond about 45° only the hand-placed pines stay.
    const steepness = Math.max(...around.map(a => Math.abs(a - h))) / .7;
    if (steepness > 1 && plants.heroes !== undefined) return;
    // A 3D tree takes the lowest ground round it so its roots sink in; a flat sprite sits at its centre,
    // or its trunk would vanish into the uphill side.
    y = sprite || kind === 'strip' ? h - .12 : Math.min(h, ...around) - .1;
  }
  plants.push({ kind, x, z, scale, y, sprite });
}
function tree(x, z, scale = 1) {
  plant((Math.round(x * 3 + z * 7) & 3) === 0 ? 'pine' : 'cluster', x, z, scale);
}

// Trees and rocks between the follow camera and the traveller turn see-through,
// so sightline screens can block the view from afar without hiding the player.
const occluders = [];
// Rails and pavilion posts: never faded, but a framing view with one right in front
// of the lens is refused (playtest 1 and 2 both kept a view split by a post).
const bridgeParts = [];
function fadeable(object) {
  const materials = new Map();
  object.traverse(part => {
    if (!part.isMesh) return;
    if (!materials.has(part.material)) {
      const copy = part.material.clone(); // clone() drops shader hooks: carry the scroll painting over
      copy.onBeforeCompile = part.material.onBeforeCompile;
      copy.customProgramCacheKey = part.material.customProgramCacheKey;
      materials.set(part.material, copy);
    }
    part.material = materials.get(part.material);
    part.material.transparent = true;
  });
  return { object, materials: [...materials.values()], opacity: 1 };
}

const segment = new THREE.Line3();
const closest = new THREE.Vector3();
const sightProbe = new THREE.Ray();
function fadeOccluders(dt, eye, target) {
  segment.set(eye, target);
  for (const item of occluders) {
    const centre = item.object.position;
    segment.closestPointToPoint(centre, true, closest);
    // Houses are too big for the centre test: they fade when the sightline enters their box,
    // unless the traveller is inside (the indoor camera handles that).
    const between = item.box
      ? !item.box.containsPoint(target)
        && sightProbe.set(eye, segment.delta(closest).normalize()).intersectBox(item.box, closest) !== null
        && closest.distanceTo(eye) < eye.distanceTo(target)
      : Math.hypot(closest.x - centre.x, closest.z - centre.z) < 2.3
        && centre.distanceTo(target) > 1.2 && closest.distanceTo(target) > .6;
    item.opacity = THREE.MathUtils.lerp(item.opacity, between ? .22 : 1, Math.min(1, dt * 6));
    item.materials.forEach(material => {
      material.opacity = item.opacity;
      material.depthWrite = item.opacity > .95;
    });
  }
}

function brushStroke(points, radius, material, parent = scene) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), radius, 5, false), material);
  parent.add(mesh);
  return mesh;
}

function sweptRoof(parent, halfWidth, halfDepth, eaveY, rise) {
  const corners = [
    [-halfWidth, -halfDepth], [halfWidth, -halfDepth],
    [halfWidth, halfDepth], [-halfWidth, halfDepth],
  ];
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const vertices = new Float32Array([
      0, eaveY + rise, 0, ax, eaveY + .24, az, mx, eaveY, mz,
      0, eaveY + rise, 0, mx, eaveY, mz, bx, eaveY + .24, bz,
    ]);
    const roofPlane = new THREE.BufferGeometry();
    roofPlane.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    roofPlane.computeVertexNormals();
    const panel = new THREE.Mesh(roofPlane, mats.roof);
    panel.castShadow = true;
    parent.add(panel);
    brushStroke([[ax, eaveY + .24, az], [mx, eaveY, mz], [bx, eaveY + .24, bz]], .042, mats.eave, parent);
  }
  brushStroke([[0, eaveY + rise, -halfDepth * .75], [0, eaveY + rise + .08, 0], [0, eaveY + rise, halfDepth * .75]], .035, mats.eave, parent);
}

const pathMat = pathMaterial();
function paintedPath(controlPoints, width) {
  const curve = new THREE.CatmullRomCurve3(controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const rows = [-1.28, -.98, -.68, 0, .68, .98, 1.28];
  const positions = [], sides = [], indices = [];
  const steps = Math.max(84, Math.round(curve.getLength() * 3)); // dense enough to follow steep ground
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    const bend = .9 + .065 * Math.sin(t * 32 + width) + .035 * Math.sin(t * 73);
    const dx = -tangent.z, dz = tangent.x;
    pathSamples.push([point.x, point.z, width * .5]);
    for (let row = 0; row < rows.length; row++) {
      const offset = rows[row] * width * .5 * bend;
      const px = point.x + dx * offset, pz = point.z + dz * offset;
      positions.push(px, heightAt(px, pz) + .08, pz);
      sides.push(rows[row] / 1.28);
      if (i && row) {
        const a = (i - 1) * rows.length + row - 1;
        const b = i * rows.length + row - 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, pathMat);
  mesh.renderOrder = 0;
  scene.add(mesh);
}

const brushInk = new THREE.LineBasicMaterial({ color: 0x1b2a26, transparent: true, opacity: .4 });
function bankBrushwork() {
  const strokes = [];
  const hash = n => (Math.sin(n * 127.1 + 39.37) * 43758.5453) % 1;
  const unit = n => Math.abs(hash(n));
  for (let i = 0; i < 290; i++) {
    const sign = i % 2 ? 1 : -1;
    const x = -42 + 84 * unit(i + 1);
    const z = sign > 0 ? 6.4 + 16 * unit(i + 39) : RIVER.far - 1.4 - 12 * unit(i + 39);
    if (nearPath(x, z, .5)) continue;
    const ground = heightAt(x, z);
    const height = .19 + .3 * unit(i + 77);
    const lean = .08 * (unit(i + 91) - .5);
    for (const side of [-1, 0, 1]) {
      strokes.push(x, ground + .009, z, x + lean + side * .11, ground + height * (side ? .72 : 1), z + side * .045);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(strokes, 3));
  scene.add(new THREE.LineSegments(geometry, brushInk));
}

// Waterfall and the half-way pavilion on the peak path. The pavilion is a stand-in until
// the Tripo model arrives (halfwayPavilion is hidden then).
const fallMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime },
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    void main() {
      float streak = .5 + .5 * sin(vUv.x * 38. + sin(vUv.x * 7.) * 3.);
      float flow = fract(vUv.y * 2.5 + uTime * 1.3 + streak * .35);
      float edge = smoothstep(0., .18, vUv.x) * smoothstep(1., .82, vUv.x);
      float a = (.3 + .5 * smoothstep(.25, 1., streak) * (1. - .6 * flow)) * edge;
      gl_FragColor = vec4(.93, .97, .95, a);
    }`,
});
let halfwayPavilion = null;
// 题壁: the pavilion's plastered wall carries one wet stroke (someone was just here), then
// the line the player chooses.
const wallCanvas = document.createElement('canvas');
wallCanvas.width = 960;
wallCanvas.height = 408; // same proportions as the 4.1 × 1.75 wall
const wallTexture = new THREE.CanvasTexture(wallCanvas);
wallTexture.colorSpace = THREE.SRGBColorSpace;
// Xingyi: not a white board with one stroke, but a mounted Song silk panel with verse on it.
// The verse is 苏轼《题西林壁》 (a poem written on a wall); its last line is still being written.
const WALL_FONT = "'Kaiti SC', 'STKaiti', 'KaiTi', 'Xingkai SC', 'Noto Serif SC', 'Songti SC', serif";
function drawWall(line) {
  const ctx = wallCanvas.getContext('2d'), W = 960, H = 408, band = 30;
  // brocade mounting
  ctx.fillStyle = '#2f4a45';
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 16) for (const y of [8, H - 22]) {
    ctx.fillStyle = 'rgba(214,190,128,.28)';
    ctx.fillRect(x + 4, y, 8, 2); ctx.fillRect(x + 7, y + 4, 2, 8);
  }
  // aged silk
  const g = ctx.createLinearGradient(0, band, 0, H - band);
  g.addColorStop(0, '#d8c79d'); g.addColorStop(.5, '#e0d0a8'); g.addColorStop(1, '#d2bf92');
  ctx.fillStyle = g;
  ctx.fillRect(10, band, W - 20, H - 2 * band);
  for (let y = band; y < H - band; y += 2) { ctx.fillStyle = `rgba(110,90,55,${.035 + .03 * ((y * 7) % 3) / 3})`; ctx.fillRect(10, y, W - 20, 1); }
  for (let x = 10; x < W - 10; x += 3) { ctx.fillStyle = 'rgba(255,248,225,.05)'; ctx.fillRect(x, band, 1, H - 2 * band); }
  for (let i = 0; i < 9; i++) { // soft age stains
    const sx = (i * 263) % W, sy = band + (i * 97) % (H - 2 * band);
    const st = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 + (i * 31) % 70);
    st.addColorStop(0, 'rgba(140,110,60,.10)'); st.addColorStop(1, 'rgba(140,110,60,0)');
    ctx.fillStyle = st; ctx.fillRect(10, band, W - 20, H - 2 * band);
  }
  ctx.strokeStyle = 'rgba(176,146,84,.8)'; ctx.lineWidth = 2;
  ctx.strokeRect(14, band + 4, W - 28, H - 2 * band - 8);
  const column = (text, x, size, ink, wet = false) => {
    ctx.font = `${size}px ${WALL_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [...text].forEach((ch, i) => {
      const y = band + 22 + i * (size + 6);
      if (wet) { ctx.fillStyle = 'rgba(20,20,18,.95)'; ctx.fillText(ch, x, y); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillText(ch, x - 1, y - 1); }
      else { ctx.fillStyle = ink; ctx.fillText(ch, x, y); }
    });
  };
  column('横看成岭侧成峰', 900, 40, 'rgba(38,34,28,.82)');
  column('远近高低各不同', 846, 40, 'rgba(38,34,28,.82)');
  column('不识庐山真面目', 792, 40, 'rgba(38,34,28,.8)');
  column('只缘', 738, 40, '', true); // still wet: the writer has just gone on up the path
  // a small seal
  ctx.fillStyle = 'rgba(176,44,36,.85)'; ctx.fillRect(721, H - band - 64, 34, 34);
  ctx.fillStyle = '#e9dcc0'; ctx.font = `bold 14px ${WALL_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('行', 738, H - band - 55); ctx.fillText('者', 738, H - band - 39);
  if (line) column(line, 600, 44, 'rgba(22,22,20,.95)', true);
  wallTexture.needsUpdate = true;
}

// The painter's things left on the path: picked up with E, handed back at the summit later.
const pickups = {};
const PICKUP_LINES = {
  dish: ['山路旁遗落着一碟石绿，颜色尚湿。作画的人，或许并未走远。', '拾得石绿颜料碟'],
  brush: ['一支画笔落在路旁，笔尖还带着湿意。', '拾得一支笔'],
};
function makePickup(key, x, z) {
  const group = new THREE.Group();
  group.position.set(x, heightAt(x, z) + .04, z);
  if (key === 'dish') {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .24, .07, 20), new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: .6 })));
    const paint = new THREE.Mesh(new THREE.CircleGeometry(.22, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f9a74, roughness: .35 }));
    paint.position.y = .04;
    group.add(paint);
  } else {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .72, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: .8 }));
    shaft.rotation.z = Math.PI / 2;
    shaft.position.y = .03;
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.04, .14, 8), new THREE.MeshStandardMaterial({ color: 0x15140f, roughness: .3 }));
    tip.rotation.z = Math.PI / 2;
    tip.position.set(.42, .03, 0);
    group.add(tip);
    group.rotation.y = .7;
  }
  // Swap the placeholder shapes for Xingyi's Tripo brush and dish once they load.
  loadModelParts(key === 'dish' ? 'pickup_dish' : 'pickup_brush').then(gltf => {
    group.children.filter(c => c !== pickups[key]?.ring).forEach(c => group.remove(c));
    gltf.scene.scale.setScalar(key === 'dish' ? 1.5 : 1);
    group.add(gltf.scene);
  }).catch(() => {});
  const ring = new THREE.Mesh(new THREE.RingGeometry(.45, .62, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf5d27a, transparent: true, opacity: 0, depthWrite: false }));
  ring.position.y = .02;
  group.add(ring);
  scene.add(group);
  pickups[key] = { group, ring, taken: false };
}

function peakFeatures() {
  // (The waterfall sheet and its pool are retired: Xingyi found them out of place.)
  const spot = PEAK_SPOTS.pavilion;
  halfwayPavilion = new THREE.Group();
  halfwayPavilion.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
  for (const x of [-1.9, 1.9]) for (const z of [-1.9, 1.9]) box(.13, 2.7, .13, mats.trunk, x, 1.35, z, halfwayPavilion);
  sweptRoof(halfwayPavilion, 2.3, 2.3, 2.7, 1.1);
  // The wall closes the pavilion's outer (west) side and faces the path.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.75), new THREE.MeshBasicMaterial({ map: wallTexture, side: THREE.DoubleSide }));
  wall.rotation.y = Math.PI / 2;
  wall.position.set(-1.9, 1.35, 0);
  wall.name = 'inscription-wall';
  halfwayPavilion.add(wall);
  drawWall('');
  scene.add(halfwayPavilion);

  makePickup('dish', -12.4, -59.0);
  makePickup('brush', -19.2, -74.2);
}

// Model trees cannot thin out like sprites, so one standing on the camera's sightline to
// the traveller is collapsed for as long as it is in the way.
const treeModels = [];
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
function updateTreeModels() {
  const cam = camera.position, f = U.uFocus.value;
  const sx = f.x - cam.x, sz = f.z - cam.z, len2 = sx * sx + sz * sz || 1;
  const touched = new Set();
  for (const t of treeModels) {
    const k = ((t.x - cam.x) * sx + (t.z - cam.z) * sz) / len2;
    const off = Math.hypot(t.x - cam.x - sx * k, t.z - cam.z - sz * k);
    const hide = state.mode === 'play' && k > 0 && k < .985 && off < t.w + .8;
    if (hide === t.hidden) continue;
    t.hidden = hide;
    t.mesh.setMatrixAt(t.index, hide ? hiddenMatrix : t.matrix);
    touched.add(t.mesh);
  }
  touched.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
}

async function loadTrees() {
  try {
    const [atlasSize, atlas] = await Promise.all([
      fetch('./assets/trees_atlas.json').then(r => r.json()),
      new THREE.TextureLoader().loadAsync('./assets/trees_atlas.png'),
    ]);
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
    const byKind = {};
    // Wide, low groups are kept for the distant rows; near trees use the upright ones.
    for (const rect of atlasSize.sprites) {
      if (rect.kind !== 'strip' && rect.w / rect.h > 1.7) (byKind.strip ??= []).push(rect);
      else (byKind[rect.kind] ??= []).push(rect);
    }
    // Near the lanes, Xingyi's Tripo trees stand in for the sprites (two crossed copies each,
    // since single-image models are shallow); everywhere else the ink sprites remain.
    const MODEL_FOR = { pine: ['tree_bonsai_tree', 'tree_twisted_pine_tree'], willow: ['tree_willow_tree'], cluster: ['tree_tree'] };
    const near = [], far = [];
    // Every tree the player walks near is a model (Xingyi); sprites only dress what is out of reach.
    plants.forEach((p, i) => (p.kind !== 'strip' && !p.sprite && (i < plants.heroes || nearPath(p.x, p.z, 10)) ? near : far).push({ ...p, i }));
    const groups = {};
    for (const p of near) {
      const names = MODEL_FOR[p.kind];
      (groups[names[p.i % names.length]] ??= []).push(p);
    }
    for (const [name, list] of Object.entries(groups)) loadModel(name, gltf => {
      const mesh = gltf.scene.getObjectByProperty('isMesh', true);
      // Pivot on the trunk (centroid of the lowest vertices), so the two crossed copies share one trunk.
      const position = mesh.geometry.attributes.position;
      let minY = Infinity, maxY = -Infinity;
      for (let v = 0; v < position.count; v++) { minY = Math.min(minY, position.getY(v)); maxY = Math.max(maxY, position.getY(v)); }
      let tx = 0, tz = 0, n = 0;
      for (let v = 0; v < position.count; v++) {
        if (position.getY(v) < minY + (maxY - minY) * .12) { tx += position.getX(v); tz += position.getZ(v); n++; }
      }
      mesh.geometry.translate(-tx / n, 0, -tz / n);
      const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
      mesh.material.roughness = 1;
      mesh.material.metalness = 0;
      mesh.material.side = THREE.DoubleSide;
      const instanced = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length * 2);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
      list.forEach((p, k) => {
        const h = TREE_HEIGHT[p.kind] * p.scale * .9, s0 = h / size.y;
        for (const turn of [0, Math.PI / 2]) {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.x * 1.7 + p.z + turn);
          m.compose(pos.set(p.x, p.y - .05, p.z), q, sc.set(s0, s0, s0));
          instanced.setMatrixAt(k * 2 + (turn ? 1 : 0), m);
          treeModels.push({ mesh: instanced, index: k * 2 + (turn ? 1 : 0), matrix: m.clone(), x: p.x, z: p.z, w: h * .5, hidden: false });
        }
      });
      instanced.castShadow = true;
      scene.add(instanced);
    }, '树');
    const items = far.map(({ kind, x, z, y, scale, i }) => {
      const options = byKind[kind] ?? byKind.cluster;
      const rect = options[(i * 7 + Math.round(Math.abs(x * 13 + z * 5))) % options.length];
      const h = TREE_HEIGHT[kind] * scale;
      return { x, y, z, h, w: h * rect.w / rect.h, rect };
    });
    const mesh = treeSprites(atlas, atlasSize, items);
    mesh.renderOrder = 4;
    scene.add(mesh);
    // 森林叠影 (Xingyi: the peak looked bare): a few hundred small, slightly see-through trees in
    // their own colours, in bands that follow the contours, over the whole peak, steep slopes too.
    const ghostRandom = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(913);
    const summitY = heightAt(SUMMIT_TERRACE.x, SUMMIT_TERRACE.z);
    const ghosts = [];
    for (let i = 0; i < 5000 && ghosts.length < 300; i++) {
      const x = -44 + 52 * ghostRandom(), z = -100 + 58 * ghostRandom();
      if (peakMass(x, z) < 1.6 || nearPath(x, z, 1.4)) continue;
      const y = heightAt(x, z);
      if (y > summitY - 2.5 || Math.hypot(x - SUMMIT_TERRACE.x, z - SUMMIT_TERRACE.z) < SUMMIT_TERRACE.r + 1) continue;
      // Woods gather in contour bands with gaps between, as the scroll layers its ridges.
      if (Math.sin(y * .9 + Math.sin(x * .2) * 1.4 + Math.cos(z * .17)) < -.1 && ghostRandom() > .15) continue;
      const kind = ghostRandom() < .25 ? 'pine' : 'cluster', options = byKind[kind] ?? byKind.cluster; // mostly round crowns
      const rect = options[i % options.length], h = TREE_HEIGHT[kind] * (.4 + .35 * ghostRandom());
      ghosts.push({ x, y: y - .1, z, h, w: h * rect.w / rect.h, rect });
    }
    const ghostMesh = treeSprites(atlas, atlasSize, ghosts, true);
    ghostMesh.renderOrder = 3;
    scene.add(ghostMesh);
    // 虚处有物 (Xingyi): beyond where you can walk — far shores, islands, the feet of the far
    // ranges — faint woods in groves, so the half-seen distance still has detail.
    const farWoods = [];
    for (let i = 0; i < 12000 && farWoods.length < 1100; i++) {
      const a = ghostRandom() * Math.PI * 2, r = 18 + 110 * Math.sqrt(ghostRandom());
      const x = Math.cos(a) * r * 1.15, z = -20 + Math.sin(a) * r;
      // Inside the walkable world only the parts well away from every lane and house take them.
      const inside = Math.abs(x) < 50 && z > -100 && z < 42;
      // The near bank (and the camera paths over it) keeps only its own trees; inside the world
      // the faint woods fill just the far fields beyond the village, away from lanes and houses.
      if (inside && (z > -42 || nearPath(x, z, 10) || peakMass(x, z) > 1
        || [...HOUSE_SITES, ...DECOR_SITES].some(h => Math.hypot(x - h.x, z - h.z) < 12))) continue;
      const y = visibleGround(x, z);
      if (y < .1) continue;
      if (Math.sin(x * .09 + Math.cos(z * .07) * 2) * Math.sin(z * .08 - x * .03) < -.15) continue; // groves, with clearings
      const kind = ['cluster', 'cluster', 'pine', 'willow'][Math.floor(ghostRandom() * 4)], options = byKind[kind] ?? byKind.cluster;
      const rect = options[i % options.length], h = TREE_HEIGHT[kind] * (inside ? .9 + .5 * ghostRandom() : (1.3 + 1.1 * ghostRandom()) * (1 + r / 150));
      farWoods.push({ x, y: y - .15, z, h, w: h * rect.w / rect.h, rect });
    }
    const farMesh = treeSprites(atlas, atlasSize, farWoods, 1.9);
    farMesh.renderOrder = 3;
    scene.add(farMesh);
  } catch (error) {
    console.warn('tree sprites failed to load', error);
  }
}

function createEnvironment() {
  // Banks: one matte stone surface each side, dipping under the gauze river.
  for (const sign of [1, -1]) {
    // The far plane is deeper (it carries the walkable peak) and starts at the far shore.
    const geometry = sign > 0 ? new THREE.PlaneGeometry(440, 72, 640, 230) : new THREE.PlaneGeometry(440, 76, 640, 300); // fine enough for crisp tier risers
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, sign > 0 ? 39 : -72);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, visibleGround(position.getX(i), position.getZ(i)));
    geometry.computeVertexNormals();
    scene.add(new THREE.Mesh(geometry, groundMaterial()));
  }
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(440, 44).rotateX(-Math.PI / 2), celadon('bedCol'));
  bed.position.set(0, -1.5, -15.8);
  scene.add(bed);

  // Gauze river: three layers of different colour and fibre angle.
  const riverGeo = new THREE.PlaneGeometry(440, 43, 600, 90).rotateX(-Math.PI / 2).translate(0, 0, -15.8);
  const river = [
    { y: -.66, color: U.river0, opacity: .55, amp: .06, freq: .5, angle: 0 },
    { y: -.52, color: U.river1, opacity: .35, amp: .08, freq: .7, angle: .18 },
    { y: -.38, color: U.river2, opacity: .22, amp: .05, freq: .9, angle: -.12 },
  ].map((layer, i) => {
    const mesh = organza(riverGeo, { ...layer, phase: i * 1.7, len: 440, wid: 43, edgeFade: .12, layer: i }); // soft ends, no straight cut
    mesh.position.y = layer.y;
    scene.add(mesh);
    return mesh;
  });

  // Route map v0.2: from the high starting point, a terrace path and a waterside
  // path both reach the right bridgehead; the waterside one passes the boat landing.
  paintedPath(LANES[0], 2.7);
  // Far bank: one lane to the hall door, one up beside the long house to its open end.
  paintedPath(LANES[2], 2.6);
  paintedPath(LANES[3], 2.4);
  paintedPath(LANES[4], 2.4);
  paintedPath(PEAK_PATH.map(([x, z]) => [x, z]), 2.6);
  bankBrushwork();
  peakFeatures();

  // Bridge at x=8: actual traversable world geometry, not created by the scroll click.
  const bridgeStart = scene.children.length;
  box(3.8, .14, 11.5, mats.bridgeLight, 8, .11, 0);
  for (let i = -5; i <= 5; i++) box(3.75, .025, .033, mats.bridge, 8, .196, i);
  for (const z of [-4, -2, 0, 2, 4]) for (const x of [6.4, 9.6]) box(.3, 1.3, .3, mats.bridge, x, -.55, z);
  for (const x of [6.07, 9.93]) {
    box(.22, .17, 11.7, mats.bridge, x, .1, 0);
    for (const z of [-5.35, -3.55, -1.78, 0, 1.78, 3.55, 5.35]) {
      box(.14, .82, .14, mats.bridge, x, .59, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.105, 8, 6), mats.eave);
      cap.position.set(x, 1.04, z);
      scene.add(cap);
    }
    brushStroke([[-0.01, 1.05, -5.4], [-0.01, 1.16, -2.8], [-0.01, 1.21, 0], [-0.01, 1.16, 2.8], [-0.01, 1.05, 5.4]]
      .map(([dx, y, z]) => [x + dx, y, z]), .068, mats.bridge);
    brushStroke([[x, .49, -5.4], [x, .55, 0], [x, .49, 5.4]], .047, mats.bridge);
  }

  // A compact crossing pavilion leaves the walking lane open underneath its eaves.
  const bridgePavilion = new THREE.Group();
  bridgePavilion.position.set(8, 0, 0);
  for (const x of [-1.3, 1.3]) for (const z of [-1.35, 1.35]) {
    box(.13, 2.75, .13, mats.trunk, x, 1.62, z, bridgePavilion);
    box(.32, .13, .32, mats.bridgeLight, x, .25, z, bridgePavilion);
  }
  box(3.25, .13, 3.25, mats.bridge, 0, 3.05, 0, bridgePavilion);
  sweptRoof(bridgePavilion, 2.16, 2.13, 3.18, 1.24);
  box(.19, .17, .19, mats.eave, 0, 4.48, 0, bridgePavilion);
  scene.add(bridgePavilion);
  bridgeParts.push(...scene.children.slice(bridgeStart));

  // Jade mountains close both horizons; the bridge stays the focal gap between them.
  // Open water to the horizon under everything: it shows wherever the drawn banks dip.
  const sea = organza(new THREE.PlaneGeometry(640, 640, 160, 160).rotateX(-Math.PI / 2).translate(0, 0, -25),
    { color: U.river1, opacity: .7, amp: .04, freq: .4, phase: .7, len: 640, wid: 640, angle: .1, edgeFade: .03, layer: 9 }); // the river's own colour, so open water meets it seamlessly
  sea.position.y = -.8;
  sea.renderOrder = 6;
  scene.add(sea);

  // Layered far ranges, farthest and palest first, so the summit view opens onto
  // ridge after ridge instead of an empty horizon.
  // A sea of cloud round the stage: peaks rise out of it, and it breaks the far water from the near.
  const clouds = [
    cloudSea({ cx: 0, cz: -20, y: 2.5, inner: 62, outer: 330, opacity: .9 }),
    cloudSea({ cx: 0, cz: -20, y: 9, inner: 120, outer: 330, opacity: .55 }),
    // Higher, farther banks so each ridge layer below stands on its own cloud (平远/高远).
    cloudSea({ cx: 0, cz: -20, y: 16, inner: 175, outer: 420, opacity: .5 }),
    cloudSea({ cx: 0, cz: -20, y: 26, inner: 250, outer: 460, opacity: .42 }),
  ];
  clouds.forEach((mesh, i) => { mesh.renderOrder = 7 + i; scene.add(mesh); });

  // v0.9 (Xingyi): the whole landscape is built from the three jades only — 温玉 (solid core),
  // 冰玉 (layered, translucent) and 螺钿 (nacre on the ridges, the favourite) — no flat bands.
  // 螺钿 carries the near and middle peaks, 温玉 anchors a few near hills, 冰玉 is the far
  // layer, where its translucency reads as distance.
  const look = id => optionOf('mountain', id).set;
  const W = look('warm'), I = look('ice'), N = look('nacre');
  const placed = [
    // Far bank, kept back so the clusters' long foothills clear the village and the path.
    { x: -52, z: -82, h: 18, seed: 5, look: N }, { x: -8, z: -120, h: 30, seed: 8, look: N }, { x: 20, z: -72, h: 21, seed: 9, look: N },
    { x: 46, z: -66, h: 17, seed: 10, look: W }, { x: -58, z: -62, h: 15, seed: 11, look: N },
    { x: -40, z: -64, h: 10, seed: 3, look: W }, { x: 39, z: -59, h: 11, seed: 4, look: N },
    // Near bank, behind the start.
    { x: -36, z: 46, h: 16, seed: 1, look: N }, { x: -6, z: 54, h: 20, seed: 6, look: W }, { x: 22, z: 47, h: 17, seed: 7, look: N },
    { x: 50, z: 40, h: 13, seed: 2, look: W }, { x: -60, z: 34, h: 12, seed: 12, look: N },
    // Peaks stacked behind the walkable summit.
    { x: -22, z: -114, h: 30, seed: 21, look: N }, { x: 0, z: -110, h: 24, seed: 22, look: I }, { x: -44, z: -104, h: 26, seed: 23, look: N },
    // Middle distance along the river, both ways, so the water winds between peaks.
    { x: -88, z: -22, h: 22, seed: 13, look: N }, { x: -122, z: -58, h: 30, seed: 14, look: I }, { x: 92, z: -26, h: 24, seed: 15, look: N },
    { x: 128, z: -62, h: 30, seed: 16, look: I }, { x: -104, z: 34, h: 18, seed: 17, look: N }, { x: 108, z: 30, h: 20, seed: 18, look: N },
  ];
  // Two rings of lighter clusters round the horizon: 螺钿 nearer, 冰玉 farther. None whose
  // foothills would reach the walkable peak.
  const ringRandom = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(97);
  for (const [count, r0, r1, h0, h1, ringLook, seg] of [[20, 140, 165, 24, 40, N, 56], [18, 200, 245, 38, 58, I, 40], [22, 275, 310, 52, 78, I, 28], [24, 350, 390, 70, 100, I, 24]]) {
    for (let i = 0; i < count; i++) {
      const a = (i + ringRandom() * .6) / count * Math.PI * 2;
      const r = r0 + (r1 - r0) * ringRandom();
      const h = h0 + (h1 - h0) * ringRandom();
      const x = Math.cos(a) * r * 1.15, z = -20 + Math.sin(a) * r;
      if (Math.hypot(x + 17, z + 75) < h * 1.7 + 22) continue;
      placed.push({ x, z, h, seed: 100 + placed.length, look: ringLook, seg });
    }
  }
  // 青绿小山石 (Xingyi, from the scroll): a few clumps of low domed stones at the waterline, in
  // the mountains' own jade, kept off the bridgeheads, the landing and the lanes.
  const stoneRandom = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(577);
  for (let g = 0, clumps = 0; g < 80 && clumps < 9; g++) {
    const near = clumps % 2 === 0, x = -46 + 92 * stoneRandom();
    const z = near ? RIVER.near + .2 : RIVER.far - .2;
    if (Math.abs(x - BRIDGE.x) < 7 || Math.hypot(x - BOAT_DOCK.x, z - BOAT_DOCK.z) < 7 || Math.hypot(x - MOORING_POST.x, z - MOORING_POST.z) < 4 || nearPath(x, z, 2)) continue;
    clumps++;
    for (let k = 0; k < 2 + Math.floor(stoneRandom() * 2); k++) {
      placed.push({ x: x + (stoneRandom() - .5) * 3, z: z + (near ? -1 : 1) * stoneRandom() * .9, h: .7 + .8 * stoneRandom(), seed: 500 + g * 5 + k, look: N, seg: 28, round: true });
    }
  }
  const mountains = placed.map(c => {
    const mountain = jadeMountain(c, visibleGround(c.x, c.z));
    scene.add(mountain.group);
    return mountain;
  });
  const mists = [
    { pts: [[-85, 4.2, -58], [-45, 5.2, -60], [30, 5.2, -61], [85, 4.5, -58]], w: 6 },
    { pts: [[-75, 4.5, 36], [-30, 5.5, 34], [10, 4.2, 38], [70, 5, 35]], w: 5 },
    // Mist rings at the feet of the far ranges (the painting's bands of cloud between ridges).
    ...[[140, 3, 22], [178, 5, 28], [215, 7, 34], [258, 12, 40], [300, 18, 46], [345, 24, 52]].map(([r, y, w]) => ({
      pts: Array.from({ length: 33 }, (_, k) => [Math.cos(k / 32 * Math.PI * 2) * r, y, -20 + Math.sin(k / 32 * Math.PI * 2) * r]), w,
    })),
  ].map(({ pts, w }, i) => {
    const { geo, length, center } = ribbonGeo(pts, w);
    const mesh = organza(geo, {
      color: U.mistCol, opacity: i >= 2 ? .3 : .12, amp: .5, freq: .25, phase: i * 2.3,
      len: length, wid: w, angle: .3 * ((i % 3) - 1), edgeFade: .38, layer: 10 + i,
    });
    scene.add(mesh);
    return { mesh, center };
  });

  for (const [x,z,s] of [
    [-23,11,1.05],[-24,25,1.3],[-21,16,.9],[-21,7.4,1.1],[-9,22,.85],
    [13,9,.93],[18,9,1.05],[23,12,1.1],
    // Far shore and the pines among the village houses, as in the painting.
    [-23,-39,1.2],[-14,-38.5,.9],[24,-39,.95],[30,-41,1.08],
    [6,-47,1.15],[19.6,-39.5,1.05],[-5.6,-40.4,.95],[28,-49,1.2],
  ]) tree(x,z,s);
  // Small trees at the near bridgehead; the view from the start to the bridge stays whole
  // (Xingyi: the bridge is the subject; the old sightline-screen trees and rock are gone).
  for (const [x, z, k] of [[4.4, 8.6, .55], [11.8, 8.4, .6], [12.8, 10.8, .5], [3.2, 10.4, .5]]) plant('cluster', x, z, k);
  // Willows at the water: the near shore, the landing and both bridgeheads.
  for (const [x, z, k] of [[-27, 6.4, 1.1], [-20, 6.1, 1], [-14.5, 6.6, .9], [4.6, 6.5, .95], [11, 6.9, 1.1], [17, 6.3, 1],
    [24, 6.8, 1.05], [4.6, -37.6, 1], [11.4, -37.8, 1.1], [-7, -37.4, .95], [19, -37.3, 1], [-18, -37.6, 1.05]]) plant('willow', x, z, k);
  // Mixed trees behind and between the houses, and along the lanes.
  for (const [x, z, k] of [[3.8, -50.5, 1.1], [8.5, -48.6, .95], [-9.5, -41.5, 1], [22, -42, 1.05], [26.5, -45.5, 1.1],
    [18.6, -52.2, .9], [-19, -42.5, 1.1], [-27, 31, 1.1], [-3, 34, .95], [-21, 21.5, 1], [6, 18.5, 1.05], [-2, 22, .9]]) plant('cluster', x, z, k);
  // Pines beside the peak path and on its cliffs (none in the summit's view of the bridge).
  for (const [x, z, k] of [[-11.8, -54.5, .95], [-20.5, -59.6, 1], [-27.3, -63.5, 1.15], [-11.2, -69.4, 1], [-27.6, -74.6, 1.1],
    [-21.4, -79.6, .9], [-28, -86.5, 1.2], [-23.5, -91, 1.05], [-8.2, -88.6, 1]]) plant('pine', x, z, k * .72);
  // Fill the banks as the painting does: groves on the flats, pines up the slopes, willows at
  // the water. Kept off the lanes, houses, landing, bridgeheads, spawn and the summit's view.
  const scatter = (n => () => (n = (n * 48271) % 2147483647) / 2147483647)(11);
  const nearHouse = (x, z) => [...HOUSE_SITES, ...DECOR_SITES].some(h => Math.hypot(x - h.x, z - h.z) < h.scale * .75 + 3);
  const summitView = new THREE.Vector3(-16.3, 0, -81.5), toBridge = new THREE.Vector3(25, 0, 68).normalize();
  const keepClear = (x, z) => {
    if (nearPath(x, z, 1.6) || nearHouse(x, z)) return true;
    if (Math.hypot(x - START.x, z - START.z) < 7) return true;
    if (Math.hypot(x - BOAT_DOCK.x, z - BOAT_DOCK.z) < 6 || Math.hypot(x - MOORING_POST.x, z - MOORING_POST.z) < 4) return true;
    if (Math.abs(x - BRIDGE.x) < 3.5 && (Math.abs(z - 7) < 4 || Math.abs(z + 39) < 4)) return true;
    // Nothing tall between the start and the bridge: the opening view is the bridge, whole.
    const sx = 8 - START.x, sz = 7 - START.z, t = Math.max(0, Math.min(1, ((x - START.x) * sx + (z - START.z) * sz) / (sx * sx + sz * sz)));
    if (Math.hypot(x - START.x - sx * t, z - START.z - sz * t) < 7) return true;
    if (Math.hypot(x - SUMMIT_TERRACE.x, z - SUMMIT_TERRACE.z) < SUMMIT_TERRACE.r + 1.5) return true;
    const dx = x - summitView.x, dz = z - summitView.z, ahead = dx * toBridge.x + dz * toBridge.z;
    return ahead > 0 && ahead < 26 && Math.abs(dx * toBridge.z - dz * toBridge.x) < ahead * .9 + 2;
  };
  plants.heroes = plants.length; // the hand-placed ones above may become 3D trees
  // Trees gather into groves round the hamlets and a few stands on the open bank (as the
  // scroll groups them), leaving clear ground between; only a sprinkling stands alone.
  const groves = [...HOUSE_SITES, ...DECOR_SITES].map(h => ({ x: h.x, z: h.z, r: h.scale * .75 + 6 }))
    .concat([{ x: -42, z: 14, r: 7 }, { x: 30, z: 14, r: 7 }, { x: 38, z: 28, r: 6 }, { x: -40, z: -40, r: 8 }, { x: 40, z: -42, r: 8 }]);
  for (let i = 0; i < 4000 && plants.length < 220; i++) {
    const x = -48 + 96 * scatter();
    const z = scatter() < .45 ? RIVER.near + 1 + 38 * scatter() : RIVER.far - 1 - 56 * scatter();
    if (keepClear(x, z)) continue;
    if (!groves.some(g => Math.hypot(x - g.x, z - g.z) < g.r) && scatter() > .08) continue;
    const shore = z > 0 ? z - RIVER.near : RIVER.far - z;
    const k = .75 + .5 * scatter();
    if (shore < 3.2) { if (scatter() < .55) plant('willow', x, z, k); continue; }
    if (peakMass(x, z) > 3.5 || heightAt(x, z) > 2.2) plant('pine', x, z, k);
    else plant(scatter() < .78 ? 'cluster' : 'pine', x, z, k);
  }
  // The main peak's slopes (Xingyi: a few lone pines looked pasted on): groves of small ink
  // sprite trees in clumps off the path, thicker in the folds, as the scroll dots its hills.
  // Below the summit's eye line they cannot block its view, so only the terrace and path stay clear.
  const peakClear = (x, z) => nearPath(x, z, 1.8) || Math.hypot(x - SUMMIT_TERRACE.x, z - SUMMIT_TERRACE.z) < SUMMIT_TERRACE.r + 1.5
    || heightAt(x, z) > heightAt(SUMMIT_TERRACE.x, SUMMIT_TERRACE.z) - 5;
  for (let g = 0, groves = 0; g < 600 && groves < 24; g++) {
    const cx = -38 + 44 * scatter(), cz = -98 + 50 * scatter();
    const m = peakMass(cx, cz);
    if (m < 2.5 || peakClear(cx, cz)) continue;
    groves++;
    for (let k = 0; k < 11; k++) {
      const a = scatter() * Math.PI * 2, r = 3.6 * Math.sqrt(scatter());
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (peakClear(x, z)) continue;
      plant(scatter() < .65 ? 'pine' : 'cluster', x, z, .5 + .35 * scatter(), null, true);
    }
  }
  // And rows along both edges of the peak path, as the scroll lines its mountain tracks.
  for (let i = 1; i < PEAK_PATH.length; i++) {
    const [ax, az] = PEAK_PATH[i - 1], [bx, bz] = PEAK_PATH[i];
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let d = 0; d < len; d += 2.2) for (const side of [-1, 1]) {
      if (scatter() < .35) continue;
      const off = side * (2.6 + 1.6 * scatter());
      const x = ax + (bx - ax) * d / len + nx * off, z = az + (bz - az) * d / len + nz * off;
      if (!peakClear(x, z)) plant(scatter() < .7 ? 'pine' : 'cluster', x, z, .45 + .3 * scatter(), null, true);
    }
  }
  // ③ A willow line along both banks, as in the reference: leaning over the water.
  for (let i = 0; i < 26; i++) {
    const x = -58 + 116 * scatter();
    const z = i % 2 ? RIVER.near + .8 + 1.8 * scatter() : RIVER.far - .8 - 1.8 * scatter();
    if (!keepClear(x, z)) plant('willow', x, z, .85 + .45 * scatter());
  }
  // Distant rows of tiny trees on the far slopes and on the islands, as on the painting's ridges.
  for (let i = 0; i < 46; i++) {
    const a = i * 2.399, r = 70 + (i * 37 % 60);
    const x = Math.cos(a) * r * 1.3, z = -20 + Math.sin(a) * r * .9;
    const ground = visibleGround(x, z);
    if (ground > -.2 && (Math.abs(x) > 45 || Math.abs(z + 20) > 55)) plant('strip', x, z, 1.4 + (i % 5) * .25, ground);
  }

  // Fork waymark (playtests: nobody noticed there were two paths): the choice is named inside
  // the world, not in a menu.

  // Mooring post at the waterside lane (a game addition, not a painted feature).
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, 1.1, 8), mats.trunk);
  post.position.set(MOORING_POST.x, .55, MOORING_POST.z);
  post.castShadow = true;
  post.name = 'simplePost';
  scene.add(post);
  const postCap = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), mats.eave);
  postCap.position.set(MOORING_POST.x, 1.12, MOORING_POST.z);
  postCap.name = 'simplePostCap';
  scene.add(postCap);
  loadTrees();
  return { river, mists, mountains };
}

const environment = createEnvironment();

// ---------- 开卷配方：开卷三问的选择在这里落到材质上 ----------
// v0.9 (Xingyi): no recipe choice any more; one fixed look, chosen for beauty.
const FIXED_CHOICE = { mountain: 'nacre', water: 'glint', time: 'dawn' };
const recipe = { choice: { ...FIXED_CHOICE }, name: recipeName(FIXED_CHOICE) };
const tintMaterials = () => [
  ...['leaf', 'leafLight', 'leafBlue', 'trunk', 'rockBlue'].map(key => mats[key]),
  ...occluders.flatMap(item => item.materials),
];

// Ink trees follow the hour: plain by day, warm at dusk, dim and cool at night.
const TREE_TINTS = { dawn: [1, 1, 1], dusk: [1, .88, .76], night: [.42, .55, .58] };
function applyRecipe(choice) {
  recipe.choice = { ...choice };
  U.uTreeTint.value.setRGB(...(TREE_TINTS[choice.time] ?? TREE_TINTS.dawn));
  recipe.name = recipeName(choice);
  const s = settingsOf(choice);
  const p = PALETTES[s.palette];
  for (const [key, value] of Object.entries(p)) if (U[key]) U[key].value.set(value);
  [U.uFogNear.value, U.uFogFar.value] = p.fog;
  scene.fog.color.set(p.uFogColor);
  scene.fog.near = p.fog[0] * .7;
  scene.fog.far = p.fog[1];
  ambient.color.set(p.hemi[0]);
  ambient.groundColor.set(p.hemi[1]);
  ambient.intensity = p.hemi[2];
  sun.color.set(p.sunLight[0]);
  sun.intensity = p.sunLight[1];
  const azimuth = s.sun * Math.PI / 180, elevation = .56;
  U.uLightDir.value.set(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth));
  sun.position.copy(U.uLightDir.value).multiplyScalar(40);

  U.uGrain.value = s.grain;
  U.uNacre.value = s.nacre;
  U.uBack.value = s.back;
  U.uFlow.value = s.flow;
  U.uMtInk.value = s.mtInk;
  U.uCoreMix.value = s.core;
  U.uSheen.value = s.sheen;
  U.uGlitter.value = s.glitter;
  U.uInk.value = s.ink;
  for (const m of environment.mountains) {
    const ml = m.look ?? s; // each mountain keeps its own jade
    m.core.material.uniforms.uOpacity.value = .45 + .55 * ml.core;
    m.shells.forEach((shell, i) => {
      shell.visible = i < ml.layers;
      shell.material.uniforms.uOffset.value = ml.spacing * m.h * .06 * (i + 1);
      shell.material.uniforms.uOpacity.value = ml.shellOpacity;
    });
  }
  for (const { mesh } of environment.mists) mesh.material.uniforms.uOpacity.value = s.mist * .3;
  for (const layer of environment.river) layer.material.uniforms.uOpacity.value = Math.min(.9, layer.userData.baseOpacity * s.river);
  inkLine.opacity = s.ink;
  brushInk.color.set(p.uInkCol);
  brushInk.opacity = s.ink * .5;
  inkLine.color.set(p.uInkCol);
  mats.eave.color.set(p.gold);

  const c = hex => new THREE.Color(hex);
  const tints = {
    leaf: c(p.uMid).lerp(c(p.uBase), .3),
    leafLight: c(p.uMid).lerp(c(p.uTop), .5),
    leafBlue: c(p.uMid).lerp(c(p.roofCol), .5),
    trunk: c(p.uInkCol).lerp(c(p.uBase), .5),
    rockBlue: c(p.uMid).lerp(c(p.uRim), .25),
  };
  for (const material of tintMaterials()) {
    const tint = tints[material.userData.tint];
    if (tint) material.color.copy(tint);
  }
}

// Far mountains first; inside each mountain the core first, then shells inside-out.
const riverCentre = new THREE.Vector3();
const sortables = [
  ...environment.mountains.map(m => ({ center: m.group.position, meshes: [m.core, ...m.shells] })),
  ...environment.mists.map(m => ({ center: m.center, meshes: [m.mesh] })),
  { center: riverCentre, meshes: [...environment.river, mirror.mesh] }, // the mirror sheet draws over the gauze
];
function sortTransparent() {
  riverCentre.set(THREE.MathUtils.clamp(camera.position.x, -200, 200), -.2, THREE.MathUtils.clamp(camera.position.z, RIVER.far, RIVER.near));
  sortables
    .map(item => ({ item, d: item.center.distanceToSquared(camera.position) }))
    .sort((a, b) => b.d - a.d)
    .forEach(({ item }, rank) => item.meshes.forEach((mesh, i) => { mesh.renderOrder = 10 + rank * 10 + i; }));
}
applyRecipe(recipe.choice);

// Soft ink blots under every tree and house (the banks take no shadow maps), so nothing hovers.
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(.55, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const blots = [
    ...plants.filter(p => p.kind !== 'strip').map(p => ({ x: p.x, z: p.z, r: p.scale * (p.kind === 'willow' ? 1.9 : 1.6), y: p.y + .1 })),
    ...[...HOUSE_SITES, ...DECOR_SITES].map(h => ({ x: h.x, z: h.z, r: h.scale * .62, y: heightAt(h.x, h.z) })),
  ];
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x0b1a16, alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: .3,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), blots.length);
  const m = new THREE.Matrix4();
  blots.forEach((b, i) => mesh.setMatrixAt(i, m.makeScale(b.r, 1, b.r).setPosition(b.x, b.y + .06, b.z)));
  mesh.renderOrder = 3;
  scene.add(mesh);
})();

function createTraveller() {
  const group = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(.46,1.35,7), mats.robe);
  robe.rotation.x = Math.PI;
  robe.position.y = .8;
  robe.castShadow = true;
  group.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28,12,8), mats.face);
  head.position.y = 1.57;
  head.castShadow = true;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(.49,.38,10), mats.ink);
  hat.position.y = 1.9;
  hat.castShadow = true;
  group.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.055,12), mats.ink);
  brim.position.y = 1.72;
  group.add(brim);
  // A readable front (playtest 2): eyes and toes face the walking direction (-z),
  // a travelling pack sits on the back.
  for (const x of [-.1, .1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), mats.ink);
    eye.position.set(x, 1.6, -.25);
    group.add(eye);
  }
  const pack = box(.42, .46, .2, mats.cargo, 0, 1.12, .36, group);
  pack.rotation.x = -.12;
  const feet = [];
  for (const x of [-.21,.21]) {
    const foot = box(.16,.42,.3,mats.ink,x,.16,-.06,group);
    feet.push(foot);
  }
  group.userData.feet = feet;
  group.position.set(START.x, heightAt(START.x, START.z) + .16, START.z);
  scene.add(group);
  return group;
}
const traveller = createTraveller();

// Models ship as base64 GLB text plus a JPEG colour map: the artifact host serves only
// common web types and may block data:/blob: loads, so nothing here relies on them.
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
// Tripo's built forms (bridge, houses, pavilions, boat, interiors) come with bright orange,
// photo-like wood. Painted into the scroll instead: muted toward grey-ochre, and an ink line
// darkens every silhouette edge, as the bridge and roofs are outlined in the painting.
const PAINTED = /^(bridge|house_|halfway_pavilion|riverboat|hall_vignette|loom_vignette|boat_|mooring_post|cargo_sacks|water_mill)/;
function paintIntoScroll(material, keep = .5, tint = [.9, .87, .8]) { // keep: share of the original saturation
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.3, .59, .11))), diffuseColor.rgb, ${keep.toFixed(2)}) * vec3(${tint.map(v => v.toFixed(2)).join(', ')});`)
      .replace('#include <opaque_fragment>', `float inkRim = 1. - smoothstep(.08, .38, abs(dot(normalize(normal), normalize(vViewPosition))));
        outgoingLight = mix(outgoingLight, vec3(.08, .075, .06), inkRim * .6);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `paintedIntoScroll${keep}${tint}`;
}
async function loadModelParts(name) {
  const response = await fetch(`./assets/models/${name}.glb.txt?v=119`); // ?v: published updates bypass cached copies
  if (!response.ok) throw new Error(`${name}.glb.txt ${response.status}`);
  const bytes = Uint8Array.from(atob((await response.text()).trim()), c => c.charCodeAt(0));
  const gltf = await gltfLoader.parseAsync(bytes.buffer, './assets/models/');
  const map = await textureLoader.loadAsync(`./assets/models/${name}_basecolor.jpg?v=119`);
  map.flipY = false; // glTF UV convention
  map.colorSpace = THREE.SRGBColorSpace;
  gltf.scene.traverse(part => {
    if (!part.isMesh) return;
    part.material.map = map;
    if (PAINTED.test(name)) paintIntoScroll(part.material, ...(/^(house_|hall_|loom_)/.test(name) ? [.25, [.86, .8, .7]] : [.5])); // houses: yellow walls toned to the bridge's grey-tan wood
    // The figures get the same ink outline, with most of their colour kept, so they belong to the painting.
    else if (/^(traveller|boatperson|wangximeng)/.test(name)) paintIntoScroll(part.material, .72, [.97, .95, .9]);
    part.material.needsUpdate = true;
  });
  return gltf;
}
function loadModel(name, onLoad, label) {
  loadModelParts(name).then(onLoad).catch(error => {
    console.warn(`${name} model failed to load; keeping the simple figure`, error);
    say(`${label}模型未能加载（${error.message || error}），先用简易造型。`, 6000);
  });
}

// v0.8: the Tripo + Mixamo traveller replaces the primitive figure once loaded; the
// group stays the logical body (position, heading), so collision and framing are unchanged.
const travellerRig = { mixer: null, walk: null, idle: null, current: null };
loadModel('traveller', gltf => {
  const model = gltf.scene;
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(2.1 / size.y);
  model.rotation.y = Math.PI; // the model faces +z; the traveller walks toward its local -z
  model.position.y = -.16;
  model.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.frustumCulled = false; // skinned bounds do not follow the animation
    part.material.roughness = 1;
    part.material.metalness = 0;
  });
  traveller.children.forEach(child => { child.visible = false; });
  traveller.add(model);
  travellerRig.mixer = new THREE.AnimationMixer(model);
  for (const clip of gltf.animations) travellerRig[clip.name] = travellerRig.mixer.clipAction(clip);
  playTravellerClip('idle');
}, '行者');

function playTravellerClip(name, timeScale = 1) {
  const next = travellerRig[name];
  if (!next) return;
  next.timeScale = timeScale;
  if (travellerRig.current === next) return;
  next.reset().play();
  if (travellerRig.current) travellerRig.current.crossFadeTo(next, .25, false);
  travellerRig.current = next;
}
// The shader banks take no shadow maps, so the traveller carries a soft ink blot underfoot.
const footShadow = new THREE.Mesh(new THREE.CircleGeometry(.62, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x0b1a16, transparent: true, opacity: .28, depthWrite: false }));
scene.add(footShadow);

// The boat landing (script v0.2): the boat comes in on its own schedule, the
// boatperson keeps working, and the player may — or may not — tie the line.
const boatCourse = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-42, 0, -1.8), new THREE.Vector3(-30, 0, -1.2),
  new THREE.Vector3(-18, 0, .5), new THREE.Vector3(-10, 0, 2.7), BOAT_DOCK.clone(),
]);

function createBoat() {
  const boat = new THREE.Group();
  const hullParts = [
    box(4.4, .42, 1.25, mats.hull, 0, .1, 0, boat),
    box(.55, .32, 1.0, mats.hull, 2.25, .32, 0, boat),
    box(.55, .32, 1.0, mats.hull, -2.25, .32, 0, boat),
  ];
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, 1.5, 10, 1, true, 0, Math.PI), mats.roof);
  canopy.rotation.z = Math.PI / 2; // arch over the deck
  canopy.position.set(-1.1, .32, 0);
  boat.add(canopy);
  hullParts.push(canopy);
  // The rope coil glows while the boat waits, so the boat reads as something to do, not scenery.
  const coil = new THREE.Mesh(new THREE.TorusGeometry(.26, .08, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 1, emissive: 0xffc860, emissiveIntensity: 0 }));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(1.75, .38, .25);
  boat.add(coil);
  scene.add(boat);

  const person = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(.36, 1.15, 7), mats.boatman);
  robe.rotation.x = Math.PI;
  robe.position.y = .62;
  person.add(robe);
  const body = new THREE.Group();
  body.position.y = .62;
  person.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.23, 10, 8), mats.face);
  head.position.y = .7;
  body.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(.5, .22, 12), mats.straw);
  hat.position.y = .95;
  body.add(hat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 4.2, 6), mats.trunk);
  pole.position.set(.25, .2, .3);
  pole.rotation.z = .45;
  body.add(pole);
  const bundle = box(.5, .35, .4, mats.cargo, .35, .25, 0, body);
  bundle.visible = false;
  person.traverse(part => { part.castShadow = true; });
  scene.add(person);

  // A thin tube rather than a 1px line, so the rope reads from across the river.
  const rope = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x4f3c2a, roughness: 1 }));
  rope.frustumCulled = false;
  scene.add(rope);

  const pile = [];
  for (let i = 0; i < 4; i++) {
    const crate = box(.5, .35, .4, mats.cargo, -6.6 + (i % 2) * .6, .18 + Math.floor(i / 2) * .36, 6.4 + (i % 2) * .1);
    crate.visible = false;
    pile.push(crate);
  }
  const postRing = new THREE.Mesh(new THREE.RingGeometry(.55, .8, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf5d27a, transparent: true, opacity: 0, depthWrite: false }));
  postRing.position.set(MOORING_POST.x, heightAt(MOORING_POST.x, MOORING_POST.z) + .07, MOORING_POST.z);
  scene.add(postRing);
  return { boat, hullParts, coil, person, body, robe, head, hat, pole, bundle, rope, pile, postRing };
}
const landing = createBoat();
// v0.8: Tripo + Mixamo boatperson. Clips: pole (sailing), idle (waiting), walk (borrowed
// from the traveller: both are standard Mixamo skeletons, so the clip binds by bone name).
const boatRig = { mixer: null, current: null, hand: null };
loadModel('boatperson', gltf => {
  const model = gltf.scene;
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(2.0 / size.y);
  model.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.frustumCulled = false;
    part.material.roughness = 1;
    part.material.metalness = 0;
  });
  [landing.robe, landing.head, landing.hat].forEach(part => { part.visible = false; });
  landing.person.add(model);
  landing.bundle.position.set(0, .62, .42); // carried in front of the chest
  boatRig.hand = model.getObjectByName('mixamorigRightHand');
  if (boatRig.hand) scene.attach(landing.pole); // the pole now follows the hand in world space
  boatRig.mixer = new THREE.AnimationMixer(model);
  for (const clip of gltf.animations) boatRig[clip.name] = boatRig.mixer.clipAction(clip);
}, '舟人');

function playBoatClip(name, timeScale = 1) {
  const next = boatRig[name];
  if (!next) return;
  next.timeScale = timeScale;
  if (boatRig.current === next) return;
  next.reset().play();
  if (boatRig.current) boatRig.current.crossFadeTo(next, .3, false);
  boatRig.current = next;
}

const poleScratch = { hand: new THREE.Vector3(), tip: new THREE.Vector3(), dir: new THREE.Vector3(), forward: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
// The pole runs from the water ahead of the boatperson up through the right hand.
function placePole() {
  if (!boatRig.hand || !landing.pole.visible) return;
  const { hand, tip, dir, forward, up } = poleScratch;
  boatRig.hand.getWorldPosition(hand);
  forward.set(0, 0, 1).applyQuaternion(landing.person.quaternion);
  tip.copy(landing.person.position).addScaledVector(forward, 1.4);
  tip.y = -.7;
  dir.subVectors(hand, tip).normalize();
  landing.pole.quaternion.setFromUnitVectors(up, dir);
  landing.pole.position.copy(tip).addScaledVector(dir, 2.1);
}

const boatState = { phase: 'sailing', progress: 0, arrivedAt: 0, ropeHeld: false, tiedBy: null, asked: false, walk: 0, walkFrom: new THREE.Vector3(), walkTo: new THREE.Vector3(), work: 0, unloaded: 0 };

resetLanding();

// Playtests 1–2 reached the bridge at ~0:17 while the boat docked at 0:19 and self-tied at
// once, so nobody met the landing: it now docks by ~0:16 and waits longer.
const BOAT_BASE_SECONDS = 16;
const SELF_TIE_AFTER = 40;

// The long bridge with its pavilion: scaled to 30 units along z, piles on the riverbed.
loadModel('bridge', gltf => {
  const model = gltf.scene;
  const scale = BRIDGE_SCALE;
  model.scale.set(BRIDGE_LENGTH_SCALE, scale, scale);
  model.rotation.y = -Math.PI / 2; // model +x -> world +z
  // Model deck: 0.048 at the ends, 0.095 in the hall, eaves from ~0.135 (model units).
  const baseY = .12 - .048 * scale; // ends sit level with the banks; piles run into the riverbed
  // The Tripo deck is off the model's centre line (measured: centred 2.1 east of it), so the model
  // shifts west and the walkway sits on BRIDGE.x, where the lane and the walking clamp expect it.
  model.position.set(BRIDGE.x - 2.1, baseY, BRIDGE.z);
  model.traverse(part => {
    if (!part.isMesh) return;
    part.material.roughness = 1;
    part.material.metalness = 0;
    part.material.side = THREE.DoubleSide;
  });
  scene.add(model);
  model.updateMatrixWorld(true);
  bridgeParts.forEach(part => { part.visible = false; });
  bridgeParts.length = 0;
  bridgeParts.push(model);
  // Deck height table along the centre line, sampled below the roofs.
  const ray = new THREE.Raycaster();
  const deck = [];
  for (let i = 0; i <= 240; i++) {
    const z = BRIDGE.z - BRIDGE.half + i * (2 * BRIDGE.half) / 240;
    ray.set(new THREE.Vector3(BRIDGE.x, baseY + .118 * scale, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(model, true)[0];
    deck.push(hit ? hit.point.y : 0);
  }
  BRIDGE.deck = deck;
  const steps = [], x1 = BRIDGE.x - BRIDGE.halfWidth;
  for (let i = 0; i <= 60; i++) {
    ray.set(new THREE.Vector3(SIDE_STAIR.x0 + i * (x1 - SIDE_STAIR.x0) / 60, baseY + .118 * scale, SIDE_STAIR.z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(model, true)[0];
    steps.push(hit ? hit.point.y : deckHeight(SIDE_STAIR.z));
  }
  SIDE_STAIR.steps = steps;
}, '长桥');

// Far-bank houses. Mesh raycasts against ~50k triangles are too slow per frame, so each
// house is also copied into world-space chunks (2 units square) and a ray only tests the
// chunks whose boxes it reaches.
const houses = []; // { site, box, reach, chunks: [{ box, mesh }] }
const houseRay = new THREE.Raycaster();
const rayEntry = new THREE.Vector3();
const collisionSide = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function collisionChunks(model) {
  const cells = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse(part => {
    if (!part.isMesh) return;
    const position = part.geometry.attributes.position, index = part.geometry.index;
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const at = k => index ? index.getX(i + k) : i + k;
      a.fromBufferAttribute(position, at(0)).applyMatrix4(part.matrixWorld);
      b.fromBufferAttribute(position, at(1)).applyMatrix4(part.matrixWorld);
      c.fromBufferAttribute(position, at(2)).applyMatrix4(part.matrixWorld);
      const key = `${Math.floor((a.x + b.x + c.x) / 6)},${Math.floor((a.z + b.z + c.z) / 6)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  });
  return [...cells.values()].map(triangles => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { box: geometry.boundingBox, mesh: new THREE.Mesh(geometry, collisionSide) };
  });
}
function houseHits(origin, direction, far) {
  houseRay.set(origin, direction);
  houseRay.far = far;
  const hits = [];
  // (intersectBox returns the exit point when the ray starts inside, hence containsPoint.)
  const reaches = box => box.containsPoint(origin)
    || (houseRay.ray.intersectBox(box, rayEntry) && rayEntry.distanceTo(origin) <= far);
  for (const house of houses) {
    if (!reaches(house.box)) continue;
    for (const chunk of house.chunks) if (reaches(chunk.box)) chunk.mesh.raycast(houseRay, hits);
  }
  return hits.sort((p, q) => p.distance - q.distance);
}

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const stepProbe = new THREE.Vector3(), stepDirection = new THREE.Vector3();
// Where the traveller would stand at (x, z) among the houses: a floor height inside one,
// null on open ground, or false when a wall, post or low beam is in the way.
function houseStep(x, z) {
  const p = traveller.position;
  const feet = groundUnder(p);
  // Furnishings sit inside a house's box too; the house itself (with its hint) names the place.
  const around = houses.filter(h => h.reach.containsPoint(stepProbe.set(x, feet + 1, z)));
  const house = around.find(h => h.site.hint) ?? around[0];
  if (!house) return null;
  // The summit pavilion (Xingyi): its steps rise from a slope, so the first riser is at knee
  // height; its benches are lower than the knee probe. Steps (≤ .3) are climbed, benches block.
  const strict = house.site.label === '山顶亭';
  const rise = strict ? .3 : .5;
  const floor = houseHits(stepProbe.set(x, feet + 1, z), DOWN, 1.8).find(hit => hit.point.y <= feet + rise);
  const ground = heightAt(x, z);
  const stand = floor?.point.y > ground ? floor.point.y : null;
  stepDirection.set(x - p.x, 0, z - p.z);
  const distance = stepDirection.length();
  if (distance > 1e-5) {
    stepDirection.divideScalar(distance);
    for (const knee of [.6, 1.45]) {
      if (!houseHits(stepProbe.set(p.x, feet + knee, p.z), stepDirection, distance + .3).length) continue;
      if (strict && knee < 1 && (stand ?? ground) > feet + .02) continue; // a riser being climbed, not a rail
      return false;
    }
  }
  if (strict && houseHits(stepProbe.set(x, feet + 1.3, z), DOWN, 1.3).some(hit => hit.point.y > (stand ?? ground) + .32)) return false; // bench seat, rail (a next step is lower)
  if (houseHits(stepProbe.set(x, (stand ?? ground) + .6, z), UP, 1.5).length) return false;
  state.house = stand != null ? house.site : null;
  return stand;
}

// v0.9 Tripo half-way pavilion: open on two sides (they face the path legs, +x and +z),
// benches and low rails on the other two; the 题壁 wall hangs above the back bench.
// Model deck 0.06, eaves 0.48 (model units) → scale 6.4 leaves ~2.7 of headroom.
loadModel('halfway_pavilion', gltf => {
  const model = gltf.scene;
  model.scale.setScalar(6.4);
  model.rotation.y = Math.PI / 2; // model +z (open) → world +x; model -x (open) → world +z
  const spot = PEAK_SPOTS.pavilion;
  model.position.set(spot.x, heightAt(spot.x, spot.z) - .05, spot.z);
  model.traverse(part => {
    if (!part.isMesh) return;
    part.material.roughness = 1;
    part.material.metalness = 0;
    part.material.side = THREE.DoubleSide;
    part.castShadow = part.receiveShadow = true;
  });
  scene.add(model);
  model.updateMatrixWorld(true);
  // Keep only the stand-in's wall, moved between the back posts above the bench.
  halfwayPavilion.children.forEach(child => { child.visible = child.name === 'inscription-wall'; });
  const wall = halfwayPavilion.getObjectByName('inscription-wall');
  wall.position.set(-2.1, 2.05, 0);
  const box = new THREE.Box3().setFromObject(model);
  const faded = fadeable(model);
  faded.box = box;
  occluders.push(faded);
  houses.push({ site: { label: '半山亭' }, box, reach: box.clone().expandByScalar(.6), chunks: collisionChunks(model) });

  // A few more on the islands of the open water, as the painting dots pavilions along its shores.
  let islandPavilions = 0;
  for (let i = 0; i < 400 && islandPavilions < 4; i++) {
    const a = i * 2.39996, r = 70 + (i * 13 % 70);
    const x = Math.cos(a) * r * 1.3, z = -20 + Math.sin(a) * r * .8;
    if (Math.abs(x) < 62 || visibleGround(x, z) < .9) continue;
    const copy = model.clone();
    copy.scale.setScalar(5);
    copy.rotation.y = a;
    copy.position.set(x, visibleGround(x, z) - .1, z);
    scene.add(copy);
    islandPavilions++;
  }

}, '半山亭');

// v0.9 summit set (Xingyi's Tripo models): the summit pavilion on its stone base, steps toward
// the path (west); inside, the painter at his desk. Rocks frame the terrace's west edge.
loadModel('summit_pavilion', gltf => {
  const summit = gltf.scene;
  summit.rotation.y = Math.atan2(SUMMIT_FACING.x, SUMMIT_FACING.z) + Math.PI; // steps (model +x) to the west
  summit.position.set(SUMMIT_PAVILION.x, heightAt(SUMMIT_PAVILION.x, SUMMIT_PAVILION.z) - .05, SUMMIT_PAVILION.z);
  scene.add(summit);
  summit.updateMatrixWorld(true);
  const summitBox = new THREE.Box3().setFromObject(summit);
  // Not a fading occluder (Xingyi: it flickered in and out by angle); it stays solid.
  houses.push({ site: { label: '山顶亭' }, box: summitBox, reach: summitBox.clone().expandByScalar(.6), chunks: collisionChunks(summit) });
  // The deck height under the painter, measured on the model, lifts him, his seat and his desk.
  // Probe from just above the base (below the roof beams) straight down onto the deck.
  const hit = new THREE.Raycaster(new THREE.Vector3(PAINTER.at.x, summitBox.min.y + 3, PAINTER.at.z), new THREE.Vector3(0, -1, 0)).intersectObject(summit, true)[0];
  if (hit) setPainterDeck(hit.point.y);
}, '山顶亭');

// ---------- 山顶：画者与他的画（王希孟入画为艺术想象） ----------
// He sits on the crest facing the bridge, never turning round. In front of him lies the
// painting itself (Wikimedia public-domain image), with an unpainted corner and a tiny ink
// figure that follows the player's own position through the painting.
// He sits inside the summit pavilion, facing the bridge like the viewpoint in front of him,
// so the player at the viewpoint has him behind, never in the frame.
const PAINTER = { at: SUMMIT_PAVILION.clone().addScaledVector(SUMMIT_FACING, -.7), facing: SUMMIT_FACING.clone(), model: null, rig: null, met: false, returned: false };
PAINTER.at.y = heightAt(PAINTER.at.x, PAINTER.at.z) + .33; // on the pavilion deck
const PAINT_CROP = { x0: 1890, width: 2310, height: 896 }; // source pixels: the bridge and the peaks to its left
// Game route → painting position (display coordinates of the 2000-wide reference), by eye.
const PAINT_ROUTE = [
  [[-14, 28], [1935, 330]], [[8, 7.1], [1760, 352]], [[8, -16], [1648, 346]], [[8, -38.5], [1566, 357]],
  [[-.9, -42.2], [1488, 330]], [[-7, -50], [1440, 310]], [[-9, -57.5], [1330, 290]], [[-24, -66], [1240, 240]],
  [[-14, -71], [1190, 200]], [[-24, -77], [1140, 160]], [[-17, -84], [1092, 104]],
];
const deskThings = new THREE.Group(); // the returned dish and brush, on his desk (added to the stand later)
const paintCanvas = document.createElement('canvas');
paintCanvas.width = 2048;
paintCanvas.height = Math.round(2048 * PAINT_CROP.height / PAINT_CROP.width);
const paintTexture = new THREE.CanvasTexture(paintCanvas);
paintTexture.colorSpace = THREE.SRGBColorSpace;
const paintSource = new Image();
paintSource.src = './assets/qianli-bridge-commons-v0-4.jpg';
const paintState = { lastDraw: 0, corner: null };
const toCanvas = ([dx, dy]) => [(dx * 2.1 - PAINT_CROP.x0) * paintCanvas.width / PAINT_CROP.width, dy * 2.1 * paintCanvas.height / PAINT_CROP.height];
// Where (x, z) falls in the painting, in display coordinates of the 2000-wide reference.
function paintedDisplay(x, z) {
  let best = Infinity, out = PAINT_ROUTE[0][1];
  for (let i = 1; i < PAINT_ROUTE.length; i++) {
    const [[ax, az], pa] = PAINT_ROUTE[i - 1], [[bx, bz], pb] = PAINT_ROUTE[i];
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; out = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]; }
  }
  return out;
}
const paintedPosition = (x, z) => toCanvas(paintedDisplay(x, z));
const CORNER = { w: 430, h: 300 }; // the unpainted corner (top left of the crop)
function drawPainting() {
  if (!paintSource.complete || !paintSource.naturalWidth) return;
  const ctx = paintCanvas.getContext('2d');
  const W = paintCanvas.width, H = paintCanvas.height;
  ctx.drawImage(paintSource, PAINT_CROP.x0, 0, PAINT_CROP.width, PAINT_CROP.height, 0, 0, W, H);
  // The corner he has left blank: bare silk, until the player's summit view fills it.
  const g = ctx.createRadialGradient(CORNER.w * .45, CORNER.h * .4, 20, CORNER.w * .45, CORNER.h * .4, CORNER.w * .75);
  g.addColorStop(0, 'rgba(228,214,178,1)');
  g.addColorStop(.75, 'rgba(228,214,178,.92)');
  g.addColorStop(1, 'rgba(228,214,178,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CORNER.w * 1.1, CORNER.h * 1.1);
  if (paintState.corner) {
    ctx.save();
    ctx.globalAlpha = .82;
    ctx.filter = 'sepia(.35) saturate(.8)';
    ctx.drawImage(paintState.corner, 22, 18, CORNER.w - 44, CORNER.h - 36);
    ctx.restore();
  }
  // The traveller, a few strokes of ink, wherever the player now stands.
  const [px, py] = paintedPosition(traveller.position.x, traveller.position.z);
  ctx.fillStyle = '#17150f';
  ctx.beginPath(); ctx.ellipse(px, py - 15, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); // hat
  ctx.beginPath(); ctx.arc(px, py - 12, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py); ctx.lineTo(px + 1.5, py - 10); ctx.lineTo(px - 1.5, py - 10); ctx.closePath(); ctx.fill();
  paintTexture.needsUpdate = true;
}
paintSource.addEventListener('load', drawPainting);

// The live painting: a camera at the summit viewpoint renders the view he paints into a small
// target, a few times a second while the player is near (see animate).
const livePainting = (() => {
  const target = new THREE.WebGLRenderTarget(1024, 440);
  const cam = new THREE.PerspectiveCamera(46, 1024 / 440, .5, 900);
  const eye = new THREE.Vector3(SUMMIT_TERRACE.x, 0, SUMMIT_TERRACE.z).addScaledVector(SUMMIT_FACING, 4);
  eye.y = heightAt(SUMMIT_TERRACE.x, SUMMIT_TERRACE.z) + 3;
  cam.position.copy(eye);
  cam.lookAt(eye.clone().addScaledVector(SUMMIT_FACING, 60).add(new THREE.Vector3(0, -16, 0)));
  return { target, cam, blank: { value: 1 }, last: 0 };
})();
function updateLivePainting(now) {
  livePainting.blank.value = shots.peak ? 0 : 1;
  if (now - livePainting.last < 350 || flat(traveller.position, PAINTER.at) > 32) return;
  livePainting.last = now;
  const shown = mirror.mesh.visible;
  mirror.mesh.visible = false; // its reflection is mapped for the main camera
  sky.position.copy(livePainting.cam.position);
  renderer.setRenderTarget(livePainting.target);
  renderer.render(scene, livePainting.cam);
  renderer.setRenderTarget(null);
  mirror.mesh.visible = shown;
  sky.position.copy(camera.position);
}
// The painting lies on his desk in front of him, tipped toward him (and the player behind him).
const paintingStand = new THREE.Group();
{
  const along = PAINTER.facing.clone().multiplyScalar(1.25); // the desk just in front of him
  paintingStand.position.set(PAINTER.at.x + along.x, PAINTER.at.y, PAINTER.at.z + along.z);
  paintingStand.rotation.y = Math.atan2(PAINTER.facing.x, PAINTER.facing.z);
  // v0.9 (Xingyi: not the original pasted on): the scroll shows what he is painting — the
  // landscape before him, rendered live from the summit and laid onto silk; the corner he has
  // left blank fills only when the player keeps the summit view.
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9 * 440 / 1024), new THREE.ShaderMaterial({
    uniforms: { tLive: { value: livePainting.target.texture }, uBlank: livePainting.blank },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tLive; uniform float uBlank; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tLive, vUv).rgb;
        c = mix(vec3(dot(c, vec3(.3, .59, .11))), c, .85) * vec3(1.02, .98, .9);
        vec3 silk = vec3(.74, .64, .45);
        float edge = smoothstep(0., .06, vUv.x) * smoothstep(1., .94, vUv.x) * smoothstep(0., .1, vUv.y) * smoothstep(1., .9, vUv.y);
        float corner = uBlank * (1. - smoothstep(.22, .34, vUv.x)) * smoothstep(.5, .66, vUv.y);
        c = mix(silk, c, .84 * edge * (1. - corner));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  paintingStand.add(deskThings);
  sheet.position.set(0, .98, .05);
  sheet.rotation.x = -Math.PI / 2 - .22; // laid on the desk, tipped a little toward him
  sheet.rotation.z = Math.PI;
  paintingStand.add(sheet);
  scene.add(paintingStand);
  loadModel('painter_desk', gltf => {
    const desk = gltf.scene;
    desk.scale.setScalar(2.4 / 2.8); // the Tripo set is 2.8 long; 2.4 sits inside the pavilion
    desk.position.set(0, 0, 0);
    paintingStand.add(desk);
  }, '画案');
}
// The desk, his stool and he himself are solid: the traveller walks round them, not through.
function painterBlocks(x, z) {
  const dx = x - paintingStand.position.x, dz = z - paintingStand.position.z, r = paintingStand.rotation.y; // world → desk-local
  const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
  if (Math.abs(lx) < 1.35 && Math.abs(lz) < 1.15) return true;
  return Math.hypot(x - PAINTER.at.x, z - PAINTER.at.z) < .7;
}
// Raise the painter, his seat, desk and returned things onto the pavilion deck once it is measured.
function setPainterDeck(y) {
  const dy = y - PAINTER.at.y;
  PAINTER.at.y = y;
  for (const o of [paintingStand, painterSeat, returnedThings]) o.position.y += dy;
  if (PAINTER.model) PAINTER.model.position.y += dy;
}
// The Mixamo seated clip sits on a stool (hips 0.63 m up, body ~0.45 m forward of the root),
// so he gets a low stone seat; it stays when he walks into the painting.
const painterSeat = box(.62, .62, .5, new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: .9 }), 0, 0, 0); // a dark wooden stool, like his desk
painterSeat.position.set(PAINTER.at.x + PAINTER.facing.x * .22, PAINTER.at.y + .31, PAINTER.at.z + PAINTER.facing.z * .22);
painterSeat.rotation.y = Math.atan2(PAINTER.facing.x, PAINTER.facing.z);
const returnedThings = new THREE.Group(); // (kept empty; the returned things now lie on the desk)
returnedThings.visible = false;
scene.add(returnedThings);

// Until the Mixamo clips arrive the model is static; with clips it sits, then walks away.
// Mixamo's auto-skin split the long robe between the two legs, so it tore open down the back
// whenever they parted (playtest 11/10). Robe vertices (outside the trouser legs, hip to hem,
// measured in bind pose: legs at x ±0.125, trousers within ~0.1 of them, hem at ~0.3) follow
// the hips plus an even share of both thighs instead, so the cloth hangs as one skirt.
function stiffenRobe(mesh) {
  const bones = mesh.skeleton.bones, at = name => bones.findIndex(b => b.name === `mixamorig${name}`);
  const hips = at('Hips'), lUp = at('LeftUpLeg'), rUp = at('RightUpLeg');
  const legs = new Set(['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'].map(at));
  if (hips < 0 || lUp < 0 || rUp < 0) return;
  const pos = mesh.geometry.attributes.position, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    if (y < .22 || y > 1) continue;
    const d = Math.min(Math.hypot(x - .125, z), Math.hypot(x + .125, z));
    const f = THREE.MathUtils.smoothstep(d, .1, .135) * THREE.MathUtils.smoothstep(y, .22, .3);
    if (!f) continue;
    const w = new Map();
    let legW = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(v, k), wt = sw.getComponent(v, k);
      if (!wt) continue;
      if (legs.has(b)) { legW += wt * f; w.set(b, (w.get(b) || 0) + wt * (1 - f)); }
      else w.set(b, (w.get(b) || 0) + wt);
    }
    w.set(hips, (w.get(hips) || 0) + legW * .4);
    w.set(lUp, (w.get(lUp) || 0) + legW * .3);
    w.set(rUp, (w.get(rUp) || 0) + legW * .3);
    const top = [...w].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((t, [, wt]) => t + wt, 0) || 1;
    for (let k = 0; k < 4; k++) {
      si.setComponent(v, k, top[k]?.[0] ?? 0);
      sw.setComponent(v, k, (top[k]?.[1] ?? 0) / sum);
    }
  }
  si.needsUpdate = sw.needsUpdate = true;
}
loadModel('wangximeng', gltf => {
  const model = gltf.scene;
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(2.0 / size.y);
  model.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.frustumCulled = false;
    part.material.roughness = 1;
    part.material.metalness = 0;
    // Auto-skinning folds the long robe through itself where the legs bend; drawing both
    // sides shows cloth there instead of dark holes.
    part.material.side = THREE.DoubleSide;
    if (part.isSkinnedMesh) stiffenRobe(part);
  });
  const holder = new THREE.Group();
  holder.add(model);
  holder.position.copy(PAINTER.at);
  holder.rotation.y = Math.atan2(PAINTER.facing.x, PAINTER.facing.z);
  scene.add(holder);
  PAINTER.model = holder;
  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(model);
    PAINTER.rig = { mixer, current: null };
    for (const clip of gltf.animations) PAINTER.rig[clip.name] = mixer.clipAction(clip);
    playPainterClip('sit');
  }
}, '画者');
function playPainterClip(name) {
  const rig = PAINTER.rig, next = rig?.[name];
  if (!next || rig.current === next) return;
  if (name === 'standup') { // once, a little brisker, holding the last (standing) pose
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.timeScale = 1.5;
  }
  next.reset().play();
  if (rig.current) rig.current.crossFadeTo(next, .8, false);
  rig.current = next;
}

// Furnishings (Xingyi's Tripo groups): the hall's table, screen, chairs and reading elder face
// the door; the loom and household jars stand to one side of the long house's corridor.
// Floors: hall 0.24 above its terrace, long house deck at 2.47 (measured with the floor rays).
// Xingyi 11/4: the reading elder's group now furnishes the long house too (the walk-in house),
// further along its corridor from the loom.
for (const [name, x, z, rotation, floorY, scale] of [
  ['hall_vignette', 15.05, -46.4, Math.PI / 2, 2.47, .78],
  ['loom_vignette', 15.75, -41.5, Math.PI / 2, 2.47, 1],
]) loadModel(name, gltf => {
  const model = gltf.scene;
  model.scale.multiplyScalar(scale);
  model.rotation.y = rotation;
  model.position.set(x, floorY, z);
  model.traverse(part => {
    if (!part.isMesh) return;
    part.material.roughness = 1;
    part.material.metalness = 0;
    part.material.side = THREE.DoubleSide;
  });
  scene.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  houses.push({ site: { label: '' }, box, reach: box.clone().expandByScalar(.6), chunks: collisionChunks(model) });
}, '屋内陈设');

const houseNames = [...new Set(HOUSE_SITES.map(site => site.name))];
for (const name of houseNames) loadModel(name, gltf => {
  for (const site of DECOR_SITES.filter(d => d.name === name)) {
    const model = gltf.scene.clone();
    model.scale.setScalar(site.scale);
    model.rotation.y = site.rotation;
    model.position.set(site.x, heightAt(site.x, site.z) - .15, site.z);
    scene.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const faded = fadeable(model);
    faded.box = box;
    occluders.push(faded);
    houses.push({ site: { label: '' }, box, reach: box.clone().expandByScalar(.6), chunks: collisionChunks(model) });
  }
  HOUSE_SITES.filter(site => site.name === name).forEach((site, i) => {
    const model = i ? gltf.scene.clone() : gltf.scene;
    model.scale.setScalar(site.scale);
    model.rotation.y = site.rotation;
    model.position.set(site.x, site.baseY ?? heightAt(site.x, site.z), site.z);
    model.traverse(part => {
      if (!part.isMesh) return;
      part.material.roughness = 1;
      part.material.metalness = 0;
      part.material.side = THREE.DoubleSide;
      part.castShadow = part.receiveShadow = true;
    });
    scene.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const faded = fadeable(model);
    faded.box = box;
    occluders.push(faded);
    houses.push({ site, box, reach: box.clone().expandByScalar(.6), chunks: collisionChunks(model) });
  });
}, HOUSE_SITES.find(site => site.name === name).label);

// Anchor points in boat space; replaced when the Tripo boat loads (bow at +x).
const BOAT_POINTS = { bow: new THREE.Vector3(1.9, .45, .3), stand: new THREE.Vector3(.7, .18, 0) };
function bowPoint(target = new THREE.Vector3()) {
  return target.copy(BOAT_POINTS.bow).applyMatrix4(landing.boat.matrixWorld);
}

function deckStand(target = new THREE.Vector3()) {
  return target.copy(BOAT_POINTS.stand).applyMatrix4(landing.boat.matrixWorld);
}

// v0.8: Tripo river boat (8 units long, canopy amidships, open decks fore and aft,
// deck ~0.7 above the keel). It sits 0.35 deep so the gauze river reaches its sides.
loadModel('riverboat', gltf => {
  const model = gltf.scene;
  model.position.y = -.35;
  model.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.material.roughness = 1;
    part.material.metalness = 0;
  });
  landing.hullParts.forEach(part => { part.visible = false; });
  landing.boat.add(model);
  BOAT_POINTS.bow.set(3.55, .55, .3);
  BOAT_POINTS.stand.set(2.55, .36, 0);
  landing.coil.position.set(3.05, .42, .2);
}, '船');

// ---------- 第二批 Tripo 模型：系缆木桩、货包、江上远舟 ----------
function fitModel(model, size, axis = 'y') { // scale so the bounding box's <axis> side equals size, base on y = 0, centred
  const box = new THREE.Box3().setFromObject(model), dims = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(size / dims[axis]);
  const fitted = new THREE.Box3().setFromObject(model), centre = fitted.getCenter(new THREE.Vector3());
  model.position.x -= centre.x; model.position.z -= centre.z; model.position.y -= fitted.min.y;
  model.traverse(part => { if (part.isMesh) { part.castShadow = true; part.material.roughness = 1; part.material.metalness = 0; } });
  return model;
}

loadModel('mooring_post', gltf => {
  const model = fitModel(gltf.scene, 1.2);
  const holder = new THREE.Group();
  holder.add(model);
  holder.position.set(MOORING_POST.x, 0, MOORING_POST.z);
  scene.add(holder);
  for (const name of ['simplePost', 'simplePostCap']) { const old = scene.getObjectByName(name); if (old) old.visible = false; }
}, '木桩');

// Each cargo box keeps its logic (visible / carried / delivered); only its look is swapped.
function dressBox(mesh, template) {
  const { width, height, depth } = mesh.geometry.parameters;
  [...mesh.children].forEach(child => mesh.remove(child));
  mesh.material = new THREE.MeshBasicMaterial({ visible: false });
  const look = fitModel(template.clone(true), Math.max(width, depth) * 1.15, 'x');
  look.position.y -= height / 2;
  mesh.add(look);
}
loadModel('cargo_sacks', gltf => {
  const template = gltf.scene;
  const xz = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
  if (xz.z > xz.x) template.rotation.y = Math.PI / 2;
  [...landing.pile, carriedBundle, doorstep.children[0]].forEach(mesh => dressBox(mesh, template));
}, '货包');

// A light waymark on the far bank (Xingyi: players did not know where to climb): a few gold
// chevrons on the lane toward the mountain path, breathing faintly; gone once the climb begins.
const waymarks = [];
{
  const gold = new THREE.MeshBasicMaterial({ color: 0xf2d38a, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const chevron = () => {
    const g = new THREE.Group();
    for (const sgn of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(.09, .8).rotateX(-Math.PI / 2), gold);
      bar.rotation.y = sgn * .62;
      bar.position.set(sgn * .22, 0, .24);
      g.add(bar);
    }
    return g;
  };
  const route = [[8, -38.6], [2.4, -41.5], [-5, -43.2], [-7.3, -46.5], [-7, -50], [-9, -57.5]];
  for (const [i, t] of [[1, .2], [2, .1], [3, .5], [4, .5]]) {
    const [ax, az] = route[i], [bx, bz] = route[i + 1];
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const mark = chevron();
    mark.position.set(x, Math.max(heightAt(x, z), visibleGround(x, z)) + .12, z);
    mark.rotation.y = Math.atan2(ax - bx, az - bz); // points along the way
    mark.renderOrder = 5000;
    scene.add(mark);
    waymarks.push(mark);
  }
  waymarks.material = gold;
}
function updateWaymarks(elapsed) {
  const p = traveller.position;
  const want = state.mode === 'play' && state.crossed && !state.onBridge && p.z < RIVER.far + 1 && p.z > -56 ? 1 : 0;
  waymarks.material.opacity += ((.5 + .2 * Math.sin(elapsed * 2.2)) * want - waymarks.material.opacity) * .06;
  waymarks.forEach(m => { m.visible = waymarks.material.opacity > .01; });
}

// A watermill on the far bank, as in the painting: half on the bank, its wheel in the river.
loadModel('water_mill', gltf => {
  const holder = new THREE.Group();
  holder.add(fitModel(gltf.scene, 6, 'x'));
  holder.position.set(-14, heightAt(-14, -39.5) - .15, -37.4);
  holder.rotation.y = .12;
  scene.add(holder);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  houses.push({ site: { label: '' }, box, reach: box.clone().expandByScalar(.6), chunks: collisionChunks(holder) });
}, '水磨');

// Distant boats: the river was empty but for the ferry; the painting's river has many.
const farBoats = [];
[['boat_sail', -22, -14, .4], ['boat_fishing', -46, -27, 2.4], ['boat_fishing', 33, -25, -2.7], ['boat_sail', 58, -9, 1.2]].forEach(([name, x, z, yaw], i) => {
  loadModel(name, gltf => {
    const holder = new THREE.Group();
    holder.add(fitModel(gltf.scene, 7.5, 'x')); // Xingyi: 3.4 read as toys at that distance
    holder.position.set(x, -.38, z);
    holder.rotation.y = yaw;
    holder.userData.phase = i * 1.7;
    scene.add(holder);
    farBoats.push(holder);
  }, '远舟');
});

function setRope(from, to, sag) {
  const points = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return new THREE.Vector3(
      THREE.MathUtils.lerp(from.x, to.x, t),
      THREE.MathUtils.lerp(from.y, to.y, t) - sag * Math.sin(Math.PI * t),
      THREE.MathUtils.lerp(from.z, to.z, t));
  });
  landing.rope.geometry.dispose();
  landing.rope.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, .04, 4, false);
}

function resetLanding() {
  Object.assign(boatState, { phase: 'sailing', progress: 0, arrivedAt: 0, ropeHeld: false, tiedBy: null, asked: false, lastCall: 0, walk: 0, work: 0, unloaded: 0 });
  landing.coil.visible = true;
  landing.rope.visible = false;
  landing.bundle.visible = false;
  landing.pile.forEach(crate => { crate.visible = false; });
  placeBoat(0, 0);
}

function placeBoat(progress, elapsed) {
  const point = boatCourse.getPoint(progress);
  const tangent = boatCourse.getTangent(Math.min(progress, .999));
  const bob = .03 * Math.sin(elapsed * 1.7);
  const drift = boatState.phase === 'waiting' ? .12 * Math.sin(elapsed * .8) : 0;
  landing.boat.position.set(point.x + drift, -.35 + bob, point.z - Math.abs(drift) * .6);
  landing.boat.rotation.set(0, Math.atan2(-tangent.z, tangent.x), .02 * Math.sin(elapsed * 1.3));
  landing.boat.updateMatrixWorld();
}

const state = { mode: 'start', crossed: false, forkNotified: false, nearRiverNotified: false, bridgePavilionNotified: false, walkTime: 0, endTime: 0, startedAt: 0, frameBank: null, frameYaw: 0, framePitch: 0, frameSubject: '', lastGoalReminderAt: 0, pendingEndAt: 0, onBridge: false, floor: null, house: null, camYaw: 0, dragTurn: 0 };
const playLog = [];
const logged = new Set();

function note(event, once = true) {
  if (once && logged.has(event)) return;
  logged.add(event);
  const seconds = Math.round((performance.now() - state.startedAt) / 1000);
  playLog.push(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}  ${event}`);
}
// v0.9 three views: near bank (平远), far bank look-back (回望), summit (高远).
const shots = { near: null, bridge: null, far: null, peak: null };
const shotItems = { near: [], bridge: [], far: [], peak: [] };
const VIEW_NAMES = { near: '去时', bridge: '桥心', far: '回望', peak: '登高' };
const keys = new Set();
const clock = new THREE.Clock();
let toastTimer;
let scrollStage = 0;
let scrollView = 'original';
let frameDrag = null;

function setScrollStage(nextStage, animated = true) {
  const focusedLeft = document.activeElement === unrollLeft;
  const focusedRight = document.activeElement === unrollRight;
  scrollStage = THREE.MathUtils.clamp(nextStage, 0, 2);
  const labels = scrollView === 'original' ? ['卷右 · 桥亭', '卷中 · 群山', '卷左 · 山径'] : ['此岸', '长桥', '对岸'];
  scrollPosition.textContent = labels[scrollStage];
  unrollLeft.disabled = scrollStage === 2;
  unrollRight.disabled = scrollStage === 0;
  bridgeCaption.hidden = scrollStage !== 1;
  const view = scrollView === 'original' ? originalScroll : handscroll;
  const maxScroll = Math.max(0, view.scrollWidth - view.clientWidth);
  view.scrollTo({ left: maxScroll * (1 - scrollStage / 2), behavior: animated ? 'smooth' : 'auto' });
  scrollHint.textContent = (scrollView === 'original' ? [
    '自右向左展卷。先看桥亭怎样把两岸连在一处。',
    '看到画卷中段，青绿群山层层叠起，江面却疏朗开阔。',
    '再往左看，目光随山路转折，穿过林木，落在屋宇之间。',
  ] : [
    '这是为游戏新绘的行旅示意，自右向左展开，看两岸如何相连。',
    '桥亭连着两岸。回到画中，看看眼前的长桥，在原作的哪一处。',
    '对岸山坡上有人家。走到那里，回头再看这座桥。',
  ])[scrollStage];
  if (unrollLeft.disabled && focusedLeft) unrollRight.focus();
  if (unrollRight.disabled && focusedRight) unrollLeft.focus();
}

function selectScrollView(nextView) {
  scrollView = nextView;
  const original = nextView === 'original';
  originalTab.classList.toggle('is-selected', original);
  routeTab.classList.toggle('is-selected', !original);
  originalTab.setAttribute('aria-selected', String(original));
  routeTab.setAttribute('aria-selected', String(!original));
  originalPanel.hidden = !original;
  routePanel.hidden = original;
  scrollNote.innerHTML = original
    ? '原作图像：王希孟《千里江山图》桥亭段，<a href="https://commons.wikimedia.org/wiki/File:Wang_Ximeng_-_A_Thousand_Li_of_River_(Bridge).jpg" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>；并非故宫授权的图像。'
    : '这是为游戏原创绘制的路径示意，不是原作的精确地图或扫描图。';
  requestAnimationFrame(() => setScrollStage(scrollStage, false));
}

// The first view may be taken on the near bank or the near half of the bridge.
function currentBank() {
  const p = traveller.position;
  if (Math.hypot(p.x - SUMMIT_TERRACE.x, p.z - SUMMIT_TERRACE.z) < SUMMIT_TERRACE.r + 1) return 'peak';
  // On the deck just outside the pavilion's low eaves (inside, the eaves fill the view).
  if (state.onBridge && Math.abs(p.z - BRIDGE.z) > 7.8 && Math.abs(p.z - BRIDGE.z) < 13.5) return 'bridge';
  if (onSideStair(p) && p.x < 3) return 'bridge'; // the low landing off the pavilion, open to the river
  if (traveller.position.z > .5) return 'near';
  if (traveller.position.z < RIVER.far - .2) return 'far';
  return null;
}

// The task is a plain checklist (playtests: nobody read the two views as the task).
let goalMarkup = '';
function updateGoal() {
  const rows = [
    ['此岸 · 长桥取景', !!shots.near],
    ['过长桥', state.crossed],
    ['对岸 · 回望取景', !!shots.far],
    ['山顶 · 登高取景', !!shots.peak],
  ].map(([text, done]) => `<li class="${done ? 'is-done' : ''}">${text}</li>`);
  if (boatState.phase === 'waiting' || boatState.tiedBy === 'player') {
    rows.push(`<li class="is-optional${boatState.tiedBy === 'player' ? ' is-done' : ''}">闲笔 · 帮舟人系缆</li>`);
  }
  if (!shots.bridge) rows.push('<li class="is-optional">闲笔 · 桥心亭外，凭栏望江</li>');
  if (errand.phase === 'offered') rows.push('<li class="is-optional">闲笔 · 替舟人捎一担货（岸边货堆旁按 E）</li>');
  if (errand.phase === 'carrying' || errand.phase === 'delivered') {
    rows.push(`<li class="is-optional${errand.phase === 'delivered' ? ' is-done' : ''}">闲笔 · 送货到对岸山庄的长屋</li>`);
  }
  const markup = rows.join('');
  if (markup !== goalMarkup) goalList.innerHTML = goalMarkup = markup;
}

// ---------- 一步一步的操作提示：同一时刻只教一件事 ----------
const coachState = { shownKey: '', walked: false, turned: false, turnShownAt: 0, scrollHintUntil: 0, scrollHinted: false };
const HINTS = {
  walk: [['W', 'A', 'S', 'D'], '行走'],
  turn: [['按住鼠标', '拖动'], '看向哪里，就走向哪里'],
  take: [['E'], '接住缆绳'],
  tie: [['E'], '走到亮起的木桩旁，系好缆绳'],
  near: [['V'], '取景 · 将长桥收入画中'],
  descend: [['W'], '下山去渡口，舟人在水边等你'],
  far: [['V'], '取景 · 回头，把长桥和来路收进画框'],
  climb: [['W'], '沿山路往上走，到山顶再取一景'],
  peak: [['V'], '取景 · 从山顶看你走过的路'],
  bridge: [['V'], '出了亭檐，或从亭侧台阶下到水边平台，便可凭栏取景'],
  bridgeView: [['V'], '取景 · 凭栏望江'],
  cargo: [['E'], '接过这担货'],
  deliver: [['E'], '把货放在长屋门前'],
  dish: [['E'], '拾起'],
  brush: [['E'], '拾起'],
  inscribe: [['E'], '在亭壁上题一句'],
  giveback: [['E'], '把拾来的笔和颜料还给他'],
  scroll: [['M'], '随时展卷，对照原作'],
};
function pickHint() {
  const action = currentAction();
  if (action) return action;
  if (boatState.ropeHeld) return 'tie';
  // Opening on the lookout: first keep the view, then walk down to the landing.
  if (!state.crossed && !shots.near && currentBank() === 'near') return 'near';
  if (!state.crossed && shots.near && !boatState.tiedBy && Math.hypot(traveller.position.x - BOAT_DOCK.x, traveller.position.z - BOAT_DOCK.z) > 7) return 'descend';
  if (!coachState.walked) return 'walk';
  if (currentBank() === 'peak' && !shots.peak) return 'peak';
  if (state.onBridge && Math.abs(traveller.position.z - BRIDGE.z) < 12 && !shots.bridge) return currentBank() === 'bridge' ? 'bridgeView' : 'bridge';
  if (state.crossed && !shots.far && traveller.position.z < RIVER.far - 2) return 'far';
  if (shots.far && !shots.peak && traveller.position.z > -52) return 'climb';
  if (!state.crossed && !shots.near && currentBank() === 'near' && traveller.position.z < 16) return 'near';
  if (!coachState.turned) return 'turn';
  if (performance.now() < coachState.scrollHintUntil) return 'scroll';
  return '';
}
function updateCoach() {
  if (state.mode !== 'play') {
    coach.hidden = true;
    coachState.shownKey = '';
    return;
  }
  if (state.walkTime > 1.2) coachState.walked = true;
  if (state.dragTurn > .5) coachState.turned = true;
  const key = pickHint();
  if (key === 'turn' && !coachState.turnShownAt) coachState.turnShownAt = performance.now();
  // Someone who never drags is not nagged forever.
  if (coachState.turnShownAt && performance.now() - coachState.turnShownAt > 16000) coachState.turned = true;
  if (shots.near && !coachState.scrollHinted) {
    coachState.scrollHinted = true;
    coachState.scrollHintUntil = performance.now() + 6000;
  }
  if (key === coachState.shownKey) return;
  coachState.shownKey = key;
  coach.hidden = !key;
  if (!key) return;
  const [keyList, text] = HINTS[key];
  coachKeys.innerHTML = keyList.map(k => `<span class="keycap">${k}</span>`).join('');
  coachText.textContent = text;
  // Restart the entrance animation for each new hint.
  coach.style.animation = 'none';
  void coach.offsetWidth;
  coach.style.animation = '';
}

function updateGallery() {
  travelViews.hidden = !(shots.near || shots.far);
  for (const [shot, scrollImage, empty] of [
    [shots.near, scrollNearShot, scrollNearEmpty],
    [shots.far, scrollFarShot, scrollFarEmpty],
  ]) {
    scrollImage.hidden = !shot;
    empty.hidden = !!shot;
    if (shot) scrollImage.src = shot;
    else scrollImage.removeAttribute('src');
  }
}

function show(screen) {
  [startScreen, recipeScreen, scrollScreen, pauseScreen, endScreen, inscribeScreen].forEach(el => {
    el.hidden = true;
    el.classList.remove('is-visible');
  });
  if (screen) {
    screen.hidden = false;
    screen.classList.add('is-visible');
  }
  hud.hidden = state.mode !== 'play';
  frameUI.hidden = state.mode !== 'framing';
}

function say(message, duration = 3400) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
}

// ---------- 开卷三问 ----------
const optionButtons = {};
for (const q of QUESTIONS) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'recipe-q';
  fieldset.innerHTML = `<legend>${q.ask}</legend><div class="recipe-options"></div>`;
  const row = fieldset.querySelector('.recipe-options');
  optionButtons[q.key] = q.options.map(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recipe-option';
    button.innerHTML = `<strong>${option.name}</strong><span>${option.hint}</span>`;
    button.addEventListener('click', () => {
      applyRecipe({ ...recipe.choice, [q.key]: option.id });
      refreshRecipeUI();
      cueUnroll();
    });
    button.dataset.id = option.id;
    row.append(button);
    return button;
  });
  recipeQuestions.append(fieldset);
}

function refreshRecipeUI() {
  for (const q of QUESTIONS) {
    optionButtons[q.key].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === recipe.choice[q.key])));
  }
  recipeNameText.textContent = recipe.name;
}

function openRecipe() {
  state.mode = 'recipe';
  keys.clear();
  refreshRecipeUI();
  show(recipeScreen);
  (optionButtons.mountain.find(b => b.dataset.id === recipe.choice.mountain) || recipeGo).focus();
}

function startGame() {
  playTravelMusic();
  // Sound on from the first step (the start click is the user gesture); the toggle still turns it off.
  if (!state.soundStarted) {
    state.soundStarted = true;
    setMuted(false);
    startAudio().then(ok => { if (!ok) setMuted(true); showSoundState(); });
  }
  state.mode = 'play';
  state.summitRevealed = false;
  state.revealT = null;
  state.crossed = false;
  state.nearRiverNotified = false;
  state.forkNotified = false;
  state.bridgePavilionNotified = false;
  state.walkTime = 0;
  state.endTime = 0;
  state.startedAt = performance.now();
  state.lastGoalReminderAt = 0;
  state.pendingEndAt = 0;
  myScroll.hidden = true;
  saveScroll.hidden = true;
  saveScroll.textContent = '收藏小卷 ↓';
  state.frameBank = null;
  state.frameSubject = '';
  shots.near = null;
  shots.far = null;
  shots.peak = null;
  shots.bridge = null;
  shotItems.bridge = [];
  shotItems.near = [];
  shotItems.far = [];
  shotItems.peak = [];
  playLog.length = 0;
  logged.clear();
  Object.assign(coachState, { shownKey: '', walked: false, turned: false, turnShownAt: 0, scrollHintUntil: 0, scrollHinted: false });
  note('入画');
  note(`开卷配方：${recipe.name}`);
  scrollStage = 0;
  scrollView = 'original';
  traveller.position.set(START.x, heightAt(START.x, START.z) + .16, START.z);
  traveller.rotation.y = 0;
  traveller.visible = true;
  state.camYaw = Math.atan2(-29, 32.5); // facing the bridge, the far village and the peak
  state.dragTurn = 0;
  state.onBridge = false;
  state.floor = null;
  state.house = null;
  frameDrag = null;
  resetLanding();
  resetErrands();
  updateGallery();
  selectScrollView('original');
  setScrollStage(0, false);
  updateGoal();
  keys.clear();
  show(null);
  canvas.focus();
  say('水边一座长桥，通向山脚的人家。去时看桥，过桥后，再回头看一看。', 5600);
}

// The pin sits where the traveller stands, mapped onto the painting; on opening, the view
// pushes in on the stretch this chapter rebuilds, then eases back to the whole scroll.
const originalInner = document.getElementById('original-inner');
const scrollPin = document.getElementById('scroll-pin');
function placeScrollPin() {
  const img = originalInner.querySelector('img');
  const [dx, dy] = paintedDisplay(traveller.position.x, traveller.position.z);
  scrollPin.style.left = `${dx / 2000 * img.clientWidth}px`;
  scrollPin.style.top = `${dy / 427 * img.clientHeight}px`;
  const [px, py] = [dx / 2000 * 100, dy / 427 * 100];
  originalInner.style.transformOrigin = `${px}% ${Math.max(42, py)}%`; // keep a high pin (the summit) inside the frame
}
// This chapter's route drawn on the painting, from the same game→painting correspondence.
const ROUTE_STOPS = [[0, '起点'], [2, '长桥'], [4, '山庄'], [7, '半山亭'], [10, '山顶']];
(function drawScrollRoute() {
  // A smooth brush-like curve through the route points (Catmull-Rom as cubic Béziers).
  const pts = PAINT_ROUTE.map(([, p]) => p);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  document.querySelectorAll('#scroll-route path').forEach(path => path.setAttribute('d', d));
  for (const [i, name] of ROUTE_STOPS) {
    const [dx, dy] = PAINT_ROUTE[i][1];
    const tag = document.createElement('span');
    tag.className = 'route-stop';
    tag.textContent = name;
    tag.style.left = `${dx / 20}%`;
    tag.style.top = `${dy / 4.27}%`;
    originalInner.appendChild(tag);
  }
})();
function openScroll() {
  if (state.mode !== 'play') return;
  state.mode = 'scroll';
  note('首次打开画卷（M）');
  keys.clear();
  show(scrollScreen);
  cueUnroll();
  requestAnimationFrame(() => {
    setScrollStage(scrollStage, false);
    placeScrollPin();
    // Start the push-in once the sheet is on screen, or the transition has nothing to run from.
    setTimeout(() => originalInner.classList.add('is-focus'), 180);
    setTimeout(() => originalInner.classList.remove('is-focus'), 2600);
  });
  (scrollStage === 2 ? unrollRight : unrollLeft).focus();
}

function returnToWorld() {
  if (state.mode !== 'scroll') return;
  state.mode = 'play';
  show(null);
  canvas.focus();
}

function updateFrameCamera() {
  const eye = new THREE.Vector3(traveller.position.x, groundUnder(traveller.position) + 1.7, traveller.position.z);
  const cosPitch = Math.cos(state.framePitch);
  const direction = new THREE.Vector3(
    Math.sin(state.frameYaw) * cosPitch,
    Math.sin(state.framePitch),
    -Math.cos(state.frameYaw) * cosPitch
  );
  camera.position.copy(eye);
  camera.lookAt(eye.clone().add(direction));
  camera.updateMatrixWorld();
}

const sightRay = new THREE.Raycaster();
function inFrame(point) {
  const towards = point.clone().sub(camera.position).normalize();
  const gaze = new THREE.Vector3();
  camera.getWorldDirection(gaze);
  const projected = point.clone().project(camera);
  if (!(gaze.dot(towards) > 0 && projected.z > -1 && projected.z < 1
    && Math.abs(projected.x) < .76 && Math.abs(projected.y) < .72)) return false;
  // Framed but hidden behind a tree or rock does not count.
  sightRay.set(camera.position, towards);
  sightRay.far = camera.position.distanceTo(point) - .5;
  return sightRay.intersectObjects(occluders.map(item => item.object), true).length === 0;
}

// What a framing view holds. A kept view must hold the bridge or the boat; the third
// item is where you are going (near bank) or the way you came (far bank).
const GOING = [[0, 4.6, -46], [15, 6, -42], [23, 3.6, -47]].map(([x, up, z]) => new THREE.Vector3(x, heightAt(x, z) + up, z));
const CAME = [[2, 7], [4.5, 12.5], [0, 16.8], [-5, 7.2], [-11.5, 8.1], [-6, 18]].map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + .3, z));
const lensRay = new THREE.Raycaster();
function lensBlocked() {
  for (const sx of [-.3, 0, .3]) {
    lensRay.setFromCamera({ x: sx, y: 0 }, camera);
    lensRay.far = 2.2;
    // Ink edge lines would count within the raycaster's 1-unit line threshold; only solids block.
    if (lensRay.intersectObjects(bridgeParts, true).some(hit => hit.object.isMesh)) return true;
  }
  return false;
}
function frameItems() {
  const bridge = inFrame(new THREE.Vector3(8, 2.45, BRIDGE.z));
  const boatCentre = landing.boat.position.clone().add(new THREE.Vector3(0, .8, 0));
  // From the summit everything is far below, so the distance limits widen.
  const reach = state.frameBank === 'peak' ? 140 : 50;
  const boat = inFrame(boatCentre) && camera.position.distanceTo(boatCentre) < reach - 2;
  const third = (state.frameBank === 'near' ? GOING : CAME).some(point => inFrame(point) && camera.position.distanceTo(point) < reach);
  return { bridge, boat, third, blocked: state.frameBank === 'bridge' ? false : lensBlocked() }; // rails are foreground on the bridge
}
const joinCN = list => list.length < 2 ? list.join('') : `${list.slice(0, -1).join('、')}和${list.at(-1)}`;
const thirdLabel = () => state.frameBank === 'near' ? '对岸' : '来路';
function itemNames(items) {
  return [items.bridge && '桥', items.boat && '船', items.third && thirdLabel()].filter(Boolean);
}

function refreshFrameFeedback() {
  const items = frameItems();
  frameChecklist.querySelector('[data-item="third"]').textContent = thirdLabel();
  for (const key of ['bridge', 'boat', 'third']) frameChecklist.querySelector(`[data-item="${key}"]`).classList.toggle('is-in', items[key]);
  const names = itemNames(items);
  const message = items.blocked ? '柱子或栏杆挡住了视线。按 Esc 退出，稍微移动后再试。'
    : state.frameBank === 'bridge' ? `${names.length ? `框中有${joinCN(names)}。` : ''}站在桥心望出去，按空格取景。`
    : !(items.bridge || items.boat) ? '桥和船还未入框。拖动鼠标，或按 A / D 调整方向。'
    : `框中有${joinCN(names)}。按空格取景。`;
  if (message !== state.frameSubject) {
    state.frameSubject = message;
    frameStatus.textContent = message;
  }
}

function openFraming() {
  if (state.mode !== 'play') return;
  const bank = currentBank();
  if (!bank) {
    say(state.onBridge ? '出了亭檐，或从亭侧台阶下到水边平台，就能望见两岸。' : '到桥心或岸上，便可以取景。', 3200);
    return;
  }
  state.mode = 'framing';
  state.frameBank = bank;
  // Open already facing the subject: the bridge, or the boat when standing on the bridge.
  const onBridgeNear = traveller.position.z < 5.15;
  const aim = onBridgeNear ? landing.boat.position.clone().add(new THREE.Vector3(0, .8, 0)) : new THREE.Vector3(8, 2.2, BRIDGE.z);
  const dx = aim.x - traveller.position.x, dz = aim.z - traveller.position.z;
  state.frameYaw = Math.atan2(dx, -dz);
  state.framePitch = THREE.MathUtils.clamp(Math.atan2(aim.y - groundUnder(traveller.position) - 1.7, Math.hypot(dx, dz)), -.3, .2);
  state.frameSubject = '';
  frameDrag = null;
  keys.clear();
  traveller.visible = false;
  // A kept view shows the world as it is, never with see-through trees.
  occluders.forEach(item => {
    item.opacity = 1;
    item.materials.forEach(material => { material.opacity = 1; material.depthWrite = true; });
  });
  frameBankLabel.textContent = bank === 'bridge' ? '桥心亭 · 四望' : bank === 'peak' ? '山顶 · 高远' : bank === 'far' ? '对岸 · 回望' : traveller.position.z > 5.15 ? '此岸' : '桥上';
  show(null);
  updateFrameCamera();
  refreshFrameFeedback();
  takeFrame.focus();
}

function closeFraming() {
  if (state.mode !== 'framing') return;
  state.mode = 'play';
  state.frameBank = null;
  frameDrag = null;
  traveller.visible = true;
  keys.clear();
  show(null);
  canvas.focus();
}

function captureFrame() {
  if (state.mode !== 'framing') return;
  updateFrameCamera();
  const items = frameItems();
  // From the bridge pavilion any outward view counts: the river and both banks are the subject.
  if (items.blocked || (state.frameBank !== 'bridge' && !(items.bridge || items.boat))) {
    refreshFrameFeedback();
    return;
  }
  const subject = itemNames(items).join('、');
  shotItems[state.frameBank] = itemNames(items);
  sky.position.copy(camera.position);
  sortTransparent();
  mirror();
  renderer.render(scene, camera);
  try {
    shots[state.frameBank] = canvas.toDataURL('image/jpeg', .82);
  } catch (error) {
    frameStatus.textContent = '这次取景没有保存，请稍后再试。';
    return;
  }
  const bank = state.frameBank;
  note(`留下${VIEW_NAMES[bank]}一眼（${frameBankLabel.textContent}，画中有${subject}）`, false);
  updateGallery();
  cueCapture();
  closeFraming();
  updateGoal();
  say({ near: '来路这一景，已收进卷中。', bridge: '桥心一景，两岸尽收。', far: '回望这一景，也留在卷上了。', peak: '绢上渐渐有了颜色。方才望见的山水，已落在那一角空白里。' }[bank], 4200);
  if (bank === 'peak') {
    const corner = new Image();
    corner.onload = () => { paintState.corner = corner; drawPainting(); };
    corner.src = shots.peak;
  }
  // The summit view closes the chapter (retaking any view afterwards reopens the scroll).
  if (shots.peak) {
    state.pendingEndAt = performance.now() + 4200;
    updateGoal();
  }
}

function pause() {
  if (state.mode !== 'play') return;
  state.mode = 'pause';
  keys.clear();
  show(pauseScreen);
  resumeButton.focus();
}

function resume() {
  if (state.mode !== 'pause') return;
  state.mode = 'play';
  show(null);
  canvas.focus();
}

function win() {
  state.mode = 'ending';
  state.endTime = 0;
  state.pendingEndAt = 0;
  keys.clear();
  cueArrival();
  note('展开小卷', false);
  const seconds = Math.round((performance.now() - state.startedAt) / 1000);
  elapsedTime.textContent = `此行用时：${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`;
  // v0.9: the scroll holds all three views in reading order (right to left), no choosing.
  playLogText.textContent = playLog.join('\n');
  keepLine.textContent = '卷中三景，都是你沿途亲自选取的景致。';
  composeScroll();
  show(null);
  say('行过长桥，穿过村舍，沿山路登高。一路所见，收在这幅小卷里。', 4200);
}

// ---------- 你的小卷：引首 + 画心（留下的一眼）+ 题跋（配方与这一路） ----------
const CN_DIGITS = '〇一二三四五六七八九';
function colophonLines() {
  const lines = [recipe.name.replace(/ /g, '')];
  const high = logged.has('走上高岸路'), water = logged.has('走到水边路');
  const route = high && water ? '高岸水边皆走过' : high ? '由高岸而下' : water ? '循水边而行' : '';
  lines.push('过长桥');
  if (logged.has('系好缆绳')) lines.push('为舟人系缆');
  else if (logged.has('舟人自己上岸系缆')) lines.push('见舟人自系其缆');
  if (logged.has('为舟人送货')) lines.push('为舟人捎货至山庄');
  const found = [logged.has('拾得石绿颜料碟') && '石绿', logged.has('拾得一支笔') && '一笔'].filter(Boolean);
  if (found.length) lines.push(`山径拾得${found.map(f => f === '石绿' ? '石绿一碟' : '画笔一支').join('、')}`);
  if (errand.inscription) lines.push(`题壁「${errand.inscription}」`);
  if (logged.has('把颜料与笔还给画者')) lines.push('至山顶，归还画笔与颜料');
  for (const bank of ['near', 'bridge', 'far', 'peak']) {
    if (shots[bank]) lines.push(`${VIEW_NAMES[bank]}${shotItems[bank].length ? `，${shotItems[bank].join('与')}入画` : ''}`);
  }
  const now = new Date();
  const year = String(now.getFullYear()).split('').map(d => CN_DIGITS[d]).join('');
  const month = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][now.getMonth()];
  lines.push(`${year}年${month}月行者记`);
  return lines;
}

function verticalText(ctx, text, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'Noto Serif SC', 'Songti SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [...text].forEach((ch, i) => ctx.fillText(ch, x, y + i * size * 1.18));
}

function seal(ctx, text, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#a8322b';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#f6e9d6';
  ctx.font = `600 ${size * .36}px 'Noto Serif SC', 'Songti SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Seal characters read in columns, right column first.
  [...text].forEach((ch, i) => ctx.fillText(ch, x + size * (i < 2 ? .72 : .28), y + size * (i % 2 ? .72 : .28)));
  ctx.restore();
}

async function composeScroll() {
  try { await document.fonts.load("500 30px 'Noto Serif SC'"); } catch { /* system serif is fine */ }
  const images = {};
  for (const bank of ['near', 'bridge', 'far', 'peak']) {
    if (!shots[bank]) continue;
    const image = new Image();
    image.src = shots[bank];
    try { await image.decode(); images[bank] = image; } catch { /* skip that panel */ }
  }
  // Only the views actually taken are mounted (Xingyi: an empty "此处留白" panel read as a bug).
  // Right to left: 引首 · views in walking order · 题跋.
  const banks = ['near', 'bridge', 'far', 'peak'].filter(bank => images[bank]);
  const lines = colophonLines();
  const HEAD = 300, PANEL = 730, COLOPHON = lines.length * 60 + 150;
  const W = 52 + HEAD + banks.length * PANEL + COLOPHON, H = 620;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cfc2a4';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(26, 34, W - 52, H - 68);
  // A faint fibre texture so the paper is not a flat fill.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(120,95,60,${.025 + .03 * ((i * 37) % 7) / 7})`;
    ctx.fillRect(26 + (i * 733) % (W - 52), 34 + (i * 389) % (H - 68), 1 + (i % 9), 1);
  }
  // 引首 on the right: a handscroll is read from right to left.
  verticalText(ctx, '千里江山', W - 140, 80, 74, '#24332d');
  seal(ctx, '入卷行者', W - 173, 478, 66);
  // 画心: the views in the order they were walked, right to left.
  const fy = 66, fw = 700, fh = H - 132;
  banks.forEach((bank, k) => {
    const image = images[bank];
    const fx = W - 26 - HEAD - (k + 1) * PANEL + 30;
    const scale = Math.max(fw / image.width, fh / image.height);
    const sw = fw / scale, sh = fh / scale;
    ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, fx, fy, fw, fh);
    ctx.strokeStyle = '#8c7a58';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx - 7, fy - 7, fw + 14, fh + 14);
  });
  // 题跋 on the left, columns right to left.
  const colophonRight = 26 + COLOPHON - 70;
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    verticalText(ctx, line, colophonRight - i * 60, last ? 120 : 76, last ? 24 : i === 0 ? 34 : 28, i === 0 ? '#1d3a36' : '#3a3a30');
  });
  seal(ctx, '自家山水', colophonRight - lines.length * 60 - 8, 470, 52);
  try {
    myScrollImg.src = c.toDataURL('image/jpeg', .9);
    myScroll.hidden = false;
    saveScroll.hidden = false;
  } catch {
    myScroll.hidden = true;
  }
}

function downloadScroll() {
  try {
    const link = document.createElement('a');
    link.href = myScrollImg.src;
    link.download = `入卷-${recipe.name.replace(/[ ·]/g, '')}.jpg`;
    link.click();
    saveScroll.textContent = '已收藏';
  } catch {
    saveScroll.textContent = '无法直接下载时，请右键或长按图片保存';
  }
}

// ---------- 入卷：他起身，走进画里（不旁白，只用画面） ----------
// Timeline in seconds: 0–5 he walks to the cliff edge in 3D; 3.5–6.5 the painting fades in
// with his figure on the peak; 6.5–18 he walks left into the mountains as the scroll unrolls
// after him; 18–20.5 the scroll rolls shut; then bare silk and three lines, then the title.
const RJ_PATH = [[1085, 100], [1040, 128], [980, 150], [900, 190], [820, 205], [720, 180], [620, 200], [520, 215], [430, 225]];
const rj = { t: 0, lines: 0 };
function startRujuan() {
  if (state.mode !== 'end') return;
  state.mode = 'rujuan';
  rj.t = 0;
  rj.lines = 0;
  note('收卷 · 入卷', false);
  playEndingMusic();
  show(null);
  rujuan.hidden = false;
  rujuan.classList.add('is-active');
  document.querySelector('.topline').style.visibility = 'hidden'; // the ending is the painting alone
  rujuanTrack.style.opacity = 0;
  rujuan.style.background = 'transparent';
  rujuanTrack.style.clipPath = 'none';
  rujuanSilk.style.opacity = 0;
  rujuan.querySelectorAll('.is-shown').forEach(el => el.classList.remove('is-shown'));
  traveller.visible = true;
  if (PAINTER.model) {
    PAINTER.model.visible = true;
    PAINTER.model.position.copy(PAINTER.at);
  }
  playPainterClip('standup'); // he puts down the brush and rises first
  playTravellerClip('idle'); // the traveller stands and watches him go (no walking on the spot)
  setPainterOpacity(1);
  placeRujuanPainting();
  rjCaps.forEach(c => { c.style.opacity = 0; });
}
// The three distances (郭熙《林泉高致》), shared by the cover and the ending: 平远 along the river,
// 深远 from beside the bridge to the far peaks, 高远 from the village up the main peak.
const YUAN = [['平远', '自近山而望远山'], ['深远', '自山前而窥山后'], ['高远', '自山下而仰山巅']];
function landscapeShot(st, D) {
  const k = Math.floor(st / D) % 3, f = (st % D) / D, e = f * f * (3 - 2 * f);
  if (k === 0) {
    camera.position.set(-62 + 104 * e, 12, 14); // above the near-bank groves
    camera.lookAt(-42 + 104 * e, 0, -36);
  } else if (k === 1) {
    camera.position.set(-6, 5, 9 - 9 * e); // beside the bridge, so its pavilion never blocks the peaks
    camera.lookAt(-15, 12 + 4 * e, -88);
  } else {
    camera.position.set(-14, 3.4, -41 - 4 * e); // west of the village, clear of its houses
    camera.lookAt(-17, 6 + 22 * e, -84);
  }
  return { k, dip: 1 - smooth(0, .14, f) * (1 - smooth(.86, 1, f)) };
}
function pathPoint(u) {
  const f = THREE.MathUtils.clamp(u, 0, 1) * (RJ_PATH.length - 1);
  const i = Math.min(RJ_PATH.length - 2, Math.floor(f)), k = f - i;
  return [RJ_PATH[i][0] + (RJ_PATH[i + 1][0] - RJ_PATH[i][0]) * k, RJ_PATH[i][1] + (RJ_PATH[i + 1][1] - RJ_PATH[i][1]) * k];
}
// The ending: he stands (STAND s), walks to the pavilion steps and down them, crosses the terrace
// toward the bridge view; the painting fades in LEAD s after he starts walking. t keeps the
// original schedule of the painting and the closing lines.
// Xingyi: the game world must become the original scroll with HIM in it (his real figure, from
// behind), so the double meaning lands: you went into the scroll; so does the painter (入卷).
const RJ_STAND = 3.2;
const rjCaps = [...document.querySelectorAll('.rujuan-caption')];
let rjPainting = null;
const RJ_PAINT_H = 96, RJ_PAINT_Y = 26; // Xingyi: the scroll fills the screen; its keyed-out sky sits above the frame
function placeRujuanPainting() {
  if (!rjPainting) {
    const tex = textureLoader.load('./assets/qianli-mountains-cutout.webp?v=1'); // the mountains only: the silk sky keyed out
    tex.colorSpace = THREE.SRGBColorSpace;
    rjPainting = new THREE.Mesh(new THREE.PlaneGeometry(RJ_PAINT_H * 4200 / 896, RJ_PAINT_H),
      // Drawn over the whole world (no depth test); only he is drawn after it, on top.
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    rjPainting.renderOrder = 6000;
    scene.add(rjPainting);
  }
  const facingAngle = Math.atan2(PAINTER.facing.x, PAINTER.facing.z);
  const steps = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingAngle + Math.PI);
  const at = PAINTER.at.clone().addScaledVector(steps, 5.4).addScaledVector(PAINTER.facing, 34);
  rjPainting.position.set(at.x, heightAt(SUMMIT_TERRACE.x, SUMMIT_TERRACE.z) + RJ_PAINT_Y, at.z);
  rjPainting.rotation.set(0, facingAngle + Math.PI, 0); // faces back toward him and the camera
  rjPainting.material.opacity = 0;
  rjPainting.visible = true;
}
function setPainterOpacity(o, onTop = false) {
  PAINTER.model?.traverse(part => {
    if (!part.isMesh) return;
    // Over the scroll, nothing of the terrain may cut him off at the knees: drawn on top, whole.
    if (part.material.depthTest === onTop) { part.material.depthTest = !onTop; part.material.needsUpdate = true; }
    // In the transparent pass, after the scroll (renderOrder 6000), so he stays in front of it.
    if (!part.material.transparent) { part.material.transparent = true; part.material.needsUpdate = true; }
    part.renderOrder = 6001;
    part.material.opacity = o;
  });
}
function updateRujuan(dt) {
  rj.t += dt;
  // tw: seconds since he started walking. t: the closing schedule (silk lines from t = 20).
  const tw = rj.t - RJ_STAND, t = tw + 3.5;
  // 3D: he walks off along his gaze; the camera stands behind the traveller and watches him go.
  if (PAINTER.model) {
    // Rise; then to the pavilion's steps (west), down them, and across the terrace toward the view.
    const facingAngle = Math.atan2(PAINTER.facing.x, PAINTER.facing.z);
    if (tw <= 0) {
      PAINTER.model.position.copy(PAINTER.at);
      PAINTER.model.rotation.y = facingAngle;
    } else {
      playPainterClip('walk');
      const rig = PAINTER.rig;
      if (rig?.walk && rig.standup) { // Xingyi: the robe tore open mid-stride; a shorter stride keeps it whole
        rig.walk.stopFading(); rig.standup.stopFading();
        rig.standup.enabled = true;
        rig.standup.setEffectiveWeight(.5);
        rig.walk.setEffectiveWeight(.5);
        rig.walk.timeScale = .85;
      }
      const steps = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingAngle + Math.PI);
      const walked = tw * 1.05, deckRun = 3.3, stairRun = 2.1;
      const base = PAINTER.at.clone().addScaledVector(steps, deckRun + stairRun);
      let pos, heading;
      if (walked < deckRun + stairRun) {
        pos = PAINTER.at.clone().addScaledVector(steps, walked);
        const down = THREE.MathUtils.clamp((walked - deckRun) / stairRun, 0, 1);
        pos.y = THREE.MathUtils.lerp(PAINTER.at.y, heightAt(base.x, base.z), down);
        heading = steps;
      } else {
        pos = base.clone().addScaledVector(PAINTER.facing, walked - deckRun - stairRun);
        // On over the edge at the terrace's height: by then the ground is the scroll.
        pos.y = Math.max(heightAt(pos.x, pos.z), heightAt(base.x, base.z) - .2);
        heading = PAINTER.facing;
      }
      PAINTER.model.position.copy(pos);
      const want = Math.atan2(heading.x, heading.z);
      let d = want - PAINTER.model.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      PAINTER.model.rotation.y += d * Math.min(1, dt * 4); // turns, not snaps
    }
    setPainterOpacity(1 - smooth(14, 16.2, tw), tw > 5); // smaller with distance, then gone into the scroll
    { // the traveller turns to watch him
      const d = PAINTER.model.position.clone().sub(traveller.position);
      let turn = Math.atan2(-d.x, -d.z) - traveller.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      traveller.rotation.y += turn * Math.min(1, dt * 2.5);
    }
    if (tw > 16.4) PAINTER.model.visible = false;
  }
  // Watched from outside the pavilion's west side, so the roof never hides him.
  const side = new THREE.Vector3(-PAINTER.facing.z, 0, PAINTER.facing.x);
  let dip = 1; // how far the silk closes over the world (1 = solid)
  if (t < 20.3) {
    if (tw < 4.6) { // he rises and goes to the steps: watched from the pavilion's side
      const eye = PAINTER.at.clone().addScaledVector(side, 7.5).addScaledVector(PAINTER.facing, -1.5);
      eye.y = PAINTER.at.y + 3.2;
      camera.position.lerp(eye, Math.min(1, dt * 2));
      const m = PAINTER.model?.position || PAINTER.at; // keep him in frame as he rises and walks
      camera.lookAt(m.x + PAINTER.facing.x * 2.5, m.y + 1.1, m.z + PAINTER.facing.z * 2.5);
    } else if (PAINTER.model) { // then from behind him; it stops following, so he walks away and grows small
      if (tw < 8.5) rj.follow = PAINTER.model.position.clone();
      const w = rj.follow, back = smooth(5, 14, tw);
      const eye = w.clone().addScaledVector(PAINTER.facing, -(5 + 5 * back));
      eye.y = Math.max(w.y + 2.4 + 1.6 * back, heightAt(eye.x, eye.z) + 2.2);
      camera.position.lerp(eye, Math.min(1, dt * 1.6));
      camera.lookAt(w.x + PAINTER.facing.x * 24, w.y + 1.2, w.z + PAINTER.facing.z * 24);
    }
    if (rjPainting) rjPainting.material.opacity = smooth(5.5, 10.5, tw);
    rjCaps[0].style.opacity = smooth(6.5, 7.6, tw) * (1 - smooth(10.6, 11.6, tw));
    rjCaps[1].style.opacity = smooth(11.8, 12.9, tw) * (1 - smooth(16.4, 17.4, tw));
  } else {
    if (rjPainting) rjPainting.visible = false;
    rjCaps.forEach(c => { c.style.opacity = 0; });
    // Under the closing lines the landscape he painted passes behind the silk, as the scroll
    // unrolls: 平远 along the river, 深远 from the bridge to the far peaks, 高远 up the main peak.
    dip = landscapeShot(t - 20, 9).dip;
  }

  rujuanTrack.style.opacity = 0; // the 2D painting and stand-in figure are retired: he walks in himself

  // Once the painting appears the world is gone: bare silk behind it, so no 3D shows round the edges.
  // From the closing lines on the silk thins so the passing landscape shows through, faintly.
  rujuan.style.background = `rgba(226, 214, 184, ${smooth(19.2, 20.3, t) * (1 - smooth(20.3, 23, t) * (1 - dip) * .62)})`;
  rujuanSilk.style.opacity = smooth(20, 22, t);
  const steps = [[22.5, '.rujuan-line:nth-of-type(1)'], [25.5, '.rujuan-line:nth-of-type(2)'], [29.5, '.rujuan-last'], [33, '.rujuan-title'], [35, '.rujuan-credits'], [37, '.rujuan-actions']];
  steps.forEach(([at, selector]) => { if (t > at) rujuan.querySelector(selector).classList.add('is-shown'); });
  if (t > 37 && !rj.focused) {
    rj.focused = true;
    document.getElementById('rujuan-restart').focus({ preventScroll: true });
  }
}
function closeRujuan(toScroll) {
  playTravelMusic();
  document.querySelector('.topline').style.visibility = '';
  if (rjPainting) rjPainting.visible = false;
  rujuan.hidden = true;
  rujuan.classList.remove('is-active');
  rj.focused = false;
  if (toScroll) {
    state.mode = 'end';
    show(endScreen);
  } else {
    startGame();
  }
}

function backToWorld() {
  if (state.mode !== 'end') return;
  state.mode = 'play';
  note('从结尾回到画中', false);
  updateGoal();
  show(null);
  canvas.focus();
  say('还可以四处走走。重新取景，便能再看你的小卷。', 4200);
}

function tryMove(dx, dz) {
  const p = traveller.position;
  const nextX = THREE.MathUtils.clamp(p.x + dx, -39, 39);
  // The far bank ends just behind the village, before the mountains' foothills.
  const nextZ = THREE.MathUtils.clamp(p.z + dz, -90, 39);
  if (!BRIDGE.deck) { // bridge not loaded yet: the old low crossing
    if (inRiver(nextZ) && Math.abs(nextX - BRIDGE.x) > 1.75) return;
  } else {
    const onSpan = Math.abs(nextZ - BRIDGE.z) < BRIDGE.half && Math.abs(nextX - BRIDGE.x) < BRIDGE.halfWidth + .7;
    if (state.onBridge) {
      // On the deck: stay between the rails; stepping off either end returns to land.
      // Mid-hall the west rail opens onto the side stair and its landing (playtest: it was walled off).
      const rail = BRIDGE.x - BRIDGE.halfWidth;
      const z = p.x < rail - .01 ? THREE.MathUtils.clamp(nextZ, SIDE_STAIR.z - SIDE_STAIR.half, SIDE_STAIR.z + SIDE_STAIR.half) : nextZ;
      const open = SIDE_STAIR.steps && Math.abs(z - SIDE_STAIR.z) <= SIDE_STAIR.half;
      p.x = THREE.MathUtils.clamp(nextX, open ? SIDE_STAIR.x0 : rail, BRIDGE.x + BRIDGE.halfWidth);
      p.z = z;
      if (Math.abs(p.z - BRIDGE.z) >= BRIDGE.half) state.onBridge = false;
      return;
    }
    if (onSpan) {
      // From land the deck is reached only at its two ends.
      if (Math.abs(p.z - BRIDGE.z) >= BRIDGE.half - .2) { // stepping on at an end; a slanting approach is eased onto the deck
        state.onBridge = true;
        state.floor = null;
        p.x = THREE.MathUtils.clamp(nextX, BRIDGE.x - BRIDGE.halfWidth, BRIDGE.x + BRIDGE.halfWidth); p.z = nextZ;
      }
      return;
    }
    if (inRiver(nextZ)) return; // the river
  }
  // Among the houses: try the full step, then slide along whichever wall is in the way.
  for (const [x, z] of [[nextX, nextZ], [nextX, p.z], [p.x, nextZ]]) {
    if (peakBlocks(x, z) || painterBlocks(x, z)) continue;
    const floor = houseStep(x, z);
    if (floor === false) continue;
    p.x = x; p.z = z;
    state.floor = floor;
    return;
  }
}

const scratch = { bow: new THREE.Vector3(), stand: new THREE.Vector3(), hand: new THREE.Vector3(), post: new THREE.Vector3() };

// Which E-action is available right now ('' when none).
function landingAction() {
  if (boatState.phase !== 'waiting') return '';
  const p = traveller.position;
  if (boatState.ropeHeld) return Math.hypot(p.x - MOORING_POST.x, p.z - MOORING_POST.z) < 1.6 ? 'tie' : '';
  bowPoint(scratch.bow);
  // Generous reach: the lane runs ~3 units above the waterline.
  return Math.hypot(p.x - scratch.bow.x, p.z - scratch.bow.z) < 4.4 ? 'take' : '';
}

// ---------- v0.9 可选的小事：捎货、拾物、题壁 ----------
const PILE_CENTRE = new THREE.Vector3(-6.3, 0, 6.4);
const HALL_DOOR = new THREE.Vector3(15, 0, -50.4); // the long house's open end (the errand's doorstep)
const errand = { phase: 'none', inscription: '' }; // phase: none → offered → carrying → delivered
const carriedBundle = box(.62, .44, .46, mats.cargo, 0, 1.3, .4, traveller);
carriedBundle.visible = false;
const doorstep = new THREE.Group();
box(.62, .44, .46, mats.cargo, 0, .22, 0, doorstep);
const teaBowl = new THREE.Mesh(new THREE.CylinderGeometry(.16, .1, .12, 16), new THREE.MeshStandardMaterial({ color: 0xd9e3d6, roughness: .4 }));
teaBowl.position.y = .5;
doorstep.add(teaBowl);
doorstep.visible = false;
scene.add(doorstep);

function resetErrands() {
  if (PAINTER.model) {
    PAINTER.model.visible = true;
    PAINTER.model.position.copy(PAINTER.at);
    PAINTER.model.rotation.y = Math.atan2(PAINTER.facing.x, PAINTER.facing.z);
  }
  playPainterClip('sit');
  rujuan.hidden = true;
  PAINTER.met = false;
  PAINTER.returned = false;
  returnedThings.visible = false;
  deskThings.clear();
  paintState.corner = null;
  drawPainting();
  errand.phase = 'none';
  errand.inscription = '';
  carriedBundle.visible = false;
  doorstep.visible = false;
  teaBowl.visible = false;
  for (const item of Object.values(pickups)) {
    item.taken = false;
    item.group.visible = true;
  }
  drawWall('');
}

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Which E-action is available right now ('' when none).
function currentAction() {
  const landingNow = landingAction();
  if (landingNow) return landingNow;
  const p = traveller.position;
  if (errand.phase === 'offered' && flat(p, PILE_CENTRE) < 3) return 'cargo';
  if (errand.phase === 'carrying' && flat(p, HALL_DOOR) < 2.6) return 'deliver';
  for (const [key, item] of Object.entries(pickups)) {
    if (!item.taken && flat(p, item.group.position) < 1.8) return key;
  }
  if (!errand.inscription && halfwayPavilion && flat(p, PEAK_SPOTS.pavilion) < 3.2) return 'inscribe';
  if (!PAINTER.returned && (pickups.dish?.taken || pickups.brush?.taken) && flat(p, PAINTER.at) < 3.4) return 'giveback';
  return '';
}
const ACTION_LABELS = { take: '接绳', tie: '系上', cargo: '接货', deliver: '放下货', dish: '拾起', brush: '拾起', inscribe: '题壁', giveback: '还给他' };

function updateErrands(elapsed) {
  const p = traveller.position;
  // After the player tied the line, the boatperson asks a second favour once the first crate is ashore.
  if (errand.phase === 'none' && boatState.tiedBy === 'player' && landing.pile[0].visible && flat(p, PILE_CENTRE) < 14) {
    errand.phase = 'offered';
    note('舟人托你捎货');
    say('舟人：「多谢了！若往对岸去，劳烦捎上这担货，送到山庄的长屋门前。」', 5200);
  }
  if (!PAINTER.met && flat(p, PAINTER.at) < 9) {
    PAINTER.met = true;
    note('山顶遇画者');
    say('一个少年背对着你，坐在崖边作画。案上铺着一卷绢，画的正是眼前的山水，只留一角空白。', 6400);
  }
  if (flat(p, PAINTER.at) < 40 && performance.now() - paintState.lastDraw > 150) {
    paintState.lastDraw = performance.now();
    drawPainting();
  }
  const pulse = .5 + .5 * Math.sin(elapsed * 4);
  for (const item of Object.values(pickups)) {
    item.ring.material.opacity = !item.taken && flat(p, item.group.position) < 7 ? .2 + .45 * pulse : 0;
  }
}

function openInscribe() {
  state.mode = 'inscribe';
  keys.clear();
  show(inscribeScreen);
  inscribeScreen.querySelector('.inscribe-choice').focus();
}
function closeInscribe(line) {
  if (state.mode !== 'inscribe') return;
  state.mode = 'play';
  show(null);
  canvas.focus();
  if (!line) return;
  errand.inscription = line;
  drawWall(line);
  cueCapture();
  note(`题壁：${line}`);
  say('壁上添了你的题句，旁边那一笔墨还未干。', 3600);
}

function interact() {
  if (state.mode !== 'play') return;
  const action = currentAction();
  if (action === 'cargo') {
    errand.phase = 'carrying';
    carriedBundle.visible = true;
    const crate = landing.pile.findLast(item => item.visible);
    if (crate) crate.visible = false;
    cuePickup();
    note('接过一担货');
    say('货已挑上肩，送到对岸山庄的长屋门前便好。', 4000);
  } else if (action === 'deliver') {
    errand.phase = 'delivered';
    carriedBundle.visible = false;
    doorstep.position.set(HALL_DOOR.x - 1.5, heightAt(HALL_DOOR.x - 1.5, HALL_DOOR.z), HALL_DOOR.z - .1);
    doorstep.visible = true;
    setTimeout(() => { teaBowl.visible = true; }, 1300);
    cuePickup();
    note('为舟人送货');
    say('货放在长屋门前。屋里有人应了一声，递出一碗热茶。', 4600);
  } else if (action === 'dish' || action === 'brush') {
    pickups[action].taken = true;
    pickups[action].group.visible = false;
    cuePickup();
    note(PICKUP_LINES[action][1]);
    say(PICKUP_LINES[action][0], 4200);
  } else if (action === 'inscribe') {
    openInscribe();
  } else if (action === 'giveback') {
    PAINTER.returned = true;
    cuePickup();
    returnedThings.clear();
    deskThings.clear();
    paintingStand.updateMatrixWorld(true);
    const deskRay = new THREE.Raycaster();
    for (const key of ['dish', 'brush']) {
      if (!pickups[key].taken) continue;
      const thing = pickups[key].group.clone();
      thing.visible = true;
      thing.children.forEach(child => { if (child.geometry?.type === 'RingGeometry') child.visible = false; });
      // Set down on the desk top at either end of the scroll (Xingyi: they were left on the floor).
      const spot = paintingStand.localToWorld(new THREE.Vector3(key === 'dish' ? .9 : -.9, 3, .3));
      deskRay.set(spot, DOWN);
      const hit = deskRay.intersectObjects(paintingStand.children, true)[0];
      const local = paintingStand.worldToLocal(hit ? hit.point.clone() : spot.setY(paintingStand.position.y + .9));
      thing.position.copy(local);
      thing.rotation.set(0, key === 'brush' ? .3 : 0, 0);
      thing.scale.setScalar(.7);
      deskThings.add(thing);
    }
    returnedThings.visible = true;
    cueCapture();
    note('把颜料与笔还给画者');
    say('他没有回头，伸手接过了笔和颜料。', 3800);
  } else if (action === 'take') {
    boatState.ropeHeld = true;
    landing.coil.visible = false;
    note('接过绳端');
    say('接住了。把缆绳系到岸边的木桩上。', 3200);
  } else if (action === 'tie') {
    boatState.ropeHeld = false;
    finishTie('player');
    note('系好缆绳');
    say('缆绳一紧，船便稳了。舟人点点头，转身卸货。', 3800);
  }
}

function finishTie(by) {
  boatState.phase = 'tied';
  boatState.tiedBy = by;
  boatState.work = 0;
  cueRope();
}

function updateLanding(dt, elapsed) {
  const p = traveller.position;
  const toDock = Math.hypot(p.x - BOAT_DOCK.x, p.z - BOAT_DOCK.z);
  if (boatState.phase === 'sailing') {
    // The boat keeps its own pace, but never makes a nearby or hurrying player wait.
    const hurry = toDock < 16 || (p.x > 2 && p.z < 10) || state.crossed;
    const rate = hurry ? 1 / 10 : 1 / BOAT_BASE_SECONDS;
    boatState.progress = Math.min(1, boatState.progress + rate * dt);
    if (boatState.progress >= 1) {
      boatState.phase = 'waiting';
      boatState.arrivedAt = performance.now();
      note('船靠到右岸');
    }
  }
  placeBoat(boatState.progress, elapsed);
  deckStand(scratch.stand);
  bowPoint(scratch.bow);
  scratch.post.set(MOORING_POST.x, 1.02, MOORING_POST.z);

  if (boatState.phase === 'waiting') {
    // The boatperson calls out, and keeps calling while the player is in earshot.
    const now = performance.now();
    if (!boatState.ropeHeld && !state.crossed && toDock < 17 && now - boatState.lastCall > 9000) {
      boatState.lastCall = now;
      if (!boatState.asked) note('听到舟人请求');
      boatState.asked = true;
      say('舟人：「劳驾，搭把手，接一下缆绳！」', 3600);
    }
    if (boatState.ropeHeld && toDock > 11) {
      boatState.ropeHeld = false;
      landing.coil.visible = true;
      note('绳端滑回船上', false);
      say('缆绳一滑，又落回船上。', 2600);
    }
    const waited = (performance.now() - boatState.arrivedAt) / 1000;
    if (!boatState.ropeHeld && ((waited > SELF_TIE_AFTER && toDock > 12) || state.crossed)) {
      boatState.phase = 'selfTying';
      boatState.walk = 0;
      boatState.walkFrom.copy(scratch.stand);
      boatState.walkTo.set(MOORING_POST.x - .5, 0, MOORING_POST.z - .5);
      landing.coil.visible = false;
      note('舟人自己上岸系缆');
    }
  }

  // Boatperson: poles while sailing, holds the line while waiting, walks to the post
  // when nobody helps, and then carries cargo ashore.
  const person = landing.person;
  if (boatState.phase === 'selfTying') {
    boatState.walk += dt / 3.2;
    const t = Math.min(1, boatState.walk);
    person.position.lerpVectors(boatState.walkFrom, boatState.walkTo, t);
    person.position.y = Math.max(boatState.walkFrom.y, heightAt(person.position.x, person.position.z)) + Math.sin(Math.PI * t) * .35;
    person.lookAt(boatState.walkTo.x, person.position.y, boatState.walkTo.z);
    playBoatClip('walk', .7);
    if (t >= 1) finishTie('self');
  } else if (boatState.phase === 'tied') {
    boatState.work += dt;
    const cycle = (boatState.work % 6) / 6;
    const ashore = new THREE.Vector3(-6.3, 0, 6.0);
    const leg = cycle < .5 ? cycle * 2 : 2 - cycle * 2;
    person.position.lerpVectors(scratch.stand, ashore, smooth(.15, .85, leg));
    person.position.y = THREE.MathUtils.lerp(scratch.stand.y, 0, smooth(.15, .85, leg));
    person.rotation.set(0, cycle < .5 ? .3 : Math.PI + .3, 0);
    playBoatClip(leg > .12 && leg < .88 ? 'walk' : 'idle', .5);
    landing.bundle.visible = cycle < .5;
    // When the player tied the line, the first crate is put ashore at once for the errand.
    const unloaded = Math.min(landing.pile.length, Math.max(boatState.tiedBy === 'player' ? 1 : 0, Math.floor(boatState.work / 6)));
    const taken = errand.phase === 'none' || errand.phase === 'offered' ? 0 : 1; // the one the player carries
    landing.pile.forEach((crate, i) => { crate.visible = i < unloaded - taken; });
  } else {
    person.position.copy(scratch.stand);
    person.rotation.set(0, landing.boat.rotation.y + (boatState.phase === 'waiting' ? Math.PI / 2 : 0), 0);
    playBoatClip(boatState.phase === 'sailing' ? 'pole' : 'idle');
  }
  landing.pole.visible = boatState.phase === 'sailing';
  landing.body.rotation.x = boatState.phase === 'sailing' ? .18 * Math.sin(elapsed * 1.6)
    : boatState.phase === 'tied' && boatState.work < 1.2 ? .35 * Math.sin(boatState.work * Math.PI / 1.2) : 0;

  landing.rope.visible = boatState.phase !== 'sailing';
  const pulse = .5 + .5 * Math.sin(elapsed * 4);
  landing.coil.material.emissiveIntensity = boatState.phase === 'waiting' && !boatState.ropeHeld ? .25 + .6 * pulse : 0;
  landing.postRing.material.opacity = boatState.ropeHeld ? .35 + .5 * pulse : 0;
  if (boatState.ropeHeld) {
    scratch.hand.set(p.x, p.y + 1.0, p.z);
    setRope(scratch.bow, scratch.hand, .35);
  } else if (boatState.phase === 'waiting') {
    setRope(scratch.bow, person.position.clone().add(new THREE.Vector3(0, 1, 0)), .15);
  } else if (boatState.phase === 'selfTying') {
    setRope(scratch.bow, person.position.clone().add(new THREE.Vector3(0, 1, 0)), .3);
  } else if (boatState.phase === 'tied') {
    setRope(scratch.bow, scratch.post, .05);
  }
}

function update(dt, elapsed) {
  updateWaymarks(elapsed);
  for (const boat of farBoats) { // a slow bob on the current
    const t = elapsed + boat.userData.phase;
    boat.position.y = -.38 + Math.sin(t * .8) * .04;
    boat.rotation.z = Math.sin(t * .6) * .025;
  }
  if (['play', 'framing', 'ending', 'end'].includes(state.mode)) updateLanding(dt, elapsed);
  if (state.mode === 'play') {
    const vx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const vz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    const length = Math.hypot(vx,vz);
    if (length && !(state.revealT != null && state.revealT < 7.5)) { // the summit reveal holds him still
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6.7 : 4.7;
      // Walking is relative to the view: W always goes away from the camera.
      const cos = Math.cos(state.camYaw), sin = Math.sin(state.camYaw);
      const nx = (vx * cos + vz * sin) / length, nz = (vz * cos - vx * sin) / length;
      tryMove(nx * speed * dt, nz * speed * dt);
      traveller.rotation.y = Math.atan2(-nx,-nz);
      state.walkTime += dt;
      // A footstep at each foot fall (half a swing of the stride), wood underfoot on the bridge and floors.
      const stride = Math.floor(state.walkTime * 12 / Math.PI);
      if (stride !== state.lastStride) {
        state.lastStride = stride;
        cueStep(state.onBridge || state.floor != null ? 'wood' : 'earth');
      }
      playTravellerClip('walk', speed / 3.6);
      traveller.userData.feet[0].rotation.x = Math.sin(state.walkTime * 12) * .28;
      traveller.userData.feet[1].rotation.x = -Math.sin(state.walkTime * 12) * .28;
      traveller.position.y = groundUnder(traveller.position) + .16 + Math.abs(Math.sin(state.walkTime * 12)) * .025;
    } else {
      playTravellerClip('idle');
      traveller.userData.feet.forEach(foot => foot.rotation.x *= .8);
      traveller.position.y = THREE.MathUtils.lerp(traveller.position.y, groundUnder(traveller.position) + .16, .15);
    }

    const x = traveller.position.x, z = traveller.position.z;
    const bank = currentBank();
    frameToggle.hidden = !bank;
    if (bank) frameButtonText.textContent = shots[bank] ? '重取景' : '取景';
    const action = currentAction();
    actToggle.hidden = !action;
    if (action) actText.textContent = ACTION_LABELS[action];
    updateErrands(elapsed);
    if (!state.forkNotified && Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 3) {
      state.forkNotified = true;
      note('登上高岸');
      say('站在高处，长桥、渔船与对岸人家都在眼前。按 V 取景。', 5200);
    }
    if (!state.nearRiverNotified && z < 8.5 && z > 0 && x < 5) {
      state.nearRiverNotified = true;
      say('此处水深，须从桥上过去。', 3600);
    }
    if (state.onBridge) note('上桥');
    if (state.house?.hint && !logged.has(`走进${state.house.label}`)) {
      note(`走进${state.house.label}`);
      say(state.house.hint, 5600);
    }
    if (!state.bridgePavilionNotified && Math.abs(x - 8) < 1.5 && Math.abs(z - BRIDGE.z) < 1.6) {
      state.bridgePavilionNotified = true;
      note('到桥心亭');
      say('长桥中央，一座小亭临水而立。亭下流水，两岸青山，凭栏便可望见。', 5200);
    }
    if (!state.crossed && z < BRIDGE.z - BRIDGE.half - .2) {
      state.crossed = true;
      note('过桥到对岸');
      updateGoal();
      say('回望来路，长桥已在身后。桥边的船、岸上的人，都小了，渐渐与两岸山色融在一处。', 6000);
      if (errand.phase === 'carrying') setTimeout(() => {
        if (errand.phase === 'carrying') say('肩上的货，送到右手边山庄长屋的门前。', 5200);
      }, 6200);
    }
    if (state.pendingEndAt && performance.now() > state.pendingEndAt) win();

    // The follow camera orbits the traveller; dragging the mouse turns it (state.camYaw).
    const sin = Math.sin(state.camYaw), cos = Math.cos(state.camYaw);
    // Indoors (on a house floor) the camera comes in under the roof, stopping short of
    // any wall behind the traveller, instead of looking down through a faded roof.
    // Under the bridge pavilion (roof lifted in tools/edit_bridge.py v5, ceiling ≈ deck + 2.7)
    // a short, low third-person camera stays below the beams.
    const onStair = onSideStair(traveller.position);
    // On the waterside landing the view becomes the traveller's own eyes, looking out over the river
    // (playtest: the follow camera showed his back instead of the scenery). Drag still turns the view.
    const firstPerson = onStair && x < 2.4;
    if (state.mode === 'play') traveller.visible = !firstPerson;
    const underBridgeRoof = state.onBridge && !onStair && Math.abs(z - BRIDGE.z) < 6.3; // the hall, stretched with the bridge
    const indoors = state.floor != null || underBridgeRoof;
    const floorY = state.floor ?? groundUnder(traveller.position);
    let reach = underBridgeRoof ? 3.6 : onStair ? 3.4 : indoors ? 4.2 : 10.9;
    if (state.floor != null) {
      const back = houseHits(stepProbe.set(x, floorY + 1.75, z), stepDirection.set(sin, 0, cos), reach)[0];
      if (back) reach = Math.max(.2, back.distance - .3);
    }
    // Under the pavilion roof the camera stays in the centre aisle (columns stand either side),
    // behind the traveller along the bridge and above the hat.
    const along = Math.sign(cos) || 1;
    const across = Math.sign(sin) || 1; // on the side stair: behind the traveller, along the stair
    if (onStair && !firstPerson) {
      const want = across > 0 ? Math.PI / 2 : -Math.PI / 2;
      state.camYaw += Math.atan2(Math.sin(want - state.camYaw), Math.cos(want - state.camYaw)) * Math.min(1, dt * 6);
    }
    if (underBridgeRoof) { // playtest: dragged sideways, W pushed into the rail while the view looked down the aisle
      const want = along > 0 ? 0 : Math.PI;
      state.camYaw += Math.atan2(Math.sin(want - state.camYaw), Math.cos(want - state.camYaw)) * Math.min(1, dt * 6);
    }
    // Walking off the pavilion, a long follow camera would trail back into its roof: keep it
    // on the traveller's side of the pavilion until the traveller is well clear.
    if (state.onBridge && !underBridgeRoof && Math.sign(z - BRIDGE.z) === -along) reach = Math.min(reach, Math.max(3.2, Math.abs(z - BRIDGE.z) - 7.3));
    // Under the hall: off the right shoulder (columns stand ~2.5 out each side), head clear of the roof line.
    const cx = underBridgeRoof ? BRIDGE.x - along * .85 : onStair ? x + across * reach : x + sin * reach;
    const cz = underBridgeRoof ? z + along * reach : onStair ? SIDE_STAIR.z + .45 : z + cos * reach;
    const onBridge = state.onBridge;
    // A camera hovering over the bridge (player just off it) lifts above the pavilion
    // roof; otherwise the roof can fill the entire view.
    const clearingRoof = !onBridge && Math.abs(cx - 8) < 4.8 && Math.abs(cz - BRIDGE.z) < 7.5;
    // Backed against a wall the camera rises to look over the traveller's hat.
    const cameraHeight = underBridgeRoof ? 1.95 : onStair ? 2.1 : indoors ? (reach < 1.5 ? 2.15 : 1.75) : clearingRoof ? 9.2 : (onBridge ? 4.5 : 5.9);
    // Ride over whichever is higher, the ground under the player or under the camera.
    const ground = indoors ? floorY : Math.max(groundUnder(traveller.position), heightAt(cx, cz));
    const targetCamera = new THREE.Vector3(cx, ground + cameraHeight, cz);
    // On the peak a shoulder of hillside can sit between camera and traveller: lift the
    // camera until the sightline from the traveller's head clears the slope.
    if (!indoors && !onBridge) {
      const head = groundUnder(traveller.position) + 1.25;
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const slope = heightAt(x + (cx - x) * t, z + (cz - z) * t) + 1.1;
        if (slope > head) targetCamera.y = Math.max(targetCamera.y, head + (slope - head) / t);
      }
    }
    if (firstPerson) targetCamera.set(x, groundUnder(traveller.position) + 1.55, z);
    camera.position.lerp(targetCamera, Math.min(1, dt * (clearingRoof ? 7 : 4.2)));
    const followTarget = firstPerson
      ? new THREE.Vector3(x - sin * 10, groundUnder(traveller.position) + 1.2, z - cos * 10) // out over the water
      : underBridgeRoof
      ? new THREE.Vector3(BRIDGE.x - along * .4, groundUnder(traveller.position) + 1.7, z - along * 6) // down the passage
      : onStair ? new THREE.Vector3(x - across * 6, groundUnder(traveller.position) + 1.3, SIDE_STAIR.z)
      : new THREE.Vector3(x - sin * 5.2, groundUnder(traveller.position) + (indoors ? 1.45 : 1.25), z - cos * 5.2);
    // 登顶 (the climax): the first time on the summit terrace the camera rises and draws back over
    // his shoulder until the whole landscape lies open toward the bridge, then hands control back.
    if (!state.summitRevealed && Math.hypot(x - SUMMIT_TERRACE.x, z - SUMMIT_TERRACE.z) < SUMMIT_TERRACE.r - 1) {
      state.summitRevealed = true;
      state.revealT = 0;
      // playtest: the summit chord over the reveal was too sudden; the music carries it instead.
      say('到了山顶，眼前豁然开阔。长桥、村舍与来时的山路，都在群山之间。', 5600);
    }
    if (state.revealT != null && state.revealT < 7.5) {
      state.revealT += dt;
      const r = state.revealT, a = smooth(0, 2.4, r) * (1 - smooth(5.6, 7.5, r));
      const base = new THREE.Vector3(SUMMIT_TERRACE.x, groundUnder(traveller.position), SUMMIT_TERRACE.z);
      const eye = base.clone().addScaledVector(SUMMIT_FACING, -9 - 5 * smooth(0, 5, r)).add(new THREE.Vector3(0, 9 + 6 * smooth(0, 5, r), 0));
      const look = base.clone().addScaledVector(SUMMIT_FACING, 70).add(new THREE.Vector3(0, -18, 0));
      camera.position.lerp(eye, a);
      followTarget.lerp(look, a);
    }
    camera.lookAt(followTarget);
    fadeOccluders(dt, camera.position, traveller.position.clone().add(new THREE.Vector3(0, 1, 0)));
  } else if (state.mode === 'framing') {
    const horizontal = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const vertical = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
    state.frameYaw += horizontal * dt * 1.55;
    state.framePitch = THREE.MathUtils.clamp(state.framePitch + vertical * dt * .85, -.68, .62);
    updateFrameCamera();
    refreshFrameFeedback();
  } else if (state.mode === 'rujuan') {
    updateRujuan(dt);
  } else if (state.mode === 'ending') {
    state.endTime += dt;
    camera.position.lerp(new THREE.Vector3(4, 37, 16), Math.min(1, dt * 1.8));
    camera.lookAt(4, 0, BRIDGE.z);
    if (state.endTime > 2.15) {
      state.mode = 'end';
      show(endScreen);
      document.getElementById('rujuan-button').focus({ preventScroll: true });
    }
  } else if (state.mode === 'recipe') {
    const narrow = window.innerWidth < 700;
    camera.position.lerp(narrow ? new THREE.Vector3(-2, 17, 30) : new THREE.Vector3(-16, 9.5, 32), Math.min(1, dt * 1.2));
    // On a phone the sheet covers the lower 60%, so the camera tips down to lift the scene.
    camera.lookAt(narrow ? new THREE.Vector3(8, -7.5, -8) : new THREE.Vector3(15, 2.6, -14));
  } else if (state.mode === 'start') {
    // The cover: the same three distances as the ending drift behind the title, slower.
    state.coverT = (state.coverT ?? 0) + dt;
    const shot = landscapeShot(state.coverT, 11);
    coverDip.style.opacity = (shot.dip * .9).toFixed(3);
    if (shot.k !== state.coverShot) {
      state.coverShot = shot.k;
      const [name, line] = YUAN[shot.k];
      yuanBox.style.opacity = 0;
      setTimeout(() => { yuanName.textContent = name; yuanLine.textContent = line; yuanBox.style.opacity = 1; }, 500);
    }
  }
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  if (state.mode === 'framing') refreshFrameFeedback();
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', event => {
  if (state.mode === 'play' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
  if (state.mode === 'framing' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
    return;
  }
  if (state.mode === 'scroll' && ['ArrowLeft','ArrowRight'].includes(event.code)) {
    event.preventDefault();
    if (document.activeElement === originalTab || document.activeElement === routeTab) {
      selectScrollView(event.code === 'ArrowLeft' ? 'original' : 'route');
      (scrollView === 'original' ? originalTab : routeTab).focus();
      return;
    }
    setScrollStage(scrollStage + (event.code === 'ArrowLeft' ? 1 : -1));
    cueUnroll();
    return;
  }
  if (event.repeat && ['KeyM','KeyV','KeyE','Space','Escape'].includes(event.code)) return;
  if (event.code === 'KeyE' && state.mode === 'play') {
    event.preventDefault();
    interact();
  } else if (event.code === 'KeyV') {
    event.preventDefault();
    if (state.mode === 'play') openFraming();
    else if (state.mode === 'framing') closeFraming();
  } else if (event.code === 'Space' && state.mode === 'framing') {
    event.preventDefault();
    captureFrame();
  } else if (event.code === 'KeyM' && state.mode === 'framing') {
    event.preventDefault();
    closeFraming();
    openScroll();
  } else if (event.code === 'KeyM') {
    event.preventDefault();
    if (state.mode === 'play') openScroll();
    else if (state.mode === 'scroll') returnToWorld();
  } else if (event.code === 'Escape' && state.mode === 'rujuan') {
    event.preventDefault();
    rj.t = Math.max(rj.t, 21);
  } else if (event.code === 'Escape' && state.mode === 'inscribe') {
    event.preventDefault();
    closeInscribe('');
  } else if (event.code === 'Escape' && state.mode === 'framing') {
    event.preventDefault();
    closeFraming();
  } else if (event.code === 'Escape') {
    if (state.mode === 'play') pause();
    else if (state.mode === 'pause') resume();
    else if (state.mode === 'scroll') returnToWorld();
  } else if (state.mode === 'play') keys.add(event.code);
});
inscribeScreen.querySelectorAll('.inscribe-choice').forEach(button => button.addEventListener('click', () => closeInscribe(button.dataset.line)));
document.getElementById('inscribe-cancel').addEventListener('click', () => closeInscribe(''));
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); frameDrag = null; });
canvas.addEventListener('pointerdown', event => {
  if (state.mode !== 'framing' && state.mode !== 'play') return;
  frameDrag = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!frameDrag) return;
  const dx = event.clientX - frameDrag.x;
  if (state.mode === 'framing') {
    state.frameYaw += dx * .006;
    state.framePitch = THREE.MathUtils.clamp(state.framePitch - (event.clientY - frameDrag.y) * .0045, -.68, .62);
  } else if (state.mode === 'play') {
    state.camYaw -= dx * .006;
    state.dragTurn += Math.abs(dx * .006);
  }
  frameDrag = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', () => { frameDrag = null; });
canvas.addEventListener('pointercancel', () => { frameDrag = null; });
startButton.addEventListener('click', startGame);
recipeGo.addEventListener('click', startGame);
scrollToggle.addEventListener('click', openScroll);
frameToggle.addEventListener('click', openFraming);
closeScroll.addEventListener('click', returnToWorld);
unrollLeft.addEventListener('click', () => { setScrollStage(scrollStage + 1); cueUnroll(); });
unrollRight.addEventListener('click', () => { setScrollStage(scrollStage - 1); cueUnroll(); });
originalTab.addEventListener('click', () => { selectScrollView('original'); cueUnroll(); });
routeTab.addEventListener('click', () => { selectScrollView('route'); cueUnroll(); });
function showSoundState() {
  soundToggle.textContent = isMuted() ? '声音：关' : '声音：开';
  soundToggle.setAttribute('aria-pressed', String(!isMuted()));
  soundToggle.setAttribute('aria-label', isMuted() ? '开启环境音' : '关闭环境音');
}
soundToggle.addEventListener('click', async () => {
  if (!isMuted()) {
    setMuted(true);
  } else {
    setMuted(false);
    if (!await startAudio()) {
      setMuted(true);
      say('这个浏览器暂时无法播放环境音。', 2800);
    }
  }
  soundToggle.textContent = isMuted() ? '声音：关' : '声音：开';
  soundToggle.setAttribute('aria-pressed', String(!isMuted()));
  soundToggle.setAttribute('aria-label', isMuted() ? '开启环境音' : '关闭环境音');
});
takeFrame.addEventListener('click', captureFrame);
leaveFrame.addEventListener('click', closeFraming);
resumeButton.addEventListener('click', resume);
pauseRestartButton.addEventListener('click', startGame);
endRestartButton.addEventListener('click', startGame);
document.getElementById('rujuan-button').addEventListener('click', startRujuan);
document.getElementById('rujuan-scroll').addEventListener('click', () => closeRujuan(true));
document.getElementById('rujuan-restart').addEventListener('click', () => closeRujuan(false));
endReturnButton.addEventListener('click', backToWorld);
actToggle.addEventListener('click', interact);
saveScroll.addEventListener('click', downloadScroll);
copyLogButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(`${elapsedTime.textContent}\n${playLog.join('\n')}`);
    copyLogButton.textContent = '已复制';
  } catch {
    copyLogButton.textContent = '复制失败，请手抄';
  }
});

// QA only: open with ?qa to inspect/teleport from the console. Players never see it.
if (new URLSearchParams(location.search).has('qa')) {
  let qaElapsed = 0;
  // Advance the simulation without requestAnimationFrame (e.g. in a hidden tab).
  const step = seconds => {
    for (let t = 0; t < seconds; t += .05) { qaElapsed += .05; frame(.05, qaElapsed); }
  };
  window.__qa = { scene, errand, pickups, traveller, houses, houseHits, state, boatState, shots, playLog, heightAt, camera, step, applyRecipe, recipe, landing };
}

resize();
show(startScreen);
function animate() {
  requestAnimationFrame(animate);
  frame(Math.min(clock.getDelta(), .05), clock.elapsedTime);
}
function frame(dt, elapsed) {
  update(dt, elapsed);
  travellerRig.mixer?.update(dt);
  boatRig.mixer?.update(dt);
  PAINTER.rig?.mixer.update(dt);
  placePole();
  updateCoach();
  if (state.mode === 'play') updateGoal();
  U.uTime.value += dt;
  footShadow.visible = traveller.visible;
  U.uFocus.value.set(traveller.position.x, traveller.position.y + 1, traveller.position.z);
  updateTreeModels();
  footShadow.position.set(traveller.position.x, groundUnder(traveller.position) + .05, traveller.position.z);
  sky.position.copy(camera.position);
  sortTransparent();
  updateLivePainting(performance.now());
  mirror();
  renderer.render(scene,camera);
}
animate();
