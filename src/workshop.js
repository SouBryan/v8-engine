/**
 * workshop.js
 * ---------------------------------------------------------------------------
 * The industrial engine test cell: floor, walls, ceiling lighting, the steel
 * test stand and all the practical lighting for the scene.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';

function makeFloorTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // base concrete
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, size, size);

  // mottling
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 26 + 3;
    const a = Math.random() * 0.045;
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${a})`
      : `rgba(0,0,0,${a * 1.8})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // expansion joints / grid
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * size;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorkshop(scene) {
  const group = new THREE.Group();
  group.name = 'workshop';
  scene.add(group);

  /* ------------------------------------------------------------------ */
  /* FLOOR                                                               */
  /* ------------------------------------------------------------------ */

  const floorTex = makeFloorTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.72,
    metalness: 0.08,
    color: 0xffffff,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  /* ------------------------------------------------------------------ */
  /* WALLS + CEILING                                                     */
  /* ------------------------------------------------------------------ */

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2b2f35,
    roughness: 0.92,
    metalness: 0.04,
  });

  const W = 26, H = 8.5;

  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    group.add(m);
  };

  mkWall(W, H, 0, H / 2, -W / 2, 0);
  mkWall(W, H, 0, H / 2, W / 2, Math.PI);
  mkWall(W, H, -W / 2, H / 2, 0, Math.PI / 2);
  mkWall(W, H, W / 2, H / 2, 0, -Math.PI / 2);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(W, W),
    new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.95 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  group.add(ceiling);

  // ceiling light panels (emissive)
  const lightPanelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff2dd,
    emissiveIntensity: 3.2,
    roughness: 1,
  });

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), lightPanelMat);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(i * 7.5, H - 0.02, j * 7.5);
      group.add(panel);
    }
  }

  /* ------------------------------------------------------------------ */
  /* ENGINE TEST STAND                                                   */
  /* ------------------------------------------------------------------ */

  const stand = new THREE.Group();
  group.add(stand);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x50565e,
    metalness: 0.85,
    roughness: 0.42,
  });
  const frameDark = new THREE.MeshStandardMaterial({
    color: 0x33383e,
    metalness: 0.8,
    roughness: 0.5,
  });
  const paintMat = new THREE.MeshStandardMaterial({
    color: 0xb8bec6,
    metalness: 0.35,
    roughness: 0.55,
  });

  const box = (w, h, d, x, y, z, mat = frameMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    stand.add(m);
    return m;
  };

  const STAND_H = 2.55;
  const PX = 3.65;   // post X
  const PZ = 2.75;   // post Z

  // floor rails
  for (const s of [-1, 1]) {
    box(0.34, 0.26, PZ * 2 + 1.6, s * PX, 0.13, 0, frameDark);
    box(PX * 2 + 0.4, 0.24, 0.30, 0, 0.12, s * PZ, frameDark);
  }

  // vertical posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(0.26, STAND_H, 0.26, sx * PX, STAND_H / 2, sz * PZ, frameMat);
      // foot plate
      box(0.62, 0.06, 0.62, sx * PX, 0.03, sz * PZ, frameDark);
    }
  }

  // top rails
  for (const sz of [-1, 1]) {
    box(PX * 2 + 0.26, 0.20, 0.22, 0, STAND_H, sz * PZ, frameMat);
  }
  for (const sx of [-1, 1]) {
    box(0.22, 0.20, PZ * 2 + 0.26, sx * PX, STAND_H, 0, frameMat);
  }

  // diagonal braces
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const len = Math.hypot(STAND_H * 0.55, 1.1);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.10, len, 0.10), frameMat);
      brace.position.set(sx * (PX - 0.14), STAND_H * 0.55, sz * (PZ - 0.14));
      brace.rotation.x = sz * Math.PI / 4.2;
      brace.castShadow = true;
      stand.add(brace);
    }
  }

  // engine mount arms reaching in toward the block
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(PX - 1.45, 0.20, 0.36), paintMat);
      arm.position.set(sx * (PX + 1.45) / 2, 2.22, sz * 1.9);
      arm.castShadow = true;
      arm.receiveShadow = true;
      stand.add(arm);

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 20), new THREE.MeshStandardMaterial({
        color: 0x14161a, roughness: 0.95, metalness: 0.0,
      }));
      pad.rotation.z = Math.PI / 2;
      pad.position.set(sx * 1.55, 2.22, sz * 1.9);
      pad.castShadow = true;
      stand.add(pad);
    }
  }

  // control cabinet
  const cab = new THREE.Group();
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.6), paintMat);
  cabBody.position.set(-4.9, 0.75, 3.3);
  cabBody.castShadow = true;
  cabBody.receiveShadow = true;
  cab.add(cabBody);

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, emissive: 0x2f6fff, emissiveIntensity: 1.6, roughness: 0.3,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.38), screenMat);
  screen.position.set(-4.9, 1.18, 3.605);
  cab.add(screen);

  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12),
      new THREE.MeshStandardMaterial({ color: [0x38d68a, 0xffc107, 0xe05252][i], roughness: 0.5 })
    );
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-5.12 + i * 0.22, 0.72, 3.61);
    cab.add(btn);
  }
  group.add(cab);

  /* ------------------------------------------------------------------ */
  /* LIGHTING                                                            */
  /* ------------------------------------------------------------------ */

  const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x20232a, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e2, 3.2);
  key.position.set(7, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 42;
  key.shadow.camera.left = -13;
  key.shadow.camera.right = 13;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -13;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 2.2;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9db6ff, 1.15);
  fill.position.set(-9, 7, -8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(0, 5, -12);
  scene.add(rim);

  // warm work lamp over the stand
  const workLamp = new THREE.SpotLight(0xffe0b0, 220, 16, Math.PI / 5, 0.55, 2);
  workLamp.position.set(2.5, 7.4, 2.5);
  workLamp.target.position.set(0, 2.4, 0);
  workLamp.castShadow = true;
  workLamp.shadow.mapSize.set(1024, 1024);
  workLamp.shadow.bias = -0.0012;
  workLamp.shadow.normalBias = 0.03;
  scene.add(workLamp);
  scene.add(workLamp.target);

  const workLamp2 = new THREE.SpotLight(0xcfe0ff, 150, 16, Math.PI / 5, 0.6, 2);
  workLamp2.position.set(-3.2, 7.2, -3.0);
  workLamp2.target.position.set(0, 2.4, 0);
  scene.add(workLamp2);
  scene.add(workLamp2.target);

  /* ------------------------------------------------------------------ */
  /* MISC DRESSING                                                       */
  /* ------------------------------------------------------------------ */

  // floor safety markings around the stand
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xd8b23a, roughness: 0.7, metalness: 0.1,
  });
  const lineGeo = new THREE.PlaneGeometry(9.4, 0.11);
  for (const s of [-1, 1]) {
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.rotation.x = -Math.PI / 2;
    l1.position.set(0, 0.012, s * 4.35);
    group.add(l1);

    const l2 = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 8.6), lineMat);
    l2.rotation.x = -Math.PI / 2;
    l2.position.set(s * 4.7, 0.012, 0);
    group.add(l2);
  }

  return { group, floor };
}
