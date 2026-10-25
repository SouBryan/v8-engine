# V8 Engine Test Cell — Interactive 3D Simulation

A fully procedural, mechanically animated **90° V8 combustion engine** mounted on an
industrial test stand, built with **Three.js / WebGL**. Every part is generated in code —
no external model files, no textures to download beyond the Three.js CDN modules.

---

## Running locally

Because the project uses ES modules and an `importmap`, it must be served over HTTP
(opening `index.html` with `file://` will not work in most browsers).

### Option 1 — Python (already installed on macOS / Linux)

```bash
cd v8-engine
python3 -m http.server 8080
```

Then open http://localhost:8080.

### Option 2 — Node.js

```
npx serve .
```

### Option 3 — VS Code

Install the **Live Server** extension, right-click `index.html` → *Open with Live Server*.

> An internet connection is required the first time you load the page, because Three.js
> r160 is pulled from unpkg via the import map in `index.html`.

---

## Controls

| Input ↕▾ | Action ↕▾ |
|---|---|
| −**Drag** | Orbit the camera around the engine |
| −**Scroll** | Zoom in / out |
| −**Click a part** | Highlight it and display its name |
| −**WALK MODE** | Switch to first-person; click the canvas to lock the mouse |
| −**W / A / S / D** | Walk (in walk mode) |
| −**Shift** | Run |
| −**Mouse** | Look around (pointer-locked) |
| −**Esc** | Release the mouse cursor |
⚙

### Buttons

| Control ↕▾ | Function ↕▾ |
|---|---|
| −**START / STOP** | Start or stop the engine |
| −**RPM slider** | Target engine speed, 0 – 4000 rpm (smoothly interpolated) |
| −**CUTAWAY** | Fades the block, heads, covers, manifold and headers to glass so the internals are visible |
| −**EXPLODED** | Smoothly separates the major assemblies along their real service directions |
| −**ASSEMBLE** | Restores every component to its original position |
| −**SLOW-MO** | Runs the mechanism at ~9 % speed for close inspection |
| −**RESET CAMERA** | Returns to the default three-quarter view |
⚙

---

## Mechanical model

The kinematics are solved analytically every frame:

- **Crankshaft** — 4 throws, 90° apart (cross-plane V8), rotating about the Z axis.
- **Connecting rods** — length `L = 2.0` units, solved from the crank-pin position with the
standard slider-crank equation:

```
d = R·sinβ + √(L² − R²·cos²β)
```

where `β = θ + φ_throw − bankAngle`. The rod is oriented with a quaternion so both ends
stay exactly attached — no drift, ever.
- **Two banks** — each is a `Group` rotated ±45° about Z, so the local `+Y` axis *is* the
bore axis. Pistons therefore simply translate along local `+Y`.
- **Camshafts** — four overhead cams (DOHC), rotating at exactly **half** crankshaft speed.
Every lobe is phased individually so its toe points at its valve at the moment of full lift.
- **Valves** — 16 valves driven by a harmonic lift curve over the 720° four-stroke cycle:

- intake opens at 350° ATDC-firing, 232° duration
- exhaust opens at 152° ATDC-firing, 236° duration
- max lift 0.155 units
- **Firing order** — each cylinder gets a phase offset such that the eight firing events are
spaced exactly 90° apart over the 720° cycle, with the two cylinders sharing a crank throw
firing 360° apart (mechanically correct for a shared journal).

---

## Visual pipeline

- `RoomEnvironment` + `PMREMGenerator` for physically based image-based lighting.
- `ACESFilmicToneMapping`, sRGB output, PCF soft shadow maps.
- A single shadow-casting key light + two shadow-casting spot work lamps, plus hemisphere
and fill lights for a realistic industrial interior.
- Procedurally generated concrete floor texture (canvas), beveled geometry via
`RoundedBoxGeometry`, and metals with tuned `metalness` / `roughness` per material family
(cast aluminium, forged steel, painted covers, rubber, brass).

---

## Project structure

```
index.html            markup, import map, UI panel
css/style.css         interface styling
src/main.js           renderer, scene, UI wiring, animation loop
src/engine.js         the complete procedural V8 engine + kinematics
src/workshop.js       test cell, test stand, lighting, floor texture
src/firstPerson.js    pointer-lock WASD controller with AABB collision
```

---

## Performance notes

- ~250 meshes, all sharing a small set of materials — comfortably 60 fps on desktop.
- `devicePixelRatio` is capped at 2.
- Materials are only cloned lazily (when a part is highlighted), so memory stays flat.

