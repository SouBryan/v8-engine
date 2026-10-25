/**
 * main.js
 * ---------------------------------------------------------------------------
 * Application bootstrap: renderer, scene, cameras, controls, UI wiring and
 * the master animation loop.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { createEngine } from './engine.js';
import { createWorkshop } from './workshop.js';
import { FirstPersonControls } from './firstPerson.js';

/* ===================================================================== */
/* RENDERER                                                              */
/* ===================================================================== */

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* ===================================================================== */
/* SCENE                                                                 */
/* ===================================================================== */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d10);
scene.fog = new THREE.Fog(0x0c0d10, 26, 52);

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.045);
scene.environment = envRT.texture;

/* ---- camera ---- */
const camera = new THREE.PerspectiveCamera(
  48,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(7.4, 5.4, 8.6);

/* ---- orbit ---- */
const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 3.35, 0);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.minDistance = 3.0;
orbit.maxDistance = 26;
orbit.maxPolarAngle = Math.PI * 0.495;
orbit.zoomSpeed = 0.85;
orbit.update();

/* ---- world ---- */
const workshop = createWorkshop(scene);

/* ---- engine ---- */
const engine = createEngine();
engine.root.position.set(0, 2.22, 0);
engine.root.updateMatrixWorld(true);
scene.add(engine.root);

/* ===================================================================== */
/* FIRST PERSON                                                          */
/* ===================================================================== */

const fp = new FirstPersonControls(camera, canvas);
fp.position.set(7.0, 0, 7.8);
fp.yaw = Math.PI * 0.75;
fp.pitch = -0.12;
fp.addBlocker(
  new THREE.Vector3(-4.2, 0, -3.6),
  new THREE.Vector3(4.2, 4.0, 3.6)
);

/* ===================================================================== */
/* STATE                                                                 */
/* ===================================================================== */

const state = {
  running: false,
  rpmTarget: 900,
  rpm: 0,
  crank: 0,
  slowMo: false,
  mode: 'orbit',
  cutTarget: 0,
  cutValue: 0,
  explodeTarget: 0,
  explodeValue: 0,
};

/* ===================================================================== */
/* UI                                                                    */
/* ===================================================================== */

const $ = (id) => document.getElementById(id);

const btnStart = $('btnStart');
const btnCam = $('btnCam');
const btnCut = $('btnCut');
const btnExp = $('btnExp');
const btnAssemble = $('btnAssemble');
const btnSlow = $('btnSlow');
const btnReset = $('btnReset');
const rpmSlider = $('rpm');
const rpmVal = $('rpmVal');
const led = $('led');
const hud = $('hud');
const hintText = $('hintText');

/* crosshair element (created here so index.html stays tidy) */
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
document.body.appendChild(crosshair);

function updateSliderFill() {
  const pct = (rpmSlider.value / rpmSlider.max) * 100;
  rpmSlider.style.setProperty('--fill', pct + '%');
}

function setRunning(on) {
  state.running = on;
  btnStart.textContent = on ? 'STOP' : 'START';
  btnStart.classList.toggle('running', on);
  led.classList.toggle('on', on);
}

btnStart.addEventListener('click', () => setRunning(!state.running));

rpmSlider.addEventListener('input', () => {
  state.rpmTarget = parseFloat(rpmSlider.value);
  rpmVal.textContent = Math.round(state.rpmTarget);
  updateSliderFill();
});
updateSliderFill();

btnCut.addEventListener('click', () => {
  state.cutTarget = state.cutTarget > 0.5 ? 0 : 1;
  btnCut.classList.toggle('active', state.cutTarget > 0.5);
});

btnExp.addEventListener('click', () => {
  state.explodeTarget = state.explodeTarget > 0.5 ? 0 : 1;
  btnExp.classList.toggle('active', state.explodeTarget > 0.5);
});

btnAssemble.addEventListener('click', () => {
  state.explodeTarget = 0;
  state.cutTarget = 0;
  btnExp.classList.remove('active');
  btnCut.classList.remove('active');
});

btnSlow.addEventListener('click', () => {
  state.slowMo = !state.slowMo;
  btnSlow.classList.toggle('active', state.slowMo);
});

function setMode(mode) {
  state.mode = mode;
  const walking = mode === 'walk';

  orbit.enabled = !walking;
  fp.setEnabled(walking);
  document.body.classList.toggle('walking', walking);

  btnCam.textContent = walking ? 'ORBIT MODE' : 'WALK MODE';
  btnCam.classList.toggle('active', walking);

  hintText.textContent = walking
    ? 'WASD to walk · Shift to run · Mouse to look · Click to lock cursor'
    : 'Drag to orbit · Scroll to zoom · Click a part to inspect';

  if (walking) {
    // start from wherever the orbit camera currently is
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    fp.position.set(camera.position.x, 0, camera.position.z);
    fp.yaw = Math.atan2(-dir.x, -dir.z);
    fp.pitch = -0.08;
    // keep the walker inside the room
    fp.position.x = Math.max(fp.bounds.minX, Math.min(fp.bounds.maxX, fp.position.x));
    fp.position.z = Math.max(fp.bounds.minZ, Math.min(fp.bounds.maxZ, fp.position.z));
    fp.applyToCamera();
  } else {
    orbit.target.set(0, 3.35, 0);
    orbit.update();
  }
}

btnCam.addEventListener('click', () => {
  setMode(state.mode === 'orbit' ? 'walk' : 'orbit');
});

btnReset.addEventListener('click', () => {
  if (state.mode === 'walk') setMode('orbit');
  camera.position.set(7.4, 5.4, 8.6);
  orbit.target.set(0, 3.35, 0);
  orbit.update();
});

/* ===================================================================== */
/* PART INSPECTION                                                       */
/* ===================================================================== */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let highlighted = [];
let currentPart = null;
let hudTimer = null;
let downPos = { x: 0, y: 0 };

function clearHighlight() {
  for (const m of highlighted) {
    if (m.material && m.material.emissive) {
      m.material.emissive.setHex(m.userData._origEmissive ?? 0x000000);
      m.material.emissiveIntensity = m.userData._origEmissiveIntensity ?? 1;
    }
  }
  highlighted = [];
}

function findPart(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.partName) return o;
    o = o.parent;
  }
  return null;
}

function showHud(text) {
  hud.textContent = text;
  hud.classList.add('show');
  if (hudTimer) clearTimeout(hudTimer);
  hudTimer = setTimeout(() => hud.classList.remove('show'), 2600);
}

function highlightPart(group) {
  clearHighlight();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData._ownMat) {
      o.material = o.material.clone();
      o.userData._ownMat = true;
    }
    o.userData._origEmissive = o.material.emissive ? o.material.emissive.getHex() : 0;
    o.userData._origEmissiveIntensity = o.material.emissiveIntensity ?? 1;
    if (o.material.emissive) {
      o.material.emissive.setHex(0x2b5cff);
      o.material.emissiveIntensity = 1.15;
    }
    highlighted.push(o);
  });
}

canvas.addEventListener('pointerdown', (e) => {
  downPos.x = e.clientX;
  downPos.y = e.clientY;
});

canvas.addEventListener('pointerup', (e) => {
  // ignore drags / orbit gestures
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 5) return;
  if (state.mode === 'walk' && document.pointerLockElement === canvas) return;

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(engine.root, true);

  if (hits.length === 0) {
    clearHighlight();
    currentPart = null;
    hud.classList.remove('show');
    return;
  }

  const part = findPart(hits[0].object);
  if (!part) return;

  if (currentPart === part) {
    clearHighlight();
    currentPart = null;
    hud.classList.remove('show');
    return;
  }

  currentPart = part;
  highlightPart(part);
  showHud(part.userData.partName);
});

/* ===================================================================== */
/* RESIZE                                                                */
/* ===================================================================== */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===================================================================== */
/* ANIMATION LOOP                                                        */
/* ===================================================================== */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  /* ---- rpm smoothing ---- */
  const target = state.running ? state.rpmTarget : 0;
  state.rpm += (target - state.rpm) * Math.min(1, dt * 2.2);
  if (!state.running && state.rpm < 1) state.rpm = 0;

  /* ---- crank rotation ---- */
  const timeScale = state.slowMo ? 0.09 : 1;
  state.crank += (state.rpm / 60) * Math.PI * 2 * dt * timeScale;
  state.crank %= Math.PI * 2 * 720; // keep the number bounded

  engine.update(state.crank);

  /* ---- smooth cutaway / explode ---- */
  state.cutValue += (state.cutTarget - state.cutValue) * Math.min(1, dt * 4.0);
  if (Math.abs(state.cutValue - state.cutTarget) < 0.002) state.cutValue = state.cutTarget;
  engine.setCutaway(state.cutValue);

  state.explodeValue += (state.explodeTarget - state.explodeValue) * Math.min(1, dt * 3.2);
  if (Math.abs(state.explodeValue - state.explodeTarget) < 0.002) state.explodeValue = state.explodeTarget;
  engine.setExplode(state.explodeValue);

  /* ---- camera ---- */
  if (state.mode === 'walk') {
    fp.update(dt);
  } else {
    orbit.update();
  }

  /* ---- live rpm readout ---- */
  rpmVal.textContent = Math.round(state.rpm);

  renderer.render(scene, camera);
}

animate();

/* ===================================================================== */
/* BOOT                                                                  */
/* ===================================================================== */

setMode('orbit');
setRunning(false);
state.rpmTarget = parseFloat(rpmSlider.value);
rpmVal.textContent = Math.round(state.rpmTarget);
showHud('V8 Engine · Ready');
