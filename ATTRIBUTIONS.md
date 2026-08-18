# Asset Attributions

This site uses the following third-party 3D assets:

- **Church** by Tiago Lopes (https://sketchfab.com/drobluda) — https://sketchfab.com/3d-models/church-867a847b67364484bf44912e1af190af — CC Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/)
- **Crow (animated)** by Alexei Ostapenko (https://sketchfab.com/alexanders823) — https://sketchfab.com/3d-models/crow-d5a9b0df4da3493688b63ce42c8a83e2 — CC Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/)

Per Sketchfab's license requirements, both credits above are reproduced here
verbatim (from each model's downloaded `license.txt`):

> This work is based on "Church"
> (https://sketchfab.com/3d-models/church-867a847b67364484bf44912e1af190af) by
> Tiago Lopes (https://sketchfab.com/drobluda) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

> This work is based on "Crow"
> (https://sketchfab.com/3d-models/crow-d5a9b0df4da3493688b63ce42c8a83e2) by
> Alexei Ostapenko (https://sketchfab.com/alexanders823) licensed under
> CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

## ⚠ Pending attribution — supplied 2026-08-17, licence not yet recorded

These four were added to the scene and are shipping in `public/models/`, but
their source and licence are not known here. **If any is CC-BY, this file must
name the author and link the original before the site goes out** — the same
obligation already met for the church and crow above. If any is CC0 or
otherwise unrestricted, say so and this block can simply be deleted.

- **`oak.glb`** — the live oaks along the approach (was `oak_tree.glb`).
  Arrived using `KHR_materials_pbrSpecularGlossiness`, which is characteristic
  of an older Sketchfab upload.
- **`truck.glb`** — the abandoned truck (was
  `rusty_old_truck_free_raw_scan.glb`). Material named `1930sGMCtruck`; the
  filename says "free raw scan", which usually means a photogrammetry capture
  published under CC-BY.
- **`zombie.glb`** — the watchers standing in the treeline.
- **`mossy-stone.glb`** — the scattered boulders (was `stone_with_moss.glb`).
  Material named `kivi` (Finnish for "stone").

Raw sources are in `assets/source/<name>/` (gitignored). If any of them came
with a `license.txt`, drop it in beside the model and the wording can be
reproduced verbatim, as was done for the church and crow.

## AI-generated / supplied assets

The following models were generated with Higgsfield (image-to-3D) for this
project in August 2026. As original AI-generated works produced for this
site, no attribution is required:

- Cross
- Gravestone A
- Gravestone B
- Tree A
- Tree B

- **Grave stones set (10 markers)** — supplied by the site owner for this
  project, 2026-08. Used for the portfolio monument row.

## Processing

All models were converted to compressed GLB (Draco geometry compression,
WebP textures) for delivery via `scripts/build-assets.mjs`. The five
Higgsfield-generated props were additionally simplified to a fixed triangle
budget (<=3,000 triangles each, <=4,000 for the cross) to fit the scene's
overall rendering budget; no other modifications were made to church or
crow beyond compression.
- **Chopper motorcycle** — generated with Higgsfield AI for this project,
  2026-08. An original design, deliberately not modelled on any existing
  copyrighted character or machine. (A companion rider figure was generated
  alongside it and later retired with the building it stood in.)
