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
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { metalRough } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

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
  // Ten separate markers in one file, so this budget covers all ten -- the
  // per-prop 3000 would flatten the whole set.
  'grave-stones': 8000,
  rider: 4000,
  motorcycle: 4500,
  // Raw photogrammetry scans: 2.5M and 275k source triangles respectively.
  // Both are SOLID objects, which is why a budget is safe here at all -- a
  // voxel-grid decimator collapses a truck panel or a rock face without
  // anyone being able to tell, and neither has thin structures to lose.
  truck: 20000,
  'mossy-stone': 4000,
};

// Models that must NEVER be simplified, only texture-compressed.
//
// The oak arrives at 7,112 triangles across two materials -- a trunk and
// alpha-mapped LEAF CARDS -- which is already a web budget. Running a
// decimator over it would be repeating the exact mistake that produced the
// trees it replaces: sloppy simplification works on a voxel grid, so it
// merges separate leaf cards into a single mush and deletes the thin
// structures that make a tree read as a tree. The 12.7MB is entirely its
// 4096px PNGs, so texture compression alone does all the work needed.
//
// The zombie is 3,948 triangles across five materials and is likewise
// already lean; its weight is nine PNG textures.
const NEVER_SIMPLIFY = new Set(['oak', 'zombie']);

// Texture cap per model, where the default (1024 for props, 2048 for hero
// assets) is wrong. Leaf alpha needs the extra resolution more than a
// gravestone's diffuse does -- undersized leaf masks read as square holes.
const TEXTURE_SIZE = {
  oak: 2048,
};

// Models whose consumers depend on distinct mesh boundaries surviving the
// build (e.g. one marker placed per credit). `gltf-transform optimize`
// defaults `--join` to true, which merges compatible meshes/nodes to
// reduce draw calls -- exactly the opposite of what's needed here, and it
// silently collapses a 10-mesh file down to 1 with no error. Listed models
// get `--join false` to keep every source mesh intact.
const PRESERVE_MESHES = new Set(['grave-stones']);

mkdirSync(OUT, { recursive: true });

// Sources arrive Draco-compressed, so reading them needs the decoder.
async function makeIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      // Only needed if a SOURCE arrives already Draco-compressed; without it
      // writing such a file back out throws rather than falling back.
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });
}

// Two material problems that are invisible in a viewer and fatal in this
// scene. Both are checked for on every model rather than hardcoded per file,
// so a future download gets fixed automatically instead of silently wrong.
//
// 1. KHR_materials_pbrSpecularGlossiness is a DEPRECATED glTF extension that
//    three.js no longer supports. A model using it loads with its textures
//    unreferenced -- the oak came through as a flat untextured white tree,
//    with all five of its maps still sitting in the file. metalRough()
//    rewrites those materials to standard metallic-roughness.
//
// 2. KHR_materials_unlit makes three.js build a MeshBasicMaterial, which
//    ignores scene lighting entirely. For a photogrammetry scan that means
//    the daylight baked into its texture is displayed at full brightness in
//    a night scene, lit by a moon it cannot receive. Stripping the extension
//    puts the model back under the scene's own lighting.
async function fixMaterials(doc, name) {
  const root = doc.getRoot();
  const used = root.listExtensionsUsed().map((e) => e.extensionName);

  if (used.includes('KHR_materials_pbrSpecularGlossiness')) {
    console.log(`  ${name}: converting spec/gloss materials -> metallic/roughness`);
    await doc.transform(metalRough());
  }

  if (used.includes('KHR_materials_unlit')) {
    console.log(`  ${name}: stripping KHR_materials_unlit so the scene can light it`);
    for (const mat of root.listMaterials()) mat.setExtension('KHR_materials_unlit', null);
    for (const ext of root.listExtensionsUsed()) {
      if (ext instanceof KHRMaterialsUnlit) ext.dispose();
    }
  }
}

// Reads a source, repairs its materials, optionally decimates it to a
// triangle budget, and writes the result for the `optimize` CLI pass.
// Every model goes through here, budget or not, because the material repairs
// above are not optional for anything.
async function prepare(input, output, budget, name) {
  await MeshoptSimplifier.ready;
  const io = await makeIO();
  const doc = await io.read(input);
  await fixMaterials(doc, name);

  if (!budget) {
    mkdirSync(TMP, { recursive: true });
    await io.write(output, doc);
    return;
  }

  // The budget is file-level, not per-primitive: multi-mesh files like
  // grave-stones split it across many small primitives, each of which may
  // already be individually under `budget`. Sum triangles across every
  // primitive first. If the file is already within budget, skip
  // simplification entirely (nothing to do, and calling simplifySloppy with
  // target_index_count >= indices.length would violate its
  // target_index_count <= indices.length assertion). If it's over, derive a
  // single shrink ratio from the file-level overshoot and apply it
  // uniformly to every primitive, so the whole file lands under budget
  // while each mesh keeps its relative density.
  const primitives = [];
  let totalIndices = 0;
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

      primitives.push({ srcIndices, positionArray, indicesArray });
      totalIndices += indicesArray.length;
    }
  }

  const totalTriangles = totalIndices / 3;
  const budgetIndices = budget * 3;

  if (totalIndices > budgetIndices) {
    const ratio = budgetIndices / totalIndices;
    for (const { srcIndices, positionArray, indicesArray } of primitives) {
      const targetIndexCount =
        Math.min(Math.floor((indicesArray.length * ratio) / 3) * 3, indicesArray.length);
      if (targetIndexCount >= indicesArray.length) continue;

      const [dstIndices] = MeshoptSimplifier.simplifySloppy(
        indicesArray,
        positionArray,
        3,
        null,
        targetIndexCount,
        1, // target error: unconstrained -- target index count drives the result
      );
      srcIndices.setArray(dstIndices);
    }

    // simplifySloppy's target is advisory, not exact -- confirm the file
    // actually landed under budget rather than trusting the ratio blindly.
    let resultTriangles = 0;
    for (const { srcIndices } of primitives) {
      resultTriangles += srcIndices.getArray().length / 3;
    }
    if (resultTriangles > budget) {
      console.warn(
        `warn: ${input} simplified to ${resultTriangles} triangles, still over the ${budget} budget`,
      );
    }
  } else {
    console.log(
      `${input}: ${totalTriangles} triangles already within <=${budget} budget, skipping simplification`,
    );
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
  const noSimplify = NEVER_SIMPLIFY.has(name);
  const budget = noSimplify ? undefined : PROP_TRIANGLE_BUDGET[name];
  const textureSize = TEXTURE_SIZE[name] ?? (budget || noSimplify ? 1024 : 2048);

  const prepared = join(TMP, `${name}.glb`);
  console.log(`${input}${budget ? ` -> simplify to <=${budget} tris` : ''} -> ${prepared}`);
  await prepare(input, prepared, budget, name);
  const optimizeInput = prepared;

  console.log(`${optimizeInput} -> ${out}${noSimplify ? ' (textures only, geometry untouched)' : ''}`);
  execSync(
    `npx gltf-transform optimize "${optimizeInput}" "${out}" --compress draco --texture-compress webp --texture-size ${textureSize}${
      budget || noSimplify ? ' --simplify false' : ''
    }${PRESERVE_MESHES.has(name) ? ' --join false' : ''}`,
    { stdio: 'inherit' },
  );
}

rmSync(TMP, { recursive: true, force: true });
