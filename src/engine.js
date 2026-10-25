/**
 * engine.js
 * ---------------------------------------------------------------------------
 * Procedural 90° V8 combustion engine.
 *
 * Everything is generated from parameters — no external models.
 *
 * Coordinate convention (engine local space):
 *   +Y  = up (cylinder bank axis is tilted ±45° from this)
 *   +Z  = crankshaft axis (engine length)
 *   origin = crankshaft centreline
 *
 * Each cylinder bank is a Group rotated about Z by ±45°. Inside that group the
 * local +Y axis IS the bore axis, which makes piston / rod / valve math trivial.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BANK = Math.PI / 4;

/* ---- mechanical constants (engine units ≈ 10 cm per unit) ---- */
const R = 0.55;        // crankshaft throw radius (half stroke)
const L = 2.0;         // connecting rod centre-to-centre length
const BORE = 0.52;     // cylinder bore radius
const SPACING = 1.75;  // cylinder spacing along Z
const DECK = 3.0;      // deck height measured along the bank axis
const CROWN = 0.30;    // piston crown offset above the gudgeon pin
const UP = new THREE.Vector3(0, 1, 0);

const TAU = Math.PI * 2;

/* bank-local -> engine-local helper */
function toWorld(bankIdx, x, y, z) {
  const a = bankIdx === 0 ? -BANK : BANK;
  const c = Math.cos(a), s = Math.sin(a);
  return new THREE.Vector3(x * c - y * s, x * s + y * c, z);
}

/* valve lift curve — returns 0..maxL */
function liftAt(psi, open, dur, maxL) {
  const FOUR_PI = TAU * 2;
  let a = psi - open;
  a = ((a % FOUR_PI) + FOUR_PI) % FOUR_PI;
  if (a > dur) return 0;
  return maxL * 0.5 * (1 - Math.cos(TAU * a / dur));
}

export function createEngine() {
  const root = new THREE.Group();
  root.name = 'V8Engine';

  const cutMats = [];          // materials faded in cutaway mode
  const explodeItems = [];     // { obj, base, dir, amount }
  const cylinders = [];        // per-cylinder animation records
  const camLobes = [];         // { mesh, localRot }

  /* =====================================================================
     MATERIALS
     ===================================================================== */

  const steel   = new THREE.MeshStandardMaterial({ color: 0xdadee3, metalness: 1.0, roughness: 0.13 });
  const steelD  = new THREE.MeshStandardMaterial({ color: 0x878d95, metalness: 1.0, roughness: 0.34 });
  const pistonM = new THREE.MeshStandardMaterial({ color: 0xacb1b8, metalness: 0.95, roughness: 0.26 });
  const ringM   = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.9, roughness: 0.55 });
  const linerM  = new THREE.MeshStandardMaterial({ color: 0x5c626a, metalness: 0.9, roughness: 0.42, side: THREE.DoubleSide });
  const copperM = new THREE.MeshStandardMaterial({ color: 0xa8642f, metalness: 1.0, roughness: 0.3 });
  const rubberM = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.0, roughness: 0.96 });
  const brassM  = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1.0, roughness: 0.3 });
  const blackM  = new THREE.MeshStandardMaterial({ color: 0x1b1e22, metalness: 0.35, roughness: 0.7 });

  const cut = (mat) => { cutMats.push(mat); return mat; };

  const blockM  = cut(new THREE.MeshStandardMaterial({ color: 0x5b6067, metalness: 0.55, roughness: 0.62 }));
  const headM   = cut(new THREE.MeshStandardMaterial({ color: 0x9ba1a9, metalness: 0.85, roughness: 0.40 }));
  const coverM  = cut(new THREE.MeshStandardMaterial({ color: 0x8e2020, metalness: 0.45, roughness: 0.40 }));
  const intakeM = cut(new THREE.MeshStandardMaterial({ color: 0xb2b8bf, metalness: 0.9,  roughness: 0.33 }));
  const exhM    = cut(new THREE.MeshStandardMaterial({ color: 0x8b9199, metalness: 0.95, roughness: 0.28 }));
  const panM    = cut(new THREE.MeshStandardMaterial({ color: 0x393d43, metalness: 0.6,  roughness: 0.60 }));
  const timingM = cut(new THREE.MeshStandardMaterial({ color: 0x6d737a, metalness: 0.8,  roughness: 0.45 }));

  /* =====================================================================
     HELPERS
     ===================================================================== */

  const RBox = (w, h, d, r = 0.06) =>
    new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45));

  function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function registerExplode(obj, dir, amount = 1) {
    explodeItems.push({ obj, base: obj.position.clone(), dir: dir.clone().normalize(), amount });
  }

  function tagPart(obj, name) {
    obj.userData.partName = name;
    return obj;
  }

  /* =====================================================================
     CRANKSHAFT
     ===================================================================== */

  const crankGroup = new THREE.Group();
  crankGroup.name = 'crankshaft';
  root.add(crankGroup);

  // 5 main journals
  for (let i = 0; i < 5; i++) {
    const z = (i - 2) * SPACING;
    const j = mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.48, 28), steel);
    j.rotation.x = Math.PI / 2;
    j.position.z = z;
    crankGroup.add(j);
  }

  // 4 throws (cross-plane, 90° apart) — each carries two rods (one per bank)
  for (let t = 0; t < 4; t++) {
    const z = (t - 1.5) * SPACING;
    const phi = t * Math.PI / 2;
    const px = R * Math.cos(phi);
    const py = R * Math.sin(phi);

    const pin = mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.94, 26), steel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(px, py, z);
    crankGroup.add(pin);

    for (const s of [-1, 1]) {
      const wz = z + s * 0.52;

      const web = mesh(RBox(1.72, 0.82, 0.20, 0.08), steelD);
      web.position.set(px * 0.5, py * 0.5, wz);
      web.rotation.z = phi;
      crankGroup.add(web);

      const cw = mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.20, 30), steelD);
      cw.rotation.x = Math.PI / 2;
      cw.position.set(-px * 0.60, -py * 0.60, wz);
      crankGroup.add(cw);
    }
  }

  // snout + rear flange
  const snout = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 20), steel);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = -3.95;
  crankGroup.add(snout);

  const flange = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 32), steelD);
  flange.rotation.x = Math.PI / 2;
  flange.position.z = 3.62;
  crankGroup.add(flange);

  tagPart(crankGroup, 'Crankshaft');

  /* =====================================================================
     BLOCK  (crankcase + two bank towers + liners)
     ===================================================================== */

  const blockGroup = new THREE.Group();
  root.add(blockGroup);

  const crankcase = mesh(RBox(2.6, 2.35, 7.4, 0.16), blockM, 0, 0.15, 0);
  blockGroup.add(crankcase);

  // valley filler / lifter gallery
  blockGroup.add(mesh(RBox(2.15, 0.55, 7.25, 0.1), blockM, 0, 1.28, 0));

  // stiffening ribs on the crankcase sides
  for (let i = 0; i < 7; i++) {
    const z = (i - 3) * 1.02;
    for (const s of [-1, 1]) {
      const rib = mesh(RBox(0.10, 1.85, 0.14, 0.03), blockM, s * 1.32, 0.15, z);
      blockGroup.add(rib);
    }
  }

  tagPart(blockGroup, 'Cylinder Block');

  /* =====================================================================
     PER-BANK ASSEMBLY
     ===================================================================== */

  const banks = [];

  for (let b = 0; b < 2; b++) {
    const rotZ = b === 0 ? -BANK : BANK;
    const inward = b === 0 ? -1 : 1;   // local X direction pointing into the valley

    /* ---------- block tower ---------- */
    const tower = new THREE.Group();
    tower.rotation.z = rotZ;
    tower.add(mesh(RBox(1.72, 2.02, 7.2, 0.12), blockM, 0, 2.0, 0));
    // deck plate
    tower.add(mesh(RBox(1.80, 0.10, 7.25, 0.04), blockM, 0, DECK + 0.02, 0));
    // side ribbing
    for (let i = 0; i < 6; i++) {
      const z = (i - 2.5) * 1.15;
      tower.add(mesh(RBox(1.60, 0.10, 0.16, 0.03), blockM, 0, 1.55, z));
    }
    root.add(tower);

    /* ---------- cylinder head ---------- */
    const head = new THREE.Group();
    head.rotation.z = rotZ;
    head.add(mesh(RBox(1.72, 0.70, 7.2, 0.09), headM, 0, DECK + 0.37, 0));

    // intake / exhaust port stubs
    for (let j = 0; j < 4; j++) {
      const z = (j - 1.5) * SPACING;
      const pIn = mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.24, 16), headM);
      pIn.rotation.z = Math.PI / 2;
      pIn.position.set(inward * 0.90, DECK + 0.34, z);
      head.add(pIn);

      const pEx = mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.24, 16), headM);
      pEx.rotation.z = Math.PI / 2;
      pEx.position.set(-inward * 0.90, DECK + 0.28, z);
      head.add(pEx);
    }

    // head bolts
    for (let j = 0; j < 5; j++) {
      const z = (j - 2) * 1.72;
      for (const s of [-1, 1]) {
        const bolt = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.10, 6), steelD);
        bolt.position.set(s * 0.72, DECK + 0.74, z);
        head.add(bolt);
      }
    }
    root.add(head);

    /* ---------- valve cover ---------- */
    const cover = new THREE.Group();
    cover.rotation.z = rotZ;
    cover.add(mesh(RBox(1.52, 0.62, 7.0, 0.12), coverM, 0, DECK + 1.05, 0));
    // cover ridge
    cover.add(mesh(RBox(0.55, 0.10, 6.4, 0.05), coverM, 0, DECK + 1.38, 0));
    // oil filler cap
    const cap = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 18), blackM);
    cap.position.set(0, DECK + 1.45, -1.4);
    cover.add(cap);
    root.add(cover);

    /* ---------- camshafts (DOHC) ---------- */
    const cams = [];
    for (const side of [-1, 1]) {
      // side = -1 -> intake side (toward valley), +1 -> exhaust side
      const cx = side * inward * -0.30 * (side === -1 ? 1 : 1);
      // intake sits at inward*-0.30 hmm -> compute explicitly
      const xPos = (side === -1 ? inward * 0.30 : -inward * 0.30);

      const shaft = new THREE.Group();
      shaft.position.set(xPos, DECK + 0.55, 0);
      shaft.rotation.z = rotZ;

      const tube = mesh(new THREE.CylinderGeometry(0.085, 0.085, 7.0, 14), steel);
      tube.rotation.x = Math.PI / 2;
      shaft.add(tube);

      for (let j = 0; j < 4; j++) {
        const z = (j - 1.5) * SPACING;

        // eccentric cam lobe (base circle + toe)
        const lobe = new THREE.Group();
        lobe.position.z = z;
        const base = mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.17, 18), steelD);
        base.rotation.x = Math.PI / 2;
        lobe.add(base);
        const toe = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 16), steelD);
        toe.rotation.x = Math.PI / 2;
        toe.position.y = 0.075;
        lobe.add(toe);

        lobe.userData.cylinder = j;
        lobe.userData.side = side;
        camLobes.push(lobe);
        shaft.add(lobe);
      }
      root.add(shaft);
      cams.push(shaft);
    }

    /* ---------- valves ---------- */
    const valves = [];
    for (let j = 0; j < 4; j++) {
      const z = (j - 1.5) * SPACING;

      for (const kind of ['in', 'ex']) {
        const xLocal = kind === 'in' ? inward * 0.30 : -inward * 0.30;

        const vg = new THREE.Group();
        vg.position.set(xLocal, DECK, z);
        vg.rotation.z = rotZ;

        // stem
        const stem = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.62, 10), steel, 0, 0.31, 0);
        vg.add(stem);
        // valve head (mushroom)
        const vh = mesh(new THREE.CylinderGeometry(0.165, 0.115, 0.075, 22), steel, 0, -0.025, 0);
        vg.add(vh);
        // retainer
        const ret = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.045, 16), steelD, 0, 0.50, 0);
        vg.add(ret);

        // fixed spring (visual only)
        const spring = new THREE.Group();
        spring.position.set(xLocal, DECK + 0.08, z);
        spring.rotation.z = rotZ;
        for (let k = 0; k < 7; k++) {
          const ring = mesh(new THREE.TorusGeometry(0.078, 0.014, 6, 16), steelD, 0, k * 0.055, 0);
          ring.rotation.x = Math.PI / 2;
          spring.add(ring);
        }
        root.add(spring);

        root.add(vg);
        valves.push({ group: vg, kind });
        vg.userData.kind = kind;
      }
    }

    /* ---------- liner ---------- */
    for (let j = 0; j < 4; j++) {
      const z = (j - 1.5) * SPACING;
      const liner = mesh(
        new THREE.CylinderGeometry(BORE + 0.035, BORE + 0.035, 1.65, 34, 1, true),
        linerM, 0, 2.30, z
      );
      liner.rotation.z = rotZ;
      // liners live in bank space
      const lg = new THREE.Group();
      lg.rotation.z = rotZ;
      lg.add(mesh(
        new THREE.CylinderGeometry(BORE + 0.035, BORE + 0.035, 1.65, 34, 1, true),
        linerM, 0, 2.30, z
      ));
      root.add(lg);
    }

    /* ---------- pistons + rods ---------- */
    for (let j = 0; j < 4; j++) {
      const z = (j - 1.5) * SPACING;

      /* piston */
      const piston = new THREE.Group();
      const body = mesh(new THREE.CylinderGeometry(BORE - 0.012, BORE - 0.012, 0.58, 34), pistonM, 0, 0.02, 0);
      piston.add(body);
      const crownTop = mesh(new THREE.CylinderGeometry(BORE - 0.03, BORE - 0.012, 0.06, 34), pistonM, 0, CROWN - 0.02, 0);
      piston.add(crownTop);
      // rings
      for (let k = 0; k < 3; k++) {
        const ring = mesh(new THREE.CylinderGeometry(BORE + 0.004, BORE + 0.004, 0.028, 34), ringM, 0, CROWN - 0.09 - k * 0.075, 0);
        piston.add(ring);
      }
      // gudgeon pin
      const pinM = mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.52, 16), steel);
      pinM.rotation.x = Math.PI / 2;
      piston.add(pinM);

      piston.userData.partName = `Piston #${j + 1} (Bank ${b === 0 ? 'R' : 'L'})`;

      /* connecting rod */
      const rod = new THREE.Group();
      const bigEnd = mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.30, 22), steelD, 0, 0, 0);
      bigEnd.rotation.x = Math.PI / 2;
      rod.add(bigEnd);
      const smallEnd = mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.26, 18), steelD, 0, L, 0);
      smallEnd.rotation.x = Math.PI / 2;
      rod.add(smallEnd);
      const beam = mesh(RBox(0.15, L - 0.30, 0.17, 0.05), steelD, 0, L / 2, 0);
      rod.add(beam);
      const beam2 = mesh(RBox(0.075, L - 0.55, 0.19, 0.03), steelD, 0, L / 2, 0);
      rod.add(beam2);
      rod.userData.partName = `Connecting Rod #${j + 1} (Bank ${b === 0 ? 'R' : 'L'})`;

      // Both live inside a bank-space group so local +Y is the bore axis.
      const holder = new THREE.Group();
      holder.rotation.z = rotZ;
      holder.add(piston);
      holder.add(rod);
      root.add(holder);

      const psi0deg = (b === 0) ? (45 - 90 * j) : (135 - 90 * j + 360);

      cylinders.push({
        bank: b,
        rot: rotZ,
        j,
        phi: j * Math.PI / 2,
        z,
        piston,
        rod,
        intakeValve: valves[j * 2 + 0].group,
        exhaustValve: valves[j * 2 + 1].group,
        psi0: psi0deg * Math.PI / 180,
      });
    }

    banks.push({ rotZ, inward, head, cover, cams });
  }

  /* ---- explode directions for heads / covers ---- */
  const AX_A = new THREE.Vector3(Math.sin(BANK), Math.cos(BANK), 0);
  const AX_B = new THREE.Vector3(-Math.sin(BANK), Math.cos(BANK), 0);

  registerExplode(banks[0].head, AX_A.clone().multiplyScalar(1.0), 1.9);
  registerExplode(banks[0].cover, AX_A.clone().multiplyScalar(1.0), 3.3);
  registerExplode(banks[1].head, AX_B.clone().multiplyScalar(1.0), 1.9);
  registerExplode(banks[1].cover, AX_B.clone().multiplyScalar(1.0), 3.3);

  tagPart(banks[0].head, 'Cylinder Head — Right Bank');
  tagPart(banks[1].head, 'Cylinder Head — Left Bank');
  tagPart(banks[0].cover, 'Valve Cover — Right Bank');
  tagPart(banks[1].cover, 'Valve Cover — Left Bank');

  /* =====================================================================
     OIL PAN
     ===================================================================== */

  const pan = new THREE.Group();
  pan.add(mesh(RBox(2.35, 0.78, 6.5, 0.14), panM, 0, -1.18, 0));
  pan.add(mesh(RBox(1.7, 0.10, 5.6, 0.04), panM, 0, -1.58, 0));
  // drain plug
  const plug = mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.09, 14), brassM, 0.6, -1.62, 1.9);
  pan.add(plug);
  root.add(pan);
  tagPart(pan, 'Oil Pan');
  registerExplode(pan, new THREE.Vector3(0, -1, 0), 1.9);

  /* =====================================================================
     TIMING COVER  /  FLYWHEEL
     ===================================================================== */

  const timing = new THREE.Group();
  timing.add(mesh(RBox(2.75, 3.05, 0.34, 0.10), timingM, 0, 0.95, -3.86));
  timing.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 22), steelD, 0, -0.35, -4.05));
  root.add(timing);
  tagPart(timing, 'Timing Cover');
  registerExplode(timing, new THREE.Vector3(0, 0, -1), 2.2);

  const flywheel = new THREE.Group();
  const fwDisc = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.16, 48), steelD, 0, 0, 0);
  fwDisc.rotation.x = Math.PI / 2;
  flywheel.add(fwDisc);
  const fwRing = mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.11, 48, 1, true), ringM, 0, 0, 0);
  fwRing.rotation.x = Math.PI / 2;
  flywheel.add(fwRing);
  // clutch face detail
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const bolt = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.20, 8), steel,
      Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
    bolt.rotation.x = Math.PI / 2;
    flywheel.add(bolt);
  }
  flywheel.position.set(0, 0, 4.05);
  root.add(flywheel);
  tagPart(flywheel, 'Flywheel');
  registerExplode(flywheel, new THREE.Vector3(0, 0, 1), 2.2);

  /* =====================================================================
     INTAKE MANIFOLD
     ===================================================================== */

  const intake = new THREE.Group();

  const plenum = mesh(RBox(1.5, 0.82, 5.4, 0.14), intakeM, 0, 3.62, 0);
  intake.add(plenum);
  // plenum ribs
  for (let i = 0; i < 5; i++) {
    intake.add(mesh(RBox(1.56, 0.10, 0.13, 0.03), intakeM, 0, 3.62, (i - 2) * 1.1));
  }
  // throttle body
  const tb = mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.42, 24), intakeM, 0, 4.18, -2.1);
  intake.add(tb);
  intake.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 24), steelD, 0, 4.40, -2.1));
  // badge
  intake.add(mesh(RBox(0.9, 0.28, 0.06, 0.04), coverM, 0, 3.72, 2.72));

  // runners
  for (let b = 0; b < 2; b++) {
    const inward = b === 0 ? -1 : 1;
    for (let j = 0; j < 4; j++) {
      const z = (j - 1.5) * SPACING;
      const port = toWorld(b, inward * 0.98, DECK + 0.34, z);
      const p0 = new THREE.Vector3(0, 3.70, z * 0.82);
      const p1 = new THREE.Vector3(port.x * 0.55, 3.62, z * 0.94);
      const p2 = new THREE.Vector3(port.x * 0.92, 3.18, z);
      const p3 = port;

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.115, 10, false),
        intakeM
      );
      tube.castShadow = true;
      tube.receiveShadow = true;
      intake.add(tube);

      // flange at the head
      const fl = mesh(RBox(0.30, 0.26, 0.26, 0.05), intakeM, port.x * 1.02, port.y + 0.02, z);
      intake.add(fl);
    }
  }

  root.add(intake);
  tagPart(intake, 'Intake Manifold');
  registerExplode(intake, new THREE.Vector3(0, 1, 0), 2.2);

  /* =====================================================================
     EXHAUST HEADERS
     ===================================================================== */

  const headers = [];
  for (let b = 0; b < 2; b++) {
    const outward = b === 0 ? 1 : -1;
    const grp = new THREE.Group();

    const collector = new THREE.Vector3(outward * 2.25, 0.05, 3.05);

    for (let j = 0; j < 4; j++) {
      const z = (j - 1.5) * SPACING;
      const port = toWorld(b, -outward * 0.98, DECK + 0.26, z);

      const p0 = port.clone();
      const p1 = new THREE.Vector3(port.x + outward * 0.42, port.y - 0.42, z + 0.10);
      const p2 = new THREE.Vector3(outward * (2.05 + j * 0.05), 0.85, z * 0.45 + 1.0);
      const p3 = collector.clone().add(new THREE.Vector3(0, 0.14 * (1 - Math.abs(j - 1.5) / 1.5), 0));

      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 34, 0.105, 10, false),
        exhM
      );
      tube.castShadow = true;
      tube.receiveShadow = true;
      grp.add(tube);

      // port flange
      const fl = mesh(RBox(0.34, 0.30, 0.26, 0.05), exhM, port.x, port.y, z);
      grp.add(fl);
    }

    // collector cone
    const cone = mesh(new THREE.CylinderGeometry(0.30, 0.42, 0.55, 22), exhM,
      collector.x, collector.y, collector.z + 0.20);
    cone.rotation.x = Math.PI / 2;
    grp.add(cone);

    // outlet
    const out = mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.5, 20), exhM,
      collector.x, collector.y, collector.z + 0.66);
    out.rotation.x = Math.PI / 2;
    grp.add(out);

    root.add(grp);
    tagPart(grp, `Exhaust Header — ${b === 0 ? 'Right' : 'Left'} Bank`);
    registerExplode(grp, new THREE.Vector3(outward, -0.15, 0), 2.1);
    headers.push(grp);
  }

  /* =====================================================================
     FRONT ACCESSORY DRIVE
     ===================================================================== */

  const pulley = new THREE.Group();
  const p1 = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.24, 40), steelD, 0, 0, 0);
  p1.rotation.x = Math.PI / 2;
  pulley.add(p1);
  const p2 = mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.30, 30), rubberM, 0, 0, -0.16);
  p2.rotation.x = Math.PI / 2;
  pulley.add(p2);
  pulley.position.set(0, 0, -4.28);
  root.add(pulley);
  tagPart(pulley, 'Crank Damper / Pulley');

  /* =====================================================================
     ENGINE MOUNTS
     ===================================================================== */

  const mounts = new THREE.Group();
  for (const s of [-1, 1]) {
    const arm = mesh(RBox(0.55, 0.30, 0.55, 0.07), steelD, s * 1.45, 0.05, -1.9);
    mounts.add(arm);
    const bush = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.30, 20), rubberM, s * 1.85, 0.05, -1.9);
    bush.rotation.z = Math.PI / 2;
    mounts.add(bush);

    const arm2 = mesh(RBox(0.55, 0.30, 0.55, 0.07), steelD, s * 1.45, 0.05, 1.9);
    mounts.add(arm2);
    const bush2 = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.30, 20), rubberM, s * 1.85, 0.05, 1.9);
    bush2.rotation.z = Math.PI / 2;
    mounts.add(bush2);
  }
  root.add(mounts);
  tagPart(mounts, 'Engine Mounts');

  /* =====================================================================
     CUTAWAY SUPPORT
     ===================================================================== */

  function setCutaway(t) {
    const on = t > 0.002;
    for (const m of cutMats) {
      if (m.transparent !== on) {
        m.transparent = on;
        m.needsUpdate = true;
      }
      m.opacity = 1 - 0.87 * t;
      m.depthWrite = t < 0.30;
    }
  }
  setCutaway(0);

  /* =====================================================================
     EXPLODE SUPPORT
     ===================================================================== */

  function setExplode(t) {
    for (const e of explodeItems) {
      e.obj.position.copy(e.base).addScaledVector(e.dir, e.amount * t);
    }
  }
  setExplode(0);

  /* =====================================================================
     ANIMATION
     ===================================================================== */

  const DEG = Math.PI / 180;
  const IN_OPEN = 350 * DEG, IN_DUR = 232 * DEG;
  const EX_OPEN = 152 * DEG, EX_DUR = 236 * DEG;
  const MAX_LIFT = 0.155;

  const _v = new THREE.Vector3();

  function update(theta) {
    // ---- crankshaft ----
    crankGroup.rotation.z = theta;
    flywheel.rotation.z = theta;
    pulley.rotation.z = theta;

    // ---- camshafts at half speed ----
    for (const b of banks) {
      for (const cam of b.cams) cam.rotation.z = theta * 0.5;
    }

    // ---- per cylinder ----
    for (let i = 0; i < cylinders.length; i++) {
      const c = cylinders[i];
      const beta = theta + c.phi - c.rot;
      const cosB = Math.cos(beta);
      const sinB = Math.sin(beta);

      const px = R * cosB;
      const py = R * sinB;
      const d = py + Math.sqrt(Math.max(0.0001, L * L - R * R * cosB * cosB));

      // piston rides along the bore axis (local +Y)
      c.piston.position.set(0, d, c.z);

      // rod: big end on the crank pin, small end on the piston pin
      c.rod.position.set(px, py, c.z);
      const dx = -px;
      const dy = d - py;
      const len = Math.hypot(dx, dy) || 1;
      _v.set(dx / len, dy / len, 0);
      c.rod.quaternion.setFromUnitVectors(UP, _v);

      // ---- four stroke cycle ----
      const FOUR_PI = TAU * 2;
      let psi = (theta - c.psi0) % FOUR_PI;
      if (psi < 0) psi += FOUR_PI;

      const li = liftAt(psi, IN_OPEN, IN_DUR, MAX_LIFT);
      const le = liftAt(psi, EX_OPEN, EX_DUR, MAX_LIFT);

      c.intakeValve.position.y = DECK - li;
      c.exhaustValve.position.y = DECK - le;
    }
  }

  update(0);

  /* =====================================================================
     PUBLIC API
     ===================================================================== */

  return {
    root,
    update,
    setCutaway,
    setExplode,
    cylinders,
    cutMats,
    explodeItems,
  };
}
