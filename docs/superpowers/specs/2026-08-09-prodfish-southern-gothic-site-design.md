# prodfish — Southern Gothic Scroll Site (Design Spec)

**Date:** 2026-08-09
**Status:** Approved

## Purpose

A single-page landing site for beat producer **prodfish**. The page is an
ethereal southern-gothic night scene — a man standing before an old church —
that the visitor scrolls *into*: the camera dollies through the grass, reaches
the glowing doorway, passes through darkness, and arrives in a blood-red chapel
interior where the BeatStars embed (the actual product) is revealed, framed
like an altar object. Socials and contact live alongside the embed.

Visual reference: night flash-photography aesthetic (pale lit buildings against
black woods, film grain, Spanish moss, fireflies; red-neon-lit chapel interior
with glowing cross).

## Approach (decided)

**2.5D "living photograph"** — AI-generated still images turned into
depth-displaced planes in Three.js. Chosen over true 3D models (vibe risk,
looks game-y) and scroll-scrubbed video (heavy, painful to iterate).

## Scroll narrative (5 acts, one continuous scroll)

1. **Arrival** — Black + grain. "prodfish" in pale, wide-tracked serif fades
   in; "scroll" hint. Exterior scene emerges slowly from darkness behind it.
2. **The approach** — Scroll dollies camera forward. Parallax from depth
   displacement: grass fast, church mid, sky static. Fog thickens. Title
   drifts up and dissolves.
3. **The threshold** — Camera reaches the door; red glow leaks out (animated
   overlay); vignette closes to black.
4. **The chapel** — Red interior fades in and parallaxes open: neon cross,
   silhouetted pews; slight camera drift down the aisle.
5. **The beats** — BeatStars embed rises into view with thin border + red
   glow; social icons and email contact nearby; minimal footer.

Ambient motion at all times: grain shimmer, firefly drift, fog breathing,
subtle camera sway. `prefers-reduced-motion` → static composed version, no
scroll-driven camera or ambient motion.

## Tech stack

- **Vite + vanilla JS** (no framework). Static output, deployed to Vercel.
- **Three.js** — scene rendering:
  - Each scene image = subdivided plane geometry displaced by a grayscale
    depth map (vertex displacement in a shader or via displacementMap).
  - Particles: fireflies/dust (Points with soft sprites).
  - Fog + post-processing: film grain, vignette, subtle chromatic aberration.
- **GSAP + ScrollTrigger** — one master timeline, scrubbed by scroll, drives:
  camera z/y, scene crossfades, glow intensity, DOM element opacity/position.
- **Lenis** — smooth scrolling, driven by GSAP ticker (single RAF loop).
- **DOM layer** — title, socials, contact, and BeatStars iframe live in HTML
  layered over the canvas; revealed/hidden by the master timeline.

## Assets

- **3 AI images** (~2048px): (1) exterior church + man in grass, (2) door /
  threshold closeup, (3) red chapel interior with neon cross. Prompts written
  as part of the build (`assets/PROMPTS.md`), matched to the inspiration
  aesthetic. User generates via their preferred tool and drops files into
  `public/scenes/`.
- **Depth maps** — hand-approximated grayscale maps generated procedurally
  (canvas): sky far / structure mid / foreground near. Upgradeable later to
  AI depth maps (e.g., Depth Anything) without code changes — same file slots.
- **Placeholders first** — procedural moody placeholder scenes (gradient sky,
  church silhouette, grass band, fog) ship immediately so the full scroll
  experience is real and tunable before AI images arrive. Swapping in real
  imagery = replacing files in `public/scenes/`.
- **Fonts** — gothic-leaning display serif + quiet sans/mono for small text
  (Google Fonts, self-hosted or preconnected).

## Content

- Artist name: **prodfish**.
- BeatStars embed: standard iframe; placeholder URL until the producer's
  BeatStars username is provided.
- Social links: IG, YouTube (extendable); `#` placeholders until real URLs
  are provided.
- Contact: email line (placeholder until provided).

## Performance / device handling

- Mobile: touch scroll via Lenis; reduced particle counts and plane
  subdivision on low-power devices (heuristic: devicePixelRatio + UA/memory).
- Cap pixel ratio at 2. Single RAF loop. Textures sized responsively.
- Target: smooth 60fps scroll on a mid-range phone.

## Error handling

- If WebGL is unavailable: fall back to a static layered-image version (CSS
  only) with the embed visible — site remains fully usable.
- If the BeatStars iframe fails to load, the frame area shows a direct link
  to the BeatStars profile.

## Testing

- Manual: scroll choreography checked in browser (desktop + mobile emulation),
  reduced-motion mode verified, WebGL-disabled fallback verified.
- Build check: `vite build` passes; Lighthouse pass for obvious perf issues.

## Out of scope

- CMS, beat hosting, checkout (BeatStars handles all commerce).
- True 3D modeled scenes, video scrubbing.
- Multi-page routing.
