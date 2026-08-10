// scripts/build-assets.mjs
// Compresses every model in assets/source/<name>/scene.gltf (or .glb)
// into public/models/<name>.glb: Draco geometry, WebP textures.
//
// Church and crow are Sketchfab CC-BY sources with clean topology and are
// treated gently: just the standard optimize pass (Draco + WebP, textures
// <= 2048px), no forced simplification.
//
// The five props below (cross, gravestone-a/b, tree-a/b) are dense,
// AI-generated (Higgsfield image-to-3D) meshes at 28k-31k source triangles
// each. The scene instances ~10 gravestones and ~6 trees as clones plus the
// church (~13.4k tris), so the total rendered budget (<=60k tris) requires
// each prop to land at roughly <=3k tris (cross <=4k).
//
// `gltf-transform optimize --simplify-error` (standard QEM simplification)
// plateaus around ~4.6k triangles on these meshes no matter how high the
// error tolerance is set, because it respects open/non-manifold mesh
// borders -- common in single-image AI reconstructions -- and won't
// collapse across them. Meshoptimizer's "sloppy" simplifier decimates via a
// voxel grid instead, ignoring that topology, and reliably hits an exact
// triangle target. So props are pre-simplified with simplifySloppy() via
// the gltf-transform JS API before being handed to the same `optimize` CLI
// pass (with --simplify disabled, since the target triangle count has
// already been reached) for Draco + WebP compression. Prop textures are
// also capped at 1024px, since they're small background/mid-ground set
// dressing rather than hero assets like the church.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';

const SRC = 'assets/source';
const OUT = 'public/models';
const TMP = 'assets/.tmp-simplified';

// Triangle budget per prop name. Models not listed here (church, crow) get
// the plain optimize pass with no forced simplification.
const PROP_TRIANGLE_BUDGET = {
  cross: 4000,
  'gravestone-a': 3000,
  'gravestone-b': 3000,
  'tree-a': 3000,
  'tree-b': 3000,
};

mkdirSync(OUT, { recursive: true });

async function simplifyToBudget(input, output, budget) {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(input);

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const srcIndices = prim.getIndices();
      if (!position || !srcIndices) continue;

      const positionArray = position.getArray();
      const indicesArray =
        srcIndices.getArray() instanceof Uint32Array
          ? srcIndices.getArray()
          : new Uint32Array(srcIndices.getArray());

      const [dstIndices] = MeshoptSimplifier.simplifySloppy(
        indicesArray,
        positionArray,
        3,
        null,
        budget * 3,
        1, // target error: unconstrained -- target index count drives the result
      );
      srcIndices.setArray(dstIndices);
    }
  }

  mkdirSync(TMP, { recursive: true });
  await io.write(output, doc);
}

for (const entry of readdirSync(SRC, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const name = entry.name;
  const dir = join(SRC, name);
  const input = ['scene.gltf', 'scene.glb', `${name}.glb`, `${name}.gltf`]
    .map((f) => join(dir, f))
    .find(existsSync);
  if (!input) {
    console.warn(`skip ${name}: no scene.gltf/.glb found`);
    continue;
  }

  const out = join(OUT, `${name}.glb`);
  const budget = PROP_TRIANGLE_BUDGET[name];
  const textureSize = budget ? 1024 : 2048;

  let optimizeInput = input;
  if (budget) {
    const simplified = join(TMP, `${name}.glb`);
    console.log(`${input} -> simplify to <=${budget} tris -> ${simplified}`);
    await simplifyToBudget(input, simplified, budget);
    optimizeInput = simplified;
  }

  console.log(`${optimizeInput} -> ${out}`);
  execSync(
    `npx gltf-transform optimize "${optimizeInput}" "${out}" --compress draco --texture-compress webp --texture-size ${textureSize}${
      budget ? ' --simplify false' : ''
    }`,
    { stdio: 'inherit' },
  );
}

rmSync(TMP, { recursive: true, force: true });
