/**
 * firstPerson.js
 * ---------------------------------------------------------------------------
 * Minimal pointer-lock first-person controller with simple AABB collision
 * against the engine / test stand footprint.
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';

export class FirstPersonControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.enabled = false;

    this.yaw = Math.PI * 0.15;
    this.pitch = -0.06;

    this.position = new THREE.Vector3(6.5, 1.72, 7.5);
    this.keys = Object.create(null);

    this.eyeHeight = 1.72;
    this.speed = 4.4;
    this.runMultiplier = 1.9;
    this.lookSpeed = 0.0022;

    this.bounds = { minX: -11.4, maxX: 11.4, minZ: -11.4, maxZ: 11.4 };
    this.blockers = [];   // { min: Vector3, max: Vector3 }

    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._tmp = new THREE.Vector3();

    this._onKeyDown = (e) => {
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };

    this._onMouseMove = (e) => {
      if (!this.enabled || document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * this.lookSpeed;
      this.pitch -= e.movementY * this.lookSpeed;
      const lim = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    };

    this._onClick = () => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== this.dom) {
        this.dom.requestPointerLock?.();
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    this.dom.addEventListener('click', this._onClick);
  }

  addBlocker(min, max) {
    this.blockers.push({ min, max });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && document.pointerLockElement === this.dom) {
      document.exitPointerLock?.();
    }
    if (on) {
      this.applyToCamera();
    }
  }

  applyToCamera() {
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
  }

  _collides(x, z) {
    const pad = 0.45;
    for (const b of this.blockers) {
      if (
        x > b.min.x - pad && x < b.max.x + pad &&
        z > b.min.z - pad && z < b.max.z + pad
      ) return true;
    }
    return false;
  }

  update(dt) {
    if (!this.enabled) return;

    const k = this.keys;
    let fwd = 0, strafe = 0;

    if (k['KeyW'] || k['ArrowUp']) fwd += 1;
    if (k['KeyS'] || k['ArrowDown']) fwd -= 1;
    if (k['KeyD'] || k['ArrowRight']) strafe += 1;
    if (k['KeyA'] || k['ArrowLeft']) strafe -= 1;

    if (fwd !== 0 || strafe !== 0) {
      const len = Math.hypot(fwd, strafe);
      fwd /= len; strafe /= len;

      const speed = this.speed * ((k['ShiftLeft'] || k['ShiftRight']) ? this.runMultiplier : 1) * dt;

      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);

      // forward = (-sin, 0, -cos), right = (cos, 0, -sin)
      const dx = (-sinY * fwd + cosY * strafe) * speed;
      const dz = (-cosY * fwd - sinY * strafe) * speed;

      let nx = this.position.x + dx;
      let nz = this.position.z + dz;

      nx = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, nx));
      nz = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, nz));

      // resolve axis by axis so we slide along obstacles
      if (!this._collides(nx, this.position.z)) this.position.x = nx;
      if (!this._collides(this.position.x, nz)) this.position.z = nz;
    }

    this.applyToCamera();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.dom.removeEventListener('click', this._onClick);
  }
}
