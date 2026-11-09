// Original, synthesized sound for 入卷. No samples, recordings, or music files.
// Audio is not created or played until startAudio() is called from a user gesture.

let context = null;
let master = null;
let musicBus = null;
let noiseBuffer = null;
let muted = true;
let scoreTimer = null;
let scoreSeed = 0x71315160;
let scorePosition = 3;

// C–D–E–G–A across two registers: five pitch classes, no borrowed tune.
const pentatonicHz = [130.81, 146.83, 164.81, 196, 220, 261.63, 293.66];

function audioConstructor() {
  return globalThis.AudioContext || globalThis.webkitAudioContext;
}

function makeNoiseBuffer(ctx) {
  const length = Math.round(ctx.sampleRate * 6);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x5160cafe;
  for (let i = 0; i < length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  // Join the loop ends gently; filtering further conceals the join.
  const join = Math.min(2048, Math.floor(length / 20));
  for (let i = 0; i < join; i++) {
    const t = i / (join - 1);
    data[length - join + i] = data[length - join + i] * (1 - t) + data[0] * t;
  }
  return buffer;
}

function makeAmbience(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 430;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.07;
  source.connect(windFilter).connect(windGain).connect(master);

  const waterFilter = ctx.createBiquadFilter();
  waterFilter.type = 'bandpass';
  waterFilter.frequency.value = 820;
  waterFilter.Q.value = 0.65;
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0.06;
  source.connect(waterFilter).connect(waterGain).connect(master);

  const windPulse = ctx.createOscillator();
  windPulse.type = 'sine';
  windPulse.frequency.value = 0.11;
  const windDepth = ctx.createGain();
  windDepth.gain.value = 0.016;
  windPulse.connect(windDepth).connect(windGain.gain);

  const waterPulse = ctx.createOscillator();
  waterPulse.type = 'sine';
  waterPulse.frequency.value = 0.16;
  const waterDepth = ctx.createGain();
  waterDepth.gain.value = 0.009;
  waterPulse.connect(waterDepth).connect(waterGain.gain);

  source.start();
  windPulse.start();
  waterPulse.start();
}

function setMasterLevel() {
  if (!context || !master) return;
  const gain = master.gain;
  const now = context.currentTime;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(muted ? 0 : 0.6, now, muted ? 0.08 : 0.35); // clearly audible on laptop speakers
}

function scoreRandom() {
  scoreSeed ^= scoreSeed << 13;
  scoreSeed ^= scoreSeed >>> 17;
  scoreSeed ^= scoreSeed << 5;
  return scoreSeed >>> 0;
}

function stopScoreTimer() {
  if (scoreTimer !== null) clearTimeout(scoreTimer);
  scoreTimer = null;
}

function canPlayScore() {
  return context?.state === 'running' && !muted &&
    (typeof document === 'undefined' || !document.hidden);
}

function pluckPentatonicTone() {
  const move = [-2, -1, -1, 1, 1, 2][scoreRandom() % 6];
  scorePosition += move;
  if (scorePosition < 0) scorePosition = 1;
  if (scorePosition >= pentatonicHz.length) scorePosition = pentatonicHz.length - 2;
  const frequency = pentatonicHz[scorePosition];
  const at = context.currentTime + 0.01;
  const length = 2.15;

  // Two quiet synthesized partials and a brief decay suggest a plucked string.
  // This is not a recording or acoustic model of a guqin.
  const fundamental = context.createOscillator();
  fundamental.type = 'triangle';
  fundamental.frequency.setValueAtTime(frequency * 1.006, at);
  fundamental.frequency.exponentialRampToValueAtTime(frequency, at + 0.1);
  const harmonic = context.createOscillator();
  harmonic.type = 'sine';
  harmonic.frequency.value = frequency * 2.01;
  const harmonicGain = context.createGain();
  harmonicGain.gain.value = 0.13;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.linearRampToValueAtTime(0.05, at + 0.009);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
  fundamental.connect(envelope);
  harmonic.connect(harmonicGain).connect(envelope);
  envelope.connect(musicBus);
  fundamental.start(at);
  harmonic.start(at);
  fundamental.stop(at + length + 0.02);
  harmonic.stop(at + length + 0.02);
  fundamental.onended = () => {
    fundamental.disconnect();
    harmonic.disconnect();
    harmonicGain.disconnect();
    envelope.disconnect();
  };
}

function scheduleScore(initial = false) {
  if (scoreTimer !== null || !canPlayScore()) return;
  // Long, variable rests preserve the landscape's quiet and avoid a tiring loop.
  const delay = initial ? 3500 : 6800 + (scoreRandom() % 6400);
  scoreTimer = setTimeout(() => {
    scoreTimer = null;
    if (!canPlayScore()) return;
    pluckPentatonicTone();
    scheduleScore();
  }, delay);
}

/** Call directly inside a click/touch/key handler. Sound remains muted until setMuted(false). */
export async function startAudio() {
  if (!audioConstructor()) return false;
  try {
    if (!context) {
      context = new (audioConstructor())();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      musicBus = context.createGain();
      musicBus.gain.value = 0.42;
      musicBus.connect(master);
      noiseBuffer = makeNoiseBuffer(context);
      makeAmbience(context);
      scheduleBirds();
    }
    if (context.state !== 'running') await context.resume();
    setMasterLevel();
    scheduleScore(true);
    return context.state === 'running';
  } catch {
    return false;
  }
}

/** Defaults to true. This does not create or resume an AudioContext. */
export function setMuted(value) {
  muted = Boolean(value);
  setMasterLevel();
  if (muted) stopScoreTimer();
  else scheduleScore(true);
  return muted;
}

export function isMuted() {
  return muted;
}

function canPlayCue() {
  return context?.state === 'running' && !muted && master && noiseBuffer;
}

function rustle(at, length, peak, frequency) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 0.48;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.linearRampToValueAtTime(peak, at + length * 0.24);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(envelope).connect(master);
  source.start(at, Math.random() * 4.5, length);
  source.stop(at + length + 0.02);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
}

/** A soft paper-unrolling gesture, not an environmental sound recording. */
export function cueUnroll() {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.01;
  rustle(at, 0.72, 0.065, 1180);
  rustle(at + 0.28, 0.58, 0.037, 1910);
  return true;
}

function bell(at, frequency, peak, length) {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, at);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.linearRampToValueAtTime(peak, at + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(envelope).connect(master);
  oscillator.start(at);
  oscillator.stop(at + length + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

/** Quiet two-note confirmation when the player keeps a view. */
export function cueCapture() {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.01;
  bell(at, 587.33, 0.10, 0.48);
  bell(at + 0.10, 880, 0.065, 0.72);
  return true;
}

/** A low wooden knock and a short rope rustle when the boat line is tied. */
export function cueRope() {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.01;
  rustle(at, 0.34, 0.05, 620);
  bell(at + 0.16, 196, 0.09, 0.28);
  return true;
}

/** Birds now and then across the valley: two to four quick rising chirps, high and quiet. */
let birdTimer = null;
function scheduleBirds() {
  if (birdTimer !== null) return;
  const next = () => {
    birdTimer = setTimeout(() => {
      if (canPlayCue()) {
        const at = context.currentTime + 0.02, n = 2 + Math.floor(Math.random() * 3), base = 2400 + Math.random() * 1500;
        for (let i = 0; i < n; i++) {
          const o = context.createOscillator(), g = context.createGain(), t = at + i * (0.09 + Math.random() * 0.05);
          o.type = 'sine';
          o.frequency.setValueAtTime(base, t);
          o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.06);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.04, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          o.connect(g).connect(master);
          o.start(t);
          o.stop(t + 0.1);
          o.onended = () => { o.disconnect(); g.disconnect(); };
        }
      }
      birdTimer = null;
      next();
    }, 5000 + Math.random() * 9000);
  };
  next();
}

/** A wide, slow chord with a breath of wind when the summit opens out. */
export function cueSummit() {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.02;
  rustle(at, 2.6, 0.05, 520);
  bell(at + 0.1, 220, 0.07, 3.2);
  bell(at + 0.5, 329.63, 0.06, 3.0);
  bell(at + 0.9, 440, 0.05, 2.8);
  bell(at + 1.4, 659.25, 0.04, 2.6);
  return true;
}

/** A footstep timed to the stride: a hollow knock on wood (bridge, floors), a soft brush on earth and grass. */
export function cueStep(surface) {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.005, j = 0.85 + Math.random() * 0.3;
  if (surface === 'wood') {
    bell(at, 150 * j, 0.06, 0.09);
    rustle(at, 0.07, 0.035, 1500 * j);
  } else {
    rustle(at, 0.11, 0.045, 520 * j);
  }
  return true;
}

/** Picking something up or handing it over: a light paper rustle and two rising notes. */
export function cuePickup() {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.01;
  rustle(at, 0.25, 0.04, 1600);
  bell(at + 0.05, 659.25, 0.07, 0.4);
  bell(at + 0.16, 987.77, 0.05, 0.55);
  return true;
}

/** Longer, restrained arrival cue for the completed handscroll. */
export function cueArrival() {
  if (!canPlayCue()) return false;
  const at = context.currentTime + 0.01;
  bell(at, 440, 0.07, 0.62);
  bell(at + 0.19, 659.25, 0.08, 0.82);
  bell(at + 0.38, 880, 0.055, 1.05);
  return true;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden && context.state === 'running') {
      stopScoreTimer();
      void context.suspend().catch(() => {});
    } else if (!document.hidden && !muted && context.state === 'suspended') {
      // This only resumes a context that a previous user gesture started.
      void context.resume().then(() => scheduleScore(true)).catch(() => {});
    }
  });
}
