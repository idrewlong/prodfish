import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    // task-12: was 0.09, tuned against a framebuffer that (pre gamma-fix)
    // never actually reached midtone brightness so the grain barely showed.
    // fix-round: user feedback was "a ton of grain" even at 0.045 — it reads
    // fine in a single still frame but compounds visibly over motion/video.
    // 0.018 keeps a faint film texture without reading as static noise.
    uGrain: { value: 0.018 },
    uVignette: { value: 0.35 },
    uCA: { value: 0.0015 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uCA;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec2 off = (vUv - 0.5) * uCA;
      vec4 c;
      c.r = texture2D(tDiffuse, vUv - off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + off).b;
      c.a = 1.0;
      float v = smoothstep(0.92, 0.25, length(vUv - 0.5));
      c.rgb *= mix(1.0, v, uVignette);
      c.rgb += (rand(vUv * (1.0 + fract(uTime))) - 0.5) * uGrain;
      gl_FragColor = c;
      // ROOT CAUSE (task-12): RenderPass draws the scene into the
      // composer's intermediate render target, whose color space is linear
      // (not sRGB) -- three.js only auto-encodes to sRGB when the render
      // target is the screen itself. Materials still tone-map correctly
      // into that linear buffer, but this ShaderPass is the pass that
      // finally writes to the screen, and a hand-written fragment shader
      // gets none of three.js's automatic colorspace_fragment chunk
      // injection (that only fires for shaders that explicitly reference
      // it). Every prior "make it brighter" pass (moon 0.5 to 9, hemisphere
      // 1.5 to 4, exposure up to 2.3) was fighting a missing gamma encode,
      // not insufficient light: writing linear values straight into an
      // sRGB-interpreted framebuffer displays as roughly value^2.2 -- e.g.
      // a correctly-tuned 0.5 gray renders back at ~0.22, and the effect
      // compounds hardest in shadows and midtones, exactly the "graveyard
      // reads as a black void" complaint. linearToOutputTexel is already
      // defined in every fragment shader three.js compiles (see
      // WebGLProgram's unconditional getTexelEncodingFunction call) -- this
      // is the same call the include-colorspace_fragment chunk makes,
      // just invoked directly since this is a raw ShaderMaterial.
      gl_FragColor = linearToOutputTexel(gl_FragColor);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const pass = new ShaderPass(FilmShader);
  composer.addPass(pass);
  return {
    composer,
    pass,
    setTime(t) { pass.uniforms.uTime.value = t; },
  };
}
