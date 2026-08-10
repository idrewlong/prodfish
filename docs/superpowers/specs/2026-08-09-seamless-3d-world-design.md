# Seamless 3D World — Design

**Date:** 2026-08-09
**Status:** Approved
**Supersedes:** the 2.5D depth-plane scene layer from `2026-08-09-prodfish-southern-gothic-site-design.md` (everything else in that spec stands)

## Problem

The current site renders three 2.5D depth-map planes (exterior, threshold,
interior images) and dollies the camera into each one before cutting to the
next. It reads as "zoom into an image, move on to the next image." We want a
real scroll-driven 3D journey: the camera travels through an actual modeled
world, and assets animate as you pass them.

## Decision summary

- **Full seamless 3D world** (user's choice), with a defined fallback to a
  one-cut variant if the church interior proves unusable up close.
- **Hybrid asset sourcing.** Free CC0/CC-BY library assets for proven, rigged,
  or animated pieces (the chapel with interior, the animated crow); Higgsfield
  AI-generated GLBs (via `higgsfield-generate`) for hero set-dressing that must
  match the existing art direction (neon cross, gravestones, dead trees). No
  NonCommercial licenses — the site promotes beat sales, which is commercial
  use.
- **Keep the five-act journey**, plus two new scroll beats: crows scattering
  off the roof on approach, and candles igniting one by one down the aisle.
- **Atmosphere-first art direction**: near-darkness, thick fog, moonlight
  sliver, red neon glow, film grain and vignette. Mood over geometry detail.

## What stays (unchanged)

- Lenis smooth scroll and the GSAP ScrollTrigger master timeline scrubbing a
  shared state object (`src/timeline.js` structure, `src/scroll.js`).
- Five-act spans in `src/choreography.js` (`ACTS`), extended with new event
  triggers.
- Device tier detection (`src/device.js`) and tier-scaled quality settings.
- Fallbacks: `prefers-reduced-motion` static render; no-WebGL DOM version.
- Hero title and the beats/socials DOM section (act 5) — untouched.
- Fireflies particle system and the post-processing composer (grain/vignette
  strengthened to unify asset styles).

## What is replaced

The scene layer: `depthPlane.js`, `placeholders.js`, the depth-plane parts of
`sceneManager.js`, and the image/depth-map texture loader. Replaced by a real
3D world module.

## The world

One continuous `THREE.Scene` containing:

- Dark ground plane, `FogExp2`, near-black sky (optional sparse stars).
- Dead trees, gravestones, and a fence scattered along the approach path.
- The chapel — a single model with both exterior and interior. Primary
  candidate: "Church" by Tiago Lopes (Sketchfab, CC-BY, 13.4k tris, interior
  + exterior, dark/horror styling).
- Interior dressing: neon cross on the altar wall (emissive geometry, can be
  built from primitives), candle rows along the aisle.
- Crows perched on the roofline. Primary candidate: animated crow by Alexei
  Ostapenko (Sketchfab, CC-BY, flight animation).
- One dim directional moonlight; red point/area light at the altar; a small
  pool of candle point lights.

## The camera

A `CatmullRomCurve3` from deep in the field → winding between trees → up to
the door → through the doorway → down the aisle → settling before the altar.
Scroll progress maps to arc-length position along the curve; the five acts
become segments of this one path. No blackout teleport. The door swings open
scroll-driven as the camera nears (scrubbing backward closes it). Ambient
sway (existing) stays layered on top of the path position.

## Scroll-driven events

- **Crows scatter** (approach act): at a trigger progress, each perched crow
  plays its flight animation, follows its own escape curve, and fades into
  the fog. Scrub-safe: driven by the master timeline, so reversing rewinds
  them.
- **Candles ignite** (chapel act): ordered by distance down the aisle; each
  ignition raises an emissive flame and (on capable tiers) a point light.
  Low tier: 1–2 shared real lights, same visual ignition order via emissives.
- **Door opens** (threshold act): rotation tweened by scroll progress.
- Existing beats (title fade, glow, beats section reveal) keep their spans.

## Assets pipeline & licensing

- Two sources, one pipeline:
  - **Library assets** (chapel, crow): downloaded from Sketchfab, CC0/CC-BY
    only.
  - **Higgsfield-generated assets** (neon cross, gravestones, dead trees):
    generated as GLBs via `higgsfield-generate`, prompted from the existing
    scene imagery in `assets/PROMPTS.md` for art-direction consistency. Each
    generated asset is inspected for triangle count and broken
    geometry before acceptance; a library or primitive-built fallback is
    noted per asset in the plan.
- GLBs land in `assets/source/`, processed with `gltf-transform`
  (Draco compression, texture resize) into `public/models/`.
- Loaded via `GLTFLoader` + `DRACOLoader`; loading screen until the chapel
  and ground are ready, distant props may stream in after.
- `ATTRIBUTIONS.md` at repo root listing every asset, author, source URL,
  and license; a small "credits" link in the site footer satisfies CC-BY
  attribution on-site. Higgsfield-generated assets are recorded there too
  (as generated works, no attribution requirement).
- License rule for library assets: CC0 or CC-BY only. Record the license at
  download time.

## Performance & tiers

- Tier settings extend the existing `TIERS` table: DPR cap, candle light
  count, crow count, post-processing passes, fog density (cheaper than
  draw distance).
- Target: ≤ 60k triangles total scene, ≤ 2048px textures after compression,
  60fps on a mid-range laptop, 30fps floor on mobile mid-tier.

## Fallback path (Approach C)

If the church interior is unusable up close (scale, narrow door, broken
normals/UVs), pivot without restarting:

1. Keep the continuous exterior journey and crow scatter.
2. Reinstate the existing blackout beat at the door.
3. Dress a separate interior area (offset in the same scene) from individual
   pew/altar/candle models; the cut hides the seam.

The timeline and world module must keep the door-transition logic isolated so
this pivot swaps one segment, not the architecture.

## Error handling

- Any model that fails to load logs a warning and is skipped — the world
  renders without it rather than blocking (chapel is the exception: loading
  screen persists with a retry).
- WebGL context loss: existing no-WebGL DOM fallback is shown.

## Testing

- Existing `choreography` and `device` tests stay (spans/tiers unchanged in
  shape).
- New pure-function tests: progress → path position mapping (monotonic,
  clamped, hits door/altar landmarks at expected act boundaries); candle
  ignition ordering; crow trigger timing.
- Rendering verified visually via dev server; no attempt to unit-test WebGL
  output.

## Out of scope

- Sound, pointer-driven camera look, WebXR, physics.
- Replacing the beats/socials section or hero copy.
- AI-generating the chapel or animated creatures (library assets only for
  those; Higgsfield 3D is limited to static set-dressing).
