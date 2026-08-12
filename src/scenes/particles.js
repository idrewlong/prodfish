import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.4 + aPhase * 6.28) * 0.6;
    p.y += sin(uTime * 0.27 + aPhase * 9.4) * 0.4;
    vTwinkle = 0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 12.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aScale * 42.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.85, 0.9, 0.6), glow * vTwinkle * uOpacity);
  }
`;

export function createFireflies(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const phase = new Float32Array(count);
  // Two thirds gather low over the marsh (z 13..47), where they read as
  // sparks against dark water; the rest are scattered along the rest of the
  // approach so the field is not empty. Evenly scattering them, as before,
  // wasted most of them against ground they could not be seen over.
  for (let i = 0; i < count; i++) {
    const overWater = i % 3 !== 0;
    if (overWater) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 15;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.15 + Math.random() * 1.1;
      pos[i * 3 + 2] = 30 + Math.sin(a) * r;
    } else {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = 0.3 + Math.random() * 1.6;
      pos[i * 3 + 2] = 4 + Math.random() * 40;
    }
    scale[i] = 0.5 + Math.random();
    phase[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
  });
  return new THREE.Points(geo, mat);
}
